/**
 * Preview panel tests — Sprint 7b-2.
 *
 * Tests the sync.ts helper functions for preview control.
 * No jsdom — store-contract / module-contract style tests only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock socket.io-client before importing sync
vi.mock('socket.io-client', () => ({
    io: vi.fn(() => ({
        on: vi.fn(),
        emit: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    })),
}))

// Mock perf-client to avoid side effects
vi.mock('../lib/perf-client', () => ({
    startLatencyMeasurement: vi.fn(),
    stopLatencyMeasurement: vi.fn(),
}))

// Mock ws-stub
vi.mock('../lib/ws-stub', () => ({
    wsStub: {
        connect: vi.fn(),
        emit: vi.fn(),
        on: vi.fn().mockReturnThis(),
    },
}))

// Mock all stores to avoid side effects
vi.mock('../stores/combat-store', () => ({
    useCombatStore: Object.assign(vi.fn(() => ({})), {
        getState: vi.fn(() => ({ setCombatants: vi.fn() })),
        subscribe: vi.fn(),
    }),
}))
vi.mock('../stores/mood-store', () => ({
    useMoodStore: Object.assign(vi.fn(() => ({})), {
        getState: vi.fn(() => ({ setValue: vi.fn() })),
        subscribe: vi.fn(),
    }),
}))
vi.mock('../stores/scene-store', () => ({
    useSceneStore: Object.assign(vi.fn(() => ({})), {
        getState: vi.fn(() => ({ setActiveScene: vi.fn() })),
        subscribe: vi.fn(),
    }),
}))
vi.mock('../stores/av-store', () => ({
    useAVStore: Object.assign(vi.fn(() => ({})), {
        getState: vi.fn(() => ({ setParticles: vi.fn(), setColorGrade: vi.fn() })),
        subscribe: vi.fn(),
    }),
}))
vi.mock('../stores/app-store', () => ({
    useAppStore: Object.assign(vi.fn(() => ({})), {
        getState: vi.fn(() => ({
            setConnected: vi.fn(),
            setAppMode: vi.fn(),
            setActiveCampaign: vi.fn(),
        })),
        subscribe: vi.fn(),
    }),
}))

describe('Preview sync helpers', () => {
    let syncModule: typeof import('../lib/sync')

    beforeEach(async () => {
        vi.resetModules()
        syncModule = await import('../lib/sync')
    })

    it('exports startPreview function', () => {
        expect(typeof syncModule.startPreview).toBe('function')
    })

    it('exports stopPreview function', () => {
        expect(typeof syncModule.stopPreview).toBe('function')
    })

    it('exports onPreviewFrame function', () => {
        expect(typeof syncModule.onPreviewFrame).toBe('function')
    })

    it('startPreview does not throw when socket is not initialized', () => {
        expect(() => syncModule.startPreview({ fps: 10, quality: 0.5 })).not.toThrow()
    })

    it('stopPreview does not throw when socket is not initialized', () => {
        expect(() => syncModule.stopPreview()).not.toThrow()
    })

    it('onPreviewFrame registers and clears callback', () => {
        const cb = vi.fn()
        // Register
        syncModule.onPreviewFrame(cb)
        // Clear
        syncModule.onPreviewFrame(null)
        // No error expected
    })

    it('exports PreviewFrameData type (used by preview-panel component)', async () => {
        // The type exists at compile time; at runtime we verify the module shape
        const keys = Object.keys(syncModule)
        expect(keys).toContain('startPreview')
        expect(keys).toContain('stopPreview')
        expect(keys).toContain('onPreviewFrame')
    })
})
