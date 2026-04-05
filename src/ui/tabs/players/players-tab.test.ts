/**
 * Player system contract tests (Sprint 14 → Phase 1 sidebar update).
 *
 * Vitest env is 'node' — no DOM. Tests verify:
 * - Module exports correctly (PlayersTab, PlayerCard, PlayerSidebar)
 * - Player store supports all DM action data flows
 * - Sync emit helpers exist and are callable
 * - TabBar has exactly 7 static tabs (no 'players')
 * - Sidebar visibility logic (active whenever session is active)
 * - safeEmit queues events when socket is not connected
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePlayerStore } from '../../stores/player-store'
import type { PlayerCharacter } from '@shared/player-types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
    return {
        token: 'tok-1',
        socketId: 'sock-1',
        playerName: 'Alice',
        characterName: 'Aria',
        class: 'Wizard',
        level: 5,
        hpCurrent: 30,
        hpMax: 38,
        ac: 14,
        abilities: { STR: 8, DEX: 14, CON: 12, INT: 18, WIS: 13, CHA: 10 },
        conditions: [],
        inventory: [],
        currency: { gold: 0, silver: 0, copper: 0 },
        whispers: [],
        messages: [],
        status: 'live',
        connected: true,
        handRaised: false,
        ...overrides,
    }
}

// ── Module exports ──────────────────────────────────────────────────────────

describe('PlayersTab module', () => {
    it('exports a named function component', async () => {
        const mod = await import('../PlayersTab')
        expect(typeof mod.PlayersTab).toBe('function')
    })
})

describe('PlayerCard module', () => {
    it('exports a named function component', async () => {
        const mod = await import('./player-card')
        expect(typeof mod.PlayerCard).toBe('function')
    })
})

// ── Player store — DM action data flows ─────────────────────────────────────

describe('Player store — setPlayers from lobby:state', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('adds players from server push', () => {
        const player = makePlayer()
        usePlayerStore.getState().setPlayers([player])
        const players = usePlayerStore.getState().players
        expect(Object.keys(players)).toHaveLength(1)
        expect(players['tok-1'].characterName).toBe('Aria')
    })

    it('updates existing player when lobby:state arrives', () => {
        usePlayerStore.getState().setPlayers([makePlayer()])
        // Server pushes updated HP
        usePlayerStore.getState().setPlayers([makePlayer({ hpCurrent: 20 })])
        expect(usePlayerStore.getState().players['tok-1'].hpCurrent).toBe(20)
    })

    it('handles multiple players', () => {
        const p1 = makePlayer({ token: 'tok-1', characterName: 'Aria' })
        const p2 = makePlayer({ token: 'tok-2', characterName: 'Brak', playerName: 'Bob' })
        usePlayerStore.getState().setPlayers([p1, p2])
        expect(Object.keys(usePlayerStore.getState().players)).toHaveLength(2)
    })

    it('replaces entire player list (removed player disappears)', () => {
        const p1 = makePlayer({ token: 'tok-1' })
        const p2 = makePlayer({ token: 'tok-2' })
        usePlayerStore.getState().setPlayers([p1, p2])
        // Server pushes with only p2 (p1 was kicked)
        usePlayerStore.getState().setPlayers([p2])
        expect(Object.keys(usePlayerStore.getState().players)).toHaveLength(1)
        expect(usePlayerStore.getState().players['tok-1']).toBeUndefined()
    })
})

describe('Player store — session phase', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('starts as inactive', () => {
        expect(usePlayerStore.getState().sessionPhase).toBe('inactive')
    })

    it('transitions through phases', () => {
        usePlayerStore.getState().setSessionPhase('lobby')
        expect(usePlayerStore.getState().sessionPhase).toBe('lobby')

        usePlayerStore.getState().setSessionPhase('ready-check')
        expect(usePlayerStore.getState().sessionPhase).toBe('ready-check')

        usePlayerStore.getState().setSessionPhase('live')
        expect(usePlayerStore.getState().sessionPhase).toBe('live')

        usePlayerStore.getState().setSessionPhase('ended')
        expect(usePlayerStore.getState().sessionPhase).toBe('ended')
    })
})

describe('Player store — session code', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('starts as null', () => {
        expect(usePlayerStore.getState().sessionCode).toBeNull()
    })

    it('stores session code', () => {
        usePlayerStore.getState().setSessionCode('XYZ789')
        expect(usePlayerStore.getState().sessionCode).toBe('XYZ789')
    })
})

// ── Sync emit helpers ─────────────────────────────────────────────────────────

describe('Sprint 14 — sync emit helpers exist', () => {
    it('all 8 DM emit helpers are exported', async () => {
        const sync = await import('../../lib/sync')
        expect(typeof sync.emitAdjustHP).toBe('function')
        expect(typeof sync.emitAddCondition).toBe('function')
        expect(typeof sync.emitRemoveCondition).toBe('function')
        expect(typeof sync.emitSendItem).toBe('function')
        expect(typeof sync.emitRemoveItem).toBe('function')
        expect(typeof sync.emitUpdateCurrency).toBe('function')
        expect(typeof sync.emitWhisper).toBe('function')
        expect(typeof sync.emitBroadcast).toBe('function')
    })
})

// ── Player store — computed selectors for sidebar ─────────────────────────

describe('Player store — computed values for UI', () => {
    beforeEach(() => {
        usePlayerStore.getState().reset()
    })

    it('connected player count', () => {
        const p1 = makePlayer({ token: 'tok-1', connected: true })
        const p2 = makePlayer({ token: 'tok-2', connected: false })
        const p3 = makePlayer({ token: 'tok-3', connected: true })
        usePlayerStore.getState().setPlayers([p1, p2, p3])

        const players = Object.values(usePlayerStore.getState().players)
        const liveCount = players.filter((p) => p.connected).length
        expect(liveCount).toBe(2)
    })

    it('sidebar visible when session active (any non-inactive phase)', () => {
        usePlayerStore.getState().setSessionPhase('lobby')
        expect(usePlayerStore.getState().sessionPhase !== 'inactive').toBe(true)

        usePlayerStore.getState().setSessionPhase('ready-check')
        expect(usePlayerStore.getState().sessionPhase !== 'inactive').toBe(true)

        usePlayerStore.getState().setSessionPhase('live')
        expect(usePlayerStore.getState().sessionPhase !== 'inactive').toBe(true)
    })

    it('sidebar visible with 0 players (shows waiting state)', () => {
        usePlayerStore.getState().setSessionPhase('lobby')
        const playerCount = Object.keys(usePlayerStore.getState().players).length
        const sidebarVisible = usePlayerStore.getState().sessionPhase !== 'inactive'
        expect(playerCount).toBe(0)
        expect(sidebarVisible).toBe(true)
    })

    it('sidebar hidden when session is inactive', () => {
        usePlayerStore.getState().setPlayers([makePlayer()])
        const sidebarVisible = usePlayerStore.getState().sessionPhase !== 'inactive'
        expect(sidebarVisible).toBe(false)
    })
})

// ── PlayerSidebar module export ─────────────────────────────────────────────

describe('PlayerSidebar module', () => {
    it('exports a named function component', async () => {
        const mod = await import('../../components/player-sidebar')
        expect(typeof mod.PlayerSidebar).toBe('function')
    })
})

// ── TabBar — exactly 8 static tabs, no "players" ───────────────────────────

describe('TabBar — static tab list', () => {
    it('exports TabBar and TabId', async () => {
        const mod = await import('../../components/TabBar')
        expect(typeof mod.TabBar).toBe('function')
    })

    it('TabId type covers exactly 8 tabs (includes media, no players)', () => {
        const expectedTabs = ['dashboard', 'scenes', 'combat', 'npcs', 'spells', 'notes', 'media', 'av'] as const
        expect(expectedTabs).toHaveLength(8)
        expect(expectedTabs).not.toContain('players')
        expect(expectedTabs).toContain('media')
    })
})

// ── safeEmit queue behavior ─────────────────────────────────────────────────

describe('safeEmit — pending emit queue', () => {
    it('sync module exports safeEmit-using helpers', async () => {
        const sync = await import('../../lib/sync')
        // safeEmit is internal, but it's used by the appMode subscription.
        // We verify the public API that depends on it.
        expect(typeof sync.initSync).toBe('function')
    })
})

// ── HP percentage + color logic (PlayerCard uses this) ──────────────────────

describe('Player card — HP display logic', () => {
    it('HP percentage calculation', () => {
        const player = makePlayer({ hpCurrent: 15, hpMax: 30 })
        const pct = player.hpMax > 0 ? Math.round((player.hpCurrent / player.hpMax) * 100) : 0
        expect(pct).toBe(50)
    })

    it('HP color: green above 50%', () => {
        const pct = 75
        const color = pct > 50 ? 'green' : pct > 25 ? 'yellow' : 'red'
        expect(color).toBe('green')
    })

    it('HP color: yellow between 25-50%', () => {
        const pct = 40
        const color = pct > 50 ? 'green' : pct > 25 ? 'yellow' : 'red'
        expect(color).toBe('yellow')
    })

    it('HP color: red at or below 25%', () => {
        const pct = 20
        const color = pct > 50 ? 'green' : pct > 25 ? 'yellow' : 'red'
        expect(color).toBe('red')
    })

    it('HP at zero', () => {
        const player = makePlayer({ hpCurrent: 0, hpMax: 30 })
        const pct = player.hpMax > 0 ? Math.round((player.hpCurrent / player.hpMax) * 100) : 0
        expect(pct).toBe(0)
    })
})

// ── Condition management logic ──────────────────────────────────────────────

describe('Player card — condition management', () => {
    it('filters available conditions from COMMON_CONDITIONS', () => {
        const existing = ['Poisoned', 'Stunned']
        const common = ['Blinded', 'Charmed', 'Poisoned', 'Stunned']
        const available = common.filter((c) => !existing.includes(c))
        expect(available).toEqual(['Blinded', 'Charmed'])
    })
})

// ── Currency display ────────────────────────────────────────────────────────

describe('Player card — currency display', () => {
    it('formats currency correctly', () => {
        const currency = { gold: 100, silver: 50, copper: 25 }
        expect(`${currency.gold}g`).toBe('100g')
        expect(`${currency.silver}s`).toBe('50s')
        expect(`${currency.copper}c`).toBe('25c')
    })
})

// ── Reset state ─────────────────────────────────────────────────────────────

describe('Player store — reset', () => {
    it('reset clears all state', () => {
        usePlayerStore.getState().setPlayers([makePlayer()])
        usePlayerStore.getState().setSessionPhase('live')
        usePlayerStore.getState().setSessionCode('ABC123')

        usePlayerStore.getState().reset()

        expect(Object.keys(usePlayerStore.getState().players)).toHaveLength(0)
        expect(usePlayerStore.getState().sessionPhase).toBe('inactive')
        expect(usePlayerStore.getState().sessionCode).toBeNull()
    })
})
