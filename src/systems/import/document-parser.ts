/**
 * Smart Import Parser — Sprint 15h (refined Sprint 16, expanded Sprint 19).
 * Parses campaign documents (markdown/text/PDF-extracted text) and extracts
 * structured entities (scenes, NPCs, items, locations, factions, lore)
 * using regex + structural heuristics.
 *
 * Handles common markdown variations:
 * - Bold-wrapped headings: `## **Scene 1 — Title**`
 * - Bold paragraph section markers: `**Items in Scene 1**`
 * - Keyword synonyms for NPCs: NPC, Character, Creature, Monster, etc.
 * - Indented item/location lists under `## Items` / `## Locations`
 * - Single-column markdown tables (callout boxes, NPC cards)
 *
 * Sprint 19 additions (D&D adventure module support):
 * - Part/Act/Chapter heading patterns for scene detection
 * - "Roleplaying [Name]" NPC blocks with Ideal/Bond/Flaw fields
 * - Improved read-aloud text detection (plain text, not just markdown blockquotes)
 *
 * Pure function — no Node.js fs dependency, runs in browser or main process.
 * Returns an ExtractionResult with categorized entity arrays for preview UI.
 */

import type { NoteType, ItemRarity } from '@core/types'
import { RARITY_PATTERNS, detectRarity } from './item-constants'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedEntity {
    /** Unique key within this extraction (for UI keying) */
    key: string
    /** Display title */
    title: string
    /** Target entity type */
    type: NoteType | 'item'
    /** Raw markdown body content */
    body: string
    /** Parsed metadata fields (type-specific) */
    metadata: Record<string, unknown>
    /** Line range in the source document [start, end] */
    sourceRange: [number, number]
    /** References to other extracted entity keys */
    relationships: string[]
    /** Whether the DM has checked this for import (default true) */
    checked: boolean
}

export interface ExtractionResult {
    scenes: ExtractedEntity[]
    npcs: ExtractedEntity[]
    items: ExtractedEntity[]
    locations: ExtractedEntity[]
    factions: ExtractedEntity[]
    lore: ExtractedEntity[]
    /** Total entity count across all categories */
    total: number
}

// ── NPC keyword map ─────────────────────────────────────────────────────────

interface NPCKeywordInfo {
    tag: string | null
    combatant: boolean
}

const NPC_KEYWORDS: Record<string, NPCKeywordInfo> = {
    'npc': { tag: null, combatant: false },
    'npcs': { tag: null, combatant: false },
    'character': { tag: null, combatant: false },
    'characters': { tag: null, combatant: false },
    'ally': { tag: 'ally', combatant: false },
    'allies': { tag: 'ally', combatant: false },
    'patron': { tag: 'patron', combatant: false },
    'patrons': { tag: 'patron', combatant: false },
    'villain': { tag: 'villain', combatant: false },
    'villains': { tag: 'villain', combatant: false },
    'enemy': { tag: 'enemy', combatant: true },
    'enemies': { tag: 'enemy', combatant: true },
    'creature': { tag: 'creature', combatant: true },
    'creatures': { tag: 'creature', combatant: true },
    'monster': { tag: 'monster', combatant: true },
    'monsters': { tag: 'monster', combatant: true },
    'beast': { tag: 'beast', combatant: true },
    'beasts': { tag: 'beast', combatant: true },
    'boss': { tag: 'boss', combatant: true },
    'bosses': { tag: 'boss', combatant: true },
}

/** Regex alternation of all NPC keywords (case-insensitive matching) */
const NPC_KW_ALT = Object.keys(NPC_KEYWORDS).join('|')

// ── Item tag sets ───────────────────────────────────────────────────────────

const RARITY_VALUES = new Set<string>([
    'common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact',
])

const SCENE_STATE_VALUES = new Set<string>([
    'loot', 'hidden', 'given', 'placed', 'quest',
])

const PROPERTY_VALUES = new Set<string>([
    'attunement', 'consumable', 'cursed', 'finesse', 'versatile',
    'thrown', 'light', 'heavy', 'two-handed',
])

// ── Lore heading synonyms ───────────────────────────────────────────────────

const LORE_HEADING_PATTERN = 'Lore|History|World|Setting|Backstory'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeKey(type: string, index: number, title: string): string {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
    return `${type}-${index}-${slug}`
}

function lineRange(text: string, startIdx: number, endIdx: number): [number, number] {
    const before = text.slice(0, startIdx)
    const startLine = (before.match(/\n/g) || []).length + 1
    const content = text.slice(startIdx, endIdx)
    const endLine = startLine + (content.match(/\n/g) || []).length
    return [startLine, endLine]
}

/** Strip leading/trailing bold markers (`**` or `*`) from text */
function stripBold(text: string): string {
    return text.replace(/^\*{1,2}/, '').replace(/\*{1,2}$/, '').trim()
}

/** Get the leading whitespace length of a line */
function getLineIndent(line: string): number {
    const match = line.match(/^([ \t]*)/)
    return match?.[1]?.length ?? 0
}

/** Extract the body text between a heading match and the next heading of same/higher level */
function extractSectionBody(text: string, headingMatch: RegExpExecArray, headingLevel: number): { body: string; endIndex: number } {
    const startIdx = headingMatch.index! + headingMatch[0].length
    // Find the next heading of equal or higher level (handles bold-wrapped headings)
    const nextHeadingPattern = new RegExp(`^#{1,${headingLevel}} `, 'gm')
    nextHeadingPattern.lastIndex = startIdx
    const nextMatch = nextHeadingPattern.exec(text)
    const endIdx = nextMatch ? nextMatch.index! : text.length
    // Only trim leading/trailing newlines — preserve indentation within the body
    const body = text.slice(startIdx, endIdx).replace(/^\n+/, '').replace(/\n+$/, '')
    return { body, endIndex: endIdx }
}

/** Parse parenthetical item tags into rarity, properties, and scene state */
function parseItemTags(tagString: string): { rarity: ItemRarity | null; properties: string[]; sceneState: string | null } {
    const tags = tagString.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    let rarity: ItemRarity | null = null
    let sceneState: string | null = null
    const properties: string[] = []

    for (const tag of tags) {
        if (RARITY_VALUES.has(tag)) rarity = tag as ItemRarity
        else if (SCENE_STATE_VALUES.has(tag)) sceneState = tag
        else if (PROPERTY_VALUES.has(tag)) properties.push(tag)
        else if (tag) properties.push(tag) // unknown tags become properties
    }

    return { rarity, properties, sceneState }
}

