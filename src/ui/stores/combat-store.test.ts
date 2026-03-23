/**
 * CombatStore tests.
 *
 * The store is a pure Zustand store with no side effects — no mocking required.
 * We call store actions directly and assert on state.
 *
 * Source: src/ui/stores/combat-store.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCombatStore } from './combat-store'
import type { Combatant } from '@core/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
    return {
        id: 'c1',
        name: 'Fighter',
        npcId: null,
        initiative: 15,
        hpCurrent: 30,
        hpMax: 30,
        ac: 16,
        conditions: [],
        sortOrder: 0,
        isPlayer: true,
        ...overrides,
    }
}

function seedTwoCombatants(): void {
    const store = useCombatStore.getState()
    store.reset()
    store.setCombatants([
        makeCombatant({ id: 'c1', name: 'Fighter', sortOrder: 0 }),
        makeCombatant({ id: 'c2', name: 'Rogue', sortOrder: 1, hpCurrent: 20, hpMax: 20 }),
    ])
    // Put c1 as the active combatant
    // nextTurn from null → index 0 is the first call behavior; manually prime:
    useCombatStore.setState({ activeCombatantId: 'c1', currentRound: 1 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CombatStore — nextTurn', () => {
    beforeEach(() => {
        useCombatStore.getState().reset()
    })

    it('advances activeCombatantId to the next combatant', () => {
        seedTwoCombatants()
        useCombatStore.getState().nextTurn()
        expect(useCombatStore.getState().activeCombatantId).toBe('c2')
    })

    it('wraps back to index 0 after the last combatant', () => {
        seedTwoCombatants()
        useCombatStore.setState({ activeCombatantId: 'c2' }) // last combatant
        useCombatStore.getState().nextTurn()
        expect(useCombatStore.getState().activeCombatantId).toBe('c1')
    })

    it('increments currentRound when wrapping back to index 0', () => {
        seedTwoCombatants()
        useCombatStore.setState({ activeCombatantId: 'c2', currentRound: 1 })
        useCombatStore.getState().nextTurn()
        expect(useCombatStore.getState().currentRound).toBe(2)
    })

    it('does NOT increment currentRound when not wrapping', () => {
        seedTwoCombatants()
        useCombatStore.setState({ activeCombatantId: 'c1', currentRound: 1 })
        useCombatStore.getState().nextTurn()
        expect(useCombatStore.getState().currentRound).toBe(1)
    })
})

describe('CombatStore — adjustHP', () => {
    beforeEach(() => {
        useCombatStore.getState().reset()
        useCombatStore.getState().setCombatants([
            makeCombatant({ id: 'c1', hpCurrent: 30, hpMax: 30 }),
        ])
    })

    it('reduces HP by 14 when adjustHP is called with -14', () => {
        useCombatStore.getState().adjustHP('c1', -14)
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.hpCurrent).toBe(16)
    })

    it('floors HP at 0 when damage exceeds current HP', () => {
        useCombatStore.getState().adjustHP('c1', -9999)
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.hpCurrent).toBe(0)
    })

    it('does not reduce HP below 0 (never negative)', () => {
        useCombatStore.getState().adjustHP('c1', -50)
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.hpCurrent).toBeGreaterThanOrEqual(0)
    })

    it('increases HP when a positive amount is given (healing)', () => {
        useCombatStore.getState().adjustHP('c1', -10) // take damage first
        useCombatStore.getState().adjustHP('c1', 5)   // heal 5
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.hpCurrent).toBe(25)
    })

    it('caps HP at hpMax when healing exceeds maximum', () => {
        useCombatStore.getState().adjustHP('c1', +9999)
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.hpCurrent).toBe(c.hpMax)
        expect(c.hpCurrent).toBe(30)
    })
})

describe('CombatStore — toggleCondition', () => {
    beforeEach(() => {
        useCombatStore.getState().reset()
        useCombatStore.getState().setCombatants([
            makeCombatant({ id: 'c1', conditions: [] }),
        ])
    })

    it('adds the condition when not already present', () => {
        useCombatStore.getState().toggleCondition('c1', 'poisoned')
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.conditions).toContain('poisoned')
    })

    it('removes the condition when already present (idempotent toggle)', () => {
        useCombatStore.getState().toggleCondition('c1', 'poisoned')
        useCombatStore.getState().toggleCondition('c1', 'poisoned')
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.conditions).not.toContain('poisoned')
    })

    it('toggling twice leaves no duplicate entries', () => {
        useCombatStore.getState().toggleCondition('c1', 'stunned')
        useCombatStore.getState().toggleCondition('c1', 'stunned')
        useCombatStore.getState().toggleCondition('c1', 'stunned')
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        // Three toggles: add → remove → add; should be present once
        expect(c.conditions.filter((x) => x === 'stunned')).toHaveLength(1)
    })

    it('multiple different conditions can coexist', () => {
        useCombatStore.getState().toggleCondition('c1', 'poisoned')
        useCombatStore.getState().toggleCondition('c1', 'prone')
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.conditions).toContain('poisoned')
        expect(c.conditions).toContain('prone')
    })

    it('conditions array never has duplicates after many toggles', () => {
        // Five toggles → ends in ON state
        for (let i = 0; i < 5; i++) {
            useCombatStore.getState().toggleCondition('c1', 'blinded')
        }
        const c = useCombatStore.getState().combatants.find((x) => x.id === 'c1')!
        expect(c.conditions.filter((x) => x === 'blinded').length).toBeLessThanOrEqual(1)
    })
})

// ── Sprint 4: addCombatant ────────────────────────────────────────────────────

describe('CombatStore — addCombatant', () => {
    beforeEach(() => {
        useCombatStore.getState().reset()
    })

    it('adds a new combatant to the list', () => {
        useCombatStore.getState().addCombatant({
            name: 'Wizard', npcId: null, initiative: 18,
            hpCurrent: 20, hpMax: 20, ac: 12, conditions: [], isPlayer: true,
        })
        expect(useCombatStore.getState().combatants).toHaveLength(1)
        expect(useCombatStore.getState().combatants[0]!.name).toBe('Wizard')
    })

    it('assigns a unique string ID to each added combatant', () => {
        useCombatStore.getState().addCombatant({
            name: 'A', npcId: null, initiative: 10,
            hpCurrent: 10, hpMax: 10, ac: 10, conditions: [], isPlayer: true,
        })
        useCombatStore.getState().addCombatant({
            name: 'B', npcId: null, initiative: 8,
            hpCurrent: 10, hpMax: 10, ac: 10, conditions: [], isPlayer: false,
        })
        const [a, b] = useCombatStore.getState().combatants
        expect(a!.id).toBeTypeOf('string')
        expect(a!.id).not.toBe(b!.id)
    })

    it('sorts combatants by initiative descending after adding', () => {
        useCombatStore.getState().addCombatant({
            name: 'Low', npcId: null, initiative: 5,
            hpCurrent: 10, hpMax: 10, ac: 10, conditions: [], isPlayer: false,
        })
        useCombatStore.getState().addCombatant({
            name: 'High', npcId: null, initiative: 20,
            hpCurrent: 10, hpMax: 10, ac: 10, conditions: [], isPlayer: true,
        })
        useCombatStore.getState().addCombatant({
            name: 'Mid', npcId: null, initiative: 12,
            hpCurrent: 10, hpMax: 10, ac: 10, conditions: [], isPlayer: true,
        })
        const names = useCombatStore.getState().combatants.map((c) => c.name)
        expect(names[0]).toBe('High')   // 20
        expect(names[1]).toBe('Mid')    // 12
        expect(names[2]).toBe('Low')    // 5
    })

    it('sets the first combatant as activeCombatantId when none was set', () => {
        useCombatStore.setState({ activeCombatantId: null })
        useCombatStore.getState().addCombatant({
            name: 'Fighter', npcId: null, initiative: 15,
            hpCurrent: 30, hpMax: 30, ac: 16, conditions: [], isPlayer: true,
        })
        const state = useCombatStore.getState()
        expect(state.activeCombatantId).toBe(state.combatants[0]!.id)
    })
})

// ── Sprint 4: removeCombatant ─────────────────────────────────────────────────

describe('CombatStore — removeCombatant', () => {
    beforeEach(() => {
        useCombatStore.getState().reset()
        useCombatStore.getState().setCombatants([
            makeCombatant({ id: 'c1', name: 'Fighter', sortOrder: 0, initiative: 15 }),
            makeCombatant({ id: 'c2', name: 'Rogue',   sortOrder: 1, initiative: 12 }),
            makeCombatant({ id: 'c3', name: 'Wizard',  sortOrder: 2, initiative: 8 }),
        ])
        useCombatStore.setState({ activeCombatantId: 'c1' })
    })

    it('removes the combatant with the given ID', () => {
        useCombatStore.getState().removeCombatant('c2')
        const ids = useCombatStore.getState().combatants.map((c) => c.id)
        expect(ids).not.toContain('c2')
        expect(ids).toContain('c1')
        expect(ids).toContain('c3')
    })

    it('reassigns sortOrder sequentially after removal', () => {
        useCombatStore.getState().removeCombatant('c1')
        const orders = useCombatStore.getState().combatants.map((c) => c.sortOrder)
        expect(orders).toEqual([0, 1])
    })

    it('advances activeCombatantId when the active combatant is removed', () => {
        useCombatStore.setState({ activeCombatantId: 'c1' })
        useCombatStore.getState().removeCombatant('c1')
        const activeId = useCombatStore.getState().activeCombatantId
        expect(activeId).not.toBe('c1')
        const remainingIds = useCombatStore.getState().combatants.map((c) => c.id)
        if (activeId !== null) {
            expect(remainingIds).toContain(activeId)
        }
    })

    it('sets activeCombatantId to null when the last combatant is removed', () => {
        useCombatStore.getState().reset()
        useCombatStore.getState().setCombatants([
            makeCombatant({ id: 'only', initiative: 10 }),
        ])
        useCombatStore.setState({ activeCombatantId: 'only' })
        useCombatStore.getState().removeCombatant('only')
        expect(useCombatStore.getState().activeCombatantId).toBeNull()
        expect(useCombatStore.getState().combatants).toHaveLength(0)
    })
})
