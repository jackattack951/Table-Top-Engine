/**
 * settings-store tests — store-contract tests (no jsdom rendering).
 * Tests default values, companion settings fields, export round-trip,
 * and validateSettingsExport.
 *
 * Note: zustand/persist reads localStorage on module init. We stub
 * localStorage before importing the store so hydration uses the mock.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── localStorage mock ─────────────────────────────────────────────────────────
// Must be stubbed before the store is imported so persist middleware
// picks up the mock storage engine.

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value },
    removeItem: (key: string) => { delete storage[key] },
    clear: () => { Object.keys(storage).forEach((k) => delete storage[k]) },
})

import { useSettingsStore, validateSettingsExport } from './settings-store'
import type { SettingsExport } from './settings-store'

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore(): void {
    useSettingsStore.setState({
        audioOutputDeviceId: '',
        masterVolumeDefault: 0.8,
        musicVolumeDefault: 0.7,
        sfxVolumeDefault: 0.7,
        bgVideoVolumeDefault: 0.5,
        gbVideoVolumeDefault: 0.5,
        ambienceVolumeDefault: 0.7,
        characterSelectMode: 'manual-only',
        maxPlayers: 8,
        autoApprove: false,
        requireReadyCheck: false,
        sessionCodeLength: 6,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSettingsStore', () => {
    beforeEach(() => {
        resetStore()
    })

    describe('default values', () => {
        it('has correct audio defaults', () => {
            const s = useSettingsStore.getState()
            expect(s.audioOutputDeviceId).toBe('')
            expect(s.masterVolumeDefault).toBe(0.8)
            expect(s.musicVolumeDefault).toBe(0.7)
            expect(s.sfxVolumeDefault).toBe(0.7)
            expect(s.bgVideoVolumeDefault).toBe(0.5)
            expect(s.gbVideoVolumeDefault).toBe(0.5)
            expect(s.ambienceVolumeDefault).toBe(0.7)
        })

        it('has correct companion defaults', () => {
            const s = useSettingsStore.getState()
            expect(s.characterSelectMode).toBe('manual-only')
            expect(s.maxPlayers).toBe(8)
            expect(s.autoApprove).toBe(false)
            expect(s.requireReadyCheck).toBe(false)
            expect(s.sessionCodeLength).toBe(6)
        })
    })

    describe('volume setters', () => {
        it('clamps volume to 0–1', () => {
            useSettingsStore.getState().setMasterVolumeDefault(1.5)
            expect(useSettingsStore.getState().masterVolumeDefault).toBe(1)
            useSettingsStore.getState().setMasterVolumeDefault(-0.1)
            expect(useSettingsStore.getState().masterVolumeDefault).toBe(0)
        })

        it('sets each volume independently', () => {
            useSettingsStore.getState().setMusicVolumeDefault(0.42)
            expect(useSettingsStore.getState().musicVolumeDefault).toBe(0.42)
            expect(useSettingsStore.getState().masterVolumeDefault).toBe(0.8)
        })

        it('sets all volume defaults', () => {
            useSettingsStore.getState().setSfxVolumeDefault(0.3)
            useSettingsStore.getState().setBgVideoVolumeDefault(0.6)
            useSettingsStore.getState().setGbVideoVolumeDefault(0.7)
            useSettingsStore.getState().setAmbienceVolumeDefault(0.4)
            const s = useSettingsStore.getState()
            expect(s.sfxVolumeDefault).toBe(0.3)
            expect(s.bgVideoVolumeDefault).toBe(0.6)
            expect(s.gbVideoVolumeDefault).toBe(0.7)
            expect(s.ambienceVolumeDefault).toBe(0.4)
        })
    })

    describe('companion settings', () => {
        it('sets characterSelectMode', () => {
            useSettingsStore.getState().setCharacterSelectMode('roster-only')
            expect(useSettingsStore.getState().characterSelectMode).toBe('roster-only')
        })

        it('clamps maxPlayers to 1–8', () => {
            useSettingsStore.getState().setMaxPlayers(0)
            expect(useSettingsStore.getState().maxPlayers).toBe(1)
            useSettingsStore.getState().setMaxPlayers(99)
            expect(useSettingsStore.getState().maxPlayers).toBe(8)
            useSettingsStore.getState().setMaxPlayers(4)
            expect(useSettingsStore.getState().maxPlayers).toBe(4)
        })

        it('clamps sessionCodeLength to 4–8', () => {
            useSettingsStore.getState().setSessionCodeLength(2)
            expect(useSettingsStore.getState().sessionCodeLength).toBe(4)
            useSettingsStore.getState().setSessionCodeLength(10)
            expect(useSettingsStore.getState().sessionCodeLength).toBe(8)
        })

        it('sets autoApprove', () => {
            useSettingsStore.getState().setAutoApprove(true)
            expect(useSettingsStore.getState().autoApprove).toBe(true)
        })

        it('sets requireReadyCheck', () => {
            useSettingsStore.getState().setRequireReadyCheck(true)
            expect(useSettingsStore.getState().requireReadyCheck).toBe(true)
        })
    })

    describe('audioOutputDeviceId', () => {
        it('stores device id', () => {
            useSettingsStore.getState().setAudioOutputDeviceId('some-device-id')
            expect(useSettingsStore.getState().audioOutputDeviceId).toBe('some-device-id')
        })

        it('allows clearing back to empty string (system default)', () => {
            useSettingsStore.getState().setAudioOutputDeviceId('some-device-id')
            useSettingsStore.getState().setAudioOutputDeviceId('')
            expect(useSettingsStore.getState().audioOutputDeviceId).toBe('')
        })
    })
})

describe('validateSettingsExport', () => {
    const validExport: SettingsExport = {
        version: 1,
        theme: 'dark',
        density: 'comfortable',
        settings: {
            audioOutputDeviceId: '',
            masterVolumeDefault: 0.8,
            musicVolumeDefault: 0.7,
            sfxVolumeDefault: 0.7,
            bgVideoVolumeDefault: 0.5,
            gbVideoVolumeDefault: 0.5,
            ambienceVolumeDefault: 0.7,
            characterSelectMode: 'manual-only',
            maxPlayers: 8,
            autoApprove: false,
            requireReadyCheck: false,
            sessionCodeLength: 6,
        },
    }

    it('returns the export for a valid payload', () => {
        const result = validateSettingsExport(validExport)
        expect(result).not.toBeNull()
        expect(result?.version).toBe(1)
        expect(result?.theme).toBe('dark')
        expect(result?.settings.masterVolumeDefault).toBe(0.8)
    })

    it('accepts light theme and compact density', () => {
        expect(validateSettingsExport({ ...validExport, theme: 'light', density: 'compact' })).not.toBeNull()
    })

    it('returns null for missing version', () => {
        const { version: _v, ...noVersion } = validExport
        expect(validateSettingsExport(noVersion)).toBeNull()
    })

    it('returns null for invalid theme', () => {
        expect(validateSettingsExport({ ...validExport, theme: 'sepia' })).toBeNull()
    })

    it('returns null for invalid density', () => {
        expect(validateSettingsExport({ ...validExport, density: 'large' })).toBeNull()
    })

    it('returns null for missing settings key', () => {
        const { audioOutputDeviceId: _a, ...restSettings } = validExport.settings
        expect(validateSettingsExport({ ...validExport, settings: restSettings })).toBeNull()
    })

    it('returns null for invalid characterSelectMode', () => {
        const bad = { ...validExport, settings: { ...validExport.settings, characterSelectMode: 'invalid' } }
        expect(validateSettingsExport(bad)).toBeNull()
    })

    it('returns null for null input', () => {
        expect(validateSettingsExport(null)).toBeNull()
    })

    it('returns null for non-object input', () => {
        expect(validateSettingsExport('string')).toBeNull()
        expect(validateSettingsExport(42)).toBeNull()
    })

    it('export serializes and deserializes round-trip', () => {
        const json = JSON.stringify(validExport)
        const parsed: unknown = JSON.parse(json)
        const result = validateSettingsExport(parsed)
        expect(result).not.toBeNull()
        expect(result?.settings.sfxVolumeDefault).toBe(0.7)
    })
})
