/**
 * AudioDeviceManager tests — mocks navigator.mediaDevices.
 * Tests enumerateOutputDevices, setOutputDevice, setSinkId call, graceful degradation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── navigator.mediaDevices mock ────────────────────────────────────────────────

const mockDevices: MediaDeviceInfo[] = [
    { kind: 'audiooutput', deviceId: 'device-1', label: 'Speakers', groupId: 'g1', toJSON: () => ({}) } as MediaDeviceInfo,
    { kind: 'audiooutput', deviceId: 'device-2', label: 'Headphones', groupId: 'g2', toJSON: () => ({}) } as MediaDeviceInfo,
    { kind: 'audioinput', deviceId: 'mic-1', label: 'Microphone', groupId: 'g3', toJSON: () => ({}) } as MediaDeviceInfo,
]

const mockEnumerateDevices = vi.fn().mockResolvedValue(mockDevices)

vi.stubGlobal('navigator', {
    mediaDevices: {
        enumerateDevices: mockEnumerateDevices,
    },
})

import { AudioDeviceManager } from './audio-device-manager'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AudioDeviceManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockEnumerateDevices.mockResolvedValue(mockDevices)
    })

    describe('enumerateOutputDevices', () => {
        it('returns only audiooutput devices', async () => {
            const devices = await AudioDeviceManager.enumerateOutputDevices()
            expect(devices).toHaveLength(2)
            expect(devices.every((d) => d.kind === 'audiooutput')).toBe(true)
        })

        it('returns device labels', async () => {
            const devices = await AudioDeviceManager.enumerateOutputDevices()
            expect(devices[0].label).toBe('Speakers')
            expect(devices[1].label).toBe('Headphones')
        })

        it('returns empty array when enumerateDevices throws', async () => {
            mockEnumerateDevices.mockRejectedValueOnce(new Error('Permission denied'))
            const devices = await AudioDeviceManager.enumerateOutputDevices()
            expect(devices).toHaveLength(0)
        })

        it('returns empty array when mediaDevices is unavailable', async () => {
            vi.stubGlobal('navigator', {})
            const devices = await AudioDeviceManager.enumerateOutputDevices()
            expect(devices).toHaveLength(0)
            // Restore
            vi.stubGlobal('navigator', { mediaDevices: { enumerateDevices: mockEnumerateDevices } })
        })
    })

    describe('setOutputDevice + setSinkId', () => {
        it('calls setSinkId on registered video elements', async () => {
            const setSinkId = vi.fn().mockResolvedValue(undefined)
            const el = { setSinkId } as unknown as HTMLVideoElement

            await AudioDeviceManager.registerVideoElement(el)
            await AudioDeviceManager.setOutputDevice('device-1')

            expect(setSinkId).toHaveBeenCalledWith('device-1')
        })

        it('applies current device to newly registered elements', async () => {
            await AudioDeviceManager.setOutputDevice('device-2')
            const setSinkId = vi.fn().mockResolvedValue(undefined)
            const el = { setSinkId } as unknown as HTMLVideoElement

            await AudioDeviceManager.registerVideoElement(el)

            expect(setSinkId).toHaveBeenCalledWith('device-2')
        })

        it('does not call setSinkId after element is unregistered', async () => {
            const setSinkId = vi.fn().mockResolvedValue(undefined)
            const el = { setSinkId } as unknown as HTMLVideoElement

            await AudioDeviceManager.registerVideoElement(el)
            AudioDeviceManager.unregisterVideoElement(el)
            setSinkId.mockClear()

            await AudioDeviceManager.setOutputDevice('device-1')
            expect(setSinkId).not.toHaveBeenCalled()
        })

        it('gracefully handles missing setSinkId (no throw)', async () => {
            const el = {} as HTMLVideoElement // no setSinkId
            await AudioDeviceManager.registerVideoElement(el)
            // Should not throw
            await expect(AudioDeviceManager.setOutputDevice('device-1')).resolves.toBeUndefined()
        })

        it('gracefully handles setSinkId rejection (no throw)', async () => {
            const setSinkId = vi.fn().mockRejectedValue(new Error('Not allowed'))
            const el = { setSinkId } as unknown as HTMLVideoElement

            await AudioDeviceManager.registerVideoElement(el)
            await expect(AudioDeviceManager.setOutputDevice('device-1')).resolves.toBeUndefined()
        })
    })
})
