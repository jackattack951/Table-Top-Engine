import React, { useEffect, useState } from 'react'
import './index.css'
import { TabBar, type TabId } from './components/TabBar'
import { ModeToggle } from './components/ModeToggle'
import { ConnectionStatus } from './components/ConnectionStatus'
import { DevTestPanel } from './lib/DevTestPanel'
import { PerfOverlay } from './components/perf-overlay'
import { LaunchScreen } from './screens/launch-screen'
import { CinematicIntro } from './screens/cinematic-intro'
import { useSocketConnection } from './lib/use-socket'
import { useAppStore } from './stores/app-store'
import { usePlayerStore } from './stores/player-store'
import { DashboardTab } from './tabs/DashboardTab'
import { ScenesTab } from './tabs/ScenesTab'
import { CombatTab } from './tabs/CombatTab'
import { NPCsTab } from './tabs/NPCsTab'
import { SpellsTab } from './tabs/SpellsTab'
import { NotesTab } from './tabs/NotesTab'
import { MediaTab } from './tabs/MediaTab'
import { AVTab } from './tabs/AVTab'
import { PlayersTab } from './tabs/PlayersTab'
import { SettingsTab } from './tabs/SettingsTab'
import { PlayerSidebar } from './components/player-sidebar'
import { SessionControl } from './components/session-control'
import { QuickCapture } from './components/quick-capture'
import { ErrorBoundary } from './components/error-boundary'

// In Electron: electronAPI is injected by the preload script → real server on :8080
// In browser dev (npm run dev:cockpit): no electronAPI → sync.ts routes to ws-stub
const SERVER_URL = 'http://localhost:8080'

/**
 * Sprint 9c / 10j: Transition phases for the full app lifecycle.
 *
 *  intro   → (cinematic typewriter animation plays — Sprint 10j)
 *  launch  → (LaunchScreen visible, user configures and clicks Start Session)
 *  fadeOut → (launch screen fades to opacity 0, 200ms)
 *  black   → (hold black, 100ms)
 *  fadeIn  → (cockpit fades in from opacity 0, 300ms)
 *  cockpit → (transition complete, steady state)
 */
type TransitionPhase = 'intro' | 'launch' | 'fadeOut' | 'black' | 'fadeIn' | 'cockpit'

export default function App(): React.JSX.Element {
    const [activeTab, setActiveTab] = useState<TabId>('dashboard')
    const { hasLaunched, isConnected, activeCampaignName } = useAppStore()
    const sessionCode = usePlayerStore((s) => s.sessionCode)
    const sessionPhase = usePlayerStore((s) => s.sessionPhase)
    const [phase, setPhase] = useState<TransitionPhase>('intro')

    // Bootstrap Socket.io connection only after launch screen is dismissed
    useSocketConnection(SERVER_URL, hasLaunched)

    function handleIntroComplete(): void {
        setPhase('launch')
    }

    // Transition: when connected after launch, begin fade-out
    useEffect(() => {
        if (!hasLaunched || !isConnected || phase !== 'launch') return

        // Small delay to let progress bar reach 100% (500ms min display)
        const fadeTimer = setTimeout(() => setPhase('fadeOut'), 600)
        return () => clearTimeout(fadeTimer)
    }, [hasLaunched, isConnected, phase])

    // Advance through black hold → fadeIn
    useEffect(() => {
        if (phase === 'black') {
            const timer = setTimeout(() => setPhase('fadeIn'), 100)
            return () => clearTimeout(timer)
        }
    }, [phase])

    function handleFadeOutEnd(): void {
        if (phase === 'fadeOut') setPhase('black')
    }

    function handleFadeInEnd(): void {
        if (phase === 'fadeIn') setPhase('cockpit')
    }

    // Phase: intro — cinematic typewriter animation (Sprint 10j)
    if (phase === 'intro') {
        return <CinematicIntro onComplete={handleIntroComplete} />
    }

    // Phases: launch / fadeOut — show the launch screen
    if (phase === 'launch' || phase === 'fadeOut') {
        return (
            <div
                className={phase === 'fadeOut' ? 'screen-fade-out' : undefined}
                onAnimationEnd={handleFadeOutEnd}
            >
                <LaunchScreen />
            </div>
        )
    }

    // Phase: black — brief hold on black bg
    if (phase === 'black') {
        return <div className="app-black-phase" />
    }

    function renderTab() {
        switch (activeTab) {
            case 'dashboard': return <DashboardTab />
            case 'scenes': return <ScenesTab />
            case 'combat': return <CombatTab />
            case 'npcs': return <NPCsTab />
            case 'spells': return <SpellsTab />
            case 'notes': return <NotesTab />
            case 'media': return <MediaTab />
            case 'players': return <PlayersTab />
            case 'av': return <AVTab onNavigateToSettings={() => setActiveTab('settings')} />
            case 'settings': return <SettingsTab />
        }
    }

    // Phases: fadeIn / cockpit — show the cockpit
    return (
        <div
            className={phase === 'fadeIn' ? 'screen-fade-in' : undefined}
            onAnimationEnd={handleFadeInEnd}
        >
            <div className="cockpit-shell">
                <header className="cockpit-header">
                    <span className="cockpit-header__title">Stage Manager</span>
                    <div className="cockpit-header__actions">
                        {sessionPhase !== 'inactive' && sessionCode && (
                            <span className="cockpit-header__session" title="Session code — share with players">
                                Session: <code>{sessionCode}</code>
                            </span>
                        )}
                        <SessionControl />
                        <ConnectionStatus />
                        <ModeToggle />
                    </div>
                </header>

                <div className="campaign-header">
                    <span className="campaign-header__name" aria-label="Active campaign">
                        {activeCampaignName}
                    </span>
                </div>

                <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

                <div className="cockpit-main">
                    <main
                        className="tab-content"
                        role="tabpanel"
                        id={`tabpanel-${activeTab}`}
                        aria-labelledby={`tab-${activeTab}`}
                    >
                        <ErrorBoundary key={activeTab}>
                            {renderTab()}
                        </ErrorBoundary>
                    </main>

                    {sessionPhase !== 'inactive' && (
                        <PlayerSidebar />
                    )}
                </div>

                <DevTestPanel />
                <PerfOverlay />
                <QuickCapture />
            </div>
        </div>
    )
}
