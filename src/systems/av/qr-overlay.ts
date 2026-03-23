/**
 * QR Overlay — PixiJS component for displaying session QR code on AV Display.
 * Renders on the UI layer (topmost) so it appears above all scene content.
 * Registered for BOTH BG and GB roles — all AV windows can show QR.
 *
 * Uses OUTPUT_CONFIG for positioning (Rule 5).
 */
import * as PIXI from 'pixi.js'
import { OUTPUT_CONFIG } from '@shared/output-config'
import { COLORS } from '@shared/color-constants'

export class QROverlay {
    private container: PIXI.Container
    private backdrop: PIXI.Graphics | null = null
    private qrSprite: PIXI.Sprite | null = null
    private titleText: PIXI.Text | null = null
    private codeText: PIXI.Text | null = null
    private visible = false
    private loadedUrl: string | null = null
    private loadId = 0

    constructor(uiLayer: PIXI.Container) {
        this.container = new PIXI.Container()
        this.container.visible = false
        uiLayer.addChild(this.container)
    }

    /**
     * Show the QR overlay with a QR code image and session code.
     * @param qrDataUrl Base64 data URL of the QR code image
     * @param sessionCode The human-readable session code
     */
    async show(qrDataUrl: string, sessionCode: string): Promise<void> {
        // Clear previous content
        this.hide()

        // Race guard: increment loadId so stale loads are discarded
        const thisLoadId = ++this.loadId

        const { width, height } = OUTPUT_CONFIG

        // Semi-transparent backdrop
        this.backdrop = new PIXI.Graphics()
        this.backdrop.rect(0, 0, width, height)
        this.backdrop.fill({ color: 0x000000, alpha: 0.7 })
        this.container.addChild(this.backdrop)

        // Title text
        this.titleText = new PIXI.Text({
            text: 'Scan to Join',
            style: {
                fill: '#ffffff',
                fontSize: 48,
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 'bold',
            },
        })
        this.titleText.anchor.set(0.5, 0)
        this.titleText.x = width / 2
        this.titleText.y = height * 0.15
        this.container.addChild(this.titleText)

        // QR code sprite
        try {
            const texture = await PIXI.Assets.load(qrDataUrl)
            // Discard stale load if a newer show() was called while awaiting
            if (this.loadId !== thisLoadId) return
            this.loadedUrl = qrDataUrl
            this.qrSprite = new PIXI.Sprite(texture)
            const qrSize = Math.min(width, height) * 0.4
            this.qrSprite.width = qrSize
            this.qrSprite.height = qrSize
            this.qrSprite.anchor.set(0.5, 0.5)
            this.qrSprite.x = width / 2
            this.qrSprite.y = height / 2
            this.container.addChild(this.qrSprite)
        } catch (err) {
            console.warn('[qr-overlay] failed to load QR image:', err)
        }

        // Session code text
        this.codeText = new PIXI.Text({
            text: sessionCode,
            style: {
                fill: '#ffffff',
                fontSize: 36,
                fontFamily: 'monospace',
                letterSpacing: 4,
            },
        })
        this.codeText.anchor.set(0.5, 0)
        this.codeText.x = width / 2
        this.codeText.y = height * 0.78
        this.container.addChild(this.codeText)

        this.container.visible = true
        this.visible = true
    }

    /** Hide the QR overlay and clean up children. */
    hide(): void {
        while (this.container.children.length > 0) {
            const child = this.container.children[0]
            this.container.removeChild(child)
            if ('destroy' in child && typeof child.destroy === 'function') {
                child.destroy()
            }
        }
        if (this.loadedUrl) {
            PIXI.Assets.unload(this.loadedUrl).catch(() => { /* ignore */ })
            this.loadedUrl = null
        }
        this.backdrop = null
        this.qrSprite = null
        this.titleText = null
        this.codeText = null
        this.container.visible = false
        this.visible = false
    }

    isVisible(): boolean {
        return this.visible
    }

    destroy(): void {
        this.hide()
        this.container.parent?.removeChild(this.container)
    }
}
