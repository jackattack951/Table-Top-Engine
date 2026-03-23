/**
 * LayerStack tests — Phase 5b.
 *
 * Vitest env is 'node' — no DOM, no real PixiJS.
 * Tests verify module exports, layer structure, and the loadImage API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── PIXI mock ────────────────────────────────────────────────────────────────

class MockContainer {
    visible = true
    alpha = 1
    children: unknown[] = []
    filters: unknown[] | null = null
    addChild(child: unknown): unknown {
        this.children.push(child)
        return child
    }
    removeChildAt(index: number): unknown {
        return this.children.splice(index, 1)[0]
    }
}

class MockSprite {
    texture: unknown
    width = 0
    height = 0
    constructor(texture?: unknown) {
        this.texture = texture
    }
    destroy(): void { /* noop */ }
}

class MockApplication {
    stage = new MockContainer()
    async init(): Promise<void> { /* noop */ }
    destroy(): void { /* noop */ }
}

class MockImageSource {
    resource: unknown
    constructor(opts: { resource: unknown }) {
        this.resource = opts.resource
    }
}

class MockTexture {
    source: unknown
    constructor(opts?: { source: unknown }) {
        this.source = opts?.source ?? null
    }
}

vi.mock('pixi.js', () => ({
    Container: MockContainer,
    Sprite: MockSprite,
    Application: MockApplication,
    ImageSource: MockImageSource,
    Texture: MockTexture,
    Assets: { load: vi.fn().mockResolvedValue({ _mock: true }) },
}))

vi.mock('@shared/output-config', () => ({
    OUTPUT_CONFIG: { width: 1920, height: 1080 },
}))

vi.mock('@shared/color-constants', () => ({
    COLORS: { BLACK: 0x000000 },
}))

vi.mock('./color-grade-filter', () => ({
    ColorGradeFilter: class {
        setValues(): void { /* noop */ }
    },
}))

// Stub document.createElement for canvas
vi.stubGlobal('document', {
    createElement: () => ({
        getContext: () => null,
        width: 0,
        height: 0,
    }),
})

// Mock Image (for loadImage's fetch → blob → Image → decode flow)
class MockImage {
    src = ''
    async decode(): Promise<void> { /* noop */ }
}
vi.stubGlobal('Image', MockImage)

// Mock URL.createObjectURL / revokeObjectURL
vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {},
})

// Mock fetch for loadImage
beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['mock'], { type: 'image/png' })),
    }))
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LayerStack module', () => {
    it('exports LayerStack class', async () => {
        const mod = await import('./layer-stack')
        expect(typeof mod.LayerStack).toBe('function')
    })
})

describe('LayerStack structure', () => {
    it('has all 8 layers', async () => {
        const { LayerStack } = await import('./layer-stack')
        const ls = new LayerStack()
        const layerNames = Object.keys(ls.layers)
        expect(layerNames).toEqual([
            'background', 'gameboard', 'fog', 'fx',
            'overlay', 'particle', 'colorGrade', 'ui',
        ])
    })

    it('engines start as null', async () => {
        const { LayerStack } = await import('./layer-stack')
        const ls = new LayerStack()
        expect(ls.engines.background).toBeNull()
        expect(ls.engines.gameboard).toBeNull()
    })
})

describe('LayerStack.loadImage', () => {
    it('loadImage method exists', async () => {
        const { LayerStack } = await import('./layer-stack')
        const ls = new LayerStack()
        expect(typeof ls.loadImage).toBe('function')
    })

    it('loadImage loads into the specified layer', async () => {
        const { LayerStack } = await import('./layer-stack')
        const ls = new LayerStack()
        await ls.init(document.createElement('canvas') as never)
        await ls.loadImage('background', 'http://localhost:8080/api/assets/123/file')
        // The background layer should have a child (the sprite)
        expect(ls.layers.background.children.length).toBe(1)
    })

    it('loadImage clears previous children before adding', async () => {
        const { LayerStack } = await import('./layer-stack')
        const ls = new LayerStack()
        await ls.init(document.createElement('canvas') as never)
        await ls.loadImage('gameboard', 'http://localhost:8080/api/assets/1/file')
        expect(ls.layers.gameboard.children.length).toBe(1)
        await ls.loadImage('gameboard', 'http://localhost:8080/api/assets/2/file')
        expect(ls.layers.gameboard.children.length).toBe(1)
    })
})

describe('LayerStack visibility', () => {
    it('setLayerVisible toggles layer visibility', async () => {
        const { LayerStack } = await import('./layer-stack')
        const ls = new LayerStack()
        ls.setLayerVisible('fog', false)
        expect(ls.layers.fog.visible).toBe(false)
        ls.setLayerVisible('fog', true)
        expect(ls.layers.fog.visible).toBe(true)
    })

    it('setLayerAlpha changes layer alpha', async () => {
        const { LayerStack } = await import('./layer-stack')
        const ls = new LayerStack()
        ls.setLayerAlpha('overlay', 0.5)
        expect(ls.layers.overlay.alpha).toBe(0.5)
    })
})
