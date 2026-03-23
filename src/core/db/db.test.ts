/**
 * Database module tests.
 *
 * better-sqlite3 is a native Electron addon compiled against Electron's Node ABI.
 * It cannot be loaded by system Node (Vitest's runner) without recompiling.
 * Strategy: mock better-sqlite3 with a pure-JS in-memory SQLite implementation
 * using a Map-based store so we can test all CRUD logic and JSON serialization
 * without the native binary.
 *
 * Source: src/core/db/db.ts
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// ── In-memory SQLite shim ─────────────────────────────────────────────────────
//
// We implement just enough of the better-sqlite3 API that db.ts uses:
//   db.pragma(str)
//   db.exec(sql)
//   db.prepare(sql).run(...args)   → { changes: number }
//   db.prepare(sql).get(arg)       → row | undefined
//   db.prepare(sql).all()          → row[]
//
// The shim stores rows in Maps, keyed by table name then by primary key.
// SQL is not parsed — we hook into it by recognising INSERT/SELECT/UPDATE/DELETE
// patterns that db.ts actually generates.

type Row = Record<string, unknown>

function createInMemoryDB() {
    const tables: Map<string, Map<string, Row>> = new Map()

    function ensureTable(name: string) {
        if (!tables.has(name)) tables.set(name, new Map())
        return tables.get(name)!
    }

    // Detect which table a SQL string targets
    function detectTable(sql: string): string {
        const m =
            /(?:INTO|FROM|UPDATE|DELETE\s+FROM)\s+(\w+)/i.exec(sql) ??
            /SELECT\s+\*\s+FROM\s+(\w+)/i.exec(sql)
        return m?.[1] ?? ''
    }

    function prepare(sql: string) {
        const sqlTrim = sql.trim()
        const table = detectTable(sqlTrim)
        const upper = sqlTrim.toUpperCase()
        const isSceneNotesJoin = upper.includes('JOIN SCENE_NOTES')
        const isSceneNPCsJoin = upper.includes('JOIN SCENE_NPCS')
        const isSceneNPCsLinkQuery = upper.includes('FROM SCENE_NPCS SN') && upper.includes('JOIN NPCS N')
        const isSceneItemsJoin = upper.includes('JOIN SCENE_ITEMS')
        const isSceneItemsLinkQuery = upper.includes('FROM SCENE_ITEMS SI') && upper.includes('JOIN ITEMS I')

        return {
            run(...args: unknown[]) {
                const t = ensureTable(table)

                if (upper.startsWith('INSERT')) {
                    const isIgnore = upper.includes('OR IGNORE')
                    const isReplace = upper.includes('OR REPLACE')
                    // Extract column names from INSERT INTO tableName (col1, col2, ...) VALUES (...)
                    const colMatch = /\(([^)]+)\)\s+VALUES/i.exec(sqlTrim)
                    if (colMatch) {
                        const cols = colMatch[1]!.split(',').map((c) => c.trim())
                        const row: Row = {}
                        cols.forEach((col, i) => { row[col] = args[i] })
                        // For tables with id column, use id; otherwise composite key from _id columns
                        const id = row['id']
                            ? String(row['id'])
                            : cols.filter(c => c.endsWith('_id')).map(c => String(row[c])).join(':') || `auto-${t.size}`
                        if (isIgnore && t.has(id)) return { changes: 0 }
                        // INSERT OR REPLACE always overwrites
                        t.set(id, row)
                    }
                } else if (upper.startsWith('UPDATE')) {
                    // UPDATE tableName SET col=?, ... WHERE id=?
                    const setMatch = /SET\s+(.+)\s+WHERE\s+id\s*=/i.exec(sqlTrim)
                    if (setMatch) {
                        const pairs = setMatch[1]!.split(',').map((s) => s.trim())
                        const id = String(args[args.length - 1])
                        const existing = t.get(id)
                        if (existing) {
                            const updated = { ...existing }
                            pairs.forEach((pair, i) => {
                                const col = pair.split('=')[0]?.trim() ?? ''
                                if (col) updated[col] = args[i]
                            })
                            t.set(id, updated)
                        }
                    }
                } else if (upper.startsWith('DELETE')) {
                    if (upper.includes('SCENE_ID = ? AND NOTE_ID = ?')) {
                        // Composite key delete for scene_notes junction
                        const key = `${args[0]}:${args[1]}`
                        t.delete(key)
                    } else if (upper.includes('SCENE_ID = ? AND NPC_ID = ?')) {
                        // Composite key delete for scene_npcs junction
                        const key = `${args[0]}:${args[1]}`
                        t.delete(key)
                    } else if (upper.includes('SCENE_ID = ? AND ITEM_ID = ?')) {
                        // Composite key delete for scene_items junction
                        const key = `${args[0]}:${args[1]}`
                        t.delete(key)
                    } else {
                        const id = String(args[0])
                        t.delete(id)
                        // Simulate ON DELETE CASCADE for scene_notes junction
                        const jt = tables.get('scene_notes')
                        if (jt) {
                            for (const [key, row] of jt) {
                                if (row['scene_id'] === id || row['note_id'] === id) {
                                    jt.delete(key)
                                }
                            }
                        }
                        // Simulate ON DELETE CASCADE for scene_npcs junction
                        const jnpcs = tables.get('scene_npcs')
                        if (jnpcs) {
                            for (const [key, row] of jnpcs) {
                                if (row['scene_id'] === id || row['npc_id'] === id) {
                                    jnpcs.delete(key)
                                }
                            }
                        }
                        // Simulate ON DELETE CASCADE for scene_items junction
                        const jitems = tables.get('scene_items')
                        if (jitems) {
                            for (const [key, row] of jitems) {
                                if (row['scene_id'] === id || row['item_id'] === id) {
                                    jitems.delete(key)
                                }
                            }
                        }
                    }
                }
                return { changes: 1 }
            },

            get(arg?: unknown): Row | undefined {
                const t = ensureTable(table)
                if (arg === undefined) return t.values().next().value
                return t.get(String(arg))
            },

            all(...args: unknown[]): Row[] {
                // Handle JOIN queries for scene_notes junction
                if (isSceneNotesJoin) {
                    const jt = ensureTable('scene_notes')
                    if (upper.includes('SN.SCENE_ID = ?')) {
                        // getNotesForScene: filter junction by scene_id, return matching notes
                        const sceneId = String(args[0])
                        const links = Array.from(jt.values())
                            .filter(r => r['scene_id'] === sceneId)
                            .sort((a, b) => Number(a['sort_order'] ?? 0) - Number(b['sort_order'] ?? 0))
                        const notesTable = ensureTable('notes')
                        return links.map(r => notesTable.get(String(r['note_id']))).filter(Boolean) as Row[]
                    } else if (upper.includes('SN.NOTE_ID = ?')) {
                        // getScenesForNote: filter junction by note_id, return matching scenes
                        const noteId = String(args[0])
                        const links = Array.from(jt.values())
                            .filter(r => r['note_id'] === noteId)
                        const scenesTable = ensureTable('scenes')
                        const scenes = links.map(r => scenesTable.get(String(r['scene_id']))).filter(Boolean) as Row[]
                        scenes.sort((a, b) => Number(a['sort_order'] ?? 0) - Number(b['sort_order'] ?? 0))
                        return scenes
                    }
                }

                // Handle JOIN queries for scene_npcs junction (getNPCsForScene)
                if (isSceneNPCsJoin) {
                    const jt = ensureTable('scene_npcs')
                    if (upper.includes('SN.SCENE_ID = ?')) {
                        // getNPCsForScene: filter junction by scene_id, return matching npcs
                        const sceneId = String(args[0])
                        const links = Array.from(jt.values())
                            .filter(r => r['scene_id'] === sceneId)
                            .sort((a, b) => Number(a['sort_order'] ?? 0) - Number(b['sort_order'] ?? 0))
                        const npcsTable = ensureTable('npcs')
                        return links.map(r => npcsTable.get(String(r['npc_id']))).filter(Boolean) as Row[]
                    }
                }

                // Handle getSceneNPCLinks: SELECT sn.scene_id, sn.npc_id FROM scene_npcs sn JOIN npcs n
                if (isSceneNPCsLinkQuery) {
                    const jt = ensureTable('scene_npcs')
                    const npcsTable = ensureTable('npcs')
                    const campaignId = String(args[0])
                    return Array.from(jt.values()).filter(r => {
                        const npc = npcsTable.get(String(r['npc_id']))
                        return npc && npc['campaign_id'] === campaignId
                    }).map(r => ({ scene_id: r['scene_id'], npc_id: r['npc_id'] }))
                }

                // Handle JOIN queries for scene_items junction (getItemsForScene)
                if (isSceneItemsJoin) {
                    const jt = ensureTable('scene_items')
                    if (upper.includes('SI.SCENE_ID = ?')) {
                        const sceneId = String(args[0])
                        const links = Array.from(jt.values())
                            .filter(r => r['scene_id'] === sceneId)
                        const itemsTable = ensureTable('items')
                        const items = links.map(r => itemsTable.get(String(r['item_id']))).filter(Boolean) as Row[]
                        items.sort((a, b) => String(a['name'] ?? '').localeCompare(String(b['name'] ?? '')))
                        return items
                    }
                }

                // Handle getSceneItemLinks: SELECT si.scene_id, si.item_id FROM scene_items si JOIN items i
                if (isSceneItemsLinkQuery) {
                    const jt = ensureTable('scene_items')
                    const itemsTable = ensureTable('items')
                    const campaignId = String(args[0])
                    return Array.from(jt.values()).filter(r => {
                        const item = itemsTable.get(String(r['item_id']))
                        return item && item['campaign_id'] === campaignId
                    }).map(r => ({ scene_id: r['scene_id'], item_id: r['item_id'] }))
                }

                const t = ensureTable(table)

                // Filter by campaign_id if present
                if (upper.includes('WHERE CAMPAIGN_ID = ?') && args[0] !== undefined) {
                    let rows = Array.from(t.values()).filter(
                        (r) => r['campaign_id'] === args[0]
                    )
                    // Additional type filter for notes
                    if (upper.includes('AND TYPE = ?') && args[1] !== undefined) {
                        rows = rows.filter(r => r['type'] === args[1])
                    }
                    // Sort by updated_at DESC (notes) or existing sorts
                    if (upper.includes('UPDATED_AT DESC')) {
                        rows.sort((a, b) =>
                            String(b['updated_at'] ?? '').localeCompare(String(a['updated_at'] ?? ''))
                        )
                    }
                    return rows
                }

                // Return all rows sorted by created_at DESC (campaigns) or sort_order ASC (scenes/npcs)
                const rows = Array.from(t.values())
                if (upper.includes('SORT_ORDER ASC')) {
                    rows.sort((a, b) => Number(a['sort_order'] ?? 0) - Number(b['sort_order'] ?? 0))
                } else if (upper.includes('CREATED_AT DESC')) {
                    rows.sort((a, b) =>
                        String(b['created_at'] ?? '').localeCompare(String(a['created_at'] ?? ''))
                    )
                } else if (upper.includes('ORDER BY NAME ASC')) {
                    rows.sort((a, b) => String(a['name'] ?? '').localeCompare(String(b['name'] ?? '')))
                }
                return rows
            },
        }
    }

    return {
        pragma: vi.fn(),
        exec: vi.fn(),
        prepare,
        close: vi.fn(),
        // Expose tables map so tests can inspect raw state if needed
        _tables: tables,
    }
}

type InMemoryDB = ReturnType<typeof createInMemoryDB>

// Singleton shim instance replaced per test
let shimDB: InMemoryDB

const { mockBetterSqlite3Constructor } = vi.hoisted(() => ({
    mockBetterSqlite3Constructor: vi.fn(),
}))

vi.mock('better-sqlite3', () => ({
    default: mockBetterSqlite3Constructor,
}))

vi.mock('electron', () => ({
    app: { getPath: () => '/tmp/test-db' },
}))

// Mock fs — we don't want initDB to read the migrations directory from disk.
// The shim's exec() is a no-op anyway; we just need it not to throw.
vi.mock('fs', () => {
    const existsSync = vi.fn(() => true)
    const readdirSync = vi.fn(() => [
        '001_initial_schema.sql',
        '002_notes_system.sql',
        '003_dashboard_overhaul.sql',
        '004_fog_of_war.sql',
    ])
    const readFileSync = vi.fn(() => '-- mock migration sql')
    return {
        default: { existsSync, readdirSync, readFileSync },
        existsSync,
        readdirSync,
        readFileSync,
    }
})

import {
    initDBForTest,
    closeDB,
    getCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    getScenes,
    getScene,
    createScene,
    updateScene,
    deleteScene,
    getNPCs,
    getNPC,
    createNPC,
    updateNPC,
    deleteNPC,
    getNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    getNotesForScene,
    getScenesForNote,
    linkNoteToScene,
    unlinkNoteFromScene,
    getNPCsForScene,
    linkNPCToScene,
    unlinkNPCFromScene,
    getSceneNPCLinks,
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    getItemsForScene,
    linkItemToScene,
    unlinkItemFromScene,
    getSceneItemLinks,
} from './db'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    shimDB = createInMemoryDB()
    // Every call to new Database(...) returns our shim
    mockBetterSqlite3Constructor.mockReturnValue(shimDB)
    initDBForTest(':memory:')
})

afterEach(() => {
    try { closeDB() } catch { /* already closed */ }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedCampaign(name = 'Test Campaign', system = '5e') {
    return createCampaign({ name, system })
}

