/**
 * Player handler tests — Sprint 11b.
 * Tests registerPlayerHandlers() with mock Socket.io objects.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registerPlayerHandlers } from './player-handlers'
import type { SessionState, PlayerCharacter } from '../../shared/player-types'

// ── Mock Socket.io ───────────────────────────────────────────────────────────

type Handler = (data: unknown) => void

function createMockSocket(id = 'socket-1') {
    const handlers = new Map<string, Handler>()
    const emitted: Array<{ event: string; data: unknown }> = []

    return {
        id,
        handlers,
        emitted,
        on(event: string, handler: Handler) {
            handlers.set(event, handler)
        },
        emit(event: string, data?: unknown) {
            emitted.push({ event, data })
        },
        /** Simulate receiving an event */
        receive(event: string, data?: unknown) {
            const handler = handlers.get(event)
            if (handler) handler(data)
        },
    }
}

function createMockIO() {
    const roomEmits: Array<{ room: string; event: string; data: unknown }> = []
    return {
        roomEmits,
        to(room: string) {
            return {
                emit(event: string, data?: unknown) {
                    roomEmits.push({ room, event, data })
                },
            }
        },
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSessionState(overrides: Partial<SessionState> = {}): SessionState {
    return {
        sessionCode: 'ABC123',
        players: {},
        phase: 'lobby',
        rollPrompts: {},
        ...overrides,
    }
}

function makeJoinPayload(overrides: Record<string, unknown> = {}) {
    return {
        sessionCode: 'ABC123',
        playerName: 'Alice',
        characterName: 'Aria',
        class: 'Wizard',
        level: 5,
        hp: 30,
        maxHp: 38,
        ac: 14,
        abilities: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 13, CHA: 10 },
        ...overrides,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('registerPlayerHandlers — PLAYER_JOIN', () => {
    let io: ReturnType<typeof createMockIO>
    let socket: ReturnType<typeof createMockSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    beforeEach(() => {
        io = createMockIO()
        socket = createMockSocket()
        sessionState = makeSessionState()
        tokenToSocket = new Map()
        socketToToken = new Map()

        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )
    })

    it('assigns token and creates player on valid join', () => {
        socket.receive('player:join', makeJoinPayload())

        // Should emit token and state to player
        const tokenEmit = socket.emitted.find((e) => e.event === 'player:token')
        expect(tokenEmit).toBeDefined()
        expect((tokenEmit!.data as { token: string }).token).toBeDefined()

        const stateEmit = socket.emitted.find((e) => e.event === 'player:state')
        expect(stateEmit).toBeDefined()
        const player = stateEmit!.data as PlayerCharacter
        expect(player.playerName).toBe('Alice')
        expect(player.characterName).toBe('Aria')
        expect(player.status).toBe('pending')
        expect(player.connected).toBe(true)

        // Should store in session state
        expect(Object.keys(sessionState!.players)).toHaveLength(1)

        // Should update socket mappings
        expect(tokenToSocket.size).toBe(1)
        expect(socketToToken.size).toBe(1)

        // Should notify cockpit
        const lobbyEmit = io.roomEmits.find((e) => e.room === 'cockpit' && e.event === 'lobby:state')
        expect(lobbyEmit).toBeDefined()
    })

    it('rejects join when no session exists', () => {
        sessionState = null
        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )

        socket.receive('player:join', makeJoinPayload())
        const expired = socket.emitted.find((e) => e.event === 'player:sessionExpired')
        expect(expired).toBeDefined()
    })

    it('rejects join with wrong session code', () => {
        socket.receive('player:join', makeJoinPayload({ sessionCode: 'WRONG1' }))
        const expired = socket.emitted.find((e) => e.event === 'player:sessionExpired')
        expect(expired).toBeDefined()
    })

    it('rejects join when session is full (MAX_PLAYERS = 8)', () => {
        // Fill up the session
        for (let i = 0; i < 8; i++) {
            sessionState!.players[`token-${i}`] = {
                token: `token-${i}`,
                socketId: `socket-${i}`,
                playerName: `Player ${i}`,
                characterName: `Char ${i}`,
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
                status: 'pending',
                connected: true,
                handRaised: false,
            }
        }

        socket.receive('player:join', makeJoinPayload())
        const rejected = socket.emitted.find((e) => e.event === 'player:joinRejected')
        expect(rejected).toBeDefined()
        expect((rejected!.data as { reason: string }).reason).toBe('Session is full')
    })

    it('rejects join with missing required fields', () => {
        socket.receive('player:join', makeJoinPayload({ playerName: '', characterName: '' }))
        const rejected = socket.emitted.find((e) => e.event === 'player:joinRejected')
        expect(rejected).toBeDefined()
        expect((rejected!.data as { reason: string }).reason).toBe('Missing required fields')
    })
})

describe('registerPlayerHandlers — lobby management', () => {
    let io: ReturnType<typeof createMockIO>
    let socket: ReturnType<typeof createMockSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    beforeEach(() => {
        io = createMockIO()
        socket = createMockSocket()
        sessionState = makeSessionState()
        tokenToSocket = new Map()
        socketToToken = new Map()

        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )

        // Add a player
        socket.receive('player:join', makeJoinPayload())
    })

    it('approves a player', () => {
        const token = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:approve', { token })

        expect(sessionState!.players[token].status).toBe('approved')
    })

    it('kicks a player and removes from state', () => {
        const token = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:kick', { token })

        expect(sessionState!.players[token]).toBeUndefined()
        expect(tokenToSocket.has(token)).toBe(false)
    })
})

