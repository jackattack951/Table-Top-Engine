/**
 * Obsidian vault importer — Electron main process only.
 *
 * Reads an Obsidian vault (markdown files + YAML frontmatter),
 * indexes content into SQLite as Note entities, and watches for file changes.
 *
 * Sprint 8e: Overhauled to create Note entities (not just scene.notes strings),
 * with re-import merge logic, trigger parsing, and single-file import support.
 *
 * IMPORTANT: Never import this file in src/ui/ or src/api/.
 * Uses Node.js fs module — main process only.
 *
 * Frontmatter parsing: no YAML library is used. A simple regex extracts
 * content between the first and second `---` delimiters, then parses
 * `key: value` lines. This is intentional per architecture rules.
 */
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import type { DBInterface } from '@core/db/db'
import type { ImportResult, NoteType, Note } from '@core/types'

// Re-export so callers that previously imported from here still compile.
export type { ImportResult }

interface ParsedFrontmatter {
    type?: string
    tags?: string[]
    npc_name?: string
    ac?: number
    hp?: number
    [key: string]: unknown
}

/**
 * A trigger parsed from frontmatter `trigger_N: Label|type|value` format.
 */
export interface ParsedTrigger {
    label: string
    triggerType: string
    value: string
}

/**
 * Options for import operations.
 */
export interface ImportOptions {
    /** When true, `type: scene` notes also auto-create a Scene entity + link. Default: true. */
    autoCreateScenes?: boolean
}

const VALID_NOTE_TYPES = new Set<NoteType>(['scene', 'location', 'npc', 'lore', 'general'])

// ── Module-level watcher state ────────────────────────────────────────────────

let activeWatcher: fs.FSWatcher | null = null
let watchedVaultPath: string | null = null
let watchedCampaignId: string | null = null
let watchedDB: DBInterface | null = null
let watchedOptions: ImportOptions | null = null

// ── Frontmatter parser ────────────────────────────────────────────────────────

/**
 * Extracts YAML frontmatter from a markdown file's raw content.
 * Parses the block between the first and second `---` delimiters.
 * Only handles simple `key: value` pairs — no nested YAML.
 */
export function parseFrontmatter(content: string): { frontmatter: ParsedFrontmatter; body: string } {
    const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
    const match = frontmatterPattern.exec(content)

    if (!match) {
        return { frontmatter: {}, body: content }
    }

    const rawFrontmatter = match[1] ?? ''
    const body = match[2] ?? ''
    const frontmatter: ParsedFrontmatter = {}

    for (const line of rawFrontmatter.split('\n')) {
        const colonIdx = line.indexOf(':')
        if (colonIdx === -1) continue

        const key = line.slice(0, colonIdx).trim()
        const rawValue = line.slice(colonIdx + 1).trim()

        if (!key) continue

        // Handle array values: `tags: [foo, bar]` or `tags: foo`
        if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
            frontmatter[key] = rawValue
                .slice(1, -1)
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
        } else if (rawValue === 'true') {
            frontmatter[key] = true
        } else if (rawValue === 'false') {
            frontmatter[key] = false
        } else if (rawValue !== '' && !isNaN(Number(rawValue))) {
            frontmatter[key] = Number(rawValue)
        } else {
            frontmatter[key] = rawValue
        }
    }

    return { frontmatter, body }
}

// ── Trigger parser ───────────────────────────────────────────────────────────

/**
 * Extracts trigger definitions from frontmatter.
 * Triggers are frontmatter keys matching `trigger_\d+` with values in
 * the format `Label|type|value` (split on `|`).
 *
 * Example:
 *   trigger_1: Thunder Crack|sfx|thunder
 *   trigger_2: Tense Music|mood|0.8
 */
export function parseTriggers(frontmatter: ParsedFrontmatter): ParsedTrigger[] {
    const triggerPattern = /^trigger_\d+$/
    const triggers: ParsedTrigger[] = []

    for (const [key, value] of Object.entries(frontmatter)) {
        if (!triggerPattern.test(key)) continue
        if (typeof value !== 'string') continue

        const parts = value.split('|')
        if (parts.length >= 3) {
            triggers.push({
                label: parts[0]!.trim(),
                triggerType: parts[1]!.trim(),
                value: parts[2]!.trim(),
            })
        }
    }

    return triggers
}

// ── Note type resolver ───────────────────────────────────────────────────────

/**
 * Resolves the NoteType from the frontmatter `type` field.
 * Returns 'general' when no type or unrecognised type is specified.
 */
