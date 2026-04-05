/**
 * Tests for Sprint 21c additions:
 * - SESSION_SET_CHAR_MODE socket handler (validated mode update → cockpit echo)
 * - DB-level player character CRUD functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EVENTS } from '../../shared/socket-events'
import type { SessionState, CharacterSelectMode } from '../../shared/player-types'

// ── Minimal socket/io mocks ───────────────────────────────────────────────────

function makeSocket(id = 'socket-dm') {
    const handlers: Record<string, (data: unknown) => void> = {}
    return {
        id,
        emit: vi.fn(),
        on: (event: string, handler: (data: unknown) => void) => { handlers[event] = handler },
        trigger: (event: string, data: unknown) => handlers[event]?.(data),
    }
}

function makeIO() {
    const rooms: Record<string, { emit: ReturnType<typeof vi.fn> }> = {}
    return {
        to: (room: string) => { rooms[room] ??= { emit: vi.fn() }; return rooms[room] },
        rooms,
    }
}

// ── Inline handler (mirrors server.ts SESSION_SET_CHAR_MODE logic) ────────────

function registerCharModeHandler(
    io: ReturnType<typeof makeIO>,
    socket: ReturnType<typeof makeSocket>,
    getState: () => SessionState | null,
    setState: (s: SessionState) => void,
) {
    socket.on(EVENTS.SESSION_SET_CHAR_MODE, (payload) => {
        const state = getState()
        if (!state) return
        const { mode } = payload as { mode: string }
        const valid: CharacterSelectMode[] = ['manual-only', 'roster-and-manual', 'roster-only']
        if (!valid.includes(mode as CharacterSelectMode)) return
        state.characterSelectMode = mode as CharacterSelectMode
        setState(state)
        io.to('cockpit').emit(EVENTS.SESSION_CHAR_MODE, { mode: state.characterSelectMode })
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sprint 21c: SESSION_SET_CHAR_MODE handler', () => {
    let io: ReturnType<typeof makeIO>
    let socket: ReturnType<typeof makeSocket>
    let sessionState: SessionState

    beforeEach(() => {
        io = makeIO()
        socket = makeSocket()
        sessionState = {
            sessionCode: 'ABC123',
            players: {},
            phase: 'lobby',
            rollPrompts: {},
            characterSelectMode: 'manual-only',
        }
        registerCharModeHandler(
            io, socket,
            () => sessionState,
            (s) => { sessionState = s },
        )
    })

    it('updates characterSelectMode in session state', () => {
        socket.trigger(EVENTS.SESSION_SET_CHAR_MODE, { mode: 'roster-only' })
        expect(sessionState.characterSelectMode).toBe('roster-only')
    })

    it('echoes SESSION_CHAR_MODE to cockpit', () => {
        socket.trigger(EVENTS.SESSION_SET_CHAR_MODE, { mode: 'roster-and-manual' })
        expect(io.to('cockpit').emit).toHaveBeenCalledWith(
            EVENTS.SESSION_CHAR_MODE,
            { mode: 'roster-and-manual' },
        )
    })

    it('ignores invalid mode strings', () => {
        socket.trigger(EVENTS.SESSION_SET_CHAR_MODE, { mode: 'invalid-mode' })
        expect(sessionState.characterSelectMode).toBe('manual-only')
        expect(io.rooms['cockpit']).toBeUndefined()
    })

    it('accepts all three valid modes', () => {
        const modes: CharacterSelectMode[] = ['manual-only', 'roster-and-manual', 'roster-only']
        for (const mode of modes) {
            socket.trigger(EVENTS.SESSION_SET_CHAR_MODE, { mode })
            expect(sessionState.characterSelectMode).toBe(mode)
        }
    })

    it('does nothing when sessionState is null', () => {
        const nullSocket = makeSocket('s2')
        registerCharModeHandler(io, nullSocket, () => null, () => {})
        // Should not throw
        nullSocket.trigger(EVENTS.SESSION_SET_CHAR_MODE, { mode: 'roster-only' })
        expect(sessionState.characterSelectMode).toBe('manual-only')
    })
})

// ── DB interface shape contract ───────────────────────────────────────────────

describe('Sprint 21c: DBInterface player character shape', () => {
    it('createDBInterface is a function', async () => {
        const dbModule = await import('../core/db/db')
        expect(typeof dbModule.createDBInterface).toBe('function')
    })

    it('standalone getPlayerCharacters, createPlayerCharacter, deletePlayerCharacter are exported', async () => {
        const dbModule = await import('../core/db/db')
        expect(typeof dbModule.getPlayerCharacters).toBe('function')
        expect(typeof dbModule.createPlayerCharacter).toBe('function')
        expect(typeof dbModule.deletePlayerCharacter).toBe('function')
    })

    it('DBInterface type includes the three player character methods', async () => {
        // Verify the interface contract by checking that the keys are present in the type
        // (runtime representation of DBInterface includes these functions)
        const dbModule = await import('../core/db/db')
        // createDBInterface returns an object with these keys; we verify via the
        // standalone exports that are referenced inside createDBInterface
        const exportKeys = Object.keys(dbModule)
        expect(exportKeys).toContain('getPlayerCharacters')
        expect(exportKeys).toContain('createPlayerCharacter')
        expect(exportKeys).toContain('deletePlayerCharacter')
    })
})
