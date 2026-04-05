/**
 * PlayersTab — DM-facing player management panel (Sprint 14).
 *
 * Shows all connected players as expandable cards with HP, conditions,
 * inventory, currency, and whisper controls. Includes a broadcast panel
 * for sending messages/items to all players at once.
 *
 * Visible only when session is live and players are connected (conditional tab).
 */
import React, { useState } from 'react'
import { usePlayerStore } from '../stores/player-store'
import { PlayerCard } from './players/player-card'
import { RollPromptPanel } from './players/roll-prompt-panel'
import { CharacterRosterPanel } from './players/character-roster-panel'
import { CopyButton } from '../components/copy-button'
import { emitBroadcast, emitWhisper } from '../lib/sync'

// ── Broadcast Panel ─────────────────────────────────────────────────────────

function BroadcastPanel(): React.JSX.Element {
    const [message, setMessage] = useState('')
    const players = usePlayerStore((s) => s.players)

    const send = () => {
        if (!message.trim()) return
        emitBroadcast('message', message.trim())
        setMessage('')
    }

    const whisperAll = () => {
        if (!message.trim()) return
        const tokens = Object.keys(players)
        if (tokens.length === 0) return
        emitWhisper(tokens, message.trim())
        setMessage('')
    }

    return (
        <div className="players-broadcast">
            <span className="players-broadcast__title">Broadcast</span>
            <div className="players-broadcast__form">
                <input
                    className="form-input players-broadcast__input"
                    placeholder="Message to all players..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <button className="btn btn-primary" onClick={send} disabled={!message.trim()}>
                    Broadcast
                </button>
                <button className="btn btn-secondary" onClick={whisperAll} disabled={!message.trim()}>
                    Whisper All
                </button>
            </div>
        </div>
    )
}

// ── Main Tab ────────────────────────────────────────────────────────────────

export function PlayersTab(): React.JSX.Element {
    const players = usePlayerStore((s) => s.players)
    const sessionCode = usePlayerStore((s) => s.sessionCode)

    const playerList = Object.values(players)
    const liveCount = playerList.filter((p) => p.connected).length

    return (
        <div className="players-tab">
            {/* Header */}
            <div className="players-tab__header">
                <span className="players-tab__title">
                    Players ({liveCount}/{playerList.length} connected)
                </span>
                {sessionCode && (
                    <span className="players-tab__session-code">
                        Session: <code>{sessionCode}</code>
                        <CopyButton text={sessionCode} className="btn btn-ghost players-tab__copy-btn" label="Copy session code" />
                    </span>
                )}
            </div>

            {/* Broadcast */}
            <BroadcastPanel />

            {/* Character Roster */}
            <CharacterRosterPanel />

            {/* Roll Prompt */}
            <RollPromptPanel />

            {/* Player cards */}
            <div className="players-tab__grid">
                {playerList.length === 0 ? (
                    <div className="tab-placeholder tab-placeholder--compact">
                        <span className="tab-placeholder__icon">&#127918;</span>
                        <div className="tab-placeholder__title">No players connected</div>
                        <p className="tab-placeholder__desc">
                            Share the session code with your players to get started.
                        </p>
                    </div>
                ) : (
                    playerList.map((player) => (
                        <PlayerCard key={player.token} player={player} />
                    ))
                )}
            </div>
        </div>
    )
}