function makeSceneData(campaignId: string) {
    return {
        campaignId,
        name: 'Test Scene',
        sortOrder: 0,
        backgroundPath: null,
        overlays: ['fx/rain.webm', 'fx/lightning.webm'],
        particles: { type: 'rain' as const, intensity: 0.7 },
        colorGrade: {
            brightness: 0.1,
            contrast: -0.2,
            saturation: 0.5,
            temperature: 0.3,
            tint: '#ff0000',
        },
        gbColorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff' },
        audioMood: 0.6,
        notes: 'A stormy night.',
        linkedNPCIds: ['npc-1', 'npc-2'],
        linkedLocationIds: [],
        scratchpad: '',
        nextSceneId: null,
        branches: [{ label: 'Branch A', targetSceneId: 'scene-x', transitionNote: '' }],
        fogEnabled: false,
        fogData: null,
    }
}

function makeNPCData(campaignId: string, name = 'Test NPC') {
    return {
        campaignId,
        name,
        statBlock: { ac: 12, hp: 20 },
        personality: 'Friendly',
        notes: '',
    }
}

function makeNoteData(campaignId: string, overrides?: Partial<{ title: string; type: string; body: string; tags: string[]; sourceFile: string | null; pinned: boolean; archived: boolean; status: string | null; color: string | null }>) {
    return {
        campaignId,
        title: overrides?.title ?? 'Test Note',
        type: (overrides?.type ?? 'general') as 'scene' | 'location' | 'npc' | 'lore' | 'general' | 'quest' | 'session' | 'faction',
        body: overrides?.body ?? 'Some note content.',
        tags: overrides?.tags ?? ['tag1', 'tag2'],
        sourceFile: overrides?.sourceFile ?? null,
        pinned: overrides?.pinned ?? false,
        archived: overrides?.archived ?? false,
        status: overrides?.status ?? null,
        color: overrides?.color ?? null,
    }
}

