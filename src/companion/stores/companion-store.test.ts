/**
 * CompanionStore tests — Sprint 11c.
 * Pure Zustand store tests — no mocking required.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCompanionStore } from './companion-store'
import type { PlayerCharacter } from '@shared/player-types'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CompanionStore — defaults', () => {
    beforeEach(() => {
        useCompanionStore.getState().reset()
    })

    it('starts in join phase', () => {
        expect(useCompanionStore.getState().phase).toBe('join')
    })

    it('starts with null token', () => {
        expect(useCompanionStore.getState().token).toBeNull()
    })

    it('starts with null session code', () => {
        expect(useCompanionStore.getState().sessionCode).toBeNull()
    })

    it('starts disconnected', () => {
        expect(useCompanionStore.getState().connected).toBe(false)
    })

    it('starts with default ability scores of 10', () => {
        const { abilities } = useCompanionStore.getState()
        expect(abilities.STR).toBe(10)
        expect(abilities.DEX).toBe(10)
        expect(abilities.CHA).toBe(10)
    })

    it('starts with empty conditions and inventory', () => {
        expect(useCompanionStore.getState().conditions).toEqual([])
        expect(useCompanionStore.getState().inventory).toEqual([])
    })

    it('starts with no error and not loading', () => {
        expect(useCompanionStore.getState().error).toBeNull()
        expect(useCompanionStore.getState().loading).toBe(false)
    })
})

describe('CompanionStore — setters', () => {
    beforeEach(() => {
        useCompanionStore.getState().reset()
    })

    it('setPhase updates phase', () => {
        useCompanionStore.getState().setPhase('lobby')
        expect(useCompanionStore.getState().phase).toBe('lobby')

        useCompanionStore.getState().setPhase('dashboard')
        expect(useCompanionStore.getState().phase).toBe('dashboard')
    })

    it('setToken updates token', () => {
        useCompanionStore.getState().setToken('abc-123')
        expect(useCompanionStore.getState().token).toBe('abc-123')
    })

    it('setSessionCode updates code', () => {
        useCompanionStore.getState().setSessionCode('XYZ789')
        expect(useCompanionStore.getState().sessionCode).toBe('XYZ789')
    })

    it('setError updates error', () => {
        useCompanionStore.getState().setError('Something went wrong')
        expect(useCompanionStore.getState().error).toBe('Something went wrong')
    })

    it('setError(null) clears error', () => {
        useCompanionStore.getState().setError('err')
        useCompanionStore.getState().setError(null)
        expect(useCompanionStore.getState().error).toBeNull()
    })

    it('setConnected updates connected', () => {
        useCompanionStore.getState().setConnected(true)
        expect(useCompanionStore.getState().connected).toBe(true)
    })

    it('setLoading updates loading', () => {
        useCompanionStore.getState().setLoading(true)
        expect(useCompanionStore.getState().loading).toBe(true)
    })
})

describe('CompanionStore — setPlayerData', () => {
    beforeEach(() => {
        useCompanionStore.getState().reset()
    })

    it('updates specific fields without clearing others', () => {
        useCompanionStore.getState().setPlayerData({
            playerName: 'Alice',
            characterName: 'Aria',
            class: 'Wizard',
            level: 5,
        })

        const state = useCompanionStore.getState()
        expect(state.playerName).toBe('Alice')
        expect(state.characterName).toBe('Aria')
        expect(state.class).toBe('Wizard')
        expect(state.level).toBe(5)
        // Unchanged defaults
        expect(state.hpCurrent).toBe(10)
        expect(state.ac).toBe(10)
    })

    it('updates combat stats', () => {
        useCompanionStore.getState().setPlayerData({
            hpCurrent: 25,
            hpMax: 38,
            ac: 14,
        })

        expect(useCompanionStore.getState().hpCurrent).toBe(25)
        expect(useCompanionStore.getState().hpMax).toBe(38)
        expect(useCompanionStore.getState().ac).toBe(14)
    })

    it('updates conditions', () => {
        useCompanionStore.getState().setPlayerData({
            conditions: ['Poisoned', 'Stunned'],
        })
        expect(useCompanionStore.getState().conditions).toEqual(['Poisoned', 'Stunned'])
    })

    it('updates inventory', () => {
        useCompanionStore.getState().setPlayerData({
            inventory: [{ id: '1', name: 'Potion', quantity: 2, description: 'Heals' }],
        })
        expect(useCompanionStore.getState().inventory).toHaveLength(1)
        expect(useCompanionStore.getState().inventory[0].name).toBe('Potion')
    })

    it('updates currency', () => {
        useCompanionStore.getState().setPlayerData({
            currency: { gold: 100, silver: 50, copper: 25 },
        })
        expect(useCompanionStore.getState().currency).toEqual({ gold: 100, silver: 50, copper: 25 })
    })

    it('updates status', () => {
        useCompanionStore.getState().setPlayerData({ status: 'approved' })
        expect(useCompanionStore.getState().status).toBe('approved')
    })

    it('updates whispers', () => {
        const whisper = { id: 'w1', message: 'Secret', timestamp: 12345, read: false }
        useCompanionStore.getState().setPlayerData({ whispers: [whisper] })
        expect(useCompanionStore.getState().whispers).toHaveLength(1)
        expect(useCompanionStore.getState().whispers[0].message).toBe('Secret')
    })
})

describe('CompanionStore — reset', () => {
    it('resets all state to defaults', () => {
        useCompanionStore.getState().setPhase('dashboard')
        useCompanionStore.getState().setToken('some-token')
        useCompanionStore.getState().setSessionCode('ABC123')
        useCompanionStore.getState().setConnected(true)
        useCompanionStore.getState().setPlayerData({
            playerName: 'Alice',
            hpCurrent: 25,
            conditions: ['Poisoned'],
        })

        useCompanionStore.getState().reset()

        const state = useCompanionStore.getState()
        expect(state.phase).toBe('join')
        expect(state.token).toBeNull()
        expect(state.sessionCode).toBeNull()
        expect(state.connected).toBe(false)
        expect(state.playerName).toBe('')
        expect(state.hpCurrent).toBe(10)
        expect(state.conditions).toEqual([])
    })
})
