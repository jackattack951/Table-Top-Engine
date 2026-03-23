/**
 * Player Companion shared types — used by server, cockpit, and companion.
 * Lives alongside socket-events.ts in shared/ (session-specific, not core data models).
 */

export const MAX_PLAYERS = 8

export type AbilityScore = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

export interface PlayerCharacter {
    // Identity
    token: string
    socketId: string
    playerName: string
    characterName: string

    // Stats
    class: string
    level: number
    hpCurrent: number
    hpMax: number
    ac: number

    // Ability scores
    abilities: Record<AbilityScore, number>

    // Session state (DM-managed, pushed to player)
    conditions: string[]
    inventory: PlayerItem[]
    currency: { gold: number; silver: number; copper: number }
    whispers: PlayerWhisper[]

    // Connection & lobby state
    status: 'pending' | 'approved' | 'kicked' | 'ready' | 'live'
    connected: boolean
}

export interface PlayerItem {
    id: string
    name: string
    quantity: number
    description: string
}

export interface PlayerWhisper {
    id: string
    message: string
    timestamp: number
    read: boolean
}

/** Session state tracked server-side. Separate lifecycle from ServerState. */
export interface SessionState {
    sessionCode: string
    players: Record<string, PlayerCharacter> // token → player
    phase: 'lobby' | 'ready-check' | 'live' | 'ended'
}

/** Calculate ability modifier from score: floor((score - 10) / 2) */
export function abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2)
}

/** Format ability modifier as signed string: "+2", "-1", "+0" */
export function formatModifier(score: number): string {
    const mod = abilityModifier(score)
    return mod >= 0 ? `+${mod}` : String(mod)
}