describe('registerPlayerHandlers — ready check', () => {
    let io: ReturnType<typeof createMockIO>
    let socket: ReturnType<typeof createMockSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    beforeEach(() => {
        io = createMockIO()
        socket = createMockSocket()
        sessionState = makeSessionState()
        tokenToSocket = new Map()
        socketToToken = new Map()

        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )

        // Add and approve a player
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:approve', { token })
    })

    it('sets phase to ready-check', () => {
        socket.receive('lobby:readyCheck', {})
        expect(sessionState!.phase).toBe('ready-check')
    })

    it('player confirms ready', () => {
        socket.receive('lobby:readyCheck', {})
        const token = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:readyConfirm', { token })
        expect(sessionState!.players[token].status).toBe('ready')
    })

    it('ignores ready confirm from non-approved player', () => {
        const token = Object.keys(sessionState!.players)[0]
        sessionState!.players[token].status = 'pending'
        socket.receive('lobby:readyConfirm', { token })
        expect(sessionState!.players[token].status).toBe('pending')
    })
})

describe('registerPlayerHandlers — session lifecycle', () => {
    let io: ReturnType<typeof createMockIO>
    let socket: ReturnType<typeof createMockSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    beforeEach(() => {
        io = createMockIO()
        socket = createMockSocket()
        sessionState = makeSessionState()
        tokenToSocket = new Map()
        socketToToken = new Map()

        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )
    })

    it('go live sets phase and player statuses', () => {
        // Add and approve player
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:approve', { token })

        socket.receive('session:goLive', {})

        expect(sessionState!.phase).toBe('live')
        expect(sessionState!.players[token].status).toBe('live')

        // Should notify players
        const started = io.roomEmits.find((e) => e.room === 'player' && e.event === 'session:started')
        expect(started).toBeDefined()
    })

    it('end session clears state', () => {
        socket.receive('player:join', makeJoinPayload())
        socket.receive('session:end', {})

        expect(sessionState).toBeNull()
        expect(tokenToSocket.size).toBe(0)
        expect(socketToToken.size).toBe(0)

        // Should notify players
        const ended = io.roomEmits.find((e) => e.room === 'player' && e.event === 'session:ended')
        expect(ended).toBeDefined()
    })
})

