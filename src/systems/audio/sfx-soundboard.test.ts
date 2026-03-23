/**
 * SFX Soundboard tests.
 *
 * Web Audio API does not exist in Node/Vitest. We build a minimal mock that
 * records what nodes were created and how they were connected so we can assert
 * architecture Rule 11 (PannerNode always present), spatial mapping, file
 * loading (fetch + decodeAudioData), buffer caching, and silent fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SFXClip } from '@core/types'

// ── Web Audio mock ────────────────────────────────────────────────────────────

/** Tracks every PannerNode created during a test */
let createdPanners: MockPannerNode[] = []

class MockAudioParam {
    value = 0
    setValueAtTime(_v: number, _t: number): MockAudioParam { return this }
    linearRampToValueAtTime(_v: number, _t: number): MockAudioParam { return this }
}

class MockAudioBuffer {}

class MockAudioBufferSourceNode {
    buffer: MockAudioBuffer | null = null
    loop = false
    private connected: MockGainNode | null = null
    connect(dest: MockGainNode): void { this.connected = dest; void dest }
    start(): void { /* no-op */ }
    stop(): void { /* no-op */ }
    disconnect(): void { this.connected = null }
}

class MockGainNode {
    gain = new MockAudioParam()
    private connected: MockPannerNode | null = null
    connect(dest: MockPannerNode): void { this.connected = dest; void dest }
    disconnect(): void { this.connected = null }
}

class MockPannerNode {
    panningModel: string = ''
    distanceModel: string = ''
    positionX = new MockAudioParam()
    positionY = new MockAudioParam()
    positionZ = new MockAudioParam()
    private connected = false
    connect(_dest: unknown): void { this.connected = true }
    disconnect(): void { this.connected = false }
}

class MockAudioListener {
    positionX = new MockAudioParam()
    positionY = new MockAudioParam()
    positionZ = new MockAudioParam()
}

class MockAudioContext {
    state: AudioContextState = 'running'
    currentTime = 0
    listener = new MockAudioListener()
    destination = {}

    createGain(): MockGainNode { return new MockGainNode() }
    createBufferSource(): MockAudioBufferSourceNode { return new MockAudioBufferSourceNode() }
    createPanner(): MockPannerNode {
        const p = new MockPannerNode()
        createdPanners.push(p)
        return p
    }
    async decodeAudioData(_ab: ArrayBuffer): Promise<MockAudioBuffer> {
        return new MockAudioBuffer()
    }
    async resume(): Promise<void> { this.state = 'running' }
    async close(): Promise<void> { /* no-op */ }
}

// Install mocks globally before importing the module under test
vi.stubGlobal('AudioContext', MockAudioContext)
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
}))

