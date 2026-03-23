/**
 * DeckPair tests — Sprint 18c/18d.
 *
 * Verifies A/B deck lifecycle: preload onto standby, take (swap/crossfade),
 * cold load into live, volume/playback delegation, and crossfade animation.
 *
 * Vitest env is 'node' — no DOM, no real PixiJS.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DOM mocks ────────────────────────────────────────────────────────────────

type EventHandler = (...args: unknown[]) => void

class MockVideoElement {
    crossOrigin = ''
    loop = false
    muted = false
    playsInline = false
    preload = ''
    src = ''
    volume = 1
    readyState = 4  // Already buffered — skip canplaythrough wait in tests
    error: { message: string } | null = null
    private listeners = new Map<string, EventHandler[]>()

    addEventListener(event: string, handler: EventHandler, _opts?: unknown): void {
        const handlers = this.listeners.get(event) ?? []
        handlers.push(handler)
        this.listeners.set(event, handlers)
    }
    removeEventListener(event: string, handler: EventHandler): void {
        const handlers = this.listeners.get(event) ?? []
        this.listeners.set(event, handlers.filter(h => h !== handler))
    }
    pause(): void { /* noop */ }
    load(): void { /* noop */ }
    removeAttribute(_name: string): void { this.src = '' }
}

vi.stubGlobal('document', {
    createElement: (tag: string) => {
        if (tag === 'video') return new MockVideoElement()
        return {}
    },
})

// ── RAF mock ─────────────────────────────────────────────────────────────────

let rafCallbacks: Array<{ id: number; fn: (time: number) => void }> = []
let nextRafId = 1

vi.stubGlobal('requestAnimationFrame', (fn: (time: number) => void) => {
    const id = nextRafId++
    rafCallbacks.push({ id, fn })
    return id
})

vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks = rafCallbacks.filter(cb => cb.id !== id)
})

vi.stubGlobal('performance', { now: vi.fn(() => 0) })

// ── fetch + Image mocks (for loadImage pipeline) ────────────────────────────

const mockBlob = { type: 'image/png' }
const mockObjectUrl = 'blob:mock-url'

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    blob: vi.fn().mockResolvedValue(mockBlob),
}))

vi.stubGlobal('URL', {
    createObjectURL: vi.fn().mockReturnValue(mockObjectUrl),
    revokeObjectURL: vi.fn(),
})

vi.stubGlobal('Image', class MockImage {
    src = ''
    async decode() { return }
})

// ── PIXI mock ────────────────────────────────────────────────────────────────

class MockContainer {
    children: unknown[] = []
    visible = true
    alpha = 1
    addChild(child: unknown): unknown {
        this.children.push(child)
        return child
    }
    removeChild(child: unknown): void {
        this.children = this.children.filter((c) => c !== child)
    }
    removeChildAt(idx: number): unknown {
        const [child] = this.children.splice(idx, 1)
        return child
    }
}

class MockSprite {
    texture: unknown
    width = 0
    height = 0
    visible = true
    alpha = 1
    constructor(texture?: unknown) {
        this.texture = texture
    }
    destroy(): void { /* noop */ }
}

class MockVideoSource {
    resource: unknown
    constructor(opts: unknown) {
        this.resource = (opts as { resource: unknown }).resource
    }
    async load(): Promise<MockVideoSource> { return this }
    destroy(): void { /* noop */ }
}

class MockImageSource {
    resource: unknown
    constructor(opts: unknown) {
        this.resource = (opts as { resource: unknown }).resource
    }
}

class MockTexture {
    source: unknown
    constructor(opts?: { source?: unknown }) {
        this.source = opts?.source ?? {}
    }
}

vi.mock('pixi.js', () => ({
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
    VideoSource: MockVideoSource,
    ImageSource: MockImageSource,
    Assets: { load: vi.fn().mockResolvedValue({}) },
}))

