/**
 * Socket events tests — Sprint 11b.
 * Verify all new player/lobby/session/dm event constants exist and are correctly namespaced.
 */
import { describe, it, expect } from 'vitest'
import { EVENTS } from './socket-events'

describe('socket-events — player events', () => {
    it('has PLAYER_JOIN', () => {
        expect(EVENTS.PLAYER_JOIN).toBe('player:join')
    })

    it('has PLAYER_TOKEN', () => {
        expect(EVENTS.PLAYER_TOKEN).toBe('player:token')
    })

    it('has PLAYER_RECONNECT', () => {
        expect(EVENTS.PLAYER_RECONNECT).toBe('player:reconnect')
    })

    it('has PLAYER_STATE', () => {
        expect(EVENTS.PLAYER_STATE).toBe('player:state')
    })

    it('has PLAYER_SESSION_EXPIRED', () => {
        expect(EVENTS.PLAYER_SESSION_EXPIRED).toBe('player:sessionExpired')
    })

    it('has PLAYER_JOIN_REJECTED', () => {
        expect(EVENTS.PLAYER_JOIN_REJECTED).toBe('player:joinRejected')
    })
})

describe('socket-events — lobby events', () => {
    it('has LOBBY_STATE', () => {
        expect(EVENTS.LOBBY_STATE).toBe('lobby:state')
    })

    it('has LOBBY_APPROVE', () => {
        expect(EVENTS.LOBBY_APPROVE).toBe('lobby:approve')
    })

    it('has LOBBY_KICK', () => {
        expect(EVENTS.LOBBY_KICK).toBe('lobby:kick')
    })

    it('has LOBBY_READY_CHECK', () => {
        expect(EVENTS.LOBBY_READY_CHECK).toBe('lobby:readyCheck')
    })

    it('has LOBBY_READY_CONFIRM', () => {
        expect(EVENTS.LOBBY_READY_CONFIRM).toBe('lobby:readyConfirm')
    })
})

describe('socket-events — session events', () => {
    it('has SESSION_GO_LIVE', () => {
        expect(EVENTS.SESSION_GO_LIVE).toBe('session:goLive')
    })

    it('has SESSION_STARTED', () => {
        expect(EVENTS.SESSION_STARTED).toBe('session:started')
    })

    it('has SESSION_END', () => {
        expect(EVENTS.SESSION_END).toBe('session:end')
    })

    it('has SESSION_ENDED', () => {
        expect(EVENTS.SESSION_ENDED).toBe('session:ended')
    })
})

describe('socket-events — DM push events', () => {
    it('has all player push events', () => {
        expect(EVENTS.PLAYER_HP_UPDATE).toBe('player:hpUpdate')
        expect(EVENTS.PLAYER_CONDITION_ADD).toBe('player:conditionAdd')
        expect(EVENTS.PLAYER_CONDITION_REMOVE).toBe('player:conditionRemove')
        expect(EVENTS.PLAYER_ITEM_ADD).toBe('player:itemAdd')
        expect(EVENTS.PLAYER_ITEM_REMOVE).toBe('player:itemRemove')
        expect(EVENTS.PLAYER_CURRENCY_UPDATE).toBe('player:currencyUpdate')
        expect(EVENTS.PLAYER_WHISPER).toBe('player:whisper')
        expect(EVENTS.PLAYER_BROADCAST).toBe('player:broadcast')
    })

    it('has all DM action events', () => {
        expect(EVENTS.DM_ADJUST_HP).toBe('dm:adjustHp')
        expect(EVENTS.DM_ADD_CONDITION).toBe('dm:addCondition')
        expect(EVENTS.DM_REMOVE_CONDITION).toBe('dm:removeCondition')
        expect(EVENTS.DM_SEND_ITEM).toBe('dm:sendItem')
        expect(EVENTS.DM_REMOVE_ITEM).toBe('dm:removeItem')
        expect(EVENTS.DM_UPDATE_CURRENCY).toBe('dm:updateCurrency')
        expect(EVENTS.DM_WHISPER).toBe('dm:whisper')
        expect(EVENTS.DM_BROADCAST).toBe('dm:broadcast')
    })
})

describe('socket-events — item events', () => {
    it('has ITEM_CREATE', () => {
        expect(EVENTS.ITEM_CREATE).toBe('item:create')
    })

    it('has ITEM_UPDATE', () => {
        expect(EVENTS.ITEM_UPDATE).toBe('item:update')
    })

    it('has ITEM_DELETE', () => {
        expect(EVENTS.ITEM_DELETE).toBe('item:delete')
    })
})

describe('socket-events — no duplicate values', () => {
    it('all event values are unique', () => {
        const values = Object.values(EVENTS)
        const unique = new Set(values)
        expect(unique.size).toBe(values.length)
    })
})
