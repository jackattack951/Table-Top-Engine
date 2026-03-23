/**
 * Companion browser dev WebSocket stub.
 * Used when running the companion UI directly in the browser (npm run dev:companion).
 * Simulates Socket.io responses so mobile UI development doesn't require a running server.
 *
 * In production (served by Express), the real Socket.io client is used.
 */

type EventHandler = (data: unknown) => void

class CompanionWsStub {
    private handlers: Map<string, EventHandler[]> = new Map()
    private connected = false

    connect(): void {
        console.log('[companion-ws-stub] connected (simulated)')
        this.connected = true
        setTimeout(() => this.trigger('connect', undefined), 100)
    }

    emit(event: string, data?: unknown): void {
        console.log(`[companion-ws-stub] emit -> ${event}`, data)
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
            case 'client:join': {
                const payload = data as { room?: string; token?: string }
                console.log('[companion-ws-stub] joined player room (simulated)')
                // Simulate reconnection if token is provided
                if (payload?.token) {
                    setTimeout(() => this.trigger('player:state', {
                        token: payload.token,
                        socketId: this.id,
                        playerName: 'Dev Player',
                        characterName: 'Dev Character',
                        class: 'Fighter',
                        level: 5,
                        hpCurrent: 45,
                        hpMax: 45,
                        ac: 16,
                        abilities: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 8 },
                        conditions: [],
                        inventory: [],
                        currency: { gold: 50, silver: 25, copper: 10 },
                        whispers: [],
                        status: 'approved',
                        connected: true,
                    }), 200)
                }
                break
            }
            case 'player:join': {
                console.log('[companion-ws-stub] simulating join response')
                const stubToken = 'stub-token-' + Date.now()
                const joinData = data as Record<string, unknown>
                const playerState = {
                    token: stubToken,
                    socketId: this.id,
                    playerName: joinData?.playerName ?? 'Dev Player',
                    characterName: joinData?.characterName ?? 'Dev Character',
                    class: joinData?.class ?? 'Fighter',
                    level: joinData?.level ?? 1,
                    hpCurrent: joinData?.hp ?? 10,
                    hpMax: joinData?.maxHp ?? 10,
                    ac: joinData?.ac ?? 10,
                    abilities: joinData?.abilities ?? { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
                    conditions: [],
                    inventory: [],
                    currency: { gold: 0, silver: 0, copper: 0 },
                    whispers: [],
                    status: 'pending' as const,
                    connected: true,
                }
                // Simulate token assignment
                setTimeout(() => this.trigger('player:token', { token: stubToken }), 300)
                // Then send full player state (pending)
                setTimeout(() => this.trigger('player:state', playerState), 500)
                // Simulate DM approval after 2 seconds
                setTimeout(() => this.trigger('player:state', { ...playerState, status: 'approved' }), 2500)
                // Simulate ready check after 4 seconds
                setTimeout(() => this.trigger('lobby:readyCheck', undefined), 4500)
                break
            }
            case 'lobby:readyConfirm': {
                console.log('[companion-ws-stub] ready confirmed — simulating go live')
                // Simulate session starting then DM push events on dashboard
                setTimeout(() => this.trigger('session:started', undefined), 1500)
                // Simulate DM pushing state updates after go-live
                // Simulate DM pushing conditions (staggered for visual effect)
                setTimeout(() => this.trigger('player:conditionAdd', { condition: 'Poisoned' }), 2500)
                setTimeout(() => this.trigger('player:conditionAdd', { condition: 'Blessed' }), 3000)
                setTimeout(() => this.trigger('player:conditionAdd', { condition: 'Frightened' }), 3500)
                setTimeout(() => this.trigger('player:conditionAdd', { condition: 'Slowed' }), 4000)
                setTimeout(() => this.trigger('player:conditionAdd', { condition: 'Burning' }), 4500)
                setTimeout(() => this.trigger('player:conditionAdd', { condition: 'Frozen' }), 5000)
                setTimeout(() => this.trigger('player:conditionAdd', { condition: 'Stunned' }), 5500)
                setTimeout(() => this.trigger('player:conditionAdd', { condition: 'Invisible' }), 6000)
                // Items, currency, HP, whisper
                setTimeout(() => this.trigger('player:itemAdd', {
                    id: 'item-stub-1', name: 'Healing Potion', quantity: 2, description: 'Heals 2d4+2 HP',
                }), 6500)
                setTimeout(() => this.trigger('player:itemAdd', {
                    id: 'item-stub-2', name: 'Flame Tongue Longsword', quantity: 1, description: 'Deals an extra 2d6 fire damage on a hit.',
                }), 7000)
                setTimeout(() => this.trigger('player:currencyUpdate', { gold: 150, silver: 30, copper: 15 }), 7500)
                setTimeout(() => this.trigger('player:hpUpdate', { current: 18, max: 45 }), 8000)
                // Second HP drop to critical range for heartbeat effect
                setTimeout(() => this.trigger('player:hpUpdate', { current: 8, max: 45 }), 11000)
                setTimeout(() => this.trigger('player:whisper', {
                    id: 'whisper-stub-1', message: 'You notice a hidden passage behind the bookshelf.', timestamp: Date.now() + 8500, read: false,
                }), 8500)
                setTimeout(() => this.trigger('player:whisper', {
                    id: 'whisper-stub-2', message: 'The merchant is lying — roll Insight.', timestamp: Date.now() + 9000, read: false,
                }), 9500)
                break
            }
            default:
                break
        }
    }

    get id(): string { return 'companion-stub-socket-id' }
    get active(): boolean { return this.connected }
}

export const companionWsStub = new CompanionWsStub()
