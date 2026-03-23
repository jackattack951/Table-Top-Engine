/**
 * AV, fog, mood, SFX, and preview socket event handlers.
 * Extracted from server.ts to keep handler modules focused.
 * Called inside io.on('connection') for each new socket.
 */
import type { Server, Socket } from 'socket.io'
import { EVENTS } from '../../shared/socket-events'
import type { ServerState } from './server-types'

export function registerAVHandlers(
    io: Server,
    socket: Socket,
    serverState: ServerState,
    relay: (event: string, room: 'av-display' | 'cockpit' | 'player') => void,
): void {
    /** Lazy-initialize avState with consistent defaults. */
    function ensureAvState(): NonNullable<ServerState['avState']> {
        if (!serverState.avState) {
            serverState.avState = {
                particles: { type: 'none', intensity: 0 },
                colorGrade: {},
                gbColorGrade: {},
            }
        }
        return serverState.avState
    }
    // ── Pure AV relays (cockpit → av-display) ─────────────────────────────────
    relay(EVENTS.SFX_TRIGGER, 'av-display')
    relay(EVENTS.SFX_STOP, 'av-display')
    relay(EVENTS.MASTER_VOLUME, 'av-display')
    relay(EVENTS.AMBIENCE_VOLUME, 'av-display')
    relay(EVENTS.MUSIC_VOLUME, 'av-display')
    relay(EVENTS.SFX_VOLUME, 'av-display')
    relay(EVENTS.BG_VIDEO_VOLUME, 'av-display')
    relay(EVENTS.GB_VIDEO_VOLUME, 'av-display')
    relay(EVENTS.BREATHING_HOLD, 'av-display')
    relay(EVENTS.AV_FOG_ERASE, 'av-display')
    relay(EVENTS.AV_PING, 'av-display')
    relay(EVENTS.AV_FX_OVERLAY, 'av-display')

    // ── Fog of War relays (cockpit → av-display) ──────────────────────────────
    relay(EVENTS.FOG_UPDATE, 'av-display')
    relay(EVENTS.FOG_BRUSH, 'av-display')
    relay(EVENTS.FOG_TOGGLE, 'av-display')
    relay(EVENTS.FOG_RESET, 'av-display')

    // ── Preview relay (av-display → cockpit) ──────────────────────────────────
    relay(EVENTS.PREVIEW_FRAME, 'cockpit')

    // ── State-caching handlers ────────────────────────────────────────────────

    socket.on(EVENTS.MOOD_UPDATE, (payload) => {
        const { value } = payload as { value: number }
        serverState.moodValue = value
        io.to('av-display').emit(EVENTS.MOOD_UPDATE, payload)
    })

    socket.on(EVENTS.AV_PARTICLES, (payload) => {
        const p = payload as { type: string; intensity: number }
        ensureAvState().particles = p
        io.to('av-display').emit(EVENTS.AV_PARTICLES, payload)
    })

    socket.on(EVENTS.AV_COLORGRADE, (payload) => {
        const data = payload as Record<string, unknown>
        const target = data.target as 'BG' | 'GB' | undefined
        const avState = ensureAvState()
        if (target === 'GB') {
            avState.gbColorGrade = data
        } else {
            avState.colorGrade = data
        }
        io.to('av-display').emit(EVENTS.AV_COLORGRADE, payload)
    })

    socket.on(EVENTS.PREVIEW_START, (payload) => {
        serverState.previewActive = true
        io.to('av-display').emit(EVENTS.PREVIEW_START, payload)
    })

    socket.on(EVENTS.PREVIEW_STOP, () => {
        serverState.previewActive = false
        io.to('av-display').emit(EVENTS.PREVIEW_STOP)
    })
}
