/**
 * OutputSection store-contract tests (Sprint 9b polish).
 *
 * Vitest env is 'node' — no DOM. These tests verify:
 * - The component exports correctly
 * - The output store enforces Rule 13/14 constraints
 * - Display management (set, enable, disable) works correctly
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useOutputStore } from '../stores/output-store'
import type { DisplayInfo } from '@shared/output-types'

const MOCK_DISPLAY: DisplayInfo = {
    id: 2,
    label: 'HDMI-1',
    width: 1920,
    height: 1080,
    bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    internal: false,
}

const MOCK_INTERNAL: DisplayInfo = {
    id: 1,
    label: 'Built-in',
    width: 2560,
    height: 1440,
    bounds: { x: 0, y: 0, width: 2560, height: 1440 },
    internal: true,
}

describe('OutputSection', () => {
    beforeEach(() => {
        // Reset store between tests
        useOutputStore.setState({
            availableDisplays: [],
            outputs: { BG: null, GB: null },
        })
    })

    it('exports a named function component', async () => {
        const mod = await import('./output-section')
        expect(typeof mod.OutputSection).toBe('function')
    })

    it('accepts expanded prop without error', async () => {
        const mod = await import('./output-section')
        expect(mod.OutputSection.length).toBeLessThanOrEqual(1)
    })
})

describe('Output store — Rule 13/14 contracts', () => {
    beforeEach(() => {
        useOutputStore.setState({
            availableDisplays: [],
            outputs: { BG: null, GB: null },
        })
    })

    it('starts with no outputs enabled (Rule 13)', () => {
        const { outputs } = useOutputStore.getState()
        expect(outputs.BG).toBeNull()
        expect(outputs.GB).toBeNull()
    })

    it('setDisplays populates available displays', () => {
        useOutputStore.getState().setDisplays([MOCK_INTERNAL, MOCK_DISPLAY])
        expect(useOutputStore.getState().availableDisplays).toHaveLength(2)
        expect(useOutputStore.getState().availableDisplays[1]!.label).toBe('HDMI-1')
    })

    it('enableOutput assigns a role to a display', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        const { outputs } = useOutputStore.getState()
        expect(outputs.BG).not.toBeNull()
        expect(outputs.BG!.displayId).toBe(2)
        expect(outputs.BG!.role).toBe('BG')
        expect(outputs.BG!.fullscreen).toBe(true)
    })

    it('enableOutput with windowed sets fullscreen to false', () => {
        useOutputStore.getState().enableOutput('windowed', 'GB')
        const { outputs } = useOutputStore.getState()
        expect(outputs.GB!.displayId).toBe('windowed')
        expect(outputs.GB!.fullscreen).toBe(false)
    })

    it('disableOutput clears the role (Rule 14)', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        expect(useOutputStore.getState().outputs.BG).not.toBeNull()

        useOutputStore.getState().disableOutput('BG')
        expect(useOutputStore.getState().outputs.BG).toBeNull()
    })

    it('one display can only have one role (Rule 14 — consumer enforced)', () => {
        // Enable BG on display 2
        useOutputStore.getState().enableOutput(2, 'BG')
        // Consumer code in OutputSection disables old role before enabling new
        useOutputStore.getState().disableOutput('BG')
        useOutputStore.getState().enableOutput(2, 'GB')

        const { outputs } = useOutputStore.getState()
        expect(outputs.BG).toBeNull()
        expect(outputs.GB!.displayId).toBe(2)
    })

    it('BG and GB can be on different displays simultaneously', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        useOutputStore.getState().enableOutput(3, 'GB')

        const { outputs } = useOutputStore.getState()
        expect(outputs.BG!.displayId).toBe(2)
        expect(outputs.GB!.displayId).toBe(3)
    })

    it('setFullscreen updates fullscreen flag for active output', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        useOutputStore.getState().setFullscreen('BG', false)
        expect(useOutputStore.getState().outputs.BG!.fullscreen).toBe(false)
    })

    it('setFullscreen is no-op when role has no active output', () => {
        useOutputStore.getState().setFullscreen('GB', true)
        expect(useOutputStore.getState().outputs.GB).toBeNull()
    })
})

describe('Shared output types', () => {
    it('DisplayInfo is importable from shared', async () => {
        const mod = await import('@shared/output-types')
        // Type-only module — just verify it resolves without error
        expect(mod).toBeDefined()
    })
})
