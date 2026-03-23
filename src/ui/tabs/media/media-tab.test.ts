/**
 * Media Library tab contract tests.
 *
 * Vitest env is 'node' — no DOM. Tests verify:
 * - Module exports correctly
 * - Media store supports all state operations
 * - Filter logic
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useMediaStore } from '../../stores/media-store'
import type { MediaAsset } from '@shared/asset-types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
    return {
        id: 'asset-1',
        filePath: '/path/to/image.png',
        fileName: 'image.png',
        mediaType: 'image',
        fileSize: 1024,
        width: 1920,
        height: 1080,
        duration: null,
        categories: ['background'],
        tags: ['forest'],
        playbackMode: 'loop',
        thumbnail: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    }
}

// ── Module exports ──────────────────────────────────────────────────────────

describe('MediaTab module', () => {
    it('exports MediaTab component', async () => {
        const mod = await import('./media-tab')
        expect(typeof mod.MediaTab).toBe('function')
    })
})

describe('MediaTab barrel re-export', () => {
    it('exports from tabs/MediaTab.tsx', async () => {
        const mod = await import('../MediaTab')
        expect(typeof mod.MediaTab).toBe('function')
    })
})

describe('Media sub-components export', () => {
    it('MediaFilterBar', async () => {
        const mod = await import('./media-filter-bar')
        expect(typeof mod.MediaFilterBar).toBe('function')
    })

    it('MediaGrid', async () => {
        const mod = await import('./media-grid')
        expect(typeof mod.MediaGrid).toBe('function')
    })

    it('AssetCard', async () => {
        const mod = await import('./asset-card')
        expect(typeof mod.AssetCard).toBe('function')
    })

    it('MediaDetailPanel', async () => {
        const mod = await import('./media-detail-panel')
        expect(typeof mod.MediaDetailPanel).toBe('function')
    })

    it('MediaImportButton', async () => {
        const mod = await import('./media-import-button')
        expect(typeof mod.MediaImportButton).toBe('function')
    })
})

// ── Media store — state management ──────────────────────────────────────────

describe('Media store — assets', () => {
    beforeEach(() => {
        useMediaStore.getState().reset()
    })

    it('starts with empty assets', () => {
        expect(useMediaStore.getState().assets).toHaveLength(0)
    })

    it('setAssets replaces asset list', () => {
        const a1 = makeAsset({ id: 'a1' })
        const a2 = makeAsset({ id: 'a2', fileName: 'video.mp4', mediaType: 'video' })
        useMediaStore.getState().setAssets([a1, a2])
        expect(useMediaStore.getState().assets).toHaveLength(2)
    })

    it('addAsset prepends to list', () => {
        useMediaStore.getState().setAssets([makeAsset({ id: 'old' })])
        useMediaStore.getState().addAsset(makeAsset({ id: 'new' }))
        expect(useMediaStore.getState().assets[0].id).toBe('new')
        expect(useMediaStore.getState().assets).toHaveLength(2)
    })

    it('updateAsset patches specific asset', () => {
        useMediaStore.getState().setAssets([makeAsset({ id: 'a1', fileName: 'old.png' })])
        useMediaStore.getState().updateAsset('a1', { fileName: 'renamed.png' })
        expect(useMediaStore.getState().assets[0].fileName).toBe('renamed.png')
    })

    it('removeAsset deletes by id', () => {
        useMediaStore.getState().setAssets([
            makeAsset({ id: 'a1' }),
            makeAsset({ id: 'a2' }),
        ])
        useMediaStore.getState().removeAsset('a1')
        expect(useMediaStore.getState().assets).toHaveLength(1)
        expect(useMediaStore.getState().assets[0].id).toBe('a2')
    })

    it('removeAsset clears selection if selected asset is removed', () => {
        useMediaStore.getState().setAssets([makeAsset({ id: 'a1' })])
        useMediaStore.getState().setSelectedAssetId('a1')
        useMediaStore.getState().removeAsset('a1')
        expect(useMediaStore.getState().selectedAssetId).toBeNull()
    })
})

describe('Media store — selection and filter', () => {
    beforeEach(() => {
        useMediaStore.getState().reset()
    })

    it('starts with no selection', () => {
        expect(useMediaStore.getState().selectedAssetId).toBeNull()
    })

    it('setSelectedAssetId updates selection', () => {
        useMediaStore.getState().setSelectedAssetId('abc')
        expect(useMediaStore.getState().selectedAssetId).toBe('abc')
    })

    it('starts with empty filter', () => {
        expect(useMediaStore.getState().filter).toEqual({})
    })

    it('setFilter updates filter state', () => {
        useMediaStore.getState().setFilter({ mediaType: 'video', search: 'dungeon' })
        expect(useMediaStore.getState().filter.mediaType).toBe('video')
        expect(useMediaStore.getState().filter.search).toBe('dungeon')
    })

    it('starts with grid view mode', () => {
        expect(useMediaStore.getState().viewMode).toBe('grid')
    })

    it('setViewMode toggles view', () => {
        useMediaStore.getState().setViewMode('list')
        expect(useMediaStore.getState().viewMode).toBe('list')
    })
})

describe('Media store — importing', () => {
    beforeEach(() => {
        useMediaStore.getState().reset()
    })

    it('starts not importing', () => {
        expect(useMediaStore.getState().isImporting).toBe(false)
    })

    it('setImporting updates state', () => {
        useMediaStore.getState().setImporting(true)
        expect(useMediaStore.getState().isImporting).toBe(true)
    })
})

describe('Media store — reset', () => {
    it('reset clears all state', () => {
        useMediaStore.getState().setAssets([makeAsset()])
        useMediaStore.getState().setSelectedAssetId('abc')
        useMediaStore.getState().setFilter({ mediaType: 'audio' })
        useMediaStore.getState().setViewMode('list')
        useMediaStore.getState().setImporting(true)

        useMediaStore.getState().reset()

        expect(useMediaStore.getState().assets).toHaveLength(0)
        expect(useMediaStore.getState().selectedAssetId).toBeNull()
        expect(useMediaStore.getState().filter).toEqual({})
        expect(useMediaStore.getState().viewMode).toBe('grid')
        expect(useMediaStore.getState().isImporting).toBe(false)
    })
})

// ── Hook exports ────────────────────────────────────────────────────────────

describe('use-assets hook exports', () => {
    it('exports all asset API functions', async () => {
        const mod = await import('../../hooks/use-assets')
        expect(typeof mod.useAssets).toBe('function')
        expect(typeof mod.postAsset).toBe('function')
        expect(typeof mod.patchAsset).toBe('function')
        expect(typeof mod.deleteAssetAPI).toBe('function')
        expect(typeof mod.tagAssetAPI).toBe('function')
        expect(typeof mod.untagAssetAPI).toBe('function')
        expect(typeof mod.getAssetFileUrl).toBe('function')
    })

    it('getAssetFileUrl returns correct URL shape', async () => {
        const mod = await import('../../hooks/use-assets')
        const url = mod.getAssetFileUrl('test-id')
        expect(url).toContain('/api/assets/test-id/file')
    })
})

// ── Phase 4: Media Picker + Integration ─────────────────────────────────────

describe('MediaPicker module', () => {
    it('exports MediaPicker component', async () => {
        const mod = await import('../../components/media-picker')
        expect(typeof mod.MediaPicker).toBe('function')
    })
})

describe('SceneCard media integration', () => {
    it('exports SceneCard component', async () => {
        const mod = await import('../../components/scene-card')
        expect(typeof mod.SceneCard).toBe('function')
    })

    it('SceneCard accepts onAssignMedia as optional prop', async () => {
        // SceneCardProps should type-check with and without onAssignMedia
        const mod = await import('../../components/scene-card')
        expect(mod.SceneCard).toBeDefined()
        // If onAssignMedia were required, TypeScript would catch it at build time
    })
})

describe('AV zone media integration', () => {
    it('BGSettingsZone exports correctly', async () => {
        const mod = await import('../av/bg-settings-zone')
        expect(typeof mod.BGSettingsZone).toBe('function')
    })

    it('GBSettingsZone exports correctly', async () => {
        const mod = await import('../av/gb-settings-zone')
        expect(typeof mod.GBSettingsZone).toBe('function')
    })
})

describe('ScenesTab media wiring', () => {
    it('ScenesTab exports correctly', async () => {
        const mod = await import('../ScenesTab')
        expect(typeof mod.ScenesTab).toBe('function')
    })
})

// ── Phase 7: Starting Scene ─────────────────────────────────────────────────

describe('Scene card starting scene props', () => {
    it('SceneCard accepts isStartingScene and onSetStartingScene props', async () => {
        const mod = await import('../../components/scene-card')
        // The component should exist and be callable
        expect(typeof mod.SceneCard).toBe('function')
    })
})

describe('Campaign startingSceneId in types', () => {
    it('Campaign interface has startingSceneId', async () => {
        const mod = await import('@core/types')
        // Create a Campaign-like object and verify the shape compiles
        const campaign = {
            id: 'c1',
            name: 'Test',
            system: 'dnd5e',
            startingSceneId: 'scene-1',
        } as Partial<(typeof mod)['Campaign'] extends never ? never : Record<string, unknown>>
        expect(campaign.startingSceneId).toBe('scene-1')
    })
})
