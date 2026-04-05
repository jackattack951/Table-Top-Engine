/**
 * Socket.io connection infrastructure for the cockpit sync layer.
 * Manages socket lifecycle, browser dev detection, pending emit queue,
 * and the main initSync() entry point.
 *
 * Components never call socket.emit() directly — use domain helpers.
 */
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { EVENTS } from '@shared/socket-events'
import { useCombatStore } from '../../stores/combat-store'
import { useMoodStore } from '../../stores/mood-store'
import { useSceneStore } from '../../stores/scene-store'
import { useAVStore } from '../../stores/av-store'
import { useNotesStore } from '../../stores/notes-store'
import { useAppStore } from '../../stores/app-store'
import { useOutputStore } from '../../stores/output-store'
import { usePlayerStore } from '../../stores/player-store'
import { useItemsStore } from '../../stores/items-store'
import { wsStub } from '../ws-stub'
import { startLatencyMeasurement, stopLatencyMeasurement } from '../perf-client'
import { patchScene } from '../../hooks/use-scenes'
import type { Combatant, Scene, ColorGrade, ParticleType, AppMode, CombatState, Note, Item } from '@core/types'
import type { DisplayInfo } from '@shared/output-types'
import type { PlayerCharacter } from '@shared/player-types'
import type { SessionPhase } from '../../stores/player-store'

// Injected by vite.cockpit.config.ts only — undefined in Electron renderer.
// This is the only reliable way to detect browser dev mode; some npm deps
// polyfill `process` in the browser, making typeof-process checks unreliable.
declare const __COCKPIT_BROWSER_DEV__: boolean | undefined

// True when running in Vite browser dev server without Electron.
// The compile-time flag is set by vite.cockpit.config.ts. However, in dev mode
// the Electron cockpit window loads from the same Vite dev server (via Express
// redirect), so we also check for the absence of the Electron preload API.
const IS_BROWSER_DEV =
    typeof __COCKPIT_BROWSER_DEV__ !== 'undefined' && __COCKPIT_BROWSER_DEV__ === true
    && typeof window !== 'undefined' && !('electronAPI' in window)

export type SocketLike = {
    emit: (event: string, data?: unknown) => void
    on: (event: string, handler: (data: unknown) => void) => SocketLike
}

let socket: Socket | SocketLike | null = null

// Pending emit queue — events queued while socket is connecting, flushed on CONNECT
let _pendingEmits: Array<{ event: string; data: unknown }> = []

/**
 * Emit a socket event safely. If the socket exists but isn't connected yet,
 * queue the event and flush when the connection completes.
 */
export function safeEmit(event: string, data?: unknown): void {
    if (!socket) return
    // Real Socket.io sockets have a `connected` property
    if ('connected' in socket && !(socket as Socket).connected) {
        _pendingEmits.push({ event, data })
        return
    }
    socket.emit(event, data)
}

export function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: T) => {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), ms)
    }
}

/**
 * Shape of the full state sync payload from the server.
 * Must match ServerState in src/api/server.ts.
 */
interface StateSyncPayload {
    activeCampaignId: string | null
    activeCampaignName: string | null
    activeSceneId: string | null
    combatState: CombatState | null
    moodValue: number
    avState: {
        particles: { type: ParticleType; intensity: number }
        colorGrade: ColorGrade
        gbColorGrade: ColorGrade
    } | null
    appMode: AppMode
    // Sprint 11b: session state included when active
    sessionState?: {
        players: PlayerCharacter[]
        phase: SessionPhase
        sessionCode: string
    }
}

// Module-level server URL — stored when initSync is called so all internal
// fetch calls can use the correct absolute URL in browser dev mode.
let _serverUrl = ''

// Preview frame callback — registered by the PreviewPanel component.
// Null when no component is listening (avoids buffering unused frames).
export type PreviewFrameData = { frame: ArrayBuffer; ts: number; width: number; height: number }
type FrameCallback = (data: PreviewFrameData) => void
let _frameCallback: FrameCallback | null = null

// Guard flag to prevent bidirectional echo loop on COMBAT_SYNC.
// Set to true while applying a remotely-received combat update so the
// outbound subscription does not re-emit the same payload back to the server.
let _applyingRemoteCombatUpdate = false

// Note: no echo guard needed for notes — outbound note events use explicit
// helper functions (emitNoteCreate etc.) rather than reactive store subscriptions,
// so there is no risk of inbound updates re-triggering outbound emits.