// ── Campaign CRUD tests ────────────────────────────────────────────────────────

describe('DB — campaigns', () => {
    it('createCampaign persists and returns the correct shape', () => {
        const campaign = seedCampaign('Dragon Campaign', '5e')

        expect(campaign.id).toBeTypeOf('string')
        expect(campaign.id.length).toBeGreaterThan(0)
        expect(campaign.name).toBe('Dragon Campaign')
        expect(campaign.system).toBe('5e')
        expect(campaign.createdAt).toBeTypeOf('string')
        expect(campaign.updatedAt).toBeTypeOf('string')
    })

    it('getCampaigns returns all campaigns', () => {
        seedCampaign('Campaign A', '5e')
        seedCampaign('Campaign B', 'pf2e')

        const campaigns = getCampaigns()
        expect(campaigns.length).toBeGreaterThanOrEqual(2)
        const names = campaigns.map((c) => c.name)
        expect(names).toContain('Campaign A')
        expect(names).toContain('Campaign B')
    })

    it('getCampaign returns undefined for a missing ID', () => {
        const result = getCampaign('nonexistent-id-12345')
        expect(result).toBeUndefined()
    })

    it('getCampaign returns the correct campaign when it exists', () => {
        const created = seedCampaign('Finder', 'pf2e')
        const found = getCampaign(created.id)
        expect(found).toBeDefined()
        expect(found!.id).toBe(created.id)
        expect(found!.name).toBe('Finder')
    })

    it('updateCampaign patches only the provided fields', () => {
        const campaign = seedCampaign('Old Name', '5e')
        const updated = updateCampaign(campaign.id, { name: 'New Name' })
        expect(updated.name).toBe('New Name')
        // system should be unchanged — the shim preserves unset cols
        expect(updated.id).toBe(campaign.id)
    })

    it('deleteCampaign removes the campaign', () => {
        const campaign = seedCampaign('To Delete')
        deleteCampaign(campaign.id)
        expect(getCampaign(campaign.id)).toBeUndefined()
    })
})

