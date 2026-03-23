/**
 * Import Pipeline tests — Sprint 16b.
 * Uses mock DB functions to verify entity creation and linking.
 */
import { describe, it, expect, vi, type Mock } from 'vitest'
import type { ImportDB } from './import-pipeline'
import { runImportPipeline } from './import-pipeline'
import type { ExtractionResult, ExtractedEntity } from './document-parser'

// ── Mock DB ──────────────────────────────────────────────────────────────────

function createMockDB(): ImportDB & {
    scenes: Array<{ id: string; name: string; notes: string }>
    npcs: Array<{ id: string; name: string }>
    items: Array<{ id: string; name: string }>
    notes: Array<{ id: string; title: string; type: string }>
    sceneNPCLinks: Array<{ sceneId: string; npcId: string }>
    sceneNoteLinks: Array<{ sceneId: string; noteId: string }>
    sceneItemLinks: Array<{ sceneId: string; itemId: string }>
} {
    let nextId = 1
    const db = {
        scenes: [] as Array<{ id: string; name: string; notes: string }>,
        npcs: [] as Array<{ id: string; name: string }>,
        items: [] as Array<{ id: string; name: string }>,
        notes: [] as Array<{ id: string; title: string; type: string }>,
        sceneNPCLinks: [] as Array<{ sceneId: string; npcId: string }>,
        sceneNoteLinks: [] as Array<{ sceneId: string; noteId: string }>,
        sceneItemLinks: [] as Array<{ sceneId: string; itemId: string }>,

        createScene: vi.fn((data: Record<string, unknown>) => {
            const scene = { id: `scene-${nextId++}`, name: data.name, notes: data.notes }
            db.scenes.push(scene)
            return scene
        }),
        createNPC: vi.fn((data: Record<string, unknown>) => {
            const npc = { id: `npc-${nextId++}`, name: data.name }
            db.npcs.push(npc)
            return npc
        }),
        createItem: vi.fn((data: Record<string, unknown>) => {
            const item = { id: `item-${nextId++}`, name: data.name }
            db.items.push(item)
            return item
        }),
        createNote: vi.fn((data: Record<string, unknown>) => {
            const note = { id: `note-${nextId++}`, title: data.title, type: data.type }
            db.notes.push(note)
            return note
        }),
        linkNPCToScene: vi.fn((sceneId: string, npcId: string) => {
            db.sceneNPCLinks.push({ sceneId, npcId })
        }),
        linkNoteToScene: vi.fn((sceneId: string, noteId: string) => {
            db.sceneNoteLinks.push({ sceneId, noteId })
        }),
        linkItemToScene: vi.fn((sceneId: string, itemId: string) => {
            db.sceneItemLinks.push({ sceneId, itemId })
        }),
        updateCampaign: vi.fn(),
    }
    return db
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<ExtractedEntity>): ExtractedEntity {
    return {
        key: 'test-0-entity',
        title: 'Test Entity',
        type: 'general',
        body: '',
        metadata: {},
        sourceRange: [1, 1],
        relationships: [],
        checked: true,
        ...overrides,
    }
}