/** Fetch a scene by ID from REST and set it as the active scene in the store. */
function fetchAndSetScene(sceneId: string): void {
    fetch(`${_serverUrl}/api/scenes/${sceneId}`)
        .then((r) => {
            if (!r.ok) return null
            return r.json() as Promise<Scene>
        })
        .then((scene) => {
            if (scene) useSceneStore.getState().setActiveScene(scene)
        })
        .catch((err: unknown) => {
            console.warn('[sync] scene fetch error:', err)
        })
}

/** Create a debounced function that persists a partial scene update to the DB. */
function persistToScene<T>(toPartial: (value: T) => Partial<Scene>, ms = 2000) {
    return debounce((value: T) => {
        const sceneId = useSceneStore.getState().activeScene?.id
        if (sceneId) {
            void patchScene(sceneId, toPartial(value))
                .then(() => useSceneStore.getState().setLastSavedAt(Date.now()))
                .catch(() => {})
        }
    }, ms)
}

export function initSync(serverUrl: string): void {
    _serverUrl = serverUrl

    if (IS_BROWSER_DEV) {
        socket = wsStub
        wsStub.connect()
        wsStub.emit(EVENTS.CLIENT_JOIN, { room: 'cockpit' })
        useAppStore.getState().setConnected(true)
    } else {
        const realSocket = io(serverUrl, { autoConnect: true })
        socket = realSocket

        realSocket.on(EVENTS.CONNECT, () => {
            realSocket.emit(EVENTS.CLIENT_JOIN, { room: 'cockpit' })
            useAppStore.getState().setConnected(true)
            startLatencyMeasurement(realSocket)

            // Flush any events queued while socket was connecting
            for (const pending of _pendingEmits) {
                realSocket.emit(pending.event, pending.data)
            }
            _pendingEmits = []

            // Emit current appMode — may have been set before initSync()
            // registered the subscription (LaunchScreen sets mode before socket connects)
            const currentMode = useAppStore.getState().appMode
            if (currentMode !== null) {
                realSocket.emit(EVENTS.APP_MODE_CHANGE, { mode: currentMode })
            }
        })

        realSocket.on(EVENTS.DISCONNECT, () => {
            useAppStore.getState().setConnected(false)
            stopLatencyMeasurement()
        })

        // Real-time preview frames from AV Display (Sprint 7b)
        realSocket.on(EVENTS.PREVIEW_FRAME, (data: unknown) => {
            _frameCallback?.(data as PreviewFrameData)
        })

        // ── Inbound: server → store patches (multi-client sync) ────────────────

        realSocket.on(EVENTS.COMBAT_SYNC, (data: unknown) => {
            const { combatants } = data as { combatants: Combatant[] }
            _applyingRemoteCombatUpdate = true
            useCombatStore.getState().setCombatants(combatants)
            _applyingRemoteCombatUpdate = false
        })

        realSocket.on(EVENTS.COMBAT_UPDATE, (data: unknown) => {
            const state = data as CombatState
            if (state.combatants !== undefined) {
                _applyingRemoteCombatUpdate = true
                useCombatStore.getState().setCombatants(state.combatants)
                _applyingRemoteCombatUpdate = false
            }
        })

        realSocket.on(EVENTS.SCENE_LOAD, (data: unknown) => {
            const { sceneId } = data as { sceneId: string }
            fetchAndSetScene(sceneId)
        })

        // ── Inbound: notes system (cockpit multi-client sync) ─────────────────
        realSocket.on(EVENTS.NOTE_CREATE, (data: unknown) => {
            const { note } = data as { note: Note }
            useNotesStore.getState().addNote(note)
        })

        realSocket.on(EVENTS.NOTE_UPDATE, (data: unknown) => {
            const { note } = data as { note: Note }
            useNotesStore.getState().updateNote(note.id, note)
        })

        realSocket.on(EVENTS.NOTE_DELETE, (data: unknown) => {
            const { noteId } = data as { noteId: string }
            useNotesStore.getState().removeNote(noteId)
        })

        realSocket.on(EVENTS.NOTE_LINK, (data: unknown) => {
            const { sceneId, noteId } = data as { sceneId: string; noteId: string }
            const links = useNotesStore.getState().sceneNoteLinks[sceneId] ?? []
            if (!links.includes(noteId)) {
                useNotesStore.getState().setSceneNoteLinks(sceneId, [...links, noteId])
            }
        })

        realSocket.on(EVENTS.NOTE_UNLINK, (data: unknown) => {
            const { sceneId, noteId } = data as { sceneId: string; noteId: string }
            const links = useNotesStore.getState().sceneNoteLinks[sceneId] ?? []
            useNotesStore.getState().setSceneNoteLinks(sceneId, links.filter((id) => id !== noteId))
        })

        realSocket.on(EVENTS.SCENE_SCRATCHPAD, (data: unknown) => {
            const { sceneId, scratchpad } = data as { sceneId: string; scratchpad: string }
            const activeScene = useSceneStore.getState().activeScene
            if (activeScene && activeScene.id === sceneId) {
                useSceneStore.getState().setActiveScene({ ...activeScene, scratchpad })
            }
        })

        // ── Inbound: items system (cockpit multi-client sync) ─────────────────
        realSocket.on(EVENTS.ITEM_CREATE, (data: unknown) => {
            const { item } = data as { item: Item }
            useItemsStore.getState().addItem(item)
        })

        realSocket.on(EVENTS.ITEM_UPDATE, (data: unknown) => {
            const { item } = data as { item: Item }
            useItemsStore.getState().updateItem(item.id, item)
        })

        realSocket.on(EVENTS.ITEM_DELETE, (data: unknown) => {
            const { itemId } = data as { itemId: string }
            useItemsStore.getState().removeItem(itemId)
        })

        // ── Sprint 9b: Output state sync across cockpit clients ─────────────
        realSocket.on(EVENTS.OUTPUT_STATE, (data: unknown) => {
            const { role, enabled, displayId } = data as {
                role: 'BG' | 'GB'
                enabled: boolean
                displayId?: number | 'windowed'
            }
            const { enableOutput, disableOutput } = useOutputStore.getState()
            if (enabled && displayId !== undefined) {
                enableOutput(displayId, role)
            } else {
                disableOutput(role)
            }
        })

        // Display hot-plug: Electron main process detected a display change
        realSocket.on(EVENTS.OUTPUT_DISPLAYS_CHANGED, (data: unknown) => {
            const { displays } = data as { displays: DisplayInfo[] }
            useOutputStore.getState().setDisplays(displays)
        })

        // ── Sprint 11b: Player/session state from server ────────────────────────
        realSocket.on(EVENTS.LOBBY_STATE, (data: unknown) => {
            const { players, phase, sessionCode } = data as {
                players: PlayerCharacter[]
                phase: SessionPhase
                sessionCode: string
            }
            usePlayerStore.getState().setPlayers(players)
            usePlayerStore.getState().setSessionPhase(phase)
            usePlayerStore.getState().setSessionCode(sessionCode)
        })

        // ── Sprint 4-D: full state sync on reconnect ───────────────────────────
        realSocket.on(EVENTS.STATE_SYNC, (data: unknown) => {
            const state = data as StateSyncPayload

            if (state.appMode) {
                useAppStore.getState().setAppMode(state.appMode)
            }

            if (state.moodValue !== undefined) {
                useMoodStore.getState().setValue(state.moodValue)
            }

            if (state.combatState) {
                _applyingRemoteCombatUpdate = true
                useCombatStore.getState().setCombatants(state.combatState.combatants)
                _applyingRemoteCombatUpdate = false
            }

            if (state.avState) {
                useAVStore.getState().setParticles(
                    state.avState.particles.type,
                    state.avState.particles.intensity,
                )
                useAVStore.getState().setColorGrade(state.avState.colorGrade)
                if (state.avState.gbColorGrade) {
                    useAVStore.getState().setGBColorGrade(state.avState.gbColorGrade)
                }
            }

            // MF-4: restore active campaign on reconnect
            if (state.activeCampaignId && state.activeCampaignName) {
                useAppStore.getState().setActiveCampaign(state.activeCampaignId, state.activeCampaignName)
            }

            if (state.activeSceneId) {
                fetchAndSetScene(state.activeSceneId)
            }

            // Sprint 11b: restore session state on reconnect
            if (state.sessionState) {
                usePlayerStore.getState().setPlayers(state.sessionState.players)
                usePlayerStore.getState().setSessionPhase(state.sessionState.phase as SessionPhase)
                usePlayerStore.getState().setSessionCode(state.sessionState.sessionCode)
            }
        })
    }

    // ── Outbound: store changes → socket (works for both real and stub) ──────

    useCombatStore.subscribe(
        (s) => s.combatants,
        (combatants) => {
            // SI-1: skip re-emitting when this update originated from the server
            if (_applyingRemoteCombatUpdate) return
            socket?.emit(EVENTS.COMBAT_SYNC, { combatants })
        }
    )

    useMoodStore.subscribe(
        (s) => s.value,
        debounce((value) => socket?.emit(EVENTS.MOOD_UPDATE, { value }), 50)
    )

    // Persist mood slider to scene DB (longer debounce for writes)
    useMoodStore.subscribe((s) => s.value, persistToScene((value: number) => ({ audioMood: value })))

    // Sprint 17c: Volume faders → AV Display
    useMoodStore.subscribe(
        (s) => s.masterVolume,
        debounce((volume) => socket?.emit(EVENTS.MASTER_VOLUME, { volume }), 50)
    )

    useMoodStore.subscribe(
        (s) => s.ambienceVolume,
        debounce((volume) => socket?.emit(EVENTS.AMBIENCE_VOLUME, { volume }), 50)
    )

    useMoodStore.subscribe(
        (s) => s.musicVolume,
        debounce((volume) => socket?.emit(EVENTS.MUSIC_VOLUME, { volume }), 50)
    )

    useMoodStore.subscribe(
        (s) => s.sfxVolume,
        debounce((volume) => socket?.emit(EVENTS.SFX_VOLUME, { volume }), 50)
    )

    useMoodStore.subscribe(
        (s) => s.bgVideoVolume,
        debounce((volume) => socket?.emit(EVENTS.BG_VIDEO_VOLUME, { volume }), 50)
    )

    useMoodStore.subscribe(
        (s) => s.gbVideoVolume,
        debounce((volume) => socket?.emit(EVENTS.GB_VIDEO_VOLUME, { volume }), 50)
    )

    // SI-2: only emit SCENE_LOAD when the scene ID changes, not on every property update.
    // This prevents notes auto-save from triggering a full AV scene reload.
    // Also restores persisted AV state (particles, colorGrade, mood) from the new scene.
    useSceneStore.subscribe(
        (s) => s.activeScene?.id,
        (newId, prevId) => {
            if (!newId || newId === prevId) return
            socket?.emit(EVENTS.SCENE_LOAD, { sceneId: newId })

            // Restore AV state from the newly loaded scene
            const scene = useSceneStore.getState().activeScene
            if (!scene) return

            const av = useAVStore.getState()
            if (scene.particles) {
                av.setParticles(scene.particles.type, scene.particles.intensity)
            } else {
                av.setParticles('none', 0)
            }

            if (scene.colorGrade) av.setColorGrade(scene.colorGrade)
            if (scene.gbColorGrade) av.setGBColorGrade(scene.gbColorGrade)
            if (scene.audioMood !== undefined) useMoodStore.getState().setValue(scene.audioMood)
        }
    )

    // Sprint 18c: Emit SCENE_CUE when cuedScene changes so AV Display can preload media.
    useSceneStore.subscribe(
        (s) => s.cuedScene?.id,
        (newId, prevId) => {
            if (!newId || newId === prevId) return
            socket?.emit(EVENTS.SCENE_CUE, { sceneId: newId })
        }
    )

    useAVStore.subscribe(
        (s) => s.particles,
        (particles) => socket?.emit(EVENTS.AV_PARTICLES, particles)
    )

    useAVStore.subscribe(
        (s) => s.colorGrade,
        debounce((colorGrade) => socket?.emit(EVENTS.AV_COLORGRADE, { target: 'BG', ...colorGrade }), 50)
    )

    useAVStore.subscribe(
        (s) => s.gbColorGrade,
        debounce((gbColorGrade) => socket?.emit(EVENTS.AV_COLORGRADE, { target: 'GB', ...gbColorGrade }), 50)
    )

    // ── Persist AV state to scene DB (debounced, longer than socket emit) ────
    // Save particles, colorGrade, gbColorGrade to the active scene so they
    // survive app restart. Uses a 2s debounce to avoid hammering DB on slider drags.

    useAVStore.subscribe((s) => s.particles, persistToScene((particles) => ({ particles })))
    useAVStore.subscribe((s) => s.colorGrade, persistToScene((colorGrade) => ({ colorGrade })))
    useAVStore.subscribe((s) => s.gbColorGrade, persistToScene((gbColorGrade) => ({ gbColorGrade })))

    useAppStore.subscribe(
        (s) => s.appMode,
        (mode) => {
            // appMode can be null before launch screen selection (Sprint 9a).
            // The server's AppConfig.appMode is non-nullable — never emit null.
            // Use safeEmit to queue if socket is still connecting (race condition fix).
            if (mode !== null) safeEmit(EVENTS.APP_MODE_CHANGE, { mode })
        }
    )
}

export function getSocket(): Socket | SocketLike | null {
    return socket
}

/**
 * Returns the server base URL set during initSync().
 * Use this to prefix REST fetch calls so they work in both browser dev mode
 * (Vite on :5173 fetching Express on :3000) and Electron (same origin).
 */
export function getServerUrl(): string {
    return _serverUrl
}

/**
 * Register or clear a callback for incoming preview frames.
 * The PreviewPanel component calls this on mount/unmount.
 * Pass null to unsubscribe (prevents buffering unused frames).
 */
export function onPreviewFrame(cb: FrameCallback | null): void {
    _frameCallback = cb
}
