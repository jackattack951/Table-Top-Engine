/**
 * Import Pipeline — Sprint 16b.
 * Takes an ExtractionResult from the document parser and commits all entities
 * to the database, wiring scene-entity links via junction tables.
 *
 * Pure orchestration — receives DB functions via interface (no direct electron imports).
 * Can run in main process (IPC) or server context (REST).
 */

import type { Scene, Note, NoteType, Item, NPC, ColorGrade } from '@core/types'
import type { ExtractionResult, ExtractedEntity } from './document-parser'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImportDB {
    createScene: (data: Omit<Scene, 'id'>) => Scene
    createNote: (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Note
    createNPC: (data: Omit<NPC, 'id'>) => NPC
    createItem: (data: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => Item
    linkNoteToScene: (sceneId: string, noteId: string, sortOrder?: number) => void
    linkNPCToScene: (sceneId: string, npcId: string, sortOrder?: number) => void
    linkItemToScene: (sceneId: string, itemId: string) => void
    updateCampaign: (id: string, data: { startingSceneId?: string }) => unknown
}

export interface ImportResult {
    scenesCreated: number
    npcsCreated: number
    itemsCreated: number
    notesCreated: number
    linksCreated: number
    errors: string[]
}

// ── Default scene template ───────────────────────────────────────────────────

const DEFAULT_COLOR_GRADE: ColorGrade = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: '#000000',
}

function makeDefaultScene(campaignId: string, name: string, sortOrder: number, notes: string): Omit<Scene, 'id'> {
    return {
        campaignId,
        name,
        sortOrder,
        backgroundPath: null,
        gameboardPath: null,
        backgroundAssetId: null,
        gameboardAssetId: null,
        overlays: [],
        particles: { type: 'none', intensity: 0 },
        colorGrade: { ...DEFAULT_COLOR_GRADE },
        gbColorGrade: { ...DEFAULT_COLOR_GRADE },
        audioMood: 0,
        notes,
        linkedNPCIds: [],
        linkedLocationIds: [],
        scratchpad: '',
        nextSceneId: null,
        branches: [],
        fogEnabled: false,
        fogData: null,
    }
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Commits extracted entities to the database and wires all relationships.
 *
 * @param extraction - Output from parseDocument()
 * @param campaignId - Target campaign ID
 * @param db - Database functions (dependency injection)
 * @param sourceFile - Optional source file path for notes
 * @returns Summary of what was created
 */
export function runImportPipeline(
    extraction: ExtractionResult,
    campaignId: string,
    db: ImportDB,
    sourceFile: string | null = null,
): ImportResult {
    const result: ImportResult = {
        scenesCreated: 0,
        npcsCreated: 0,
        itemsCreated: 0,
        notesCreated: 0,
        linksCreated: 0,
        errors: [],
    }

    // Maps extraction keys → DB IDs for relationship wiring
    const keyToSceneId = new Map<string, string>()

    // ── 1. Create scenes ─────────────────────────────────────────────────────

    // Sort by scene number for correct ordering
    const sortedScenes = [...extraction.scenes].sort((a, b) => {
        const numA = (a.metadata['sceneNumber'] as number) ?? 0
        const numB = (b.metadata['sceneNumber'] as number) ?? 0
        return numA - numB
    })

    for (const extracted of sortedScenes) {
        if (!extracted.checked) continue
        try {
            const scene = db.createScene(
                makeDefaultScene(campaignId, extracted.title, result.scenesCreated, extracted.body),
            )
            keyToSceneId.set(extracted.key, scene.id)
            result.scenesCreated++
        } catch (err) {
            result.errors.push(`Scene "${extracted.title}": ${String(err)}`)
        }
    }

    // ── 2. Create NPCs (as NPC records + NPC-typed notes) ────────────────────

    for (const extracted of extraction.npcs) {
        if (!extracted.checked) continue
        try {
            const meta = extracted.metadata

            // Create the NPC record (stat block entity)
            const statBlock: Record<string, unknown> = {}
            if (meta['race']) statBlock['race'] = meta['race']
            if (meta['class']) statBlock['class'] = meta['class']
            if (meta['alignment']) statBlock['alignment'] = meta['alignment']
            if (meta['combatant']) statBlock['combatant'] = true
            if (meta['autoTag']) statBlock['autoTag'] = meta['autoTag']

            const npc = db.createNPC({
                campaignId,
                name: extracted.title,
                statBlock,
                personality: (meta['description'] as string) ?? '',
                notes: extracted.body,
            })

            result.npcsCreated++

            // Also create a note for the notes system (searchable, wikilinked)
            const note = db.createNote({
                campaignId,
                title: extracted.title,
                type: 'npc',
                body: extracted.body,
                tags: buildTags(meta),
                sourceFile,
                pinned: false,
                archived: false,
                status: 'Alive',
                color: null,
            })
            result.notesCreated++

            // Link NPC to parent scene
            const parentSceneKey = meta['parentScene'] as string | null
            if (parentSceneKey) {
                const sceneId = keyToSceneId.get(parentSceneKey)
                if (sceneId) {
                    db.linkNPCToScene(sceneId, npc.id)
                    db.linkNoteToScene(sceneId, note.id)
                    result.linksCreated += 2
                }
            }
        } catch (err) {
            result.errors.push(`NPC "${extracted.title}": ${String(err)}`)
        }
    }

    // ── 3. Create items ──────────────────────────────────────────────────────

    for (const extracted of extraction.items) {
        if (!extracted.checked) continue
        try {
            const meta = extracted.metadata
            const item = db.createItem({
                campaignId,
                name: extracted.title,
                description: extracted.body || ((meta['description'] as string) ?? ''),
                rarity: (meta['rarity'] as Item['rarity']) ?? null,
                category: null, // parser doesn't extract category
                properties: (meta['properties'] as string[]) ?? [],
                tags: buildItemTags(meta),
                sourceNoteId: null,
            })

            result.itemsCreated++

            // Link item to parent scene
            const parentSceneKey = meta['parentScene'] as string | null
            if (parentSceneKey) {
                const sceneId = keyToSceneId.get(parentSceneKey)
                if (sceneId) {
                    db.linkItemToScene(sceneId, item.id)
                    result.linksCreated++
                }
            }
        } catch (err) {
            result.errors.push(`Item "${extracted.title}": ${String(err)}`)
        }
    }

    // ── 4. Create note-only entities (locations, factions, lore) ─────────────

    const noteCategories: Array<{
        label: string
        entities: ExtractedEntity[]
        type: NoteType
        tags: (meta: Record<string, unknown>) => string[]
        status: string | null
        linkToScene: boolean
    }> = [
        { label: 'Location', entities: extraction.locations, type: 'location', tags: () => [], status: null, linkToScene: true },
        { label: 'Faction', entities: extraction.factions, type: 'faction', tags: (m) => m['stub'] ? ['auto-generated'] : [], status: 'Active', linkToScene: false },
        { label: 'Lore', entities: extraction.lore, type: 'lore', tags: () => [], status: null, linkToScene: false },
    ]

    for (const category of noteCategories) {
        for (const extracted of category.entities) {
            if (!extracted.checked) continue
            try {
                const note = db.createNote({
                    campaignId,
                    title: extracted.title,
                    type: category.type,
                    body: extracted.body,
                    tags: category.tags(extracted.metadata),
                    sourceFile,
                    pinned: false,
                    archived: false,
                    status: category.status,
                    color: null,
                })
                result.notesCreated++

                if (category.linkToScene) {
                    const parentSceneKey = extracted.metadata['parentScene'] as string | null
                    if (parentSceneKey) {
                        const sceneId = keyToSceneId.get(parentSceneKey)
                        if (sceneId) {
                            db.linkNoteToScene(sceneId, note.id)
                            result.linksCreated++
                        }
                    }
                }
            } catch (err) {
                result.errors.push(`${category.label} "${extracted.title}": ${String(err)}`)
            }
        }
    }

    return result
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build tags array from NPC metadata */
function buildTags(meta: Record<string, unknown>): string[] {
    const tags: string[] = []
    if (meta['autoTag']) tags.push(String(meta['autoTag']))
    if (meta['combatant']) tags.push('combatant')
    if (meta['factionRef']) tags.push(String(meta['factionRef']))
    return tags
}

/** Build tags array from item metadata */
function buildItemTags(meta: Record<string, unknown>): string[] {
    const tags: string[] = []
    if (meta['sceneState']) tags.push(String(meta['sceneState']))
    const qty = meta['quantity'] as number | undefined
    if (qty && qty > 1) tags.push(`x${qty}`)
    return tags
}