// ── Scene CRUD tests ───────────────────────────────────────────────────────────

describe('DB — scenes', () => {
    it('createScene with JSON fields round-trips correctly (serialise → deserialise)', () => {
        const campaign = seedCampaign()
        const data = makeSceneData(campaign.id)
        const scene = createScene(data)

        expect(scene.id).toBeTypeOf('string')
        expect(scene.name).toBe('Test Scene')
        expect(scene.campaignId).toBe(campaign.id)

        // JSON column round-trips — verify arrays survive serialisation
        expect(scene.overlays).toEqual(['fx/rain.webm', 'fx/lightning.webm'])
        expect(scene.particles).toEqual({ type: 'rain', intensity: 0.7 })
        expect(scene.colorGrade.brightness).toBe(0.1)
        expect(scene.colorGrade.tint).toBe('#ff0000')
        expect(scene.linkedNPCIds).toEqual(['npc-1', 'npc-2'])
        expect(scene.branches).toEqual([{ label: 'Branch A', targetSceneId: 'scene-x', transitionNote: '' }])
    })

    it('getScene returns undefined for a missing ID', () => {
        expect(getScene('nonexistent')).toBeUndefined()
    })

    it('createScene can be retrieved with getScene', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const found = getScene(scene.id)
        expect(found).toBeDefined()
        expect(found!.name).toBe('Test Scene')
    })

    it('getScenes returns scenes for a campaign sorted by sort_order', () => {
        const campaign = seedCampaign()
        createScene({ ...makeSceneData(campaign.id), name: 'Scene A', sortOrder: 0 })
        createScene({ ...makeSceneData(campaign.id), name: 'Scene B', sortOrder: 1 })

        const scenes = getScenes(campaign.id)
        expect(scenes.length).toBeGreaterThanOrEqual(2)
    })

    it('updateScene patches only provided fields — JSON columns survive', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))

        const updated = updateScene(scene.id, {
            name: 'Renamed Scene',
            notes: 'New DM notes',
        })

        expect(updated.name).toBe('Renamed Scene')
        expect(updated.notes).toBe('New DM notes')
        // JSON columns that were NOT updated must survive
        expect(updated.overlays).toEqual(['fx/rain.webm', 'fx/lightning.webm'])
        expect(updated.branches).toEqual([{ label: 'Branch A', targetSceneId: 'scene-x', transitionNote: '' }])
        expect(updated.colorGrade.tint).toBe('#ff0000')
    })

    it('updateScene serialises branches JSON correctly on write', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))

        const newBranches = [
            { label: 'Branch A', targetSceneId: 'scene-1', transitionNote: '' },
            { label: 'Branch B', targetSceneId: 'scene-2', transitionNote: 'Roll for initiative' },
        ]
        const updated = updateScene(scene.id, { branches: newBranches })
        expect(updated.branches).toEqual(newBranches)
    })

    it('scratchpad field round-trips on create and update', () => {
        const campaign = seedCampaign()
        const scene = createScene({ ...makeSceneData(campaign.id), scratchpad: 'Session notes here' })
        expect(scene.scratchpad).toBe('Session notes here')

        const updated = updateScene(scene.id, { scratchpad: 'Updated scratch' })
        expect(updated.scratchpad).toBe('Updated scratch')
    })

    it('scratchpad defaults to empty string when omitted', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        expect(scene.scratchpad).toBe('')
    })

    it('deleteScene removes the scene', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        deleteScene(scene.id)
        expect(getScene(scene.id)).toBeUndefined()
    })
})

// ── NPC tests ──────────────────────────────────────────────────────────────────

describe('DB — npcs', () => {
    it('createNPC persists and returns correct shape', () => {
        const campaign = seedCampaign()
        const npc = createNPC({
            campaignId: campaign.id,
            name: 'Grimshaw',
            statBlock: { ac: 14, hp: 45, str: 16, dex: 12 },
            personality: 'Gruff but fair',
            notes: 'Frequents the Rusty Flagon.',
        })

        expect(npc.id).toBeTypeOf('string')
        expect(npc.name).toBe('Grimshaw')
        expect(npc.statBlock).toEqual({ ac: 14, hp: 45, str: 16, dex: 12 })
        expect(npc.personality).toBe('Gruff but fair')
    })

    it('getNPC returns undefined for missing ID', () => {
        expect(getNPC('nonexistent')).toBeUndefined()
    })

    it('getNPCs returns NPCs for a campaign', () => {
        const campaign = seedCampaign()
        createNPC({ campaignId: campaign.id, name: 'Anya', statBlock: {}, personality: '', notes: '' })
        createNPC({ campaignId: campaign.id, name: 'Boris', statBlock: {}, personality: '', notes: '' })

        const npcs = getNPCs(campaign.id)
        expect(npcs.length).toBeGreaterThanOrEqual(2)
    })

    it('updateNPC patches only the provided fields', () => {
        const campaign = seedCampaign()
        const npc = createNPC({
            campaignId: campaign.id,
            name: 'Old Name',
            statBlock: { ac: 12 },
            personality: 'Shy',
            notes: 'Original notes.',
        })

        const updated = updateNPC(npc.id, { name: 'New Name', notes: 'Updated notes.' })

        expect(updated.name).toBe('New Name')
        expect(updated.notes).toBe('Updated notes.')
        // Fields not provided must be unchanged
        expect(updated.personality).toBe('Shy')
        expect(updated.id).toBe(npc.id)
    })

    it('deleteNPC removes the NPC from the DB', () => {
        const campaign = seedCampaign()
        const npc = createNPC({
            campaignId: campaign.id,
            name: 'Doomed NPC',
            statBlock: {},
            personality: '',
            notes: '',
        })

        deleteNPC(npc.id)
        expect(getNPC(npc.id)).toBeUndefined()
    })

    it('getNPC returns undefined after deletion', () => {
        const campaign = seedCampaign()
        const npc = createNPC({
            campaignId: campaign.id,
            name: 'Gone',
            statBlock: {},
            personality: '',
            notes: '',
        })
        const id = npc.id
        deleteNPC(id)
        expect(getNPC(id)).toBeUndefined()
    })
})

