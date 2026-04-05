import { join, resolve } from 'path'
import { existsSync } from 'fs'
import express from 'express'
import { createServer as createHttpServer } from 'http'
import { Server } from 'socket.io'
import { EVENTS } from '../../shared/socket-events'
import type { DisplayInfo } from '../../shared/output-types'
import type { SessionState, CharacterSelectMode } from '../../shared/player-types'
import { MAX_PLAYERS } from '../../shared/player-types'
import type { AppConfig, Note, NoteType, Item } from '../core/types'
import { ITEM_RARITIES, ITEM_CATEGORIES, ITEM_STATUSES } from '../core/types'
import type { DBInterface } from '../core/db/db'
import { getLANInfo } from '../core/network/lan-info'
import { getMetrics } from '../core/perf/perf-monitor'
import { registerPlayerHandlers } from './player-handlers'
import { registerSceneHandlers } from './scene-handlers'
import { registerAVHandlers } from './av-handlers'
import type { ServerState } from './server-types'
import { parseDocument } from '../systems/import/document-parser'
import { runImportPipeline } from '../systems/import/import-pipeline'

// Vite cockpit dev server port (npm run dev:cockpit)
const VITE_COCKPIT_PORT = 5180

/**
 * Express + Socket.io server.
 * Runs in the Electron main process.
 * Serves the cockpit web UI and relays real-time commands.
 *
 * Dev:  cockpit runs on Vite at :5173 — Express redirects / there
 * Prod: cockpit static files served from out/cockpit/
 *
 * Rooms:
 *   'av-display' — AV Display BrowserWindow
 *   'cockpit'    — All cockpit clients (iPad, browser, second desktop)
 *
 * @param config - Application configuration (mode, port, etc.)
 * @param onModeChange - Optional callback invoked when a cockpit client emits
 *   APP_MODE_CHANGE. Runs in the Electron main process context so it can
 *   create or destroy BrowserWindows. Not used outside Electron.
 * @param dbInterface - Optional typed DB functions injected from main process.
 *   Avoids importing `electron` (and better-sqlite3) into server.ts directly,
 *   which would break when this module is loaded by test runners or LAN clients.
 * @param options - Optional overrides for production path resolution and dev detection.
 *   `isDev` defaults to NODE_ENV check; `cockpitDistPath` defaults to sibling dir.
 */
