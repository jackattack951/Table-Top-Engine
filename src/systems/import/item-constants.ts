/**
 * Shared item constants — used by document-parser and entity-extractor.
 */

import type { ItemRarity } from '@core/types'

/** Ordered rarity detection patterns (most specific first) */
export const RARITY_PATTERNS: Array<[RegExp, ItemRarity]> = [
    [/\bartifact\b/i, 'artifact'],
    [/\blegendary\b/i, 'legendary'],
    [/\bvery[\s-]rare\b/i, 'very-rare'],
    [/\brare\b/i, 'rare'],
    [/\buncommon\b/i, 'uncommon'],
    [/\bcommon\b/i, 'common'],
    [/\bquest\s*item\b/i, 'quest'],
]

/** Detect rarity from freeform text (returns first match or null) */
export function detectRarity(text: string): ItemRarity | null {
    for (const [pattern, rarity] of RARITY_PATTERNS) {
        if (pattern.test(text)) return rarity
    }
    return null
}
