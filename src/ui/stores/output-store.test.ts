/**
 * Output store contract tests (Sprint 9b).
 *
 * Verifies the Zustand store for AV output management:
 * - Display list tracking
 * - Output enable/disable per role (BG, GB)
 * - Fullscreen state
 * - Rule 14: one role per output slot
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useOutputStore } from './output-store'
import type { DisplayInfo } from './output-store'

const DISPLAY_1: DisplayInfo = {
    id: 1,
    label: 'Display 1 (1920×1080)',
    width: 1920,
    height: 1080,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    internal: true,
}

const DISPLAY_2: DisplayInfo = {
    id: 2,
    label: 'Display 2 (3840×2160)',
    width: 3840,
    height: 2160,
    bounds: { x: 1920, y: 0, width: 3840, height: 2160 },
    internal: false,
}

function resetStore() {
    useOutputStore.setState({
        availableDisplays: [],
        outputs: { BG: null, GB: null },
    })
}

describe('OutputStore', () => {
    beforeEach(resetStore)

    // ── Defaults ─────────────────────────────────────────────────────────────

    it('starts with no displays and no outputs', () => {
        const state = useOutputStore.getState()
        expect(state.availableDisplays).toEqual([])
        expect(state.outputs.BG).toBeNull()
        expect(state.outputs.GB).toBeNull()
    })

    // ── Display list ─────────────────────────────────────────────────────────

    it('setDisplays updates available display list', () => {
        useOutputStore.getState().setDisplays([DISPLAY_1, DISPLAY_2])
        expect(useOutputStore.getState().availableDisplays).toHaveLength(2)
        expect(useOutputStore.getState().availableDisplays[0].id).toBe(1)
        expect(useOutputStore.getState().availableDisplays[1].id).toBe(2)
    })

    it('setDisplays replaces previous list', () => {
        useOutputStore.getState().setDisplays([DISPLAY_1, DISPLAY_2])
        useOutputStore.getState().setDisplays([DISPLAY_1])
        expect(useOutputStore.getState().availableDisplays).toHaveLength(1)
    })

    // ── Enable output ────────────────────────────────────────────────────────

    it('enableOutput sets BG output config', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        const bg = useOutputStore.getState().outputs.BG
        expect(bg).not.toBeNull()
        expect(bg!.displayId).toBe(2)
        expect(bg!.role).toBe('BG')
        expect(bg!.fullscreen).toBe(true)
    })

    it('enableOutput sets GB output config', () => {
        useOutputStore.getState().enableOutput(1, 'GB')
        const gb = useOutputStore.getState().outputs.GB
        expect(gb).not.toBeNull()
        expect(gb!.displayId).toBe(1)
        expect(gb!.role).toBe('GB')
    })

    it('windowed output defaults to fullscreen false', () => {
        useOutputStore.getState().enableOutput('windowed', 'BG')
        const bg = useOutputStore.getState().outputs.BG
        expect(bg!.displayId).toBe('windowed')
        expect(bg!.fullscreen).toBe(false)
    })

    it('enabling BG does not affect GB', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        expect(useOutputStore.getState().outputs.GB).toBeNull()
    })

    it('enabling both BG and GB independently', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        useOutputStore.getState().enableOutput(1, 'GB')
        expect(useOutputStore.getState().outputs.BG!.displayId).toBe(2)
        expect(useOutputStore.getState().outputs.GB!.displayId).toBe(1)
    })

    it('re-enabling same role replaces previous config', () => {
        useOutputStore.getState().enableOutput(1, 'BG')
        useOutputStore.getState().enableOutput(2, 'BG')
        expect(useOutputStore.getState().outputs.BG!.displayId).toBe(2)
    })

    // ── Disable output ───────────────────────────────────────────────────────

    it('disableOutput nullifies BG', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        useOutputStore.getState().disableOutput('BG')
        expect(useOutputStore.getState().outputs.BG).toBeNull()
    })

    it('disableOutput nullifies GB', () => {
        useOutputStore.getState().enableOutput(1, 'GB')
        useOutputStore.getState().disableOutput('GB')
        expect(useOutputStore.getState().outputs.GB).toBeNull()
    })

    it('disabling BG does not affect GB', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        useOutputStore.getState().enableOutput(1, 'GB')
        useOutputStore.getState().disableOutput('BG')
        expect(useOutputStore.getState().outputs.BG).toBeNull()
        expect(useOutputStore.getState().outputs.GB).not.toBeNull()
    })

    it('disabling already-null output is a no-op', () => {
        useOutputStore.getState().disableOutput('BG')
        expect(useOutputStore.getState().outputs.BG).toBeNull()
    })

    // ── Fullscreen ───────────────────────────────────────────────────────────

    it('setFullscreen toggles fullscreen on active output', () => {
        useOutputStore.getState().enableOutput(2, 'BG')
        expect(useOutputStore.getState().outputs.BG!.fullscreen).toBe(true)

        useOutputStore.getState().setFullscreen('BG', false)
        expect(useOutputStore.getState().outputs.BG!.fullscreen).toBe(false)

        useOutputStore.getState().setFullscreen('BG', true)
        expect(useOutputStore.getState().outputs.BG!.fullscreen).toBe(true)
    })

    it('setFullscreen on null output is a no-op', () => {
        useOutputStore.getState().setFullscreen('GB', true)
        expect(useOutputStore.getState().outputs.GB).toBeNull()
    })

    // ── Smoke test ───────────────────────────────────────────────────────────

    it('exports useOutputStore as a function', () => {
        expect(typeof useOutputStore).toBe('function')
    })
})
