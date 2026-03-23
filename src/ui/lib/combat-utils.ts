/**
 * Shared combat/character utilities used by CombatTab, QuickCombat, and PlayerCard.
 */

// ── HP helpers ───────────────────────────────────────────────────────────────

/** Calculate HP as a percentage (0–100), safe against zero max. */
export function getHPPercent(current: number, max: number): number {
    return max > 0 ? Math.round((current / max) * 100) : 0
}

/** Return a CSS modifier class based on HP percentage thresholds. */
export function getHPClass(pct: number): string {
    if (pct <= 25) return 'crit'
    if (pct <= 50) return 'low'
    return ''
}

// ── Display helpers ──────────────────────────────────────────────────────────

/** Extract up to two initials from a name (e.g. "Goblin Chief" → "GC"). */
export function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
}

// ── Condition constants ──────────────────────────────────────────────────────

/** Core 5e conditions used in the combat tracker. */
export const COMBAT_CONDITIONS = [
    'poisoned', 'stunned', 'prone', 'blinded', 'charmed',
    'frightened', 'incapacitated', 'paralyzed', 'restrained', 'exhausted',
] as const

/** Extended condition list for player management (includes custom states). */
export const PLAYER_CONDITIONS = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled',
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned',
    'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Exhaustion',
    'Blessed', 'Concentrating', 'Inspired',
] as const
