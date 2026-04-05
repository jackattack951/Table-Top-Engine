/**
 * Tests for Sprint 21b player handler additions:
 * - ROLL_PROMPT_SEND: DM sends a roll prompt to one or more players
 * - ROLL_RESULT_SUBMIT: Player submits their roll result
 * - ROLL_PROMPT_CANCEL: DM cancels an active roll prompt
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

describe('Sprint 21b: DM roll prompt system', () => {
    let io: ReturnType<typeof makeIO>
    let dmSocket: ReturnType<typeof makeSocket>
    let playerSocket: ReturnType<typeof makeSocket>
    let sessionState: SessionState | null
    let tokenToSocket: Map<string, string>
    let socketToToken: Map<string, string>

    const TOKEN = 'token-alice'
    const DM_SOCKET_ID = 'socket-dm'
    const PLAYER_SOCKET_ID = 'socket-alice'

    beforeEach(() => {
        io = makeIO()
        dmSocket = makeSocket(DM_SOCKET_ID)
        playerSocket = makeSocket(PLAYER_SOCKET_ID)
        const player = makePlayer(TOKEN, PLAYER_SOCKET_ID)
        sessionState = {
            sessionCode: 'ABC123',
            players: { [TOKEN]: player },
            phase: 'live',
            rollPrompts: {},
        }
        tokenToSocket = new Map([[TOKEN, PLAYER_SOCKET_ID]])
        socketToToken = new Map([[PLAYER_SOCKET_ID, TOKEN]])

        // Register handlers on DM socket (sends prompts)
        registerPlayerHandlers(
            io as unknown as import('socket.io').Server,
            dmSocket as unknown as import('socket.io').Socket,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )

        // Register handlers on player socket (submits results)
        registerPlayerHandlers(
            io as unknown as import('socket.io').Server,
            playerSocket as unknown as import('socket.io').Socket,
            () => sessionState,
            (s) => { sessionState = s },
            tokenToSocket,
            socketToToken,
        )
    })

    // ── ROLL_PROMPT_SEND ──────────────────────────────────────────────────────

    it('stores prompt in sessionState.rollPrompts', () => {
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN],
            die: 'd20',
            label: 'Perception',
            countdown: 30,
        })

        const prompts = Object.values(sessionState!.rollPrompts)
        expect(prompts).toHaveLength(1)
        expect(prompts[0].die).toBe('d20')
        expect(prompts[0].label).toBe('Perception')
        expect(prompts[0].countdown).toBe(30)
        expect(prompts[0].tokens).toContain(TOKEN)
    })

    it('sends PLAYER_ROLL_PROMPT to targeted player socket', () => {
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN],
            die: 'd20',
            label: 'Stealth',
            countdown: 15,
        })

        const playerEmit = io.to(PLAYER_SOCKET_ID).emit
        expect(playerEmit).toHaveBeenCalledWith(
            EVENTS.PLAYER_ROLL_PROMPT,
            expect.objectContaining({
                die: 'd20',
                label: 'Stealth',
                countdown: 15,
            }),
        )
    })

    it('echoes ROLL_PROMPT_ACTIVE to cockpit', () => {
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN],
            die: 'd20',
            label: 'Initiative',
            countdown: 30,
        })

        const promptId = Object.keys(sessionState!.rollPrompts)[0]
        expect(io.rooms['cockpit']?.emit).toHaveBeenCalledWith(
            EVENTS.ROLL_PROMPT_ACTIVE,
            { promptId },
        )
    })

    it('clamps negative countdown to 0', () => {
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN],
            die: 'd20',
            label: 'Roll',
            countdown: -5,
        })

        const prompt = Object.values(sessionState!.rollPrompts)[0]
        expect(prompt.countdown).toBe(0)
    })

    it('ignores prompt with missing die or label', () => {
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN],
            die: '',
            label: '',
            countdown: 30,
        })

        expect(Object.keys(sessionState!.rollPrompts)).toHaveLength(0)
    })

    it('does not send to players not in targets list', () => {
        const otherSocket = makeSocket('socket-bob')
        tokenToSocket.set('token-bob', 'socket-bob')

        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN],
            die: 'd20',
            label: 'Perception',
            countdown: 30,
        })

        // socket-bob should NOT have received a prompt
        expect(io.to('socket-bob').emit).not.toHaveBeenCalledWith(
            EVENTS.PLAYER_ROLL_PROMPT,
            expect.anything(),
        )
    })

    // ── ROLL_RESULT_SUBMIT ────────────────────────────────────────────────────

    it('relays roll result to cockpit with player info', () => {
        // First create a prompt
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN],
            die: 'd20',
            label: 'Perception',
            countdown: 30,
        })
        const promptId = Object.keys(sessionState!.rollPrompts)[0]

        // Player submits result
        playerSocket.trigger(EVENTS.ROLL_RESULT_SUBMIT, { promptId, result: 17 })

        expect(io.rooms['cockpit']?.emit).toHaveBeenCalledWith(
            EVENTS.DM_ROLL_RESULT,
            expect.objectContaining({
                promptId,
                token: TOKEN,
                playerName: 'Alice',
                characterName: 'Aldric',
                die: 'd20',
                label: 'Perception',
                result: 17,
            }),
        )
    })

    it('ignores result for unknown promptId', () => {
        // Ensure cockpit room mock exists before asserting on it
        const cockpitEmit = io.to('cockpit').emit
        cockpitEmit.mockClear()

        playerSocket.trigger(EVENTS.ROLL_RESULT_SUBMIT, { promptId: 'nonexistent', result: 10 })

        expect(cockpitEmit).not.toHaveBeenCalledWith(
            EVENTS.DM_ROLL_RESULT,
            expect.anything(),
        )
    })

    it('ignores non-finite result values', () => {
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN], die: 'd20', label: 'Roll', countdown: 30,
        })
        const promptId = Object.keys(sessionState!.rollPrompts)[0]

        playerSocket.trigger(EVENTS.ROLL_RESULT_SUBMIT, { promptId, result: NaN })

        expect(io.rooms['cockpit']?.emit).not.toHaveBeenCalledWith(
            EVENTS.DM_ROLL_RESULT,
            expect.anything(),
        )
    })

    // ── ROLL_PROMPT_CANCEL ────────────────────────────────────────────────────

    it('deletes prompt from sessionState on cancel', () => {
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN], die: 'd20', label: 'Roll', countdown: 30,
        })
        const promptId = Object.keys(sessionState!.rollPrompts)[0]

        dmSocket.trigger(EVENTS.ROLL_PROMPT_CANCEL, { promptId })

        expect(sessionState!.rollPrompts[promptId]).toBeUndefined()
    })

    it('sends PLAYER_ROLL_PROMPT_CANCEL to targeted players', () => {
        dmSocket.trigger(EVENTS.ROLL_PROMPT_SEND, {
            tokens: [TOKEN], die: 'd20', label: 'Roll', countdown: 30,
        })
        const promptId = Object.keys(sessionState!.rollPrompts)[0]

        dmSocket.trigger(EVENTS.ROLL_PROMPT_CANCEL, { promptId })

        expect(io.to(PLAYER_SOCKET_ID).emit).toHaveBeenCalledWith(
            EVENTS.PLAYER_ROLL_PROMPT_CANCEL,
            { promptId },
        )
    })

    it('ignores cancel for unknown promptId', () => {
        const initialEmitCount = Object.values(io.rooms).reduce(
            (n, r) => n + (r.emit.mock.calls.length), 0,
        )
        dmSocket.trigger(EVENTS.ROLL_PROMPT_CANCEL, { promptId: 'ghost-id' })

        const afterEmitCount = Object.values(io.rooms).reduce(
            (n, r) => n + (r.emit.mock.calls.length), 0,
        )
        expect(afterEmitCount).toBe(initialEmitCount)
    })
})
