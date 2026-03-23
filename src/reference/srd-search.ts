/**
 * SRD Search — lightweight in-memory token-matching search across SRD data.
 * No external library. Fully offline, reads from bundled JSON.
 *
 * Architecture constraint: imported directly in cockpit UI. No IPC, no REST.
 */
import spellsData from './srd/spells.json'
import monstersData from './srd/monsters.json'
import conditionsData from './srd/conditions.json'

// ── Data types ────────────────────────────────────────────────────────────────

export interface SpellEntry {
    name: string
    level: number          // 0 = cantrip
    school: string         // "Evocation"
    castingTime: string    // "1 action"
    range: string          // "150 feet"
    components: string     // "V, S, M (a tiny ball of bat guano)"
    duration: string       // "Instantaneous"
    classes: string[]      // ["Sorcerer", "Wizard"]
    description: string    // Full spell text
    higherLevels?: string | null  // "At Higher Levels..." text
}

export interface MonsterAction {
    name: string
    description: string
}

export interface MonsterEntry {
    name: string
    cr: string             // "1/4", "5", "17"
    type: string           // "Beast", "Undead", "Dragon"
    size: string           // "Tiny"/"Small"/"Medium"/"Large"/"Huge"/"Gargantuan"
    ac: number
    hp: string             // "52 (8d8 + 16)"
    speed: string
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
    passivePerception: number
    description?: string
    actions: MonsterAction[]
}

export interface ConditionEntry {
    name: string
    description: string
    effects: string[]
}

export interface SRDSearchResult {
    type: 'spell' | 'monster' | 'condition'
    name: string
    /** One-line summary: level+school for spells, CR+type for monsters, description preview for conditions */
    summary: string
    data: SpellEntry | MonsterEntry | ConditionEntry
}

// ── Typed data ────────────────────────────────────────────────────────────────

const SPELLS: SpellEntry[] = spellsData as SpellEntry[]
const MONSTERS: MonsterEntry[] = monstersData as MonsterEntry[]
const CONDITIONS: ConditionEntry[] = conditionsData as ConditionEntry[]

export type FilterType = 'all' | 'spell' | 'monster' | 'condition'

const MAX_RESULTS = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function spellSummary(spell: SpellEntry): string {
    const levelStr = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`
    return `${levelStr} ${spell.school}`
}

function monsterSummary(monster: MonsterEntry): string {
    return `CR ${monster.cr} ${monster.type}`
}

function conditionSummary(condition: ConditionEntry): string {
    // Truncate to 60 chars for the summary line
    return condition.description.length > 60
        ? condition.description.slice(0, 57) + '…'
        : condition.description
}

/**
 * Tokenizes a string into lowercase words for full-text matching.
 */
function tokenize(text: string): string[] {
    return text.toLowerCase().match(/\w+/g) ?? []
}

/**
 * Returns true if all tokens in the query appear anywhere in the target text.
 */
function allTokensPresent(queryTokens: string[], target: string): boolean {
    const targetLower = target.toLowerCase()
    return queryTokens.every((t) => targetLower.includes(t))
}

type MatchRank = 0 | 1 | 2 | 3
// 0 = exact name match, 1 = prefix match, 2 = contains match, 3 = full-text match

function rankMatch(name: string, queryLower: string): MatchRank | null {
    const nameLower = name.toLowerCase()
    if (nameLower === queryLower) return 0
    if (nameLower.startsWith(queryLower)) return 1
    if (nameLower.includes(queryLower)) return 2
    return null
}

// ── Core search function ──────────────────────────────────────────────────────

/**
 * Searches SRD data by name prefix first, then full-text fallback.
 * Returns max 20 results, sorted: exact match > prefix > contains > full-text.
 *
 * @param query - Search string, e.g. "fire", "Fireball", "Wizard"
 * @param filter - Optional filter: 'all' | 'spell' | 'monster' | 'condition'
 */
export function searchSRD(query: string, filter: FilterType = 'all'): SRDSearchResult[] {
    const trimmed = query.trim()
    if (!trimmed) return []

    const queryLower = trimmed.toLowerCase()
    const queryTokens = tokenize(trimmed)

    type Candidate = { rank: MatchRank; result: SRDSearchResult }
    const candidates: Candidate[] = []

    // ── Spells ────────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'spell') {
        for (const spell of SPELLS) {
            // Name match
            const nameRank = rankMatch(spell.name, queryLower)
            if (nameRank !== null) {
                candidates.push({
                    rank: nameRank,
                    result: { type: 'spell', name: spell.name, summary: spellSummary(spell), data: spell },
                })
                continue
            }
            // School match (prefix on school acts like rank 1)
            if (spell.school.toLowerCase().includes(queryLower)) {
                candidates.push({
                    rank: 2,
                    result: { type: 'spell', name: spell.name, summary: spellSummary(spell), data: spell },
                })
                continue
            }
            // Class match
            const classMatch = spell.classes.some((c) => c.toLowerCase().includes(queryLower))
            if (classMatch) {
                candidates.push({
                    rank: 2,
                    result: { type: 'spell', name: spell.name, summary: spellSummary(spell), data: spell },
                })
                continue
            }
            // Full-text description match — all tokens must be present
            if (allTokensPresent(queryTokens, spell.description)) {
                candidates.push({
                    rank: 3,
                    result: { type: 'spell', name: spell.name, summary: spellSummary(spell), data: spell },
                })
            }
        }
    }

    // ── Monsters ──────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'monster') {
        for (const monster of MONSTERS) {
            const nameRank = rankMatch(monster.name, queryLower)
            if (nameRank !== null) {
                candidates.push({
                    rank: nameRank,
                    result: { type: 'monster', name: monster.name, summary: monsterSummary(monster), data: monster },
                })
                continue
            }
            // Type match
            if (monster.type.toLowerCase().includes(queryLower)) {
                candidates.push({
                    rank: 2,
                    result: { type: 'monster', name: monster.name, summary: monsterSummary(monster), data: monster },
                })
                continue
            }
            // Description / action full-text match
            const descText = [monster.description ?? '', ...monster.actions.map((a) => a.description)].join(' ')
            if (allTokensPresent(queryTokens, descText)) {
                candidates.push({
                    rank: 3,
                    result: { type: 'monster', name: monster.name, summary: monsterSummary(monster), data: monster },
                })
            }
        }
    }

    // ── Conditions ────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'condition') {
        for (const condition of CONDITIONS) {
            const nameRank = rankMatch(condition.name, queryLower)
            if (nameRank !== null) {
                candidates.push({
                    rank: nameRank,
                    result: { type: 'condition', name: condition.name, summary: conditionSummary(condition), data: condition },
                })
                continue
            }
            // Effects / description full-text match
            const fullText = [condition.description, ...condition.effects].join(' ')
            if (allTokensPresent(queryTokens, fullText)) {
                candidates.push({
                    rank: 3,
                    result: { type: 'condition', name: condition.name, summary: conditionSummary(condition), data: condition },
                })
            }
        }
    }

    // Sort by rank (lower = better), then alphabetically by name within same rank
    candidates.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank
        return a.result.name.localeCompare(b.result.name)
    })

    return candidates.slice(0, MAX_RESULTS).map((c) => c.result)
}
