/**
 * VideoEngine tests — verifies module exports, playback mode API, lifecycle,
 * buffered loading (canplaythrough), and fade-in behavior.
 *
 * Vitest env is 'node' — no DOM, no real PixiJS.
 * Tests verify module exports, playback mode API, and type contracts.
 *
 * Sprint 18a: Added tests for canplaythrough wait and fade-in animation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── DOM mocks ────────────────────────────────────────────────────────────────

type EventHandler = (...args: unknown[]) => void

/** Minimal HTMLVideoElement mock that tracks event listeners. */
class MockVideoElement {
    crossOrigin = ''
    loop = false
    muted = false
    playsInline = false
    preload = ''
    src = ''
    volume = 1
    readyState = 0
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

    /** Simulate firing an event (for test control). */
    _fireEvent(event: string): void {
        const handlers = this.listeners.get(event) ?? []
        for (const h of [...handlers]) h()
    }

    pause(): void { /* noop */ }
    load(): void { /* noop */ }
    removeAttribute(_name: string): void { this.src = '' }
}

let lastCreatedVideo: MockVideoElement | null = null

vi.stubGlobal('document', {
    createElement: (tag: string) => {
        if (tag === 'video') {
            lastCreatedVideo = new MockVideoElement()
            return lastCreatedVideo
        }
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

// ── PIXI mock ────────────────────────────────────────────────────────────────

class MockContainer {
    children: unknown[] = []
    addChild(child: unknown): unknown {
        this.children.push(child)
        return child
    }
    removeChild(child: unknown): void {
        this.children = this.children.filter((c) => c !== child)
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
}

class MockTexture {
    source: unknown
    constructor(opts?: { source?: unknown }) {
        this.source = opts?.source ?? { update: vi.fn() }
    }
    static from(src: unknown) {
        return new MockTexture({ source: { update: vi.fn(), _src: src } })
    }
}

vi.mock('pixi.js', () => ({
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
    VideoSource: MockVideoSource,
    Assets: { load: vi.fn().mockResolvedValue({}) },
}))

vi.mock('@shared/output-config', () => ({
    OUTPUT_CONFIG: { width: 1920, height: 1080 },
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('VideoEngine module', () => {
    it('exports VideoEngine class', async () => {
        const mod = await import('./video-engine')
        expect(typeof mod.VideoEngine).toBe('function')
    })
})

describe('VideoEngine playback modes', () => {
    let VideoEngine: typeof import('./video-engine').VideoEngine

    beforeEach(async () => {
        const mod = await import('./video-engine')
        VideoEngine = mod.VideoEngine
        lastCreatedVideo = null
        rafCallbacks = []
    })

    it('defaults to loop playback mode', () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        expect(engine.getPlaybackMode()).toBe('loop')
    })

    it('setPlaybackMode changes the mode', () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        engine.setPlaybackMode('once')
        expect(engine.getPlaybackMode()).toBe('once')
        engine.setPlaybackMode('freeze')
        expect(engine.getPlaybackMode()).toBe('freeze')
    })

    it('setVisible controls sprite visibility', () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        // No sprite yet — should not throw
        engine.setVisible(false)
        engine.setVisible(true)
    })

    it('setAlpha controls sprite alpha', () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        // No sprite yet — should not throw
        engine.setAlpha(0.5)
    })

    it('destroy cleans up without throwing', () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        // Should not throw even with no active video
        engine.destroy()
    })
})

describe('VideoEngine buffered loading (Sprint 18a)', () => {
    let VideoEngine: typeof import('./video-engine').VideoEngine

    beforeEach(async () => {
        const mod = await import('./video-engine')
        VideoEngine = mod.VideoEngine
        lastCreatedVideo = null
        rafCallbacks = []
        nextRafId = 1
    })

    afterEach(() => {
        rafCallbacks = []
    })

    it('waits for canplaythrough before creating sprite', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)

        // Start load — it should be waiting for canplaythrough
        const loadPromise = engine.load('http://localhost:8080/test.mp4')

        // Sprite should NOT be in container yet (still waiting for canplaythrough)
        expect(container.children.length).toBe(0)

        // Fire canplaythrough to let load proceed
        lastCreatedVideo!._fireEvent('canplaythrough')
        await loadPromise

        // Now sprite should be in the container
        expect(container.children.length).toBe(1)
    })

    it('resolves immediately if readyState >= 4 (already buffered)', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)

        // Patch createElement to produce a pre-buffered video
        const origCreate = (document as { createElement: (tag: string) => unknown }).createElement
        ;(document as { createElement: (tag: string) => unknown }).createElement = (tag: string) => {
            const el = origCreate(tag)
            if (tag === 'video') (el as MockVideoElement).readyState = 4
            return el
        }

        try {
            await engine.load('http://localhost:8080/test.mp4')
            // Sprite should be in container (no waiting needed)
            expect(container.children.length).toBe(1)
        } finally {
            ;(document as { createElement: (tag: string) => unknown }).createElement = origCreate
        }
    })

    it('starts sprite at alpha 0 and schedules fade-in', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)

        const loadPromise = engine.load('http://localhost:8080/test.mp4')
        lastCreatedVideo!._fireEvent('canplaythrough')
        await loadPromise

        const sprite = container.children[0] as MockSprite
        // Sprite starts at alpha 0 (fade-in just scheduled)
        expect(sprite.alpha).toBe(0)

        // A requestAnimationFrame callback should be queued
        expect(rafCallbacks.length).toBeGreaterThan(0)
    })

    it('fade-in animates alpha to 1 over time', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        const perfNow = performance.now as ReturnType<typeof vi.fn>

        perfNow.mockReturnValue(0)
        const loadPromise = engine.load('http://localhost:8080/test.mp4')
        lastCreatedVideo!._fireEvent('canplaythrough')
        await loadPromise

        const sprite = container.children[0] as MockSprite

        // Simulate halfway through fade (150ms of 300ms)
        perfNow.mockReturnValue(150)
        const cb1 = rafCallbacks.shift()!
        cb1.fn(150)
        expect(sprite.alpha).toBeCloseTo(0.5, 1)

        // Simulate end of fade (300ms)
        perfNow.mockReturnValue(300)
        const cb2 = rafCallbacks.shift()!
        cb2.fn(300)
        expect(sprite.alpha).toBe(1)

        // No more raf callbacks after fade completes
        expect(rafCallbacks.length).toBe(0)
    })

    it('destroy cancels in-progress fade', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)

        const loadPromise = engine.load('http://localhost:8080/test.mp4')
        lastCreatedVideo!._fireEvent('canplaythrough')
        await loadPromise

        // Fade is in progress (raf callback queued)
        expect(rafCallbacks.length).toBeGreaterThan(0)

        // Destroy should cancel the fade
        engine.destroy()
        expect(rafCallbacks.length).toBe(0)
    })

    it('handles video error during canplaythrough wait', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const loadPromise = engine.load('http://localhost:8080/bad.mp4')

        // Simulate error
        lastCreatedVideo!.error = { message: 'decode error' }
        lastCreatedVideo!._fireEvent('error')
        await loadPromise

        // Should not add sprite on error
        expect(container.children.length).toBe(0)
        expect(consoleSpy).toHaveBeenCalled()

        consoleSpy.mockRestore()
    })

    it('abandons stale load when a newer load is called', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        // Suppress expected abort error log
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Start first load
        const load1 = engine.load('http://localhost:8080/scene1.mp4')

        // Start second load before first finishes — destroy() in load() aborts video1
        const load2 = engine.load('http://localhost:8080/scene2.mp4')
        const video2 = lastCreatedVideo!

        // First load was aborted by destroy() — await should resolve cleanly
        await load1

        // Container should be empty (first load aborted, second still pending)
        expect(container.children.length).toBe(0)

        // Resolve second load
        video2._fireEvent('canplaythrough')
        await load2

        // Second load should succeed
        expect(container.children.length).toBe(1)

        consoleSpy.mockRestore()
    })

    it('setAlpha cancels in-progress fade', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)

        const loadPromise = engine.load('http://localhost:8080/test.mp4')
        lastCreatedVideo!._fireEvent('canplaythrough')
        await loadPromise

        const sprite = container.children[0] as MockSprite

        // Fade is in progress
        expect(rafCallbacks.length).toBeGreaterThan(0)

        // Explicit setAlpha should cancel the fade and set alpha directly
        engine.setAlpha(0.7)
        expect(rafCallbacks.length).toBe(0)
        expect(sprite.alpha).toBe(0.7)
    })

    it('destroy aborts pending canplaythrough wait', async () => {
        const container = new MockContainer()
        const engine = new VideoEngine(container as never)
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Start load — waiting for canplaythrough
        const loadPromise = engine.load('http://localhost:8080/test.mp4')

        // Destroy while waiting — should abort the pending promise
        engine.destroy()
        await loadPromise

        // Should not add sprite (load was aborted)
        expect(container.children.length).toBe(0)

        consoleSpy.mockRestore()
    })
})
