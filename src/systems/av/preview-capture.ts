import type { Socket } from 'socket.io-client'
import { EVENTS } from '@shared/socket-events'

/**
 * Captures frames from the PixiJS canvas and streams them to cockpit clients
 * via Socket.io. Demand-driven — only captures when a cockpit requests it.
 *
 * Flow: canvas.toBlob() → ArrayBuffer → socket.emit(PREVIEW_FRAME)
 * Server relays the frame to all clients in the 'cockpit' room.
 */
export class PreviewCapture {
    private canvas: HTMLCanvasElement
    private socket: Socket
    private intervalId: ReturnType<typeof setInterval> | null = null
    private capturing = false
    private fps = 10
    private quality = 0.5

    constructor(canvas: HTMLCanvasElement, socket: Socket) {
        this.canvas = canvas
        this.socket = socket
    }

    /**
     * Start capturing frames at the specified FPS and quality.
     * Safe to call multiple times — stops previous capture first.
     */
    start(options?: { fps?: number; quality?: number }): void {
        this.stop()

        if (options?.fps && options.fps > 0) this.fps = Math.min(options.fps, 30)
        if (options?.quality && options.quality > 0) this.quality = Math.min(options.quality, 1)

        const intervalMs = Math.round(1000 / this.fps)
        this.capturing = false

        this.intervalId = setInterval(() => {
            void this.captureFrame()
        }, intervalMs)

    }

    /**
     * Stop capturing frames. No-op if not currently capturing.
     */
    stop(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        this.capturing = false
    }

    /**
     * Capture a single frame from the canvas and emit it via Socket.io.
     * Guards against overlapping captures — if the previous capture is still
     * in flight (toBlob is async), this call is skipped.
     */
    private async captureFrame(): Promise<void> {
        if (this.capturing) return
        this.capturing = true

        try {
            const blob = await new Promise<Blob | null>((resolve) => {
                this.canvas.toBlob(resolve, 'image/jpeg', this.quality)
            })

            if (!blob) {
                this.capturing = false
                return
            }

            const buffer = await blob.arrayBuffer()

            this.socket.emit(EVENTS.PREVIEW_FRAME, {
                frame: buffer,
                ts: Date.now(),
                width: this.canvas.width,
                height: this.canvas.height,
            })
        } catch (err) {
            console.warn('[preview] capture error:', err)
        }

        this.capturing = false
    }

    get isCapturing(): boolean {
        return this.intervalId !== null
    }
}
