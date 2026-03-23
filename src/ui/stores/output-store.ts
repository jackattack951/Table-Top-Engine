/**
 * Output management store (Sprint 9b).
 *
 * Tracks available physical displays and active AV output windows.
 * Each output is tagged with exactly one role: BG (Background) or GB (Game Board).
 * Rule 13: Outputs are user-enabled, never auto-created.
 * Rule 14: One display, one role — BG or GB, never both.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { DisplayInfo, OutputRole, OutputConfig } from '@shared/output-types'

// Re-export shared types for consumers that import from the store
export type { DisplayInfo, OutputRole, OutputConfig }

// ── Store ────────────────────────────────────────────────────────────────────

interface OutputState {
    availableDisplays: DisplayInfo[]
    outputs: {
        BG: OutputConfig | null
        GB: OutputConfig | null
    }

    setDisplays: (displays: DisplayInfo[]) => void
    enableOutput: (displayId: number | 'windowed', role: OutputRole) => void
    disableOutput: (role: OutputRole) => void
    setFullscreen: (role: OutputRole, fullscreen: boolean) => void
}

export const useOutputStore = create<OutputState>()(
    subscribeWithSelector((set) => ({
        availableDisplays: [],
        outputs: { BG: null, GB: null },

        setDisplays: (displays) => set({ availableDisplays: displays }),

        enableOutput: (displayId, role) =>
            set((state) => ({
                outputs: {
                    ...state.outputs,
                    [role]: { displayId, role, fullscreen: displayId !== 'windowed' },
                },
            })),

        disableOutput: (role) =>
            set((state) => ({
                outputs: { ...state.outputs, [role]: null },
            })),

        setFullscreen: (role, fullscreen) =>
            set((state) => {
                const current = state.outputs[role]
                if (!current) return state
                return {
                    outputs: {
                        ...state.outputs,
                        [role]: { ...current, fullscreen },
                    },
                }
            }),
    }))
)
