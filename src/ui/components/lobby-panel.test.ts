/**
 * LobbyPanel module contract tests (Sprint 11d).
 *
 * Vitest env is 'node' — no DOM. Tests verify the module exports correctly
 * and that the player store integration works as expected for the lobby panel.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../stores/player-store'
import type { PlayerCharacter } from '@shared/player-types'

// ── Module export tests ──────────────────────────────────────────────────────

describe('LobbyPanel module', () => {
    it('exports a named function component', async () => {
        const mod = await import('./lobby-panel')
        expect(typeof mod.LobbyPanel).toBe('function')
    })
})

// ── Player store integration tests for lobby ─────────────────────────────────

const makePlayer = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter => ({
    token: 'token-1',
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
    currency: { gold: 100, silver: 50, copper: 25 },
    whispers: [],
    messages: [],
    status: 'pending',
    connected: true,
    handRaised: false,
    ...overrides,
})

describe('LobbyPanel — player store contract', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('starts with inactive phase (panel hidden)', () => {
        expect(usePlayerStore.getState().sessionPhase).toBe('inactive')
    })

    it('setPlayers populates the players record', () => {
        const p1 = makePlayer({ token: 'a' })
        const p2 = makePlayer({ token: 'b', playerName: 'Bob', characterName: 'Brak' })
        usePlayerStore.getState().setPlayers([p1, p2])

        const { players } = usePlayerStore.getState()
        expect(Object.keys(players)).toHaveLength(2)
        expect(players['a'].playerName).toBe('Alice')
        expect(players['b'].playerName).toBe('Bob')
    })

    it('tracks pending vs approved counts correctly', () => {
        usePlayerStore.getState().setPlayers([
            makePlayer({ token: 'a', status: 'pending' }),
            makePlayer({ token: 'b', status: 'approved' }),
            makePlayer({ token: 'c', status: 'approved' }),
        ])

        const playerList = Object.values(usePlayerStore.getState().players)
        const pendingCount = playerList.filter((p) => p.status === 'pending').length
        const approvedCount = playerList.filter((p) => p.status === 'approved').length

        expect(pendingCount).toBe(1)
        expect(approvedCount).toBe(2)
    })

    it('tracks ready check state correctly', () => {
        usePlayerStore.getState().setPlayers([
            makePlayer({ token: 'a', status: 'ready' }),
            makePlayer({ token: 'b', status: 'ready' }),
            makePlayer({ token: 'c', status: 'approved' }),
        ])
        usePlayerStore.getState().setSessionPhase('ready-check')

        const playerList = Object.values(usePlayerStore.getState().players)
        const readyCount = playerList.filter((p) => p.status === 'ready').length
        const nonKickedCount = playerList.filter(
            (p) => p.status === 'approved' || p.status === 'ready' || p.status === 'live'
        ).length
        const allReady = nonKickedCount > 0 && readyCount === nonKickedCount

        expect(readyCount).toBe(2)
        expect(nonKickedCount).toBe(3)
        expect(allReady).toBe(false)
    })

    it('allReady is true when all approved players are ready', () => {
        usePlayerStore.getState().setPlayers([
            makePlayer({ token: 'a', status: 'ready' }),
            makePlayer({ token: 'b', status: 'ready' }),
        ])

        const playerList = Object.values(usePlayerStore.getState().players)
        const readyCount = playerList.filter((p) => p.status === 'ready').length
        const approvedOrReady = playerList.filter(
            (p) => p.status === 'approved' || p.status === 'ready' || p.status === 'live'
        ).length
        const allReady = approvedOrReady > 0 && readyCount === approvedOrReady

        expect(allReady).toBe(true)
    })

    it('session phase transitions through lobby lifecycle', () => {
        usePlayerStore.getState().setSessionPhase('lobby')
        expect(usePlayerStore.getState().sessionPhase).toBe('lobby')

        usePlayerStore.getState().setSessionPhase('ready-check')
        expect(usePlayerStore.getState().sessionPhase).toBe('ready-check')

        usePlayerStore.getState().setSessionPhase('live')
        expect(usePlayerStore.getState().sessionPhase).toBe('live')

        usePlayerStore.getState().setSessionPhase('ended')
        expect(usePlayerStore.getState().sessionPhase).toBe('ended')
    })

    it('session code is available for display', () => {
        usePlayerStore.getState().setSessionCode('ABC123')
        expect(usePlayerStore.getState().sessionCode).toBe('ABC123')
    })

    it('disconnected players are tracked', () => {
        usePlayerStore.getState().setPlayers([
            makePlayer({ token: 'a', connected: true }),
            makePlayer({ token: 'b', connected: false }),
        ])

        const playerList = Object.values(usePlayerStore.getState().players)
        const disconnected = playerList.filter((p) => !p.connected)
        expect(disconnected).toHaveLength(1)
        expect(disconnected[0].token).toBe('b')
    })

    it('kicked players are tracked', () => {
        usePlayerStore.getState().setPlayers([
            makePlayer({ token: 'a', status: 'approved' }),
            makePlayer({ token: 'b', status: 'kicked' }),
        ])

        const playerList = Object.values(usePlayerStore.getState().players)
        const kicked = playerList.filter((p) => p.status === 'kicked')
        expect(kicked).toHaveLength(1)
    })
})
