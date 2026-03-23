/**
 * Fog of War — OffscreenCanvas-driven fog overlay for the AV Display.
 *
 * Renders on the fog layer (between gameboard and FX).
 * The cockpit paints fog on an HTML5 Canvas and sends:
 *   - FOG_BRUSH:  real-time incremental strokes (normalized 0–1 coords)
 *   - FOG_UPDATE: full base64 PNG bitmap (authoritative state)
 *   - FOG_TOGGLE: show/hide fog
 *   - FOG_RESET:  reset to full opaque black
 *
 * Uses an OffscreenCanvas as the single source of truth. Updates are pushed
 * to a PIXI.Sprite texture via CanvasSource.update().
 *
 * Black pixels = fogged (hidden from players).
 * Transparent pixels = revealed (map visible).
 */
import * as PIXI from 'pixi.js'
import { OUTPUT_CONFIG } from '@shared/output-config'

interface BrushStroke {
    x: number       // 0–1 normalized
    y: number       // 0–1 normalized
    radius: number  // 0–1 normalized (relative to width)
    reveal: boolean // true = erase fog, false = paint fog
}

export class FogOfWar {
    private container: PIXI.Container
    private sprite: PIXI.Sprite | null = null
    private canvas: OffscreenCanvas
    private ctx: OffscreenCanvasRenderingContext2D
    private texture: PIXI.Texture | null = null

    constructor(container: PIXI.Container) {
        this.container = container
        this.canvas = new OffscreenCanvas(OUTPUT_CONFIG.width, OUTPUT_CONFIG.height)
        this.ctx = this.canvas.getContext('2d')!
    }

    /** Initialize fog to full opaque black and create the sprite. */
    init(): void {
        this.ctx.fillStyle = 'black'
        this.ctx.fillRect(0, 0, OUTPUT_CONFIG.width, OUTPUT_CONFIG.height)
        this.updateSprite()
    }

    /**
     * Load a full fog bitmap from base64 PNG (authoritative state from DB or FOG_UPDATE).
     * Black = fogged, transparent = revealed.
     */
    async loadBitmap(base64PNG: string): Promise<void> {
        const img = new Image()
        img.src = base64PNG
        await img.decode()
        this.ctx.clearRect(0, 0, OUTPUT_CONFIG.width, OUTPUT_CONFIG.height)
        this.ctx.drawImage(img, 0, 0, OUTPUT_CONFIG.width, OUTPUT_CONFIG.height)
        this.updateSprite()
    }

    /**
     * Apply incremental brush strokes for real-time painting feedback.
     * Each stroke has normalized 0–1 coordinates and a reveal flag.
     */
    applyBrush(strokes: BrushStroke[]): void {
        const w = OUTPUT_CONFIG.width
        const h = OUTPUT_CONFIG.height

        for (const stroke of strokes) {
            const px = stroke.x * w
            const py = stroke.y * h
            const r = stroke.radius * w

            this.ctx.save()
            this.ctx.globalCompositeOperation = stroke.reveal
                ? 'destination-out'
                : 'source-over'
            this.ctx.beginPath()
            this.ctx.arc(px, py, r, 0, Math.PI * 2)
            this.ctx.fillStyle = 'black'
            this.ctx.fill()
            this.ctx.restore()
        }
        this.updateSprite()
    }

    /** Reset fog to full opaque black. */
    reset(): void {
        this.ctx.clearRect(0, 0, OUTPUT_CONFIG.width, OUTPUT_CONFIG.height)
        this.ctx.fillStyle = 'black'
        this.ctx.fillRect(0, 0, OUTPUT_CONFIG.width, OUTPUT_CONFIG.height)
        this.updateSprite()
    }

    /** Push the OffscreenCanvas content to the PixiJS sprite texture. */
    private updateSprite(): void {
        if (!this.sprite) {
            const source = new PIXI.CanvasSource({ resource: this.canvas as unknown as HTMLCanvasElement })
            this.texture = new PIXI.Texture({ source })
            this.sprite = new PIXI.Sprite(this.texture)
            this.sprite.width = OUTPUT_CONFIG.width
            this.sprite.height = OUTPUT_CONFIG.height
            this.container.addChild(this.sprite)
        } else {
            this.texture!.source.update()
        }
    }

    destroy(): void {
        if (this.sprite) {
            this.container.removeChild(this.sprite)
            this.sprite.destroy({ texture: true, textureSource: true })
            this.sprite = null
            this.texture = null
        }
    }
}
