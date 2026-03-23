import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Note } from '@core/types'

export type NotesViewMode = 'list' | 'grid'

interface NotesState {
    notes: Note[]
    activeNoteId: string | null
    sceneNoteLinks: Record<string, string[]> // sceneId → noteId[] cache
    isLoading: boolean
    viewMode: NotesViewMode

    setNotes: (notes: Note[]) => void
    addNote: (note: Note) => void
    updateNote: (id: string, patch: Partial<Note>) => void
    removeNote: (id: string) => void
    setActiveNoteId: (id: string | null) => void
    setSceneNoteLinks: (sceneId: string, noteIds: string[]) => void
    getNotesForScene: (sceneId: string) => Note[]
    setLoading: (loading: boolean) => void
    setViewMode: (mode: NotesViewMode) => void
}

export const useNotesStore = create<NotesState>()(
    subscribeWithSelector((set, get) => ({
        notes: [],
        activeNoteId: null,
        sceneNoteLinks: {},
        isLoading: false,
        viewMode: 'list' as NotesViewMode,

        setNotes: (notes) => set({ notes }),
        addNote: (note) => set((s) => ({ notes: [...s.notes, note] })),
        updateNote: (id, patch) => set((s) => ({
            notes: s.notes.map((n) => n.id === id ? { ...n, ...patch } : n),
        })),
        removeNote: (id) => set((s) => ({
            notes: s.notes.filter((n) => n.id !== id),
            activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
        })),
        setActiveNoteId: (id) => set({ activeNoteId: id }),
        setSceneNoteLinks: (sceneId, noteIds) => set((s) => ({
            sceneNoteLinks: { ...s.sceneNoteLinks, [sceneId]: noteIds },
        })),
        getNotesForScene: (sceneId) => {
            const state = get()
            const noteIds = state.sceneNoteLinks[sceneId] ?? []
            return state.notes.filter((n) => noteIds.includes(n.id))
        },
        setLoading: (loading) => set({ isLoading: loading }),
        setViewMode: (mode) => set({ viewMode: mode }),
    }))
)
