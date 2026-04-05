/**
 * Companion-side player state store.
 * Tracks the local player's own state (name, HP, conditions, etc.).
 * Server is the single source of truth — this store receives updates via companion-sync.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PlayerCharacter, PlayerItem, PlayerWhisper, PlayerMessage, RollPrompt, AbilityScore } from '@shared/player-types'

export type CompanionPhase = 'join' | 'lobby' | 'dashboard' | 'ended' | 'expired'

interface CompanionStoreState {
    // Player identity
    playerName: string
    characterName: string
    class: string
    level: number

    // Combat stats
    hpCurrent: number
    hpMax: number
    ac: number

    // Abilities
    abilities: Record<AbilityScore, number>

    // Session state (pushed from server)
    conditions: string[]
    inventory: PlayerItem[]
    currency: { gold: number; silver: number; copper: number }
    whispers: PlayerWhisper[]
    messages: PlayerMessage[]
    handRaised: boolean

    // Connection
    token: string | null
    sessionCode: string | null
    connected: boolean
    phase: CompanionPhase
    status: PlayerCharacter['status'] | null

    // Active roll prompt (null when none pending)
    activeRollPrompt: RollPrompt | null

    // UI state
    loading: boolean
    error: string | null

    // Actions
    setPlayerData: (data: Partial<PlayerCharacter>) => void
    setPhase: (phase: CompanionPhase) => void
    setToken: (token: string) => void
    setSessionCode: (code: string | null) => void
    setError: (error: string | null) => void
    setConnected: (connected: boolean) => void
    setLoading: (loading: boolean) => void
    addMessage: (msg: PlayerMessage) => void
    setHandRaised: (raised: boolean) => void
    setRollPrompt: (prompt: RollPrompt | null) => void
    reset: () => void
}

const INITIAL_STATE = {
    playerName: '',
    characterName: '',
    class: '',
    level: 1,
    hpCurrent: 10,
    hpMax: 10,
    ac: 10,
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } as Record<AbilityScore, number>,
    conditions: [],
    inventory: [],
    currency: { gold: 0, silver: 0, copper: 0 },
    whispers: [],
    messages: [],
    handRaised: false,
    activeRollPrompt: null,
    token: null,
    sessionCode: null,
    connected: false,
    phase: 'join' as CompanionPhase,
    status: null,
    loading: false,
    error: null,
}

export const useCompanionStore = create<CompanionStoreState>()(
    subscribeWithSelector((set) => ({
        ...INITIAL_STATE,

        setPlayerData: (data) => set((state) => ({
            ...(data.playerName !== undefined && { playerName: data.playerName }),
            ...(data.characterName !== undefined && { characterName: data.characterName }),
            ...(data.class !== undefined && { class: data.class }),
            ...(data.level !== undefined && { level: data.level }),
            ...(data.hpCurrent !== undefined && { hpCurrent: data.hpCurrent }),
            ...(data.hpMax !== undefined && { hpMax: data.hpMax }),
            ...(data.ac !== undefined && { ac: data.ac }),
            ...(data.abilities !== undefined && { abilities: data.abilities }),
            ...(data.conditions !== undefined && { conditions: data.conditions }),
            ...(data.inventory !== undefined && { inventory: data.inventory }),
            ...(data.currency !== undefined && { currency: data.currency }),
            ...(data.whispers !== undefined && { whispers: data.whispers }),
            ...(data.messages !== undefined && { messages: data.messages }),
            ...(data.handRaised !== undefined && { handRaised: data.handRaised }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.connected !== undefined && { connected: data.connected }),
        })),

        setPhase: (phase) => set({ phase }),
        setToken: (token) => set({ token }),
        setSessionCode: (code) => set({ sessionCode: code }),
        setError: (error) => set({ error }),
        setConnected: (connected) => set({ connected }),
        setLoading: (loading) => set({ loading }),
        addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
        setHandRaised: (raised) => set({ handRaised: raised }),
        setRollPrompt: (prompt) => set({ activeRollPrompt: prompt }),

        reset: () => set({ ...INITIAL_STATE }),
    }))
)
