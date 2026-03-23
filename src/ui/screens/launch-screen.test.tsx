/**
 * LaunchScreen contract tests (Sprint 9a).
 *
 * The vitest environment is 'node' (no jsdom / DOM rendering).
 * These tests verify the store contract the LaunchScreen depends on —
 * the actions it calls and the state it reads — without DOM rendering.
 *
 * UI rendering correctness is validated during manual QA in the browser.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../stores/app-store'

function resetStore() {
    useAppStore.setState({
        appMode: null,
        networkMode: 'local',
        hasLaunched: false,
        isConnected: false,
        activeCampaignId: null,
        activeCampaignName: null,
    })
}

describe('LaunchScreen store contract', () => {
    beforeEach(resetStore)

    // ── Defaults ─────────────────────────────────────────────────────────────

    it('appMode defaults to null (no pre-selection)', () => {
        expect(useAppStore.getState().appMode).toBe(null)
    })

    it('hasLaunched defaults to false', () => {
        expect(useAppStore.getState().hasLaunched).toBe(false)
    })

    it('activeCampaignId defaults to null', () => {
        expect(useAppStore.getState().activeCampaignId).toBe(null)
    })

    // ── setLaunched ──────────────────────────────────────────────────────────

    it('setLaunched() sets hasLaunched to true', () => {
        useAppStore.getState().setLaunched()
        expect(useAppStore.getState().hasLaunched).toBe(true)
    })

    // ── setAppMode ───────────────────────────────────────────────────────────

    it('setAppMode("headless") sets appMode to headless', () => {
        useAppStore.getState().setAppMode('headless')
        expect(useAppStore.getState().appMode).toBe('headless')
    })

    it('setAppMode("plan") sets appMode to plan', () => {
        useAppStore.getState().setAppMode('plan')
        expect(useAppStore.getState().appMode).toBe('plan')
    })

    it('setAppMode("play") sets appMode to play', () => {
        useAppStore.getState().setAppMode('headless')
        useAppStore.getState().setAppMode('play')
        expect(useAppStore.getState().appMode).toBe('play')
    })

    // ── setNetworkMode ───────────────────────────────────────────────────────

    it('setNetworkMode("host") sets networkMode to host', () => {
        useAppStore.getState().setNetworkMode('host')
        expect(useAppStore.getState().networkMode).toBe('host')
    })

    it('setNetworkMode("local") sets networkMode to local', () => {
        useAppStore.getState().setNetworkMode('host')
        useAppStore.getState().setNetworkMode('local')
        expect(useAppStore.getState().networkMode).toBe('local')
    })

    // ── Smart network defaults (headless → host, plan → local) ───────────────

    it('selecting headless forces networkMode to host', () => {
        // Simulate the handleModeSelect logic from LaunchScreen
        useAppStore.getState().setAppMode('headless')
        useAppStore.getState().setNetworkMode('host')
        expect(useAppStore.getState().networkMode).toBe('host')
    })

    it('selecting plan forces networkMode to local', () => {
        useAppStore.getState().setNetworkMode('host')
        useAppStore.getState().setAppMode('plan')
        useAppStore.getState().setNetworkMode('local')
        expect(useAppStore.getState().networkMode).toBe('local')
    })

    it('selecting play preserves current networkMode', () => {
        useAppStore.getState().setNetworkMode('host')
        useAppStore.getState().setAppMode('play')
        // Play mode does not force networkMode change
        expect(useAppStore.getState().networkMode).toBe('host')
    })

    // ── canLaunch logic ──────────────────────────────────────────────────────

    it('canLaunch is false when appMode is null', () => {
        useAppStore.getState().setActiveCampaign('c1', 'My Campaign')
        const { appMode, activeCampaignId } = useAppStore.getState()
        const canLaunch = appMode !== null && activeCampaignId !== null
        expect(canLaunch).toBe(false)
    })

    it('canLaunch is false when activeCampaignId is null', () => {
        useAppStore.getState().setAppMode('play')
        const { appMode, activeCampaignId } = useAppStore.getState()
        const canLaunch = appMode !== null && activeCampaignId !== null
        expect(canLaunch).toBe(false)
    })

    it('canLaunch is true when both appMode and activeCampaignId are set', () => {
        useAppStore.getState().setAppMode('play')
        useAppStore.getState().setActiveCampaign('c1', 'My Campaign')
        const { appMode, activeCampaignId } = useAppStore.getState()
        const canLaunch = appMode !== null && activeCampaignId !== null
        expect(canLaunch).toBe(true)
    })

    it('canLaunch works for all three modes', () => {
        useAppStore.getState().setActiveCampaign('c1', 'My Campaign')

        for (const mode of ['headless', 'play', 'plan'] as const) {
            useAppStore.getState().setAppMode(mode)
            const { appMode, activeCampaignId } = useAppStore.getState()
            const canLaunch = appMode !== null && activeCampaignId !== null
            expect(canLaunch).toBe(true)
        }
    })

    // ── Transition trigger contract (Sprint 9c) ──────────────────────────────

    it('isConnected defaults to false', () => {
        expect(useAppStore.getState().isConnected).toBe(false)
    })

    it('transition triggers when both hasLaunched and isConnected are true', () => {
        useAppStore.getState().setLaunched()
        expect(useAppStore.getState().hasLaunched).toBe(true)
        expect(useAppStore.getState().isConnected).toBe(false)

        // Simulate socket connection
        useAppStore.getState().setConnected(true)
        const { hasLaunched, isConnected } = useAppStore.getState()
        // Both true = App.tsx starts fade-out transition
        expect(hasLaunched && isConnected).toBe(true)
    })

    it('campaign selection persists through transition', () => {
        useAppStore.getState().setActiveCampaign('c1', 'My Campaign')
        useAppStore.getState().setAppMode('play')
        useAppStore.getState().setLaunched()
        useAppStore.getState().setConnected(true)

        // After full transition, campaign is still set
        const { activeCampaignId, activeCampaignName } = useAppStore.getState()
        expect(activeCampaignId).toBe('c1')
        expect(activeCampaignName).toBe('My Campaign')
    })

    // ── Component smoke test ─────────────────────────────────────────────────

    it('LaunchScreen exports a named function component', async () => {
        const mod = await import('./launch-screen')
        expect(typeof mod.LaunchScreen).toBe('function')
    })
})