// ── Scene boundary tracking ─────────────────────────────────────────────────

interface SceneBound {
    key: string
    startIdx: number
}

/** Find the parent scene for a character position in the document */
function findParentScene(charIndex: number, sceneBounds: SceneBound[]): string | null {
    let parent: string | null = null
    for (const bound of sceneBounds) {
        if (bound.startIdx <= charIndex) parent = bound.key
        else break
    }
    return parent
}

// RARITY_PATTERNS and detectRarity imported from ./item-constants

/** Stat block patterns that indicate a combatant (precompiled) */
const STAT_BLOCK_PATTERNS = [
    /\bHP\s*:\s*\d+/i,
    /\bAC\s*:\s*\d+/i,
    /\bHit Points\s*:\s*\d+/i,
    /\bArmor Class\s*:\s*\d+/i,
    /\bSTR\s*:\s*\d+/i,
    /\bCR\s+\d+/i,
]

/** Detect stat block patterns that indicate a combatant */
function hasStatBlock(text: string): boolean {
    return STAT_BLOCK_PATTERNS.some((p) => p.test(text))
}

// ── NPC field patterns (precompiled) ────────────────────────────────────────

const NPC_FIELD_RE_RACE = /\b(?:Race|Species)\s*[:—–-]\s*(.+)/i
const NPC_FIELD_RE_CLASS = /\bClass\s*[:—–-]\s*(.+)/i
const NPC_FIELD_RE_ALIGN = /\bAlignment\s*[:—–-]\s*(.+)/i
const NPC_FIELD_RE_ROLE = /\bRole\s*[:—–-]\s*(.+)/i
const NPC_FIELD_RE_DESC = /\bDescription\s*[:—–-]\s*(.+)/i
const NPC_FIELD_RE_IDEAL = /\bIdeal\s*[:—–-]\s*(.+)/i
const NPC_FIELD_RE_BOND = /\bBond\s*[:—–-]\s*(.+)/i
const NPC_FIELD_RE_FLAW = /\bFlaw\s*[:—–-]\s*(.+)/i

/** Extract common structured fields from an NPC body */
function parseNPCFields(body: string): Record<string, string | null> {
    return {
        race: body.match(NPC_FIELD_RE_RACE)?.[1]?.trim() ?? null,
        class: body.match(NPC_FIELD_RE_CLASS)?.[1]?.trim() ?? null,
        alignment: body.match(NPC_FIELD_RE_ALIGN)?.[1]?.trim() ?? null,
        role: body.match(NPC_FIELD_RE_ROLE)?.[1]?.trim() ?? null,
        description: body.match(NPC_FIELD_RE_DESC)?.[1]?.trim() ?? null,
        ideal: body.match(NPC_FIELD_RE_IDEAL)?.[1]?.trim() ?? null,
        bond: body.match(NPC_FIELD_RE_BOND)?.[1]?.trim() ?? null,
        flaw: body.match(NPC_FIELD_RE_FLAW)?.[1]?.trim() ?? null,
    }
}

// ── Scene extraction ─────────────────────────────────────────────────────────

/**
 * Detects scenes from heading patterns like:
 * - `## Scene 1: The Crash Site — Wreckage Field`
 * - `## **Scene 1 — The Forest Edge**`
 * - `### Scene 1 — The Forest Edge`
 * - `## Act 1, Scene 2: Arrival`
 *
 * Sprint 19 additions (D&D adventure module patterns):
 * - `Part 1: The Coming of the Maimed Virulence` (Tyranny in Phlan)
 * - `Act 1: Prologue` (Elfhunt)
 * - `Chapter 1: Into Stensia` (Army of the Damned)
 * - `Scene 3: Dick the Word Dirk` (without ## heading, plain text from PDFs)
 */