vi.mock('@shared/output-config', () => ({
    OUTPUT_CONFIG: { width: 1920, height: 1080 },
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DeckPair module', () => {
    it('exports DeckPair class', async () => {
        const mod = await import('./deck-pair')
        expect(typeof mod.DeckPair).toBe('function')
    })
})

describe('DeckPair — construction', () => {
    let DeckPair: typeof import('./deck-pair').DeckPair

    beforeEach(async () => {
        const mod = await import('./deck-pair')
        DeckPair = mod.DeckPair
        rafCallbacks = []
        nextRafId = 1
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(mockBlob),
        } as unknown as Response)
    })

    it('creates two sub-containers in the parent', () => {
        const parent = new MockContainer()
        new DeckPair(parent as never)
        // DeckA container + DeckB container
        expect(parent.children.length).toBe(2)
    })

    it('standby container starts hidden', () => {
        const parent = new MockContainer()
        new DeckPair(parent as never)
        const deckB = parent.children[1] as MockContainer
        expect(deckB.visible).toBe(false)
    })
})

describe('DeckPair — preload + take', () => {
    let DeckPair: typeof import('./deck-pair').DeckPair

    beforeEach(async () => {
        const mod = await import('./deck-pair')
        DeckPair = mod.DeckPair
        rafCallbacks = []
        nextRafId = 1
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(mockBlob),
        } as unknown as Response)
    })

    it('preloadVideo loads onto standby deck', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')
        // Standby (deckB) should have content loaded
        expect(deck.hasPreload('scene-1')).toBe(true)
        expect(deck.hasPreload('scene-2')).toBe(false)
    })

    it('preloadImage loads onto standby deck', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.preloadImage('http://localhost:8080/bg.png', 'scene-2')
        expect(deck.hasPreload('scene-2')).toBe(true)
    })

    it('take(0) swaps live and standby instantly', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)

        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')

        // Before take: deckA is live (visible), deckB is standby (hidden)
        const deckA = parent.children[0] as MockContainer
        const deckB = parent.children[1] as MockContainer
        expect(deckA.visible).toBe(true)
        expect(deckB.visible).toBe(false)

        deck.take(0)

        // After instant take: deckB is now live (visible, alpha 1), deckA is hidden
        expect(deckB.visible).toBe(true)
        expect(deckB.alpha).toBe(1)
        expect(deckA.visible).toBe(false)
    })

    it('hasPreload returns false after take()', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')
        expect(deck.hasPreload('scene-1')).toBe(true)

        deck.take(0)
        // After take, the former standby (now live) has scene-1 content,
        // but it's no longer on standby — hasPreload checks standby only
        expect(deck.hasPreload('scene-1')).toBe(false)
    })
})