function resolveNoteType(frontmatter: ParsedFrontmatter): NoteType {
    const raw = typeof frontmatter.type === 'string' ? frontmatter.type.toLowerCase() : null
    if (raw && VALID_NOTE_TYPES.has(raw as NoteType)) {
        return raw as NoteType
    }
    return 'general'
}

/**
 * Extracts tags from frontmatter. Returns an empty array if no tags.
 */
function extractTags(frontmatter: ParsedFrontmatter): string[] {
    if (Array.isArray(frontmatter.tags)) {
        return frontmatter.tags.filter((t): t is string => typeof t === 'string')
    }
    if (typeof frontmatter.tags === 'string' && frontmatter.tags.length > 0) {
        return [frontmatter.tags]
    }
    return []
}

// ── Single-file importer ──────────────────────────────────────────────────────

/**
 * Imports a single markdown file into the database as a Note entity.
 * Returns 'imported' or an error string.
 *
 * Sprint 8e: Now creates Note entities for ALL file types, with re-import
 * merge logic and optional auto-create scenes.
 */
async function importFile(
    filePath: string,
    campaignId: string,
    db: DBInterface,
    options: ImportOptions = {},
): Promise<'imported' | string> {
    const autoCreateScenes = options.autoCreateScenes !== false // default true

    try {
        const raw = await fsPromises.readFile(filePath, 'utf-8')
        const fileName = path.basename(filePath, '.md')
        const { frontmatter, body } = parseFrontmatter(raw)
        const noteType = resolveNoteType(frontmatter)
        const tags = extractTags(frontmatter)
        const triggers = parseTriggers(frontmatter)
        const absolutePath = path.resolve(filePath)

        // Append trigger info to tags for discoverability
        const triggerTags = triggers.map((t) => `trigger:${t.label}`)
        const allTags = [...new Set([...tags, ...triggerTags])]

        // ── Re-import merge: match by sourceFile ──────────────────────────────
        const existingNote = db.getNoteBySourceFile(campaignId, absolutePath)

        let note: Note
        if (existingNote) {
            // Update body and tags from file, but do NOT overwrite title
            // (user may have manually renamed it in the app)
            note = db.updateNote(existingNote.id, {
                body,
                tags: allTags,
                type: noteType,
            })
        } else {
            // Create new Note entity
            note = db.createNote({
                campaignId,
                title: fileName,
                type: noteType,
                body,
                tags: allTags,
                sourceFile: absolutePath,
                pinned: false,
                archived: false,
                status: null,
                color: null,
            })
        }

        // ── Type-specific side effects ────────────────────────────────────────

        if (noteType === 'npc') {
            // Keep existing NPC creation behavior alongside Note creation
            const npcs = db.getNPCs(campaignId)
            const npcName = typeof frontmatter.npc_name === 'string'
                ? frontmatter.npc_name
                : fileName

            const existingNPC = npcs.find((n) => n.name === npcName)

            const statBlock: Record<string, unknown> = {}
            if (typeof frontmatter.ac === 'number') statBlock['ac'] = frontmatter.ac
            if (typeof frontmatter.hp === 'number') statBlock['hp'] = frontmatter.hp

            // Copy any other frontmatter fields (str, dex, con, etc.) into statBlock
            for (const [k, v] of Object.entries(frontmatter)) {
                if (!['type', 'tags', 'npc_name', 'ac', 'hp'].includes(k) && !(/^trigger_\d+$/.test(k))) {
                    statBlock[k] = v
                }
            }

            if (existingNPC) {
                db.updateNPC(existingNPC.id, {
                    statBlock,
                    notes: body,
                })
            } else {
                db.createNPC({
                    campaignId,
                    name: npcName,
                    statBlock,
                    personality: '',
                    notes: body,
                })
            }
        }

        if (noteType === 'scene' && autoCreateScenes) {
            // Auto-create Scene + link to Note
            const scenes = db.getScenes(campaignId)
            const existingScene = scenes.find((s) => s.name === fileName)

            if (existingScene) {
                // Update scene notes field (legacy), but NEVER overwrite scratchpad
                db.updateScene(existingScene.id, { notes: body })
                // Ensure the link exists
                db.linkNoteToScene(existingScene.id, note.id)
            } else {
                const scene = db.createScene({
                    campaignId,
                    name: fileName,
                    sortOrder: scenes.length,
                    backgroundPath: null,
                    overlays: [],
                    particles: { type: 'none', intensity: 0 },
                    colorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#000000' },
                    gbColorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff' },
                    audioMood: 0.3,
                    notes: body,
                    linkedNPCIds: [],
                    linkedLocationIds: [],
                    scratchpad: '',
                    branches: [],
                })
                db.linkNoteToScene(scene.id, note.id)
            }
        }

        return 'imported'
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `Error in ${path.basename(filePath)}: ${message}`
    }
}

