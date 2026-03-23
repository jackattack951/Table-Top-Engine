/**
 * DeckPair — A/B deck video engine for crossfade transitions.
 *
 * Sprint 18c/18d: Two sub-containers (A and B) within a parent layer container.
 * Each can hold a VideoEngine sprite or a static image sprite.
 * One deck is "live" (visible), the other is "standby" (hidden, preloading).
 *
 * The DM cues a scene → media preloads onto standby deck.
 * On TAKE → crossfade: new deck fades in over old deck, then old deck is hidden.
 *
 * Handles both video and image media types since both appear in the same
 * layer containers (background or gameboard).
 */
import * as PIXI from 'pixi.js'
import { OUTPUT_CONFIG } from '@shared/output-config'
import { VideoEngine } from './video-engine'
import type { PlaybackMode } from '@shared/asset-types'

/** Default crossfade duration in milliseconds. */
export const CROSSFADE_MS = 1000

/** What type of media is loaded on a deck. */
type DeckMediaType = 'video' | 'image' | 'none'

interface DeckState {
    container: PIXI.Container
    engine: VideoEngine
    mediaType: DeckMediaType
    sceneId: string | null
}

export class DeckPair {
    private deckA: DeckState
    private deckB: DeckState
    private activeDeck: 'A' | 'B' = 'A'
    private crossfadeRafId: number | null = null
    private fadingOutDeck: DeckState | null = null

    constructor(parentContainer: PIXI.Container) {
        const containerA = new PIXI.Container()
        const containerB = new PIXI.Container()
        parentContainer.addChild(containerA)
        parentContainer.addChild(containerB)

        this.deckA = {
            container: containerA,
            engine: new VideoEngine(containerA),
            mediaType: 'none',
            sceneId: null,
        }
        this.deckB = {
            container: containerB,
            engine: new VideoEngine(containerB),
            mediaType: 'none',
            sceneId: null,
        }

        // Standby deck starts hidden
        containerB.visible = false
    }

    /** The currently live (visible) deck state. */
    private get live(): DeckState {
        return this.activeDeck === 'A' ? this.deckA : this.deckB
    }

    /** The standby (hidden, preloading) deck state. */
    private get standby(): DeckState {
        return this.activeDeck === 'A' ? this.deckB : this.deckA
    }

    /** Whether the standby deck has a preloaded scene matching the given ID. */
    hasPreload(sceneId: string): boolean {
        return this.standby.sceneId === sceneId && this.standby.mediaType !== 'none'
    }

    /**
     * Preload a video onto the standby deck (hidden).
     * Called when a scene is cued — AV Display fetches scene data and preloads media.
     */
    async preloadVideo(filePath: string, sceneId: string, playbackMode: PlaybackMode = 'loop'): Promise<void> {
        const deck = this.standby
        this.clearDeck(deck)
        deck.sceneId = sceneId
        deck.mediaType = 'video'
        deck.engine.setPlaybackMode(playbackMode)
        await deck.engine.load(filePath)
        // Keep standby hidden — alpha set to 0 so it's preloaded but invisible
        deck.engine.setAlpha(0)
    }

    /**
     * Preload an image onto the standby deck (hidden).
     * Uses fetch → blob → Image → decode → PixiJS Sprite pipeline.
     */
    async preloadImage(url: string, sceneId: string): Promise<void> {
        const deck = this.standby
        this.clearDeck(deck)
        deck.sceneId = sceneId
        deck.mediaType = 'image'
        await this.loadImageIntoDeck(deck, url)
        // Keep invisible until take
        deck.container.visible = false
    }

