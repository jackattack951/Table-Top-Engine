/**
 * Tests for Sprint 21a player handler additions:
 * - PLAYER_SEND_MESSAGE: player sends message to DM
 * - PLAYER_RAISE_HAND: player raises/lowers hand
 * - DM_REPLY_TO_PLAYER: DM replies to a specific player
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerPlayerHandlers } from './player-handlers'
import { EVENTS } from '../../shared/socket-events'
import type { SessionState } from '../../shared/player-types'

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeSocket(id: string) {
    const handlers: Record<string, (data: unknown) => void> = {}
    return {
        id,
        emit: vi.fn(),
        on: (event: string, handler: (data: unknown) => void) => {
            handlers[event] = handler
        },
        trigger: (event: string, data: unknown) => handlers[event]?.(data),
    }
}

function makeIO() {
    const rooms: Record<string, { emit: ReturnType<typeof vi.fn> }> = {}
    return {
        to: (room: string) => {
            rooms[room] ??= { emit: vi.fn() }
            return rooms[room]
        },
        rooms,
    }
}

function makePlayer(token: string, socketId: string) {
    return {
        token,
        socketId,
        playerName: 'Alice',
        characterName: 'Aldric',
        class: 'Fighter',
        level: 1,
        hpCurrent: 10,
        hpMax: 10,
        ac: 10,
        abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        conditions: [],
        inventory: [],
        currency: { gold: 0, silver: 0, copper: 0 },
        whispers: [],
        messages: [],
        status: 'live' as const,
        connected: true,
        handRaised: false,
    }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Sprint 21a: player messaging and raise hand', () => {
    let io: ReturnType<typeof makeIO>
    let socket: ReturnType<typeof makeSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    const TOKEN = 'token-alice'
    const SOCKET_ID = 'socket-alice'

    beforeEach(() => {
        io = makeIO()
        socket = makeSocket(SOCKET_ID)
        const player = makePlayer(TOKEN, SOCKET_ID)
        sessionState = {
            sessionCode: 'ABC123',
            players: { [TOKEN]: player },
            phase: 'live',
        }
        tokenToSocket = new Map([[TOKEN, SOCKET_ID]])
        socketToToken = new Map([[SOCKET_ID, TOKEN]])

        registerPlayerHandlers(
            io as unknown as import('socket.io').Server,
            socket as unknown as import('socket.io').Socket,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )
    })

    // ── PLAYER_SEND_MESSAGE ───────────────────────────────────────────────────

    it('relays player message to cockpit room', () => {
        socket.trigger(EVENTS.PLAYER_SEND_MESSAGE, { message: 'Hello DM!' })

        const cockpitEmit = io.rooms['cockpit']?.emit
        expect(cockpitEmit).toHaveBeenCalledWith(
            EVENTS.DM_PLAYER_MESSAGE,
            expect.objectContaining({
                token: TOKEN,
                playerName: 'Alice',
                characterName: 'Aldric',
                message: 'Hello DM!',
                fromDM: false,
            }),
        )
    })

    it('stores message on player state', () => {
        socket.trigger(EVENTS.PLAYER_SEND_MESSAGE, { message: 'Test msg' })

        const msgs = sessionState!.players[TOKEN].messages
        expect(msgs).toHaveLength(1)
        expect(msgs[0].message).toBe('Test msg')
        expect(msgs[0].fromDM).toBe(false)
    })

    it('trims whitespace from player message', () => {
        socket.trigger(EVENTS.PLAYER_SEND_MESSAGE, { message: '  Hi there  ' })

        const msgs = sessionState!.players[TOKEN].messages
        expect(msgs[0].message).toBe('Hi there')
    })

    it('ignores empty player message', () => {
        socket.trigger(EVENTS.PLAYER_SEND_MESSAGE, { message: '   ' })

        expect(sessionState!.players[TOKEN].messages).toHaveLength(0)
    })

    // ── PLAYER_RAISE_HAND ─────────────────────────────────────────────────────

    it('sets handRaised on player and notifies cockpit', () => {
        socket.trigger(EVENTS.PLAYER_RAISE_HAND, { raised: true })

        expect(sessionState!.players[TOKEN].handRaised).toBe(true)
        expect(io.rooms['cockpit']?.emit).toHaveBeenCalledWith(
            EVENTS.DM_HAND_UPDATE,
            { token: TOKEN, raised: true },
        )
    })

    it('lowers hand and notifies cockpit', () => {
        sessionState!.players[TOKEN].handRaised = true
        socket.trigger(EVENTS.PLAYER_RAISE_HAND, { raised: false })

        expect(sessionState!.players[TOKEN].handRaised).toBe(false)
        expect(io.rooms['cockpit']?.emit).toHaveBeenCalledWith(
            EVENTS.DM_HAND_UPDATE,
            { token: TOKEN, raised: false },
        )
    })

    // ── DM_REPLY_TO_PLAYER ────────────────────────────────────────────────────

    it('sends DM reply to specific player socket', () => {
        socket.trigger(EVENTS.DM_REPLY_TO_PLAYER, { token: TOKEN, message: 'Hello player!' })

        const playerSocketEmit = io.to(SOCKET_ID).emit
        expect(playerSocketEmit).toHaveBeenCalledWith(
            EVENTS.PLAYER_DM_REPLY,
            expect.objectContaining({
                message: 'Hello player!',
                fromDM: true,
            }),
        )
    })

    it('stores DM reply on player messages', () => {
        socket.trigger(EVENTS.DM_REPLY_TO_PLAYER, { token: TOKEN, message: 'Noted!' })

        const msgs = sessionState!.players[TOKEN].messages
        expect(msgs).toHaveLength(1)
        expect(msgs[0].fromDM).toBe(true)
        expect(msgs[0].message).toBe('Noted!')
    })

    it('ignores DM reply with empty message', () => {
        socket.trigger(EVENTS.DM_REPLY_TO_PLAYER, { token: TOKEN, message: '' })

        expect(sessionState!.players[TOKEN].messages).toHaveLength(0)
    })

    it('ignores DM reply for unknown token', () => {
        socket.trigger(EVENTS.DM_REPLY_TO_PLAYER, { token: 'unknown-token', message: 'Hi' })

        expect(sessionState!.players[TOKEN].messages).toHaveLength(0)
    })
})

describe('Sprint 21a: PlayerCharacter has messages and handRaised fields', () => {
    it('new player starts with empty messages array and handRaised=false', () => {
        const io = makeIO()
        const socket = makeSocket('new-socket')
        const sessionState: SessionState = {
            sessionCode: 'XYZ999',
            players: {},
            phase: 'lobby',
        }
        const tokenToSocket = new Map<string, string>()
        const socketToToken = new Map<string, string>()

        registerPlayerHandlers(
            io as unknown as import('socket.io').Server,
            socket as unknown as import('socket.io').Socket,
            () => sessionState,
            () => {},
            tokenToSocket,
            socketToToken,
        )

        socket.trigger(EVENTS.PLAYER_JOIN, {
            sessionCode: 'XYZ999',
            playerName: 'Bob',
            characterName: 'Borin',
            class: 'Cleric',
            level: 3,
            hp: 20,
            maxHp: 20,
            ac: 14,
            abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 16, CHA: 10 },
        })

        const players = Object.values(sessionState.players)
        expect(players).toHaveLength(1)
        expect(players[0].messages).toEqual([])
        expect(players[0].handRaised).toBe(false)
    })
})
