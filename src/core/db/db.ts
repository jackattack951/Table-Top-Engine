/**
 * SQLite database module — Electron main process only.
 * Opens the database, runs pending migrations, and exports typed query functions.
 *
 * IMPORTANT: Never import this file in src/ui/, src/api/, or src/systems/av/.
 * It uses the `electron` module which is unavailable in renderer or browser contexts.
 */
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { Campaign, Scene, SceneBranch, NPC, Note, NoteType, Item, SceneItem } from '../types'
import { ITEM_RARITIES, ITEM_CATEGORIES, ITEM_STATUSES } from '../types'
import type { MediaAsset, AssetFilter, CreateAssetInput, UpdateAssetInput } from '../../../shared/asset-types'
import {
    setAssetDB, getAssets, getAsset, createAsset, updateAsset, deleteAsset,
    tagAssetForCampaign, untagAsset, getAssetsForCampaign,
} from './asset-db'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Raw row shape returned from the scenes table before JSON column parsing.
 */
interface SceneRow {
    id: string
    campaign_id: string
    name: string
    sort_order: number
    background_path: string | null
    gameboard_path: string | null
    background_asset_id: string | null
    gameboard_asset_id: string | null
    overlays: string
    particles: string
    color_grade: string
    gb_color_grade: string
    audio_mood: number
    notes: string
    linked_npc_ids: string
    linked_location_ids: string
    scratchpad: string
    branches: string
    next_scene_id: string | null
    fog_data: Buffer | string | null
    fog_enabled: number
}

/**
 * Raw row shape returned from the campaigns table.
 */
interface CampaignRow {
    id: string
    name: string
    system: string
    starting_scene_id: string | null
    created_at: string
    updated_at: string
}

/**
 * Raw row shape returned from the npcs table.
 */
interface NPCRow {
    id: string
    campaign_id: string
    name: string
    stat_block: string
    personality: string
    notes: string
}

/**
 * Raw row shape returned from the notes table.
 */
interface NoteRow {
    id: string
    campaign_id: string
    title: string
    type: string
    body: string
    tags: string          // JSON array
    source_file: string | null
    pinned: number        // 0 or 1
    archived: number      // 0 or 1
    status: string | null
    color: string | null
    created_at: string
    updated_at: string
}

// ── Column whitelists ─────────────────────────────────────────────────────────
// Prevents arbitrary column injection in dynamic SET clauses.

const CAMPAIGN_COLUMNS = new Set(['name', 'system', 'starting_scene_id', 'updated_at'])
const SCENE_COLUMNS = new Set([
    'name', 'background_path', 'gameboard_path', 'background_asset_id', 'gameboard_asset_id',
    'overlays', 'particles', 'color_grade', 'gb_color_grade',
    'audio_mood', 'notes', 'linked_npc_ids', 'linked_location_ids', 'scratchpad', 'branches', 'sort_order',
    'next_scene_id', 'fog_data', 'fog_enabled',
])
const NPC_COLUMNS = new Set(['name', 'stat_block', 'personality', 'notes'])
const NOTE_COLUMNS = new Set(['title', 'type', 'body', 'tags', 'source_file', 'pinned', 'archived', 'status', 'color', 'updated_at'])

function assertColumn(col: string, allowed: Set<string>): void {
    if (!allowed.has(col)) throw new Error(`Invalid column: ${col}`)
}

// ── Singleton DB instance ─────────────────────────────────────────────────────

let db: Database.Database | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSceneRow(row: SceneRow): Scene {
    // fog_data may be a Buffer (from SQLite BLOB) or already a string (test shims)
    let fogData: string | null = null
    if (row.fog_data != null) {
        fogData = Buffer.isBuffer(row.fog_data)
            ? row.fog_data.toString('base64')
            : (row.fog_data as string)
    }

    return {
        id: row.id,
        campaignId: row.campaign_id,
        name: row.name,
        sortOrder: row.sort_order,
        backgroundPath: row.background_path,
        gameboardPath: row.gameboard_path ?? null,
        backgroundAssetId: row.background_asset_id ?? null,
        gameboardAssetId: row.gameboard_asset_id ?? null,
        overlays: JSON.parse(row.overlays) as string[],
        particles: JSON.parse(row.particles) as Scene['particles'],
        colorGrade: JSON.parse(row.color_grade) as Scene['colorGrade'],
        gbColorGrade: JSON.parse(row.gb_color_grade) as Scene['gbColorGrade'],
        audioMood: row.audio_mood,
        notes: row.notes,
        linkedNPCIds: JSON.parse(row.linked_npc_ids) as string[],
        linkedLocationIds: JSON.parse(row.linked_location_ids) as string[],
        scratchpad: row.scratchpad ?? '',
        nextSceneId: row.next_scene_id ?? null,
        branches: (JSON.parse(row.branches) as SceneBranch[]).map(b => ({
            ...b,
            transitionNote: b.transitionNote ?? '',
        })),
        fogEnabled: row.fog_enabled === 1,
        fogData,
    }
}

