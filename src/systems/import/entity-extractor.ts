/**
 * Entity extractor — Sprint 15i.
 * Parses a selected text block and pre-fills entity fields
 * based on heuristics. Reuses pattern matchers from document-parser.
 *
 * Pure function — runs in browser, no Node.js deps.
 */

import type { NoteType, ItemRarity } from '@core/types'
import { RARITY_PATTERNS } from './item-constants'

export interface ExtractedFields {
    title: string
    body: string
    /** NPC-specific */
    race: string | null
    class: string | null
    alignment: string | null
    /** Item-specific */
    rarity: ItemRarity | null
    properties: string[]
}

/**
 * Extract structured fields from a text selection.
 * Returns best-guess title, parsed metadata, and full body.
 */
export function extractEntityFromText(
    text: string,
    targetType: NoteType | 'item',
): ExtractedFields {
    const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean)
    const body = text.trim()

    // Title heuristic: first bold text, heading, or first line
    let title = ''

    // Try: first **bold** text
    const boldMatch = text.match(/\*\*([^*]+)\*\*/)
    if (boldMatch) {
        title = boldMatch[1]!.trim()
    }

    // Try: first heading
    if (!title) {
        const headingMatch = text.match(/^#{1,4}\s+(.+)/m)
        if (headingMatch) {
            title = headingMatch[1]!.trim()
        }
    }

    // Try: NPC pattern
    if (!title) {
        const npcMatch = text.match(/NPC\s*[—–:-]\s*(.+)/i)
        if (npcMatch) {
            title = npcMatch[1]!.trim().replace(/\*+/g, '')
        }
    }

    // Fallback: first non-empty line, truncated
    if (!title && lines.length > 0) {
        title = lines[0]!.replace(/^[-*•#]+\s*/, '').slice(0, 60).trim()
    }

    // Parse NPC fields
    let race: string | null = null
    let cls: string | null = null
    let alignment: string | null = null

    if (targetType === 'npc') {
        const raceMatch = text.match(/\b(?:Race|Species)\s*[:—–-]\s*(.+)/i)
        const classMatch = text.match(/\bClass\s*[:—–-]\s*(.+)/i)
        const alignMatch = text.match(/\bAlignment\s*[:—–-]\s*(.+)/i)
        race = raceMatch?.[1]?.trim() ?? null
        cls = classMatch?.[1]?.trim() ?? null
        alignment = alignMatch?.[1]?.trim() ?? null
    }

    // Parse Item fields
    let rarity: ItemRarity | null = null
    const properties: string[] = []

    if (targetType === 'item') {
        for (const [pattern, r] of RARITY_PATTERNS) {
            if (pattern.test(text)) { rarity = r; break }
        }

        // Look for properties like "attunement", "cursed", "consumable"
        const propPatterns = [
            /\battunement\b/i,
            /\bcursed\b/i,
            /\bconsumable\b/i,
            /\bfinesse\b/i,
            /\bversatile\b/i,
            /\bthrown\b/i,
            /\blight\b/i,
            /\bheavy\b/i,
            /\btwo-handed\b/i,
        ]
        for (const p of propPatterns) {
            const m = text.match(p)
            if (m) properties.push(m[0].toLowerCase())
        }
    }

    return {
        title,
        body,
        race,
        class: cls,
        alignment,
        rarity,
        properties,
    }
}
