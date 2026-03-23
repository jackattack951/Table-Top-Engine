import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CombatState, Combatant } from '@core/types'

/**
 * Generate a UUID using the Web Crypto API — available in Chromium renderer,
 * modern Node.js (≥14.17), and Vitest's node environment. No Node `crypto`
 * import needed, so this file stays renderer-safe.
 */
function uuid(): string {
    // globalThis.crypto is available in browser, Electron renderer, and Node ≥19
    // For Node <19 in Vitest, crypto is available as a global since Node 15+
    return globalThis.crypto.randomUUID()
}

interface CombatStore extends CombatState {
    setCombatants: (combatants: Combatant[]) => void
    addCombatant: (data: Omit<Combatant, 'id' | 'sortOrder'>) => void
    removeCombatant: (id: string) => void
    adjustHP: (id: string, amount: number) => void
    toggleCondition: (id: string, condition: string) => void
    nextTurn: () => void
    reorder: (fromIndex: number, toIndex: number) => void
    reset: () => void
}

const initialState: CombatState = {
    combatants: [],
    currentRound: 1,
    activeCombatantId: null,
}

export const useCombatStore = create<CombatStore>()(
    subscribeWithSelector((set) => ({
        ...initialState,

        setCombatants: (combatants) => set({ combatants }),

        /**
         * Adds a new combatant, sorted by initiative descending.
         * If this is the first combatant, it becomes the active turn.
         */
        addCombatant: (data) =>
            set((state) => {
                const newCombatant: Combatant = {
                    ...data,
                    id: uuid(),
                    sortOrder: 0, // will be recalculated after sort
                }
                // Insert and sort by initiative descending, then assign sortOrder
                const updated = [...state.combatants, newCombatant]
                    .sort((a, b) => b.initiative - a.initiative)
                    .map((c, i) => ({ ...c, sortOrder: i }))

                return {
                    combatants: updated,
                    // If combat hasn't started yet, set the new combatant as active
                    // only if there was nobody active before
                    activeCombatantId: state.activeCombatantId ?? (updated[0]?.id ?? null),
                }
            }),

        /**
         * Removes a combatant by ID.
         * Adjusts activeCombatantId if the removed combatant was active.
         */
        removeCombatant: (id) =>
            set((state) => {
                const updated = state.combatants
                    .filter((c) => c.id !== id)
                    .map((c, i) => ({ ...c, sortOrder: i }))

                let nextActiveId = state.activeCombatantId
                if (state.activeCombatantId === id) {
                    // The active combatant was removed — advance to next in list
                    const removedIndex = state.combatants.findIndex((c) => c.id === id)
                    const nextIndex = Math.min(removedIndex, updated.length - 1)
                    nextActiveId = updated[nextIndex]?.id ?? null
                }

                return {
                    combatants: updated,
                    activeCombatantId: nextActiveId,
                }
            }),

        adjustHP: (id, amount) =>
            set((state) => ({
                combatants: state.combatants.map((c) =>
                    c.id === id
                        ? { ...c, hpCurrent: Math.min(c.hpMax, Math.max(0, c.hpCurrent + amount)) }
                        : c
                ),
            })),

        /**
         * Toggles a condition on/off. Conditions array never has duplicates.
         */
        toggleCondition: (id, condition) =>
            set((state) => ({
                combatants: state.combatants.map((c) =>
                    c.id === id
                        ? {
                            ...c,
                            conditions: c.conditions.includes(condition)
                                ? c.conditions.filter((cond) => cond !== condition)
                                : [...c.conditions, condition],
                        }
                        : c
                ),
            })),

        nextTurn: () =>
            set((state) => {
                if (state.combatants.length === 0) return {}
                const idx = state.combatants.findIndex((c) => c.id === state.activeCombatantId)
                const nextIdx = (idx + 1) % state.combatants.length
                const isNewRound = nextIdx === 0
                return {
                    activeCombatantId: state.combatants[nextIdx]?.id ?? null,
                    currentRound: isNewRound ? state.currentRound + 1 : state.currentRound,
                }
            }),

        reorder: (fromIndex, toIndex) =>
            set((state) => {
                const updated = [...state.combatants]
                const [moved] = updated.splice(fromIndex, 1)
                if (moved) updated.splice(toIndex, 0, moved)
                return { combatants: updated.map((c, i) => ({ ...c, sortOrder: i })) }
            }),

        reset: () => set(initialState),
    }))
)