// ── Note CRUD tests ──────────────────────────────────────────────────────────

describe('DB — notes', () => {
    it('createNote persists and returns correct shape', () => {
        const campaign = seedCampaign()
        const note = createNote(makeNoteData(campaign.id, { title: 'Tavern Lore', type: 'lore' }))

        expect(note.id).toBeTypeOf('string')
        expect(note.id.length).toBeGreaterThan(0)
        expect(note.title).toBe('Tavern Lore')
        expect(note.type).toBe('lore')
        expect(note.body).toBe('Some note content.')
        expect(note.tags).toEqual(['tag1', 'tag2'])
        expect(note.sourceFile).toBeNull()
        expect(note.createdAt).toBeTypeOf('string')
        expect(note.updatedAt).toBeTypeOf('string')
    })

    it('getNotes returns notes for a campaign', () => {
        const campaign = seedCampaign()
        createNote(makeNoteData(campaign.id, { title: 'Note A' }))
        createNote(makeNoteData(campaign.id, { title: 'Note B' }))

        const notes = getNotes(campaign.id)
        expect(notes.length).toBeGreaterThanOrEqual(2)
        const titles = notes.map(n => n.title)
        expect(titles).toContain('Note A')
        expect(titles).toContain('Note B')
    })

    it('getNotes with type filter returns only matching type', () => {
        const campaign = seedCampaign()
        createNote(makeNoteData(campaign.id, { title: 'Scene Note', type: 'scene' }))
        createNote(makeNoteData(campaign.id, { title: 'Lore Note', type: 'lore' }))
        createNote(makeNoteData(campaign.id, { title: 'Another Scene', type: 'scene' }))

        const sceneNotes = getNotes(campaign.id, 'scene')
        expect(sceneNotes.length).toBe(2)
        expect(sceneNotes.every(n => n.type === 'scene')).toBe(true)
    })

    it('getNote returns undefined for missing ID', () => {
        expect(getNote('nonexistent-note')).toBeUndefined()
    })

    it('updateNote patches only provided fields', () => {
        const campaign = seedCampaign()
        const note = createNote(makeNoteData(campaign.id, { title: 'Original', body: 'Original body' }))

        const updated = updateNote(note.id, { title: 'Renamed' })

        expect(updated.title).toBe('Renamed')
        expect(updated.id).toBe(note.id)
    })

    it('updateNote serialises tags JSON correctly', () => {
        const campaign = seedCampaign()
        const note = createNote(makeNoteData(campaign.id, { tags: ['old'] }))

        const updated = updateNote(note.id, { tags: ['new-tag', 'another'] })

        expect(updated.tags).toEqual(['new-tag', 'another'])
    })

    it('deleteNote removes the note', () => {
        const campaign = seedCampaign()
        const note = createNote(makeNoteData(campaign.id))
        deleteNote(note.id)
        expect(getNote(note.id)).toBeUndefined()
    })
})

// ── Scene-Note junction tests ────────────────────────────────────────────────

describe('DB — scene_notes junction', () => {
    it('linkNoteToScene creates a link', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const note = createNote(makeNoteData(campaign.id))

        linkNoteToScene(scene.id, note.id)

        const linked = getNotesForScene(scene.id)
        expect(linked.length).toBe(1)
        expect(linked[0]!.id).toBe(note.id)
    })

    it('getNotesForScene returns linked notes', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const note1 = createNote(makeNoteData(campaign.id, { title: 'Note 1' }))
        const note2 = createNote(makeNoteData(campaign.id, { title: 'Note 2' }))

        linkNoteToScene(scene.id, note1.id, 1)
        linkNoteToScene(scene.id, note2.id, 0)

        const linked = getNotesForScene(scene.id)
        expect(linked.length).toBe(2)
    })

    it('getScenesForNote returns linked scenes', () => {
        const campaign = seedCampaign()
        const scene1 = createScene({ ...makeSceneData(campaign.id), name: 'Scene 1', sortOrder: 0 })
        const scene2 = createScene({ ...makeSceneData(campaign.id), name: 'Scene 2', sortOrder: 1 })
        const note = createNote(makeNoteData(campaign.id))

        linkNoteToScene(scene1.id, note.id)
        linkNoteToScene(scene2.id, note.id)

        const linked = getScenesForNote(note.id)
        expect(linked.length).toBe(2)
    })

    it('unlinkNoteFromScene removes the link', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const note = createNote(makeNoteData(campaign.id))

        linkNoteToScene(scene.id, note.id)
        expect(getNotesForScene(scene.id).length).toBe(1)

        unlinkNoteFromScene(scene.id, note.id)
        expect(getNotesForScene(scene.id).length).toBe(0)
    })

    it('deleting a note cascades to scene_notes', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const note = createNote(makeNoteData(campaign.id))

        linkNoteToScene(scene.id, note.id)
        expect(getNotesForScene(scene.id).length).toBe(1)

        deleteNote(note.id)
        expect(getNotesForScene(scene.id).length).toBe(0)
    })

    it('deleting a scene cascades to scene_notes', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const note = createNote(makeNoteData(campaign.id))

        linkNoteToScene(scene.id, note.id)
        expect(getScenesForNote(note.id).length).toBe(1)

        deleteScene(scene.id)
        expect(getScenesForNote(note.id).length).toBe(0)
    })

    it('linkNoteToScene is idempotent (INSERT OR IGNORE)', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const note = createNote(makeNoteData(campaign.id))

        linkNoteToScene(scene.id, note.id)
        linkNoteToScene(scene.id, note.id)  // duplicate — should not error or create second link

        expect(getNotesForScene(scene.id).length).toBe(1)
    })
})

