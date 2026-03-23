/**
 * Asset database module — Media Library CRUD operations.
 * Follows the same patterns as db.ts: column whitelists, typed rows, parse functions.
 *
 * IMPORTANT: Same constraint as db.ts — Electron main process only.
 */
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { MediaAsset, AssetFilter, CreateAssetInput, UpdateAssetInput, MediaType, AssetCategory, PlaybackMode } from '@shared/asset-types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetRow {
    id: string
    file_path: string
    file_name: string
    media_type: string
    file_size: number
    width: number | null
    height: number | null
    duration: number | null
    categories: string     // JSON array
    tags: string           // JSON array
    playback_mode: string
    thumbnail: string | null
    created_at: string
    updated_at: string
}

// ── Column whitelist ──────────────────────────────────────────────────────────

const ASSET_COLUMNS = new Set([
    'file_name', 'categories', 'tags', 'playback_mode', 'thumbnail', 'updated_at',
])

function assertColumn(col: string, allowed: Set<string>): void {
    if (!allowed.has(col)) throw new Error(`Invalid column: ${col}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_MEDIA_TYPES = new Set<MediaType>(['image', 'video', 'audio'])
const VALID_PLAYBACK_MODES = new Set<PlaybackMode>(['loop', 'once', 'freeze'])

function parseAssetRow(row: AssetRow): MediaAsset {
    return {
        id: row.id,
        filePath: row.file_path,
        fileName: row.file_name,
        mediaType: VALID_MEDIA_TYPES.has(row.media_type as MediaType) ? row.media_type as MediaType : 'image',
        fileSize: row.file_size,
        width: row.width,
        height: row.height,
        duration: row.duration,
        categories: JSON.parse(row.categories) as AssetCategory[],
        tags: JSON.parse(row.tags) as string[],
        playbackMode: VALID_PLAYBACK_MODES.has(row.playback_mode as PlaybackMode) ? row.playback_mode as PlaybackMode : 'loop',
        thumbnail: row.thumbnail,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

// ── DB accessor ──────────────────────────────────────────────────────────────
// Asset-db shares the same singleton db as db.ts.
// We accept it via dependency injection to avoid circular imports.

let _db: Database.Database | null = null

export function setAssetDB(db: Database.Database): void {
    _db = db
}

function getDB(): Database.Database {
    if (!_db) throw new Error('[asset-db] Database not set. Call setAssetDB() first.')
    return _db
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** List all assets, optionally filtered. */
export function getAssets(filter?: AssetFilter): MediaAsset[] {
    const conditions: string[] = []
    const values: unknown[] = []

    if (filter?.mediaType) {
        conditions.push('media_type = ?')
        values.push(filter.mediaType)
    }

    if (filter?.category) {
        // JSON array contains check — SQLite json_each
        conditions.push("EXISTS (SELECT 1 FROM json_each(categories) WHERE json_each.value = ?)")
        values.push(filter.category)
    }

    if (filter?.search) {
        conditions.push('(file_name LIKE ? OR EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value LIKE ?))')
        const term = `%${filter.search}%`
        values.push(term, term)
    }

    if (filter?.campaignId) {
        conditions.push('id IN (SELECT asset_id FROM asset_campaign_tags WHERE campaign_id = ?)')
        values.push(filter.campaignId)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = getDB()
        .prepare(`SELECT * FROM assets ${where} ORDER BY created_at DESC`)
        .all(...values) as AssetRow[]

    return rows.map(parseAssetRow)
}

/** Get a single asset by ID. */
export function getAsset(id: string): MediaAsset | undefined {
    const row = getDB()
        .prepare('SELECT * FROM assets WHERE id = ?')
        .get(id) as AssetRow | undefined

    return row ? parseAssetRow(row) : undefined
}

/** Create a new asset record. */
export function createAsset(input: CreateAssetInput): MediaAsset {
    const id = randomUUID()
    const now = new Date().toISOString()

    getDB().prepare(`
        INSERT INTO assets (
            id, file_path, file_name, media_type, file_size,
            width, height, duration, categories, tags,
            playback_mode, thumbnail, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.filePath,
        input.fileName,
        input.mediaType,
        input.fileSize,
        input.width ?? null,
        input.height ?? null,
        input.duration ?? null,
        JSON.stringify(input.categories ?? []),
        JSON.stringify(input.tags ?? []),
        input.playbackMode ?? 'loop',
        input.thumbnail ?? null,
        now,
        now,
    )

    return getAsset(id)!
}

/** Update mutable fields on an asset. */
export function updateAsset(id: string, data: UpdateAssetInput): MediaAsset {
    const now = new Date().toISOString()
    assertColumn('updated_at', ASSET_COLUMNS)
    const sets: string[] = ['updated_at = ?']
    const values: unknown[] = [now]

    if (data.fileName !== undefined) { assertColumn('file_name', ASSET_COLUMNS); sets.push('file_name = ?'); values.push(data.fileName) }
    if (data.categories !== undefined) { assertColumn('categories', ASSET_COLUMNS); sets.push('categories = ?'); values.push(JSON.stringify(data.categories)) }
    if (data.tags !== undefined) { assertColumn('tags', ASSET_COLUMNS); sets.push('tags = ?'); values.push(JSON.stringify(data.tags)) }
    if (data.playbackMode !== undefined) { assertColumn('playback_mode', ASSET_COLUMNS); sets.push('playback_mode = ?'); values.push(data.playbackMode) }
    if (data.thumbnail !== undefined) { assertColumn('thumbnail', ASSET_COLUMNS); sets.push('thumbnail = ?'); values.push(data.thumbnail) }

    values.push(id)
    getDB().prepare(`UPDATE assets SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return getAsset(id)!
}

/** Delete an asset record. */
export function deleteAsset(id: string): void {
    getDB().prepare('DELETE FROM assets WHERE id = ?').run(id)
}

// ── Campaign tagging ──────────────────────────────────────────────────────────

/** Tag an asset for a specific campaign. */
export function tagAssetForCampaign(assetId: string, campaignId: string): void {
    getDB().prepare(`
        INSERT OR IGNORE INTO asset_campaign_tags (asset_id, campaign_id)
        VALUES (?, ?)
    `).run(assetId, campaignId)
}

/** Remove an asset's campaign tag. */
export function untagAsset(assetId: string, campaignId: string): void {
    getDB().prepare('DELETE FROM asset_campaign_tags WHERE asset_id = ? AND campaign_id = ?')
        .run(assetId, campaignId)
}

/** Get all assets tagged for a specific campaign. */
export function getAssetsForCampaign(campaignId: string): MediaAsset[] {
    const rows = getDB().prepare(`
        SELECT a.* FROM assets a
        JOIN asset_campaign_tags t ON a.id = t.asset_id
        WHERE t.campaign_id = ?
        ORDER BY a.created_at DESC
    `).all(campaignId) as AssetRow[]

    return rows.map(parseAssetRow)
}
