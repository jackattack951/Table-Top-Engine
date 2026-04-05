/**
 * Companion Socket.io sync layer.
 * Connects to the server as a player, handles events, updates companion-store.
 *
 * In browser dev mode (npm run dev:companion), uses companion-ws-stub.
 * In production (served by Express on :8080), uses real Socket.io.
 */
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { EVENTS } from '@shared/socket-events'
import type { PlayerCharacter, PlayerMessage, RollPrompt } from '@shared/player-types'
import { useCompanionStore } from '../stores/companion-store'
import { companionWsStub } from './companion-ws-stub'

// Compile-time flags injected by vite.companion.config.ts
declare const __COMPANION_BROWSER_DEV__: boolean | undefined
declare const __COMPANION_SERVER_URL__: string | undefined

const IS_BROWSER_DEV =
    typeof __COMPANION_BROWSER_DEV__ !== 'undefined' && __COMPANION_BROWSER_DEV__ === true
    && typeof window !== 'undefined' && !('electronAPI' in window)

const TOKEN_STORAGE_KEY = 'companion-session-token'
const SESSION_CODE_STORAGE_KEY = 'companion-session-code'

type SocketLike = {
    emit: (event: string, data?: unknown) => void
    on: (event: string, handler: (data: unknown) => void) => SocketLike
    off?: (event: string, handler: (data: unknown) => void) => SocketLike
    get id(): string
}

let socket: Socket | SocketLike | null = null

/** Get saved token from localStorage. */
export function getSavedToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_STORAGE_KEY)
    } catch {
        return null
    }
}

/** Get saved session code from localStorage. */
export function getSavedSessionCode(): string | null {
    try {
        return localStorage.getItem(SESSION_CODE_STORAGE_KEY)
    } catch {
        return null
    }
}

/** Save token and session code to localStorage. */
function saveCredentials(token: string, sessionCode: string): void {
    try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token)
        localStorage.setItem(SESSION_CODE_STORAGE_KEY, sessionCode)
    } catch {
        // localStorage unavailable (private browsing) — continue without persistence
    }
}

/** Clear saved credentials. */
function clearCredentials(): void {
    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(SESSION_CODE_STORAGE_KEY)
    } catch {
        // noop
    }
}

/**
 * Initialize the companion socket connection.
 * Call once on app boot or when reconnecting.
 */
