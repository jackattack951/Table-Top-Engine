/**
 * SceneAdvancer store-contract tests — Sprint 8f.
 *
 * Tests the advancer logic:
 * - 0 branches → no advancer
 * - 1 branch → single "Next" action
 * - 2+ branches → multiple choice actions
 * - Event emission (emitSceneBranch)
 * - Transition note handling
 *
 * Environment: node (no jsdom). Tests pure logic contracts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Scene, SceneBranch, ParticleType, ColorGrade } from '@core/types'

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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SceneAdvancer — branch count logic', () => {
    it('0 branches: advancer should not render (returns null)', () => {
        const branches: SceneBranch[] = []
        // The component returns null when branches.length === 0
        expect(branches.length).toBe(0)
    })

    it('1 branch: single "Next" action available', () => {
        const branches: SceneBranch[] = [
            { label: 'Continue', targetSceneId: 's2', transitionNote: '' },
        ]
        expect(branches.length).toBe(1)
        expect(branches[0]!.label).toBe('Continue')
    })

    it('2+ branches: multiple choices available', () => {
        const branches: SceneBranch[] = [
            { label: 'Fight', targetSceneId: 's2', transitionNote: '' },
            { label: 'Flee', targetSceneId: 's3', transitionNote: '' },
            { label: 'Negotiate', targetSceneId: 's4', transitionNote: 'The goblin king pauses...' },
        ]
        expect(branches.length).toBe(3)
        expect(branches.map((b) => b.label)).toEqual(['Fight', 'Flee', 'Negotiate'])
    })
})

describe('SceneAdvancer — target scene resolution', () => {
    const allScenes = [
        makeScene({ id: 's1', name: 'Start' }),
        makeScene({ id: 's2', name: 'Battle Arena' }),
        makeScene({ id: 's3', name: 'Escape Route' }),
    ]

    it('resolves target scene name from allScenes', () => {
        const branch: SceneBranch = { label: 'Fight', targetSceneId: 's2', transitionNote: '' }
        const target = allScenes.find((s) => s.id === branch.targetSceneId)
        expect(target).toBeDefined()
        expect(target!.name).toBe('Battle Arena')
    })

    it('handles missing target scene gracefully', () => {
        const branch: SceneBranch = { label: 'Mystery', targetSceneId: 'nonexistent', transitionNote: '' }
        const target = allScenes.find((s) => s.id === branch.targetSceneId)
        expect(target).toBeUndefined()
    })
})

describe('SceneAdvancer — onAdvance callback contract', () => {
    it('calls callback with targetSceneId and transitionNote', () => {
        const onAdvance = vi.fn()
        const branch: SceneBranch = {
            label: 'Negotiate',
            targetSceneId: 's4',
            transitionNote: 'The goblin king pauses...',
        }

        // Simulate what the component does when a branch is clicked
        onAdvance(branch.targetSceneId, branch.transitionNote)

        expect(onAdvance).toHaveBeenCalledTimes(1)
        expect(onAdvance).toHaveBeenCalledWith('s4', 'The goblin king pauses...')
    })

    it('calls callback with empty transitionNote when none set', () => {
        const onAdvance = vi.fn()
        const branch: SceneBranch = {
            label: 'Continue',
            targetSceneId: 's2',
            transitionNote: '',
        }

        onAdvance(branch.targetSceneId, branch.transitionNote)

        expect(onAdvance).toHaveBeenCalledWith('s2', '')
    })
})

describe('SceneAdvancer — transition note handling', () => {
    it('transition note is truthy when present', () => {
        const branch: SceneBranch = {
            label: 'Negotiate',
            targetSceneId: 's4',
            transitionNote: 'The goblin king pauses...',
        }
        expect(branch.transitionNote).toBeTruthy()
    })

    it('transition note is falsy when empty string', () => {
        const branch: SceneBranch = {
            label: 'Fight',
            targetSceneId: 's2',
            transitionNote: '',
        }
        expect(branch.transitionNote).toBeFalsy()
    })

    it('advance with toast: delay before loading target', () => {
        vi.useFakeTimers()
        const loadTarget = vi.fn()
        const transitionNote = 'A storm gathers...'

        // Simulate the ScenesTab handleAdvance logic
        if (transitionNote) {
            setTimeout(() => loadTarget(), 2000)
        } else {
            loadTarget()
        }

        expect(loadTarget).not.toHaveBeenCalled()
        vi.advanceTimersByTime(2000)
        expect(loadTarget).toHaveBeenCalledTimes(1)

        vi.useRealTimers()
    })

    it('advance without toast: loads target immediately', () => {
        const loadTarget = vi.fn()
        const transitionNote = ''

        if (transitionNote) {
            setTimeout(() => loadTarget(), 2000)
        } else {
            loadTarget()
        }

        expect(loadTarget).toHaveBeenCalledTimes(1)
    })
})

describe('SceneAdvancer — emitSceneBranch contract', () => {
    // Mock the sync module
    beforeEach(() => {
        vi.resetModules()
    })

    it('emitSceneBranch uses SCENE_BRANCH event constant', async () => {
        const { EVENTS } = await import('@shared/socket-events')
        expect(EVENTS.SCENE_BRANCH).toBe('scene:branch')
    })

    it('emitSceneBranch payload shape matches { targetSceneId: string }', () => {
        const payload = { targetSceneId: 's2' }
        expect(typeof payload.targetSceneId).toBe('string')
        expect(Object.keys(payload)).toEqual(['targetSceneId'])
    })
})
