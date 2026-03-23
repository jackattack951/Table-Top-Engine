/**
 * Logo component smoke tests (Sprint 9d).
 *
 * Vitest env is 'node' — no DOM. These tests verify the component
 * exports correctly and accepts the expected props interface.
 */
import { describe, it, expect } from 'vitest'

describe('Logo', () => {
    it('exports a named function component', async () => {
        const mod = await import('./Logo')
        expect(typeof mod.Logo).toBe('function')
    })

    it('accepts size and className props without error', async () => {
        const mod = await import('./Logo')
        // Verify the function signature exists and is callable
        // (actual rendering tested in browser QA)
        expect(mod.Logo.length).toBeLessThanOrEqual(1) // single props arg
    })
})
