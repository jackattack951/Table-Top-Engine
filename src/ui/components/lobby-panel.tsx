/**
 * LobbyPanel — DM-facing lobby overlay in the cockpit.
 * Renders a collapsible panel showing connected players with approve/kick controls,
 * ready check, and go-live button. Visible whenever sessionPhase !== 'inactive'.
 *
 * Sprint 11d.
 */
import { useState, useMemo } from 'react'
import { usePlayerStore } from '../stores/player-store'
import { QRCodePanel } from './qr-code-panel'
import type { PlayerCharacter } from '@shared/player-types'
import { formatModifier } from '@shared/player-types'
import {
    emitLobbyApprove,
    emitLobbyKick,
    emitReadyCheck,
    emitGoLive,
    emitEndSession,
} from '../lib/sync'

// ── Sub-component: single player card ─────────────────────────────────────────

function PlayerCard({
    player,
    sessionPhase,
}: {
    player: PlayerCharacter
    sessionPhase: string
}): JSX.Element {
    const isPending = player.status === 'pending'
    const isApproved = player.status === 'approved'
    const isReady = player.status === 'ready'
    const isLive = player.status === 'live'

    const hpPct = player.hpMax > 0 ? Math.round((player.hpCurrent / player.hpMax) * 100) : 0
    const hpBarColor =
        hpPct > 50 ? 'var(--color-success)' :
        hpPct > 25 ? 'var(--color-warning)' :
        'var(--color-danger)'

    return (
        <div className={`player-card ${!player.connected ? 'player-card--disconnected' : ''}`}>
            <div className="player-card__header">
                <div className="player-card__identity">
                    <span className="player-card__character">{player.characterName || 'Unnamed'}</span>
                    <span className="player-card__player">{player.playerName}</span>
                </div>
                <div className="player-card__connection">
                    <span className={`player-card__dot ${player.connected ? 'player-card__dot--online' : 'player-card__dot--offline'}`} />
                </div>
            </div>

            <div className="player-card__stats">
                <span className="player-card__class">
                    Lv{player.level} {player.class}
                </span>
                <span className="player-card__ac" title="Armor Class">
                    AC {player.ac}
                </span>
            </div>

            <div className="player-card__hp">
                <div className="player-card__hp-bar">
                    <div
                        className="player-card__hp-fill"
                        style={{ width: `${hpPct}%`, background: hpBarColor }}
                    />
                </div>
                <span className="player-card__hp-text">
                    {player.hpCurrent}/{player.hpMax}
                </span>
            </div>

            <div className="player-card__abilities">
                {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => {
                    const score = player.abilities[ab]
                    return (
                        <span key={ab} className="player-card__ability" title={ab}>
                            <span className="player-card__ability-label">{ab}</span>
                            <span className="player-card__ability-score">{score}</span>
                            <span className="player-card__ability-mod">
                                {formatModifier(score)}
                            </span>
                        </span>
                    )
                })}
            </div>

            {/* Status badge */}
            <div className="player-card__footer">
                <span className={`player-card__status player-card__status--${player.status}`}>
                    {isPending && 'Pending'}
                    {isApproved && 'Approved'}
                    {isReady && 'Ready'}
                    {isLive && 'Live'}
                    {player.status === 'kicked' && 'Kicked'}
                </span>

                {/* Actions — only in lobby/ready-check phases */}
                {(sessionPhase === 'lobby' || sessionPhase === 'ready-check') && (
                    <div className="player-card__actions">
                        {isPending && (
                            <button
                                className="btn btn-primary player-card__btn"
                                onClick={() => emitLobbyApprove(player.token)}
                            >
                                Approve
                            </button>
                        )}
                        {player.status !== 'kicked' && (
                            <button
                                className="btn btn-danger player-card__btn"
                                onClick={() => emitLobbyKick(player.token)}
                            >
                                Kick
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Conditions */}
            {player.conditions.length > 0 && (
                <div className="player-card__conditions">
                    {player.conditions.map((c) => (
                        <span key={c} className="player-card__condition">{c}</span>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main LobbyPanel ───────────────────────────────────────────────────────────

export function LobbyPanel(): JSX.Element | null {
    const sessionPhase = usePlayerStore((s) => s.sessionPhase)
    const sessionCode = usePlayerStore((s) => s.sessionCode)
    const players = usePlayerStore((s) => s.players)
    const [collapsed, setCollapsed] = useState(false)

    // Build companion join URL from current origin (Express on :8080)
    const companionUrl = useMemo(() => {
        if (!sessionCode || typeof window === 'undefined') return null
        const origin = window.location.origin
        return `${origin}/companion?session=${sessionCode}`
    }, [sessionCode])

    if (sessionPhase === 'inactive') return null

    const playerList = Object.values(players)
    const pendingCount = playerList.filter((p) => p.status === 'pending').length
    const approvedCount = playerList.filter((p) => p.status === 'approved' || p.status === 'ready' || p.status === 'live').length
    const readyCount = playerList.filter((p) => p.status === 'ready').length
    const allReady = approvedCount > 0 && readyCount === approvedCount
    const isLobby = sessionPhase === 'lobby'
    const isReadyCheck = sessionPhase === 'ready-check'
    const isLive = sessionPhase === 'live'
    const isEnded = sessionPhase === 'ended'

    return (
        <div className={`lobby-panel ${collapsed ? 'lobby-panel--collapsed' : ''}`}>
            <div className="lobby-panel__bar" onClick={() => setCollapsed(!collapsed)}>
                <div className="lobby-panel__bar-left">
                    <span className={`lobby-panel__phase lobby-panel__phase--${sessionPhase}`}>
                        {isLobby && 'Lobby'}
                        {isReadyCheck && 'Ready Check'}
                        {isLive && 'Live'}
                        {isEnded && 'Ended'}
                    </span>
                    <span className="lobby-panel__count">
                        {playerList.length} player{playerList.length !== 1 ? 's' : ''}
                        {pendingCount > 0 && ` (${pendingCount} pending)`}
                    </span>
                </div>

                <div className="lobby-panel__bar-right">
                    {sessionCode && (
                        <span className="lobby-panel__code" title="Session code">
                            {sessionCode}
                        </span>
                    )}
                    <span className="lobby-panel__chevron">
                        {collapsed ? '\u25BC' : '\u25B2'}
                    </span>
                </div>
            </div>

            {!collapsed && (
                <div className="lobby-panel__body">
                    {playerList.length === 0 ? (
                        <div className="lobby-panel__empty">
                            Waiting for players to join...
                        </div>
                    ) : (
                        <div className="lobby-panel__grid">
                            {playerList.map((player) => (
                                <PlayerCard
                                    key={player.token}
                                    player={player}
                                    sessionPhase={sessionPhase}
                                />
                            ))}
                        </div>
                    )}

                    {/* Mini QR for late joiners */}
                    {companionUrl && (isLobby || isReadyCheck) && (
                        <div className="lobby-panel__qr">
                            <QRCodePanel serverUrl={companionUrl} label="Players scan to join" />
                        </div>
                    )}

                    {/* Lobby controls */}
                    <div className="lobby-panel__controls">
                        {isLobby && (
                            <button
                                className="btn btn-primary"
                                onClick={emitReadyCheck}
                                disabled={approvedCount === 0}
                                title={approvedCount === 0 ? 'Approve at least one player first' : 'Send ready check to all approved players'}
                            >
                                Ready Check
                            </button>
                        )}
                        {isReadyCheck && (
                            <button
                                className="btn btn-primary"
                                onClick={emitGoLive}
                                disabled={!allReady}
                                title={allReady ? 'Start the session' : 'Waiting for all players to confirm ready'}
                            >
                                {allReady ? 'Go Live' : `Waiting (${readyCount}/${approvedCount})`}
                            </button>
                        )}
                        {isLive && (
                            <button
                                className="btn btn-danger"
                                onClick={emitEndSession}
                            >
                                End Session
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
