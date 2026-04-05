/**
 * AV Display renderer entry point — Sprint 4, updated Sprint 9b.
 *
 * Sprint 9b: Role-aware initialization.
 * The URL query parameter `?role=BG` or `?role=GB` determines which systems
 * this renderer initializes. When role is absent (legacy/fallback), all systems
 * initialize for backward compatibility.
 *
 * BG role: Background video, particles, FX overlays, MoodEngine, SFX
 * GB role: Gameboard video, fog of war, ping tool
 * Both:   LayerStack, color grade, combat overlay, preview capture, socket
 *
 * Rule 14: One display, one role — BG or GB, never both simultaneously.
 * Runs ONLY in the Electron AV Display BrowserWindow.
 * Cockpit UI never imports from this file.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { io } from 'socket.io-client'
import { EVENTS } from '@shared/socket-events'
import { LayerStack } from './layer-stack'
import { DeckPair } from './deck-pair'
import { ParticleSystem } from './particle-system'
import { FogOfWar } from './fog-of-war'
import { PingTool } from './ping-tool'
import { FXLoopPlayer } from './fx-loop-player'
import { PreviewCapture } from './preview-capture'
import { QROverlay } from './qr-overlay'
import { MoodEngine } from '@systems/audio/mood-engine'
import { SFXSoundboard } from '@systems/audio/sfx-soundboard'
import { getEnvironmentAudioConfig } from '@systems/audio/audio-config'
import { CombatOverlay } from './components/combat-overlay'
import type { ColorGradeUniforms } from './color-grade-filter'
import type { CombatState, ParticleType, Scene, SFXClip } from '@core/types'
import type { MediaAsset } from '@shared/asset-types'

// ── Role detection (Sprint 9b) ──────────────────────────────────────────────

const urlParams = new URLSearchParams(window.location.search)
const role = urlParams.get('role') as 'BG' | 'GB' | null

// When role is null (legacy/fallback), init everything for backward compat
const isBG = role === 'BG' || role === null
const isGB = role === 'GB' || role === null

// ── React overlay root ───────────────────────────────────────────────────────

const overlayContainer = document.createElement('div')
overlayContainer.id = 'combat-overlay-root'
overlayContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100;'
document.body.appendChild(overlayContainer)

const overlayRoot = createRoot(overlayContainer)

function renderOverlay(state: CombatState | null): void {
    overlayRoot.render(React.createElement(CombatOverlay, { state }))
}

// ── System Init ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('av-canvas') as HTMLCanvasElement
const layerStack = new LayerStack()

async function boot(): Promise<void> {
    await layerStack.init(canvas)
    const app = layerStack.pixiApp!

    // ── BG systems ──────────────────────────────────────────────────────────

    let particleSystem: ParticleSystem | null = null
    let fxPlayer: FXLoopPlayer | null = null
    let moodEngine: MoodEngine | null = null
    let sfxSoundboard: SFXSoundboard | null = null
    let moodEngineReady = false
    let bgDeck: DeckPair | null = null

    if (isBG) {
        // Background A/B deck pair (Sprint 18c — Rule 12)
        bgDeck = new DeckPair(layerStack.layers.background)

        // Particle system
        particleSystem = new ParticleSystem(layerStack.layers.particle, app)
        await particleSystem.loadAtlas('/assets/particles/atlas.png')

        // FX loop player — VP9+alpha WebM loops
        fxPlayer = new FXLoopPlayer(layerStack.layers.fx)

        // Audio systems (AV Display only — Rule 1)
        moodEngine = new MoodEngine()
        sfxSoundboard = new SFXSoundboard()
        sfxSoundboard.init()
    }

    // ── GB systems ──────────────────────────────────────────────────────────

    let fogOfWar: FogOfWar | null = null
    let pingTool: PingTool | null = null
    let gbDeck: DeckPair | null = null

    if (isGB) {
        // Gameboard A/B deck pair (Sprint 18c — Rule 12)
        gbDeck = new DeckPair(layerStack.layers.gameboard)

        // Fog of War — on the fog layer (above gameboard, below FX)
        // Hidden by default; shown when scene has fog enabled or DM starts painting
        fogOfWar = new FogOfWar(layerStack.layers.fog)
        layerStack.layers.fog.visible = false

        // Ping tool — always listening
        pingTool = new PingTool(layerStack.layers.ui, app)
    }

    // ── Shared: Status text on UI layer ─────────────────────────────────────

    const { Text } = await import('pixi.js')
    const statusText = new Text({
        text: `AV Display Ready ✓ [${role ?? 'all'}]`,
        style: { fill: '#666666', fontSize: 16, fontFamily: 'system-ui' },
    })
    statusText.x = 20
    statusText.y = 20
    layerStack.layers.ui.addChild(statusText)

    function setStatus(msg: string): void {
        statusText.text = msg
        setTimeout(() => { statusText.text = '' }, 3000)
    }

    // ── QR Overlay (Phase 6 — both roles) ──────────────────────────────────

    const qrOverlay = new QROverlay(layerStack.layers.ui)

    // ── Socket.io ───────────────────────────────────────────────────────────

    const SERVER_URL = 'http://localhost:8080'
    const socket = io(SERVER_URL, { autoConnect: true })

    socket.on(EVENTS.CONNECT, () => {
        socket.emit(EVENTS.CLIENT_JOIN, { room: 'av-display' })
        setStatus(`AV Display Ready ✓ [${role ?? 'all'}]`)
    })

    socket.on(EVENTS.DISCONNECT, () => {
        setStatus('AV Display — disconnected')
    })

    // ── Media resolution helper ────────────────────────────────────────────

    interface ResolvedMedia {
        type: 'video' | 'image'
        url: string
        playbackMode: import('@shared/asset-types').PlaybackMode
    }

    /**
     * Resolve a scene's media for a given role to a URL + type.
     * Checks asset-based loading first, then falls back to legacy path.
     */
    async function resolveMedia(
        scene: Scene,
        roleKey: 'background' | 'gameboard',
        legacyPath?: string | null,
    ): Promise<ResolvedMedia | null> {
        const assetId = roleKey === 'background' ? scene.backgroundAssetId : scene.gameboardAssetId
        if (assetId) {
            try {
                const assetRes = await fetch(`${SERVER_URL}/api/assets/${assetId}`)
                if (assetRes.ok) {
                    const asset = await assetRes.json() as MediaAsset
                    return {
                        type: asset.mediaType as 'video' | 'image',
                        url: `${SERVER_URL}/api/assets/${asset.id}/file`,
                        playbackMode: asset.playbackMode,
                    }
                }
                console.warn(`[av-display] ${roleKey}: asset fetch failed HTTP`, assetRes.status)
            } catch (err) {
                console.warn(`[av-display] asset-based ${roleKey} load failed:`, err)
            }
        }
        // Fallback: legacy path
        const fallback = roleKey === 'background' ? (scene.backgroundPath ?? legacyPath) : legacyPath
        if (fallback) {
            return { type: 'video', url: fallback, playbackMode: 'loop' }
        }
        return null
    }

    // ── Fetch scene helper ───────────────────────────────────────────────

    async function fetchScene(sceneId: string): Promise<Scene | null> {
        try {
            const res = await fetch(`${SERVER_URL}/api/scenes/${sceneId}`)
            if (res.ok) return await res.json() as Scene
            console.warn(`[av-display] failed to fetch scene ${sceneId}: HTTP ${res.status}`)
        } catch (err) {
            console.error('[av-display] scene REST fetch error (CORS?):', err)
        }
        return null
    }

    // ── Scene cue — preload media onto standby deck (Sprint 18c) ────────

    async function handleSceneCue(sceneId: string): Promise<void> {
        setStatus(`Cueing scene…`)
        const scene = await fetchScene(sceneId)
        if (!scene) return

        // BG: preload background media onto standby deck
        if (isBG && bgDeck) {
            const media = await resolveMedia(scene, 'background')
            if (media) {
                try {
                    if (media.type === 'image') {
                        await bgDeck.preloadImage(media.url, sceneId)
                    } else {
                        await bgDeck.preloadVideo(media.url, sceneId, media.playbackMode)
                    }
                } catch (err) {
                    console.warn('[av-display] BG cue preload failed:', err)
                }
            }
        }

        // GB: preload gameboard media onto standby deck
        if (isGB && gbDeck) {
            const media = await resolveMedia(scene, 'gameboard')
            if (media) {
                try {
                    if (media.type === 'image') {
                        await gbDeck.preloadImage(media.url, sceneId)
                    } else {
                        await gbDeck.preloadVideo(media.url, sceneId, media.playbackMode)
                    }
                } catch (err) {
                    console.warn('[av-display] GB cue preload failed:', err)
                }
            }
        }

        setStatus(`Cued: ${scene.name}`)
    }

    // ── Scene load (extracted for reuse by STATE_SYNC) ─────────────────────

    async function handleSceneLoad(
        sceneId: string,
        payloadBg?: string,
        gameboardPath?: string,
    ): Promise<void> {
        setStatus(`Loading scene…`)
        const scene = await fetchScene(sceneId)

        // BG: apply background media via DeckPair
        if (isBG && bgDeck) {
            // If media is already preloaded on standby, just take (instant swap)
            if (bgDeck.hasPreload(sceneId)) {
                bgDeck.take()
            } else {
                // Cold load — no prior cue, load directly into live deck
                if (!scene) { console.warn('[av-display] BG cold load: scene not found'); return }
                const media = await resolveMedia(scene, 'background', payloadBg)
                if (media) {
                    try {
                        if (media.type === 'image') {
                            await bgDeck.loadImage(media.url)
                        } else {
                            await bgDeck.loadVideo(media.url, media.playbackMode)
                        }
                    } catch (err) {
                        console.warn('[av-display] BG cold load failed:', err)
                    }
                }
            }

            if (scene?.particles && particleSystem) {
                particleSystem.activate(scene.particles.type, scene.particles.intensity)
            }

            if (typeof scene?.audioMood === 'number' && moodEngine) {
                if (!moodEngineReady) {
                    await moodEngine.init()
                    moodEngineReady = true
                }
                moodEngine.setMood(scene.audioMood)
            }
        }

        // GB: apply gameboard media via DeckPair
        if (isGB && gbDeck) {
            if (gbDeck.hasPreload(sceneId)) {
                gbDeck.take()
                layerStack.layers.gameboard.visible = true
            } else {
                // Cold load
                if (!scene) { console.warn('[av-display] GB cold load: scene not found'); return }
                const media = await resolveMedia(scene, 'gameboard', gameboardPath)
                if (media) {
                    try {
                        if (media.type === 'image') {
                            await gbDeck.loadImage(media.url)
                        } else {
                            await gbDeck.loadVideo(media.url, media.playbackMode)
                        }
                        layerStack.layers.gameboard.visible = true
                    } catch (err) {
                        console.warn('[av-display] GB cold load failed:', err)
                    }
                }
            }
        }

        // GB: apply fog of war from persisted scene data
        if (isGB && fogOfWar && scene) {
            if (scene.fogEnabled && scene.fogData) {
                await fogOfWar.loadBitmap(scene.fogData)
                layerStack.layers.fog.visible = true
            } else if (scene.fogEnabled) {
                fogOfWar.init()
                layerStack.layers.fog.visible = true
            } else {
                layerStack.layers.fog.visible = false
            }
        }

        // Apply role-specific color grade from scene record
        if (isBG && scene?.colorGrade) {
            layerStack.setColorGrade({
                brightness: scene.colorGrade.brightness,
                contrast: scene.colorGrade.contrast,
                saturation: scene.colorGrade.saturation,
                temperature: scene.colorGrade.temperature,
                tint: scene.colorGrade.tint,
            })
        }
        if (isGB && scene?.gbColorGrade) {
            layerStack.setColorGrade({
                brightness: scene.gbColorGrade.brightness,
                contrast: scene.gbColorGrade.contrast,
                saturation: scene.gbColorGrade.saturation,
                temperature: scene.gbColorGrade.temperature,
                tint: scene.gbColorGrade.tint,
            })
        }

        setStatus(`Scene: ${scene?.name ?? sceneId}`)
    }

    // ── Scene cue — preload media onto standby deck (Sprint 18c) ───────────
    socket.on(EVENTS.SCENE_CUE, (data: unknown) => {
        const { sceneId } = data as { sceneId: string }
        void handleSceneCue(sceneId)
    })

    // STATE_SYNC on initial connect — intentionally ignored.
    // AV Display always starts on the idle/lobby screen regardless of cockpit state.
    // Only an explicit SCENE_LOAD (DM presses TAKE) transitions away from idle.
    socket.on(EVENTS.STATE_SYNC, () => { /* no-op: idle screen persists until TAKE */ })

    socket.on(EVENTS.SCENE_LOAD, (data: unknown) => {
        const { sceneId, backgroundPath, gameboardPath } = data as {
            sceneId: string
            backgroundPath?: string
            gameboardPath?: string
        }
        void handleSceneLoad(sceneId, backgroundPath, gameboardPath)
    })

    // ── BG-only socket handlers ─────────────────────────────────────────────

    if (isBG) {
        // Mood update — MoodEngine (Tone.js, Rule 1)
        socket.on(EVENTS.MOOD_UPDATE, async (data: unknown) => {
            const { value } = data as { value: number }
            if (!moodEngineReady && moodEngine) {
                await moodEngine.init()
                moodEngineReady = true
            }
            moodEngine?.setMood(value)
        })

        // Sprint 17c: Environment audio change — load new stem set
        // Stem paths in audio-config are relative to Express (/audio/stems/...).
        // AV Display loads from electron-vite (port 5174) in dev, so we must
        // resolve stem URLs against the Express server origin.
        socket.on(EVENTS.ENVIRONMENT_CHANGE, async (data: unknown) => {
            const { environmentId } = data as { environmentId: string }
            if (!moodEngine) return
            if (!moodEngineReady) {
                await moodEngine.init()
                moodEngineReady = true
            }
            const config = getEnvironmentAudioConfig(environmentId)
            if (config) {
                const absoluteConfig = {
                    ...config,
                    stems: {
                        ambience: `${SERVER_URL}${config.stems.ambience}`,
                        calm: `${SERVER_URL}${config.stems.calm}`,
                        tense: `${SERVER_URL}${config.stems.tense}`,
                        dramatic: `${SERVER_URL}${config.stems.dramatic}`,
                    },
                }
                const success = await moodEngine.loadEnvironment(absoluteConfig)
                if (success) {
                    setStatus(`Audio: ${config.label}`)
                } else {
                    setStatus(`Audio: ${config.label} (stems not found)`)
                }
            }
        })

        // Sprint 17c: Volume faders from cockpit
        socket.on(EVENTS.MASTER_VOLUME, (data: unknown) => {
            const { volume } = data as { volume: number }
            moodEngine?.setMasterVolume(volume)
        })

        socket.on(EVENTS.AMBIENCE_VOLUME, (data: unknown) => {
            const { volume } = data as { volume: number }
            moodEngine?.setAmbienceVolume(volume)
        })

        socket.on(EVENTS.MUSIC_VOLUME, (data: unknown) => {
            const { volume } = data as { volume: number }
            moodEngine?.setMusicVolume(volume)
        })

        socket.on(EVENTS.SFX_VOLUME, (data: unknown) => {
            const { volume } = data as { volume: number }
            sfxSoundboard?.setMasterVolume(volume)
        })

        socket.on(EVENTS.BG_VIDEO_VOLUME, (data: unknown) => {
            const { volume } = data as { volume: number }
            bgDeck?.setVolume(volume)
        })

        socket.on(EVENTS.GB_VIDEO_VOLUME, (data: unknown) => {
            const { volume } = data as { volume: number }
            gbDeck?.setVolume(volume)
        })

        socket.on(EVENTS.BREATHING_HOLD, (data: unknown) => {
            const { seconds } = data as { seconds: number }
            moodEngine?.setBreathingHold(seconds)
        })

        // SFX trigger (Rule 11: always through PannerNode)
        socket.on(EVENTS.SFX_TRIGGER, (data: unknown) => {
            const clip = data as SFXClip
            sfxSoundboard?.trigger(clip)
        })

        // SFX stop
        socket.on(EVENTS.SFX_STOP, (data: unknown) => {
            const { clipId } = data as { clipId: string }
            sfxSoundboard?.stop(clipId)
        })

        // Particles + environmental audio link
        socket.on(EVENTS.AV_PARTICLES, (data: unknown) => {
            const { type, intensity } = data as { type: ParticleType; intensity: number }
            particleSystem?.activate(type, intensity)
        })

        // FX overlay — VP9+alpha WebM loop (Rule 9)
        socket.on(EVENTS.AV_FX_OVERLAY, (data: unknown) => {
            const { clipId, url, loopOffset, active } = data as {
                clipId: string; url: string; loopOffset: number; active: boolean
            }
            if (active) {
                void fxPlayer?.load({ id: clipId, filePath: url, loopOffset, alpha: 1.0 })
            } else {
                fxPlayer?.unload(clipId)
            }
        })

        // Content load (BG: background video + audio stems + FX overlays)
        socket.on(EVENTS.CONTENT_LOAD, (data: unknown) => {
            const { assetType, filePath, targetEngine } = data as {
                assetType: 'video' | 'audio-stem' | 'fx-overlay'
                filePath: string
                targetEngine?: 'background' | 'gameboard'
            }
            if (assetType === 'video' && targetEngine !== 'gameboard') {
                if (bgDeck) void bgDeck.loadVideo(filePath)
            } else if (assetType === 'fx-overlay') {
                const clipId = filePath.split('/').pop() ?? filePath
                void fxPlayer?.load({ id: clipId, filePath, loopOffset: 0, alpha: 1.0 })
            }
        })
    }

    // ── GB-only socket handlers ─────────────────────────────────────────────

    if (isGB) {
        // Fog of War — real-time brush strokes from cockpit
        socket.on(EVENTS.FOG_BRUSH, (data: unknown) => {
            const { strokes } = data as {
                sceneId: string
                strokes: Array<{ x: number; y: number; radius: number; reveal: boolean }>
            }
            if (!fogOfWar) return
            // Auto-show fog layer on first brush stroke
            if (!layerStack.layers.fog.visible) {
                fogOfWar.init()
                layerStack.layers.fog.visible = true
            }
            fogOfWar.applyBrush(strokes)
        })

        // Fog of War — full bitmap sync (authoritative state, replaces everything)
        socket.on(EVENTS.FOG_UPDATE, (data: unknown) => {
            const { fogData } = data as { sceneId: string; fogData: string }
            if (!fogOfWar) return
            if (!layerStack.layers.fog.visible) {
                layerStack.layers.fog.visible = true
            }
            void fogOfWar.loadBitmap(fogData)
        })

        // Fog of War — toggle visibility
        socket.on(EVENTS.FOG_TOGGLE, (data: unknown) => {
            const { enabled } = data as { sceneId: string; enabled: boolean }
            layerStack.layers.fog.visible = enabled
            if (enabled && fogOfWar && !layerStack.layers.fog.children.length) {
                fogOfWar.init()
            }
        })

        // Fog of War — reset to full opaque black
        socket.on(EVENTS.FOG_RESET, (data: unknown) => {
            if (!fogOfWar) return
            fogOfWar.reset()
            layerStack.layers.fog.visible = true
        })

        // Ping
        socket.on(EVENTS.AV_PING, (data: unknown) => {
            const { x, y } = data as { x: number; y: number }
            pingTool?.trigger(x, y)
        })

        // Content load (GB: gameboard video only)
        socket.on(EVENTS.CONTENT_LOAD, (data: unknown) => {
            const { assetType, filePath, targetEngine } = data as {
                assetType: 'video' | 'audio-stem' | 'fx-overlay'
                filePath: string
                targetEngine?: 'background' | 'gameboard'
            }
            if (assetType === 'video' && targetEngine === 'gameboard') {
                if (gbDeck) void gbDeck.loadVideo(filePath)
            }
        })
    }

    // ── Shared socket handlers ──────────────────────────────────────────────

    // Color grade — role-aware: BG outputs only apply BG grades, GB only GB grades
    socket.on(EVENTS.AV_COLORGRADE, (data: unknown) => {
        const payload = data as ColorGradeUniforms & { target?: 'BG' | 'GB' }
        const target = payload.target ?? 'BG'
        // Only apply if this output's role matches the target (or legacy no-role fallback)
        if ((target === 'BG' && isBG) || (target === 'GB' && isGB) || role === null) {
            layerStack.setColorGrade(payload)
        }
    })

    // Combat overlay (both roles — shows on any AV output)
    socket.on(EVENTS.COMBAT_SYNC, (data: unknown) => {
        const combatState = data as CombatState
        renderOverlay(combatState)
    })

    socket.on(EVENTS.COMBAT_UPDATE, (data: unknown) => {
        const combatState = data as CombatState
        renderOverlay(combatState)
    })

    // Session ended — return to idle screen by hiding media layers
    socket.on(EVENTS.SESSION_ENDED, () => {
        layerStack.layers.background.visible = false
        layerStack.layers.gameboard.visible = false
        layerStack.layers.fog.visible = false
        setStatus('Session ended')
    })

    // QR overlay (Phase 6 — both roles, all AV windows)
    socket.on(EVENTS.SESSION_QR_OVERLAY, (data: unknown) => {
        const { show, qrDataUrl, sessionCode } = data as {
            show: boolean
            qrDataUrl?: string
            sessionCode?: string
        }
        if (show && qrDataUrl && sessionCode) {
            void qrOverlay.show(qrDataUrl, sessionCode)
        } else {
            qrOverlay.hide()
        }
    })

    // ── Real-time preview capture (Sprint 7b) ───────────────────────────────

    const previewCapture = new PreviewCapture(canvas, socket)

    socket.on(EVENTS.PREVIEW_START, (data: unknown) => {
        const opts = data as { fps?: number; quality?: number }
        previewCapture.start(opts)
    })

    socket.on(EVENTS.PREVIEW_STOP, () => {
        previewCapture.stop()
    })

    // Initial overlay render (empty state)
    renderOverlay(null)

}

boot().catch((e) => console.error('[av-display] boot failed:', e))
