/**
 * SpellsStore — Session-scoped search history + pinned spells (Sprint 24c).
 * No persistence — resets on session restart.
 */
import { create } from 'zustand'

const MAX_HISTORY = 10
const MAX_PINS = 5

interface SpellsState {
    searchHistory: string[]
    pinnedSpellIds: string[]
    pushHistory: (query: string) => void
    clearHistory: () => void
    pinSpell: (id: string) => void
    unpinSpell: (id: string) => void
}

export const useSpellsStore = create<SpellsState>()((set) => ({
    searchHistory: [],
    pinnedSpellIds: [],

    pushHistory: (query) =>
        set((state) => {
            const trimmed = query.trim()
            if (!trimmed) return state
            const filtered = state.searchHistory.filter((q) => q !== trimmed)
            return { searchHistory: [trimmed, ...filtered].slice(0, MAX_HISTORY) }
        }),

    clearHistory: () => set({ searchHistory: [] }),

    pinSpell: (id) =>
        set((state) => {
            if (state.pinnedSpellIds.includes(id)) return state
            return { pinnedSpellIds: [...state.pinnedSpellIds, id].slice(0, MAX_PINS) }
        }),

    unpinSpell: (id) =>
        set((state) => ({
            pinnedSpellIds: state.pinnedSpellIds.filter((p) => p !== id),
        })),
}))