export function initCompanionSync(sessionCode: string): void {
    // Disconnect any existing socket to prevent zombie connections on re-init
    if (socket && 'disconnect' in socket) {
        (socket as Socket).disconnect()
    }
    socket = null

    const store = useCompanionStore.getState()
    store.setSessionCode(sessionCode)

    if (IS_BROWSER_DEV) {
        socket = companionWsStub as unknown as SocketLike
        companionWsStub.connect()
        companionWsStub.emit(EVENTS.CLIENT_JOIN, {
            room: 'player',
            sessionCode,
            token: getSavedToken(),
        })
        store.setConnected(true)
    } else {
        const serverUrl = typeof __COMPANION_SERVER_URL__ !== 'undefined' && __COMPANION_SERVER_URL__
            ? __COMPANION_SERVER_URL__
            : window.location.origin

        const realSocket = io(serverUrl, {
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        })
        socket = realSocket

        realSocket.on(EVENTS.CONNECT, () => {
            store.setConnected(true)
            // Emit CLIENT_JOIN with session code + saved token for reconnect
            realSocket.emit(EVENTS.CLIENT_JOIN, {
                room: 'player',
                sessionCode,
                token: getSavedToken(),
            })
        })

        realSocket.on(EVENTS.DISCONNECT, () => {
            store.setConnected(false)
        })
    }

    // ── Event listeners (work for both real and stub) ────────────────────────

    // Server assigned a token after successful join
    socket!.on(EVENTS.PLAYER_TOKEN, (data: unknown) => {
        const { token } = data as { token: string }
        const { sessionCode: code } = useCompanionStore.getState()
        store.setToken(token)
        if (code) saveCredentials(token, code)
        store.setPhase('lobby')
        store.setLoading(false)
        store.setError(null)
    })

    // Full player state sync (on join or reconnect)
    socket!.on(EVENTS.PLAYER_STATE, (data: unknown) => {
        const player = data as PlayerCharacter
        store.setPlayerData(player)

        // Determine phase from player status
        if (player.status === 'kicked') {
            store.setPhase('expired')
            clearCredentials()
        } else if (player.status === 'live') {
            store.setPhase('dashboard')
        } else {
            // pending, approved, ready → lobby
            store.setPhase('lobby')
        }
        store.setLoading(false)
    })

    // Session expired or invalid code
    socket!.on(EVENTS.PLAYER_SESSION_EXPIRED, () => {
        store.setPhase('expired')
        store.setError('Session not found or expired')
        store.setLoading(false)
        clearCredentials()
    })

    // Join rejected (full session, missing fields, etc.)
    socket!.on(EVENTS.PLAYER_JOIN_REJECTED, (data: unknown) => {
        const { reason } = data as { reason: string }
        store.setError(reason)
        store.setLoading(false)
    })

    // Ready check initiated by DM — dispatch custom event for lobby screen
    socket!.on(EVENTS.LOBBY_READY_CHECK, () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('companion:readyCheck'))
        }
    })

    // Session went live
    socket!.on(EVENTS.SESSION_STARTED, () => {
        store.setPhase('dashboard')
    })

    // Session ended
    socket!.on(EVENTS.SESSION_ENDED, () => {
        store.setPhase('ended')
        clearCredentials()
    })

    // ── DM push events (update local player state) ──────────────────────────

    socket!.on(EVENTS.PLAYER_HP_UPDATE, (data: unknown) => {
        const { current, max } = data as { current: number; max: number }
        store.setPlayerData({ hpCurrent: current, hpMax: max })
    })

    socket!.on(EVENTS.PLAYER_CONDITION_ADD, (data: unknown) => {
        const { condition } = data as { condition: string }
        const current = useCompanionStore.getState().conditions
        if (!current.includes(condition)) {
            store.setPlayerData({ conditions: [...current, condition] })
        }
    })

    socket!.on(EVENTS.PLAYER_CONDITION_REMOVE, (data: unknown) => {
        const { condition } = data as { condition: string }
        const current = useCompanionStore.getState().conditions
        store.setPlayerData({ conditions: current.filter((c) => c !== condition) })
    })

    socket!.on(EVENTS.PLAYER_ITEM_ADD, (data: unknown) => {
        const item = data as PlayerCharacter['inventory'][number]
        const current = useCompanionStore.getState().inventory
        store.setPlayerData({ inventory: [...current, item] })
    })

    socket!.on(EVENTS.PLAYER_ITEM_REMOVE, (data: unknown) => {
        const { id } = data as { id: string }
        const current = useCompanionStore.getState().inventory
        store.setPlayerData({ inventory: current.filter((i) => i.id !== id) })
    })

    socket!.on(EVENTS.PLAYER_CURRENCY_UPDATE, (data: unknown) => {
        const currency = data as { gold: number; silver: number; copper: number }
        store.setPlayerData({ currency })
    })

    socket!.on(EVENTS.PLAYER_WHISPER, (data: unknown) => {
        const whisper = data as PlayerCharacter['whispers'][number]
        const current = useCompanionStore.getState().whispers
        store.setPlayerData({ whispers: [...current, whisper] })
    })

    socket!.on(EVENTS.PLAYER_DM_REPLY, (data: unknown) => {
        const msg = data as PlayerMessage
        store.addMessage(msg)
    })

    socket!.on(EVENTS.PLAYER_ROLL_PROMPT, (data: unknown) => {
        const prompt = data as RollPrompt
        store.setRollPrompt(prompt)
    })

    socket!.on(EVENTS.PLAYER_ROLL_PROMPT_CANCEL, (data: unknown) => {
        const { promptId } = data as { promptId: string }
        const current = useCompanionStore.getState().activeRollPrompt
        if (current?.id === promptId) {
            store.setRollPrompt(null)
        }
    })
}

/**
 * Emit an event to the server.
 * Components call this instead of accessing the socket directly.
 */
export function companionEmit(event: string, data?: unknown): void {
    if (!socket) {
        console.warn('[companion-sync] emit called before init')
        return
    }
    socket.emit(event, data)
}

/** Get the current socket instance. */
export function getCompanionSocket(): Socket | SocketLike | null {
    return socket
}
