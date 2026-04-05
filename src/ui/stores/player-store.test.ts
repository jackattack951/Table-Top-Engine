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
        messages: [],
        status: 'pending',
        connected: true,
        handRaised: false,
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

describe('PlayerStore — patchPlayer (Sprint 21a)', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('patches a single player field without affecting others', () => {
        const player = makePlayer({ token: 'p1', playerName: 'Alice' })
        usePlayerStore.getState().setPlayers([player])

        usePlayerStore.getState().patchPlayer('p1', { handRaised: true })

        const updated = usePlayerStore.getState().players['p1']
        expect(updated.handRaised).toBe(true)
        expect(updated.playerName).toBe('Alice') // unchanged
    })

    it('appends messages via patchPlayer', () => {
        const player = makePlayer({ token: 'p1' })
        usePlayerStore.getState().setPlayers([player])

        const msg = { id: 'msg-1', message: 'Hello', timestamp: 1000, fromDM: false, read: false }
        usePlayerStore.getState().patchPlayer('p1', { messages: [msg] })

        expect(usePlayerStore.getState().players['p1'].messages).toHaveLength(1)
        expect(usePlayerStore.getState().players['p1'].messages[0].message).toBe('Hello')
    })

    it('is a no-op for unknown token', () => {
        const player = makePlayer({ token: 'p1' })
        usePlayerStore.getState().setPlayers([player])

        usePlayerStore.getState().patchPlayer('unknown', { handRaised: true })

        // p1 unchanged
        expect(usePlayerStore.getState().players['p1'].handRaised).toBe(false)
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

describe('PlayerStore — roll prompt tracking (Sprint 21b)', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('starts with null activePromptId and empty rollResults', () => {
        expect(usePlayerStore.getState().activePromptId).toBeNull()
        expect(usePlayerStore.getState().rollResults).toEqual([])
    })

    it('setActivePromptId sets the active prompt', () => {
        usePlayerStore.getState().setActivePromptId('prompt-abc')
        expect(usePlayerStore.getState().activePromptId).toBe('prompt-abc')
    })

    it('setActivePromptId(null) clears results along with promptId', () => {
        const result = {
            promptId: 'p1', token: 'tok', playerName: 'Bob', characterName: 'Borin',
            die: 'd20', label: 'Roll', result: 12, timestamp: Date.now(),
        }
        usePlayerStore.getState().setActivePromptId('p1')
        usePlayerStore.getState().addRollResult(result)
        expect(usePlayerStore.getState().rollResults).toHaveLength(1)

        usePlayerStore.getState().setActivePromptId(null)
        expect(usePlayerStore.getState().activePromptId).toBeNull()
        expect(usePlayerStore.getState().rollResults).toHaveLength(0)
    })

    it('addRollResult appends result without clearing existing', () => {
        usePlayerStore.getState().setActivePromptId('p1')
        const base = {
            promptId: 'p1', token: 'tok', playerName: 'Bob', characterName: 'Borin',
            die: 'd20', label: 'Roll', timestamp: Date.now(),
        }
        usePlayerStore.getState().addRollResult({ ...base, result: 12 })
        usePlayerStore.getState().addRollResult({ ...base, result: 18 })

        const results = usePlayerStore.getState().rollResults
        expect(results).toHaveLength(2)
        expect(results[0].result).toBe(12)
        expect(results[1].result).toBe(18)
    })

    it('reset clears rollResults and activePromptId', () => {
        usePlayerStore.getState().setActivePromptId('p1')
        const result = {
            promptId: 'p1', token: 't', playerName: 'X', characterName: 'Y',
            die: 'd20', label: 'R', result: 10, timestamp: Date.now(),
        }
        usePlayerStore.getState().addRollResult(result)

        usePlayerStore.getState().reset()

        expect(usePlayerStore.getState().activePromptId).toBeNull()
        expect(usePlayerStore.getState().rollResults).toEqual([])
    })
})
