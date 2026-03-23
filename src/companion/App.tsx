/**
 * Player Companion root component.
 * State-machine routing: join → lobby → dashboard → ended/expired
 *
 * Phase is driven by companion-store, updated via companion-sync socket events.
 * Sprint 11c: Join screen implemented. Sprint 12: lobby. Sprint 13: dashboard.
 */
import { useCompanionStore } from './stores/companion-store'
import { JoinScreen } from './screens/join-screen'
import { LobbyScreen } from './screens/lobby-screen'
import { DashboardScreen } from './screens/dashboard-screen'

export function App(): JSX.Element {
    const phase = useCompanionStore((s) => s.phase)

    return (
        <div className="companion-app">
            {phase === 'join' && <JoinScreen />}

            {phase === 'lobby' && <LobbyScreen />}

            {phase === 'dashboard' && <DashboardScreen />}

            {phase === 'ended' && (
                <div className="companion-app__placeholder">
                    <h1>Session Ended</h1>
                    <p>The DM has ended this session. Thanks for playing!</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => useCompanionStore.getState().reset()}
                    >
                        Join Another Session
                    </button>
                </div>
            )}

            {phase === 'expired' && (
                <div className="companion-app__placeholder">
                    <h1>Session Not Found</h1>
                    <p>This session has expired or the code is invalid.</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => useCompanionStore.getState().reset()}
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    )
}
