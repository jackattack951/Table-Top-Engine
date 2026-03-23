/**
 * NotesStore tests.
 *
 * Pure Zustand store tests — no mocking required.
 * Source: src/ui/stores/notes-store.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useNotesStore } from './notes-store'
import type { Note, NoteType } from '@core/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNote(overrides: Partial<Note> = {}): Note {
    return {
        id: 'n1',
        campaignId: 'camp1',
        title: 'Test Note',
        type: 'general' as NoteType,
        body: 'Some content',
        tags: [],
        sourceFile: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    }
}

const INITIAL_STATE = { notes: [], activeNoteId: null, sceneNoteLinks: {}, isLoading: false }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotesStore — setNotes', () => {
    beforeEach(() => {
        useNotesStore.setState(INITIAL_STATE)
    })

    it('replaces the notes array', () => {
        const notes = [makeNote({ id: 'n1' }), makeNote({ id: 'n2', title: 'Second' })]
        useNotesStore.getState().setNotes(notes)
        expect(useNotesStore.getState().notes).toHaveLength(2)
        expect(useNotesStore.getState().notes[0]!.id).toBe('n1')
        expect(useNotesStore.getState().notes[1]!.id).toBe('n2')
    })

    it('replaces existing notes entirely (not appending)', () => {
        useNotesStore.getState().setNotes([makeNote({ id: 'n1' })])
        useNotesStore.getState().setNotes([makeNote({ id: 'n2' })])
        expect(useNotesStore.getState().notes).toHaveLength(1)
        expect(useNotesStore.getState().notes[0]!.id).toBe('n2')
    })
})

describe('NotesStore — addNote', () => {
    beforeEach(() => {
        useNotesStore.setState(INITIAL_STATE)
    })

    it('appends a note to the array', () => {
        useNotesStore.getState().addNote(makeNote({ id: 'n1' }))
        expect(useNotesStore.getState().notes).toHaveLength(1)
        expect(useNotesStore.getState().notes[0]!.id).toBe('n1')
    })

    it('preserves existing notes when adding', () => {
        useNotesStore.getState().addNote(makeNote({ id: 'n1' }))
        useNotesStore.getState().addNote(makeNote({ id: 'n2', title: 'Second' }))
        expect(useNotesStore.getState().notes).toHaveLength(2)
        expect(useNotesStore.getState().notes[0]!.id).toBe('n1')
        expect(useNotesStore.getState().notes[1]!.id).toBe('n2')
    })
})

describe('NotesStore — updateNote', () => {
    beforeEach(() => {
        useNotesStore.setState({
            ...INITIAL_STATE,
            notes: [
                makeNote({ id: 'n1', title: 'Original' }),
                makeNote({ id: 'n2', title: 'Untouched' }),
            ],
        })
    })

    it('patches only the matching note by ID', () => {
        useNotesStore.getState().updateNote('n1', { title: 'Updated' })
        const notes = useNotesStore.getState().notes
        expect(notes.find((n) => n.id === 'n1')!.title).toBe('Updated')
        expect(notes.find((n) => n.id === 'n2')!.title).toBe('Untouched')
    })

    it('merges partial updates (preserves other fields)', () => {
        useNotesStore.getState().updateNote('n1', { tags: ['combat'] })
        const note = useNotesStore.getState().notes.find((n) => n.id === 'n1')!
        expect(note.tags).toEqual(['combat'])
        expect(note.title).toBe('Original')
        expect(note.body).toBe('Some content')
    })

    it('does not modify the array if ID does not match', () => {
        useNotesStore.getState().updateNote('nonexistent', { title: 'Nope' })
        expect(useNotesStore.getState().notes).toHaveLength(2)
        expect(useNotesStore.getState().notes[0]!.title).toBe('Original')
        expect(useNotesStore.getState().notes[1]!.title).toBe('Untouched')
    })
})

describe('NotesStore — removeNote', () => {
    beforeEach(() => {
        useNotesStore.setState({
            ...INITIAL_STATE,
            notes: [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })],
        })
    })

    it('filters out the note by ID', () => {
        useNotesStore.getState().removeNote('n1')
        const ids = useNotesStore.getState().notes.map((n) => n.id)
        expect(ids).not.toContain('n1')
        expect(ids).toContain('n2')
    })

    it('clears activeNoteId when the active note is removed', () => {
        useNotesStore.setState({ activeNoteId: 'n1' })
        useNotesStore.getState().removeNote('n1')
        expect(useNotesStore.getState().activeNoteId).toBeNull()
    })

    it('preserves activeNoteId when a different note is removed', () => {
        useNotesStore.setState({ activeNoteId: 'n1' })
        useNotesStore.getState().removeNote('n2')
        expect(useNotesStore.getState().activeNoteId).toBe('n1')
    })
})

describe('NotesStore — setActiveNoteId', () => {
    beforeEach(() => {
        useNotesStore.setState(INITIAL_STATE)
    })

    it('sets the active note ID', () => {
        useNotesStore.getState().setActiveNoteId('n1')
        expect(useNotesStore.getState().activeNoteId).toBe('n1')
    })

    it('clears the active note ID when passed null', () => {
        useNotesStore.getState().setActiveNoteId('n1')
        useNotesStore.getState().setActiveNoteId(null)
        expect(useNotesStore.getState().activeNoteId).toBeNull()
    })
})

describe('NotesStore — setLoading', () => {
    beforeEach(() => {
        useNotesStore.setState(INITIAL_STATE)
    })

    it('toggles loading state to true', () => {
        useNotesStore.getState().setLoading(true)
        expect(useNotesStore.getState().isLoading).toBe(true)
    })

    it('toggles loading state back to false', () => {
        useNotesStore.getState().setLoading(true)
        useNotesStore.getState().setLoading(false)
        expect(useNotesStore.getState().isLoading).toBe(false)
    })
})

describe('NotesStore — sceneNoteLinks', () => {
    beforeEach(() => {
        useNotesStore.setState({
            ...INITIAL_STATE,
            notes: [
                makeNote({ id: 'n1', title: 'Note A' }),
                makeNote({ id: 'n2', title: 'Note B' }),
                makeNote({ id: 'n3', title: 'Note C' }),
            ],
        })
    })

    it('setSceneNoteLinks stores noteIds for a sceneId', () => {
        useNotesStore.getState().setSceneNoteLinks('s1', ['n1', 'n2'])
        expect(useNotesStore.getState().sceneNoteLinks['s1']).toEqual(['n1', 'n2'])
    })

    it('setSceneNoteLinks replaces existing links for the same sceneId', () => {
        useNotesStore.getState().setSceneNoteLinks('s1', ['n1', 'n2'])
        useNotesStore.getState().setSceneNoteLinks('s1', ['n3'])
        expect(useNotesStore.getState().sceneNoteLinks['s1']).toEqual(['n3'])
    })

    it('setSceneNoteLinks preserves links for other sceneIds', () => {
        useNotesStore.getState().setSceneNoteLinks('s1', ['n1'])
        useNotesStore.getState().setSceneNoteLinks('s2', ['n2', 'n3'])
        expect(useNotesStore.getState().sceneNoteLinks['s1']).toEqual(['n1'])
        expect(useNotesStore.getState().sceneNoteLinks['s2']).toEqual(['n2', 'n3'])
    })

    it('getNotesForScene returns matching notes from the cache', () => {
        useNotesStore.getState().setSceneNoteLinks('s1', ['n1', 'n3'])
        const notes = useNotesStore.getState().getNotesForScene('s1')
        expect(notes).toHaveLength(2)
        expect(notes.map((n) => n.id)).toEqual(['n1', 'n3'])
    })

    it('getNotesForScene returns empty array for unknown sceneId', () => {
        const notes = useNotesStore.getState().getNotesForScene('unknown')
        expect(notes).toEqual([])
    })

    it('getNotesForScene skips noteIds not present in the notes array', () => {
        useNotesStore.getState().setSceneNoteLinks('s1', ['n1', 'deleted-id', 'n2'])
        const notes = useNotesStore.getState().getNotesForScene('s1')
        expect(notes).toHaveLength(2)
        expect(notes.map((n) => n.id)).toEqual(['n1', 'n2'])
    })
})