// ── Vault walker ──────────────────────────────────────────────────────────────

/**
 * Recursively collects all .md file paths within a directory.
 */
function collectMarkdownFiles(dir: string): string[] {
    const results: string[] = []
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
            // Skip Obsidian's hidden .obsidian config directory
            if (entry.name.startsWith('.')) continue
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                results.push(...collectMarkdownFiles(full))
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                results.push(full)
            }
        }
    } catch (err) {
        console.warn(`[obsidian-importer] cannot read directory ${dir}:`, err)
    }
    return results
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Walks the vault, parses frontmatter, and indexes matching files into SQLite
 * as Note entities.
 * Returns import counts and any error messages.
 */
export async function importVault(
    vaultPath: string,
    campaignId: string,
    db: DBInterface,
    options: ImportOptions = {},
): Promise<ImportResult> {
    if (!fs.existsSync(vaultPath)) {
        return { imported: 0, skipped: 0, errors: [`Vault path not found: ${vaultPath}`] }
    }

    const files = collectMarkdownFiles(vaultPath)
    let imported = 0
    // All .md files now produce Note entities (general type by default), so nothing is skipped.
    const skipped = 0
    const errors: string[] = []

    for (const file of files) {
        const result = await importFile(file, campaignId, db, options)
        if (result === 'imported') {
            imported++
        } else {
            errors.push(result)
        }
    }

    return { imported, skipped, errors }
}

/**
 * Imports a single markdown file into the database as a Note entity.
 * Exposed for the IMPORT_SINGLE_FILE IPC handler.
 *
 * @param filePath Absolute path to a single .md file
 * @param campaignId Target campaign
 * @param db Database interface
 * @param options Import options (autoCreateScenes, etc.)
 * @returns ImportResult with counts
 */
export async function importSingleFile(
    filePath: string,
    campaignId: string,
    db: DBInterface,
    options: ImportOptions = {},
): Promise<ImportResult> {
    if (!fs.existsSync(filePath)) {
        return { imported: 0, skipped: 0, errors: [`File not found: ${filePath}`] }
    }
    if (!filePath.endsWith('.md')) {
        return { imported: 0, skipped: 0, errors: ['Only .md files are supported'] }
    }

    const result = await importFile(filePath, campaignId, db, options)
    if (result === 'imported') {
        return { imported: 1, skipped: 0, errors: [] }
    }
    return { imported: 0, skipped: 0, errors: [result] }
}

/**
 * Starts watching the vault directory for file changes.
 * Re-imports only the changed file on each event.
 * Replaces any previously active watcher.
 */
export function startWatching(
    vaultPath: string,
    campaignId: string,
    db: DBInterface,
    options: ImportOptions = {},
): void {
    stopWatching()

    if (!fs.existsSync(vaultPath)) {
        console.warn(`[obsidian-importer] cannot watch — vault path not found: ${vaultPath}`)
        return
    }

    watchedVaultPath = vaultPath
    watchedCampaignId = campaignId
    watchedDB = db
    watchedOptions = options

    // Debounce rapid successive events (editors often emit multiple events per save)
    const pendingFiles = new Map<string, ReturnType<typeof setTimeout>>()

    activeWatcher = fs.watch(vaultPath, { recursive: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.md')) return

        const filePath = path.join(vaultPath, filename)

        // Clear any pending re-import for this file
        const pending = pendingFiles.get(filePath)
        if (pending) clearTimeout(pending)

        // Debounce 300ms — coalesces rapid editor saves
        pendingFiles.set(
            filePath,
            setTimeout(() => {
                pendingFiles.delete(filePath)
                if (!fs.existsSync(filePath)) return // file was deleted

                void importFile(filePath, campaignId, db, options).then((result) => {
                    if (result !== 'imported') {
                        console.warn(`[obsidian-importer] re-import error: ${result}`)
                    }
                })
            }, 300),
        )
    })

    activeWatcher.on('error', (err) => {
        console.warn('[obsidian-importer] watcher error:', err)
    })

}

/**
 * Stops any active vault watcher.
 */
export function stopWatching(): void {
    if (activeWatcher) {
        activeWatcher.close()
        activeWatcher = null
    }
    watchedVaultPath = null
    watchedCampaignId = null
    watchedDB = null
    watchedOptions = null
}

