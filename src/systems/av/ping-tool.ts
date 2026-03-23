/**
 * PingTool — animated sonar ripple on the UI layer.
 * Triggered by DM tapping a location on the cockpit map view.
 * Coordinates are normalized 0–1 relative to map dimensions.
 * Multiple simultaneous pings supported. Auto-dismisses after 4 seconds.
 */
import * as PIXI from 'pixi.js'
import { OUTPUT_CONFIG } from '@shared/output-config'
import { COLORS } from '@shared/color-constants'

const PING_DURATION_MS = 4000
const PING_COLOR = COLORS.ACCENT
const RING_COUNT = 3

type ActivePing = {
    container: PIXI.Container
    rings: PIXI.Graphics[]
    elapsed: number
}

export class PingTool {
    private layer: PIXI.Container
    private app: PIXI.Application
    private active: ActivePing[] = []
    private tickFn: (() => void) | null = null

    constructor(layer: PIXI.Container, app: PIXI.Application) {
        this.layer = layer
        this.app = app
        this.start()
    }

    private start(): void {
        this.tickFn = () => this.tick(this.app.ticker.deltaMS)
        this.app.ticker.add(this.tickFn)
    }

    /**
     * Trigger a ping animation at normalized (x, y) coordinates.
     */
    trigger(x: number, y: number): void {
        const px = x * OUTPUT_CONFIG.width
        const py = y * OUTPUT_CONFIG.height

        const pingContainer = new PIXI.Container()
        pingContainer.x = px
        pingContainer.y = py

        // Crosshair lines
        const crosshair = new PIXI.Graphics()
        crosshair.moveTo(-20, 0).lineTo(20, 0)
        crosshair.moveTo(0, -20).lineTo(0, 20)
        crosshair.stroke({ color: PING_COLOR, width: 2, alpha: 0.9 })
        pingContainer.addChild(crosshair)

        // Expanding rings
        const rings: PIXI.Graphics[] = []
        for (let i = 0; i < RING_COUNT; i++) {
            const ring = new PIXI.Graphics()
            ring.circle(0, 0, 1)
            ring.stroke({ color: PING_COLOR, width: 2, alpha: 0 })
            pingContainer.addChild(ring)
            rings.push(ring)
        }

        this.layer.addChild(pingContainer)
        this.active.push({ container: pingContainer, rings, elapsed: 0 })
    }

    private tick(deltaMs: number): void {
        const done: ActivePing[] = []

        for (const ping of this.active) {
            ping.elapsed += deltaMs
            const t = ping.elapsed / PING_DURATION_MS  // 0→1

            for (let i = 0; i < RING_COUNT; i++) {
                const ring = ping.rings[i]
                const offset = i / RING_COUNT           // stagger rings
                const ringT = (t + offset) % 1.0       // loop phase
                const radius = ringT * 120              // expand 0→120px
                const alpha = (1 - ringT) * 0.8        // fade out

                ring.clear()
                ring.circle(0, 0, radius)
                ring.stroke({ color: PING_COLOR, width: 2, alpha })
            }

            if (t >= 1.0) done.push(ping)
        }

        for (const ping of done) {
            this.layer.removeChild(ping.container)
            ping.container.destroy({ children: true })
            this.active.splice(this.active.indexOf(ping), 1)
        }
    }

    destroy(): void {
        if (this.tickFn) this.app.ticker.remove(this.tickFn)
        for (const ping of this.active) {
            this.layer.removeChild(ping.container)
            ping.container.destroy({ children: true })
        }
        this.active = []
    }
}
