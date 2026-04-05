/**
 * SceneStore tests — Sprint 18b.
 *
 * Pure Zustand store tests for cuedScene, takeScene, and autoCue.
 * Source: src/ui/stores/scene-store.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useSceneStore } from './scene-store'
import type { Scene } from '@core/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeScene(overrides: Partial<Scene> & { id: string; sortOrder: number }): Scene {
    return {
        campaignId: 'camp-1',
        name: `Scene ${overrides.id}`,
        backgroundPath: null,
        gameboardPath: null,
        backgroundAssetId: null,
        gameboardAssetId: null,
        overlays: [],
        particles: { type: 'none', intensity: 0 },
        colorGrade: { brightness: 0, contrast: 0, saturation: 0, hue: 0, fade: 0, vignette: 0 },
        gbColorGrade: { brightness: 0, contrast: 0, saturation: 0, hue: 0, fade: 0, vignette: 0 },
        audioMood: 0.5,
        notes: '',
        linkedNPCIds: [],
        linkedLocationIds: [],
        scratchpad: '',
        nextSceneId: null,
        branches: [],
        fogEnabled: false,
        fogData: null,
        ...overrides,
    }
}

const sceneA = makeScene({ id: 'a', sortOrder: 0, name: 'Opening' })
const sceneB = makeScene({ id: 'b', sortOrder: 10, name: 'Midpoint' })
const sceneC = makeScene({ id: 'c', sortOrder: 20, name: 'Climax' })
const allScenes = [sceneA, sceneB, sceneC]

const sceneBranched = makeScene({
    id: 'branched',
    sortOrder: 0,
    branches: [{ label: 'Fight', targetSceneId: 'b', transitionNote: '' }],
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SceneStore — default state', () => {
    beforeEach(() => {
        useSceneStore.setState({ activeScene: null, cuedScene: null, previewScene: null, lastSavedAt: null })
    })

    it('activeScene defaults to null', () => {
        expect(useSceneStore.getState().activeScene).toBeNull()
    })

    it('cuedScene defaults to null', () => {
        expect(useSceneStore.getState().cuedScene).toBeNull()
    })

    it('lastSavedAt defaults to null', () => {
        expect(useSceneStore.getState().lastSavedAt).toBeNull()
    })
})

describe('SceneStore — setCuedScene', () => {
    beforeEach(() => {
        useSceneStore.setState({ activeScene: sceneA, cuedScene: null, previewScene: null })
    })

    it('sets cuedScene', () => {
        useSceneStore.getState().setCuedScene(sceneB)
        expect(useSceneStore.getState().cuedScene).toEqual(sceneB)
    })

    it('clears cuedScene when set to null', () => {
        useSceneStore.getState().setCuedScene(sceneB)
        useSceneStore.getState().setCuedScene(null)
        expect(useSceneStore.getState().cuedScene).toBeNull()
    })
})

describe('SceneStore — takeScene', () => {
    beforeEach(() => {
        useSceneStore.setState({ activeScene: sceneA, cuedScene: sceneB, previewScene: null })
    })

    it('moves cuedScene to activeScene', () => {
        useSceneStore.getState().takeScene(allScenes)
        expect(useSceneStore.getState().activeScene).toEqual(sceneB)
    })

    it('auto-cues the next scene after take', () => {
        useSceneStore.getState().takeScene(allScenes)
        expect(useSceneStore.getState().cuedScene).toEqual(sceneC)
    })

    it('does not auto-cue after take when new active has branches', () => {
        useSceneStore.setState({ activeScene: sceneA, cuedScene: sceneBranched, previewScene: null })
        useSceneStore.getState().takeScene([sceneA, sceneBranched, sceneB])
        expect(useSceneStore.getState().activeScene).toEqual(sceneBranched)
        expect(useSceneStore.getState().cuedScene).toBeNull()
    })

    it('sets cuedScene to null when taken scene is last', () => {
        useSceneStore.setState({ activeScene: sceneB, cuedScene: sceneC, previewScene: null })
        useSceneStore.getState().takeScene(allScenes)
        expect(useSceneStore.getState().cuedScene).toBeNull()
    })

    it('is a no-op when cuedScene is null', () => {
        useSceneStore.setState({ activeScene: sceneA, cuedScene: null, previewScene: null })
        useSceneStore.getState().takeScene(allScenes)
        expect(useSceneStore.getState().activeScene).toEqual(sceneA)
    })
})

describe('SceneStore — autoCue', () => {
    beforeEach(() => {
        useSceneStore.setState({ activeScene: sceneA, cuedScene: null, previewScene: null })
    })

    it('cues the next scene by sortOrder', () => {
        useSceneStore.getState().autoCue(allScenes)
        expect(useSceneStore.getState().cuedScene).toEqual(sceneB)
    })

    it('sets cuedScene to null when active is the last scene', () => {
        useSceneStore.setState({ activeScene: sceneC })
        useSceneStore.getState().autoCue(allScenes)
        expect(useSceneStore.getState().cuedScene).toBeNull()
    })

    it('does not auto-cue when active scene has branches', () => {
        useSceneStore.setState({ activeScene: sceneBranched })
        useSceneStore.getState().autoCue([sceneBranched, sceneB])
        expect(useSceneStore.getState().cuedScene).toBeNull()
    })

    it('does nothing when activeScene is null', () => {
        useSceneStore.setState({ activeScene: null })
        useSceneStore.getState().autoCue(allScenes)
        expect(useSceneStore.getState().cuedScene).toBeNull()
    })

    it('handles unsorted input correctly', () => {
        useSceneStore.setState({ activeScene: sceneA })
        useSceneStore.getState().autoCue([sceneC, sceneA, sceneB])
        expect(useSceneStore.getState().cuedScene).toEqual(sceneB)
    })
})

describe('SceneStore — setActiveScene clears cuedScene and previewScene', () => {
    it('clears cuedScene and previewScene when set to null (Campaign Home)', () => {
        useSceneStore.setState({ activeScene: sceneA, cuedScene: sceneB, previewScene: sceneC })
        useSceneStore.getState().setActiveScene(null)
        expect(useSceneStore.getState().cuedScene).toBeNull()
        expect(useSceneStore.getState().previewScene).toBeNull()
    })

    it('preserves cuedScene and previewScene when setting a new active scene', () => {
        useSceneStore.setState({ activeScene: sceneA, cuedScene: sceneC, previewScene: sceneB })
        useSceneStore.getState().setActiveScene(sceneB)
        expect(useSceneStore.getState().cuedScene).toEqual(sceneC)
        expect(useSceneStore.getState().previewScene).toEqual(sceneB)
    })
})

describe('SceneStore — lastSavedAt (Sprint 22a)', () => {
    beforeEach(() => {
        useSceneStore.setState({ activeScene: sceneA, lastSavedAt: null })
    })

    it('setLastSavedAt stores a timestamp', () => {
        useSceneStore.getState().setLastSavedAt(12345)
        expect(useSceneStore.getState().lastSavedAt).toBe(12345)
    })

    it('setActiveScene resets lastSavedAt to null', () => {
        useSceneStore.getState().setLastSavedAt(99999)
        useSceneStore.getState().setActiveScene(sceneB)
        expect(useSceneStore.getState().lastSavedAt).toBeNull()
    })

    it('setActiveScene(null) also resets lastSavedAt', () => {
        useSceneStore.getState().setLastSavedAt(99999)
        useSceneStore.getState().setActiveScene(null)
        expect(useSceneStore.getState().lastSavedAt).toBeNull()
    })
})

describe('SceneStore — previewScene', () => {
    beforeEach(() => {
        useSceneStore.setState({ activeScene: sceneA, cuedScene: sceneB, previewScene: null })
    })

    it('defaults to null', () => {
        expect(useSceneStore.getState().previewScene).toBeNull()
    })

    it('setPreviewScene sets the preview scene', () => {
        useSceneStore.getState().setPreviewScene(sceneC)
        expect(useSceneStore.getState().previewScene).toEqual(sceneC)
    })

    it('setPreviewScene(null) clears preview', () => {
        useSceneStore.getState().setPreviewScene(sceneC)
        useSceneStore.getState().setPreviewScene(null)
        expect(useSceneStore.getState().previewScene).toBeNull()
    })

    it('takeScene clears previewScene', () => {
        useSceneStore.getState().setPreviewScene(sceneC)
        useSceneStore.getState().takeScene(allScenes)
        expect(useSceneStore.getState().previewScene).toBeNull()
    })

    it('previewScene is independent of cuedScene', () => {
        useSceneStore.getState().setPreviewScene(sceneC)
        useSceneStore.getState().setCuedScene(sceneA)
        expect(useSceneStore.getState().previewScene).toEqual(sceneC)
        expect(useSceneStore.getState().cuedScene).toEqual(sceneA)
    })
})
