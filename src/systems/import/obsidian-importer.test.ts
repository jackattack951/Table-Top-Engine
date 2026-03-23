/**
 * Tests for obsidian-importer.ts — Sprint 8e overhaul.
 *
 * The importer uses Node.js `fs` — we mock it entirely so these tests run in
 * Vitest without touching the real file system.
 *
 * DBInterface is provided as a lightweight in-memory fake (no better-sqlite3).
 * Now includes Note CRUD functions for the Sprint 8e Note entity creation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── fs mock ───────────────────────────────────────────────────────────────────
//
// Must be defined before any import of the module under test.
// vi.hoisted() ensures these refs are available inside vi.mock() factory.

const {
    mockExistsSync,
    mockReadFile,
    mockReaddirSync,
    mockWatch,
} = vi.hoisted(() => ({
    mockExistsSync: vi.fn(() => true),
    mockReadFile: vi.fn(() => Promise.resolve('')),
    mockReaddirSync: vi.fn(() => [] as import('fs').Dirent[]),
    mockWatch: vi.fn(() => ({
        on: vi.fn(),
        close: vi.fn(),
    })),
}))

vi.mock('fs', () => ({
    default: {
        existsSync: mockExistsSync,
        readdirSync: mockReaddirSync,
        watch: mockWatch,
    },
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    watch: mockWatch,
}))

vi.mock('fs/promises', () => ({
    default: {
        readFile: mockReadFile,
    },
    readFile: mockReadFile,
}))

// ── path mock — use a simple passthrough ──────────────────────────────────────
vi.mock('path', async () => {
    const actual = await vi.importActual<typeof import('path')>('path')
    return { default: actual, ...actual }
})

// ── Import module under test ──────────────────────────────────────────────────
import {
    parseFrontmatter,
    parseTriggers,
    importVault,
    importSingleFile,
    startWatching,
    stopWatching,
} from './obsidian-importer'
import type { DBInterface } from '@core/db/db'
import type { Note, NoteType } from '@core/types'

// ── Fake DBInterface ──────────────────────────────────────────────────────────

function makeDB(): DBInterface & {
    _npcs: Map<string, import('@core/types').NPC>
    _scenes: Map<string, import('@core/types').Scene>
    _notes: Map<string, Note>
    _sceneNotes: Map<string, string[]>  // sceneId → noteId[]
} {
    const _npcs = new Map<string, import('@core/types').NPC>()
    const _scenes = new Map<string, import('@core/types').Scene>()
    const _notes = new Map<string, Note>()
    const _sceneNotes = new Map<string, string[]>()
    let _npcSeq = 0
    let _sceneSeq = 0
    let _noteSeq = 0

    function makeNPC(data: Omit<import('@core/types').NPC, 'id'>): import('@core/types').NPC {
        return { id: `npc-${++_npcSeq}`, ...data }
    }
    function makeScene(data: Omit<import('@core/types').Scene, 'id'>): import('@core/types').Scene {
        return { id: `scene-${++_sceneSeq}`, ...data }
    }
    function makeNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
        const now = new Date().toISOString()
        return { id: `note-${++_noteSeq}`, createdAt: now, updatedAt: now, ...data }
    }

    return {
        _npcs,
        _scenes,
        _notes,
        _sceneNotes,
        getCampaigns: vi.fn(() => []),
        getCampaign: vi.fn(),
        createCampaign: vi.fn(),
        updateCampaign: vi.fn(),
        deleteCampaign: vi.fn(),
        getScenes: vi.fn((campaignId: string) =>
            [..._scenes.values()].filter((s) => s.campaignId === campaignId)
        ),
        getScene: vi.fn((id: string) => _scenes.get(id)),
        createScene: vi.fn((data: Omit<import('@core/types').Scene, 'id'>) => {
            const s = makeScene(data)
            _scenes.set(s.id, s)
            return s
        }),
        updateScene: vi.fn((id: string, data: Partial<Omit<import('@core/types').Scene, 'id' | 'campaignId'>>) => {
            const existing = _scenes.get(id)
            if (!existing) throw new Error(`Scene not found: ${id}`)
            const updated = { ...existing, ...data }
            _scenes.set(id, updated)
            return updated
        }),
        deleteScene: vi.fn(),
        getNPCs: vi.fn((campaignId: string) =>
            [..._npcs.values()].filter((n) => n.campaignId === campaignId)
        ),
        getNPC: vi.fn((id: string) => _npcs.get(id)),
        createNPC: vi.fn((data: Omit<import('@core/types').NPC, 'id'>) => {
            const n = makeNPC(data)
            _npcs.set(n.id, n)
            return n
        }),
        updateNPC: vi.fn((id: string, data: Partial<Omit<import('@core/types').NPC, 'id' | 'campaignId'>>) => {
            const existing = _npcs.get(id)
            if (!existing) throw new Error(`NPC not found: ${id}`)
            const updated = { ...existing, ...data }
            _npcs.set(id, updated)
            return updated
        }),
        deleteNPC: vi.fn(),
        // Note CRUD — Sprint 8e
        getNotes: vi.fn((campaignId: string, type?: NoteType) => {
            const all = [..._notes.values()].filter((n) => n.campaignId === campaignId)
            return type ? all.filter((n) => n.type === type) : all
        }),
        getNote: vi.fn((id: string) => _notes.get(id)),
        createNote: vi.fn((data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
            const n = makeNote(data)
            _notes.set(n.id, n)
            return n
        }),
        updateNote: vi.fn((id: string, data: Partial<Pick<Note, 'title' | 'type' | 'body' | 'tags' | 'sourceFile' | 'pinned' | 'archived' | 'status' | 'color'>>) => {
            const existing = _notes.get(id)
            if (!existing) throw new Error(`Note not found: ${id}`)
            const updated = { ...existing, ...data, updatedAt: new Date().toISOString() }
            _notes.set(id, updated)
            return updated
        }),
        deleteNote: vi.fn((id: string) => { _notes.delete(id) }),
        getNoteBySourceFile: vi.fn((campaignId: string, sourceFile: string) => {
            return [..._notes.values()].find(
                (n) => n.campaignId === campaignId && n.sourceFile === sourceFile
            )
        }),
        // Junction operations
        getNotesForScene: vi.fn((sceneId: string) => {
            const noteIds = _sceneNotes.get(sceneId) ?? []
            return noteIds.map((id) => _notes.get(id)).filter(Boolean) as Note[]
        }),
        getScenesForNote: vi.fn(() => []),
        linkNoteToScene: vi.fn((sceneId: string, noteId: string) => {
            const existing = _sceneNotes.get(sceneId) ?? []
            if (!existing.includes(noteId)) {
                _sceneNotes.set(sceneId, [...existing, noteId])
            }
        }),
        unlinkNoteFromScene: vi.fn(),
        getSceneNoteLinks: vi.fn(() => ({})),
    }
}

// ── parseFrontmatter ──────────────────────────────────────────────────────────

describe('parseFrontmatter', () => {
    it('returns empty frontmatter and full content when no --- delimiter', () => {
        const content = 'Just plain text.\nNo frontmatter here.'
        const { frontmatter, body } = parseFrontmatter(content)
        expect(frontmatter).toEqual({})
        expect(body).toBe(content)
    })

    it('parses simple key:value pairs', () => {
        const content = `---\ntype: npc\nnpc_name: Gareth\nac: 15\nhp: 42\n---\nHe is a guard.`
        const { frontmatter, body } = parseFrontmatter(content)
        expect(frontmatter.type).toBe('npc')
        expect(frontmatter.npc_name).toBe('Gareth')
        expect(frontmatter.ac).toBe(15)
        expect(frontmatter.hp).toBe(42)
        expect(body).toBe('He is a guard.')
    })

    it('parses boolean values', () => {
        const content = `---\nfriendly: true\nboss: false\n---\nBody.`
        const { frontmatter } = parseFrontmatter(content)
        expect(frontmatter.friendly).toBe(true)
        expect(frontmatter.boss).toBe(false)
    })

    it('parses array values in bracket notation', () => {
        const content = `---\ntags: [npc, guard, friendly]\n---\nBody.`
        const { frontmatter } = parseFrontmatter(content)
        expect(frontmatter.tags).toEqual(['npc', 'guard', 'friendly'])
    })

    it('treats empty value as empty string', () => {
        const content = `---\nnotes:\n---\nBody.`
        const { frontmatter } = parseFrontmatter(content)
        expect(frontmatter.notes).toBe('')
    })

    it('parses numeric stat block fields', () => {
        const content = `---\nstr: 18\ndex: 14\ncon: 16\nint: 8\nwis: 10\ncha: 12\n---\nBody.`
        const { frontmatter } = parseFrontmatter(content)
        expect(frontmatter.str).toBe(18)
        expect(frontmatter.dex).toBe(14)
        expect(frontmatter.cha).toBe(12)
    })

    it('handles CRLF line endings', () => {
        const content = '---\r\ntype: scene\r\n---\r\nScene body.'
        const { frontmatter, body } = parseFrontmatter(content)
        expect(frontmatter.type).toBe('scene')
        expect(body).toBe('Scene body.')
    })
})

// ── parseTriggers ─────────────────────────────────────────────────────────────

describe('parseTriggers', () => {
    it('extracts triggers from trigger_N keys', () => {
        const frontmatter = {
            type: 'scene',
            trigger_1: 'Thunder Crack|sfx|thunder',
            trigger_2: 'Tense Music|mood|0.8',
        }
        const triggers = parseTriggers(frontmatter)
        expect(triggers).toHaveLength(2)
        expect(triggers[0]).toEqual({ label: 'Thunder Crack', triggerType: 'sfx', value: 'thunder' })
        expect(triggers[1]).toEqual({ label: 'Tense Music', triggerType: 'mood', value: '0.8' })
    })

    it('skips non-trigger keys', () => {
        const frontmatter = {
            type: 'scene',
            tags: ['foo'],
            trigger_1: 'Flash|vfx|lightning',
        }
        const triggers = parseTriggers(frontmatter)
        expect(triggers).toHaveLength(1)
    })

    it('skips malformed trigger values (less than 3 parts)', () => {
        const frontmatter = {
            trigger_1: 'Only two parts|sfx',
            trigger_2: 'Valid|sfx|boom',
        }
        const triggers = parseTriggers(frontmatter)
        expect(triggers).toHaveLength(1)
        expect(triggers[0]!.label).toBe('Valid')
    })

    it('returns empty array when no triggers present', () => {
        const triggers = parseTriggers({ type: 'npc' })
        expect(triggers).toEqual([])
    })

    it('skips non-string trigger values', () => {
        const frontmatter = {
            trigger_1: 42,
            trigger_2: 'Valid|sfx|boom',
        }
        const triggers = parseTriggers(frontmatter)
        expect(triggers).toHaveLength(1)
    })
})

// ── importVault — Note entity creation ────────────────────────────────────────

describe('importVault', () => {
    let db: ReturnType<typeof makeDB>

    beforeEach(() => {
        db = makeDB()
        vi.clearAllMocks()
        stopWatching() // ensure no stale watcher
    })

    it('returns error when vault path does not exist', async () => {
        mockExistsSync.mockReturnValue(false)
        const result = await importVault('/no/such/path', 'campaign-1', db)
        expect(result.imported).toBe(0)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain('not found')
    })

    it('imports nothing when vault contains no markdown files', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([])
        const result = await importVault('/vault', 'campaign-1', db)
        expect(result.imported).toBe(0)
        expect(result.skipped).toBe(0)
        expect(result.errors).toHaveLength(0)
    })

    it('creates a Note entity of type general for files without a type', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'readme.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue('# Just a note\nNo frontmatter type.')
        const result = await importVault('/vault', 'campaign-1', db)
        expect(result.imported).toBe(1)
        expect(result.skipped).toBe(0)

        // Verify Note entity was created
        expect(db.createNote).toHaveBeenCalledOnce()
        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.type).toBe('general')
        expect(noteArg.title).toBe('readme')
        expect(noteArg.body).toBe('# Just a note\nNo frontmatter type.')
    })

    it('creates a Note + NPC from a file with type: npc', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'gareth.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(
            `---\ntype: npc\nnpc_name: Gareth the Guard\nac: 16\nhp: 30\n---\nHe guards the gate.`
        )

        const result = await importVault('/vault', 'campaign-1', db)
        expect(result.imported).toBe(1)

        // Note entity created with type 'npc'
        expect(db.createNote).toHaveBeenCalledOnce()
        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.type).toBe('npc')
        expect(noteArg.title).toBe('gareth')

        // NPC also created (existing behavior preserved)
        const npcs = db.getNPCs('campaign-1')
        expect(npcs).toHaveLength(1)
        expect(npcs[0]!.name).toBe('Gareth the Guard')
        expect(npcs[0]!.statBlock['ac']).toBe(16)
        expect(npcs[0]!.statBlock['hp']).toBe(30)
        expect(npcs[0]!.notes).toBe('He guards the gate.')
    })

    it('uses the filename as NPC name when npc_name frontmatter is absent', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'village-elder.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: npc\n---\nWise and old.`)

        await importVault('/vault', 'campaign-1', db)
        const npcs = db.getNPCs('campaign-1')
        expect(npcs[0]!.name).toBe('village-elder')
    })

    it('updates an existing NPC rather than duplicating it', async () => {
        // Pre-seed the DB with an NPC of the same name
        db.createNPC({ campaignId: 'campaign-1', name: 'Gareth the Guard', statBlock: {}, personality: '', notes: '' })

        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'gareth.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(
            `---\ntype: npc\nnpc_name: Gareth the Guard\nac: 18\nhp: 50\n---\nUpdated notes.`
        )

        await importVault('/vault', 'campaign-1', db)
        const npcs = db.getNPCs('campaign-1')
        // Must still be one NPC — updated, not duplicated
        expect(npcs).toHaveLength(1)
        expect(npcs[0]!.statBlock['ac']).toBe(18)
        expect(npcs[0]!.notes).toBe('Updated notes.')
    })

    it('creates a Note + Scene from a file with type: scene (auto-create enabled)', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'tavern-entrance.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(
            `---\ntype: scene\n---\nThe party enters the dimly lit tavern.`
        )

        const result = await importVault('/vault', 'campaign-1', db)
        expect(result.imported).toBe(1)

        // Note entity created
        expect(db.createNote).toHaveBeenCalledOnce()
        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.type).toBe('scene')

        // Scene auto-created
        const scenes = db.getScenes('campaign-1')
        expect(scenes).toHaveLength(1)
        expect(scenes[0]!.name).toBe('tavern-entrance')
        expect(scenes[0]!.notes).toBe('The party enters the dimly lit tavern.')

        // Note linked to scene
        expect(db.linkNoteToScene).toHaveBeenCalledOnce()
    })

    it('does NOT auto-create scene when autoCreateScenes is false', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'tavern.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: scene\n---\nTavern body.`)

        await importVault('/vault', 'campaign-1', db, { autoCreateScenes: false })

        // Note entity created
        expect(db.createNote).toHaveBeenCalledOnce()

        // No Scene created
        expect(db.createScene).not.toHaveBeenCalled()
        expect(db.linkNoteToScene).not.toHaveBeenCalled()
    })

    it('updates an existing Scene on re-import (auto-create)', async () => {
        // Pre-seed
        db.createScene({
            campaignId: 'campaign-1',
            name: 'tavern-entrance',
            sortOrder: 0,
            backgroundPath: null,
            overlays: [],
            particles: { type: 'none', intensity: 0 },
            colorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#000000' },
            gbColorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff' },
            audioMood: 0.3,
            notes: 'Old notes.',
            linkedNPCIds: [],
            linkedLocationIds: [],
            branches: [],
        })

        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'tavern-entrance.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: scene\n---\nNew notes after Obsidian edit.`)

        await importVault('/vault', 'campaign-1', db)
        const scenes = db.getScenes('campaign-1')
        expect(scenes).toHaveLength(1)
        expect(scenes[0]!.notes).toBe('New notes after Obsidian edit.')
    })

    it('creates a Note of type location', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'the-keep.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: location\ntags: [fortress, northern]\n---\nA cold stone fortress.`)

        const result = await importVault('/vault', 'campaign-1', db)
        expect(result.imported).toBe(1)

        expect(db.createNote).toHaveBeenCalledOnce()
        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.type).toBe('location')
        expect(noteArg.title).toBe('the-keep')
        expect(noteArg.tags).toContain('fortress')
        expect(noteArg.tags).toContain('northern')
    })

    it('creates a Note of type lore', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'ancient-prophecy.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: lore\n---\nWhen the three moons align...`)

        const result = await importVault('/vault', 'campaign-1', db)
        expect(result.imported).toBe(1)

        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.type).toBe('lore')
        expect(noteArg.body).toBe('When the three moons align...')
    })

    it('sets sourceFile to the absolute file path', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'test.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: general\n---\nBody.`)

        await importVault('/vault', 'campaign-1', db)

        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.sourceFile).toBeTruthy()
        // Should contain the file name
        expect(noteArg.sourceFile).toContain('test.md')
    })

    it('parses trigger frontmatter and adds trigger tags', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'battle.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(
            `---\ntype: scene\ntrigger_1: Thunder Crack|sfx|thunder\ntrigger_2: Tense Music|mood|0.8\n---\nA battle scene.`
        )

        await importVault('/vault', 'campaign-1', db)

        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.tags).toContain('trigger:Thunder Crack')
        expect(noteArg.tags).toContain('trigger:Tense Music')
    })

    it('skips hidden files (starting with .)', async () => {
        mockExistsSync.mockReturnValue(true)
        // Simulate .obsidian directory — should be skipped
        mockReaddirSync.mockReturnValue([
            { name: '.obsidian', isDirectory: () => true, isFile: () => false } as import('fs').Dirent,
            { name: '.DS_Store', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])

        const result = await importVault('/vault', 'campaign-1', db)
        expect(result.imported).toBe(0)
        expect(result.skipped).toBe(0)
        // readdirSync was called on /vault but .obsidian was skipped, so no files processed
        expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('collects errors for unreadable files without aborting the whole import', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'good.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
            { name: 'bad.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        // First call succeeds, second call throws
        mockReadFile
            .mockResolvedValueOnce(`---\ntype: npc\nnpc_name: Good Guy\n---\nOK.`)
            .mockRejectedValueOnce(new Error('EACCES: permission denied'))

        const result = await importVault('/vault', 'campaign-1', db)
        expect(result.imported).toBe(1)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain('bad.md')
    })

    it('excludes trigger keys from NPC stat blocks', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'boss.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(
            `---\ntype: npc\nnpc_name: Boss\nac: 20\ntrigger_1: Roar|sfx|roar\n---\nBig boss.`
        )

        await importVault('/vault', 'campaign-1', db)
        const npcs = db.getNPCs('campaign-1')
        expect(npcs[0]!.statBlock['ac']).toBe(20)
        // trigger_1 should NOT be in stat block
        expect(npcs[0]!.statBlock['trigger_1']).toBeUndefined()
    })
})

// ── Re-import merge logic ─────────────────────────────────────────────────────

describe('importVault — re-import merge', () => {
    let db: ReturnType<typeof makeDB>

    beforeEach(() => {
        db = makeDB()
        vi.clearAllMocks()
        stopWatching()
    })

    it('updates body and tags on re-import (matched by sourceFile)', async () => {
        // Pre-seed a Note with a sourceFile path
        const existingNote = db.createNote({
            campaignId: 'campaign-1',
            title: 'My Custom Title',
            type: 'lore',
            body: 'Original body.',
            tags: ['old-tag'],
            sourceFile: '/vault/lore.md',  // This will match the resolved path
            pinned: false,
            archived: false,
            status: null,
            color: null,
        })

        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'lore.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: lore\ntags: [new-tag]\n---\nUpdated body.`)

        // Make getNoteBySourceFile return the pre-seeded note
        // The path.resolve in importFile will resolve to something — we need the mock to return it
        ;(db.getNoteBySourceFile as ReturnType<typeof vi.fn>).mockImplementation(
            (campaignId: string, sourceFile: string) => {
                if (sourceFile.includes('lore.md')) return existingNote
                return undefined
            }
        )

        await importVault('/vault', 'campaign-1', db)

        // Should have called updateNote, not createNote again
        expect(db.updateNote).toHaveBeenCalledWith(existingNote.id, expect.objectContaining({
            body: 'Updated body.',
            type: 'lore',
        }))
        // Title should NOT be in the update (preserving user's custom title)
        const updateArgs = (db.updateNote as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>
        expect(updateArgs).not.toHaveProperty('title')
    })

    it('does NOT overwrite scratchpad on scene re-import', async () => {
        // Pre-seed scene with scratchpad
        const scene = db.createScene({
            campaignId: 'campaign-1',
            name: 'tavern',
            sortOrder: 0,
            backgroundPath: null,
            overlays: [],
            particles: { type: 'none', intensity: 0 },
            colorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#000000' },
            gbColorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff' },
            audioMood: 0.3,
            notes: 'Old scene notes.',
            linkedNPCIds: [],
            linkedLocationIds: [],
            branches: [],
        })
        // Manually set scratchpad
        db.updateScene(scene.id, { scratchpad: 'My session notes - DO NOT OVERWRITE' })

        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'tavern.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: scene\n---\nNew body from vault.`)

        await importVault('/vault', 'campaign-1', db)

        const scenes = db.getScenes('campaign-1')
        expect(scenes[0]!.scratchpad).toBe('My session notes - DO NOT OVERWRITE')
        // Notes field updated
        expect(scenes[0]!.notes).toBe('New body from vault.')
    })

    it('creates new Note when previously deleted note is re-imported (no tombstone)', async () => {
        // getNoteBySourceFile returns undefined (simulating deleted note)
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
            { name: 'deleted-and-back.md', isDirectory: () => false, isFile: () => true } as import('fs').Dirent,
        ])
        mockReadFile.mockResolvedValue(`---\ntype: general\n---\nI am back.`)

        await importVault('/vault', 'campaign-1', db)

        // Should create new note
        expect(db.createNote).toHaveBeenCalledOnce()
        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.body).toBe('I am back.')
    })
})

// ── importSingleFile ─────────────────────────────────────────────────────────

describe('importSingleFile', () => {
    let db: ReturnType<typeof makeDB>

    beforeEach(() => {
        db = makeDB()
        vi.clearAllMocks()
        stopWatching()
    })

    it('returns error when file does not exist', async () => {
        mockExistsSync.mockReturnValue(false)
        const result = await importSingleFile('/no/such/file.md', 'campaign-1', db)
        expect(result.imported).toBe(0)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain('not found')
    })

    it('returns error for non-.md files', async () => {
        mockExistsSync.mockReturnValue(true)
        const result = await importSingleFile('/vault/image.png', 'campaign-1', db)
        expect(result.imported).toBe(0)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain('.md')
    })

    it('imports a single .md file as a Note entity', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFile.mockResolvedValue(`---\ntype: lore\ntags: [ancient]\n---\nLong ago...`)

        const result = await importSingleFile('/vault/prophecy.md', 'campaign-1', db)
        expect(result.imported).toBe(1)
        expect(result.errors).toHaveLength(0)

        expect(db.createNote).toHaveBeenCalledOnce()
        const noteArg = (db.createNote as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
        expect(noteArg.type).toBe('lore')
        expect(noteArg.title).toBe('prophecy')
        expect(noteArg.tags).toContain('ancient')
    })

    it('single file import with autoCreateScenes creates a scene for type: scene', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFile.mockResolvedValue(`---\ntype: scene\n---\nA forest clearing.`)

        const result = await importSingleFile('/vault/forest.md', 'campaign-1', db, { autoCreateScenes: true })
        expect(result.imported).toBe(1)

        expect(db.createNote).toHaveBeenCalledOnce()
        expect(db.createScene).toHaveBeenCalledOnce()
        expect(db.linkNoteToScene).toHaveBeenCalledOnce()
    })

    it('single file import without autoCreateScenes does not create scene', async () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFile.mockResolvedValue(`---\ntype: scene\n---\nA forest clearing.`)

        await importSingleFile('/vault/forest.md', 'campaign-1', db, { autoCreateScenes: false })

        expect(db.createNote).toHaveBeenCalledOnce()
        expect(db.createScene).not.toHaveBeenCalled()
    })
})

// ── startWatching / stopWatching ──────────────────────────────────────────────

describe('startWatching / stopWatching', () => {
    let db: ReturnType<typeof makeDB>
    let mockWatcherInstance: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }

    beforeEach(() => {
        db = makeDB()
        vi.clearAllMocks()
        stopWatching()
        mockWatcherInstance = { on: vi.fn(), close: vi.fn() }
        mockWatch.mockReturnValue(mockWatcherInstance)
        mockExistsSync.mockReturnValue(true)
    })

    it('does not start watching when vault path does not exist', () => {
        mockExistsSync.mockReturnValue(false)
        startWatching('/no/vault', 'campaign-1', db)
        expect(mockWatch).not.toHaveBeenCalled()
    })

    it('calls fs.watch with recursive option', () => {
        startWatching('/vault', 'campaign-1', db)
        expect(mockWatch).toHaveBeenCalledWith(
            '/vault',
            { recursive: true },
            expect.any(Function)
        )
    })

    it('registers an error handler on the watcher', () => {
        startWatching('/vault', 'campaign-1', db)
        expect(mockWatcherInstance.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('stopWatching closes the active watcher', () => {
        startWatching('/vault', 'campaign-1', db)
        stopWatching()
        expect(mockWatcherInstance.close).toHaveBeenCalledOnce()
    })

    it('calling startWatching twice replaces the previous watcher', () => {
        const watcher1 = { on: vi.fn(), close: vi.fn() }
        const watcher2 = { on: vi.fn(), close: vi.fn() }
        mockWatch.mockReturnValueOnce(watcher1).mockReturnValueOnce(watcher2)

        startWatching('/vault', 'campaign-1', db)
        startWatching('/vault', 'campaign-1', db)

        // First watcher must have been closed
        expect(watcher1.close).toHaveBeenCalledOnce()
        // Second watcher is now active
        stopWatching()
        expect(watcher2.close).toHaveBeenCalledOnce()
    })

    it('ignores non-.md file events', () => {
        startWatching('/vault', 'campaign-1', db)
        const watchCallback = mockWatch.mock.calls[0]![2] as (event: string, filename: string) => void

        // Trigger with a non-markdown file
        watchCallback('change', 'image.png')

        // readFileSync should not be called
        expect(mockReadFile).not.toHaveBeenCalled()
    })
})
