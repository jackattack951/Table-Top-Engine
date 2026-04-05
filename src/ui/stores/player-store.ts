/**
 * Cockpit-side player state store.
 * Server is the single source of truth — this store receives LOBBY_STATE
 * updates via sync.ts. Components never mutate player state locally.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PlayerCharacter, RollResult, CharacterSelectMode } from '@shared/player-types'

export type SessionPhase = 'inactive' | 'lobby' | 'ready-check' | 'live' | 'ended'

interface PlayerStoreState {
    /** All connected players, keyed by token. Record, NOT Map (Zustand shallow equality). */
    players: Record<string, PlayerCharacter>
    sessionPhase: SessionPhase
    sessionCode: string | null

    /** Roll results received from players. Cleared when a new prompt is sent. */
    rollResults: RollResult[]
    /** ID of the currently active roll prompt, or null if none pending. */
    activePromptId: string | null
    /** Character select mode for the current session. */
    characterSelectMode: CharacterSelectMode

    setPlayers: (players: PlayerCharacter[]) => void
    setSessionPhase: (phase: SessionPhase) => void
    setSessionCode: (code: string | null) => void
    setCharacterSelectMode: (mode: CharacterSelectMode) => void
    /** Patch a single player's fields without a full LOBBY_STATE update. */
    patchPlayer: (token: string, patch: Partial<PlayerCharacter>) => void
    addRollResult: (result: RollResult) => void
    setActivePromptId: (id: string | null) => void
    reset: () => void
}

export const usePlayerStore = create<PlayerStoreState>()(
    subscribeWithSelector((set) => ({
        players: {},
        sessionPhase: 'inactive',
        sessionCode: null,
        rollResults: [],
        activePromptId: null,
        characterSelectMode: 'manual-only',

        setPlayers: (players) => {
            const record: Record<string, PlayerCharacter> = {}
            for (const p of players) {
                record[p.token] = p
            }
            set({ players: record })
        },

        setSessionPhase: (sessionPhase) => set({ sessionPhase }),
        setSessionCode: (sessionCode) => set({ sessionCode }),
        setCharacterSelectMode: (characterSelectMode) => set({ characterSelectMode }),

        patchPlayer: (token, patch) => set((state) => {
            const player = state.players[token]
            if (!player) return state
            return { players: { ...state.players, [token]: { ...player, ...patch } } }
        }),

        addRollResult: (result) => set((state) => ({
            rollResults: [...state.rollResults, result],
        })),

        setActivePromptId: (id) => set({ activePromptId: id, ...(id ? {} : { rollResults: [] }) }),

        reset: () => set({
            players: {},
            sessionPhase: 'inactive',
            sessionCode: null,
            rollResults: [],
            activePromptId: null,
            characterSelectMode: 'manual-only',
        }),
    }))
)
