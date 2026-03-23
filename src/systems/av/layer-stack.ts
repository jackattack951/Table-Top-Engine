/**
 * PixiJS Layer Stack — AV Display compositor.
 * Runs ONLY in the AV Display renderer process.
 *
 * Layer order (bottom to top):
 *   Background → GameBoard → Fog → FX → Overlay → Particle → ColorGrade → UI
 *
 * Two video engines, one class (Architecture Rule 12):
 *   engines.background — ambient scene loop (always active)
 *   engines.gameboard  — tactical map (active when DM enables map mode)
 *
 * Sprint 10i: fog layer sits above gameboard (covers the map) and below FX
 * overlays (effects render on top of fog). FogOfWar manages this layer.
 */
import * as PIXI from 'pixi.js'
import { OUTPUT_CONFIG } from '@shared/output-config'
import { COLORS } from '@shared/color-constants'
import { ColorGradeFilter } from './color-grade-filter'
import type { VideoEngine } from './video-engine'
import type { ColorGradeUniforms } from './color-grade-filter'

export class LayerStack {
    private app: PIXI.Application | null = null
    private colorGradeFilter: ColorGradeFilter | null = null

    readonly layers = {
        background: new PIXI.Container(),
        gameboard: new PIXI.Container(),
        fog: new PIXI.Container(),       // Sprint 10i — FogOfWar manages this layer
        fx: new PIXI.Container(),
        overlay: new PIXI.Container(),
        particle: new PIXI.Container(),  // v8: Container replaces removed ParticleContainer
        colorGrade: new PIXI.Container(),
        ui: new PIXI.Container(),
    }

    // Video engine instances — same class, separate containers (Rule 12)
    readonly engines: {
        background: VideoEngine | null
        gameboard: VideoEngine | null
    } = {
            background: null,
            gameboard: null,
        }

    /** Expose the underlying PIXI.Application for system classes that need app.ticker */
    get pixiApp(): PIXI.Application | null { return this.app }

    async init(canvas: HTMLCanvasElement): Promise<void> {
        this.app = new PIXI.Application()
        await this.app.init({
            canvas,
            width: OUTPUT_CONFIG.width,
            height: OUTPUT_CONFIG.height,
            backgroundColor: COLORS.BLACK,
            antialias: false,
        })

        // Add layers in order — bottom to top
        this.app.stage.addChild(this.layers.background)
        this.app.stage.addChild(this.layers.gameboard)
        this.app.stage.addChild(this.layers.fog)        // Sprint 10i — between gameboard and FX
        this.app.stage.addChild(this.layers.fx)
        this.app.stage.addChild(this.layers.overlay)
        this.app.stage.addChild(this.layers.particle)
        this.app.stage.addChild(this.layers.colorGrade)
        this.app.stage.addChild(this.layers.ui)

        // Color grade filter applied to entire stage
        this.colorGradeFilter = new ColorGradeFilter()
        this.app.stage.filters = [this.colorGradeFilter]
    }

    setColorGrade(uniforms: ColorGradeUniforms): void {
        this.colorGradeFilter?.setValues(uniforms)
    }

    setLayerVisible(layer: keyof typeof this.layers, visible: boolean): void {
        this.layers[layer].visible = visible
    }

    setLayerAlpha(layer: keyof typeof this.layers, alpha: number): void {
        this.layers[layer].alpha = alpha
    }

    /**
     * Load a static image into a layer (background or gameboard).
     * Clears existing children in the target layer, then adds a scaled sprite.
     */
    async loadImage(layer: 'background' | 'gameboard', url: string): Promise<void> {
        const container = this.layers[layer]
        // Clear and destroy existing children to free VRAM
        while (container.children.length > 0) {
            const child = container.removeChildAt(0)
            if ('destroy' in child && typeof child.destroy === 'function') {
                child.destroy()
            }
        }

        try {
            // Fetch as blob and load via Image element — bypasses PIXI.Assets parser
            // detection which fails on extensionless API URLs (e.g. /api/assets/:id/file)
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
            container.addChild(sprite)
        } catch (err) {
            console.error(`[layer-stack] FAILED to load image into ${layer} layer:`, url, err)
            throw err
        }
    }

    destroy(): void {
        this.app?.destroy(false)
        this.app = null
    }
}