    /**
     * Crossfade from live → standby. The preloaded standby fades in over the
     * current live deck, then the old deck is hidden and cleared.
     *
     * @param durationMs Crossfade duration in ms. 0 = instant swap.
     */
    take(durationMs: number = CROSSFADE_MS): void {
        // Nothing to transition to — standby is empty
        if (this.standby.mediaType === 'none') return

        // Cancel any in-progress crossfade — snap previous transition to completion
        this.cancelCrossfade()

        const oldLive = this.live
        const newLive = this.standby

        // Prepare new deck: visible but fully transparent (container alpha handles blend)
        newLive.container.visible = true
        newLive.container.alpha = 0
        if (newLive.mediaType === 'video') {
            newLive.engine.setAlpha(1) // Sprite opaque — container alpha handles crossfade
        }

        // Swap pointer immediately — new deck is now "live"
        this.activeDeck = this.activeDeck === 'A' ? 'B' : 'A'

        // Instant swap if duration is 0
        if (durationMs <= 0) {
            newLive.container.alpha = 1
            oldLive.container.visible = false
            this.clearDeck(oldLive)
            return
        }

        // Track the fading-out deck for cleanup on cancel/destroy
        this.fadingOutDeck = oldLive

        // Animate crossfade via container alpha
        const start = performance.now()
        const animate = (now: number): void => {
            const elapsed = now - start
            const progress = Math.min(elapsed / durationMs, 1)
            newLive.container.alpha = progress

            if (progress < 1) {
                this.crossfadeRafId = requestAnimationFrame(animate)
            } else {
                // Crossfade complete — hide and clear old deck
                this.crossfadeRafId = null
                this.fadingOutDeck = null
                oldLive.container.visible = false
                this.clearDeck(oldLive)
            }
        }
        this.crossfadeRafId = requestAnimationFrame(animate)
    }

    /** Cancel any in-progress crossfade, snapping to completion. */
    private cancelCrossfade(): void {
        if (this.crossfadeRafId !== null) {
            cancelAnimationFrame(this.crossfadeRafId)
            this.crossfadeRafId = null
            // Snap the current live deck to fully opaque — prevents partial-alpha glitch
            this.live.container.alpha = 1
        }
        if (this.fadingOutDeck) {
            this.fadingOutDeck.container.visible = false
            this.clearDeck(this.fadingOutDeck)
            this.fadingOutDeck = null
        }
    }

    /**
     * Load video directly into the live deck (cold start, no crossfade).
     * Used for initial scene load when there's no prior cue.
     */
    async loadVideo(filePath: string, playbackMode: PlaybackMode = 'loop'): Promise<void> {
        const deck = this.live
        this.clearDeck(deck)
        deck.mediaType = 'video'
        deck.sceneId = null
        deck.engine.setPlaybackMode(playbackMode)
        await deck.engine.load(filePath)
    }

    /**
     * Load image directly into the live deck (cold start, no crossfade).
     * Used for initial scene load when there's no prior cue.
     */
    async loadImage(url: string): Promise<void> {
        const deck = this.live
        this.clearDeck(deck)
        deck.mediaType = 'image'
        deck.sceneId = null
        await this.loadImageIntoDeck(deck, url)
    }

    /** Set volume on the live deck's video engine. */
    setVolume(vol: number): void {
        this.live.engine.setVolume(vol)
    }

    /** Set playback mode on the live deck's video engine. */
    setPlaybackMode(mode: PlaybackMode): void {
        this.live.engine.setPlaybackMode(mode)
    }

    /** Clean up both decks and cancel any in-progress crossfade. */
    destroy(): void {
        this.cancelCrossfade()
        this.clearDeck(this.deckA)
        this.clearDeck(this.deckB)
    }

    /** Clear a deck — destroy video engine content and remove image sprites. */
    private clearDeck(deck: DeckState): void {
        deck.engine.destroy()
        // Remove any image sprites (non-engine children) from the container
        while (deck.container.children.length > 0) {
            const child = deck.container.removeChildAt(0)
            if ('destroy' in child && typeof child.destroy === 'function') {
                child.destroy()
            }
        }
        deck.mediaType = 'none'
        deck.sceneId = null
    }

    /**
     * Load a static image into a deck's container.
     * Same pipeline as LayerStack.loadImage: fetch → blob → Image → decode → Sprite.
     */
    private async loadImageIntoDeck(deck: DeckState, url: string): Promise<void> {
        try {
            const response = await fetch(url)
            if (!response.ok) throw new Error(`fetch failed: ${response.status}`)
            const blob = await response.blob()
            const objectUrl = URL.createObjectURL(blob)

            const img = new Image()
            img.src = objectUrl
            await img.decode()

            const source = new PIXI.ImageSource({ resource: img })
            const texture = new PIXI.Texture({ source })
            URL.revokeObjectURL(objectUrl)

            const sprite = new PIXI.Sprite(texture)
            sprite.width = OUTPUT_CONFIG.width
            sprite.height = OUTPUT_CONFIG.height
            deck.container.addChild(sprite)
        } catch (err) {
            console.error('[deck-pair] Failed to load image:', url, err)
            throw err
        }
    }
}
