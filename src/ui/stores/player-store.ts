/**
 * Cockpit-side player state store.
 * Server is the single source of truth — this store receives LOBBY_STATE
 * updates via sync.ts. Components never mutate player state locally.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PlayerCharacter } from '@shared/player-types'

export type SessionPhase = 'inactive' | 'lobby' | 'ready-check' | 'live' | 'ended'

interface PlayerStoreState {
    /** All connected players, keyed by token. Record, NOT Map (Zustand shallow equality). */
    players: Record<string, PlayerCharacter>
    sessionPhase: SessionPhase
    sessionCode: string | null

    setPlayers: (players: PlayerCharacter[]) => void
    setSessionPhase: (phase: SessionPhase) => void
    setSessionCode: (code: string | null) => void
    reset: () => void
}

export const usePlayerStore = create<PlayerStoreState>()(
    subscribeWithSelector((set) => ({
        players: {},
        sessionPhase: 'inactive',
        sessionCode: null,

        setPlayers: (players) => {
            const record: Record<string, PlayerCharacter> = {}
            for (const p of players) {
                record[p.token] = p
            }
            set({ players: record })
        },

        setSessionPhase: (sessionPhase) => set({ sessionPhase }),
        setSessionCode: (sessionCode) => set({ sessionCode }),

        reset: () => set({
            players: {},
            sessionPhase: 'inactive',
            sessionCode: null,
        }),
    }))
)
