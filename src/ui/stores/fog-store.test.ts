/**
 * FogStore tests — Sprint 10g.
 *
 * Pure Zustand store tests — no mocking required.
 * Source: src/ui/stores/fog-store.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useFogStore } from './fog-store'

// ── Setup ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
    fogEnabled: false,
    brushSize: 'medium' as const,
    brushMode: 'reveal' as const,
    isEnlarged: false,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FogStore — default state', () => {
    beforeEach(() => {
        useFogStore.setState(INITIAL_STATE)
    })

    it('fogEnabled defaults to false', () => {
        expect(useFogStore.getState().fogEnabled).toBe(false)
    })

    it('brushSize defaults to medium', () => {
        expect(useFogStore.getState().brushSize).toBe('medium')
    })

    it('brushMode defaults to reveal', () => {
        expect(useFogStore.getState().brushMode).toBe('reveal')
    })

    it('isEnlarged defaults to false', () => {
        expect(useFogStore.getState().isEnlarged).toBe(false)
    })
})

describe('FogStore — setFogEnabled', () => {
    beforeEach(() => {
        useFogStore.setState(INITIAL_STATE)
    })

    it('sets fogEnabled to true', () => {
        useFogStore.getState().setFogEnabled(true)
        expect(useFogStore.getState().fogEnabled).toBe(true)
    })

    it('sets fogEnabled back to false', () => {
        useFogStore.getState().setFogEnabled(true)
        useFogStore.getState().setFogEnabled(false)
        expect(useFogStore.getState().fogEnabled).toBe(false)
    })

    it('does not affect other state fields', () => {
        useFogStore.getState().setFogEnabled(true)
        expect(useFogStore.getState().brushSize).toBe('medium')
        expect(useFogStore.getState().brushMode).toBe('reveal')
        expect(useFogStore.getState().isEnlarged).toBe(false)
    })
})

describe('FogStore — setBrushSize', () => {
    beforeEach(() => {
        useFogStore.setState(INITIAL_STATE)
    })

    it('sets brushSize to small', () => {
        useFogStore.getState().setBrushSize('small')
        expect(useFogStore.getState().brushSize).toBe('small')
    })

    it('sets brushSize to large', () => {
        useFogStore.getState().setBrushSize('large')
        expect(useFogStore.getState().brushSize).toBe('large')
    })

    it('sets brushSize back to medium', () => {
        useFogStore.getState().setBrushSize('small')
        useFogStore.getState().setBrushSize('medium')
        expect(useFogStore.getState().brushSize).toBe('medium')
    })

    it('does not affect other state fields', () => {
        useFogStore.getState().setBrushSize('large')
        expect(useFogStore.getState().fogEnabled).toBe(false)
        expect(useFogStore.getState().brushMode).toBe('reveal')
        expect(useFogStore.getState().isEnlarged).toBe(false)
    })
})

describe('FogStore — setBrushMode', () => {
    beforeEach(() => {
        useFogStore.setState(INITIAL_STATE)
    })

    it('sets brushMode to conceal', () => {
        useFogStore.getState().setBrushMode('conceal')
        expect(useFogStore.getState().brushMode).toBe('conceal')
    })

    it('sets brushMode back to reveal', () => {
        useFogStore.getState().setBrushMode('conceal')
        useFogStore.getState().setBrushMode('reveal')
        expect(useFogStore.getState().brushMode).toBe('reveal')
    })

    it('does not affect other state fields', () => {
        useFogStore.getState().setBrushMode('conceal')
        expect(useFogStore.getState().fogEnabled).toBe(false)
        expect(useFogStore.getState().brushSize).toBe('medium')
        expect(useFogStore.getState().isEnlarged).toBe(false)
    })
})

describe('FogStore — setEnlarged', () => {
    beforeEach(() => {
        useFogStore.setState(INITIAL_STATE)
    })

    it('sets isEnlarged to true', () => {
        useFogStore.getState().setEnlarged(true)
        expect(useFogStore.getState().isEnlarged).toBe(true)
    })

    it('sets isEnlarged back to false', () => {
        useFogStore.getState().setEnlarged(true)
        useFogStore.getState().setEnlarged(false)
        expect(useFogStore.getState().isEnlarged).toBe(false)
    })

    it('does not affect other state fields', () => {
        useFogStore.getState().setEnlarged(true)
        expect(useFogStore.getState().fogEnabled).toBe(false)
        expect(useFogStore.getState().brushSize).toBe('medium')
        expect(useFogStore.getState().brushMode).toBe('reveal')
    })
})