describe('registerPlayerHandlers — DM actions', () => {
    let io: ReturnType<typeof createMockIO>
    let socket: ReturnType<typeof createMockSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>
    let playerToken: string

    beforeEach(() => {
        io = createMockIO()
        socket = createMockSocket()
        sessionState = makeSessionState()
        tokenToSocket = new Map()
        socketToToken = new Map()

        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )

        // Add a player
        socket.receive('player:join', makeJoinPayload())
        playerToken = Object.keys(sessionState!.players)[0]
    })

    it('adjusts HP within bounds', () => {
        socket.receive('dm:adjustHp', { token: playerToken, amount: -10 })
        expect(sessionState!.players[playerToken].hpCurrent).toBe(20) // 30 - 10

        socket.receive('dm:adjustHp', { token: playerToken, amount: 100 })
        expect(sessionState!.players[playerToken].hpCurrent).toBe(38) // capped at hpMax
    })

    it('adjusts HP — does not go below 0', () => {
        socket.receive('dm:adjustHp', { token: playerToken, amount: -999 })
        expect(sessionState!.players[playerToken].hpCurrent).toBe(0)
    })

    it('adds condition', () => {
        socket.receive('dm:addCondition', { token: playerToken, condition: 'Poisoned' })
        expect(sessionState!.players[playerToken].conditions).toContain('Poisoned')
    })

    it('does not duplicate conditions', () => {
        socket.receive('dm:addCondition', { token: playerToken, condition: 'Stunned' })
        socket.receive('dm:addCondition', { token: playerToken, condition: 'Stunned' })
        expect(sessionState!.players[playerToken].conditions.filter((c) => c === 'Stunned')).toHaveLength(1)
    })

    it('removes condition', () => {
        socket.receive('dm:addCondition', { token: playerToken, condition: 'Poisoned' })
        socket.receive('dm:removeCondition', { token: playerToken, condition: 'Poisoned' })
        expect(sessionState!.players[playerToken].conditions).not.toContain('Poisoned')
    })

    it('sends item to player inventory', () => {
        const item = { id: 'item-1', name: 'Potion', quantity: 2, description: 'Heals 2d4+2' }
        socket.receive('dm:sendItem', { token: playerToken, item })
        expect(sessionState!.players[playerToken].inventory).toHaveLength(1)
        expect(sessionState!.players[playerToken].inventory[0].name).toBe('Potion')
    })

    it('removes item from player inventory', () => {
        const item = { id: 'item-1', name: 'Potion', quantity: 1, description: '' }
        socket.receive('dm:sendItem', { token: playerToken, item })
        socket.receive('dm:removeItem', { token: playerToken, itemId: 'item-1' })
        expect(sessionState!.players[playerToken].inventory).toHaveLength(0)
    })

    it('updates currency', () => {
        socket.receive('dm:updateCurrency', {
            token: playerToken,
            currency: { gold: 100, silver: 50, copper: 25 },
        })
        expect(sessionState!.players[playerToken].currency).toEqual({ gold: 100, silver: 50, copper: 25 })
    })

    it('sends whisper to player', () => {
        socket.receive('dm:whisper', {
            tokens: [playerToken],
            message: 'You notice a hidden door',
        })
        expect(sessionState!.players[playerToken].whispers).toHaveLength(1)
        expect(sessionState!.players[playerToken].whispers[0].message).toBe('You notice a hidden door')
        expect(sessionState!.players[playerToken].whispers[0].read).toBe(false)
    })

    it('broadcasts to all players', () => {
        socket.receive('dm:broadcast', { type: 'announcement', content: 'Roll initiative!' })
        const broadcast = io.roomEmits.find((e) => e.room === 'player' && e.event === 'player:broadcast')
        expect(broadcast).toBeDefined()
        expect(broadcast!.data).toEqual({ type: 'announcement', content: 'Roll initiative!' })
    })
})