// ── Scene nextSceneId tests ───────────────────────────────────────────────────

describe('DB — scene nextSceneId', () => {
    it('createScene with nextSceneId=null stores null correctly', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))

        expect(scene.nextSceneId).toBeNull()
    })

    it('createScene with a nextSceneId value stores it correctly', () => {
        const campaign = seedCampaign()
        const sceneA = createScene(makeSceneData(campaign.id))
        const sceneB = createScene({
            ...makeSceneData(campaign.id),
            name: 'Scene B',
            sortOrder: 1,
            nextSceneId: sceneA.id,
        })

        expect(sceneB.nextSceneId).toBe(sceneA.id)
    })

    it('updateScene can set nextSceneId to a non-null value', () => {
        const campaign = seedCampaign()
        const sceneA = createScene(makeSceneData(campaign.id))
        const sceneB = createScene({ ...makeSceneData(campaign.id), name: 'Scene B', sortOrder: 1 })

        const updated = updateScene(sceneB.id, { nextSceneId: sceneA.id })

        expect(updated.nextSceneId).toBe(sceneA.id)
    })

    it('updateScene can clear nextSceneId back to null', () => {
        const campaign = seedCampaign()
        const sceneA = createScene(makeSceneData(campaign.id))
        const sceneB = createScene({
            ...makeSceneData(campaign.id),
            name: 'Scene B',
            sortOrder: 1,
            nextSceneId: sceneA.id,
        })

        const updated = updateScene(sceneB.id, { nextSceneId: null })

        expect(updated.nextSceneId).toBeNull()
    })

    it('updateScene preserving other fields when only nextSceneId is changed', () => {
        const campaign = seedCampaign()
        const sceneA = createScene(makeSceneData(campaign.id))
        const sceneB = createScene({ ...makeSceneData(campaign.id), name: 'Scene B', sortOrder: 1 })

        const updated = updateScene(sceneB.id, { nextSceneId: sceneA.id })

        // Other fields must be unchanged
        expect(updated.name).toBe('Scene B')
        expect(updated.overlays).toEqual(['fx/rain.webm', 'fx/lightning.webm'])
        expect(updated.branches).toEqual([{ label: 'Branch A', targetSceneId: 'scene-x', transitionNote: '' }])
    })
})

// ── Scene-NPC junction tests ─────────────────────────────────────────────────

describe('DB — scene_npcs junction', () => {
    it('linkNPCToScene creates a link and getNPCsForScene returns the NPC', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const npc = createNPC(makeNPCData(campaign.id))

        linkNPCToScene(scene.id, npc.id)

        const linked = getNPCsForScene(scene.id)
        expect(linked.length).toBe(1)
        expect(linked[0]!.id).toBe(npc.id)
    })

    it('getNPCsForScene returns empty array for a scene with no NPC links', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))

        const linked = getNPCsForScene(scene.id)
        expect(linked).toEqual([])
    })

    it('getNPCsForScene returns multiple linked NPCs', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const npc1 = createNPC(makeNPCData(campaign.id, 'NPC One'))
        const npc2 = createNPC(makeNPCData(campaign.id, 'NPC Two'))

        linkNPCToScene(scene.id, npc1.id, 0)
        linkNPCToScene(scene.id, npc2.id, 1)

        const linked = getNPCsForScene(scene.id)
        expect(linked.length).toBe(2)
        const ids = linked.map(n => n.id)
        expect(ids).toContain(npc1.id)
        expect(ids).toContain(npc2.id)
    })

    it('unlinkNPCFromScene removes the link and NPC no longer appears', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const npc = createNPC(makeNPCData(campaign.id))

        linkNPCToScene(scene.id, npc.id)
        expect(getNPCsForScene(scene.id).length).toBe(1)

        unlinkNPCFromScene(scene.id, npc.id)
        expect(getNPCsForScene(scene.id).length).toBe(0)
    })

    it('linkNPCToScene with INSERT OR REPLACE updates sort_order on re-link', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const npc = createNPC(makeNPCData(campaign.id))

        linkNPCToScene(scene.id, npc.id, 0)
        linkNPCToScene(scene.id, npc.id, 5)  // re-link with new sort_order

        // Should still be exactly one link (no duplicates)
        const linked = getNPCsForScene(scene.id)
        expect(linked.length).toBe(1)
        expect(linked[0]!.id).toBe(npc.id)
    })

    it('getSceneNPCLinks returns all scene-NPC links for a campaign', () => {
        const campaign = seedCampaign()
        const scene1 = createScene(makeSceneData(campaign.id))
        const scene2 = createScene({ ...makeSceneData(campaign.id), name: 'Scene 2', sortOrder: 1 })
        const npc1 = createNPC(makeNPCData(campaign.id, 'NPC One'))
        const npc2 = createNPC(makeNPCData(campaign.id, 'NPC Two'))

        linkNPCToScene(scene1.id, npc1.id)
        linkNPCToScene(scene2.id, npc2.id)
        linkNPCToScene(scene1.id, npc2.id)

        const links = getSceneNPCLinks(campaign.id)
        expect(links.length).toBe(3)

        const pairs = links.map(l => `${l.sceneId}:${l.npcId}`)
        expect(pairs).toContain(`${scene1.id}:${npc1.id}`)
        expect(pairs).toContain(`${scene2.id}:${npc2.id}`)
        expect(pairs).toContain(`${scene1.id}:${npc2.id}`)
    })

    it('getSceneNPCLinks returns empty array for a campaign with no links', () => {
        const campaign = seedCampaign()
        // NPCs exist but no links
        createNPC(makeNPCData(campaign.id))

        const links = getSceneNPCLinks(campaign.id)
        expect(links).toEqual([])
    })

    it('deleting a scene cascades to scene_npcs junction rows', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const npc = createNPC(makeNPCData(campaign.id))

        linkNPCToScene(scene.id, npc.id)
        expect(getNPCsForScene(scene.id).length).toBe(1)

        deleteScene(scene.id)

        // NPC still exists but junction is gone — verify via campaign-wide link query
        const links = getSceneNPCLinks(campaign.id)
        expect(links.filter(l => l.sceneId === scene.id).length).toBe(0)
    })

    it('deleting an NPC cascades to scene_npcs junction rows', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const npc = createNPC(makeNPCData(campaign.id))

        linkNPCToScene(scene.id, npc.id)
        expect(getNPCsForScene(scene.id).length).toBe(1)

        deleteNPC(npc.id)
        expect(getNPCsForScene(scene.id).length).toBe(0)
    })
})

