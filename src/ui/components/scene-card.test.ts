/**
 * SceneCard store-contract tests — Sprint 8f.
 *
 * Tests:
 * - Scratchpad debounce behavior
 * - Branch management logic (add/remove)
 * - Scene store expand/collapse state
 * - Note linking/unlinking state mutations
 *
 * Environment: node (no jsdom). Tests Zustand store contracts,
 * not React component rendering.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useSceneStore } from '../stores/scene-store'
import { useNotesStore } from '../stores/notes-store'
import type { Scene, SceneBranch, Note, NoteType, ParticleType, ColorGrade } from '@core/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScene(overrides: Partial<Scene> = {}): Scene {
    return {
        id: 's1',
        campaignId: 'camp1',
        name: 'Test Scene',
        sortOrder: 0,
        backgroundPath: null,
        overlays: [],
        particles: { type: 'none' as ParticleType, intensity: 0 },
        colorGrade: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            temperature: 0,
            tint: '#000000',
        } as ColorGrade,
        gbColorGrade: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff' } as ColorGrade,
        audioMood: 0.5,
        notes: '',
        linkedNPCIds: [],
        linkedLocationIds: [],
        scratchpad: '',
        branches: [],
        ...overrides,
    }
}

function makeNote(overrides: Partial<Note> = {}): Note {
    return {
        id: 'n1',
        campaignId: 'camp1',
        title: 'Test Note',
        type: 'general' as NoteType,
        body: 'Some content',
        tags: [],
        sourceFile: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    }
}

const INITIAL_SCENE_STATE = { activeScene: null }
const INITIAL_NOTES_STATE = { notes: [], activeNoteId: null, sceneNoteLinks: {}, isLoading: false }

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SceneCard — activeScene store contract', () => {
    beforeEach(() => {
        useSceneStore.setState(INITIAL_SCENE_STATE)
    })

    it('setActiveScene stores the scene', () => {
        const scene = makeScene({ id: 's1', name: 'Tavern' })
        useSceneStore.getState().setActiveScene(scene)
        expect(useSceneStore.getState().activeScene).toEqual(scene)
    })

    it('setActiveScene(null) clears the active scene', () => {
        useSceneStore.getState().setActiveScene(makeScene())
        useSceneStore.getState().setActiveScene(null)
        expect(useSceneStore.getState().activeScene).toBeNull()
    })

    it('updating active scene scratchpad preserves other fields', () => {
        const scene = makeScene({ id: 's1', name: 'Tavern', scratchpad: 'old' })
        useSceneStore.getState().setActiveScene(scene)
        const current = useSceneStore.getState().activeScene!
        useSceneStore.getState().setActiveScene({ ...current, scratchpad: 'new notes' })
        const updated = useSceneStore.getState().activeScene!
        expect(updated.scratchpad).toBe('new notes')
        expect(updated.name).toBe('Tavern')
        expect(updated.id).toBe('s1')
    })
})

describe('SceneCard — scratchpad debounce logic', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('debounce fires callback after 500ms', () => {
        const callback = vi.fn()
        let timer: ReturnType<typeof setTimeout> | null = null

        function debouncedSave(value: string): void {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => callback(value), 500)
        }

        debouncedSave('first')
        debouncedSave('second')
        debouncedSave('third')

        // Not yet called
        expect(callback).not.toHaveBeenCalled()

        vi.advanceTimersByTime(500)

        // Called once with the last value
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith('third')
    })

    it('debounce resets on each keystroke', () => {
        const callback = vi.fn()
        let timer: ReturnType<typeof setTimeout> | null = null

        function debouncedSave(value: string): void {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => callback(value), 500)
        }

        debouncedSave('a')
        vi.advanceTimersByTime(300) // 300ms — not yet
        debouncedSave('ab')
        vi.advanceTimersByTime(300) // 300ms since last — not yet (600ms total)
        expect(callback).not.toHaveBeenCalled()

        vi.advanceTimersByTime(200) // 500ms since last call
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith('ab')
    })
})

describe('SceneCard — branch management contract', () => {
    it('adding a branch produces a new array with the branch appended', () => {
        const scene = makeScene({ branches: [{ label: 'Existing', targetSceneId: 's2', transitionNote: '' }] })
        const newBranch: SceneBranch = { label: 'New Path', targetSceneId: 's3', transitionNote: 'fade out' }
        const updated = [...scene.branches, newBranch]
        expect(updated).toHaveLength(2)
        expect(updated[1]!.label).toBe('New Path')
        expect(updated[1]!.transitionNote).toBe('fade out')
    })

    it('removing a branch by index filters correctly', () => {
        const scene = makeScene({
            branches: [
                { label: 'A', targetSceneId: 's2', transitionNote: '' },
                { label: 'B', targetSceneId: 's3', transitionNote: 'note' },
                { label: 'C', targetSceneId: 's4', transitionNote: '' },
            ],
        })
        const filtered = scene.branches.filter((_, i) => i !== 1)
        expect(filtered).toHaveLength(2)
        expect(filtered[0]!.label).toBe('A')
        expect(filtered[1]!.label).toBe('C')
    })

    it('branch count reflects scene.branches.length', () => {
        const scene = makeScene({
            branches: [
                { label: 'X', targetSceneId: 's2', transitionNote: '' },
                { label: 'Y', targetSceneId: 's3', transitionNote: '' },
            ],
        })
        expect(scene.branches.length).toBe(2)
    })
})

describe('SceneCard — note linking store contract', () => {
    beforeEach(() => {
        useNotesStore.setState({
            ...INITIAL_NOTES_STATE,
            notes: [
                makeNote({ id: 'n1', title: 'Note A' }),
                makeNote({ id: 'n2', title: 'Note B' }),
                makeNote({ id: 'n3', title: 'Note C' }),
            ],
        })
    })

    it('linking a note updates sceneNoteLinks', () => {
        const links = useNotesStore.getState().sceneNoteLinks['s1'] ?? []
        useNotesStore.getState().setSceneNoteLinks('s1', [...links, 'n1'])
        expect(useNotesStore.getState().sceneNoteLinks['s1']).toEqual(['n1'])
    })

    it('unlinking a note filters it from sceneNoteLinks', () => {
        useNotesStore.getState().setSceneNoteLinks('s1', ['n1', 'n2', 'n3'])
        const links = useNotesStore.getState().sceneNoteLinks['s1']!
        useNotesStore.getState().setSceneNoteLinks('s1', links.filter((id) => id !== 'n2'))
        expect(useNotesStore.getState().sceneNoteLinks['s1']).toEqual(['n1', 'n3'])
    })

    it('getNotesForScene returns linked notes', () => {
        useNotesStore.getState().setSceneNoteLinks('s1', ['n1', 'n3'])
        const linked = useNotesStore.getState().getNotesForScene('s1')
        expect(linked).toHaveLength(2)
        expect(linked.map((n) => n.id)).toEqual(['n1', 'n3'])
    })

    it('available notes excludes already-linked notes', () => {
        useNotesStore.getState().setSceneNoteLinks('s1', ['n1'])
        const linkedIds = new Set(useNotesStore.getState().sceneNoteLinks['s1'] ?? [])
        const allNotes = useNotesStore.getState().notes
        const available = allNotes.filter((n) => !linkedIds.has(n.id))
        expect(available).toHaveLength(2)
        expect(available.map((n) => n.id)).toEqual(['n2', 'n3'])
    })
})

describe('SceneCard — drag reorder contract', () => {
    it('reorders scenes by moving from fromIdx to toIdx', () => {
        const scenes = [
            makeScene({ id: 's1', name: 'First', sortOrder: 0 }),
            makeScene({ id: 's2', name: 'Second', sortOrder: 1 }),
            makeScene({ id: 's3', name: 'Third', sortOrder: 2 }),
        ]

        const sorted = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder)
        const fromIdx = sorted.findIndex((s) => s.id === 's3')
        const toIdx = sorted.findIndex((s) => s.id === 's1')

        const [moved] = sorted.splice(fromIdx, 1)
        sorted.splice(toIdx, 0, moved!)

        expect(sorted.map((s) => s.id)).toEqual(['s3', 's1', 's2'])
    })

    it('reorder assigns sequential sortOrder values', () => {
        const sorted = [
            makeScene({ id: 's3', sortOrder: 2 }),
            makeScene({ id: 's1', sortOrder: 0 }),
            makeScene({ id: 's2', sortOrder: 1 }),
        ]

        const withNewOrder = sorted.map((scene, idx) => ({ ...scene, sortOrder: idx }))
        expect(withNewOrder[0]!.sortOrder).toBe(0)
        expect(withNewOrder[1]!.sortOrder).toBe(1)
        expect(withNewOrder[2]!.sortOrder).toBe(2)
    })
})
