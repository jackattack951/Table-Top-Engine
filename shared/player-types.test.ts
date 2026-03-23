/**
 * Player types tests — Sprint 11b.
 * Tests for abilityModifier() and MAX_PLAYERS constant.
 */
import { describe, it, expect } from 'vitest'
import { abilityModifier, MAX_PLAYERS } from './player-types'

describe('abilityModifier', () => {
    it('returns -5 for score 1', () => {
        expect(abilityModifier(1)).toBe(-5)
    })

    it('returns -1 for score 8', () => {
        expect(abilityModifier(8)).toBe(-1)
    })

    it('returns 0 for score 10', () => {
        expect(abilityModifier(10)).toBe(0)
    })

    it('returns 0 for score 11', () => {
        expect(abilityModifier(11)).toBe(0)
    })

    it('returns +1 for score 12', () => {
        expect(abilityModifier(12)).toBe(1)
    })

    it('returns +2 for score 14', () => {
        expect(abilityModifier(14)).toBe(2)
    })

    it('returns +5 for score 20', () => {
        expect(abilityModifier(20)).toBe(5)
    })

    it('returns +10 for score 30', () => {
        expect(abilityModifier(30)).toBe(10)
    })
})

describe('MAX_PLAYERS', () => {
    it('is 8', () => {
        expect(MAX_PLAYERS).toBe(8)
    })
})