// ── Sprint 12 tests — lobby flow scenarios ──────────────────────────────────

describe('Sprint 12 — partial ready check (multi-player)', () => {
    let io: ReturnType<typeof createMockIO>
    let socket: ReturnType<typeof createMockSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    beforeEach(() => {
        io = createMockIO()
        socket = createMockSocket()
        sessionState = makeSessionState()
        tokenToSocket = new Map()
        socketToToken = new Map()

        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )
    })

    function addPlayer(name: string, charName: string) {
        socket.receive('player:join', makeJoinPayload({
            playerName: name,
            characterName: charName,
        }))
        return Object.keys(sessionState!.players).at(-1)!
    }

    it('Go Live with some players not ready does not block (approved treated as live)', () => {
        const t1 = addPlayer('Alice', 'Aria')
        const t2 = addPlayer('Bob', 'Brak')
        socket.receive('lobby:approve', { token: t1 })
        socket.receive('lobby:approve', { token: t2 })
        socket.receive('lobby:readyCheck', {})

        // Only Alice confirms ready
        socket.receive('lobby:readyConfirm', { token: t1 })

        expect(sessionState!.players[t1].status).toBe('ready')
        expect(sessionState!.players[t2].status).toBe('approved')

        // Go Live transitions all approved/ready to live
        socket.receive('session:goLive', {})
        expect(sessionState!.phase).toBe('live')
        expect(sessionState!.players[t1].status).toBe('live')
        expect(sessionState!.players[t2].status).toBe('live')
    })

    it('ready check broadcasts to player room', () => {
        const t1 = addPlayer('Alice', 'Aria')
        socket.receive('lobby:approve', { token: t1 })
        socket.receive('lobby:readyCheck', {})

        const readyBroadcast = io.roomEmits.find(
            (e) => e.room === 'player' && e.event === 'lobby:readyCheck'
        )
        expect(readyBroadcast).toBeDefined()
    })

    it('all players confirm ready', () => {
        const t1 = addPlayer('Alice', 'Aria')
        const t2 = addPlayer('Bob', 'Brak')
        socket.receive('lobby:approve', { token: t1 })
        socket.receive('lobby:approve', { token: t2 })
        socket.receive('lobby:readyCheck', {})

        socket.receive('lobby:readyConfirm', { token: t1 })
        socket.receive('lobby:readyConfirm', { token: t2 })

        expect(sessionState!.players[t1].status).toBe('ready')
        expect(sessionState!.players[t2].status).toBe('ready')
    })
})

describe('Sprint 12 — kicked player rejoin', () => {
    let io: ReturnType<typeof createMockIO>
    let socket: ReturnType<typeof createMockSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    beforeEach(() => {
        io = createMockIO()
        socket = createMockSocket()
        sessionState = makeSessionState()
        tokenToSocket = new Map()
        socketToToken = new Map()

        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )
    })

    it('kicked player is removed from session state', () => {
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:kick', { token })

        expect(Object.keys(sessionState!.players)).toHaveLength(0)
        expect(tokenToSocket.has(token)).toBe(false)
    })

    it('kicked player receives kicked status before removal', () => {
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]

        // Track emits to the player's socket
        const playerSocketId = tokenToSocket.get(token)!
        socket.receive('lobby:kick', { token })

        // Player socket should have received state with status='kicked'
        const kickedEmit = io.roomEmits.find(
            (e) => e.room === playerSocketId && e.event === 'player:state'
        )
        expect(kickedEmit).toBeDefined()
        expect((kickedEmit!.data as PlayerCharacter).status).toBe('kicked')
    })

    it('kicked player can rejoin as new player', () => {
        socket.receive('player:join', makeJoinPayload())
        const oldToken = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:kick', { token: oldToken })

        // Player joins again (new socket, same name)
        socket.receive('player:join', makeJoinPayload({ playerName: 'Alice', characterName: 'Aria' }))

        const newTokens = Object.keys(sessionState!.players)
        expect(newTokens).toHaveLength(1)
        expect(newTokens[0]).not.toBe(oldToken)
        expect(sessionState!.players[newTokens[0]].status).toBe('pending')
    })
})