export function createServer(
    config: AppConfig,
    onModeChange?: (mode: AppConfig['appMode']) => void,
    dbInterface?: DBInterface,
    options?: {
        cockpitDistPath?: string
        companionDistPath?: string
        isDev?: boolean
        onOutputEnable?: (displayId: number | 'windowed', role: string) => void
        onOutputDisable?: (role: string) => void
        onGetDisplays?: () => DisplayInfo[]
    },
): void {
    const expressApp = express()
    const httpServer = createHttpServer(expressApp)
    const io = new Server(httpServer, {
        cors: { origin: '*' } // LAN clients — no auth on socket connection itself
    })

    expressApp.use(express.json({ limit: '5mb' }))

    // CORS for REST routes — AV Display loads from a different origin (electron-vite dev server or file://)
    expressApp.use((_req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*')
        res.header('Access-Control-Allow-Headers', 'Content-Type')
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        next()
    })

    // Mutable server state — reset when server restarts
    const serverState: ServerState = {
        activeCampaignId: null,
        activeCampaignName: null,
        activeSceneId: null,
        combatState: null,
        moodValue: 0.3,
        avState: null,
        appMode: config.appMode,
        previewActive: false,
    }

    // ── Session state (Sprint 11b) — separate lifecycle from serverState ────────
    let sessionState: SessionState | null = null
    const tokenToSocket = new Map<string, string>() // token → socket.id
    const socketToToken = new Map<string, string>() // socket.id → token

    // Session code: 6 uppercase alphanumeric, no ambiguous chars (0/O/I/L/1)
    const SESSION_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

    function generateSessionCode(): string {
        let code = ''
        for (let i = 0; i < 6; i++) {
            code += SESSION_CODE_CHARS[Math.floor(Math.random() * SESSION_CODE_CHARS.length)]
        }
        return code
    }

    // ── Static file serving ─────────────────────────────────────────────────────
    // Route order is CRITICAL:
    //   1. express.json() middleware (above)
    //   2. /api/* REST routes (below)
    //   3. /companion static + SPA fallback (before cockpit catch-all)
    //   4. Cockpit static + /* SPA catch-all (last)
    const isDev = options?.isDev ?? (process.env['NODE_ENV'] !== 'production')
    const cockpitDist = options?.cockpitDistPath ?? join(__dirname, '../cockpit')
    const companionDist = options?.companionDistPath ?? join(__dirname, '../companion')

    // Audio stems + SFX served at /audio/* (Sprint 17c)
    const audioDir = resolve(__dirname, '../../src/systems/audio')
    if (existsSync(audioDir)) {
        expressApp.use('/audio', express.static(audioDir))
    }

    // Companion static files served at /companion/*
    expressApp.use('/companion', express.static(companionDist))
    // Companion SPA fallback — any /companion/* route that isn't a file → serve companion index.html
    expressApp.get('/companion/*', (_req, res) => {
        res.sendFile(join(companionDist, 'index.html'))
    })

    // Cockpit static files
    expressApp.use(express.static(cockpitDist))
    // Cockpit SPA catch-all is registered after all API routes (see end of route block)

    if (isDev) {
        expressApp.get('/dev-info', (_req, res) => {
            res.json({
                mode: 'development',
                cockpit: `http://localhost:${VITE_COCKPIT_PORT}`,
                socket: `http://localhost:${config.serverPort}`,
                avDisplay: `http://localhost:5174`,
            })
        })
    }

    // ── REST routes (state queries + CRUD) ─────────────────────────────────────
    expressApp.get('/api/health', (_req, res) => {
        const campaignCount = dbInterface ? dbInterface.getCampaigns().length : 0
        res.json({ status: 'ok', mode: config.appMode, campaignCount })
    })

    expressApp.get('/api/lan-info', (_req, res) => {
        res.json(getLANInfo(config.serverPort))
    })

    expressApp.get('/api/perf', (_req, res) => {
        res.json(getMetrics())
    })

    // Sprint 11b: session info for companion join screen
    expressApp.get('/api/session', (_req, res) => {
        if (!sessionState) {
            res.status(404).json({ error: 'No active session' })
            return
        }
        res.json({
            sessionCode: sessionState.sessionCode,
            phase: sessionState.phase,
            playerCount: Object.keys(sessionState.players).length,
        })
    })

    // Sprint 9b: display list for output management
    expressApp.get('/api/displays', (_req, res) => {
        const displays = options?.onGetDisplays?.() ?? []
        res.json(displays)
    })

    // ── Campaign routes ─────────────────────────────────────────────────────────

    expressApp.get('/api/campaigns', (_req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        try {
            res.json(dbInterface.getCampaigns())
        } catch (err) {
            console.error('[api] GET /api/campaigns error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.post('/api/campaigns', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const { name, system } = req.body as { name?: unknown; system?: unknown }
        if (typeof name !== 'string' || name.trim() === '') {
            res.status(400).json({ error: 'name is required and must be a non-empty string' })
            return
        }
        try {
            const campaign = dbInterface.createCampaign({
                name: name.trim(),
                system: typeof system === 'string' && system.trim() !== '' ? system.trim() : '5e',
            })
            res.status(201).json(campaign)
        } catch (err) {
            console.error('[api] POST /api/campaigns error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.get('/api/campaigns/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaign = dbInterface.getCampaign(req.params['id'] ?? '')
        if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return }
        res.json(campaign)
    })

    expressApp.patch('/api/campaigns/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(id)) { res.status(404).json({ error: 'Campaign not found' }); return }
        try {
            const { name, system, startingSceneId } = req.body as { name?: unknown; system?: unknown; startingSceneId?: unknown }
            const data: { name?: string; system?: string; startingSceneId?: string | null } = {}
            if (typeof name === 'string') data.name = name
            if (typeof system === 'string') data.system = system
            if (startingSceneId === null || typeof startingSceneId === 'string') data.startingSceneId = startingSceneId
            const updated = dbInterface.updateCampaign(id, data)
            res.json(updated)
        } catch (err) {
            console.error('[api] PATCH /api/campaigns/:id error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.delete('/api/campaigns/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(id)) { res.status(404).json({ error: 'Campaign not found' }); return }
        dbInterface.deleteCampaign(id)
        res.status(204).send()
    })

    // ── Scene routes ────────────────────────────────────────────────────────────

    expressApp.get('/api/campaigns/:id/scenes', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        res.json(dbInterface.getScenes(campaignId))
    })

    expressApp.post('/api/campaigns/:id/scenes', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        const { name } = req.body as { name?: unknown }
        if (typeof name !== 'string' || name.trim() === '') {
            res.status(400).json({ error: 'name is required' })
            return
        }
        try {
            const existingScenes = dbInterface.getScenes(campaignId)
            const scene = dbInterface.createScene({
                campaignId,
                name: name.trim(),
                sortOrder: existingScenes.length,
                backgroundPath: null,
                overlays: [],
                particles: { type: 'none', intensity: 0 },
                colorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#000000' },
                audioMood: 0.3,
                notes: '',
                linkedNPCIds: [],
                linkedLocationIds: [],
                scratchpad: '',
                branches: [],
                fogEnabled: false,
                fogData: null,
            })
            res.status(201).json(scene)
        } catch (err) {
            console.error('[api] POST /api/campaigns/:id/scenes error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.get('/api/scenes/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const scene = dbInterface.getScene(req.params['id'] ?? '')
        if (!scene) { res.status(404).json({ error: 'Scene not found' }); return }
        res.json(scene)
    })

    expressApp.get('/api/scenes/:id/summary', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        const scene = dbInterface.getScene(id)
        if (!scene) { res.status(404).json({ error: 'Scene not found' }); return }
        try {
            const npcs = dbInterface.getNPCsForScene(id)
            const notes = dbInterface.getNotesForScene(id)
            const items = dbInterface.getItemsForScene(id)
            const bgAsset = scene.backgroundAssetId ? (dbInterface.getAsset(scene.backgroundAssetId) ?? null) : null
            const gbAsset = scene.gameboardAssetId ? (dbInterface.getAsset(scene.gameboardAssetId) ?? null) : null
            res.json({ scene, npcs, notes, items, bgAsset, gbAsset })
        } catch (err) {
            console.error('[api] GET /api/scenes/:id/summary error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.patch('/api/scenes/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getScene(id)) { res.status(404).json({ error: 'Scene not found' }); return }
        try {
            const body = req.body as Partial<{
                name: string
                sortOrder: number
                backgroundPath: string | null
                gameboardPath: string | null
                backgroundAssetId: string | null
                gameboardAssetId: string | null
                overlays: string[]
                particles: { type: string; intensity: number }
                colorGrade: Record<string, unknown>
                audioMood: number
                notes: string
                linkedNPCIds: string[]
                linkedLocationIds: string[]
                scratchpad: string
                branches: { label: string; targetSceneId: string; transitionNote: string }[]
                nextSceneId: string | null
            }>
            const updated = dbInterface.updateScene(id, body as Parameters<typeof dbInterface.updateScene>[1])
            res.json(updated)
        } catch (err) {
            console.error('[api] PATCH /api/scenes/:id error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.delete('/api/scenes/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getScene(id)) { res.status(404).json({ error: 'Scene not found' }); return }
        dbInterface.deleteScene(id)
        res.status(204).send()
    })

    // ── NPC routes ──────────────────────────────────────────────────────────────

    expressApp.get('/api/campaigns/:id/npcs', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        res.json(dbInterface.getNPCs(campaignId))
    })

    expressApp.post('/api/campaigns/:id/npcs', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        const { name, statBlock, personality, notes } = req.body as {
            name?: unknown
            statBlock?: unknown
            personality?: unknown
            notes?: unknown
        }
        if (typeof name !== 'string' || name.trim() === '') {
            res.status(400).json({ error: 'name is required' })
            return
        }
        try {
            const npc = dbInterface.createNPC({
                campaignId,
                name: name.trim(),
                statBlock: (statBlock !== null && typeof statBlock === 'object' ? statBlock : {}) as Record<string, unknown>,
                personality: typeof personality === 'string' ? personality : '',
                notes: typeof notes === 'string' ? notes : '',
            })
            res.status(201).json(npc)
        } catch (err) {
            console.error('[api] POST /api/campaigns/:id/npcs error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.patch('/api/npcs/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getNPC(id)) { res.status(404).json({ error: 'NPC not found' }); return }
        try {
            const body = req.body as Partial<{
                name: string
                statBlock: Record<string, unknown>
                personality: string
                notes: string
            }>
            const updated = dbInterface.updateNPC(id, body as Parameters<typeof dbInterface.updateNPC>[1])
            res.json(updated)
        } catch (err) {
            console.error('[api] PATCH /api/npcs/:id error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.delete('/api/npcs/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getNPC(id)) { res.status(404).json({ error: 'NPC not found' }); return }
        dbInterface.deleteNPC(id)
        res.status(204).send()
    })

    // ── Note routes ─────────────────────────────────────────────────────────────

    expressApp.get('/api/campaigns/:id/notes', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        const typeFilter = req.query['type'] as string | undefined
        const validTypes = new Set(['scene', 'location', 'npc', 'lore', 'general', 'quest', 'session', 'faction'])
        if (typeFilter && !validTypes.has(typeFilter)) {
            res.status(400).json({ error: 'Invalid type filter' })
            return
        }
        res.json(dbInterface.getNotes(campaignId, typeFilter as NoteType | undefined))
    })

    expressApp.post('/api/campaigns/:id/notes', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        const { title, type, body, tags, pinned, archived, status, color } = req.body as {
            title?: unknown; type?: unknown; body?: unknown; tags?: unknown
            pinned?: unknown; archived?: unknown; status?: unknown; color?: unknown
        }
        if (typeof title !== 'string' || title.trim() === '') {
            res.status(400).json({ error: 'title is required and must be a non-empty string' })
            return
        }
        try {
            const validNoteTypes = ['scene', 'location', 'npc', 'lore', 'general', 'quest', 'session', 'faction']
            const validColors = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink']
            const note = dbInterface.createNote({
                campaignId,
                title: title.trim(),
                type: typeof type === 'string' && validNoteTypes.includes(type)
                    ? type as NoteType : 'general',
                body: typeof body === 'string' ? body : '',
                tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [],
                sourceFile: null,
                pinned: pinned === true,
                archived: archived === true,
                status: typeof status === 'string' ? status : null,
                color: typeof color === 'string' && validColors.includes(color) ? color as Note['color'] : null,
            })
            res.status(201).json(note)
        } catch (err) {
            console.error('[api] POST /api/campaigns/:id/notes error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.get('/api/notes/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const note = dbInterface.getNote(req.params['id'] ?? '')
        if (!note) { res.status(404).json({ error: 'Note not found' }); return }
        res.json(note)
    })

    expressApp.patch('/api/notes/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getNote(id)) { res.status(404).json({ error: 'Note not found' }); return }
        try {
            const { title, type, body, tags, pinned, archived, status, color } = req.body as {
                title?: unknown; type?: unknown; body?: unknown; tags?: unknown
                pinned?: unknown; archived?: unknown; status?: unknown; color?: unknown
            }
            const validNoteTypes = ['scene', 'location', 'npc', 'lore', 'general', 'quest', 'session', 'faction']
            const validColors = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink']
            const data: Partial<{ title: string; type: NoteType; body: string; tags: string[]; pinned: boolean; archived: boolean; status: string | null; color: Note['color'] | null }> = {}
            if (typeof title === 'string') data.title = title
            if (typeof type === 'string' && validNoteTypes.includes(type)) {
                data.type = type as NoteType
            }
            if (typeof body === 'string') data.body = body
            if (Array.isArray(tags)) data.tags = tags.filter((t): t is string => typeof t === 'string')
            if (typeof pinned === 'boolean') data.pinned = pinned
            if (typeof archived === 'boolean') data.archived = archived
            if (status === null || typeof status === 'string') data.status = status as string | null
            if (color === null || (typeof color === 'string' && validColors.includes(color))) data.color = color as Note['color'] | null
            const updated = dbInterface.updateNote(id, data)
            res.json(updated)
        } catch (err) {
            console.error('[api] PATCH /api/notes/:id error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.delete('/api/notes/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getNote(id)) { res.status(404).json({ error: 'Note not found' }); return }
        dbInterface.deleteNote(id)
        res.status(204).send()
    })

    // ── Scene-Note bulk links (campaign-wide) ──────────────────────────────────

    expressApp.get('/api/campaigns/:id/scene-note-links', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        res.json(dbInterface.getSceneNoteLinks(campaignId))
    })

    // ── Scene-Note junction routes ───────────────────────────────────────────────

    expressApp.get('/api/scenes/:id/notes', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        res.json(dbInterface.getNotesForScene(sceneId))
    })

    expressApp.post('/api/scenes/:id/notes/:noteId', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        const noteId = req.params['noteId'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        if (!dbInterface.getNote(noteId)) { res.status(404).json({ error: 'Note not found' }); return }
        try {
            dbInterface.linkNoteToScene(sceneId, noteId)
            res.status(201).json({ linked: true })
        } catch (err) {
            console.error('[api] POST /api/scenes/:id/notes/:noteId error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.delete('/api/scenes/:id/notes/:noteId', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        const noteId = req.params['noteId'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        dbInterface.unlinkNoteFromScene(sceneId, noteId)
        res.status(204).send()
    })

    // ── Scene-NPC bulk links (campaign-wide) ──────────────────────────────────

    expressApp.get('/api/campaigns/:id/scene-npc-links', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        res.json(dbInterface.getSceneNPCLinks(campaignId))
    })

    // ── Scene-NPC junction routes ────────────────────────────────────────────────

    expressApp.get('/api/scenes/:id/npcs', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        res.json(dbInterface.getNPCsForScene(sceneId))
    })

    expressApp.post('/api/scenes/:id/npcs/:npcId', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        const npcId = req.params['npcId'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        if (!dbInterface.getNPC(npcId)) { res.status(404).json({ error: 'NPC not found' }); return }
        try {
            const { sortOrder } = req.body as { sortOrder?: unknown }
            const order = typeof sortOrder === 'number' ? sortOrder : 0
            dbInterface.linkNPCToScene(sceneId, npcId, order)
            res.status(201).json({ linked: true })
        } catch (err) {
            console.error('[api] POST /api/scenes/:id/npcs/:npcId error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.delete('/api/scenes/:id/npcs/:npcId', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        const npcId = req.params['npcId'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        dbInterface.unlinkNPCFromScene(sceneId, npcId)
        res.status(204).send()
    })

    // ── Item routes (Sprint 15g) ─────────────────────────────────────────────────

    expressApp.get('/api/campaigns/:id/items', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        try {
            res.json(dbInterface.getItems(campaignId))
        } catch (err) {
            console.error('[api] GET /api/campaigns/:id/items error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.post('/api/campaigns/:id/items', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        const { name, description, rarity, category, properties, tags, sourceNoteId } = req.body as {
            name?: unknown; description?: unknown; rarity?: unknown; category?: unknown
            properties?: unknown; tags?: unknown; sourceNoteId?: unknown
        }
        if (typeof name !== 'string' || name.trim() === '') {
            res.status(400).json({ error: 'name is required and must be a non-empty string' })
            return
        }
        const validRarities = new Set<string>(ITEM_RARITIES)
        const validCategories = new Set<string>(ITEM_CATEGORIES)
        if (typeof rarity === 'string' && rarity !== '' && !validRarities.has(rarity)) {
            res.status(400).json({ error: `Invalid rarity: ${rarity}` })
            return
        }
        if (typeof category === 'string' && category !== '' && !validCategories.has(category)) {
            res.status(400).json({ error: `Invalid category: ${category}` })
            return
        }
        try {
            const item = dbInterface.createItem({
                campaignId,
                name: name.trim(),
                description: typeof description === 'string' ? description : '',
                rarity: (typeof rarity === 'string' && validRarities.has(rarity)) ? rarity as Item['rarity'] : null,
                category: (typeof category === 'string' && validCategories.has(category)) ? category as Item['category'] : null,
                properties: Array.isArray(properties) ? properties.filter((p): p is string => typeof p === 'string') : [],
                tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [],
                sourceNoteId: typeof sourceNoteId === 'string' ? sourceNoteId : null,
            })
            res.status(201).json(item)
        } catch (err) {
            console.error('[api] POST /api/campaigns/:id/items error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.get('/api/items/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        try {
            const item = dbInterface.getItem(req.params['id'] ?? '')
            if (!item) { res.status(404).json({ error: 'Item not found' }); return }
            res.json(item)
        } catch (err) {
            console.error('[api] GET /api/items/:id error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.patch('/api/items/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getItem(id)) { res.status(404).json({ error: 'Item not found' }); return }
        const validRarities = new Set<string>(ITEM_RARITIES)
        const validCategories = new Set<string>(ITEM_CATEGORIES)
        try {
            const { name, description, rarity, category, properties, tags, sourceNoteId } = req.body as {
                name?: unknown; description?: unknown; rarity?: unknown; category?: unknown
                properties?: unknown; tags?: unknown; sourceNoteId?: unknown
            }
            if (typeof rarity === 'string' && rarity !== '' && !validRarities.has(rarity)) {
                res.status(400).json({ error: `Invalid rarity: ${rarity}` }); return
            }
            if (typeof category === 'string' && category !== '' && !validCategories.has(category)) {
                res.status(400).json({ error: `Invalid category: ${category}` }); return
            }
            const data: Partial<{ name: string; description: string; rarity: Item['rarity'] | null; category: Item['category'] | null; properties: string[]; tags: string[]; sourceNoteId: string | null }> = {}
            if (typeof name === 'string') data.name = name
            if (typeof description === 'string') data.description = description
            if (rarity === null) data.rarity = null
            else if (typeof rarity === 'string' && validRarities.has(rarity)) data.rarity = rarity as Item['rarity']
            if (category === null) data.category = null
            else if (typeof category === 'string' && validCategories.has(category)) data.category = category as Item['category']
            if (Array.isArray(properties)) data.properties = properties.filter((p): p is string => typeof p === 'string')
            if (Array.isArray(tags)) data.tags = tags.filter((t): t is string => typeof t === 'string')
            if (sourceNoteId === null || typeof sourceNoteId === 'string') data.sourceNoteId = sourceNoteId as string | null
            const updated = dbInterface.updateItem(id, data)
            res.json(updated)
        } catch (err) {
            console.error('[api] PATCH /api/items/:id error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.delete('/api/items/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getItem(id)) { res.status(404).json({ error: 'Item not found' }); return }
        dbInterface.deleteItem(id)
        res.status(204).send()
    })

    // ── Scene-Item junction routes (Sprint 16) ─────────────────────────────────

    expressApp.get('/api/scenes/:id/items', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        res.json(dbInterface.getItemsForScene(sceneId))
    })

    expressApp.post('/api/scenes/:id/items/:itemId', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        const itemId = req.params['itemId'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        if (!dbInterface.getItem(itemId)) { res.status(404).json({ error: 'Item not found' }); return }
        try {
            dbInterface.linkItemToScene(sceneId, itemId)
            res.status(201).json({ linked: true })
        } catch (err) {
            console.error('[api] POST /api/scenes/:id/items/:itemId error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    // PATCH /api/scenes/:id/items/:itemId/status — update item status within a scene
    expressApp.patch('/api/scenes/:id/items/:itemId/status', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        const itemId = req.params['itemId'] ?? ''
        const { status } = req.body as { status?: string }
        if (!status || !(ITEM_STATUSES as readonly string[]).includes(status)) {
            res.status(400).json({ error: `Status must be one of: ${ITEM_STATUSES.join(', ')}` }); return
        }
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        dbInterface.updateSceneItemStatus(sceneId, itemId, status)
        res.json({ sceneId, itemId, status })
    })

    expressApp.delete('/api/scenes/:id/items/:itemId', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const sceneId = req.params['id'] ?? ''
        const itemId = req.params['itemId'] ?? ''
        if (!dbInterface.getScene(sceneId)) { res.status(404).json({ error: 'Scene not found' }); return }
        dbInterface.unlinkItemFromScene(sceneId, itemId)
        res.status(204).send()
    })

    // ── Import pipeline route ────────────────────────────────────────────────────

    expressApp.post('/api/campaigns/:id/import', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) {
            res.status(404).json({ error: 'Campaign not found' }); return
        }
        const { text, extraction: clientExtraction, sourceFile } = req.body as {
            text?: unknown; extraction?: unknown; sourceFile?: unknown
        }

        try {
            // Accept pre-parsed extraction (from UI preview) or raw text
            let extraction: ReturnType<typeof parseDocument>
            if (clientExtraction && typeof clientExtraction === 'object') {
                extraction = clientExtraction as ReturnType<typeof parseDocument>
            } else if (typeof text === 'string' && text.trim()) {
                extraction = parseDocument(text)
            } else {
                res.status(400).json({ error: 'Either text or extraction is required' }); return
            }

            const result = runImportPipeline(extraction, campaignId, dbInterface, typeof sourceFile === 'string' ? sourceFile : null)
            res.json(result)
        } catch (err) {
            console.error('[api] POST /api/campaigns/:id/import error:', err)
            res.status(500).json({ error: 'Import failed' })
        }
    })

    // ── Scratchpad route ─────────────────────────────────────────────────────────

    expressApp.patch('/api/scenes/:id/scratchpad', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getScene(id)) { res.status(404).json({ error: 'Scene not found' }); return }
        const { scratchpad } = req.body as { scratchpad?: unknown }
        if (typeof scratchpad !== 'string') {
            res.status(400).json({ error: 'scratchpad must be a string' })
            return
        }
        try {
            const updated = dbInterface.updateScene(id, { scratchpad })
            res.json(updated)
        } catch (err) {
            console.error('[api] PATCH /api/scenes/:id/scratchpad error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    // ── Fog of War REST route ────────────────────────────────────────────────────

    // PATCH /api/scenes/:id/fog — persist fog bitmap and enabled state
    expressApp.patch('/api/scenes/:id/fog', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getScene(id)) { res.status(404).json({ error: 'Scene not found' }); return }
        const { fogData, fogEnabled } = req.body as { fogData?: unknown; fogEnabled?: unknown }
        if (fogData !== undefined && fogData !== null && typeof fogData !== 'string') {
            res.status(400).json({ error: 'fogData must be a base64 string or null' })
            return
        }
        if (fogEnabled !== undefined && typeof fogEnabled !== 'boolean') {
            res.status(400).json({ error: 'fogEnabled must be a boolean' })
            return
        }
        try {
            const patch: { fogData?: string | null; fogEnabled?: boolean } = {}
            if (fogData !== undefined) patch.fogData = fogData as string | null
            if (fogEnabled !== undefined) patch.fogEnabled = fogEnabled as boolean
            const updated = dbInterface.updateScene(id, patch)
            res.json(updated)
        } catch (err) {
            console.error('[api] PATCH /api/scenes/:id/fog error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    // ── Asset CRUD (Media Library) ──────────────────────────────────────────────

    // GET /api/assets — list all assets (with optional query filters)
    expressApp.get('/api/assets', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        try {
            const filter: Record<string, string | undefined> = {}
            if (typeof req.query['mediaType'] === 'string') filter.mediaType = req.query['mediaType']
            if (typeof req.query['category'] === 'string') filter.category = req.query['category']
            if (typeof req.query['campaignId'] === 'string') filter.campaignId = req.query['campaignId']
            if (typeof req.query['search'] === 'string') filter.search = req.query['search']
            const assets = dbInterface.getAssets(filter as Parameters<typeof dbInterface.getAssets>[0])
            res.json(assets)
        } catch (err) {
            console.error('[api] GET /api/assets error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    // GET /api/assets/:id — single asset
    expressApp.get('/api/assets/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const asset = dbInterface.getAsset(req.params['id'] ?? '')
        if (!asset) { res.status(404).json({ error: 'Asset not found' }); return }
        res.json(asset)
    })

    // POST /api/assets — create asset record
    expressApp.post('/api/assets', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const body = req.body as Record<string, unknown>
        const { filePath, fileName, mediaType } = body
        if (typeof filePath !== 'string' || !filePath.trim()) {
            res.status(400).json({ error: 'filePath must be a non-empty string' }); return
        }
        if (typeof fileName !== 'string' || !fileName.trim()) {
            res.status(400).json({ error: 'fileName must be a non-empty string' }); return
        }
        if (!['image', 'video', 'audio'].includes(mediaType as string)) {
            res.status(400).json({ error: 'mediaType must be image, video, or audio' }); return
        }
        try {
            const input = {
                filePath: filePath.trim(),
                fileName: fileName.trim(),
                mediaType: mediaType as 'image' | 'video' | 'audio',
                fileSize: typeof body.fileSize === 'number' ? body.fileSize : 0,
                width: typeof body.width === 'number' ? body.width : null,
                height: typeof body.height === 'number' ? body.height : null,
                categories: Array.isArray(body.categories) ? body.categories : [],
                tags: Array.isArray(body.tags) ? body.tags : [],
                playbackMode: ['loop', 'once', 'freeze'].includes(body.playbackMode as string)
                    ? (body.playbackMode as string) : 'loop',
            }
            const asset = dbInterface.createAsset(input)
            res.status(201).json(asset)
        } catch (err) {
            console.error('[api] POST /api/assets error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    // PATCH /api/assets/:id — update metadata/tags/playback mode
    expressApp.patch('/api/assets/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getAsset(id)) { res.status(404).json({ error: 'Asset not found' }); return }
        try {
            const updated = dbInterface.updateAsset(id, req.body)
            res.json(updated)
        } catch (err) {
            console.error('[api] PATCH /api/assets/:id error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    // DELETE /api/assets/:id — remove asset record
    expressApp.delete('/api/assets/:id', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getAsset(id)) { res.status(404).json({ error: 'Asset not found' }); return }
        dbInterface.deleteAsset(id)
        res.status(204).end()
    })

    // GET /api/assets/:id/file — stream the actual file (security: only serves DB-registered paths)
    expressApp.get('/api/assets/:id/file', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const asset = dbInterface.getAsset(req.params['id'] ?? '')
        if (!asset) { res.status(404).json({ error: 'Asset not found' }); return }
        const resolved = resolve(asset.filePath)
        if (!existsSync(resolved)) {
            res.status(404).json({ error: 'File not found on disk' })
            return
        }
        res.sendFile(resolved, (err) => {
            if (err) {
                console.error('[api] GET /api/assets/:id/file error:', err)
                if (!res.headersSent) res.status(404).json({ error: 'File not found on disk' })
            }
        })
    })

    // POST /api/assets/:id/campaign-tags — tag asset for campaign
    expressApp.post('/api/assets/:id/campaign-tags', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        if (!dbInterface.getAsset(id)) { res.status(404).json({ error: 'Asset not found' }); return }
        const { campaignId } = req.body as { campaignId?: string }
        if (!campaignId) { res.status(400).json({ error: 'campaignId is required' }); return }
        try {
            dbInterface.tagAssetForCampaign(id, campaignId)
            res.status(201).json({ assetId: id, campaignId })
        } catch (err) {
            console.error('[api] POST /api/assets/:id/campaign-tags error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    // DELETE /api/assets/:id/campaign-tags/:campaignId — untag asset from campaign
    expressApp.delete('/api/assets/:id/campaign-tags/:campaignId', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const id = req.params['id'] ?? ''
        const campaignId = req.params['campaignId'] ?? ''
        dbInterface.untagAsset(id, campaignId)
        res.status(204).end()
    })

    // ── Player character roster routes (Sprint 21c) ────────────────────────────

    // GET /api/sessions/:code/info — public; used by companion join screen to determine character select mode
    expressApp.get('/api/sessions/:code/info', (req, res) => {
        const code = (req.params['code'] ?? '').toUpperCase()
        if (!sessionState || sessionState.sessionCode !== code) {
            res.status(404).json({ error: 'Session not found' }); return
        }
        const characters = dbInterface && serverState.activeCampaignId
            ? dbInterface.getPlayerCharacters(serverState.activeCampaignId)
            : []
        res.json({
            sessionCode: sessionState.sessionCode,
            phase: sessionState.phase,
            characterSelectMode: sessionState.characterSelectMode,
            characters,
        })
    })

    expressApp.get('/api/campaigns/:id/characters', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        res.json(dbInterface.getPlayerCharacters(campaignId))
    })

    expressApp.post('/api/campaigns/:id/characters', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        const { characterName, class: charClass, level, maxHp, ac, abilities } = req.body as {
            characterName?: unknown; class?: unknown; level?: unknown;
            maxHp?: unknown; ac?: unknown; abilities?: unknown
        }
        if (typeof characterName !== 'string' || !characterName.trim()) {
            res.status(400).json({ error: 'characterName is required' }); return
        }
        try {
            const character = dbInterface.createPlayerCharacter(campaignId, {
                characterName: characterName.trim(),
                class: typeof charClass === 'string' ? charClass : 'Fighter',
                level: typeof level === 'number' ? Math.max(1, Math.min(20, level)) : 1,
                maxHp: typeof maxHp === 'number' ? Math.max(1, maxHp) : 10,
                ac: typeof ac === 'number' ? Math.max(0, ac) : 10,
                abilities: typeof abilities === 'object' && abilities !== null
                    ? abilities as Record<string, number>
                    : { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
            })
            res.status(201).json(character)
        } catch (err) {
            console.error('[api] POST /api/campaigns/:id/characters error:', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    })

    expressApp.delete('/api/campaigns/:id/characters/:characterId', (req, res) => {
        if (!dbInterface) { res.status(503).json({ error: 'DB not available' }); return }
        const campaignId = req.params['id'] ?? ''
        const characterId = req.params['characterId'] ?? ''
        if (!dbInterface.getCampaign(campaignId)) { res.status(404).json({ error: 'Campaign not found' }); return }
        dbInterface.deletePlayerCharacter(characterId)
        res.status(204).end()
    })

    // ── SPA catch-all ──────────────────────────────────────────────────────────
    // Must be registered AFTER all /api/* routes to avoid intercepting API requests
    expressApp.get('*', (_req, res) => {
        res.sendFile(join(cockpitDist, 'index.html'))
    })

    // ── Socket.io (real-time commands) ─────────────────────────────────────────
    io.on('connection', (socket) => {
        // ── Relay helpers ────────────────────────────────────────────────────
        // Pure relay: forward event to all clients in a room (including sender)
        type Room = 'av-display' | 'cockpit' | 'player'
        function relay(event: string, room: Room) {
            socket.on(event, (payload: unknown) => {
                io.to(room).emit(event, payload)
            })
        }
        // Relay to all clients in a room EXCEPT the sender
        function relayToOthers(event: string, room: Room) {
            socket.on(event, (payload: unknown) => {
                socket.to(room).emit(event, payload)
            })
        }

        // ── Extracted handler modules ─────────────────────────────────────────
        registerPlayerHandlers(
            io, socket,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket, socketToToken,
        )
        registerSceneHandlers(io, socket, serverState, relay)
        registerAVHandlers(io, socket, serverState, relay)

        // ── Client join / room assignment ─────────────────────────────────────
        socket.on(EVENTS.CLIENT_JOIN, (payload: {
            room: 'av-display' | 'cockpit' | 'player'
            sessionCode?: string
            token?: string
        }) => {
            const { room, sessionCode, token } = payload

            if (room === 'player') {
                // Player companion client — validate session
                if (!sessionState || sessionCode !== sessionState.sessionCode) {
                    socket.emit(EVENTS.PLAYER_SESSION_EXPIRED)
                    return
                }
                socket.join('player')

                // Handle reconnection with existing token
                if (token && sessionState.players[token]) {
                    // Clean up old socket mapping before updating
                    const oldSocketId = sessionState.players[token].socketId
                    if (oldSocketId && oldSocketId !== socket.id) {
                        socketToToken.delete(oldSocketId)
                    }
                    sessionState.players[token].socketId = socket.id
                    sessionState.players[token].connected = true
                    tokenToSocket.set(token, socket.id)
                    socketToToken.set(socket.id, token)
                    socket.emit(EVENTS.PLAYER_STATE, sessionState.players[token])
                    // Notify cockpit of reconnection
                    io.to('cockpit').emit(EVENTS.LOBBY_STATE, {
                        players: Object.values(sessionState.players),
                        phase: sessionState.phase,
                        sessionCode: sessionState.sessionCode,
                    })
                }
                // New joins are handled via the separate PLAYER_JOIN event
            } else {
                socket.join(room)

                // Sprint 4-D: emit full state to newly connected client
                const syncPayload: Record<string, unknown> = { ...serverState }
                if (sessionState && room === 'cockpit') {
                    syncPayload['sessionState'] = {
                        players: Object.values(sessionState.players),
                        phase: sessionState.phase,
                        sessionCode: sessionState.sessionCode,
                    }
                }
                // Sprint 22c: include session info for AV Display idle screen
                if (sessionState && room === 'av-display') {
                    syncPayload['sessionCode'] = sessionState.sessionCode
                    syncPayload['companionUrl'] = `${getLANInfo(config.serverPort).url}/companion`
                }
                socket.emit(EVENTS.STATE_SYNC, syncPayload)
            }
        })

        // ── Notes system relays (cockpit → other cockpit clients) ────────────
        relayToOthers(EVENTS.NOTE_CREATE, 'cockpit')
        relayToOthers(EVENTS.NOTE_UPDATE, 'cockpit')
        relayToOthers(EVENTS.NOTE_DELETE, 'cockpit')
        relayToOthers(EVENTS.NOTE_LINK, 'cockpit')
        relayToOthers(EVENTS.NOTE_UNLINK, 'cockpit')
        relayToOthers(EVENTS.SCENE_SCRATCHPAD, 'cockpit')

        // ── Items system relays (cockpit → other cockpit clients) ────────────
        relayToOthers(EVENTS.ITEM_CREATE, 'cockpit')
        relayToOthers(EVENTS.ITEM_UPDATE, 'cockpit')
        relayToOthers(EVENTS.ITEM_DELETE, 'cockpit')

        // ── App mode change (creates/destroys windows via callback) ───────────
        socket.on(EVENTS.APP_MODE_CHANGE, (payload) => {
            const { mode } = payload as { mode: AppConfig['appMode'] }
            serverState.appMode = mode
            onModeChange?.(mode)

            // Sprint 11b: create/clear session on mode change
            if (mode === 'play') {
                // Create session if not already active
                if (!sessionState) {
                    sessionState = {
                        sessionCode: generateSessionCode(),
                        players: {},
                        phase: 'lobby',
                        rollPrompts: {},
                        characterSelectMode: 'manual-only',
                        maxPlayers: MAX_PLAYERS,
                    }
                    io.to('cockpit').emit(EVENTS.LOBBY_STATE, {
                        players: [],
                        phase: 'lobby',
                        sessionCode: sessionState.sessionCode,
                    })
                    // Notify AV Display idle screen of session QR (Sprint 22c)
                    const companionUrl = `${getLANInfo(config.serverPort).url}/companion`
                    io.to('av-display').emit(EVENTS.SESSION_QR_OVERLAY, {
                        show: true,
                        sessionCode: sessionState.sessionCode,
                        companionUrl,
                    })

                    // Phase 7: Auto-load starting scene if campaign has one
                    if (dbInterface && serverState.activeCampaignId) {
                        try {
                            const campaign = dbInterface.getCampaign(serverState.activeCampaignId)
                            if (campaign?.startingSceneId) {
                                const scene = dbInterface.getScene(campaign.startingSceneId)
                                if (scene) {
                                    serverState.activeSceneId = scene.id
                                    io.to('av-display').emit(EVENTS.SCENE_LOAD, { sceneId: scene.id })
                                    io.to('cockpit').emit(EVENTS.SCENE_LOAD, { sceneId: scene.id })
                                }
                            }
                        } catch (err) {
                            console.warn('[session] starting scene auto-load failed:', err)
                        }
                    }
                }
            } else {
                // Session persists across mode changes — only cleared by explicit SESSION_END.
                // Players stay connected when DM switches to plan mode and back.
            }
        })

        // ── Character select mode (Sprint 21c) ────────────────────────────────
        socket.on(EVENTS.SESSION_SET_CHAR_MODE, (payload) => {
            if (!sessionState) return
            const { mode } = payload as { mode: string }
            const valid: CharacterSelectMode[] = ['manual-only', 'roster-and-manual', 'roster-only']
            if (!valid.includes(mode as CharacterSelectMode)) return
            sessionState.characterSelectMode = mode as CharacterSelectMode
            io.to('cockpit').emit(EVENTS.SESSION_CHAR_MODE, { mode: sessionState.characterSelectMode })
        })

        // ── Output management — proxy to Electron main process ────────────────
        const validRoles = new Set(['BG', 'GB'])

        socket.on(EVENTS.OUTPUT_ENABLE, (payload) => {
            const { displayId, role } = payload as { displayId: number | 'windowed'; role: string }
            if (!validRoles.has(role)) {
                console.warn(`[socket] output enable: invalid role "${role}"`)
                return
            }
            options?.onOutputEnable?.(displayId, role)
            io.to('cockpit').emit(EVENTS.OUTPUT_STATE, { displayId, role, enabled: true })
        })

        socket.on(EVENTS.OUTPUT_DISABLE, (payload) => {
            const { role } = payload as { role: string }
            if (!validRoles.has(role)) {
                console.warn(`[socket] output disable: invalid role "${role}"`)
                return
            }
            options?.onOutputDisable?.(role)
            io.to('cockpit').emit(EVENTS.OUTPUT_STATE, { role, enabled: false })
        })

        // Performance ping/pong for latency measurement
        socket.on(EVENTS.PERF_PING, (data) => {
            socket.emit(EVENTS.PERF_PONG, data)
        })

        // ── Disconnect cleanup ────────────────────────────────────────────────
        socket.on(EVENTS.DISCONNECT, () => {
            // Sprint 11b: handle player disconnect
            const token = socketToToken.get(socket.id)
            if (token && sessionState?.players[token]) {
                socketToToken.delete(socket.id)
                // Only mark disconnected if this socket is still the active one
                // (prevents late disconnect from clobbering a reconnect on a new socket)
                if (sessionState.players[token].socketId === socket.id) {
                    sessionState.players[token].connected = false
                    tokenToSocket.delete(token)
                    // Notify cockpit of disconnection
                    io.to('cockpit').emit(EVENTS.LOBBY_STATE, {
                        players: Object.values(sessionState.players),
                        phase: sessionState.phase,
                        sessionCode: sessionState.sessionCode,
                    })
                }
            }

            // Auto-stop preview if no cockpit clients remain
            if (serverState.previewActive) {
                const cockpitRoom = io.sockets.adapter.rooms.get('cockpit')
                if (!cockpitRoom || cockpitRoom.size === 0) {
                    serverState.previewActive = false
                    io.to('av-display').emit(EVENTS.PREVIEW_STOP)
                }
            }
        })
    })

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            console.error(
                `[server] FATAL: Port ${config.serverPort} is already in use. ` +
                'Stop the conflicting application and restart Stage Manager.'
            )
        } else {
            console.error('[server] HTTP server error:', err)
        }
    })

    httpServer.listen(config.serverPort)
}
