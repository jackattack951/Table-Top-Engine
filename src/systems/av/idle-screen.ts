/**
 * IdleScreen — AV Display standby overlay (Sprint 22c).
 *
 * Shown when no scene is loaded. Displays a pulsing logo ring,
 * "STAGE MANAGER" title, and (when session is active) the player join
 * QR code and session code.
 *
 * Placement: added to app.stage via addChildAt(container, 0) so it sits
 * BELOW all LayerStack layers (Pitfall #19). No LayerStack changes needed.
 *
 * Hides immediately on SCENE_LOAD / STATE_SYNC with activeSceneId.
 * Re-shows on SESSION_ENDED or STATE_SYNC with no active scene.
 */
import * as PIXI from 'pixi.js'
import QRCode from 'qrcode'
import { OUTPUT_CONFIG } from '@shared/output-config'

export class IdleScreen {
    private container: PIXI.Container
    private rafId: number | null = null
    private logoRing: PIXI.Graphics | null = null
    private startTime = 0

    /** Cached session info — retained so re-show() after SCENE_LOAD restores QR */
    private _sessionCode: string | null = null
    private _companionUrl: string | null = null

    constructor(app: PIXI.Application) {
        this.container = new PIXI.Container()
        this.container.visible = false
        // Index 0 puts idle below all LayerStack layers (added after init)
        app.stage.addChildAt(this.container, 0)
    }

    /**
     * Show the idle screen. Caches sessionCode + companionUrl for re-show.
     * Passing null for both shows the logo-only variant (pre-session).
     */
    async show(sessionCode: string | null, companionUrl: string | null): Promise<void> {
        // Cache for re-show after scene ends
        if (sessionCode !== null) this._sessionCode = sessionCode
        if (companionUrl !== null) this._companionUrl = companionUrl

        this._clearContent()

        const { width, height } = OUTPUT_CONFIG

        // Background
        const bg = new PIXI.Graphics()
        bg.rect(0, 0, width, height)
        bg.fill({ color: 0x08080f })
        this.container.addChild(bg)

        // Animated glow ring placeholder
        this.logoRing = new PIXI.Graphics()
        this.container.addChild(this.logoRing)

        // Title
        const title = new PIXI.Text({
            text: 'STAGE MANAGER',
            style: {
                fill: '#c0b0ff',
                fontSize: 52,
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 'bold',
                letterSpacing: 8,
            },
        })
        title.anchor.set(0.5, 0.5)
        title.x = width / 2
        title.y = height * 0.55
        this.container.addChild(title)

        // QR code — generated client-side in Chromium renderer (browser Canvas API)
        const url = companionUrl ?? this._companionUrl
        if (url) {
            try {
                const qrDataUrl = await QRCode.toDataURL(url, {
                    color: { dark: '#c0b0ff', light: '#08080f' },
                    width: 320,
                    margin: 2,
                })
                const img = new Image()
                img.src = qrDataUrl
                await img.decode()
                const imageSource = new PIXI.ImageSource({ resource: img })
                const texture = new PIXI.Texture({ source: imageSource })
                const qrSize = Math.min(width, height) * 0.30
                const sprite = new PIXI.Sprite(texture)
                sprite.width = qrSize
                sprite.height = qrSize
                sprite.anchor.set(0.5, 0.5)
                sprite.x = width / 2
                sprite.y = height * 0.65
                this.container.addChild(sprite)
            } catch (err) {
                console.warn('[idle-screen] QR generation failed:', err)
            }
        }

        // Session code text
        const code = sessionCode ?? this._sessionCode
        if (code) {
            const codeText = new PIXI.Text({
                text: code,
                style: {
                    fill: '#666666',
                    fontSize: 26,
                    fontFamily: 'monospace',
                    letterSpacing: 5,
                },
            })
            codeText.anchor.set(0.5, 0)
            codeText.x = width / 2
            codeText.y = height * 0.83
            this.container.addChild(codeText)
        }

        this.container.visible = true
        this.startTime = performance.now()
        this._startGlow()
    }

    /** Hide the idle screen and cancel the glow animation. */
    hide(): void {
        this._stopGlow()
        this._clearContent()
        this.container.visible = false
    }

    isVisible(): boolean {
        return this.container.visible
    }

    /** Remove from stage and clean up. */
    destroy(): void {
        this.hide()
        this.container.parent?.removeChild(this.container)
        this.container.destroy()
    }

    private _clearContent(): void {
        while (this.container.children.length > 0) {
            const child = this.container.children[0]
            this.container.removeChild(child)
            if ('destroy' in child && typeof child.destroy === 'function') {
                (child as { destroy(): void }).destroy()
            }
        }
        this.logoRing = null
    }

    private _startGlow(): void {
        const { width, height } = OUTPUT_CONFIG
        const cx = width / 2
        const cy = height * 0.33

        const tick = (now: number): void => {
            if (!this.logoRing || !this.container.visible) return
            const t = (now - this.startTime) / 3000
            const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2))

            this.logoRing.clear()
            this.logoRing.circle(cx, cy, 120)
            this.logoRing.stroke({ color: 0x6644cc, width: 3, alpha })
            this.logoRing.circle(cx, cy, 90)
            this.logoRing.stroke({ color: 0x9966ff, width: 1.5, alpha: alpha * 0.5 })

            this.rafId = requestAnimationFrame(tick)
        }

        this.rafId = requestAnimationFrame(tick)
    }

    private _stopGlow(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
    }
}