function emptyResult(): ExtractionResult {
    return { scenes: [], npcs: [], items: [], locations: [], factions: [], lore: [], total: 0 }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runImportPipeline', () => {
    it('returns zeroes for empty extraction', () => {
        const db = createMockDB()
        const result = runImportPipeline(emptyResult(), 'camp-1', db)

        expect(result.scenesCreated).toBe(0)
        expect(result.npcsCreated).toBe(0)
        expect(result.itemsCreated).toBe(0)
        expect(result.notesCreated).toBe(0)
        expect(result.linksCreated).toBe(0)
        expect(result.errors).toEqual([])
    })

    describe('scenes', () => {
        it('creates scenes from extraction', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.scenes = [
                makeEntity({ key: 'scene-0-tomb', title: 'Scene 1: The Lost Tomb', type: 'scene', body: 'A dark tomb.', metadata: { sceneNumber: 1 } }),
                makeEntity({ key: 'scene-1-forest', title: 'Scene 2: The Forest', type: 'scene', body: 'Dense trees.', metadata: { sceneNumber: 2 } }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.scenesCreated).toBe(2)
            expect(db.scenes.length).toBe(2)
            expect(db.scenes[0]!.name).toBe('Scene 1: The Lost Tomb')
            expect(db.scenes[1]!.name).toBe('Scene 2: The Forest')
        })

        it('sorts scenes by sceneNumber', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.scenes = [
                makeEntity({ key: 'scene-1-b', title: 'Scene 3: Last', type: 'scene', metadata: { sceneNumber: 3 } }),
                makeEntity({ key: 'scene-0-a', title: 'Scene 1: First', type: 'scene', metadata: { sceneNumber: 1 } }),
            ]

            runImportPipeline(extraction, 'camp-1', db)

            expect(db.scenes[0]!.name).toBe('Scene 1: First')
            expect(db.scenes[1]!.name).toBe('Scene 3: Last')
        })

        it('skips unchecked scenes', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.scenes = [
                makeEntity({ key: 'scene-0-a', title: 'Scene 1', type: 'scene', checked: false, metadata: { sceneNumber: 1 } }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)
            expect(result.scenesCreated).toBe(0)
        })

        it('stores scene body as notes field', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.scenes = [
                makeEntity({ key: 'scene-0-a', title: 'Scene 1: Test', type: 'scene', body: 'DM notes here.', metadata: { sceneNumber: 1 } }),
            ]

            runImportPipeline(extraction, 'camp-1', db)
            expect(db.scenes[0]!.notes).toBe('DM notes here.')
        })
    })

    describe('NPCs', () => {
        it('creates NPC records and NPC-typed notes', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.npcs = [
                makeEntity({
                    key: 'npc-0-voss',
                    title: 'Elder Voss',
                    type: 'npc',
                    body: 'A wise elder.',
                    metadata: { description: 'Sharp eyes.', combatant: false, autoTag: null },
                }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.npcsCreated).toBe(1)
            expect(result.notesCreated).toBe(1)
            expect(db.npcs[0]!.name).toBe('Elder Voss')
            expect(db.notes[0]!.title).toBe('Elder Voss')
            expect(db.notes[0]!.type).toBe('npc')
        })

        it('links NPC to parent scene', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.scenes = [
                makeEntity({ key: 'scene-0-tomb', title: 'Scene 1: Tomb', type: 'scene', metadata: { sceneNumber: 1 } }),
            ]
            extraction.npcs = [
                makeEntity({
                    key: 'npc-0-guard',
                    title: 'Guard',
                    type: 'npc',
                    metadata: { parentScene: 'scene-0-tomb', combatant: true, autoTag: 'enemy' },
                }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.linksCreated).toBe(2) // NPC link + note link
            expect(db.sceneNPCLinks.length).toBe(1)
            expect(db.sceneNPCLinks[0]!.sceneId).toBe(db.scenes[0]!.id)
            expect(db.sceneNPCLinks[0]!.npcId).toBe(db.npcs[0]!.id)
            expect(db.sceneNoteLinks.length).toBe(1)
        })

        it('tags combatants and faction refs', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.npcs = [
                makeEntity({
                    key: 'npc-0-rem',
                    title: 'Silas Rem',
                    type: 'npc',
                    metadata: { combatant: true, autoTag: 'enemy', factionRef: 'Iron Compact' },
                }),
            ]

            runImportPipeline(extraction, 'camp-1', db)

            const noteCall = (db.createNote as Mock).mock.calls[0][0]
            expect(noteCall.tags).toContain('enemy')
            expect(noteCall.tags).toContain('combatant')
            expect(noteCall.tags).toContain('Iron Compact')
        })
    })

    describe('items', () => {
        it('creates items with rarity and properties', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.items = [
                makeEntity({
                    key: 'item-0-sword',
                    title: 'Flame Tongue',
                    type: 'item',
                    body: 'A flaming sword.',
                    metadata: { rarity: 'rare', properties: ['attunement'], sceneState: 'loot', quantity: 1 },
                }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.itemsCreated).toBe(1)
            const itemCall = (db.createItem as Mock).mock.calls[0][0]
            expect(itemCall.name).toBe('Flame Tongue')
            expect(itemCall.rarity).toBe('rare')
            expect(itemCall.properties).toEqual(['attunement'])
        })

        it('links item to parent scene', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.scenes = [
                makeEntity({ key: 'scene-0-tomb', title: 'Scene 1', type: 'scene', metadata: { sceneNumber: 1 } }),
            ]
            extraction.items = [
                makeEntity({
                    key: 'item-0-potion',
                    title: 'Healing Potion',
                    type: 'item',
                    metadata: { parentScene: 'scene-0-tomb', quantity: 5, sceneState: 'loot' },
                }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.linksCreated).toBe(1)
            expect(db.sceneItemLinks.length).toBe(1)
            expect(db.sceneItemLinks[0]!.sceneId).toBe(db.scenes[0]!.id)
        })

        it('tags items with scene state and quantity', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.items = [
                makeEntity({
                    key: 'item-0-rations',
                    title: 'Rations',
                    type: 'item',
                    metadata: { sceneState: 'loot', quantity: 10 },
                }),
            ]

            runImportPipeline(extraction, 'camp-1', db)

            const itemCall = (db.createItem as Mock).mock.calls[0][0]
            expect(itemCall.tags).toContain('loot')
            expect(itemCall.tags).toContain('x10')
        })
    })

    describe('locations', () => {
        it('creates location notes linked to parent scene', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.scenes = [
                makeEntity({ key: 'scene-0-town', title: 'Scene 1', type: 'scene', metadata: { sceneNumber: 1 } }),
            ]
            extraction.locations = [
                makeEntity({
                    key: 'loc-0-market',
                    title: 'The Market',
                    type: 'location',
                    body: 'A bustling market.',
                    metadata: { parentScene: 'scene-0-town' },
                }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.notesCreated).toBe(1)
            expect(result.linksCreated).toBe(1)
            expect(db.notes[0]!.type).toBe('location')
            expect(db.sceneNoteLinks.length).toBe(1)
        })
    })

    describe('factions', () => {
        it('creates faction notes', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.factions = [
                makeEntity({ key: 'faction-0-iron', title: 'The Iron Compact', type: 'faction', body: 'Techno-mercantilists.' }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.notesCreated).toBe(1)
            expect(db.notes[0]!.type).toBe('faction')
            const noteCall = (db.createNote as Mock).mock.calls[0][0]
            expect(noteCall.status).toBe('Active')
        })

        it('tags stub factions as auto-generated', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.factions = [
                makeEntity({ key: 'faction-0-stub', title: 'Unknown Faction', type: 'faction', metadata: { stub: true } }),
            ]

            runImportPipeline(extraction, 'camp-1', db)

            const noteCall = (db.createNote as Mock).mock.calls[0][0]
            expect(noteCall.tags).toContain('auto-generated')
        })
    })

    describe('lore', () => {
        it('creates lore notes', () => {
            const db = createMockDB()
            const extraction = emptyResult()
            extraction.lore = [
                makeEntity({ key: 'lore-0-fracture', title: 'The Fracture', type: 'lore', body: 'The catastrophic event.' }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.notesCreated).toBe(1)
            expect(db.notes[0]!.type).toBe('lore')
        })
    })

    describe('error handling', () => {
        it('catches and records DB errors without stopping', () => {
            const db = createMockDB()
            db.createScene = vi.fn(() => { throw new Error('DB full') })

            const extraction = emptyResult()
            extraction.scenes = [
                makeEntity({ key: 'scene-0-a', title: 'Scene 1', type: 'scene', metadata: { sceneNumber: 1 } }),
            ]
            extraction.lore = [
                makeEntity({ key: 'lore-0-a', title: 'Some Lore', type: 'lore' }),
            ]

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.scenesCreated).toBe(0)
            expect(result.errors.length).toBe(1)
            expect(result.errors[0]).toContain('Scene "Scene 1"')
            // Lore should still succeed
            expect(result.notesCreated).toBe(1)
        })
    })

    describe('integration — full document', () => {
        it('creates all entities and links from a complete extraction', () => {
            const db = createMockDB()
            const extraction: ExtractionResult = {
                scenes: [
                    makeEntity({ key: 'scene-0-rust', title: 'Scene 1: Rusthollow', type: 'scene', body: 'A town.', metadata: { sceneNumber: 1 } }),
                    makeEntity({ key: 'scene-1-dying', title: 'Scene 2: The Dying Man', type: 'scene', body: 'A scavenger.', metadata: { sceneNumber: 2 } }),
                ],
                npcs: [
                    makeEntity({ key: 'npc-0-voss', title: 'Elder Voss', type: 'npc', body: 'Wise elder.', metadata: { parentScene: 'scene-0-rust', combatant: false } }),
                    makeEntity({ key: 'npc-1-cael', title: 'Cael Dorn', type: 'npc', body: 'Dying man.', metadata: { parentScene: 'scene-1-dying', combatant: false } }),
                ],
                items: [
                    makeEntity({ key: 'item-0-flask', title: "Dara's Flask", type: 'item', metadata: { parentScene: 'scene-0-rust', rarity: 'uncommon', sceneState: 'placed' } }),
                    makeEntity({ key: 'item-1-chip', title: 'The Data Chip', type: 'item', metadata: { parentScene: 'scene-1-dying', sceneState: 'quest' } }),
                ],
                locations: [
                    makeEntity({ key: 'loc-0-market', title: 'The Market', type: 'location', body: 'Bustling.', metadata: { parentScene: 'scene-0-rust' } }),
                ],
                factions: [
                    makeEntity({ key: 'faction-0-iron', title: 'The Iron Compact', type: 'faction', body: 'Mercantilists.' }),
                ],
                lore: [
                    makeEntity({ key: 'lore-0-fracture', title: 'The Fracture', type: 'lore', body: 'The catastrophe.' }),
                ],
                total: 9,
            }

            const result = runImportPipeline(extraction, 'camp-1', db)

            expect(result.scenesCreated).toBe(2)
            expect(result.npcsCreated).toBe(2)
            expect(result.itemsCreated).toBe(2)
            expect(result.notesCreated).toBe(5) // 2 NPC notes + 1 location + 1 faction + 1 lore
            expect(result.errors).toEqual([])

            // NPC links: 2 NPCs × (1 NPC link + 1 note link) = 4
            // Item links: 2 items × 1 = 2
            // Location links: 1
            expect(result.linksCreated).toBe(7)

            expect(db.sceneNPCLinks.length).toBe(2)
            expect(db.sceneItemLinks.length).toBe(2)
            expect(db.sceneNoteLinks.length).toBe(3) // 2 NPC notes + 1 location
        })
    })
})
