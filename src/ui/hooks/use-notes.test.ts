/**
 * use-notes hook tests — Sprint 8d.
 * Store-contract style: tests fetch helper functions.
 * The useNotes React hook requires a component render context — deferred to integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sync module to provide getServerUrl
vi.mock('../lib/sync', () => ({
    getServerUrl: vi.fn(() => 'http://localhost:8080'),
}))

import {
    postNote,
    patchNote,
    deleteNote,
    fetchSceneNotes,
    linkNoteToScene,
    unlinkNoteFromScene,
} from './use-notes'

describe('postNote', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('sends POST with correct URL and body', async () => {
        const mockNote = { id: 'note-1', title: 'Test' }
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockNote),
        })

        const result = await postNote('camp-1', { title: 'Test' })

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/campaigns/camp-1/notes',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Test' }),
            },
        )
        expect(result).toEqual(mockNote)
    })

    it('throws on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 400 })
        await expect(postNote('camp-1', { title: '' })).rejects.toThrow('HTTP 400')
    })
})

describe('patchNote', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('sends PATCH with correct URL and body', async () => {
        const mockNote = { id: 'note-1', title: 'Updated' }
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockNote),
        })

        const result = await patchNote('note-1', { title: 'Updated' })

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/notes/note-1',
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Updated' }),
            },
        )
        expect(result).toEqual(mockNote)
    })

    it('throws on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 })
        await expect(patchNote('note-1', { title: 'X' })).rejects.toThrow('HTTP 404')
    })
})

describe('deleteNote', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('sends DELETE with correct URL', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

        await deleteNote('note-1')

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/notes/note-1',
            { method: 'DELETE' },
        )
    })

    it('throws on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
        await expect(deleteNote('note-1')).rejects.toThrow('HTTP 500')
    })
})

describe('fetchSceneNotes', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('sends GET to scene notes endpoint', async () => {
        const mockNotes = [{ id: 'n1' }, { id: 'n2' }]
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockNotes),
        })

        const result = await fetchSceneNotes('scene-1')

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/scenes/scene-1/notes',
        )
        expect(result).toEqual(mockNotes)
    })

    it('throws on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 })
        await expect(fetchSceneNotes('scene-1')).rejects.toThrow('HTTP 404')
    })
})

describe('linkNoteToScene', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('sends POST to junction endpoint', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

        await linkNoteToScene('scene-1', 'note-1')

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/scenes/scene-1/notes/note-1',
            { method: 'POST' },
        )
    })

    it('throws on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 })
        await expect(linkNoteToScene('s1', 'n1')).rejects.toThrow('HTTP 503')
    })
})

describe('unlinkNoteFromScene', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    it('sends DELETE to junction endpoint', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

        await unlinkNoteFromScene('scene-1', 'note-1')

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/scenes/scene-1/notes/note-1',
            { method: 'DELETE' },
        )
    })

    it('throws on non-OK response', async () => {
        ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 })
        await expect(unlinkNoteFromScene('s1', 'n1')).rejects.toThrow('HTTP 404')
    })
})