describe('DeckPair — crossfade', () => {
    let DeckPair: typeof import('./deck-pair').DeckPair
    let CROSSFADE_MS: number

    beforeEach(async () => {
        const mod = await import('./deck-pair')
        DeckPair = mod.DeckPair
        CROSSFADE_MS = mod.CROSSFADE_MS
        rafCallbacks = []
        nextRafId = 1
        vi.mocked(performance.now).mockReturnValue(0)
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(mockBlob),
        } as unknown as Response)
    })

    it('take() with default duration starts crossfade (new deck visible, alpha 0)', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')

        const deckA = parent.children[0] as MockContainer
        const deckB = parent.children[1] as MockContainer

        deck.take()

        // New live (deckB) is visible but transparent — crossfade in progress
        expect(deckB.visible).toBe(true)
        expect(deckB.alpha).toBe(0)
        // Old live (deckA) stays visible during crossfade
        expect(deckA.visible).toBe(true)
    })

    it('crossfade animation advances alpha over time', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')

        const deckB = parent.children[1] as MockContainer

        deck.take(1000)

        // Simulate RAF at 500ms (halfway)
        expect(rafCallbacks.length).toBe(1)
        vi.mocked(performance.now).mockReturnValue(500)
        rafCallbacks[0].fn(500)

        expect(deckB.alpha).toBeCloseTo(0.5)
    })

    it('crossfade completes: old deck hidden and cleared', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')

        const deckA = parent.children[0] as MockContainer
        const deckB = parent.children[1] as MockContainer

        deck.take(1000)

        // Simulate RAF at 1000ms (complete)
        vi.mocked(performance.now).mockReturnValue(1000)
        rafCallbacks[0].fn(1000)

        // New deck fully opaque
        expect(deckB.alpha).toBe(1)
        expect(deckB.visible).toBe(true)
        // Old deck hidden
        expect(deckA.visible).toBe(false)
    })

    it('second take() cancels in-progress crossfade', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)

        // Preload scene-1 onto standby (B), take with crossfade
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')
        deck.take(1000)

        const deckA = parent.children[0] as MockContainer

        // Mid-crossfade: preload scene-2 onto new standby (A) and take again
        await deck.preloadVideo('http://localhost:8080/test2.mp4', 'scene-2')
        deck.take(1000)

        // First crossfade cancelled — deckA (old fading-out) was cleaned up
        // Now deckA is the new live (fading in), deckB is old
        expect(deckA.visible).toBe(true)
        expect(deckA.alpha).toBe(0) // New crossfade just started
    })

    it('destroy during crossfade does not throw', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')

        deck.take(1000)
        expect(() => deck.destroy()).not.toThrow()
    })

    it('cancel mid-crossfade snaps live deck to full alpha', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)

        // Preload and start crossfade A→B
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')
        deck.take(1000)

        const deckB = parent.children[1] as MockContainer

        // Advance to halfway (alpha 0.5)
        rafCallbacks[0].fn(500)

        // Preload scene-2 onto new standby (A) and take again
        await deck.preloadVideo('http://localhost:8080/test2.mp4', 'scene-2')
        deck.take(1000)

        // deckB (was mid-fade) should have been snapped to alpha 1
        expect(deckB.alpha).toBe(1)
    })

    it('take() with empty standby is a no-op', () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)

        const deckA = parent.children[0] as MockContainer
        const deckB = parent.children[1] as MockContainer

        // No preload — standby is empty
        deck.take(0)

        // Nothing changed — A still live, B still hidden
        expect(deckA.visible).toBe(true)
        expect(deckB.visible).toBe(false)
    })

    it('exports CROSSFADE_MS constant', () => {
        expect(typeof CROSSFADE_MS).toBe('number')
        expect(CROSSFADE_MS).toBeGreaterThan(0)
    })
})

describe('DeckPair — cold load', () => {
    let DeckPair: typeof import('./deck-pair').DeckPair

    beforeEach(async () => {
        const mod = await import('./deck-pair')
        DeckPair = mod.DeckPair
        rafCallbacks = []
        nextRafId = 1
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(mockBlob),
        } as unknown as Response)
    })

    it('loadVideo loads directly into live deck', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.loadVideo('http://localhost:8080/test.mp4')
        // Live deck (deckA) should have content
        const deckA = parent.children[0] as MockContainer
        expect(deckA.children.length).toBeGreaterThan(0)
    })

    it('loadImage loads directly into live deck', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        await deck.loadImage('http://localhost:8080/bg.png')
        const deckA = parent.children[0] as MockContainer
        expect(deckA.children.length).toBeGreaterThan(0)
    })
})

describe('DeckPair — volume and playback', () => {
    let DeckPair: typeof import('./deck-pair').DeckPair

    beforeEach(async () => {
        const mod = await import('./deck-pair')
        DeckPair = mod.DeckPair
        rafCallbacks = []
    })

    it('setVolume does not throw', () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        expect(() => deck.setVolume(0.5)).not.toThrow()
    })

    it('setPlaybackMode does not throw', () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        expect(() => deck.setPlaybackMode('once')).not.toThrow()
    })
})

describe('DeckPair — destroy', () => {
    let DeckPair: typeof import('./deck-pair').DeckPair

    beforeEach(async () => {
        const mod = await import('./deck-pair')
        DeckPair = mod.DeckPair
        rafCallbacks = []
    })

    it('destroy does not throw', () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        expect(() => deck.destroy()).not.toThrow()
    })

    it('destroy cleans up after preloaded content', async () => {
        const parent = new MockContainer()
        const deck = new DeckPair(parent as never)
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(mockBlob),
        } as unknown as Response)
        await deck.preloadVideo('http://localhost:8080/test.mp4', 'scene-1')
        expect(() => deck.destroy()).not.toThrow()
        expect(deck.hasPreload('scene-1')).toBe(false)
    })
})
