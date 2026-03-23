/**
 * ParticleSystem — 6 ambient weather presets via PixiJS Container.
 *
 * Each particle type gets its own procedural texture with distinct shape,
 * softness, and visual character. Per-type behaviors include rotation,
 * wobble/sway, tinting, fade-in, scale-over-lifetime, and blend modes.
 *
 * Depth simulation: each particle spawns at a random depth (0 = far, 1 = near).
 * Near particles are larger, faster (parallax), and more opaque. Far particles
 * are smaller, slower, and hazier — selling the illusion of 3D weather over a
 * static 2D background without any actual depth buffer.
 */
import * as PIXI from 'pixi.js'
import { OUTPUT_CONFIG } from '@shared/output-config'
import type { ParticleType } from '@core/types'

// ── Texture generation helpers ──────────────────────────────────────────────

function createCircleTexture(
    size: number,
    softness: number,
): PIXI.Texture {
    // Soft radial gradient via canvas for smooth falloff
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')!
    const center = size / 2
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)
    gradient.addColorStop(0, `rgba(255,255,255,1)`)
    gradient.addColorStop(1 - softness, `rgba(255,255,255,${1 - softness * 0.5})`)
    gradient.addColorStop(1, `rgba(255,255,255,0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    return PIXI.Texture.from(canvas as unknown as HTMLCanvasElement)
}

function createStreakTexture(
    width: number,
    height: number,
): PIXI.Texture {
    // Elongated vertical streak with soft horizontal edges — rain droplet
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(255,255,255,0)')
    gradient.addColorStop(0.15, 'rgba(255,255,255,0.6)')
    gradient.addColorStop(0.5, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.85, 'rgba(255,255,255,0.6)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient

    // Taper the width — thinnest at top and bottom
    for (let y = 0; y < height; y++) {
        const t = y / height
        const taper = Math.sin(t * Math.PI) // 0 at edges, 1 at center
        const w = Math.max(1, width * (0.3 + 0.7 * taper))
        const x = (width - w) / 2
        ctx.globalAlpha = Math.sin(t * Math.PI)
        ctx.fillRect(x, y, w, 1)
    }
    return PIXI.Texture.from(canvas as unknown as HTMLCanvasElement)
}

function createFlakeTexture(
    size: number,
): PIXI.Texture {
    // Irregular, slightly rough-edged flake — for ash
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')!
    const center = size / 2

    ctx.beginPath()
    const points = 7
    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const wobble = 0.7 + Math.random() * 0.3
        const r = center * 0.8 * wobble
        const x = center + Math.cos(angle) * r
        const y = center + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
    }
    ctx.closePath()

    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fill()
    return PIXI.Texture.from(canvas as unknown as HTMLCanvasElement)
}

function createGlowTexture(
    size: number,
): PIXI.Texture {
    // Bright hot core with warm glow falloff — for embers
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')!
    const center = size / 2

    // Outer glow
    const outer = ctx.createRadialGradient(center, center, 0, center, center, center)
    outer.addColorStop(0, 'rgba(255,255,255,1)')
    outer.addColorStop(0.15, 'rgba(255,255,200,0.9)')
    outer.addColorStop(0.4, 'rgba(255,200,100,0.4)')
    outer.addColorStop(0.7, 'rgba(255,120,40,0.15)')
    outer.addColorStop(1, 'rgba(255,60,10,0)')
    ctx.fillStyle = outer
    ctx.fillRect(0, 0, size, size)
    return PIXI.Texture.from(canvas as unknown as HTMLCanvasElement)
}

function createCloudTexture(
    size: number,
): PIXI.Texture {
    // Very large, very soft gaussian-ish blob — for fog
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')!
    const center = size / 2

    // Multiple overlapping radial gradients for a more organic shape
    const offsets = [
        { x: 0, y: 0, r: 1.0 },
        { x: -0.15, y: -0.1, r: 0.7 },
        { x: 0.15, y: 0.1, r: 0.65 },
        { x: -0.05, y: 0.15, r: 0.6 },
    ]
    ctx.globalCompositeOperation = 'lighter'
    for (const off of offsets) {
        const cx = center + off.x * size
        const cy = center + off.y * size
        const r = center * off.r
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        gradient.addColorStop(0, 'rgba(255,255,255,0.3)')
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.1)')
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, size, size)
    }
    return PIXI.Texture.from(canvas as unknown as HTMLCanvasElement)
}

/** Linear interpolation between a and b by t (0–1). */
const lerp = (a: number, b: number, t: number): number => a + t * (b - a)

// ── Particle config ─────────────────────────────────────────────────────────

type ParticleConfig = {
    emitRate: number      // particles per second at intensity 1.0
    gravity: number       // px/s² (positive = down, negative = up)
    wind: number          // px/s horizontal base drift
    speed: number         // base px/s along emission angle
    scaleMin: number
    scaleMax: number
    alphaMin: number
    alphaMax: number
    lifetime: number      // ms base lifetime (randomized ±20%)
    lifetimeJitter: number // fractional random extension (0.4 = up to 40% longer)

    // Visual character
    tints: number[]            // PixiJS hex tints to randomly assign
    blendMode: string          // PixiJS v8 string blend mode ('normal', 'add', 'screen', etc.)
    rotationSpeed: number      // radians/s (0 = no spin)
    rotationAlign: boolean     // align rotation to velocity vector (rain)
    wobbleAmplitude: number    // px horizontal sway amplitude (0 = none)
    wobbleFrequency: number    // oscillations per second
    fadeInPct: number          // fraction of lifetime spent fading in (0–0.5)
    fadeOutPct: number         // fraction of lifetime spent fading out (0.2 = last 20%)
    scaleEndMultiplier: number // scale at end of life relative to start (1 = no change)
    spawnFullWidth: boolean    // spawn across full screen width (true) or clustered
    spawnY: 'top' | 'bottom' | 'random' | 'lower-half'

    // Depth simulation (0 = far, 1 = near)
    depthRange: [number, number]    // min/max depth to assign [far, near]
    depthScaleMul: [number, number] // scale multiplier at [far, near] (e.g., [0.4, 1.6])
    depthSpeedMul: [number, number] // speed multiplier at [far, near] (parallax)
    depthAlphaMul: [number, number] // alpha multiplier at [far, near]
}

const PRESETS: Record<Exclude<ParticleType, 'none'>, ParticleConfig> = {
    rain: {
        emitRate: 500,
        gravity: 2200,
        wind: -120,
        speed: 1100,
        scaleMin: 0.5,
        scaleMax: 0.9,
        alphaMin: 0.25,
        alphaMax: 0.55,
        lifetime: 900,
        lifetimeJitter: 0.2,
        tints: [0xc8d8f0, 0xd0e0ff, 0xb8c8e0, 0xe0e8ff],
        blendMode: 'screen',
        rotationSpeed: 0,
        rotationAlign: true,
        wobbleAmplitude: 0,
        wobbleFrequency: 0,
        fadeInPct: 0.05,
        fadeOutPct: 0.15,
        scaleEndMultiplier: 1.0,
        spawnFullWidth: true,
        spawnY: 'top',
        // Strong depth spread — far rain is thin faint streaks, near rain is fat bright streaks
        depthRange: [0, 1],
        depthScaleMul: [0.4, 1.8],
        depthSpeedMul: [0.6, 1.3],
        depthAlphaMul: [0.5, 1.0],
    },
    snow: {
        emitRate: 100,
        gravity: 50,
        wind: 15,
        speed: 45,
        scaleMin: 0.3,
        scaleMax: 1.0,
        alphaMin: 0.5,
        alphaMax: 0.95,
        lifetime: 8000,
        lifetimeJitter: 0.4,
        tints: [0xffffff, 0xf0f4ff, 0xe8ecff, 0xfff8f0],
        blendMode: 'normal',
        rotationSpeed: 0.3,
        rotationAlign: false,
        wobbleAmplitude: 40,
        wobbleFrequency: 0.4,
        fadeInPct: 0.1,
        fadeOutPct: 0.25,
        scaleEndMultiplier: 0.7,
        spawnFullWidth: true,
        spawnY: 'top',
        // Wide depth — big soft bokeh-like flakes in foreground, tiny sharp ones far away
        depthRange: [0, 1],
        depthScaleMul: [0.3, 2.0],
        depthSpeedMul: [0.5, 1.4],
        depthAlphaMul: [0.4, 1.0],
    },
    ash: {
        emitRate: 50,
        gravity: 20,
        wind: 35,
        speed: 30,
        scaleMin: 0.4,
        scaleMax: 1.0,
        alphaMin: 0.2,
        alphaMax: 0.6,
        lifetime: 9000,
        lifetimeJitter: 0.4,
        tints: [0x888888, 0x999999, 0x777777, 0x666666, 0xaaaaaa],
        blendMode: 'normal',
        rotationSpeed: 1.2,
        rotationAlign: false,
        wobbleAmplitude: 25,
        wobbleFrequency: 0.3,
        fadeInPct: 0.15,
        fadeOutPct: 0.2,
        scaleEndMultiplier: 0.5,
        spawnFullWidth: true,
        spawnY: 'top',
        // Moderate depth — some near flakes catch the eye, far ones are subtle
        depthRange: [0.1, 1],
        depthScaleMul: [0.5, 1.6],
        depthSpeedMul: [0.7, 1.2],
        depthAlphaMul: [0.5, 1.0],
    },
    embers: {
        emitRate: 60,
        gravity: -80,
        wind: 40,
        speed: 70,
        scaleMin: 0.15,
        scaleMax: 0.5,
        alphaMin: 0.6,
        alphaMax: 1.0,
        lifetime: 3500,
        lifetimeJitter: 0.5,
        tints: [0xff6600, 0xff8800, 0xffaa00, 0xff4400, 0xffcc44],
        blendMode: 'add',
        rotationSpeed: 0,
        rotationAlign: false,
        wobbleAmplitude: 20,
        wobbleFrequency: 0.8,
        fadeInPct: 0.05,
        fadeOutPct: 0.3,
        scaleEndMultiplier: 0.3,
        spawnFullWidth: true,
        spawnY: 'bottom',
        // Moderate depth — near embers are big glowing orbs, far ones are tiny pinpricks
        depthRange: [0.1, 1],
        depthScaleMul: [0.4, 1.8],
        depthSpeedMul: [0.6, 1.3],
        depthAlphaMul: [0.6, 1.0],
    },
    dust: {
        emitRate: 20,
        gravity: 5,
        wind: 18,
        speed: 12,
        scaleMin: 0.6,
        scaleMax: 2.0,
        alphaMin: 0.04,
        alphaMax: 0.15,
        lifetime: 14000,
        lifetimeJitter: 0.3,
        tints: [0xf5e6c8, 0xe8d8b4, 0xfff0d8, 0xd4c4a0],
        blendMode: 'normal',
        rotationSpeed: 0.1,
        rotationAlign: false,
        wobbleAmplitude: 50,
        wobbleFrequency: 0.15,
        fadeInPct: 0.25,
        fadeOutPct: 0.2,
        scaleEndMultiplier: 1.3,
        spawnFullWidth: true,
        spawnY: 'random',
        // Gentle depth — dust is ambient, too much depth variation looks wrong
        depthRange: [0.2, 1],
        depthScaleMul: [0.6, 1.5],
        depthSpeedMul: [0.8, 1.2],
        depthAlphaMul: [0.6, 1.0],
    },
    fog: {
        emitRate: 5,
        gravity: 0,
        wind: 10,
        speed: 8,
        scaleMin: 4.0,
        scaleMax: 8.0,
        alphaMin: 0.02,
        alphaMax: 0.08,
        lifetime: 20000,
        lifetimeJitter: 0.3,
        tints: [0xcccccc, 0xdddddd, 0xbbbbbb, 0xd0d0d0],
        blendMode: 'normal',
        rotationSpeed: 0.02,
        rotationAlign: false,
        wobbleAmplitude: 30,
        wobbleFrequency: 0.05,
        fadeInPct: 0.3,
        fadeOutPct: 0.35,
        scaleEndMultiplier: 1.4,
        spawnFullWidth: true,
        spawnY: 'lower-half',
        // Subtle depth — fog is volumetric, slight size variation is enough
        depthRange: [0.3, 1],
        depthScaleMul: [0.7, 1.3],
        depthSpeedMul: [0.8, 1.1],
        depthAlphaMul: [0.7, 1.0],
    },
}

// ── Particle instance ───────────────────────────────────────────────────────

type Particle = {
    sprite: PIXI.Sprite
    vx: number
    vy: number
    lifetime: number
    elapsed: number
    alphaBase: number
    scaleBase: number
    wobblePhase: number   // random phase offset for wobble
    spawnX: number        // original x for wobble center
}

// ── Particle System ─────────────────────────────────────────────────────────

export class ParticleSystem {
    private container: PIXI.Container
    private app: PIXI.Application
    private particles: Particle[] = []
    private textures: Map<string, PIXI.Texture> = new Map()
    private config: ParticleConfig | null = null
    private activeType: Exclude<ParticleType, 'none'> | null = null
    private intensity: number = 1.0
    private tickerFn: (() => void) | null = null
    private accumulator: number = 0  // fractional emit accumulator

    constructor(container: PIXI.Container, app: PIXI.Application) {
        this.container = container
        this.app = app
    }

    /**
     * Generate per-type procedural textures.
     * Each particle type gets a texture suited to its visual character.
     */
    async loadAtlas(_atlasPath: string): Promise<void> {
        // Procedural textures — async signature kept for future real atlas loading
        this.textures.set('rain', createStreakTexture(4, 28))
        this.textures.set('snow', createCircleTexture(24, 0.6))
        this.textures.set('ash', createFlakeTexture(16))
        this.textures.set('embers', createGlowTexture(24))
        this.textures.set('dust', createCircleTexture(32, 0.8))
        this.textures.set('fog', createCloudTexture(128))
    }

    activate(type: ParticleType, intensity: number): void {
        if (type === 'none') { this.deactivate(); return }
        this.deactivate()  // clear previous before starting new
        this.config = PRESETS[type]
        this.activeType = type
        this.intensity = Math.max(0, Math.min(1, intensity))
        this.accumulator = 0

        const ticker = () => {
            const delta = this.app.ticker.deltaMS
            this.tick(delta)
        }
        this.tickerFn = ticker
        this.app.ticker.add(ticker)
    }

    setIntensity(intensity: number): void {
        this.intensity = Math.max(0, Math.min(1, intensity))
    }

    deactivate(): void {
        if (this.tickerFn) {
            this.app.ticker.remove(this.tickerFn)
            this.tickerFn = null
        }
        for (const p of this.particles) {
            this.container.removeChild(p.sprite)
            p.sprite.destroy()
        }
        this.particles = []
        this.config = null
        this.activeType = null
        this.accumulator = 0
    }

    private tick(rawDeltaMs: number): void {
        if (!this.config || !this.activeType) return
        const cfg = this.config
        const texture = this.textures.get(this.activeType)
        if (!texture) return

        // Clamp delta to prevent particle explosion after tab-hidden or debugger pause
        const deltaMs = Math.min(rawDeltaMs, 100)

        // ── Emit ────────────────────────────────────────────────────────────
        this.accumulator += (cfg.emitRate * this.intensity * deltaMs) / 1000
        const toEmit = Math.floor(this.accumulator)
        this.accumulator -= toEmit
        for (let i = 0; i < toEmit; i++) {
            this.emit(cfg, texture)
        }

        // ── Update ──────────────────────────────────────────────────────────
        const W = OUTPUT_CONFIG.width
        const H = OUTPUT_CONFIG.height
        // Resolution-relative margin for wrapping/culling (Rule 5)
        const margin = W * 0.04
        const fadeOutStart = 1 - cfg.fadeOutPct

        let i = this.particles.length
        while (i-- > 0) {
            const p = this.particles[i]
            p.elapsed += deltaMs
            if (p.elapsed >= p.lifetime) {
                this.container.removeChild(p.sprite)
                p.sprite.destroy()
                this.particles.splice(i, 1)
                continue
            }

            const lifePct = p.elapsed / p.lifetime

            // Physics
            p.vy += (cfg.gravity / 1000) * deltaMs
            p.vx += (cfg.wind / 1000) * deltaMs * 0.02  // gentle drift accumulation

            p.sprite.y += (p.vy / 1000) * deltaMs

            // Wobble/sway — sinusoidal offset from spawn x
            if (cfg.wobbleAmplitude > 0) {
                const wobbleOffset = Math.sin(
                    (p.elapsed / 1000) * cfg.wobbleFrequency * Math.PI * 2 + p.wobblePhase,
                ) * cfg.wobbleAmplitude
                p.sprite.x = p.spawnX + wobbleOffset + (p.vx / 1000) * p.elapsed
            } else {
                p.sprite.x += (p.vx / 1000) * deltaMs
            }

            // Alpha: fade-in → sustain → fade-out
            let alpha = p.alphaBase
            if (lifePct < cfg.fadeInPct && cfg.fadeInPct > 0) {
                alpha *= lifePct / cfg.fadeInPct
            } else if (lifePct > fadeOutStart && cfg.fadeOutPct > 0) {
                alpha *= 1 - (lifePct - fadeOutStart) / cfg.fadeOutPct
            }
            p.sprite.alpha = alpha

            // Scale over lifetime
            if (cfg.scaleEndMultiplier !== 1.0) {
                const scaleMul = 1 + (cfg.scaleEndMultiplier - 1) * lifePct
                p.sprite.scale.set(p.scaleBase * scaleMul)
            }

            // Rotation
            if (cfg.rotationAlign) {
                p.sprite.rotation = Math.atan2(p.vy, p.vx)
            } else if (cfg.rotationSpeed > 0) {
                p.sprite.rotation += cfg.rotationSpeed * (deltaMs / 1000)
            }

            // Horizontal wrapping
            if (p.sprite.x > W + margin) {
                p.sprite.x = -margin
                p.spawnX -= W + margin * 2
            }
            if (p.sprite.x < -margin) {
                p.sprite.x = W + margin
                p.spawnX += W + margin * 2
            }

            // Vertical bounds — kill if off-screen
            if (p.sprite.y > H + margin * 2 || p.sprite.y < -margin * 2) {
                p.elapsed = p.lifetime // force death next frame
            }
        }
    }

    private emit(cfg: ParticleConfig, texture: PIXI.Texture): void {
        const sprite = new PIXI.Sprite(texture)
        const W = OUTPUT_CONFIG.width
        const H = OUTPUT_CONFIG.height

        // Depth — random value in the type's depth range, then lerp multipliers
        const [dMin, dMax] = cfg.depthRange
        const depth = dMin + Math.random() * (dMax - dMin)
        const depthScaleMul = lerp(cfg.depthScaleMul[0], cfg.depthScaleMul[1], depth)
        const depthSpeedMul = lerp(cfg.depthSpeedMul[0], cfg.depthSpeedMul[1], depth)
        const depthAlphaMul = lerp(cfg.depthAlphaMul[0], cfg.depthAlphaMul[1], depth)

        const scale = (cfg.scaleMin + Math.random() * (cfg.scaleMax - cfg.scaleMin)) * depthScaleMul
        const alpha = (cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin)) * depthAlphaMul

        sprite.anchor.set(0.5)
        sprite.scale.set(scale)
        sprite.alpha = cfg.fadeInPct > 0 ? 0 : alpha  // start invisible if fade-in

        // Tint — pick random from palette
        if (cfg.tints.length > 0) {
            sprite.tint = cfg.tints[Math.floor(Math.random() * cfg.tints.length)]
        }

        // Blend mode (PixiJS v8: string values, not enum)
        sprite.blendMode = cfg.blendMode

        // Spawn position
        const spawnX = cfg.spawnFullWidth
            ? Math.random() * W
            : W * 0.3 + Math.random() * W * 0.4

        let spawnY: number
        switch (cfg.spawnY) {
            case 'top':
                spawnY = -30
                break
            case 'bottom':
                spawnY = H + 30
                break
            case 'lower-half':
                spawnY = H * 0.4 + Math.random() * H * 0.6
                break
            case 'random':
            default:
                spawnY = Math.random() * H
                break
        }

        sprite.x = spawnX
        sprite.y = spawnY

        // Velocity — depth modulates speed for parallax effect
        const speed = cfg.speed * (0.75 + Math.random() * 0.5) * depthSpeedMul
        const baseAngle = cfg.gravity >= 0 ? Math.PI / 2 : -Math.PI / 2
        const spread = 0.25
        const angle = baseAngle + (Math.random() - 0.5) * spread

        // Initial rotation
        if (cfg.rotationAlign) {
            sprite.rotation = angle
        } else if (cfg.rotationSpeed > 0) {
            sprite.rotation = Math.random() * Math.PI * 2
        }

        this.container.addChild(sprite)
        this.particles.push({
            sprite,
            vx: Math.cos(angle) * speed + cfg.wind * depthSpeedMul,
            vy: Math.sin(angle) * speed,
            lifetime: cfg.lifetime * (1 + Math.random() * cfg.lifetimeJitter),
            elapsed: 0,
            alphaBase: alpha,
            scaleBase: scale,
            wobblePhase: Math.random() * Math.PI * 2,
            spawnX,
        })
    }

    destroy(): void {
        this.deactivate()
        for (const tex of this.textures.values()) {
            tex.destroy()
        }
        this.textures.clear()
    }
}
