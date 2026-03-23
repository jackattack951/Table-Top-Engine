/**
 * LobbyScreen module + companion store contract tests (Sprint 11d).
 *
 * Vitest env is 'node' — no DOM. Tests verify the module exports and that
 * the companion store correctly supports lobby screen state transitions.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCompanionStore } from '../stores/companion-store'

describe('LobbyScreen module', () => {
    it('exports a named function component', async () => {
        const mod = await import('./lobby-screen')
        expect(typeof mod.LobbyScreen).toBe('function')
    })
})

describe('LobbyScreen — companion store contract', () => {
    beforeEach(() => {
        useCompanionStore.getState().reset()
    })

    it('starts in join phase (not lobby)', () => {
        expect(useCompanionStore.getState().phase).toBe('join')
    })

    it('transitions to lobby phase', () => {
        useCompanionStore.getState().setPhase('lobby')
        expect(useCompanionStore.getState().phase).toBe('lobby')
    })

    it('displays pending status by default', () => {
        useCompanionStore.getState().setPhase('lobby')
        // status is null by default
        expect(useCompanionStore.getState().status).toBeNull()
    })

    it('shows approved status after DM approval', () => {
        useCompanionStore.getState().setPhase('lobby')
        useCompanionStore.getState().setPlayerData({ status: 'approved' })
        expect(useCompanionStore.getState().status).toBe('approved')
    })

    it('shows ready status after player confirms', () => {
        useCompanionStore.getState().setPlayerData({ status: 'ready' })
        expect(useCompanionStore.getState().status).toBe('ready')
    })

    it('shows character info in lobby', () => {
        useCompanionStore.getState().setPlayerData({
            playerName: 'Alice',
            characterName: 'Aria',
            class: 'Wizard',
            level: 5,
            hpCurrent: 30,
            hpMax: 38,
            ac: 14,
        })

        const state = useCompanionStore.getState()
        expect(state.characterName).toBe('Aria')
        expect(state.class).toBe('Wizard')
        expect(state.level).toBe(5)
        expect(state.hpCurrent).toBe(30)
        expect(state.hpMax).toBe(38)
    })

    it('shows session code in lobby footer', () => {
        useCompanionStore.getState().setSessionCode('XYZ789')
        expect(useCompanionStore.getState().sessionCode).toBe('XYZ789')
    })

    it('tracks connection status', () => {
        useCompanionStore.getState().setConnected(true)
        expect(useCompanionStore.getState().connected).toBe(true)

        useCompanionStore.getState().setConnected(false)
        expect(useCompanionStore.getState().connected).toBe(false)
    })

    it('transitions to dashboard phase when session starts', () => {
        useCompanionStore.getState().setPhase('lobby')
        useCompanionStore.getState().setPhase('dashboard')
        expect(useCompanionStore.getState().phase).toBe('dashboard')
    })

    it('transitions to ended phase when session ends', () => {
        useCompanionStore.getState().setPhase('lobby')
        useCompanionStore.getState().setPhase('ended')
        expect(useCompanionStore.getState().phase).toBe('ended')
    })

    it('ability scores are available for display', () => {
        useCompanionStore.getState().setPlayerData({
            abilities: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 8 },
        })
        const { abilities } = useCompanionStore.getState()
        expect(abilities.STR).toBe(16)
        expect(abilities.CHA).toBe(8)
    })
})
