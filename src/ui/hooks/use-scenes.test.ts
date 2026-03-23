/**
 * use-scenes hook tests — Sprint 8a.
 * Store-contract style: tests postScene and patchScene fetch helpers.
 * The useScenes React hook requires a component render context — deferred to integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sync module to provide getServerUrl
vi.mock('../lib/sync', () => ({
    getServerUrl: vi.fn(() => 'http://localhost:8080'),
}))

import { postScene, patchScene } from './use-scenes'

describe('postScene', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('sends POST with correct URL and body', async () => {
        const mockScene = { id: 'scene-1', name: 'Tavern Ambush' }
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockScene),
        })

        const result = await postScene('campaign-1', 'Tavern Ambush')

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/campaigns/campaign-1/scenes',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Tavern Ambush' }),
            },
        )
        expect(result).toEqual(mockScene)
    })

    it('throws on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 500,
        })

        await expect(postScene('campaign-1', 'Bad')).rejects.toThrow('HTTP 500')
    })
})

describe('patchScene', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('sends PATCH with correct URL and body', async () => {
        const mockScene = { id: 'scene-1', name: 'Updated' }
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockScene),
        })

        const result = await patchScene('scene-1', { name: 'Updated' })

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/scenes/scene-1',
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated' }),
            },
        )
        expect(result).toEqual(mockScene)
    })

    it('throws on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 404,
        })

        await expect(patchScene('scene-1', { name: 'X' })).rejects.toThrow('HTTP 404')
    })
})
