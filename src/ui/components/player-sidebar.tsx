/**
 * PlayerSidebar — persistent right-side panel for DM player management.
 * Replaces the Players tab with an always-visible collapsible sidebar.
 * Shows when session is active (sessionPhase !== 'inactive').
 *
 * Collapsed: 48px strip with player count badge.
 * Expanded: 320px panel with broadcast, scrollable player cards.
 */
import React, { useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { usePlayerStore } from '../stores/player-store'
import { useAppStore } from '../stores/app-store'
import { PlayerCard } from '../tabs/players/player-card'
import { emitBroadcast, emitWhisper, emitQROverlay, getServerUrl } from '../lib/sync'

// ── Broadcast Sub-Component ──────────────────────────────────────────────────

function SidebarBroadcast(): React.JSX.Element {
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
        <div className="player-sidebar__broadcast">
            <div className="player-sidebar__broadcast-form">
                <input
                    className="form-input player-sidebar__broadcast-input"
                    placeholder="Message all..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <div className="player-sidebar__broadcast-actions">
                    <button className="btn btn-primary btn-sm" onClick={send} disabled={!message.trim()}>
                        Broadcast
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={whisperAll} disabled={!message.trim()}>
                        Whisper All
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main Sidebar ─────────────────────────────────────────────────────────────

export function PlayerSidebar(): React.JSX.Element {
    const [collapsed, setCollapsed] = useState(false)
    const [qrShowing, setQrShowing] = useState(false)
    const sessionCode = usePlayerStore((s) => s.sessionCode)
    const players = usePlayerStore((s) => s.players)
    const networkMode = useAppStore((s) => s.networkMode)

    const playerList = Object.values(players)
    const connectedCount = playerList.filter((p) => p.connected).length

    const toggleQROverlay = useCallback(async () => {
        if (qrShowing) {
            emitQROverlay(false)
            setQrShowing(false)
        } else if (sessionCode && networkMode === 'host') {
            try {
                const companionUrl = `${getServerUrl()}/companion/`
                const qrDataUrl = await QRCode.toDataURL(companionUrl, {
                    width: 512,
                    margin: 2,
                    color: { dark: '#ffffff', light: '#00000000' },
                })
                emitQROverlay(true, qrDataUrl, sessionCode)
                setQrShowing(true)
            } catch (err) {
                console.error('[sidebar] QR generation failed:', err)
            }
        }
    }, [qrShowing, sessionCode, networkMode])

    if (collapsed) {
        return (
            <aside className="player-sidebar player-sidebar--collapsed">
                <button
                    className="player-sidebar__toggle"
                    onClick={() => setCollapsed(false)}
                    aria-label="Expand player sidebar"
                    title="Expand player sidebar"
                >
                    <span className="player-sidebar__count-badge">
                        {playerList.length}
                    </span>
                    <span className="player-sidebar__toggle-icon">{'\u25C0'}</span>
                </button>
            </aside>
        )
    }

    return (
        <aside className="player-sidebar">
            <div className="player-sidebar__header">
                <div className="player-sidebar__header-info">
                    <span className="player-sidebar__title">
                        Players ({connectedCount}/{playerList.length})
                    </span>
                    {sessionCode && (
                        <span className="player-sidebar__session-code">
                            <code>{sessionCode}</code>
                        </span>
                    )}
                </div>
                <button
                    className="player-sidebar__toggle"
                    onClick={() => setCollapsed(true)}
                    aria-label="Collapse player sidebar"
                    title="Collapse player sidebar"
                >
                    {'\u25B6'}
                </button>
            </div>

            {/* Broadcast panel */}
            <SidebarBroadcast />

            {/* QR overlay toggle (host mode only) */}
            {networkMode === 'host' && sessionCode && (
                <div className="player-sidebar__qr-toggle">
                    <button
                        className={`btn btn-sm ${qrShowing ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => void toggleQROverlay()}
                    >
                        {qrShowing ? 'Hide QR on Screen' : 'Show QR on Screen'}
                    </button>
                </div>
            )}

            {/* Scrollable player cards */}
            <div className="player-sidebar__cards">
                {playerList.length === 0 ? (
                    <div className="player-sidebar__empty">
                        Waiting for players to connect...
                    </div>
                ) : (
                    playerList.map((player) => (
                        <PlayerCard key={player.token} player={player} />
                    ))
                )}
            </div>
        </aside>
    )
}