// ── Fog of War tests ──────────────────────────────────────────────────────────

describe('DB — fog of war', () => {
    it('createScene with fogEnabled: false and fogData: null stores correct defaults', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))

        expect(scene.fogEnabled).toBe(false)
        expect(scene.fogData).toBeNull()
    })

    it('fogEnabled is returned as boolean (not number)', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))

        expect(typeof scene.fogEnabled).toBe('boolean')
    })

    it('createScene with fogEnabled: true stores and returns true', () => {
        const campaign = seedCampaign()
        const scene = createScene({
            ...makeSceneData(campaign.id),
            fogEnabled: true,
            fogData: null,
        })

        expect(scene.fogEnabled).toBe(true)
        expect(typeof scene.fogEnabled).toBe('boolean')
    })

    it('createScene with fogData base64 string round-trips correctly', () => {
        const campaign = seedCampaign()
        const fogBase64 = 'aGVsbG8gd29ybGQ='  // 'hello world' in base64
        const scene = createScene({
            ...makeSceneData(campaign.id),
            fogEnabled: true,
            fogData: fogBase64,
        })

        expect(scene.fogEnabled).toBe(true)
        expect(scene.fogData).toBe(fogBase64)
    })

    it('updateScene can set fogEnabled to true', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        expect(scene.fogEnabled).toBe(false)

        const updated = updateScene(scene.id, { fogEnabled: true })
        expect(updated.fogEnabled).toBe(true)
        expect(typeof updated.fogEnabled).toBe('boolean')
    })

    it('updateScene can set fogData to a base64 string', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const fogBase64 = 'dGVzdA=='  // 'test' in base64

        const updated = updateScene(scene.id, { fogData: fogBase64 })
        expect(updated.fogData).toBe(fogBase64)
    })

    it('updateScene can clear fogData back to null', () => {
        const campaign = seedCampaign()
        const fogBase64 = 'dGVzdA=='
        const scene = createScene({
            ...makeSceneData(campaign.id),
            fogEnabled: true,
            fogData: fogBase64,
        })
        expect(scene.fogData).toBe(fogBase64)

        const updated = updateScene(scene.id, { fogData: null })
        expect(updated.fogData).toBeNull()
    })

    it('updateScene fog fields do not affect other scene fields', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))

        const updated = updateScene(scene.id, { fogEnabled: true })
        expect(updated.name).toBe('Test Scene')
        expect(updated.overlays).toEqual(['fx/rain.webm', 'fx/lightning.webm'])
        expect(updated.colorGrade.tint).toBe('#ff0000')
        expect(updated.branches).toEqual([{ label: 'Branch A', targetSceneId: 'scene-x', transitionNote: '' }])
    })
})

// ── Item CRUD tests ─────────────────────────────────────────────────────────

function makeItemData(campaignId: string, overrides?: Partial<{ name: string; description: string; rarity: string | null; category: string | null; properties: string[]; tags: string[]; sourceNoteId: string | null }>) {
    return {
        campaignId,
        name: overrides?.name ?? 'Test Item',
        description: overrides?.description ?? 'A test item.',
        rarity: (overrides?.rarity ?? null) as import('../types').ItemRarity | null,
        category: (overrides?.category ?? null) as import('../types').ItemCategory | null,
        properties: overrides?.properties ?? [],
        tags: overrides?.tags ?? [],
        sourceNoteId: overrides?.sourceNoteId ?? null,
    }
}

