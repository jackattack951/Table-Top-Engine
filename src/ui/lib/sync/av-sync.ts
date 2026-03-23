/**
 * AV, fog, SFX, preview, and FX overlay socket emitters.
 */
import { EVENTS } from '@shared/socket-events'
import type { SFXClip } from '@core/types'
import type { DisplayInfo } from '@shared/output-types'
import { getSocket, getServerUrl } from './connection'

/** Trigger an SFX clip on the AV Display. */
export function triggerSFX(clip: SFXClip): void {
    getSocket()?.emit(EVENTS.SFX_TRIGGER, clip)
}

/** Stop a playing SFX loop by clip ID. */
export function stopSFX(clipId: string): void {
    getSocket()?.emit(EVENTS.SFX_STOP, { clipId })
}

/** Play a VP9+alpha WebM FX overlay loop on the AV Display. */
export function playFXOverlay(clipId: string, url: string, loopOffset = 0): void {
    getSocket()?.emit(EVENTS.AV_FX_OVERLAY, { clipId, url, loopOffset, active: true })
}

/** Stop a playing FX overlay loop by clip ID. */
export function stopFXOverlay(clipId: string): void {
    getSocket()?.emit(EVENTS.AV_FX_OVERLAY, { clipId, url: '', loopOffset: 0, active: false })
}

/** Request the AV Display to start streaming preview frames. */
export function startPreview(options?: { fps?: number; quality?: number }): void {
    getSocket()?.emit(EVENTS.PREVIEW_START, options ?? {})
}

/** Stop the AV Display preview stream. */
export function stopPreview(): void {
    getSocket()?.emit(EVENTS.PREVIEW_STOP)
}

// ── Fog of War helpers (Sprint 10g) ──────────────────────────────────────────

/**
 * Relay an incremental fog brush stroke to the AV Display.
 */
export function emitFogBrush(payload: {
    sceneId: string
    strokes: Array<{ x: number; y: number; radius: number; reveal: boolean }>
}): void {
    getSocket()?.emit(EVENTS.FOG_BRUSH, payload)
}

/**
 * Toggle fog of war on or off for a scene.
 */
export function emitFogToggle(payload: { sceneId: string; enabled: boolean }): void {
    getSocket()?.emit(EVENTS.FOG_TOGGLE, payload)
}

/**
 * Clear all fog for a scene (reveal everything).
 */
export function emitFogReset(payload: { sceneId: string }): void {
    getSocket()?.emit(EVENTS.FOG_RESET, payload)
}

/**
 * Push a full fog bitmap update to the AV Display.
 * @param payload.fogData base64-encoded PNG bitmap
 */
export function emitFogUpdate(payload: { sceneId: string; fogData: string }): void {
    getSocket()?.emit(EVENTS.FOG_UPDATE, payload)
}

/** Emit an environment change to the AV Display (loads new stem set). */
export function emitEnvironmentChange(environmentId: string): void {
    getSocket()?.emit(EVENTS.ENVIRONMENT_CHANGE, { environmentId })
}

/** Emit a breathing hold duration change to the AV Display. */
export function emitBreathingHold(seconds: number): void {
    getSocket()?.emit(EVENTS.BREATHING_HOLD, { seconds })
}

// ── Output management helpers (Sprint 9b) ────────────────────────────────────

/** Request the server to enable an AV output on a specific display. */
export function emitOutputEnable(displayId: number | 'windowed', role: 'BG' | 'GB'): void {
    getSocket()?.emit(EVENTS.OUTPUT_ENABLE, { displayId, role })
}

/** Request the server to disable an AV output by role. */
export function emitOutputDisable(role: 'BG' | 'GB'): void {
    getSocket()?.emit(EVENTS.OUTPUT_DISABLE, { role })
}

/**
 * Fetch the list of available displays from the server.
 */
export async function fetchDisplays(): Promise<DisplayInfo[]> {
    try {
        const res = await fetch(`${getServerUrl()}/api/displays`)
        if (!res.ok) return []
        return res.json() as Promise<DisplayInfo[]>
    } catch {
        return []
    }
}
