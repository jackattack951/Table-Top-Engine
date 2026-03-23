/**
 * LobbyScreen — companion player waiting/lobby screen.
 * Shows after join, while waiting for DM approval.
 * Displays player's submitted info + current status + ready check prompt.
 *
 * Sprint 11d.
 */
import { useCompanionStore } from '../stores/companion-store'
import { companionEmit } from '../lib/companion-sync'
import { vibrate } from '../lib/haptics'
import { EVENTS } from '@shared/socket-events'
import { formatModifier } from '@shared/player-types'
import { useState, useEffect } from 'react'

export function LobbyScreen(): JSX.Element {
    const {
        playerName, characterName, class: charClass, level,
        hpCurrent, hpMax, ac, abilities,
        status, sessionCode, connected,
    } = useCompanionStore()

    const [readyCheckActive, setReadyCheckActive] = useState(false)
    const [readyConfirmed, setReadyConfirmed] = useState(false)

    // Track ready status from store
    useEffect(() => {
        if (status === 'ready') {
            setReadyConfirmed(true)
            setReadyCheckActive(true)
        }
    }, [status])

    // Listen for ready check custom event dispatched by companion-sync
    useEffect(() => {
        function onReadyCheck(): void {
            setReadyCheckActive(true)
        }
        window.addEventListener('companion:readyCheck', onReadyCheck)
        return () => window.removeEventListener('companion:readyCheck', onReadyCheck)
    }, [])

    function handleReady(): void {
        const token = useCompanionStore.getState().token
        companionEmit(EVENTS.LOBBY_READY_CONFIRM, { token })
        setReadyConfirmed(true)
    }

    const isPending = status === 'pending' || status === null
    const isApproved = status === 'approved'
    const isReady = status === 'ready'

    // Vibrate on ready check (mobile attention grab)
    useEffect(() => {
        if (readyCheckActive && !readyConfirmed) {
            vibrate([200, 100, 200])
        }
    }, [readyCheckActive, readyConfirmed])

    return (
        <div className="lobby-screen">
            {/* Connection indicator */}
            <div className="lobby-screen__connection">
                <span className={`lobby-screen__dot ${connected ? 'lobby-screen__dot--online' : 'lobby-screen__dot--offline'}`} />
                <span className="lobby-screen__connection-text">
                    {connected ? 'Connected' : 'Reconnecting...'}
                </span>
            </div>

            {/* Status banner */}
            <div className={`lobby-screen__banner lobby-screen__banner--${isPending ? 'pending' : isApproved ? 'approved' : 'ready'}`}>
                {isPending && (
                    <>
                        <div className="lobby-screen__pulse" />
                        <span className="lobby-screen__banner-text">Waiting for DM approval</span>
                    </>
                )}
                {isApproved && !readyCheckActive && (
                    <span className="lobby-screen__banner-text">Approved — waiting for session to start</span>
                )}
                {isApproved && readyCheckActive && !readyConfirmed && (
                    <span className="lobby-screen__banner-text">Ready check!</span>
                )}
                {isReady && (
                    <span className="lobby-screen__banner-text">Ready — waiting for everyone</span>
                )}
            </div>

            {/* Ready check action */}
            {isApproved && readyCheckActive && !readyConfirmed && (
                <button className="btn btn-primary lobby-screen__ready-btn lobby-screen__ready-btn--pulse" onClick={handleReady}>
                    I'm Ready
                </button>
            )}

            {/* Character summary card */}
            <div className={`lobby-screen__card${isPending ? ' lobby-screen__card--pending' : ''}${isApproved ? ' lobby-screen__card--approved' : ''}`}>
                <div className="lobby-screen__card-header">
                    <span className="lobby-screen__character-name">{characterName || 'Unnamed'}</span>
                    <span className="lobby-screen__player-name">{playerName}</span>
                </div>

                <div className="lobby-screen__card-stats">
                    <span className="lobby-screen__stat">
                        Lv{level} {charClass}
                    </span>
                    <span className="lobby-screen__stat">
                        AC {ac}
                    </span>
                    <span className="lobby-screen__stat">
                        HP {hpCurrent}/{hpMax}
                    </span>
                </div>

                <div className="lobby-screen__abilities">
                    {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => {
                        const score = abilities[ab]
                        return (
                            <div key={ab} className="lobby-screen__ability">
                                <span className="lobby-screen__ability-label">{ab}</span>
                                <span className="lobby-screen__ability-score">{score}</span>
                                <span className="lobby-screen__ability-mod">
                                    {formatModifier(score)}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Session code footer */}
            {sessionCode && (
                <div className="lobby-screen__footer">
                    <span className="lobby-screen__footer-label">Session</span>
                    <span className="lobby-screen__footer-code">{sessionCode}</span>
                </div>
            )}
        </div>
    )
}
