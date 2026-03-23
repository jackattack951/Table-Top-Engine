/**
 * PlayerStore tests — Sprint 11b.
 * Pure Zustand store tests — no mocking required.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from './player-store'
import type { PlayerCharacter } from '@shared/player-types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
    return {
        token: 'test-token-1',
        socketId: 'socket-1',
        playerName: 'Alice',
        characterName: 'Aria',
        class: 'Wizard',
        level: 5,
        hpCurrent: 30,
        hpMax: 38,
        ac: 14,
        abilities: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 13, CHA: 10 },
        conditions: [],
        inventory: [],
        currency: { gold: 50, silver: 25, copper: 10 },
        whispers: [],
        status: 'pending',
        connected: true,
        ...overrides,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PlayerStore — defaults', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('starts with empty players', () => {
        expect(usePlayerStore.getState().players).toEqual({})
    })

    it('starts with inactive session phase', () => {
        expect(usePlayerStore.getState().sessionPhase).toBe('inactive')
    })

    it('starts with null session code', () => {
        expect(usePlayerStore.getState().sessionCode).toBeNull()
    })
})

describe('PlayerStore — setPlayers', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('converts array to record keyed by token', () => {
        const p1 = makePlayer({ token: 'token-1', playerName: 'Alice' })
        const p2 = makePlayer({ token: 'token-2', playerName: 'Bob' })
        usePlayerStore.getState().setPlayers([p1, p2])

        const { players } = usePlayerStore.getState()
        expect(Object.keys(players)).toHaveLength(2)
        expect(players['token-1'].playerName).toBe('Alice')
        expect(players['token-2'].playerName).toBe('Bob')
    })

    it('replaces existing players completely', () => {
        usePlayerStore.getState().setPlayers([
            makePlayer({ token: 'old-token' }),
        ])
        usePlayerStore.getState().setPlayers([
            makePlayer({ token: 'new-token' }),
        ])

        const { players } = usePlayerStore.getState()
        expect(Object.keys(players)).toHaveLength(1)
        expect(players['new-token']).toBeDefined()
        expect(players['old-token']).toBeUndefined()
    })

    it('handles empty array', () => {
        usePlayerStore.getState().setPlayers([makePlayer()])
        usePlayerStore.getState().setPlayers([])
        expect(Object.keys(usePlayerStore.getState().players)).toHaveLength(0)
    })
})

describe('PlayerStore — session management', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('setSessionPhase updates phase', () => {
        usePlayerStore.getState().setSessionPhase('lobby')
        expect(usePlayerStore.getState().sessionPhase).toBe('lobby')

        usePlayerStore.getState().setSessionPhase('live')
        expect(usePlayerStore.getState().sessionPhase).toBe('live')
    })

    it('setSessionCode updates code', () => {
        usePlayerStore.getState().setSessionCode('ABC123')
        expect(usePlayerStore.getState().sessionCode).toBe('ABC123')
    })

    it('reset clears everything', () => {
        usePlayerStore.getState().setPlayers([makePlayer()])
        usePlayerStore.getState().setSessionPhase('live')
        usePlayerStore.getState().setSessionCode('XYZ789')

        usePlayerStore.getState().reset()

        expect(usePlayerStore.getState().players).toEqual({})
        expect(usePlayerStore.getState().sessionPhase).toBe('inactive')
        expect(usePlayerStore.getState().sessionCode).toBeNull()
    })
})
