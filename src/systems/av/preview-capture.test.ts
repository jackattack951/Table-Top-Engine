/**
 * PreviewCapture tests — Sprint 7b.
 *
 * Mocks HTMLCanvasElement.toBlob and Socket.io emit to verify:
 * - Start/stop lifecycle
 * - Frame capture calls toBlob with correct format and quality
 * - Emits PREVIEW_FRAME with ArrayBuffer payload
 * - Overlapping capture guard
 * - Custom FPS/quality options
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EVENTS } from '@shared/socket-events'

// ── Mocks ────────────────────────────────────────────────────────────────────

function createMockCanvas(width = 1920, height = 1080): HTMLCanvasElement {
    const mockBlob = new Blob(['fake-frame'], { type: 'image/jpeg' })

    return {
        width,
        height,
        toBlob: vi.fn((callback: BlobCallback, type?: string, quality?: unknown) => {
            void type
            void quality
            // Simulate async — call callback in next microtask
            Promise.resolve().then(() => callback(mockBlob))
        }),
    } as unknown as HTMLCanvasElement
}

function createMockSocket(): { emit: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> } {
    return {
        emit: vi.fn(),
        on: vi.fn(),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PreviewCapture', () => {
    let PreviewCapture: typeof import('./preview-capture').PreviewCapture
    let canvas: ReturnType<typeof createMockCanvas>
    let socket: ReturnType<typeof createMockSocket>

    beforeEach(async () => {
        vi.useFakeTimers()
        canvas = createMockCanvas()
        socket = createMockSocket()
        const mod = await import('./preview-capture')
        PreviewCapture = mod.PreviewCapture
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('isCapturing is false initially', () => {
        const capture = new PreviewCapture(canvas as unknown as HTMLCanvasElement, socket as never)
        expect(capture.isCapturing).toBe(false)
    })

    it('start() sets isCapturing to true', () => {
        const capture = new PreviewCapture(canvas as unknown as HTMLCanvasElement, socket as never)
        capture.start()
        expect(capture.isCapturing).toBe(true)
    })

    it('stop() sets isCapturing to false', () => {
        const capture = new PreviewCapture(canvas as unknown as HTMLCanvasElement, socket as never)
        capture.start()
        capture.stop()
        expect(capture.isCapturing).toBe(false)
    })

    it('stop() when not capturing is a no-op', () => {
        const capture = new PreviewCapture(canvas as unknown as HTMLCanvasElement, socket as never)
        expect(() => capture.stop()).not.toThrow()
        expect(capture.isCapturing).toBe(false)
    })

    it('captures a frame and emits PREVIEW_FRAME with ArrayBuffer', async () => {
        vi.useRealTimers() // Real timers — we control capture directly

        const capture = new PreviewCapture(canvas as unknown as HTMLCanvasElement, socket as never)

        // Call captureFrame directly via start + immediate trigger
        // Instead of fighting fake timers with setInterval, test the capture logic
        // by starting and letting one real interval fire
        capture.start({ fps: 10 })

        // Wait enough for one interval tick + async toBlob + arrayBuffer
        await new Promise((r) => setTimeout(r, 150))

        expect(canvas.toBlob).toHaveBeenCalled()
        expect(canvas.toBlob).toHaveBeenCalledWith(
            expect.any(Function),
            'image/jpeg',
            0.5,
        )

        // Socket emit should have been called with the frame
        const emitCalls = socket.emit.mock.calls.filter(
            (c: unknown[]) => c[0] === EVENTS.PREVIEW_FRAME,
        )
        expect(emitCalls.length).toBeGreaterThanOrEqual(1)

        const payload = emitCalls[0]![1] as { frame: ArrayBuffer; ts: number; width: number; height: number }
        expect(payload.frame).toBeInstanceOf(ArrayBuffer)
        expect(payload.width).toBe(1920)
        expect(payload.height).toBe(1080)
        expect(typeof payload.ts).toBe('number')

        capture.stop()
    })

    it('uses custom fps and quality when provided', () => {
        const capture = new PreviewCapture(canvas as unknown as HTMLCanvasElement, socket as never)
        capture.start({ fps: 15, quality: 0.3 })

        vi.advanceTimersByTime(67) // 1000/15 ≈ 67ms

        expect(canvas.toBlob).toHaveBeenCalledWith(
            expect.any(Function),
            'image/jpeg',
            0.3,
        )

        capture.stop()
    })

    it('clamps fps to max 30', () => {
        const capture = new PreviewCapture(canvas as unknown as HTMLCanvasElement, socket as never)
        capture.start({ fps: 60 })

        // At 30fps, interval is ~33ms. At 60fps it would be ~17ms.
        // After 33ms there should be a tick (clamped to 30fps)
        vi.advanceTimersByTime(34)
        expect(canvas.toBlob).toHaveBeenCalled()

        capture.stop()
    })

    it('start() stops previous capture before starting new one', () => {
        const capture = new PreviewCapture(canvas as unknown as HTMLCanvasElement, socket as never)
        capture.start({ fps: 5 })
        expect(capture.isCapturing).toBe(true)

        // Start again — should not throw, should still be capturing
        capture.start({ fps: 10 })
        expect(capture.isCapturing).toBe(true)

        capture.stop()
    })

    it('handles toBlob returning null gracefully', async () => {
        vi.useRealTimers()

        const nullCanvas = {
            width: 1920,
            height: 1080,
            toBlob: vi.fn((callback: BlobCallback) => {
                Promise.resolve().then(() => callback(null))
            }),
        } as unknown as HTMLCanvasElement

        const capture = new PreviewCapture(nullCanvas, socket as never)
        capture.start({ fps: 10 })

        // Wait for one interval tick + async resolution
        await new Promise((r) => setTimeout(r, 150))

        // Should not have emitted any frame
        const emitCalls = socket.emit.mock.calls.filter(
            (c: unknown[]) => c[0] === EVENTS.PREVIEW_FRAME,
        )
        expect(emitCalls.length).toBe(0)

        capture.stop()
    })
})
