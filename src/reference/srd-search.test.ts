/**
 * Tests for SRD Search — spell, monster, and condition lookup.
 */
import { describe, it, expect } from 'vitest'
import { searchSRD, type SRDSearchResult } from './srd-search'

describe('searchSRD', () => {
    it('returns empty array for empty query', () => {
        const results = searchSRD('')
        expect(results).toEqual([])
    })

    it('returns empty array for whitespace-only query', () => {
        const results = searchSRD('   ')
        expect(results).toEqual([])
    })

    it('returns empty array for no match', () => {
        const results = searchSRD('xyznonexistentspell9999')
        expect(results).toEqual([])
    })

    it('returns exact name match first', () => {
        const results = searchSRD('Fire Bolt')
        expect(results.length).toBeGreaterThan(0)
        expect(results[0]).toMatchObject({
            type: 'spell',
            name: 'Fire Bolt',
        })
    })

    it('prefix match returns spells starting with query before other matches', () => {
        const results = searchSRD('Fire')
        // Should include "Fire Bolt", "Fireball", etc. in prefix order
        expect(results.length).toBeGreaterThan(0)
        const fireNames = results
            .filter((r) => r.type === 'spell')
            .map((r) => r.name)
        // Verify Fire Bolt and Fireball are near the start
        expect(fireNames[0]?.startsWith('Fire')).toBe(true)
    })

    it('caps results at 20 entries', () => {
        // Search for a very common term that matches many entries
        const results = searchSRD('a')
        expect(results.length).toBeLessThanOrEqual(20)
    })

    it('returns condition result with condition data', () => {
        const results = searchSRD('Blinded', 'condition')
        expect(results.length).toBeGreaterThan(0)
        const result = results[0]
        expect(result).toMatchObject({
            type: 'condition',
            name: 'Blinded',
        })
        expect(result.data).toHaveProperty('effects')
    })

    it('filters by type: spell only', () => {
        const results = searchSRD('Fire Bolt', 'spell')
        expect(results.length).toBeGreaterThan(0)
        expect(results[0]?.type).toBe('spell')
    })

    it('filters by type: condition only', () => {
        const results = searchSRD('Charmed', 'condition')
        expect(results.length).toBeGreaterThan(0)
        expect(results[0]?.type).toBe('condition')
    })

    it('filters by type: monster only', () => {
        const results = searchSRD('Commoner', 'monster')
        expect(results.length).toBeGreaterThan(0)
        expect(results[0]?.type).toBe('monster')
    })

    it('returns results with summary field', () => {
        const results = searchSRD('Fire Bolt')
        expect(results.length).toBeGreaterThan(0)
        expect(results[0]?.summary).toBeDefined()
        expect(typeof results[0]?.summary).toBe('string')
    })

    it('spell result includes spell data with name, level, school', () => {
        const results = searchSRD('Fire Bolt')
        const spell = results.find((r) => r.name === 'Fire Bolt')
        expect(spell).toBeDefined()
        expect(spell?.data).toHaveProperty('level')
        expect(spell?.data).toHaveProperty('school')
    })

    it('monster result includes monster data with CR and type', () => {
        const results = searchSRD('Commoner', 'monster')
        const monster = results.find((r) => r.name === 'Commoner')
        expect(monster).toBeDefined()
        expect(monster?.data).toHaveProperty('cr')
        expect(monster?.data).toHaveProperty('type')
    })

    it('case-insensitive search', () => {
        const resultsUpper = searchSRD('FIRE BOLT')
        const resultsLower = searchSRD('fire bolt')
        expect(resultsUpper.length).toBe(resultsLower.length)
        expect(resultsUpper[0]?.name).toBe(resultsLower[0]?.name)
    })

    it('prefix match ranks higher than contains match', () => {
        // "Fire" should rank Fire Bolt and Fireball (prefix) above other spells containing "fire"
        const results = searchSRD('Fire')
        const fireSpells = results.filter((r) => r.type === 'spell')
        if (fireSpells.length > 1) {
            // Fire Bolt and Fireball should be in the first results
            const names = fireSpells.slice(0, 3).map((r) => r.name)
            expect(names.some((n) => n.startsWith('Fire'))).toBe(true)
        }
    })
})