// Now import (after the globals are set so the class uses the mocks)
const { SFXSoundboard } = await import('./sfx-soundboard')

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Default clip with a real filePath so trigger() proceeds past the guard */
function makeClip(overrides: Partial<SFXClip> = {}): SFXClip {
    return {
        id: 'test-clip',
        label: 'Test Clip',
        filePath: '/assets/sfx/test.ogg',
        loop: false,
        volume: 0.8,
        ...overrides,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SFXSoundboard', () => {
    let board: InstanceType<typeof SFXSoundboard>

    beforeEach(() => {
        createdPanners = []
        vi.clearAllMocks()
        // Re-apply fetch mock after clearAllMocks
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        }))
        board = new SFXSoundboard()
        board.init()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        board.destroy()
    })

    // ── Rule 11: PannerNode always present ────────────────────────────────────

    it('creates a PannerNode when spatial is defined', async () => {
        const clip = makeClip({ spatial: { x: 0.5, y: 0.5 } })
        await board.trigger(clip)
        expect(createdPanners).toHaveLength(1)
    })

    it('creates a PannerNode even when spatial is undefined (Rule 11)', async () => {
        const clip = makeClip({ spatial: undefined })
        await board.trigger(clip)
        expect(createdPanners).toHaveLength(1)
    })

    // ── Spatial mapping: x → positionX ───────────────────────────────────────

    it('maps spatial x=0 to positionX=-1', async () => {
        await board.trigger(makeClip({ spatial: { x: 0, y: 0.5 } }))
        expect(createdPanners[0]!.positionX.value).toBeCloseTo(-1)
    })

    it('maps spatial x=1 to positionX=+1', async () => {
        await board.trigger(makeClip({ spatial: { x: 1, y: 0.5 } }))
        expect(createdPanners[0]!.positionX.value).toBeCloseTo(1)
    })

    it('maps spatial x=0.5 to positionX=0', async () => {
        await board.trigger(makeClip({ spatial: { x: 0.5, y: 0.5 } }))
        expect(createdPanners[0]!.positionX.value).toBeCloseTo(0)
    })

    // ── Spatial mapping: y → positionZ ───────────────────────────────────────

    it('maps spatial y=0 to positionZ=-1', async () => {
        await board.trigger(makeClip({ spatial: { x: 0.5, y: 0 } }))
        expect(createdPanners[0]!.positionZ.value).toBeCloseTo(-1)
    })

    it('maps spatial y=1 to positionZ=+1', async () => {
        await board.trigger(makeClip({ spatial: { x: 0.5, y: 1 } }))
        expect(createdPanners[0]!.positionZ.value).toBeCloseTo(1)
    })

    it('maps spatial y=0.5 to positionZ=0', async () => {
        await board.trigger(makeClip({ spatial: { x: 0.5, y: 0.5 } }))
        expect(createdPanners[0]!.positionZ.value).toBeCloseTo(0)
    })

    // ── positionY is always 0 ─────────────────────────────────────────────────

    it('always sets positionY=0 regardless of spatial values', async () => {
        await board.trigger(makeClip({ spatial: { x: 0.25, y: 0.75 } }))
        expect(createdPanners[0]!.positionY.value).toBe(0)
    })

    // ── One-shot clips not tracked in active map ──────────────────────────────

    it('does not add one-shot clips to the active map after trigger', async () => {
        const clip = makeClip({ id: 'oneshot-clip', loop: false })
        await board.trigger(clip)
        // Second trigger with same id: if it were tracked, stop() would run first
        // and consume a second panner via restart. Since it's not tracked, we
        // simply get panner #2 with no extra overhead.
        await board.trigger(makeClip({ id: 'oneshot-clip', loop: false }))
        expect(createdPanners).toHaveLength(2)
    })

    // ── Loop clips ARE tracked in active map ──────────────────────────────────

    it('tracks loop clips in the active map (second trigger restarts)', async () => {
        const clip = makeClip({ id: 'loop-clip', loop: true })
        await board.trigger(clip)
        expect(createdPanners).toHaveLength(1)

        // Second trigger on same id: stop() runs first, then creates new nodes
        await board.trigger(clip)
        expect(createdPanners).toHaveLength(2)
    })

    // ── Silent fallback: empty filePath ───────────────────────────────────────

    it('does not create any nodes when filePath is empty', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        await board.trigger(makeClip({ filePath: '' }))
        expect(createdPanners).toHaveLength(0)
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[sfx-soundboard]'),
            expect.any(String),
        )
        warnSpy.mockRestore()
    })

    // ── Silent fallback: fetch failure ────────────────────────────────────────

    it('does not create any nodes when fetch throws', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        await board.trigger(makeClip({ filePath: '/missing.ogg' }))
        expect(createdPanners).toHaveLength(0)
        warnSpy.mockRestore()
    })

    // ── Buffer caching ────────────────────────────────────────────────────────

    it('fetches a file only once even when triggered multiple times', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        })
        vi.stubGlobal('fetch', fetchMock)

        const clip = makeClip({ filePath: '/assets/sfx/cached.ogg', loop: false })
        await board.trigger(clip)
        await board.trigger(makeClip({ ...clip, id: 'clip-2' }))

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