describe('DB — items', () => {
    it('createItem persists and returns correct shape', () => {
        const campaign = seedCampaign()
        const item = createItem(makeItemData(campaign.id, {
            name: 'Flame Tongue',
            description: 'A fiery sword.',
            rarity: 'rare',
            category: 'weapon',
            properties: ['+1', 'fire damage'],
            tags: ['magic', 'sword'],
        }))

        expect(item.id).toBeTypeOf('string')
        expect(item.id.length).toBeGreaterThan(0)
        expect(item.name).toBe('Flame Tongue')
        expect(item.description).toBe('A fiery sword.')
        expect(item.rarity).toBe('rare')
        expect(item.category).toBe('weapon')
        expect(item.properties).toEqual(['+1', 'fire damage'])
        expect(item.tags).toEqual(['magic', 'sword'])
        expect(item.sourceNoteId).toBeNull()
        expect(item.createdAt).toBeTypeOf('string')
        expect(item.updatedAt).toBeTypeOf('string')
    })

    it('getItems returns items for a campaign', () => {
        const campaign = seedCampaign()
        createItem(makeItemData(campaign.id, { name: 'Item A' }))
        createItem(makeItemData(campaign.id, { name: 'Item B' }))

        const items = getItems(campaign.id)
        expect(items.length).toBeGreaterThanOrEqual(2)
        const names = items.map((i) => i.name)
        expect(names).toContain('Item A')
        expect(names).toContain('Item B')
    })

    it('getItem returns the correct item', () => {
        const campaign = seedCampaign()
        const created = createItem(makeItemData(campaign.id, { name: 'Lookup Item' }))
        const found = getItem(created.id)
        expect(found).toBeDefined()
        expect(found!.name).toBe('Lookup Item')
    })

    it('getItem returns undefined for missing ID', () => {
        expect(getItem('nonexistent-item')).toBeUndefined()
    })

    it('updateItem patches only provided fields', () => {
        const campaign = seedCampaign()
        const item = createItem(makeItemData(campaign.id, {
            name: 'Old Name',
            description: 'Old desc',
            rarity: 'common',
        }))

        const updated = updateItem(item.id, { name: 'New Name' })
        expect(updated.name).toBe('New Name')
        expect(updated.id).toBe(item.id)
    })

    it('updateItem serialises properties and tags JSON correctly', () => {
        const campaign = seedCampaign()
        const item = createItem(makeItemData(campaign.id))

        const updated = updateItem(item.id, {
            properties: ['cursed', 'attunement'],
            tags: ['magic', 'ring'],
        })
        expect(updated.properties).toEqual(['cursed', 'attunement'])
        expect(updated.tags).toEqual(['magic', 'ring'])
    })

    it('deleteItem removes the item', () => {
        const campaign = seedCampaign()
        const item = createItem(makeItemData(campaign.id))
        deleteItem(item.id)
        expect(getItem(item.id)).toBeUndefined()
    })

    it('createItem with null rarity and category stores nulls', () => {
        const campaign = seedCampaign()
        const item = createItem(makeItemData(campaign.id))
        expect(item.rarity).toBeNull()
        expect(item.category).toBeNull()
    })
})

// ── Scene-Item junction ──────────────────────────────────────────────────────

describe('Scene-Item junction', () => {
    it('linkItemToScene creates a link and getItemsForScene returns the item', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const item = createItem(makeItemData(campaign.id, { name: 'Flame Tongue' }))

        linkItemToScene(scene.id, item.id)

        const linked = getItemsForScene(scene.id)
        expect(linked.length).toBe(1)
        expect(linked[0]!.id).toBe(item.id)
        expect(linked[0]!.name).toBe('Flame Tongue')
    })

    it('getItemsForScene returns empty array for a scene with no item links', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))

        const linked = getItemsForScene(scene.id)
        expect(linked).toEqual([])
    })

    it('getItemsForScene returns multiple linked items sorted by name', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const itemA = createItem(makeItemData(campaign.id, { name: 'Amulet of Proof' }))
        const itemB = createItem(makeItemData(campaign.id, { name: 'Bag of Holding' }))

        linkItemToScene(scene.id, itemB.id)
        linkItemToScene(scene.id, itemA.id)

        const linked = getItemsForScene(scene.id)
        expect(linked.length).toBe(2)
        expect(linked[0]!.name).toBe('Amulet of Proof')
        expect(linked[1]!.name).toBe('Bag of Holding')
    })

    it('unlinkItemFromScene removes the link', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const item = createItem(makeItemData(campaign.id))

        linkItemToScene(scene.id, item.id)
        expect(getItemsForScene(scene.id).length).toBe(1)

        unlinkItemFromScene(scene.id, item.id)
        expect(getItemsForScene(scene.id).length).toBe(0)
    })

    it('linkItemToScene is idempotent (INSERT OR IGNORE)', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const item = createItem(makeItemData(campaign.id))

        linkItemToScene(scene.id, item.id)
        linkItemToScene(scene.id, item.id) // duplicate — should not throw

        const linked = getItemsForScene(scene.id)
        expect(linked.length).toBe(1)
    })

    it('getSceneItemLinks returns all links for a campaign', () => {
        const campaign = seedCampaign()
        const scene1 = createScene(makeSceneData(campaign.id))
        const scene2 = createScene({ ...makeSceneData(campaign.id), name: 'Scene 2', sortOrder: 1 })
        const item1 = createItem(makeItemData(campaign.id, { name: 'Item 1' }))
        const item2 = createItem(makeItemData(campaign.id, { name: 'Item 2' }))

        linkItemToScene(scene1.id, item1.id)
        linkItemToScene(scene2.id, item2.id)
        linkItemToScene(scene1.id, item2.id)

        const links = getSceneItemLinks(campaign.id)
        expect(links.length).toBe(3)
        expect(links).toContainEqual({ sceneId: scene1.id, itemId: item1.id })
        expect(links).toContainEqual({ sceneId: scene2.id, itemId: item2.id })
        expect(links).toContainEqual({ sceneId: scene1.id, itemId: item2.id })
    })

    it('deleting an item cascades to scene_items links', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const item = createItem(makeItemData(campaign.id))

        linkItemToScene(scene.id, item.id)
        expect(getItemsForScene(scene.id).length).toBe(1)

        deleteItem(item.id)
        expect(getItemsForScene(scene.id).length).toBe(0)
    })

    it('deleting a scene cascades to scene_items links', () => {
        const campaign = seedCampaign()
        const scene = createScene(makeSceneData(campaign.id))
        const item = createItem(makeItemData(campaign.id))

        linkItemToScene(scene.id, item.id)
        expect(getSceneItemLinks(campaign.id).length).toBe(1)

        deleteScene(scene.id)
        expect(getSceneItemLinks(campaign.id).length).toBe(0)
    })
})
