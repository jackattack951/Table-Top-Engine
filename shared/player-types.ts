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
    messages: PlayerMessage[]

    // Connection & lobby state
    status: 'pending' | 'approved' | 'kicked' | 'ready' | 'live'
    connected: boolean
    handRaised: boolean
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

/** A message in the two-way player ↔ DM chat thread. */
export interface PlayerMessage {
    id: string
    message: string
    timestamp: number
    /** true = sent by the DM, false = sent by the player */
    fromDM: boolean
    read: boolean
}

/** Controls how players select their character when joining. */
export type CharacterSelectMode = 'manual-only' | 'roster-and-manual' | 'roster-only'

/** A pre-defined character in the campaign roster (shared type — companion + cockpit). */
export interface RosterCharacter {
    id: string
    characterName: string
    class: string
    level: number
    maxHp: number
    ac: number
    abilities: Record<AbilityScore, number>
}

/** Session state tracked server-side. Separate lifecycle from ServerState. */
export interface SessionState {
    sessionCode: string
    players: Record<string, PlayerCharacter> // token → player
    phase: 'lobby' | 'ready-check' | 'live' | 'ended'
    /** Active roll prompts, keyed by promptId. */
    rollPrompts: Record<string, RollPrompt & { tokens: string[] }>
    /** Controls how players select their character when joining. */
    characterSelectMode: CharacterSelectMode
}

/** A pending roll request sent from the DM to one or more players. */
export interface RollPrompt {
    id: string
    die: string            // e.g. 'd20', 'd8', 'd6'
    label: string          // e.g. 'Perception Check', 'Initiative'
    countdown: number      // seconds; 0 = no countdown
    timestamp: number
}

/** A roll result submitted by a player. */
export interface RollResult {
    promptId: string
    token: string
    playerName: string
    characterName: string
    die: string
    label: string
    result: number
    timestamp: number
}

/** Format a Unix timestamp as a short HH:MM time string. */
export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
