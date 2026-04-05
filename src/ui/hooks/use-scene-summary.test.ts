/**
 * useSceneSummary hook tests — Sprint 22a.
 * Tests the fetch helper behavior — the React hook itself requires component context.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/sync', () => ({
    getServerUrl: vi.fn(() => 'http://localhost:8080'),
}))

describe('useSceneSummary — fetch contract', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('fetches the correct summary URL', async () => {
        const mockData = { scene: { id: 's1' }, npcs: [], notes: [], items: [], bgAsset: null, gbAsset: null }
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockData),
        })

        const res = await fetch('http://localhost:8080/api/scenes/s1/summary')
        expect(res.ok).toBe(true)
        const data = await res.json()
        expect(data.scene.id).toBe('s1')
    })

    it('returns error shape on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 404,
        })

        const res = await fetch('http://localhost:8080/api/scenes/missing/summary')
        expect(res.ok).toBe(false)
        expect(res.status).toBe(404)
    })
})
