/**
 * Browser dev WebSocket stub.
 * Used when running the cockpit UI directly in the browser (npm run dev:cockpit).
 * Simulates Socket.io responses so UI development doesn't require a running server.
 *
 * In production (Electron or LAN), the real Socket.io client in sync.ts is used.
 */
import { EVENTS } from '@shared/socket-events'

type EventHandler = (data: unknown) => void

class WsStub {
    private handlers: Map<string, EventHandler[]> = new Map()
    private connected = false

    connect(): void {
        console.log('[ws-stub] connected (simulated)')
        this.connected = true
        setTimeout(() => this.trigger('connect', undefined), 100)
    }

    emit(event: string, data?: unknown): void {
        console.log(`[ws-stub] emit → ${event}`, data)
        // Simulate server echoing back for relevant events
        this.simulateResponse(event, data)
    }

    on(event: string, handler: EventHandler): this {
        if (!this.handlers.has(event)) this.handlers.set(event, [])
        this.handlers.get(event)!.push(handler)
        return this
    }

    off(event: string, handler: EventHandler): this {
        const handlers = this.handlers.get(event) ?? []
        this.handlers.set(event, handlers.filter((h) => h !== handler))
        return this
    }

    private trigger(event: string, data: unknown): void {
        const handlers = this.handlers.get(event) ?? []
        handlers.forEach((h) => h(data))
    }

    private simulateResponse(event: string, data: unknown): void {
        switch (event) {
            case EVENTS.CLIENT_JOIN: {
                console.log('[ws-stub] joined room (simulated)')
                const { room } = data as { room?: string }
                if (room === 'cockpit') this.simulateLobby()
                break
            }
            case EVENTS.APP_MODE_CHANGE: {
                const { mode } = data as { mode: string }
                if (mode === 'play') this.simulateLobby()
                break
            }
            default:
                break
        }
    }

    /** Simulate a live session with stub players for browser dev. */
    private simulateLobby(): void {
        const stubPlayers = [
            {
                token: 'stub-tok-1', socketId: 'stub-s1',
                playerName: 'Alice', characterName: 'Aria',
                class: 'Wizard', level: 5, hpCurrent: 30, hpMax: 38, ac: 14,
                abilities: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 13, CHA: 10 },
                conditions: ['Concentrating'], inventory: [
                    { id: 'i1', name: 'Wand of Fireballs', quantity: 1, description: '7 charges' },
                ],
                currency: { gold: 120, silver: 45, copper: 10 },
                whispers: [], messages: [], status: 'live' as const, connected: true, handRaised: false,
            },
            {
                token: 'stub-tok-2', socketId: 'stub-s2',
                playerName: 'Bob', characterName: 'Brak',
                class: 'Fighter', level: 5, hpCurrent: 45, hpMax: 52, ac: 18,
                abilities: { STR: 18, DEX: 12, CON: 16, INT: 8, WIS: 10, CHA: 14 },
                conditions: [], inventory: [
                    { id: 'i2', name: 'Longsword +1', quantity: 1, description: 'Magic weapon' },
                    { id: 'i3', name: 'Healing Potion', quantity: 3, description: 'Heals 2d4+2 HP' },
                ],
                currency: { gold: 85, silver: 30, copper: 5 },
                whispers: [], messages: [], status: 'live' as const, connected: true, handRaised: false,
            },
        ]

        // Simulate session creation after a short delay
        setTimeout(() => {
            console.log('[ws-stub] simulating lobby session with 2 players')
            this.trigger(EVENTS.LOBBY_STATE, {
                players: stubPlayers,
                phase: 'live',
                sessionCode: 'DEV42X',
            })
        }, 500)
    }

    get id(): string { return 'stub-socket-id' }
    get active(): boolean { return this.connected }
}

export const wsStub = new WsStub()