function parseCampaignRow(row: CampaignRow): Campaign {
    return {
        id: row.id,
        name: row.name,
        system: row.system,
        startingSceneId: row.starting_scene_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function parseNPCRow(row: NPCRow): NPC {
    return {
        id: row.id,
        campaignId: row.campaign_id,
        name: row.name,
        statBlock: JSON.parse(row.stat_block) as Record<string, unknown>,
        personality: row.personality,
        notes: row.notes,
    }
}

const VALID_NOTE_TYPES = new Set<NoteType>(['scene', 'location', 'npc', 'lore', 'general', 'quest', 'session', 'faction'])

function parseNoteRow(row: NoteRow): Note {
    return {
        id: row.id,
        campaignId: row.campaign_id,
        title: row.title,
        type: VALID_NOTE_TYPES.has(row.type as NoteType) ? row.type as NoteType : 'general',
        body: row.body,
        tags: JSON.parse(row.tags) as string[],
        sourceFile: row.source_file,
        pinned: row.pinned === 1,
        archived: row.archived === 1,
        status: row.status ?? null,
        color: row.color as Note['color'],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function getDB(): Database.Database {
    if (!db) {
        throw new Error('[db] Database not initialized. Call initDB() first.')
    }
    return db
}

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Opens the SQLite database at the platform-appropriate userData path,
 * enables WAL mode for better concurrent read performance, and runs all
 * pending migrations from the migrations directory in alphabetical order.
 *
 * Must be called once after `app.whenReady()` in the Electron main process.
 */
export function initDB(): void {
    const dbPath = path.join(app.getPath('userData'), 'stage-manager.db')

    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    runMigrations(db)
    setAssetDB(db)
}

/**
 * For testing purposes only — open an in-memory database and run migrations.
 */
export function initDBForTest(dbPath: string = ':memory:'): void {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    setAssetDB(db)
}

/**
 * Close the database. Call this on app quit.
 */
export function closeDB(): void {
    db?.close()
    db = null
}

function runMigrations(database: Database.Database): void {
    // Create migrations tracking table if it doesn't exist
    database.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `)

    const migrationsDir = path.join(__dirname, '../../src/core/db/migrations')

    // Resolve migration directory relative to this file at runtime
    // In built output, __dirname points to out/main/; adjust path accordingly
    const candidates = [
        migrationsDir,
        path.join(__dirname, '../core/db/migrations'),
        path.join(__dirname, 'migrations'),
        path.join(process.resourcesPath ?? '', 'migrations'),  // packaged app extraResources
    ]

    let resolvedDir: string | null = null
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            resolvedDir = candidate
            break
        }
    }

    if (!resolvedDir) {
        console.warn('[db] migrations directory not found, skipping migration run')
        return
    }

    const sqlFiles = fs.readdirSync(resolvedDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()

    const applied = database
        .prepare('SELECT name FROM _migrations')
        .all() as { name: string }[]
    const appliedNames = new Set(applied.map((r) => r.name))

    for (const file of sqlFiles) {
        if (appliedNames.has(file)) {
            continue
        }
        const sql = fs.readFileSync(path.join(resolvedDir, file), 'utf-8')
        database.exec(sql)
        database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    }
}

// ── Campaign CRUD ─────────────────────────────────────────────────────────────

/**
 * Returns all campaigns ordered by creation date descending.
 */
export function getCampaigns(): Campaign[] {
    const rows = getDB()
        .prepare('SELECT * FROM campaigns ORDER BY created_at DESC')
        .all() as CampaignRow[]
    return rows.map(parseCampaignRow)
}

/**
 * Returns a single campaign by ID, or undefined if not found.
 */
export function getCampaign(id: string): Campaign | undefined {
    const row = getDB()
        .prepare('SELECT * FROM campaigns WHERE id = ?')
        .get(id) as CampaignRow | undefined
    return row ? parseCampaignRow(row) : undefined
}

/**
 * Creates a new campaign and returns it with generated ID and timestamps.
 */
export function createCampaign(data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Campaign {
    const id = randomUUID()
    const now = new Date().toISOString()
    getDB().prepare(`
        INSERT INTO campaigns (id, name, system, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, data.name, data.system, now, now)
    return getCampaign(id)!
}

/**
 * Updates a campaign's mutable fields and bumps updatedAt.
 */
export function updateCampaign(id: string, data: Partial<Pick<Campaign, 'name' | 'system' | 'startingSceneId'>>): Campaign {
    const now = new Date().toISOString()
    assertColumn('updated_at', CAMPAIGN_COLUMNS)
    const sets: string[] = ['updated_at = ?']
    const values: unknown[] = [now]

    if (data.name !== undefined) { assertColumn('name', CAMPAIGN_COLUMNS); sets.push('name = ?'); values.push(data.name) }
    if (data.system !== undefined) { assertColumn('system', CAMPAIGN_COLUMNS); sets.push('system = ?'); values.push(data.system) }
    if (data.startingSceneId !== undefined) { assertColumn('starting_scene_id', CAMPAIGN_COLUMNS); sets.push('starting_scene_id = ?'); values.push(data.startingSceneId) }

    values.push(id)
    getDB().prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return getCampaign(id)!
}

/**
 * Deletes a campaign and all its children (CASCADE in schema).
 */
export function deleteCampaign(id: string): void {
    getDB().prepare('DELETE FROM campaigns WHERE id = ?').run(id)
}

// ── Scene CRUD ────────────────────────────────────────────────────────────────

/**
 * Returns all scenes for a campaign ordered by sort_order.
 */
export function getScenes(campaignId: string): Scene[] {
    const rows = getDB()
        .prepare('SELECT * FROM scenes WHERE campaign_id = ? ORDER BY sort_order ASC')
        .all(campaignId) as SceneRow[]
    return rows.map(parseSceneRow)
}

/**
 * Returns a single scene by ID, or undefined if not found.
 */
export function getScene(id: string): Scene | undefined {
    const row = getDB()
        .prepare('SELECT * FROM scenes WHERE id = ?')
        .get(id) as SceneRow | undefined
    return row ? parseSceneRow(row) : undefined
}

/**
 * Creates a new scene with serialized JSON columns.
 */
export function createScene(data: Omit<Scene, 'id'>): Scene {
    const id = randomUUID()
    getDB().prepare(`
        INSERT INTO scenes (
            id, campaign_id, name, sort_order, background_path,
            gameboard_path, background_asset_id, gameboard_asset_id,
            overlays, particles, color_grade, gb_color_grade, audio_mood, notes,
            linked_npc_ids, linked_location_ids, scratchpad, branches,
            next_scene_id, fog_data, fog_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        data.campaignId,
        data.name,
        data.sortOrder,
        data.backgroundPath,
        data.gameboardPath ?? null,
        data.backgroundAssetId ?? null,
        data.gameboardAssetId ?? null,
        JSON.stringify(data.overlays),
        JSON.stringify(data.particles),
        JSON.stringify(data.colorGrade),
        JSON.stringify(data.gbColorGrade),
        data.audioMood,
        data.notes,
        JSON.stringify(data.linkedNPCIds),
        JSON.stringify(data.linkedLocationIds),
        data.scratchpad ?? '',
        JSON.stringify(data.branches),
        data.nextSceneId ?? null,
        data.fogData ? Buffer.from(data.fogData, 'base64') : null,
        data.fogEnabled ? 1 : 0,
    )
    return getScene(id)!
}

/**
 * Patches provided fields on a scene. JSON columns are serialized automatically.
 */
export function updateScene(id: string, data: Partial<Omit<Scene, 'id' | 'campaignId'>>): Scene {
    const sets: string[] = []
    const values: unknown[] = []

    if (data.name !== undefined) { assertColumn('name', SCENE_COLUMNS); sets.push('name = ?'); values.push(data.name) }
    if (data.sortOrder !== undefined) { assertColumn('sort_order', SCENE_COLUMNS); sets.push('sort_order = ?'); values.push(data.sortOrder) }
    if (data.backgroundPath !== undefined) { assertColumn('background_path', SCENE_COLUMNS); sets.push('background_path = ?'); values.push(data.backgroundPath) }
    if (data.gameboardPath !== undefined) { assertColumn('gameboard_path', SCENE_COLUMNS); sets.push('gameboard_path = ?'); values.push(data.gameboardPath) }
    if (data.backgroundAssetId !== undefined) { assertColumn('background_asset_id', SCENE_COLUMNS); sets.push('background_asset_id = ?'); values.push(data.backgroundAssetId) }
    if (data.gameboardAssetId !== undefined) { assertColumn('gameboard_asset_id', SCENE_COLUMNS); sets.push('gameboard_asset_id = ?'); values.push(data.gameboardAssetId) }
    if (data.overlays !== undefined) { assertColumn('overlays', SCENE_COLUMNS); sets.push('overlays = ?'); values.push(JSON.stringify(data.overlays)) }
    if (data.particles !== undefined) { assertColumn('particles', SCENE_COLUMNS); sets.push('particles = ?'); values.push(JSON.stringify(data.particles)) }
    if (data.colorGrade !== undefined) { assertColumn('color_grade', SCENE_COLUMNS); sets.push('color_grade = ?'); values.push(JSON.stringify(data.colorGrade)) }
    if (data.gbColorGrade !== undefined) { assertColumn('gb_color_grade', SCENE_COLUMNS); sets.push('gb_color_grade = ?'); values.push(JSON.stringify(data.gbColorGrade)) }
    if (data.audioMood !== undefined) { assertColumn('audio_mood', SCENE_COLUMNS); sets.push('audio_mood = ?'); values.push(data.audioMood) }
    if (data.notes !== undefined) { assertColumn('notes', SCENE_COLUMNS); sets.push('notes = ?'); values.push(data.notes) }
    if (data.linkedNPCIds !== undefined) { assertColumn('linked_npc_ids', SCENE_COLUMNS); sets.push('linked_npc_ids = ?'); values.push(JSON.stringify(data.linkedNPCIds)) }
    if (data.linkedLocationIds !== undefined) { assertColumn('linked_location_ids', SCENE_COLUMNS); sets.push('linked_location_ids = ?'); values.push(JSON.stringify(data.linkedLocationIds)) }
    if (data.scratchpad !== undefined) { assertColumn('scratchpad', SCENE_COLUMNS); sets.push('scratchpad = ?'); values.push(data.scratchpad) }
    if (data.branches !== undefined) { assertColumn('branches', SCENE_COLUMNS); sets.push('branches = ?'); values.push(JSON.stringify(data.branches)) }
    if (data.nextSceneId !== undefined) { assertColumn('next_scene_id', SCENE_COLUMNS); sets.push('next_scene_id = ?'); values.push(data.nextSceneId) }
    if (data.fogEnabled !== undefined) { assertColumn('fog_enabled', SCENE_COLUMNS); sets.push('fog_enabled = ?'); values.push(data.fogEnabled ? 1 : 0) }
    if (data.fogData !== undefined) { assertColumn('fog_data', SCENE_COLUMNS); sets.push('fog_data = ?'); values.push(data.fogData ? Buffer.from(data.fogData, 'base64') : null) }

    if (sets.length === 0) return getScene(id)!

    values.push(id)
    getDB().prepare(`UPDATE scenes SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return getScene(id)!
}

/**
 * Deletes a scene by ID.
 */
export function deleteScene(id: string): void {
    getDB().prepare('DELETE FROM scenes WHERE id = ?').run(id)
}

// ── NPC CRUD ──────────────────────────────────────────────────────────────────

/**
 * Returns all NPCs for a campaign ordered by name.
 */
export function getNPCs(campaignId: string): NPC[] {
    const rows = getDB()
        .prepare('SELECT * FROM npcs WHERE campaign_id = ? ORDER BY name ASC')
        .all(campaignId) as NPCRow[]
    return rows.map(parseNPCRow)
}

/**
 * Returns a single NPC by ID, or undefined if not found.
 */
export function getNPC(id: string): NPC | undefined {
    const row = getDB()
        .prepare('SELECT * FROM npcs WHERE id = ?')
        .get(id) as NPCRow | undefined
    return row ? parseNPCRow(row) : undefined
}

/**
 * Creates a new NPC and returns it.
 */
export function createNPC(data: Omit<NPC, 'id'>): NPC {
    const id = randomUUID()
    getDB().prepare(`
        INSERT INTO npcs (id, campaign_id, name, stat_block, personality, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        id,
        data.campaignId,
        data.name,
        JSON.stringify(data.statBlock),
        data.personality,
        data.notes,
    )
    return getNPC(id)!
}

/**
 * Patches provided fields on an NPC.
 */
export function updateNPC(id: string, data: Partial<Omit<NPC, 'id' | 'campaignId'>>): NPC {
    const sets: string[] = []
    const values: unknown[] = []

    if (data.name !== undefined) { assertColumn('name', NPC_COLUMNS); sets.push('name = ?'); values.push(data.name) }
    if (data.statBlock !== undefined) { assertColumn('stat_block', NPC_COLUMNS); sets.push('stat_block = ?'); values.push(JSON.stringify(data.statBlock)) }
    if (data.personality !== undefined) { assertColumn('personality', NPC_COLUMNS); sets.push('personality = ?'); values.push(data.personality) }
    if (data.notes !== undefined) { assertColumn('notes', NPC_COLUMNS); sets.push('notes = ?'); values.push(data.notes) }

    if (sets.length === 0) return getNPC(id)!

    values.push(id)
    getDB().prepare(`UPDATE npcs SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return getNPC(id)!
}

/**
 * Deletes an NPC by ID.
 */
export function deleteNPC(id: string): void {
    getDB().prepare('DELETE FROM npcs WHERE id = ?').run(id)
}

// ── Note CRUD ────────────────────────────────────────────────────────────────

/**
 * Returns all notes for a campaign, optionally filtered by type.
 */
export function getNotes(campaignId: string, type?: NoteType): Note[] {
    if (type) {
        const rows = getDB()
            .prepare('SELECT * FROM notes WHERE campaign_id = ? AND type = ? ORDER BY updated_at DESC')
            .all(campaignId, type) as NoteRow[]
        return rows.map(parseNoteRow)
    }
    const rows = getDB()
        .prepare('SELECT * FROM notes WHERE campaign_id = ? ORDER BY updated_at DESC')
        .all(campaignId) as NoteRow[]
    return rows.map(parseNoteRow)
}

/**
 * Returns a single note by ID, or undefined if not found.
 */
export function getNote(id: string): Note | undefined {
    const row = getDB()
        .prepare('SELECT * FROM notes WHERE id = ?')
        .get(id) as NoteRow | undefined
    return row ? parseNoteRow(row) : undefined
}

/**
 * Creates a new note and returns it with generated ID and timestamps.
 */
export function createNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
    const id = randomUUID()
    const now = new Date().toISOString()
    getDB().prepare(`
        INSERT INTO notes (id, campaign_id, title, type, body, tags, source_file, pinned, archived, status, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        data.campaignId,
        data.title,
        data.type,
        data.body,
        JSON.stringify(data.tags),
        data.sourceFile,
        data.pinned ? 1 : 0,
        data.archived ? 1 : 0,
        data.status ?? null,
        data.color ?? null,
        now,
        now,
    )
    return getNote(id)!
}

/**
 * Patches provided fields on a note and bumps updatedAt.
 * Note: sourceFile is included for the import pipeline. The REST API PATCH endpoint
 * should NOT expose sourceFile to clients — only title, type, body, and tags.
 */
export function updateNote(id: string, data: Partial<Pick<Note, 'title' | 'type' | 'body' | 'tags' | 'sourceFile' | 'pinned' | 'archived' | 'status' | 'color'>>): Note {
    const now = new Date().toISOString()
    assertColumn('updated_at', NOTE_COLUMNS)
    const sets: string[] = ['updated_at = ?']
    const values: unknown[] = [now]

    if (data.title !== undefined) { assertColumn('title', NOTE_COLUMNS); sets.push('title = ?'); values.push(data.title) }
    if (data.type !== undefined) { assertColumn('type', NOTE_COLUMNS); sets.push('type = ?'); values.push(data.type) }
    if (data.body !== undefined) { assertColumn('body', NOTE_COLUMNS); sets.push('body = ?'); values.push(data.body) }
    if (data.tags !== undefined) { assertColumn('tags', NOTE_COLUMNS); sets.push('tags = ?'); values.push(JSON.stringify(data.tags)) }
    if (data.sourceFile !== undefined) { assertColumn('source_file', NOTE_COLUMNS); sets.push('source_file = ?'); values.push(data.sourceFile) }
    if (data.pinned !== undefined) { assertColumn('pinned', NOTE_COLUMNS); sets.push('pinned = ?'); values.push(data.pinned ? 1 : 0) }
    if (data.archived !== undefined) { assertColumn('archived', NOTE_COLUMNS); sets.push('archived = ?'); values.push(data.archived ? 1 : 0) }
    if (data.status !== undefined) { assertColumn('status', NOTE_COLUMNS); sets.push('status = ?'); values.push(data.status) }
    if (data.color !== undefined) { assertColumn('color', NOTE_COLUMNS); sets.push('color = ?'); values.push(data.color) }

    values.push(id)
    getDB().prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return getNote(id)!
}

/**
 * Deletes a note by ID. Cascade removes scene_notes links.
 */
export function deleteNote(id: string): void {
    getDB().prepare('DELETE FROM notes WHERE id = ?').run(id)
}

/**
 * Returns a single note matching the given sourceFile path, or undefined if not found.
 * Used by the import pipeline for re-import merge matching.
 */
export function getNoteBySourceFile(campaignId: string, sourceFile: string): Note | undefined {
    const row = getDB()
        .prepare('SELECT * FROM notes WHERE campaign_id = ? AND source_file = ?')
        .get(campaignId, sourceFile) as NoteRow | undefined
    return row ? parseNoteRow(row) : undefined
}

// ── Scene-Note Junction ──────────────────────────────────────────────────────

/**
 * Returns all notes linked to a scene, ordered by sort_order.
 */
export function getNotesForScene(sceneId: string): Note[] {
    const rows = getDB()
        .prepare(`
            SELECT n.* FROM notes n
            INNER JOIN scene_notes sn ON sn.note_id = n.id
            WHERE sn.scene_id = ?
            ORDER BY sn.sort_order ASC
        `)
        .all(sceneId) as NoteRow[]
    return rows.map(parseNoteRow)
}

/**
 * Returns all scenes linked to a note.
 */
export function getScenesForNote(noteId: string): Scene[] {
    const rows = getDB()
        .prepare(`
            SELECT s.* FROM scenes s
            INNER JOIN scene_notes sn ON sn.scene_id = s.id
            WHERE sn.note_id = ?
            ORDER BY s.sort_order ASC
        `)
        .all(noteId) as SceneRow[]
    return rows.map(parseSceneRow)
}

/**
 * Links a note to a scene. Idempotent — ignores if link already exists.
 */
export function linkNoteToScene(sceneId: string, noteId: string, sortOrder = 0): void {
    getDB().prepare(`
        INSERT OR IGNORE INTO scene_notes (scene_id, note_id, sort_order)
        VALUES (?, ?, ?)
    `).run(sceneId, noteId, sortOrder)
}

/**
 * Removes a note-to-scene link.
 */
export function unlinkNoteFromScene(sceneId: string, noteId: string): void {
    getDB().prepare('DELETE FROM scene_notes WHERE scene_id = ? AND note_id = ?').run(sceneId, noteId)
}

/**
 * Returns all scene→note links for notes belonging to a given campaign.
 * Used to populate the sceneNoteLinks cache on initial load.
 */
export function getSceneNoteLinks(campaignId: string): Record<string, string[]> {
    const rows = getDB()
        .prepare(`
            SELECT sn.scene_id, sn.note_id
            FROM scene_notes sn
            INNER JOIN notes n ON n.id = sn.note_id
            WHERE n.campaign_id = ?
        `)
        .all(campaignId) as { scene_id: string; note_id: string }[]

    const links: Record<string, string[]> = {}
    for (const row of rows) {
        if (!links[row.scene_id]) links[row.scene_id] = []
        links[row.scene_id].push(row.note_id)
    }
    return links
}

// ── Scene-NPC Junction ───────────────────────────────────────────────────────

/**
 * Returns all NPCs linked to a scene, ordered by sort_order.
 */
export function getNPCsForScene(sceneId: string): NPC[] {
    const rows = getDB()
        .prepare(`
            SELECT n.* FROM npcs n
            INNER JOIN scene_npcs sn ON sn.npc_id = n.id
            WHERE sn.scene_id = ?
            ORDER BY sn.sort_order ASC
        `)
        .all(sceneId) as NPCRow[]
    return rows.map(parseNPCRow)
}

/**
 * Links an NPC to a scene. Uses INSERT OR REPLACE to handle duplicate links
 * by updating the sort_order if the link already exists.
 */
export function linkNPCToScene(sceneId: string, npcId: string, sortOrder = 0): void {
    getDB().prepare(`
        INSERT OR REPLACE INTO scene_npcs (scene_id, npc_id, sort_order)
        VALUES (?, ?, ?)
    `).run(sceneId, npcId, sortOrder)
}

/**
 * Removes an NPC-to-scene link.
 */
export function unlinkNPCFromScene(sceneId: string, npcId: string): void {
    getDB().prepare('DELETE FROM scene_npcs WHERE scene_id = ? AND npc_id = ?').run(sceneId, npcId)
}

/**
 * Returns all scene→NPC links for NPCs belonging to a given campaign.
 * Used for bulk loading scene-NPC associations.
 */
export function getSceneNPCLinks(campaignId: string): Array<{ sceneId: string; npcId: string }> {
    const rows = getDB()
        .prepare(`
            SELECT sn.scene_id, sn.npc_id
            FROM scene_npcs sn
            INNER JOIN npcs n ON n.id = sn.npc_id
            WHERE n.campaign_id = ?
        `)
        .all(campaignId) as { scene_id: string; npc_id: string }[]

    return rows.map(row => ({ sceneId: row.scene_id, npcId: row.npc_id }))
}

// ── Item CRUD ────────────────────────────────────────────────────────────────

interface ItemRow {
    id: string
    campaign_id: string
    name: string
    description: string
    rarity: string | null
    category: string | null
    properties: string    // JSON array
    tags: string          // JSON array
    source_note_id: string | null
    created_at: string
    updated_at: string
}

const ITEM_COLUMNS = new Set(['name', 'description', 'rarity', 'category', 'properties', 'tags', 'source_note_id', 'updated_at'])
const VALID_RARITIES = new Set<string>(ITEM_RARITIES)
const VALID_CATEGORIES = new Set<string>(ITEM_CATEGORIES)

function safeParseArray(json: string): string[] {
    try { return JSON.parse(json) as string[] }
    catch { return [] }
}

function parseItemRow(row: ItemRow): Item {
    return {
        id: row.id,
        campaignId: row.campaign_id,
        name: row.name,
        description: row.description,
        rarity: (row.rarity && VALID_RARITIES.has(row.rarity)) ? row.rarity as Item['rarity'] : null,
        category: (row.category && VALID_CATEGORIES.has(row.category)) ? row.category as Item['category'] : null,
        properties: safeParseArray(row.properties),
        tags: safeParseArray(row.tags),
        sourceNoteId: row.source_note_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export function getItems(campaignId: string): Item[] {
    const rows = getDB()
        .prepare('SELECT * FROM items WHERE campaign_id = ? ORDER BY name ASC')
        .all(campaignId) as ItemRow[]
    return rows.map(parseItemRow)
}

export function getItem(id: string): Item | undefined {
    const row = getDB().prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined
    return row ? parseItemRow(row) : undefined
}

export function createItem(data: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Item {
    const id = randomUUID()
    const now = new Date().toISOString()
    getDB().prepare(`
        INSERT INTO items (id, campaign_id, name, description, rarity, category, properties, tags, source_note_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        data.campaignId,
        data.name,
        data.description,
        data.rarity ?? null,
        data.category ?? null,
        JSON.stringify(data.properties),
        JSON.stringify(data.tags),
        data.sourceNoteId ?? null,
        now,
        now,
    )
    return getItem(id)!
}

export function updateItem(id: string, data: Partial<Pick<Item, 'name' | 'description' | 'rarity' | 'category' | 'properties' | 'tags' | 'sourceNoteId'>>): Item {
    const now = new Date().toISOString()
    assertColumn('updated_at', ITEM_COLUMNS)
    const sets: string[] = ['updated_at = ?']
    const values: unknown[] = [now]

    if (data.name !== undefined) { assertColumn('name', ITEM_COLUMNS); sets.push('name = ?'); values.push(data.name) }
    if (data.description !== undefined) { assertColumn('description', ITEM_COLUMNS); sets.push('description = ?'); values.push(data.description) }
    if (data.rarity !== undefined) { assertColumn('rarity', ITEM_COLUMNS); sets.push('rarity = ?'); values.push(data.rarity) }
    if (data.category !== undefined) { assertColumn('category', ITEM_COLUMNS); sets.push('category = ?'); values.push(data.category) }
    if (data.properties !== undefined) { assertColumn('properties', ITEM_COLUMNS); sets.push('properties = ?'); values.push(JSON.stringify(data.properties)) }
    if (data.tags !== undefined) { assertColumn('tags', ITEM_COLUMNS); sets.push('tags = ?'); values.push(JSON.stringify(data.tags)) }
    if (data.sourceNoteId !== undefined) { assertColumn('source_note_id', ITEM_COLUMNS); sets.push('source_note_id = ?'); values.push(data.sourceNoteId) }

    values.push(id)
    getDB().prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return getItem(id)!
}

export function deleteItem(id: string): void {
    getDB().prepare('DELETE FROM items WHERE id = ?').run(id)
}

// ── Scene-Item junction ──────────────────────────────────────────────────────

const VALID_ITEM_STATUSES = new Set<string>(ITEM_STATUSES)

/**
 * Returns all items linked to a scene with their status, ordered by name.
 */
export function getItemsForScene(sceneId: string): SceneItem[] {
    const rows = getDB()
        .prepare(`
            SELECT i.*, si.status FROM items i
            INNER JOIN scene_items si ON si.item_id = i.id
            WHERE si.scene_id = ?
            ORDER BY i.name ASC
        `)
        .all(sceneId) as (ItemRow & { status: string })[]
    return rows.map((row) => ({
        ...parseItemRow(row),
        status: (VALID_ITEM_STATUSES.has(row.status) ? row.status : 'hidden') as SceneItem['status'],
    }))
}

/**
 * Links an item to a scene with an optional status. Uses INSERT OR IGNORE to skip duplicates.
 */
export function linkItemToScene(sceneId: string, itemId: string, status: string = 'hidden'): void {
    const safeStatus = VALID_ITEM_STATUSES.has(status) ? status : 'hidden'
    getDB().prepare(`
        INSERT OR IGNORE INTO scene_items (scene_id, item_id, status)
        VALUES (?, ?, ?)
    `).run(sceneId, itemId, safeStatus)
}

/**
 * Updates the status of an item within a scene.
 */
export function updateSceneItemStatus(sceneId: string, itemId: string, status: string): void {
    if (!VALID_ITEM_STATUSES.has(status)) return
    getDB().prepare('UPDATE scene_items SET status = ? WHERE scene_id = ? AND item_id = ?')
        .run(status, sceneId, itemId)
}

/**
 * Removes an item-to-scene link.
 */
export function unlinkItemFromScene(sceneId: string, itemId: string): void {
    getDB().prepare('DELETE FROM scene_items WHERE scene_id = ? AND item_id = ?').run(sceneId, itemId)
}

/**
 * Returns all scene→item links for items belonging to a given campaign.
 * Used for bulk loading scene-item associations.
 */
export function getSceneItemLinks(campaignId: string): Array<{ sceneId: string; itemId: string }> {
    const rows = getDB()
        .prepare(`
            SELECT si.scene_id, si.item_id
            FROM scene_items si
            INNER JOIN items i ON i.id = si.item_id
            WHERE i.campaign_id = ?
        `)
        .all(campaignId) as { scene_id: string; item_id: string }[]

    return rows.map(row => ({ sceneId: row.scene_id, itemId: row.item_id }))
}

// ── Player Characters (Sprint 21c) ────────────────────────────────────────────

interface PlayerCharacterRow {
    id: string
    campaign_id: string
    character_name: string
    class: string
    level: number
    max_hp: number
    ac: number
    abilities: string
}

function rowToRosterCharacter(row: PlayerCharacterRow) {
    return {
        id: row.id,
        characterName: row.character_name,
        class: row.class,
        level: row.level,
        maxHp: row.max_hp,
        ac: row.ac,
        abilities: JSON.parse(row.abilities) as Record<string, number>,
    }
}

export function getPlayerCharacters(campaignId: string) {
    const rows = getDB()
        .prepare('SELECT * FROM player_characters WHERE campaign_id = ? ORDER BY created_at ASC')
        .all(campaignId) as PlayerCharacterRow[]
    return rows.map(rowToRosterCharacter)
}

export function createPlayerCharacter(
    campaignId: string,
    data: { characterName: string; class: string; level: number; maxHp: number; ac: number; abilities: Record<string, number> },
) {
    const id = randomUUID()
    getDB()
        .prepare(`
            INSERT INTO player_characters (id, campaign_id, character_name, class, level, max_hp, ac, abilities)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(id, campaignId, data.characterName, data.class, data.level, data.maxHp, data.ac, JSON.stringify(data.abilities))
    return { id, characterName: data.characterName, class: data.class, level: data.level, maxHp: data.maxHp, ac: data.ac, abilities: data.abilities }
}

export function deletePlayerCharacter(id: string): void {
    getDB().prepare('DELETE FROM player_characters WHERE id = ?').run(id)
}

/**
 * Convenience typed interface bundled for dependency injection into createServer().
 */
export interface DBInterface {
    getCampaigns: typeof getCampaigns
    getCampaign: typeof getCampaign
    createCampaign: typeof createCampaign
    updateCampaign: typeof updateCampaign
    deleteCampaign: typeof deleteCampaign
    getScenes: typeof getScenes
    getScene: typeof getScene
    createScene: typeof createScene
    updateScene: typeof updateScene
    deleteScene: typeof deleteScene
    getNPCs: typeof getNPCs
    getNPC: typeof getNPC
    createNPC: typeof createNPC
    updateNPC: typeof updateNPC
    deleteNPC: typeof deleteNPC
    getNotes: typeof getNotes
    getNote: typeof getNote
    createNote: typeof createNote
    updateNote: typeof updateNote
    deleteNote: typeof deleteNote
    getNoteBySourceFile: typeof getNoteBySourceFile
    getNotesForScene: typeof getNotesForScene
    getScenesForNote: typeof getScenesForNote
    linkNoteToScene: typeof linkNoteToScene
    unlinkNoteFromScene: typeof unlinkNoteFromScene
    getSceneNoteLinks: typeof getSceneNoteLinks
    getNPCsForScene: typeof getNPCsForScene
    linkNPCToScene: typeof linkNPCToScene
    unlinkNPCFromScene: typeof unlinkNPCFromScene
    getSceneNPCLinks: typeof getSceneNPCLinks
    // Item CRUD
    getItems: typeof getItems
    getItem: typeof getItem
    createItem: typeof createItem
    updateItem: typeof updateItem
    deleteItem: typeof deleteItem
    // Scene-Item junction
    getItemsForScene: typeof getItemsForScene
    linkItemToScene: typeof linkItemToScene
    updateSceneItemStatus: typeof updateSceneItemStatus
    unlinkItemFromScene: typeof unlinkItemFromScene
    getSceneItemLinks: typeof getSceneItemLinks
    // Asset CRUD (Media Library)
    getAssets: typeof getAssets
    getAsset: typeof getAsset
    createAsset: typeof createAsset
    updateAsset: typeof updateAsset
    deleteAsset: typeof deleteAsset
    tagAssetForCampaign: typeof tagAssetForCampaign
    untagAsset: typeof untagAsset
    getAssetsForCampaign: typeof getAssetsForCampaign
    // Player characters (Sprint 21c)
    getPlayerCharacters: typeof getPlayerCharacters
    createPlayerCharacter: typeof createPlayerCharacter
    deletePlayerCharacter: typeof deletePlayerCharacter
}

export function createDBInterface(): DBInterface {
    return {
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
        getNoteBySourceFile,
        getNotesForScene,
        getScenesForNote,
        linkNoteToScene,
        unlinkNoteFromScene,
        getSceneNoteLinks,
        getNPCsForScene,
        linkNPCToScene,
        unlinkNPCFromScene,
        getSceneNPCLinks,
        // Item CRUD
        getItems,
        getItem,
        createItem,
        updateItem,
        deleteItem,
        // Scene-Item junction
        getItemsForScene,
        linkItemToScene,
        updateSceneItemStatus,
        unlinkItemFromScene,
        getSceneItemLinks,
        // Asset CRUD (Media Library)
        getAssets,
        getAsset,
        createAsset,
        updateAsset,
        deleteAsset,
        tagAssetForCampaign,
        untagAsset,
        getAssetsForCampaign,
        getPlayerCharacters,
        createPlayerCharacter,
        deletePlayerCharacter,
    }
}
