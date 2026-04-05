import { describe, it, expect, beforeEach } from 'vitest'
import { useSpellsStore } from './spells-store'

beforeEach(() => {
    useSpellsStore.setState({ searchHistory: [], pinnedSpellIds: [] })
})

describe('pushHistory', () => {
    it('adds query to history', () => {
        useSpellsStore.getState().pushHistory('fireball')
        expect(useSpellsStore.getState().searchHistory).toEqual(['fireball'])
    })

    it('deduplicates and moves latest to front', () => {
        useSpellsStore.getState().pushHistory('fireball')
        useSpellsStore.getState().pushHistory('shield')
        useSpellsStore.getState().pushHistory('fireball')
        expect(useSpellsStore.getState().searchHistory[0]).toBe('fireball')
        expect(useSpellsStore.getState().searchHistory).toHaveLength(2)
    })

    it('ignores empty/whitespace queries', () => {
        useSpellsStore.getState().pushHistory('   ')
        expect(useSpellsStore.getState().searchHistory).toHaveLength(0)
    })

    it('caps history at 10', () => {
        for (let i = 0; i < 12; i++) {
            useSpellsStore.getState().pushHistory(`spell-${i}`)
        }
        expect(useSpellsStore.getState().searchHistory).toHaveLength(10)
    })
})

describe('clearHistory', () => {
    it('empties search history', () => {
        useSpellsStore.getState().pushHistory('fireball')
        useSpellsStore.getState().clearHistory()
        expect(useSpellsStore.getState().searchHistory).toHaveLength(0)
    })
})

describe('pinSpell / unpinSpell', () => {
    it('pins a spell', () => {
        useSpellsStore.getState().pinSpell('fireball')
        expect(useSpellsStore.getState().pinnedSpellIds).toContain('fireball')
    })

    it('does not duplicate pins', () => {
        useSpellsStore.getState().pinSpell('fireball')
        useSpellsStore.getState().pinSpell('fireball')
        expect(useSpellsStore.getState().pinnedSpellIds).toHaveLength(1)
    })

    it('caps pins at 5', () => {
        for (let i = 0; i < 7; i++) {
            useSpellsStore.getState().pinSpell(`spell-${i}`)
        }
        expect(useSpellsStore.getState().pinnedSpellIds).toHaveLength(5)
    })

    it('unpins a spell', () => {
        useSpellsStore.getState().pinSpell('fireball')
        useSpellsStore.getState().unpinSpell('fireball')
        expect(useSpellsStore.getState().pinnedSpellIds).not.toContain('fireball')
    })
})
