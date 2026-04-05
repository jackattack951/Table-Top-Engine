/**
 * Player & session socket event handlers.
 * Extracted from server.ts to keep it under 1000 lines.
 * Called inside io.on('connection') for each new socket.
 */
import { randomUUID } from 'crypto'
import type { Server, Socket } from 'socket.io'
import { EVENTS } from '../../shared/socket-events'
import type { SessionState, PlayerCharacter } from '../../shared/player-types'
import { MAX_PLAYERS } from '../../shared/player-types'

/** Payload sent by the companion join form. */
interface JoinPayload {
    sessionCode: string
    playerName: string
    characterName: string
    class: string
    level: number
    hp: number
    maxHp: number
    ac: number
    abilities: {
        STR: number
        DEX: number
        CON: number
        INT: number
        WIS: number
        CHA: number
    }
}

/** Broadcast current lobby state to all cockpit clients. */
function emitLobbyState(io: Server, sessionState: SessionState): void {
    io.to('cockpit').emit(EVENTS.LOBBY_STATE, {
        players: Object.values(sessionState.players),
        phase: sessionState.phase,
        sessionCode: sessionState.sessionCode,
    })
}

export function registerPlayerHandlers(
    io: Server,
    socket: Socket,
    getSessionState: () => SessionState | null,
    setSessionState: (state: SessionState | null) => void,
    tokenToSocket: Map<string, string>,
    socketToToken: Map<string, string>,
): void {
    // ── Player join ─────────────────────────────────────────────────────────────

    socket.on(EVENTS.PLAYER_JOIN, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState) {
            socket.emit(EVENTS.PLAYER_SESSION_EXPIRED)
            return
        }

        if (!data) return
        const payload = data as JoinPayload

        // Validate session code
        if (payload.sessionCode !== sessionState.sessionCode) {
            socket.emit(EVENTS.PLAYER_SESSION_EXPIRED)
            return
        }

        // Enforce max player limit
        if (Object.keys(sessionState.players).length >= MAX_PLAYERS) {
            socket.emit(EVENTS.PLAYER_JOIN_REJECTED, { reason: 'Session is full' })
            return
        }

        // Validate required fields
        if (!payload.playerName || !payload.characterName) {
            socket.emit(EVENTS.PLAYER_JOIN_REJECTED, { reason: 'Missing required fields' })
            return
        }

        // Generate token and create player state
        const token = randomUUID()
        const player: PlayerCharacter = {
            token,
            socketId: socket.id,
            playerName: payload.playerName,
            characterName: payload.characterName,
            class: payload.class || 'Fighter',
            level: payload.level || 1,
            hpCurrent: payload.hp || 10,
            hpMax: payload.maxHp || 10,
            ac: payload.ac || 10,
            abilities: payload.abilities || {
                STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10,
            },
            conditions: [],
            inventory: [],
            currency: { gold: 0, silver: 0, copper: 0 },
            whispers: [],
            messages: [],
            status: 'pending',
            connected: true,
            handRaised: false,
        }

        // Store player and socket mappings
        sessionState.players[token] = player
        tokenToSocket.set(token, socket.id)
        socketToToken.set(socket.id, token)

        // Send token to player
        socket.emit(EVENTS.PLAYER_TOKEN, { token })
        // Send full state to player
        socket.emit(EVENTS.PLAYER_STATE, player)
        // Notify cockpit
        emitLobbyState(io, sessionState)

    })

    // ── Lobby management (DM actions) ───────────────────────────────────────────

    socket.on(EVENTS.LOBBY_APPROVE, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) return
        const { token } = data as { token: string }
        const player = sessionState.players[token]
        if (!player) return

        player.status = 'approved'
        // Push updated state to the player
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_STATE, player)
        }
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.LOBBY_KICK, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) return
        const { token } = data as { token: string }
        const player = sessionState.players[token]
        if (!player) return

        player.status = 'kicked'
        // Notify the kicked player
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_STATE, player)
        }
        // Remove from session
        delete sessionState.players[token]
        tokenToSocket.delete(token)
        socketToToken.delete(player.socketId)
        emitLobbyState(io, sessionState)
    })

    // ── Ready check ─────────────────────────────────────────────────────────────

    socket.on(EVENTS.LOBBY_READY_CHECK, () => {
        const sessionState = getSessionState()
        if (!sessionState) return

        sessionState.phase = 'ready-check'
        io.to('player').emit(EVENTS.LOBBY_READY_CHECK)
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.LOBBY_READY_CONFIRM, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) return
        const { token } = data as { token: string }
        const player = sessionState.players[token]
        if (!player || player.status !== 'approved') return

        player.status = 'ready'
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_STATE, player)
        }
        emitLobbyState(io, sessionState)
    })

    // ── Session lifecycle ───────────────────────────────────────────────────────

    socket.on(EVENTS.SESSION_GO_LIVE, () => {
        const sessionState = getSessionState()
        if (!sessionState) return

        sessionState.phase = 'live'
        // Set all approved/ready players to 'live'
        for (const player of Object.values(sessionState.players)) {
            if (player.status === 'approved' || player.status === 'ready') {
                player.status = 'live'
            }
        }
        io.to('player').emit(EVENTS.SESSION_STARTED)
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.SESSION_END, () => {
        const sessionState = getSessionState()
        if (!sessionState) return

        sessionState.phase = 'ended'
        io.to('player').emit(EVENTS.SESSION_ENDED)
        io.to('cockpit').emit(EVENTS.LOBBY_STATE, {
            players: [],
            phase: 'ended',
            sessionCode: '',
        })
        // Cleanup
        tokenToSocket.clear()
        socketToToken.clear()
        setSessionState(null)
    })

    // ── DM → Player actions (stubs — full implementation in 11c) ────────────────

    socket.on(EVENTS.DM_ADJUST_HP, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) { console.warn('[player] DM_ADJUST_HP: no session or data'); return }
        const { token, amount } = data as { token: string; amount: number }
        if (typeof token !== 'string' || typeof amount !== 'number' || !Number.isFinite(amount)) {
            console.warn('[player] DM_ADJUST_HP: invalid token/amount', { token, amount }); return
        }
        const player = sessionState.players[token]
        if (!player) { console.warn('[player] DM_ADJUST_HP: player not found', token); return }

        player.hpCurrent = Math.max(0, Math.min(player.hpMax, player.hpCurrent + amount))
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_HP_UPDATE, {
                current: player.hpCurrent,
                max: player.hpMax,
            })
        }
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.DM_ADD_CONDITION, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) { console.warn('[player] DM_ADD_CONDITION: no session or data'); return }
        const { token, condition } = data as { token: string; condition: string }
        const player = sessionState.players[token]
        if (!player) { console.warn('[player] DM_ADD_CONDITION: player not found', token); return }

        if (!player.conditions.includes(condition)) {
            player.conditions.push(condition)
        }
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_CONDITION_ADD, { condition })
        }
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.DM_REMOVE_CONDITION, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) { console.warn('[player] DM_REMOVE_CONDITION: no session or data'); return }
        const { token, condition } = data as { token: string; condition: string }
        const player = sessionState.players[token]
        if (!player) { console.warn('[player] DM_REMOVE_CONDITION: player not found', token); return }

        player.conditions = player.conditions.filter((c) => c !== condition)
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_CONDITION_REMOVE, { condition })
        }
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.DM_SEND_ITEM, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) { console.warn('[player] DM_SEND_ITEM: no session or data'); return }
        const { token, item } = data as { token: string; item: { id: string; name: string; quantity: number; description: string } }
        const player = sessionState.players[token]
        if (!player) { console.warn('[player] DM_SEND_ITEM: player not found', token); return }

        player.inventory.push(item)
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_ITEM_ADD, item)
        }
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.DM_REMOVE_ITEM, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) { console.warn('[player] DM_REMOVE_ITEM: no session or data'); return }
        const { token, itemId } = data as { token: string; itemId: string }
        const player = sessionState.players[token]
        if (!player) { console.warn('[player] DM_REMOVE_ITEM: player not found', token); return }

        player.inventory = player.inventory.filter((i) => i.id !== itemId)
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_ITEM_REMOVE, { id: itemId })
        }
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.DM_UPDATE_CURRENCY, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) { console.warn('[player] DM_UPDATE_CURRENCY: no session or data'); return }
        const { token, currency } = data as { token: string; currency: Record<string, unknown> }
        if (typeof token !== 'string' || !currency || typeof currency !== 'object') {
            console.warn('[player] DM_UPDATE_CURRENCY: invalid token/currency', data); return
        }
        const { gold, silver, copper } = currency as Record<string, unknown>
        if (typeof gold !== 'number' || typeof silver !== 'number' || typeof copper !== 'number') {
            console.warn('[player] DM_UPDATE_CURRENCY: invalid currency values', currency); return
        }
        if (!Number.isFinite(gold) || !Number.isFinite(silver) || !Number.isFinite(copper)) {
            console.warn('[player] DM_UPDATE_CURRENCY: non-finite currency values', currency); return
        }
        const player = sessionState.players[token]
        if (!player) { console.warn('[player] DM_UPDATE_CURRENCY: player not found', token); return }

        player.currency = { gold: Math.max(0, Math.floor(gold)), silver: Math.max(0, Math.floor(silver)), copper: Math.max(0, Math.floor(copper)) }
        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_CURRENCY_UPDATE, currency)
        }
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.DM_WHISPER, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) { console.warn('[player] DM_WHISPER: no session or data'); return }
        const { tokens, message } = data as { tokens: string[]; message: string }

        const whisper = {
            id: randomUUID(),
            message,
            timestamp: Date.now(),
            read: false,
        }

        for (const token of tokens) {
            const player = sessionState.players[token]
            if (!player) continue
            player.whispers.push(whisper)
            const playerSocketId = tokenToSocket.get(token)
            if (playerSocketId) {
                io.to(playerSocketId).emit(EVENTS.PLAYER_WHISPER, whisper)
            }
        }
        emitLobbyState(io, sessionState)
    })

    socket.on(EVENTS.DM_BROADCAST, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) { console.warn('[player] DM_BROADCAST: no session or data'); return }
        const { type, content } = data as { type: string; content: string }
        io.to('player').emit(EVENTS.PLAYER_BROADCAST, { type, content })
    })

    // ── Sprint 21a: Player → DM messaging + raise hand ──────────────────────────

    socket.on(EVENTS.PLAYER_SEND_MESSAGE, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) return
        const { message } = data as { message: string }
        if (typeof message !== 'string' || !message.trim()) return

        const token = socketToToken.get(socket.id)
        if (!token) return
        const player = sessionState.players[token]
        if (!player) return

        const msg = {
            id: randomUUID(),
            message: message.trim(),
            timestamp: Date.now(),
            fromDM: false,
            read: false,
        }
        player.messages.push(msg)

        io.to('cockpit').emit(EVENTS.DM_PLAYER_MESSAGE, {
            token,
            playerName: player.playerName,
            characterName: player.characterName,
            ...msg,
        })
    })

    socket.on(EVENTS.PLAYER_RAISE_HAND, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState) return
        const { raised } = (data as { raised: boolean }) ?? { raised: false }

        const token = socketToToken.get(socket.id)
        if (!token) return
        const player = sessionState.players[token]
        if (!player) return

        player.handRaised = Boolean(raised)
        io.to('cockpit').emit(EVENTS.DM_HAND_UPDATE, { token, raised: player.handRaised })
    })

    // ── Sprint 21b: Roll prompt system ──────────────────────────────────────────

    socket.on(EVENTS.ROLL_PROMPT_SEND, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) return
        const { tokens, die, label, countdown } = data as {
            tokens: string[]; die: string; label: string; countdown: number
        }
        if (!Array.isArray(tokens) || !die || !label) return

        const prompt = {
            id: randomUUID(),
            die,
            label,
            countdown: typeof countdown === 'number' && countdown >= 0 ? countdown : 0,
            timestamp: Date.now(),
            tokens,
        }
        sessionState.rollPrompts[prompt.id] = prompt

        for (const token of tokens) {
            const playerSocketId = tokenToSocket.get(token)
            if (playerSocketId) {
                io.to(playerSocketId).emit(EVENTS.PLAYER_ROLL_PROMPT, {
                    id: prompt.id,
                    die: prompt.die,
                    label: prompt.label,
                    countdown: prompt.countdown,
                    timestamp: prompt.timestamp,
                })
            }
        }

        // Notify cockpit of the active prompt ID so it can track results
        io.to('cockpit').emit(EVENTS.ROLL_PROMPT_ACTIVE, { promptId: prompt.id })
    })

    socket.on(EVENTS.ROLL_RESULT_SUBMIT, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) return
        const { promptId, result } = data as { promptId: string; result: number }
        if (typeof result !== 'number' || !Number.isFinite(result)) return

        const token = socketToToken.get(socket.id)
        if (!token) return
        const player = sessionState.players[token]
        if (!player) return

        const prompt = sessionState.rollPrompts[promptId]
        if (!prompt) return

        io.to('cockpit').emit(EVENTS.DM_ROLL_RESULT, {
            promptId,
            token,
            playerName: player.playerName,
            characterName: player.characterName,
            die: prompt.die,
            label: prompt.label,
            result,
            timestamp: Date.now(),
        })
    })

    socket.on(EVENTS.ROLL_PROMPT_CANCEL, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) return
        const { promptId } = data as { promptId: string }
        const prompt = sessionState.rollPrompts[promptId]
        if (!prompt) return

        delete sessionState.rollPrompts[promptId]

        for (const token of prompt.tokens) {
            const playerSocketId = tokenToSocket.get(token)
            if (playerSocketId) {
                io.to(playerSocketId).emit(EVENTS.PLAYER_ROLL_PROMPT_CANCEL, { promptId })
            }
        }
    })

    socket.on(EVENTS.DM_REPLY_TO_PLAYER, (data: unknown) => {
        const sessionState = getSessionState()
        if (!sessionState || !data) return
        const { token, message } = data as { token: string; message: string }
        if (typeof message !== 'string' || !message.trim()) return

        const player = sessionState.players[token]
        if (!player) return

        const msg = {
            id: randomUUID(),
            message: message.trim(),
            timestamp: Date.now(),
            fromDM: true,
            read: false,
        }
        player.messages.push(msg)

        const playerSocketId = tokenToSocket.get(token)
        if (playerSocketId) {
            io.to(playerSocketId).emit(EVENTS.PLAYER_DM_REPLY, msg)
        }
        emitLobbyState(io, sessionState)
    })
}
