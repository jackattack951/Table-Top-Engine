/**
 * dice-parser.test.ts — Unit tests for parseDiceNotation() and rollDice().
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { parseDiceNotation, rollDice, type DiceRoll } from './dice-parser'

// ── Mock crypto.getRandomValues ────────────────────────────────────────────────
// Node's crypto global exists but we stub it to control randomness in tests.

beforeAll(() => {
    // Provide a predictable crypto.getRandomValues for range tests
    // The real implementation uses rejection sampling, so we just need something in range.
    // For range validation tests, we use a deterministic sequence.
})

// ── parseDiceNotation ──────────────────────────────────────────────────────────

describe('parseDiceNotation', () => {
    describe('valid notations', () => {
        it('parses bare d-notation: d20', () => {
            expect(parseDiceNotation('d20')).toEqual({ count: 1, sides: 20, modifier: 0 })
        })

        it('parses d100', () => {
            expect(parseDiceNotation('d100')).toEqual({ count: 1, sides: 100, modifier: 0 })
        })

        it('parses 2d6', () => {
            expect(parseDiceNotation('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 })
        })

        it('parses 4d8+3', () => {
            expect(parseDiceNotation('4d8+3')).toEqual({ count: 4, sides: 8, modifier: 3 })
        })

        it('parses 1d20-1', () => {
            expect(parseDiceNotation('1d20-1')).toEqual({ count: 1, sides: 20, modifier: -1 })
        })

        it('parses 3d6 + 2 (with spaces)', () => {
            expect(parseDiceNotation('3d6 + 2')).toEqual({ count: 3, sides: 6, modifier: 2 })
        })

        it('parses 2d8 - 1 (spaces around minus)', () => {
            expect(parseDiceNotation('2d8 - 1')).toEqual({ count: 2, sides: 8, modifier: -1 })
        })

        it('parses 1d4', () => {
            expect(parseDiceNotation('1d4')).toEqual({ count: 1, sides: 4, modifier: 0 })
        })

        it('parses d4 (no count prefix)', () => {
            expect(parseDiceNotation('d4')).toEqual({ count: 1, sides: 4, modifier: 0 })
        })

        it('parses d12', () => {
            expect(parseDiceNotation('d12')).toEqual({ count: 1, sides: 12, modifier: 0 })
        })

        it('is case insensitive: D20', () => {
            expect(parseDiceNotation('D20')).toEqual({ count: 1, sides: 20, modifier: 0 })
        })

        it('is case insensitive: 2D6+4', () => {
            expect(parseDiceNotation('2D6+4')).toEqual({ count: 2, sides: 6, modifier: 4 })
        })

        it('parses large modifier: 1d20+10', () => {
            expect(parseDiceNotation('1d20+10')).toEqual({ count: 1, sides: 20, modifier: 10 })
        })

        it('parses negative modifier: 2d6-5', () => {
            expect(parseDiceNotation('2d6-5')).toEqual({ count: 2, sides: 6, modifier: -5 })
        })

        it('handles leading/trailing whitespace', () => {
            expect(parseDiceNotation('  d20  ')).toEqual({ count: 1, sides: 20, modifier: 0 })
        })

        it('parses 10d6+5', () => {
            expect(parseDiceNotation('10d6+5')).toEqual({ count: 10, sides: 6, modifier: 5 })
        })
    })

    describe('invalid notations — must return null', () => {
        it('returns null for empty string', () => {
            expect(parseDiceNotation('')).toBeNull()
        })

        it('returns null for plain number', () => {
            expect(parseDiceNotation('20')).toBeNull()
        })

        it('returns null for text without d', () => {
            expect(parseDiceNotation('roll')).toBeNull()
        })

        it('returns null for missing sides: d', () => {
            expect(parseDiceNotation('d')).toBeNull()
        })

        it('returns null for d0 (zero sides)', () => {
            expect(parseDiceNotation('d0')).toBeNull()
        })

        it('returns null for 0d6 (zero count)', () => {
            expect(parseDiceNotation('0d6')).toBeNull()
        })

        it('returns null for negative count: -1d6', () => {
            expect(parseDiceNotation('-1d6')).toBeNull()
        })

        it('returns null for fractional notation: 1.5d6', () => {
            expect(parseDiceNotation('1.5d6')).toBeNull()
        })

        it('returns null for double-d: dd6', () => {
            expect(parseDiceNotation('dd6')).toBeNull()
        })

        it('returns null for missing number after d: 2d', () => {
            expect(parseDiceNotation('2d')).toBeNull()
        })

        it('returns null for garbage input', () => {
            expect(parseDiceNotation('abc123')).toBeNull()
        })

        it('returns null for null-like (empty input)', () => {
            // @ts-expect-error testing runtime safety with non-string
            expect(parseDiceNotation(null)).toBeNull()
        })

        it('returns null for undefined-like input', () => {
            // @ts-expect-error testing runtime safety with non-string
            expect(parseDiceNotation(undefined)).toBeNull()
        })
    })
})

// ── rollDice ──────────────────────────────────────────────────────────────────

describe('rollDice', () => {
    it('returns correct number of individual rolls', () => {
        const roll: DiceRoll = { count: 4, sides: 6, modifier: 0 }
        const result = rollDice(roll)
        expect(result.individual).toHaveLength(4)
    })

    it('each individual die is in range [1, sides]', () => {
        const roll: DiceRoll = { count: 100, sides: 6, modifier: 0 }
        const result = rollDice(roll)
        for (const val of result.individual) {
            expect(val).toBeGreaterThanOrEqual(1)
            expect(val).toBeLessThanOrEqual(6)
        }
    })

    it('applies positive modifier correctly', () => {
        // Force all dice to 1 by mocking getRandomValues to return 0
        const originalGetRandomValues = crypto.getRandomValues.bind(crypto)
        vi.spyOn(crypto, 'getRandomValues').mockImplementation((arr: ArrayBufferView | null) => {
            if (arr instanceof Uint32Array) {
                arr.fill(0) // Will produce 1 after rejection sampling: 0 % sides + 1
            }
            return arr as unknown as never
        })

        const roll: DiceRoll = { count: 2, sides: 6, modifier: 4 }
        const result = rollDice(roll)
        // With fill(0): each die = 1, total = 1+1+4 = 6
        expect(result.total).toBe(result.individual.reduce((a, b) => a + b, 0) + 4)

        vi.restoreAllMocks()
        void originalGetRandomValues
    })

    it('applies negative modifier correctly', () => {
        const roll: DiceRoll = { count: 1, sides: 20, modifier: -3 }
        const result = rollDice(roll)
        const expected = result.individual[0] - 3
        expect(result.total).toBe(expected)
    })

    it('total equals sum of individual rolls plus modifier', () => {
        const roll: DiceRoll = { count: 3, sides: 8, modifier: 2 }
        const result = rollDice(roll)
        const expectedTotal = result.individual.reduce((a, b) => a + b, 0) + 2
        expect(result.total).toBe(expectedTotal)
    })

    it('total equals sum when modifier is 0', () => {
        const roll: DiceRoll = { count: 5, sides: 10, modifier: 0 }
        const result = rollDice(roll)
        const expectedTotal = result.individual.reduce((a, b) => a + b, 0)
        expect(result.total).toBe(expectedTotal)
    })

    it('preserves the input string when provided', () => {
        const roll: DiceRoll = { count: 2, sides: 6, modifier: 4 }
        const result = rollDice(roll, '2d6+4')
        expect(result.input).toBe('2d6+4')
    })

    it('generates a canonical input string when none is provided', () => {
        const roll: DiceRoll = { count: 2, sides: 6, modifier: 4 }
        const result = rollDice(roll)
        expect(result.input).toBe('2d6+4')
    })

    it('generates canonical input with no modifier', () => {
        const roll: DiceRoll = { count: 1, sides: 20, modifier: 0 }
        const result = rollDice(roll)
        expect(result.input).toBe('1d20')
    })

    it('generates canonical input with negative modifier', () => {
        const roll: DiceRoll = { count: 1, sides: 20, modifier: -2 }
        const result = rollDice(roll)
        expect(result.input).toBe('1d20-2')
    })

    it('returns a timestamp close to now', () => {
        const before = Date.now()
        const roll: DiceRoll = { count: 1, sides: 6, modifier: 0 }
        const result = rollDice(roll)
        const after = Date.now()
        expect(result.timestamp).toBeGreaterThanOrEqual(before)
        expect(result.timestamp).toBeLessThanOrEqual(after)
    })

    it('includes the parsed DiceRoll in the result', () => {
        const roll: DiceRoll = { count: 3, sides: 6, modifier: 2 }
        const result = rollDice(roll)
        expect(result.parsed).toEqual(roll)
    })

    it('single d1 always returns 1 plus modifier', () => {
        const roll: DiceRoll = { count: 1, sides: 1, modifier: 5 }
        const result = rollDice(roll)
        expect(result.individual[0]).toBe(1)
        expect(result.total).toBe(6)
    })

    it('individual rolls for d20 are in range [1, 20]', () => {
        // Run multiple times for statistical confidence
        for (let i = 0; i < 50; i++) {
            const roll: DiceRoll = { count: 1, sides: 20, modifier: 0 }
            const result = rollDice(roll)
            expect(result.individual[0]).toBeGreaterThanOrEqual(1)
            expect(result.individual[0]).toBeLessThanOrEqual(20)
        }
    })
})

// ── Integration: parse → roll pipeline ────────────────────────────────────────

describe('parse → roll pipeline', () => {
    it('rolls d20 end-to-end', () => {
        const parsed = parseDiceNotation('d20')
        expect(parsed).not.toBeNull()
        const result = rollDice(parsed!)
        expect(result.individual).toHaveLength(1)
        expect(result.individual[0]).toBeGreaterThanOrEqual(1)
        expect(result.individual[0]).toBeLessThanOrEqual(20)
        expect(result.total).toBe(result.individual[0])
    })

    it('rolls 2d6+4 end-to-end', () => {
        const parsed = parseDiceNotation('2d6+4')
        expect(parsed).not.toBeNull()
        const result = rollDice(parsed!, '2d6+4')
        expect(result.individual).toHaveLength(2)
        for (const val of result.individual) {
            expect(val).toBeGreaterThanOrEqual(1)
            expect(val).toBeLessThanOrEqual(6)
        }
        const expectedTotal = result.individual.reduce((a, b) => a + b, 0) + 4
        expect(result.total).toBe(expectedTotal)
    })

    it('rolls d100 end-to-end', () => {
        const parsed = parseDiceNotation('d100')
        expect(parsed).not.toBeNull()
        const result = rollDice(parsed!)
        expect(result.individual[0]).toBeGreaterThanOrEqual(1)
        expect(result.individual[0]).toBeLessThanOrEqual(100)
    })

    it('handles notation with spaces end-to-end', () => {
        const parsed = parseDiceNotation('3d6 + 2')
        expect(parsed).not.toBeNull()
        const result = rollDice(parsed!)
        expect(result.individual).toHaveLength(3)
        expect(result.total).toBe(result.individual.reduce((a, b) => a + b, 0) + 2)
    })
})
