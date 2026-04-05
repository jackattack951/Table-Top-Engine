/**
 * SceneSummary tests — Sprint 22a.
 * Tests the pure buildSceneSummaryMarkdown() function.
 */
import { describe, it, expect } from 'vitest'
import { buildSceneSummaryMarkdown } from './scene-summary'
import type { SceneSummaryResponse } from '../hooks/use-scene-summary'
import type { Scene } from '@core/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const defaultColorGrade = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff' }

function makeScene(overrides: Partial<Scene> & { id: string }): Scene {
    return {
        campaignId: 'camp-1',
        name: 'Test Scene',
        sortOrder: 0,
        backgroundPath: null,
        gameboardPath: null,
        backgroundAssetId: null,
        gameboardAssetId: null,
        overlays: [],
        particles: { type: 'none', intensity: 0 },
        colorGrade: defaultColorGrade,
        gbColorGrade: defaultColorGrade,
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

const scene = makeScene({ id: 's1', name: 'The Dragon\'s Lair' })
const otherScene = makeScene({ id: 's2', name: 'The Aftermath' })

const emptySummary: SceneSummaryResponse = {
    scene,
    npcs: [],
    notes: [],
    items: [],
    bgAsset: null,
    gbAsset: null,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildSceneSummaryMarkdown — headings', () => {
    it('includes the scene name as H1', () => {
        const md = buildSceneSummaryMarkdown(emptySummary, [scene])
        expect(md).toContain('# Scene: The Dragon\'s Lair')
    })

    it('includes all section headings', () => {
        const md = buildSceneSummaryMarkdown(emptySummary, [scene])
        expect(md).toContain('## Media')
        expect(md).toContain('## Atmosphere')
        expect(md).toContain('## NPCs (0)')
        expect(md).toContain('## Items (0)')
        expect(md).toContain('## Notes (0)')
        expect(md).toContain('## Branches (0)')
    })
})

describe('buildSceneSummaryMarkdown — media', () => {
    it('shows None when no assets assigned', () => {
        const md = buildSceneSummaryMarkdown(emptySummary, [scene])
        expect(md).toContain('**Background:** None assigned')
        expect(md).toContain('**Gameboard:** None assigned')
    })

    it('shows asset filenames when assigned', () => {
        const summary: SceneSummaryResponse = {
            ...emptySummary,
            bgAsset: { fileName: 'cave.webm', mediaType: 'video' },
            gbAsset: { fileName: 'dragon-lair.png', mediaType: 'image' },
        }
        const md = buildSceneSummaryMarkdown(summary, [scene])
        expect(md).toContain('**Background:** cave.webm')
        expect(md).toContain('**Gameboard:** dragon-lair.png')
    })
})

describe('buildSceneSummaryMarkdown — atmosphere', () => {
    it('shows particles as Off when type is none', () => {
        const md = buildSceneSummaryMarkdown(emptySummary, [scene])
        expect(md).toContain('**Particles:** Off')
    })

    it('shows particle type and intensity', () => {
        const summary: SceneSummaryResponse = {
            ...emptySummary,
            scene: { ...scene, particles: { type: 'embers', intensity: 0.75 } },
        }
        const md = buildSceneSummaryMarkdown(summary, [scene])
        expect(md).toContain('**Particles:** Embers (75%)')
    })

    it('shows fog status', () => {
        const md = buildSceneSummaryMarkdown(
            { ...emptySummary, scene: { ...scene, fogEnabled: true } },
            [scene],
        )
        expect(md).toContain('**Fog:** Enabled')

        const md2 = buildSceneSummaryMarkdown(emptySummary, [scene])
        expect(md2).toContain('**Fog:** Disabled')
    })

    it('matches known color grade preset', () => {
        const firelightGrade = { brightness: 0.05, contrast: 0.15, saturation: 0.1, temperature: 0.4, tint: '#ff8844' }
        const summary: SceneSummaryResponse = {
            ...emptySummary,
            scene: { ...scene, colorGrade: firelightGrade, gbColorGrade: defaultColorGrade },
        }
        const md = buildSceneSummaryMarkdown(summary, [scene])
        expect(md).toContain('**BG Color Grade:** Firelight')
        expect(md).toContain('**GB Color Grade:** Default')
    })

    it('shows Custom for non-preset color grade', () => {
        const customGrade = { brightness: 0.12, contrast: 0.33, saturation: -0.2, temperature: 0.1, tint: '#aabbcc' }
        const summary: SceneSummaryResponse = {
            ...emptySummary,
            scene: { ...scene, colorGrade: customGrade },
        }
        const md = buildSceneSummaryMarkdown(summary, [scene])
        expect(md).toContain('**BG Color Grade:** Custom')
    })
})

describe('buildSceneSummaryMarkdown — NPCs, items, notes', () => {
    it('lists NPC names', () => {
        const summary: SceneSummaryResponse = {
            ...emptySummary,
            npcs: [
                { id: 'n1', campaignId: 'camp-1', name: 'Smaug', statBlock: {}, personality: '', notes: '' },
                { id: 'n2', campaignId: 'camp-1', name: 'Kobold', statBlock: {}, personality: '', notes: '' },
            ],
        }
        const md = buildSceneSummaryMarkdown(summary, [scene])
        expect(md).toContain('## NPCs (2)')
        expect(md).toContain('- Smaug')
        expect(md).toContain('- Kobold')
    })

    it('lists items with status', () => {
        const summary: SceneSummaryResponse = {
            ...emptySummary,
            items: [
                {
                    id: 'i1', campaignId: 'camp-1', name: 'Shield', description: '', rarity: null,
                    category: null, properties: [], tags: [], sourceNoteId: null,
                    createdAt: '', updatedAt: '', status: 'loot',
                },
            ],
        }
        const md = buildSceneSummaryMarkdown(summary, [scene])
        expect(md).toContain('## Items (1)')
        expect(md).toContain('- Shield [loot]')
    })
})

describe('buildSceneSummaryMarkdown — branches', () => {
    it('resolves branch target names', () => {
        const branchedScene = makeScene({
            id: 's1',
            name: 'Start',
            branches: [{ label: 'Peaceful', targetSceneId: 's2', transitionNote: '' }],
        })
        const summary: SceneSummaryResponse = { ...emptySummary, scene: branchedScene }
        const md = buildSceneSummaryMarkdown(summary, [branchedScene, otherScene])
        expect(md).toContain('## Branches (1)')
        expect(md).toContain('- Peaceful → The Aftermath')
    })

    it('shows unknown for unresolvable branch target', () => {
        const branchedScene = makeScene({
            id: 's1',
            name: 'Start',
            branches: [{ label: 'Mystery', targetSceneId: 'missing', transitionNote: '' }],
        })
        const summary: SceneSummaryResponse = { ...emptySummary, scene: branchedScene }
        const md = buildSceneSummaryMarkdown(summary, [branchedScene])
        expect(md).toContain('- Mystery → (unknown scene)')
    })
})