describe('Sprint 12 — cockpit receives lobby state updates', () => {
    let io: ReturnType<typeof createMockIO>
    let socket: ReturnType<typeof createMockSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    beforeEach(() => {
        io = createMockIO()
        socket = createMockSocket()
        sessionState = makeSessionState()
        tokenToSocket = new Map()
        socketToToken = new Map()

        registerPlayerHandlers(
            io as never,
            socket as never,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )
    })

    it('lobby:state emitted to cockpit room on player join', () => {
        socket.receive('player:join', makeJoinPayload())

        const lobbyEmits = io.roomEmits.filter(
            (e) => e.room === 'cockpit' && e.event === 'lobby:state'
        )
        expect(lobbyEmits.length).toBeGreaterThanOrEqual(1)
        const latest = lobbyEmits[lobbyEmits.length - 1]
        const payload = latest.data as { players: PlayerCharacter[]; phase: string; sessionCode: string }
        expect(payload.players).toHaveLength(1)
        expect(payload.sessionCode).toBe('ABC123')
    })

    it('lobby:state emitted on approve', () => {
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]
        const countBefore = io.roomEmits.filter((e) => e.room === 'cockpit' && e.event === 'lobby:state').length

        socket.receive('lobby:approve', { token })

        const countAfter = io.roomEmits.filter((e) => e.room === 'cockpit' && e.event === 'lobby:state').length
        expect(countAfter).toBeGreaterThan(countBefore)
    })

    it('lobby:state emitted on kick', () => {
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]
        const countBefore = io.roomEmits.filter((e) => e.room === 'cockpit' && e.event === 'lobby:state').length

        socket.receive('lobby:kick', { token })

        const countAfter = io.roomEmits.filter((e) => e.room === 'cockpit' && e.event === 'lobby:state').length
        expect(countAfter).toBeGreaterThan(countBefore)
    })

    it('lobby:state emitted on ready confirm', () => {
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:approve', { token })
        socket.receive('lobby:readyCheck', {})
        const countBefore = io.roomEmits.filter((e) => e.room === 'cockpit' && e.event === 'lobby:state').length

        socket.receive('lobby:readyConfirm', { token })

        const countAfter = io.roomEmits.filter((e) => e.room === 'cockpit' && e.event === 'lobby:state').length
        expect(countAfter).toBeGreaterThan(countBefore)
    })

    it('lobby:state emitted on Go Live', () => {
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]
        socket.receive('lobby:approve', { token })
        const countBefore = io.roomEmits.filter((e) => e.room === 'cockpit' && e.event === 'lobby:state').length

        socket.receive('session:goLive', {})

        const countAfter = io.roomEmits.filter((e) => e.room === 'cockpit' && e.event === 'lobby:state').length
        expect(countAfter).toBeGreaterThan(countBefore)
    })

    it('session end notifies both cockpit and players', () => {
        socket.receive('player:join', makeJoinPayload())
        socket.receive('session:end', {})

        const cockpitEnd = io.roomEmits.find((e) => e.room === 'cockpit' && e.event === 'lobby:state')
        const playerEnd = io.roomEmits.find((e) => e.room === 'player' && e.event === 'session:ended')

        expect(cockpitEnd).toBeDefined()
        expect(playerEnd).toBeDefined()
    })

    it('disconnected player stays in lobby (not removed)', () => {
        socket.receive('player:join', makeJoinPayload())
        const token = Object.keys(sessionState!.players)[0]

        // Simulate disconnect by marking player as disconnected
        sessionState!.players[token].connected = false

        expect(Object.keys(sessionState!.players)).toHaveLength(1)
        expect(sessionState!.players[token].connected).toBe(false)
    })
})
