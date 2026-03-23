/**
 * FXLoopPlayer — WebM VP9+alpha loop compositor on the FX layer.
 * Architecture Rule 9: VP9 + alpha, per-clip loopOffset parameter.
 *
 * Multiple clips can play simultaneously. Each clip is a VideoTexture
 * composited transparently over the background via PixiJS blend modes.
 */
import * as PIXI from 'pixi.js'
import { OUTPUT_CONFIG } from '@shared/output-config'

export type FXClip = {
    id: string
    filePath: string
    loopOffset: number  // ms — seek to this point on loop to avoid stutter
    alpha: number  // 0.0–1.0 default opacity
}

type ActiveClip = {
    clip: FXClip
    video: HTMLVideoElement
    sprite: PIXI.Sprite
    loopWatcherId: number | null
}

export class FXLoopPlayer {
    private container: PIXI.Container
    private active: Map<string, ActiveClip> = new Map()

    constructor(container: PIXI.Container) {
        this.container = container
    }

    async load(clip: FXClip): Promise<void> {
        if (this.active.has(clip.id)) return

        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'  // Required: AV Display cross-origin to Express on port 8080
        video.src = clip.filePath
        video.loop = true
        video.muted = true
        video.playsInline = true

        await video.play().catch((e) => console.warn('[fx-loop] autoplay blocked:', e))

        // PixiJS v8: explicit VideoSource for auto-updating video texture
        const videoSource = new PIXI.VideoSource({
            resource: video,
            autoPlay: false,   // already playing above
            autoLoad: false,   // already loaded via video.play()
            updateFPS: 0,      // update every render frame
        })
        const texture = new PIXI.Texture({ source: videoSource })
        const sprite = new PIXI.Sprite(texture)
        sprite.width = OUTPUT_CONFIG.width
        sprite.height = OUTPUT_CONFIG.height
        sprite.alpha = clip.alpha

        this.container.addChild(sprite)

        // Start the loop watcher with sub-16ms precision via requestAnimationFrame
        let loopWatcherId: number | null = null
        if (clip.loopOffset > 0) {
            loopWatcherId = this.startLoopWatcher(clip.id, video, clip.loopOffset / 1000)
        }

        this.active.set(clip.id, { clip, video, sprite, loopWatcherId })
    }

    /**
     * Monitor video playback and seek back to the offset when near the end.
     * Uses requestAnimationFrame for sub-16ms precision instead of the lower-resolution
     * timeupdate event. Returns the rAF loop ID for cleanup on unload.
     */
    private startLoopWatcher(clipId: string, video: HTMLVideoElement, offsetSec: number): number {
        const check = (): number => {
            if (!this.active.has(clipId)) return 0  // clip was unloaded
            if (video.duration && video.currentTime >= video.duration - 0.1) {
                video.currentTime = offsetSec
            }
            return requestAnimationFrame(check)
        }
        return requestAnimationFrame(check)
    }

    unload(clipId: string): void {
        const entry = this.active.get(clipId)
        if (!entry) return
        entry.video.pause()
        entry.sprite.destroy({ texture: true, textureSource: true })
        // Cancel the loop watcher rAF if it exists
        if (entry.loopWatcherId !== null) {
            cancelAnimationFrame(entry.loopWatcherId)
        }
        this.active.delete(clipId)
    }

    setAlpha(clipId: string, alpha: number): void {
        const entry = this.active.get(clipId)
        if (entry) entry.sprite.alpha = alpha
    }

    unloadAll(): void {
        for (const id of this.active.keys()) this.unload(id)
    }

    destroy(): void {
        this.unloadAll()
    }
}