function extractScenes(text: string): { scenes: ExtractedEntity[]; bounds: SceneBound[] } {
    const scenes: ExtractedEntity[] = []
    const bounds: SceneBound[] = []
    const seenTitles = new Set<string>()

    // Pattern 1: ## or ### Scene headings — tolerates bold wrapping and optional Act prefix
    const scenePattern = /^(#{2,3})\s+\*{0,2}(?:Act\s+\d+[,:]?\s*)?Scene\s+(\d+)\s*[:—–-]\s*(.+)/gmi
    let match: RegExpExecArray | null

    while ((match = scenePattern.exec(text)) !== null) {
        const level = match[1]!.length
        const sceneNum = match[2]!
        const titlePart = stripBold(match[3]!.trim())
        const { body, endIndex } = extractSectionBody(text, match, level)
        const { sceneName, locationName } = splitSceneTitle(titlePart)
        const readAloud = extractReadAloud(body)

        const key = makeKey('scene', scenes.length, sceneName)
        const normalTitle = sceneName.toLowerCase()
        if (seenTitles.has(normalTitle)) continue
        seenTitles.add(normalTitle)

        scenes.push({
            key,
            title: `Scene ${sceneNum}: ${sceneName}`,
            type: 'scene',
            body,
            metadata: {
                sceneNumber: parseInt(sceneNum, 10),
                locationName,
                readAloud,
            },
            sourceRange: lineRange(text, match.index!, endIndex),
            relationships: [],
            checked: true,
        })

        bounds.push({ key, startIdx: match.index! })
    }

    // Pattern 2: Part/Act/Chapter headings (D&D adventure module style)
    // Matches: ## Part 1: Title, ## Chapter 3 — Title, Act 2: Title, Part 1 — Title
    // Both with and without ## heading markers (PDF text often strips them)
    const modulePattern = /^(#{0,3})\s*\*{0,2}(Part|Act|Chapter)\s+(\d+)\s*[:—–]\s*(.+?)\*{0,2}\s*$/gmi

    while ((match = modulePattern.exec(text)) !== null) {
        const headingLevel = match[1]?.length || 2
        const structType = match[2]!
        const num = match[3]!
        const titlePart = stripBold(match[4]!.trim())
        const { body, endIndex } = extractSectionBody(text, match, headingLevel || 2)
        const { sceneName, locationName } = splitSceneTitle(titlePart)
        const readAloud = extractReadAloud(body)

        const normalTitle = sceneName.toLowerCase()
        if (seenTitles.has(normalTitle)) continue
        seenTitles.add(normalTitle)

        const key = makeKey('scene', scenes.length, sceneName)
        scenes.push({
            key,
            title: `${structType} ${num}: ${sceneName}`,
            type: 'scene',
            body,
            metadata: {
                sceneNumber: parseInt(num, 10),
                locationName,
                readAloud,
                structureType: structType.toLowerCase(),
            },
            sourceRange: lineRange(text, match.index!, endIndex),
            relationships: [],
            checked: true,
        })

        bounds.push({ key, startIdx: match.index! })
    }

    // Sort bounds by position for correct parent-scene lookups
    bounds.sort((a, b) => a.startIdx - b.startIdx)

    return { scenes, bounds }
}

/** Split a scene title into name and optional location (after dash/em-dash) */
function splitSceneTitle(titlePart: string): { sceneName: string; locationName: string | null } {
    const locationMatch = titlePart.match(/^(.+?)\s*[—–-]\s*(.+)$/)
    return {
        sceneName: locationMatch ? locationMatch[1]!.trim() : titlePart,
        locationName: locationMatch ? locationMatch[2]!.trim() : null,
    }
}

// ── Read-aloud patterns (precompiled) ───────────────────────────────────────

/** Markdown blockquote with READ ALOUD marker */
const READ_ALOUD_BLOCKQUOTE_RE = /(?:>\s*\*?\*?READ\s*ALOUD\*?\*?[\s:]*\n?)((?:>.*\n?)+)/i
/** Table-format read-aloud: | READ ALOUD ... | */
const READ_ALOUD_TABLE_RE = /\|\s*READ\s*ALOUD\s*\*?([\s\S]*?)\*?\s*\|/i
/** Plain text "read the following" / "read or paraphrase" marker (D&D PDF style) */
const READ_ALOUD_PLAIN_RE = /(?:read\s+(?:the\s+following|or\s+paraphrase)[.:]*\s*)([\s\S]*?)(?=\n\s*\n(?:[A-Z](?:he|f|llow|ive|nce)|$))/i

/**
 * Extract read-aloud text from a scene body.
 * Supports multiple formats:
 * - Markdown blockquote: `> **READ ALOUD** ...`
 * - Table format: `| READ ALOUD ... |`
 * - Plain text marker: "read the following" or "read or paraphrase" followed by narrative
 */
function extractReadAloud(body: string): string | null {
    const blockquoteMatch = READ_ALOUD_BLOCKQUOTE_RE.exec(body)
    if (blockquoteMatch) {
        return blockquoteMatch[1]!.replace(/^>\s?/gm, '').trim()
    }

    const tableMatch = READ_ALOUD_TABLE_RE.exec(body)
    if (tableMatch) {
        return tableMatch[1]!.trim()
    }

    const plainTextMatch = READ_ALOUD_PLAIN_RE.exec(body)
    if (plainTextMatch && plainTextMatch[1]!.trim().length > 20) {
        return plainTextMatch[1]!.trim()
    }

    return null
}

// ── NPC extraction ───────────────────────────────────────────────────────────

/**
 * Detects NPCs from patterns like:
 * - `**NPC — Mira Ashveil**`
 * - `**Creature — Stone Golem**`
 * - `**Enemy — Captain Renn** (Iron Compact)`
 * - `NPC — Dren Voss`
 * - `### NPC: Name`
 * - Table rows with Name/Race/Class/Role/Alignment columns
 */
function extractNPCs(text: string, sceneBounds: SceneBound[]): ExtractedEntity[] {
    const npcs: ExtractedEntity[] = []
    const seen = new Set<string>()

    // Build the terminator pattern: next NPC keyword block or heading
    const terminatorStr = `\\n\\*{0,2}(?:${NPC_KW_ALT})\\s*[—–-]|\\n#{2,3}\\s`
    const terminatorPattern = new RegExp(terminatorStr, 'gi')

    // Pattern 1: **Keyword — Name** or Keyword — Name (block format)
    // Captures: [1] keyword, [2] name (inside bold), [3] optional faction (outside bold), [4] body
    const npcBlockPattern = new RegExp(
        `(?:^|\\n)\\*{0,2}(${NPC_KW_ALT})\\s*[—–-]\\s*(.+?)\\*{0,2}\\s*(?:\\(([^)]*)\\))?\\s*\\n([\\s\\S]*?)(?=\\n\\*{0,2}(?:${NPC_KW_ALT})\\s*[—–-]|\\n#{2,3}\\s|$)`,
        'gi',
    )
    let match: RegExpExecArray | null

    while ((match = npcBlockPattern.exec(text)) !== null) {
        const keyword = match[1]!.toLowerCase()
        const kwInfo = NPC_KEYWORDS[keyword]
        if (!kwInfo) continue

        const name = stripBold(match[2]!.trim())
        if (!name || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())

        const factionRef = match[3]?.trim() || null
        const body = match[4]!.trim()

        // Check for stat block → override combatant flag
        const combatant = kwInfo.combatant || hasStatBlock(body)

        const key = makeKey('npc', npcs.length, name)
        const parentScene = findParentScene(match.index!, sceneBounds)
        const fields = parseNPCFields(body)

        npcs.push({
            key,
            title: name,
            type: 'npc',
            body,
            metadata: {
                keyword,
                autoTag: kwInfo.tag,
                combatant,
                factionRef,
                parentScene,
                ...fields,
            },
            sourceRange: lineRange(text, match.index!, match.index! + match[0].length),
            relationships: [],
            checked: true,
        })
    }

    // Pattern 2: ### Keyword: Name or ## Keyword heading with sub-items
    const npcHeadingPattern = new RegExp(
        `^(#{2,3})\\s+\\*{0,2}(${NPC_KW_ALT})\\s*[:—–-]\\s*(.+?)\\*{0,2}\\s*(?:\\(([^)]*)\\))?\\s*$`,
        'gmi',
    )
    while ((match = npcHeadingPattern.exec(text)) !== null) {
        const keyword = match[2]!.toLowerCase()
        const kwInfo = NPC_KEYWORDS[keyword]
        if (!kwInfo) continue

        const name = stripBold(match[3]!.trim())
        if (!name || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())

        const factionRef = match[4]?.trim() || null
        const level = match[1]!.length
        const { body, endIndex } = extractSectionBody(text, match, level)
        const combatant = kwInfo.combatant || hasStatBlock(body)

        const key = makeKey('npc', npcs.length, name)
        const parentScene = findParentScene(match.index!, sceneBounds)
        const fields = parseNPCFields(body)

        npcs.push({
            key,
            title: name,
            type: 'npc',
            body,
            metadata: {
                keyword,
                autoTag: kwInfo.tag,
                combatant,
                factionRef,
                parentScene,
                ...fields,
            },
            sourceRange: lineRange(text, match.index!, endIndex),
            relationships: [],
            checked: true,
        })
    }

    // Pattern 3: NPC table rows (| Name | Race | Class | Role | Alignment |)
    // CRITICAL: [^|\n]+? prevents matching across rows of single-column tables
    const tableRowPattern = /^\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|/gm
    while ((match = tableRowPattern.exec(text)) !== null) {
        const name = match[1]!.trim()
        // Skip header/separator rows
        if (name.toLowerCase() === 'name' || name.startsWith('-') || name.startsWith('=')) continue
        if (seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())

        const key = makeKey('npc', npcs.length, name)
        const parentScene = findParentScene(match.index!, sceneBounds)

        npcs.push({
            key,
            title: name,
            type: 'npc',
            body: `Race: ${match[2]!.trim()}\nClass: ${match[3]!.trim()}\nRole: ${match[4]!.trim()}\nAlignment: ${match[5]!.trim()}`,
            metadata: {
                keyword: 'npc',
                autoTag: null,
                combatant: false,
                factionRef: null,
                parentScene,
                race: match[2]!.trim(),
                class: match[3]!.trim(),
                role: match[4]!.trim(),
                alignment: match[5]!.trim(),
            },
            sourceRange: lineRange(text, match.index!, match.index! + match[0].length),
            relationships: [],
            checked: true,
        })
    }

    // Pattern 4 (Sprint 19): "Roleplaying [Name]" blocks (D&D adventure module style)
    // Matches: "Roleplaying Imizael", "Roleplaying Knight Aleyd Burral", "Roleplaying Fat Mar (Markoth)"
    const roleplayPattern = /(?:^|\n)\s*\*{0,2}Roleplaying\s+(.+?)\*{0,2}\s*\n([\s\S]*?)(?=\n\s*\*{0,2}Roleplaying\s|\n#{2,3}\s|\n\s*\*{0,2}(?:Part|Act|Chapter|Scene)\s+\d|$)/gi
    while ((match = roleplayPattern.exec(text)) !== null) {
        const rawName = stripBold(match[1]!.trim())
        // Handle "Fat Mar (Markoth)" style — extract primary name
        const parenMatch = rawName.match(/^(.+?)\s*\(([^)]+)\)$/)
        const name = parenMatch ? parenMatch[1]!.trim() : rawName
        const altName = parenMatch ? parenMatch[2]!.trim() : null

        if (!name || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())

        const body = match[2]!.trim()
        const key = makeKey('npc', npcs.length, name)
        const parentScene = findParentScene(match.index!, sceneBounds)
        const fields = parseNPCFields(body)

        npcs.push({
            key,
            title: name,
            type: 'npc',
            body,
            metadata: {
                keyword: 'npc',
                autoTag: null,
                combatant: false,
                factionRef: null,
                parentScene,
                altName,
                ...fields,
            },
            sourceRange: lineRange(text, match.index!, match.index! + match[0].length),
            relationships: [],
            checked: true,
        })
    }

    return npcs
}

// ── Item extraction ──────────────────────────────────────────────────────────

/**
 * Detects items from:
 * - `## Items` sections with indented item lines (recommended format)
 * - `## Items in Scene X` sections with bulleted items (legacy format)
 * - `**Items in Scene X**` bold paragraph sections (legacy format)
 * - `**Item Name** (rarity) — description` inline patterns (fallback)
 */
function extractItems(text: string, sceneBounds: SceneBound[]): ExtractedEntity[] {
    const items: ExtractedEntity[] = []
    const seen = new Set<string>()
    let match: RegExpExecArray | null

    // Pattern 1: ## Items heading (recommended format) — with optional bold wrapping
    // Matches: ## Items, ## **Items**, ## Items in Scene X, ## **Items in Scene X**
    const itemsHeadingPattern = /^(#{2,4})\s+\*{0,2}Items?(?:\s+(?:in|for|Given\s+by)\s+.+?)?\*{0,2}\s*$/gmi
    while ((match = itemsHeadingPattern.exec(text)) !== null) {
        const level = match[1]!.length
        const { body: sectionBody } = extractSectionBody(text, match, level)
        const parentScene = findParentScene(match.index!, sceneBounds)
        extractItemsFromSection(sectionBody, text, match.index!, items, seen, parentScene)
    }

    // Pattern 2: **Items** or **Items in Scene X** bold paragraph (no heading)
    const boldItemsPattern = /^\*{2}Items?(?:\s+(?:in|for|Given\s+by)\s+.+?)?\*{2}\s*$/gmi
    while ((match = boldItemsPattern.exec(text)) !== null) {
        // Find the end of this section: next heading or next bold section marker
        const startIdx = match.index! + match[0].length
        const nextBoundary = /\n#{2,4}\s|\n\*{2}(?:NPC|Character|Ally|Enemy|Creature|Monster|Beast|Boss|Villain|Patron|Items?|Locations?|Factions?)\s*[—–:-]/gmi
        nextBoundary.lastIndex = startIdx
        const nextMatch = nextBoundary.exec(text)
        const endIdx = nextMatch ? nextMatch.index! : text.length
        const sectionBody = text.slice(startIdx, endIdx).trim()
        const parentScene = findParentScene(match.index!, sceneBounds)
        extractItemsFromSection(sectionBody, text, match.index!, items, seen, parentScene)
    }

    // Pattern 3: Appendix sections — ## Appendix A: Items (requires "Appendix" prefix)
    const appendixHeading = /^(#{2,3})\s+\*{0,2}Appendix\s*[A-Z]?\s*[:—–-]?\s*Items?\b.*\*{0,2}/gmi
    while ((match = appendixHeading.exec(text)) !== null) {
        const level = match[1]!.length
        const { body: sectionBody } = extractSectionBody(text, match, level)
        extractItemsFromSection(sectionBody, text, match.index!, items, seen, null)
    }

    // Pattern 4: Inline bold item patterns — **Item Name** (rarity) — description (fallback)
    const inlineItemPattern = /\*\*([A-Z][^*]{2,40})\*\*\s*(?:\(([^)]+)\))?\s*[—–-]\s*(.+)/g
    while ((match = inlineItemPattern.exec(text)) !== null) {
        const name = match[1]!.trim()
        if (seen.has(name.toLowerCase())) continue
        // Skip if it looks like an NPC/keyword pattern
        const kwCheck = name.split(/\s/)[0]!.toLowerCase()
        if (kwCheck in NPC_KEYWORDS) continue
        // Skip known non-item patterns
        if (/^(READ\s+ALOUD|Description|Role|Motivation|Key\s+Trait|Secret|What\s+|His\s+|Her\s+|Their\s+)/i.test(name)) continue
        seen.add(name.toLowerCase())

        const parenthetical = match[2]?.trim() ?? ''
        const desc = match[3]!.trim()
        const { rarity, properties, sceneState } = parenthetical
            ? parseItemTags(parenthetical)
            : { rarity: detectRarity(desc), properties: [] as string[], sceneState: null }

        const key = makeKey('item', items.length, name)
        const parentScene = findParentScene(match.index!, sceneBounds)

        items.push({
            key,
            title: name,
            type: 'item',
            body: desc,
            metadata: {
                rarity,
                properties,
                sceneState,
                quantity: 1,
                parentScene,
                parenthetical: parenthetical || null,
            },
            sourceRange: lineRange(text, match.index!, match.index! + match[0].length),
            relationships: [],
            checked: true,
        })
    }

    return items
}

/**
 * Extract items from a section body. Handles both:
 * - New format: indented lines (2+ spaces) with optional sub-lines
 * - Legacy format: bulleted lists (- or * prefix) with bold names
 */
function extractItemsFromSection(
    sectionBody: string,
    fullText: string,
    sectionOffset: number,
    items: ExtractedEntity[],
    seen: Set<string>,
    parentScene: string | null,
): void {
    const lines = sectionBody.split('\n')
    let i = 0

    while (i < lines.length) {
        const line = lines[i]!

        // Try new format: indented line (2+ spaces or tab, no bullet required)
        const indentedMatch = line.match(/^[ \t]{2,}(\S.+)$/)
        // Try legacy format: bullet list item — capture full content after the bullet marker
        const bulletMatch = line.match(/^[ \t]*[-*•]\s+(.+)$/)
        // Fallback: non-indented line that looks like an item (starts with capital, has content)
        // This handles cases where extractSectionBody trims leading whitespace
        const plainMatch = !indentedMatch && !bulletMatch && line.match(/^([A-Z][A-Za-z].{2,})$/)

        const itemLine = indentedMatch?.[1] ?? bulletMatch?.[1] ?? plainMatch?.[1]

        if (!itemLine) {
            i++
            continue
        }

        // Parse item line: Name x5 (tags) — Description
        const parsed = parseItemLine(itemLine.trim())
        if (!parsed) {
            i++
            continue
        }

        // bulletMatch now passes full content to parseItemLine which handles everything

        if (seen.has(parsed.name.toLowerCase())) {
            i++
            continue
        }
        seen.add(parsed.name.toLowerCase())

        // Collect sub-lines (deeper indentation)
        const currentIndent = getLineIndent(line)
        const subLines: string[] = []
        i++
        while (i < lines.length) {
            const nextLine = lines[i]!
            const nextIndent = getLineIndent(nextLine)
            if (nextIndent > currentIndent && nextLine.trim()) {
                subLines.push(nextLine.trim())
                i++
            } else if (!nextLine.trim()) {
                // Blank line — peek ahead to see if more sub-lines follow
                if (i + 1 < lines.length) {
                    const peekIndent = lines[i + 1]!.match(/^([ \t]*)/)![1]!.length
                    if (peekIndent > currentIndent) {
                        i++
                        continue
                    }
                }
                break
            } else {
                break
            }
        }

        // Build body from description + sub-lines
        const bodyParts: string[] = []
        if (parsed.description) bodyParts.push(parsed.description)
        if (subLines.length > 0) bodyParts.push(subLines.join('\n'))
        const body = bodyParts.join('\n')

        const key = makeKey('item', items.length, parsed.name)
        items.push({
            key,
            title: parsed.name,
            type: 'item',
            body,
            metadata: {
                rarity: parsed.rarity,
                properties: parsed.properties,
                sceneState: parsed.sceneState,
                quantity: parsed.quantity,
                parentScene,
            },
            sourceRange: lineRange(fullText, sectionOffset, sectionOffset + line.length),
            relationships: [],
            checked: true,
        })
    }
}

interface ParsedItemLine {
    name: string
    quantity: number
    rarity: ItemRarity | null
    properties: string[]
    sceneState: string | null
    description: string | null
}

/** Parse a single item line: `Name x5 (tags) — Description` */
function parseItemLine(line: string): ParsedItemLine | null {
    let text = line.replace(/^[-*•]\s+/, '').trim()
    if (!text) return null

    // Handle **Name:** Description format BEFORE unwrapping bold.
    // This preserves the boundary between name (inside bold) and description (after bold),
    // preventing colons/dashes in the description from being mistaken as separators.
    const boldColonMatch = text.match(/^\*{2}(.+?):?\*{2}\s*(.*)$/)
    if (boldColonMatch) {
        const nameSection = boldColonMatch[1]!.replace(/:$/, '').trim()
        const descSection = boldColonMatch[2]?.trim() || null
        return parseItemParts(nameSection, descSection)
    }

    // Generic path: unwrap bold markers and parse
    text = text.replace(/\*{2}(.+?)\*{2}/g, '$1').trim()
    return parseItemGeneric(text)
}

/** Extract quantity (xN) and parenthetical tags from text, returning cleaned text */
function extractQtyAndTags(text: string): { text: string; quantity: number; rarity: ItemRarity | null; sceneState: string | null; properties: string[] } {
    let quantity = 1
    const qtyMatch = text.match(/\s+x(\d+)\b/i)
    if (qtyMatch) {
        quantity = parseInt(qtyMatch[1]!, 10)
        text = text.replace(qtyMatch[0], '')
    }

    let rarity: ItemRarity | null = null
    let sceneState: string | null = null
    let properties: string[] = []
    const tagMatch = text.match(/\(([^)]+)\)/)
    if (tagMatch) {
        const parsed = parseItemTags(tagMatch[1]!)
        rarity = parsed.rarity
        sceneState = parsed.sceneState
        properties = parsed.properties
        text = text.replace(tagMatch[0], '')
    }

    return { text, quantity, rarity, sceneState, properties }
}

/** Parse name section for quantity and tags, combine with description */
function parseItemParts(nameSection: string, descSection: string | null): ParsedItemLine | null {
    const extracted = extractQtyAndTags(nameSection)

    const name = stripBold(extracted.text).replace(/:\s*$/, '').trim()
    if (!name) return null

    const description = descSection
        ? descSection.replace(/^[—–:-]\s*/, '').trim() || null
        : null

    const rarity = extracted.rarity ?? detectRarity(name + ' ' + (description ?? ''))
    return { name, quantity: extracted.quantity, rarity, properties: extracted.properties, sceneState: extracted.sceneState, description }
}

/** Generic item line parsing (no bold structure): `Name x5 (tags) — Description` */
function parseItemGeneric(text: string): ParsedItemLine | null {
    if (!text) return null

    const extracted = extractQtyAndTags(text)
    text = extracted.text

    // Split name and description at separator.
    // Em-dash (—), en-dash (–), or colon (:) are separators.
    // Plain hyphens (-) only when surrounded by spaces (to preserve "Anti-Rad Pills").
    let name: string
    let description: string | null = null
    const sepMatch = text.match(/^(.+?)\s*[—–]\s*(.+)$/)
        ?? text.match(/^(.+?)\s*:\s+(.+)$/)
        ?? text.match(/^(.+?)\s+-\s+(.+)$/)
    if (sepMatch) {
        name = sepMatch[1]!.trim()
        description = sepMatch[2]!.trim()
    } else {
        name = text.trim()
    }

    name = stripBold(name).replace(/:\s*$/, '').trim()
    if (!name) return null

    const rarity = extracted.rarity ?? detectRarity(name + ' ' + (description ?? ''))
    return { name, quantity: extracted.quantity, rarity, properties: extracted.properties, sceneState: extracted.sceneState, description }
}

// ── Location extraction ──────────────────────────────────────────────────────

/**
 * Extracts locations from:
 * - `## Locations` sections with indented location lines (recommended)
 * - Scene heading suffixes (after — in scene titles)
 * - `## Location: Name` or `### Location: Name` headings (legacy)
 */
function extractLocations(text: string, scenes: ExtractedEntity[], sceneBounds: SceneBound[]): ExtractedEntity[] {
    const locations: ExtractedEntity[] = []
    const seen = new Set<string>()
    let match: RegExpExecArray | null

    // Pattern 1: ## Locations section with indented entries (recommended format)
    const locationsHeadingPattern = /^(#{2,4})\s+\*{0,2}Locations?\*{0,2}\s*$/gmi
    while ((match = locationsHeadingPattern.exec(text)) !== null) {
        const level = match[1]!.length
        const { body: sectionBody } = extractSectionBody(text, match, level)
        const parentScene = findParentScene(match.index!, sceneBounds)

        const lines = sectionBody.split('\n')
        let i = 0
        let foundEntries = false
        while (i < lines.length) {
            const line = lines[i]!

            // Skip blank lines
            if (!line.trim()) { i++; continue }

            // Stop at bold NPC markers or other entity patterns
            if (/^\*\*\w/.test(line.trim())) break

            // Match indented or bulleted lines as location entries
            const locMatch = line.match(/^[ \t]{2,}(\S.+)$/) ?? line.match(/^[ \t]*[-*•]\s+(.+)$/)
            if (!locMatch) {
                // Non-indented, non-bulleted, non-blank line — stop if we already found entries
                if (foundEntries) break
                i++
                continue
            }

            const rawLine = locMatch[1]!.trim()
            // Parse: Name — Description
            const nameDescMatch = rawLine.match(/^(.+?)\s*[—–:-]\s*(.+)$/)
            const locName = stripBold(nameDescMatch ? nameDescMatch[1]!.trim() : rawLine)
            const desc = nameDescMatch ? nameDescMatch[2]!.trim() : ''

            if (!locName || seen.has(locName.toLowerCase())) {
                i++
                continue
            }
            seen.add(locName.toLowerCase())

            // Collect sub-lines
            const currentIndent = getLineIndent(line)
            const subLines: string[] = []
            i++
            while (i < lines.length) {
                const nextLine = lines[i]!
                const nextIndent = getLineIndent(nextLine)
                if (nextIndent > currentIndent && nextLine.trim()) {
                    subLines.push(nextLine.trim())
                    i++
                } else break
            }

            foundEntries = true
            const body = [desc, ...subLines].filter(Boolean).join('\n')
            const key = makeKey('location', locations.length, locName)
            locations.push({
                key,
                title: locName,
                type: 'location',
                body,
                metadata: { parentScene },
                sourceRange: lineRange(text, match.index!, match.index! + match[0].length),
                relationships: parentScene ? [parentScene] : [],
                checked: true,
            })
        }
    }

    // Pattern 2: Locations from scene title metadata
    for (const scene of scenes) {
        const locationName = scene.metadata['locationName'] as string | null
        if (locationName && !seen.has(locationName.toLowerCase())) {
            seen.add(locationName.toLowerCase())
            const key = makeKey('location', locations.length, locationName)
            locations.push({
                key,
                title: locationName,
                type: 'location',
                body: `Location from ${scene.title}`,
                metadata: { fromScene: scene.key, parentScene: scene.key },
                sourceRange: scene.sourceRange,
                relationships: [scene.key],
                checked: true,
            })
        }
    }

    // Pattern 3: Standalone location headings (legacy)
    const locationHeadingPattern = /^(#{2,3})\s+\*{0,2}Location\s*[:—–-]\s*(.+?)\*{0,2}\s*$/gmi
    while ((match = locationHeadingPattern.exec(text)) !== null) {
        const name = stripBold(match[2]!.trim())
        if (!name || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())

        const level = match[1]!.length
        const { body, endIndex } = extractSectionBody(text, match, level)
        const parentScene = findParentScene(match.index!, sceneBounds)

        const key = makeKey('location', locations.length, name)
        locations.push({
            key,
            title: name,
            type: 'location',
            body,
            metadata: { parentScene },
            sourceRange: lineRange(text, match.index!, endIndex),
            relationships: parentScene ? [parentScene] : [],
            checked: true,
        })
    }

    return locations
}

// ── Faction extraction ───────────────────────────────────────────────────────

/**
 * Extracts factions from:
 * - `## Factions` heading with indented list (recommended)
 * - `## Faction: Name` headings (legacy)
 * - NPC metadata faction references
 */
function extractFactions(text: string, npcs: ExtractedEntity[]): ExtractedEntity[] {
    const factions: ExtractedEntity[] = []
    const seen = new Set<string>()
    let match: RegExpExecArray | null

    // Pattern 1: ## Factions section with indented entries (recommended)
    const factionsHeadingPattern = /^(#{2,3})\s+\*{0,2}Factions?\*{0,2}\s*$/gmi
    while ((match = factionsHeadingPattern.exec(text)) !== null) {
        const level = match[1]!.length
        const { body: sectionBody } = extractSectionBody(text, match, level)

        const lines = sectionBody.split('\n')
        let i = 0
        while (i < lines.length) {
            const line = lines[i]!
            // Match indented, bulleted, or plain capitalized lines
            const entryMatch = line.match(/^[ \t]{2,}(\S.+)$/)
                ?? line.match(/^[ \t]*[-*•]\s+(.+)$/)
                ?? line.match(/^\s*([A-Z].+?)\s*(?:[—–:-]\s*(.+))?$/)

            if (!entryMatch || line.startsWith('#')) {
                i++
                continue
            }

            const rawLine = entryMatch[1]!.trim()
            const nameDescMatch = rawLine.match(/^(.+?)\s*[—–:-]\s*(.+)$/)
            const factionName = stripBold(nameDescMatch ? nameDescMatch[1]!.trim() : rawLine)
            const desc = nameDescMatch ? nameDescMatch[2]!.trim() : ''

            if (!factionName || factionName.length < 2 || seen.has(factionName.toLowerCase())) {
                i++
                continue
            }
            seen.add(factionName.toLowerCase())

            // Collect sub-lines
            const currentIndent = getLineIndent(line)
            const subLines: string[] = []
            i++
            while (i < lines.length) {
                const nextLine = lines[i]!
                const nextIndent = getLineIndent(nextLine)
                if (nextIndent > currentIndent && nextLine.trim()) {
                    subLines.push(nextLine.trim())
                    i++
                } else break
            }

            const body = [desc, ...subLines].filter(Boolean).join('\n')
            const key = makeKey('faction', factions.length, factionName)
            factions.push({
                key,
                title: factionName,
                type: 'faction',
                body,
                metadata: {},
                sourceRange: lineRange(text, match.index!, match.index! + match[0].length),
                relationships: [],
                checked: true,
            })
        }
    }

    // Pattern 2: Explicit ## Faction: Name headings (legacy)
    const factionHeadingPattern = /^(#{2,3})\s+\*{0,2}Faction\s*[:—–-]\s*(.+?)\*{0,2}\s*$/gmi
    while ((match = factionHeadingPattern.exec(text)) !== null) {
        const name = stripBold(match[2]!.trim())
        if (!name || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())

        const level = match[1]!.length
        const { body, endIndex } = extractSectionBody(text, match, level)

        const key = makeKey('faction', factions.length, name)
        factions.push({
            key,
            title: name,
            type: 'faction',
            body,
            metadata: {},
            sourceRange: lineRange(text, match.index!, endIndex),
            relationships: [],
            checked: true,
        })
    }

    // Pattern 3: Faction references from NPC metadata (auto-create stubs)
    for (const npc of npcs) {
        const factionRef = npc.metadata['factionRef'] as string | null
        if (factionRef && !seen.has(factionRef.toLowerCase())) {
            seen.add(factionRef.toLowerCase())
            const key = makeKey('faction', factions.length, factionRef)
            factions.push({
                key,
                title: factionRef,
                type: 'faction',
                body: `Faction referenced by: ${npc.title}`,
                metadata: { fromNPC: npc.key, stub: true },
                sourceRange: npc.sourceRange,
                relationships: [npc.key],
                checked: true,
            })
        }

        // Also check body for Faction: field (legacy)
        const factionFieldMatch = npc.body.match(/\bFaction\s*[:—–-]\s*(.+)/i)
        if (factionFieldMatch) {
            const name = factionFieldMatch[1]!.trim()
            if (!seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase())
                const key = makeKey('faction', factions.length, name)
                factions.push({
                    key,
                    title: name,
                    type: 'faction',
                    body: `Faction referenced by NPC: ${npc.title}`,
                    metadata: { fromNPC: npc.key, stub: true },
                    sourceRange: npc.sourceRange,
                    relationships: [npc.key],
                    checked: true,
                })
            }
        }
    }

    return factions
}

// ── Lore extraction ──────────────────────────────────────────────────────────

/**
 * Extracts lore from:
 * - `## Lore` heading with indented entries
 * - Synonym headings: ## History, ## World, ## Setting, ## Backstory
 */
function extractLore(text: string): ExtractedEntity[] {
    const lore: ExtractedEntity[] = []
    const seen = new Set<string>()

    const loreHeadingPattern = new RegExp(
        `^(#{2,3})\\s+\\*{0,2}(?:${LORE_HEADING_PATTERN})\\*{0,2}\\s*$`,
        'gmi',
    )
    let match: RegExpExecArray | null

    while ((match = loreHeadingPattern.exec(text)) !== null) {
        const level = match[1]!.length
        const { body: sectionBody } = extractSectionBody(text, match, level)

        const lines = sectionBody.split('\n')
        let i = 0
        while (i < lines.length) {
            const line = lines[i]!
            // Match indented, bulleted, or plain capitalized lines
            const entryMatch = line.match(/^[ \t]{2,}(\S.+)$/)
                ?? line.match(/^[ \t]*[-*•]\s+(.+)$/)
                ?? line.match(/^\s*([A-Z].+?)\s*(?:[—–:-]\s*(.+))?$/)

            if (!entryMatch || line.startsWith('#')) {
                i++
                continue
            }

            const rawLine = entryMatch[1]!.trim()
            const nameDescMatch = rawLine.match(/^(.+?)\s*[—–:-]\s*(.+)$/)
            const loreName = stripBold(nameDescMatch ? nameDescMatch[1]!.trim() : rawLine)
            const desc = nameDescMatch ? nameDescMatch[2]!.trim() : ''

            if (!loreName || loreName.length < 2 || seen.has(loreName.toLowerCase())) {
                i++
                continue
            }
            seen.add(loreName.toLowerCase())

            // Collect sub-lines
            const currentIndent = getLineIndent(line)
            const subLines: string[] = []
            i++
            while (i < lines.length) {
                const nextLine = lines[i]!
                const nextIndent = getLineIndent(nextLine)
                if (nextIndent > currentIndent && nextLine.trim()) {
                    subLines.push(nextLine.trim())
                    i++
                } else break
            }

            const body = [desc, ...subLines].filter(Boolean).join('\n')
            const key = makeKey('lore', lore.length, loreName)
            lore.push({
                key,
                title: loreName,
                type: 'lore',
                body,
                metadata: {},
                sourceRange: lineRange(text, match.index!, match.index! + match[0].length),
                relationships: [],
                checked: true,
            })
        }
    }

    return lore
}

// ── Cross-linking ────────────────────────────────────────────────────────────

/**
 * Scans entity bodies for mentions of other entity titles and builds relationships.
 */
function buildRelationships(result: ExtractionResult): void {
    const allEntities = [
        ...result.scenes,
        ...result.npcs,
        ...result.items,
        ...result.locations,
        ...result.factions,
        ...result.lore,
    ]

    // Build a name→key map for cross-referencing
    const nameMap = new Map<string, string>()
    for (const entity of allEntities) {
        nameMap.set(entity.title.toLowerCase(), entity.key)
    }

    // For each entity, scan its body for mentions of other entity names
    for (const entity of allEntities) {
        const bodyLower = entity.body.toLowerCase()
        for (const [name, key] of nameMap) {
            if (key === entity.key) continue // don't self-reference
            if (name.length < 3) continue // skip very short names to avoid false matches
            if (bodyLower.includes(name)) {
                if (!entity.relationships.includes(key)) {
                    entity.relationships.push(key)
                }
            }
        }
    }

    // Link NPCs to their parent scenes
    for (const npc of result.npcs) {
        const parentScene = npc.metadata['parentScene'] as string | null
        if (parentScene && !npc.relationships.includes(parentScene)) {
            npc.relationships.push(parentScene)
        }
    }

    // Link items to their parent scenes
    for (const item of result.items) {
        const parentScene = item.metadata['parentScene'] as string | null
        if (parentScene && !item.relationships.includes(parentScene)) {
            item.relationships.push(parentScene)
        }
    }

    // Link NPC faction references to faction entities
    for (const npc of result.npcs) {
        const factionRef = npc.metadata['factionRef'] as string | null
        if (factionRef) {
            const factionKey = nameMap.get(factionRef.toLowerCase())
            if (factionKey && !npc.relationships.includes(factionKey)) {
                npc.relationships.push(factionKey)
            }
        }
    }
}

// ── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a campaign document and extract structured entities.
 *
 * @param text Raw markdown/text content of the document
 * @returns ExtractionResult with categorized entity arrays
 */
export function parseDocument(text: string): ExtractionResult {
    const { scenes, bounds } = extractScenes(text)
    const npcs = extractNPCs(text, bounds)
    const items = extractItems(text, bounds)
    const locations = extractLocations(text, scenes, bounds)
    const factions = extractFactions(text, npcs)
    const lore = extractLore(text)

    const result: ExtractionResult = {
        scenes,
        npcs,
        items,
        locations,
        factions,
        lore,
        total: scenes.length + npcs.length + items.length + locations.length + factions.length + lore.length,
    }

    buildRelationships(result)

    return result
}

/**
 * Given an extracted entity that will become a note, build a markdown body
 * with wikilinks to related entities inserted.
 */
export function buildBodyWithWikilinks(entity: ExtractedEntity, allEntities: ExtractedEntity[]): string {
    let body = entity.body

    // Build key→title map for relationship resolution
    const keyMap = new Map<string, string>()
    for (const e of allEntities) {
        keyMap.set(e.key, e.title)
    }

    // For each relationship, try to insert a wikilink reference
    const linkedNames: string[] = []
    for (const relKey of entity.relationships) {
        const title = keyMap.get(relKey)
        if (!title) continue
        linkedNames.push(title)

        // Replace first occurrence of the name with a wikilink (if not already wikilinked)
        const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const namePattern = new RegExp(`(?<!\\[\\[)\\b${escapedTitle}\\b(?!\\]\\])`, 'i')
        body = body.replace(namePattern, `[[${title}]]`)
    }

    // Append a references section if there are relationships not found inline
    const unreferencedLinks = linkedNames.filter((name) => {
        const wikilink = `[[${name}]]`
        return !body.includes(wikilink)
    })

    if (unreferencedLinks.length > 0) {
        body += '\n\n---\n**Related:** ' + unreferencedLinks.map((n) => `[[${n}]]`).join(', ')
    }

    return body
}
