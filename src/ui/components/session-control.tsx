/**
 * SessionControl — persistent session lifecycle button in the cockpit header.
 * Shows phase-appropriate actions: Start Game, Go Live, End Session.
 * Visible only when a session is active (sessionPhase !== 'inactive').
 */
import React from 'react'
import { usePlayerStore } from '../stores/player-store'
import { emitGoLive, emitEndSession } from '../lib/sync'

export function SessionControl(): React.JSX.Element | null {
    const sessionPhase = usePlayerStore((s) => s.sessionPhase)
    const players = usePlayerStore((s) => s.players)

    if (sessionPhase === 'inactive' || sessionPhase === 'ended') return null

    const playerList = Object.values(players)
    const approvedCount = playerList.filter(
        (p) => p.status === 'approved' || p.status === 'ready'
    ).length

    if (sessionPhase === 'lobby' || sessionPhase === 'ready-check') {
        return (
            <button
                className="btn btn-sm session-control session-control--start"
                onClick={emitGoLive}
                disabled={approvedCount === 0}
                title={approvedCount === 0 ? 'Approve at least one player first' : 'Start the session for all approved players'}
            >
                Start Game
            </button>
        )
    }

    // sessionPhase === 'live'
    const handleEnd = () => {
        if (window.confirm('End session? All players will be disconnected.')) {
            emitEndSession()
        }
    }

    return (
        <button
            className="btn btn-sm session-control session-control--end"
            onClick={handleEnd}
            title="End the current session"
        >
            End Session
        </button>
    )
}
