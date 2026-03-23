/**
 * dice-parser.ts — Pure dice notation parser and roller.
 *
 * Supports standard TTRPG notation: "d20", "2d6+4", "4d8-2", "d100", etc.
 * Uses crypto.getRandomValues() for cryptographically random rolls.
 */

/** Parsed representation of a dice expression. */
export interface DiceRoll {
    /** Number of dice to roll (e.g., 2 in "2d6"). Defaults to 1 for bare "d20". */
    count: number
    /** Number of sides on each die (e.g., 6 in "2d6"). */
    sides: number
    /** Flat modifier applied to the total (e.g., +4 or -2). Defaults to 0. */
    modifier: number
}

/** Result of executing a dice roll. */
export interface RollResult {
    /** The original input string (e.g., "2d6+4"). */
    input: string
    /** The parsed dice roll parameters. */
    parsed: DiceRoll
    /** Individual die results (e.g., [3, 5]). */
    individual: number[]
    /** Sum of individual rolls plus modifier (e.g., 12 for [3,5]+4). */
    total: number
    /** Unix timestamp (ms) when the roll was made. */
    timestamp: number
}

/**
 * Parse a dice notation string into a DiceRoll object.
 *
 * Supported formats:
 * - "d20"       → { count: 1, sides: 20, modifier: 0 }
 * - "2d6"       → { count: 2, sides: 6,  modifier: 0 }
 * - "4d8+3"     → { count: 4, sides: 8,  modifier: 3 }
 * - "1d20-1"    → { count: 1, sides: 20, modifier: -1 }
 * - "d100"      → { count: 1, sides: 100, modifier: 0 }
 * - "3d6 + 2"   → { count: 3, sides: 6,  modifier: 2 } (spaces allowed)
 *
 * Case insensitive. Returns null for invalid or unsafe input.
 */
export function parseDiceNotation(input: string): DiceRoll | null {
    if (!input || typeof input !== 'string') return null

    // Normalize: trim whitespace around the whole expression, collapse spaces around +/-
    const normalized = input
        .trim()
        .toLowerCase()
        .replace(/\s*([+\-])\s*/g, '$1')
        .replace(/\s+/g, '')

    // Regex: optional count, 'd', sides, optional modifier
    // Groups: (1) count?, (2) sides, (3) modifier sign+value?
    const pattern = /^(\d+)?d(\d+)([+-]\d+)?$/
    const match = normalized.match(pattern)

    if (!match) return null

    const count = match[1] !== undefined ? parseInt(match[1], 10) : 1
    const sides = parseInt(match[2], 10)
    const modifier = match[3] !== undefined ? parseInt(match[3], 10) : 0

    // Validate: count must be ≥ 1, sides must be ≥ 1
    if (count < 1 || sides < 1) return null

    // Guard against unreasonably large values that would freeze the app
    if (count > 1000 || sides > 100000) return null

    return { count, sides, modifier }
}

/**
 * Roll dice according to a parsed DiceRoll specification.
 *
 * Uses crypto.getRandomValues() for uniform distribution across sides.
 * Each individual result is in the range [1, sides].
 * The total is the sum of individual results plus the modifier.
 *
 * @param roll - Parsed dice parameters from parseDiceNotation()
 * @param input - Original input string for record-keeping (defaults to generated string)
 * @returns A RollResult with individual rolls, total, and timestamp
 */
export function rollDice(roll: DiceRoll, input?: string): RollResult {
    const individual: number[] = []

    for (let i = 0; i < roll.count; i++) {
        individual.push(randomInt(1, roll.sides))
    }

    const sum = individual.reduce((acc, val) => acc + val, 0)
    const total = sum + roll.modifier

    const generatedInput = input ?? buildNotationString(roll)

    return {
        input: generatedInput,
        parsed: roll,
        individual,
        total,
        timestamp: Date.now(),
    }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random integer in [min, max] inclusive.
 * Uses rejection sampling to avoid modulo bias.
 */
function randomInt(min: number, max: number): number {
    const range = max - min + 1
    // Use a Uint32Array for up to 2^32 range
    const buffer = new Uint32Array(1)
    // Rejection sampling: discard values in the biased tail
    const limit = Math.floor(0x100000000 / range) * range
    let value: number
    do {
        crypto.getRandomValues(buffer)
        value = buffer[0]
    } while (value >= limit)
    return min + (value % range)
}

/**
 * Build a canonical notation string from a DiceRoll (e.g., "2d6+4").
 */
function buildNotationString(roll: DiceRoll): string {
    const base = `${roll.count}d${roll.sides}`
    if (roll.modifier === 0) return base
    if (roll.modifier > 0) return `${base}+${roll.modifier}`
    return `${base}${roll.modifier}` // negative modifier already includes the minus sign
}
