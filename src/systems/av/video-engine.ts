/**
 * VideoEngine — HTMLVideoElement playback for a single video layer.
 * Architecture Rule 12: Two instances exist (background + gameboard). Never merge.
 *
 * Pipeline:
 *   file URL → HTMLVideoElement → canplaythrough wait → PixiJS VideoSource
 *   → requestVideoFrameCallback → GPU texture upload each render frame
 *   → fade-in from alpha 0 → 1 over FADE_IN_MS
 *
 * Chromium's hardware-accelerated decoder runs on a dedicated thread.
 * PixiJS VideoSource with updateFPS:0 uses requestVideoFrameCallback for
 * frame-perfect texture updates with zero wasted uploads.
 *
 * Sprint 18a: Video buffering fix — wait for canplaythrough before creating
 * the PixiJS source, then fade in to prevent stutter/flash on initial load.
 */
import * as PIXI from 'pixi.js'
import { OUTPUT_CONFIG } from '@shared/output-config'
import type { PlaybackMode } from '@shared/asset-types'

/** Duration in ms for the video sprite fade-in after buffering completes. */
const FADE_IN_MS = 300

export class VideoEngine {
    private container: PIXI.Container
    private sprite: PIXI.Sprite | null = null
    private playbackMode: PlaybackMode = 'loop'
    private videoElement: HTMLVideoElement | null = null
    private endedHandler: (() => void) | null = null
    private loadGeneration = 0
    private fadeRafId: number | null = null
    private loadAbort: (() => void) | null = null

    constructor(container: PIXI.Container) {
        this.container = container
    }

    /**
     * Wait for the video element to reach canplaythrough (fully buffered).
     * Stores an abort callback on the instance so destroy() can reject the
     * pending promise instead of leaving it dangling.
     */
    private waitForCanPlayThrough(video: HTMLVideoElement): Promise<void> {
        // If already buffered enough, resolve immediately
        if (video.readyState >= 4) return Promise.resolve()
        return new Promise<void>((resolve, reject) => {
            const cleanup = (): void => {
                video.removeEventListener('canplaythrough', onReady)
                video.removeEventListener('error', onError)
                this.loadAbort = null
            }
            const onReady = (): void => {
                cleanup()
                resolve()
            }
            const onError = (): void => {
                cleanup()
                reject(video.error ?? new Error('Video load error'))
            }
            // Allow destroy() to abort this pending wait
            this.loadAbort = () => {
                cleanup()
                reject(new Error('Video load aborted'))
            }
            video.addEventListener('canplaythrough', onReady, { once: true })
            video.addEventListener('error', onError, { once: true })
        })
    }

    /** Animate sprite alpha from 0 → 1 over FADE_IN_MS using requestAnimationFrame. */
    private fadeIn(): void {
        if (!this.sprite) return
        this.cancelFade()
        this.sprite.alpha = 0
        const start = performance.now()
        const animate = (now: number): void => {
            const elapsed = now - start
            const progress = Math.min(elapsed / FADE_IN_MS, 1)
            if (this.sprite) this.sprite.alpha = progress
            if (progress < 1) {
                this.fadeRafId = requestAnimationFrame(animate)
            } else {
                this.fadeRafId = null
            }
        }
        this.fadeRafId = requestAnimationFrame(animate)
    }

    /** Cancel any in-progress fade animation. */
    private cancelFade(): void {
        if (this.fadeRafId !== null) {
            cancelAnimationFrame(this.fadeRafId)
            this.fadeRafId = null
        }
    }

    /** Load a video file for playback via HTMLVideoElement + PixiJS VideoSource. */
    async load(filePath: string): Promise<void> {
        this.destroy()
        const generation = ++this.loadGeneration

        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'  // Required: AV Display (port 5173/file://) fetches from Express (port 8080)
        video.loop = this.playbackMode === 'loop'
        video.muted = true  // Video audio handled separately via Web Audio API
        video.playsInline = true
        video.preload = 'auto'
        this.videoElement = video

        // Handle 'once' and 'freeze' playback modes on video end
        if (this.playbackMode !== 'loop') {
            this.endedHandler = () => {
                if (this.playbackMode === 'once') {
                    if (this.sprite) this.sprite.visible = false
                } else if (this.playbackMode === 'freeze') {
                    video.pause()
                }
            }
            video.addEventListener('ended', this.endedHandler, { once: true })
        }

        // Set src after crossOrigin and other attributes
        video.src = filePath

        // Sprint 18a: Wait for canplaythrough (fully buffered) before creating
        // the PixiJS texture. This prevents initial stutter from partially-loaded video.
        try {
            await this.waitForCanPlayThrough(video)
        } catch (e) {
            console.error('[video-engine] canplaythrough wait failed:', e)
            return
        }

        // Guard: a newer load() was called while we awaited — abandon this one
        if (generation !== this.loadGeneration) return

        // Create PixiJS VideoSource AFTER buffering is complete.
        // autoLoad: false — we call load() explicitly to avoid redundant internal auto-load.
        // autoPlay: true starts playback once the source is wired up.
        // updateFPS: 0 uses requestVideoFrameCallback for frame-perfect uploads.
        const videoSource = new PIXI.VideoSource({
            resource: video,
            autoPlay: true,
            autoLoad: false,
            updateFPS: 0,
        })

        // Wait for PixiJS to finish its internal load (canplay + first frame ready)
        try {
            await videoSource.load()
        } catch (e) {
            console.error('[video-engine] VideoSource load failed:', e)
            videoSource.destroy()
            return
        }

        // Guard: a newer load() was called while we awaited — abandon this one
        if (generation !== this.loadGeneration) return

        const texture = new PIXI.Texture({ source: videoSource })
        if (this.sprite) {
            this.sprite.texture = texture
        } else {
            this.sprite = new PIXI.Sprite(texture)
            this.sprite.width = OUTPUT_CONFIG.width
            this.sprite.height = OUTPUT_CONFIG.height
            this.container.addChild(this.sprite)
        }

        // Sprint 18a: Fade in from transparent to prevent visual pop
        this.fadeIn()
    }

    setVisible(visible: boolean): void {
        if (this.sprite) this.sprite.visible = visible
    }

    setAlpha(alpha: number): void {
        this.cancelFade()  // Explicit alpha set wins over fade-in animation
        if (this.sprite) this.sprite.alpha = alpha
    }

    /** Set video audio volume (0–1). Unmutes the video element on first call. */
    setVolume(vol: number): void {
        if (!this.videoElement) return
        this.videoElement.muted = vol <= 0
        this.videoElement.volume = Math.max(0, Math.min(1, vol))
    }

    setPlaybackMode(mode: PlaybackMode): void {
        this.playbackMode = mode
        if (this.videoElement) {
            this.videoElement.loop = mode === 'loop'
        }
    }

    getPlaybackMode(): PlaybackMode {
        return this.playbackMode
    }

    destroy(): void {
        this.cancelFade()
        if (this.loadAbort) {
            this.loadAbort()
        }
        if (this.videoElement) {
            if (this.endedHandler) {
                this.videoElement.removeEventListener('ended', this.endedHandler)
                this.endedHandler = null
            }
            this.videoElement.pause()
            this.videoElement.removeAttribute('src')
            this.videoElement.load()  // Reset media element without spurious network request
            this.videoElement = null
        }
        if (this.sprite) {
            this.container.removeChild(this.sprite)
            this.sprite.destroy({ texture: true, textureSource: true })
            this.sprite = null
        }
    }
}
