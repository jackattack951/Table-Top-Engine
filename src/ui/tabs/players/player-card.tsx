/**
 * PlayerCard — cockpit-side per-player card for DM management.
 * Shows character info, HP bar, conditions, and DM action controls.
 * All actions are server-authoritative via sync.ts emit helpers.
 *
 * Sprint 14: DM Controls.
 */
import React, { useState, useMemo, useRef, useCallback } from 'react'
import type { PlayerCharacter } from '@shared/player-types'
import { formatModifier } from '@shared/player-types'
import { getHPPercent, PLAYER_CONDITIONS } from '../../lib/combat-utils'
import {
    emitAdjustHP,
    emitAddCondition,
    emitRemoveCondition,
    emitSendItem,
    emitRemoveItem,
    emitUpdateCurrency,
    emitWhisper,
    emitLobbyApprove,
    emitLobbyKick,
} from '../../lib/sync'

interface PlayerCardProps {
    player: PlayerCharacter
}

// ── Sub-components ──────────────────────────────────────────────────────────

function HPControls({ player }: { player: PlayerCharacter }): React.JSX.Element {
    const [amount, setAmount] = useState('5')

    const heal = () => {
        const n = parseInt(amount, 10)
        if (n > 0) emitAdjustHP(player.token, n)
    }
    const damage = () => {
        const n = parseInt(amount, 10)
        if (n > 0) emitAdjustHP(player.token, -n)
    }

    return (
        <div className="player-card__hp-controls">
            <button className="btn btn-danger player-card__hp-btn" onClick={damage} aria-label="Damage">
                &minus;
            </button>
            <input
                className="form-input player-card__hp-input"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="HP amount"
            />
            <button className="btn btn-success player-card__hp-btn" onClick={heal} aria-label="Heal">
                +
            </button>
        </div>
    )
}


function ConditionControls({ player }: { player: PlayerCharacter }): React.JSX.Element {
    const [showPicker, setShowPicker] = useState(false)

    const available = useMemo(
        () => PLAYER_CONDITIONS.filter((c) => !player.conditions.includes(c)),
        [player.conditions]
    )

    return (
        <div className="player-card__conditions">
            <div className="player-card__condition-list">
                {player.conditions.map((c) => (
                    <button
                        key={c}
                        className="player-card__condition-badge"
                        onClick={() => emitRemoveCondition(player.token, c)}
                        title={`Remove ${c}`}
                        aria-label={`Remove ${c}`}
                    >
                        {c} &times;
                    </button>
                ))}
                <button
                    className="player-card__condition-add"
                    onClick={() => setShowPicker(!showPicker)}
                    aria-label="Add condition"
                >
                    + Condition
                </button>
            </div>
            {showPicker && (
                <div className="player-card__condition-picker">
                    {available.map((c) => (
                        <button
                            key={c}
                            className="player-card__condition-option"
                            onClick={() => {
                                emitAddCondition(player.token, c)
                                setShowPicker(false)
                            }}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

function ItemControls({ player, onFly }: { player: PlayerCharacter, onFly: (type: 'item' | 'whisper') => void }): React.JSX.Element {
    const [showForm, setShowForm] = useState(false)
    const [name, setName] = useState('')
    const [qty, setQty] = useState('1')
    const [desc, setDesc] = useState('')

    const send = () => {
        if (!name.trim()) return
        emitSendItem(player.token, {
            name: name.trim(),
            quantity: parseInt(qty, 10) || 1,
            description: desc.trim(),
        })
        onFly('item')
        setName('')
        setQty('1')
        setDesc('')
        setShowForm(false)
    }

    return (
        <div className="player-card__items">
            <div className="player-card__item-list">
                {player.inventory.map((item) => (
                    <div key={item.id} className="player-card__item">
                        <span className="player-card__item-name">
                            {item.name} {item.quantity > 1 && <span className="player-card__item-qty">&times;{item.quantity}</span>}
                        </span>
                        <button
                            className="player-card__item-remove"
                            onClick={() => emitRemoveItem(player.token, item.id)}
                            title={`Remove ${item.name}`}
                            aria-label={`Remove ${item.name}`}
                        >
                            &times;
                        </button>
                    </div>
                ))}
            </div>
            {showForm ? (
                <div className="player-card__item-form">
                    <input
                        className="form-input"
                        placeholder="Item name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <input
                        className="form-input player-card__item-qty-input"
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                    />
                    <input
                        className="form-input"
                        placeholder="Description (optional)"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                    />
                    <div className="player-card__item-form-actions">
                        <button className="btn btn-primary" onClick={send}>Send</button>
                        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                </div>
            ) : (
                <button className="player-card__item-add" onClick={() => setShowForm(true)}>+ Send Item</button>
            )}
        </div>
    )
}

function CurrencyControls({ player }: { player: PlayerCharacter }): React.JSX.Element {
    const [gold, setGold] = useState(String(player.currency.gold))
    const [silver, setSilver] = useState(String(player.currency.silver))
    const [copper, setCopper] = useState(String(player.currency.copper))
    const [editing, setEditing] = useState(false)

    const save = () => {
        emitUpdateCurrency(player.token, {
            gold: parseInt(gold, 10) || 0,
            silver: parseInt(silver, 10) || 0,
            copper: parseInt(copper, 10) || 0,
        })
        setEditing(false)
    }

    if (!editing) {
        return (
            <div className="player-card__currency">
                <span className="player-card__coin player-card__coin--gold">{player.currency.gold}g</span>
                <span className="player-card__coin player-card__coin--silver">{player.currency.silver}s</span>
                <span className="player-card__coin player-card__coin--copper">{player.currency.copper}c</span>
                <button className="player-card__currency-edit" onClick={() => {
                    setGold(String(player.currency.gold))
                    setSilver(String(player.currency.silver))
                    setCopper(String(player.currency.copper))
                    setEditing(true)
                }} aria-label="Edit currency">Edit</button>
            </div>
        )
    }

    return (
        <div className="player-card__currency-form">
            <label className="player-card__currency-label">
                G <input className="form-input player-card__currency-input" type="number" min="0" value={gold} onChange={(e) => setGold(e.target.value)} />
            </label>
            <label className="player-card__currency-label">
                S <input className="form-input player-card__currency-input" type="number" min="0" value={silver} onChange={(e) => setSilver(e.target.value)} />
            </label>
            <label className="player-card__currency-label">
                C <input className="form-input player-card__currency-input" type="number" min="0" value={copper} onChange={(e) => setCopper(e.target.value)} />
            </label>
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
        </div>
    )
}

function WhisperControl({ player, onFly }: { player: PlayerCharacter, onFly: (type: 'item' | 'whisper') => void }): React.JSX.Element {
    const [message, setMessage] = useState('')
    const [showInput, setShowInput] = useState(false)

    const send = () => {
        if (!message.trim()) return
        emitWhisper([player.token], message.trim())
        onFly('whisper')
        setMessage('')
        setShowInput(false)
    }

    if (!showInput) {
        return (
            <button className="player-card__whisper-btn" onClick={() => setShowInput(true)}>
                Whisper
            </button>
        )
    }

    return (
        <div className="player-card__whisper-form">
            <input
                className="form-input"
                placeholder="Secret message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                autoFocus
            />
            <button className="btn btn-primary" onClick={send}>Send</button>
            <button className="btn btn-ghost" onClick={() => setShowInput(false)}>Cancel</button>
        </div>
    )
}

// ── Main Card ───────────────────────────────────────────────────────────────

export function PlayerCard({ player }: PlayerCardProps): React.JSX.Element {
    const [expanded, setExpanded] = useState(false)
    const hpPct = getHPPercent(player.hpCurrent, player.hpMax)
    const hpColor = hpPct > 50 ? 'var(--color-success)' : hpPct > 25 ? 'var(--color-warning)' : 'var(--color-danger)'

    const abilityKeys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const

    const [flyEvents, setFlyEvents] = useState<{id: number, type: 'item'|'whisper'}[]>([])
    const flyIdRef = useRef(0)

    const handleFly = useCallback((type: 'item'|'whisper') => {
        const id = ++flyIdRef.current
        setFlyEvents((p) => [...p, { id, type }])
        setTimeout(() => {
            setFlyEvents((p) => p.filter((ev) => ev.id !== id))
        }, 800)
    }, [])

    return (
        <div className={`player-card${!player.connected ? ' player-card--disconnected' : ''}`}>
            {flyEvents.length > 0 && (
                <div className="flyer-container">
                    {flyEvents.map((ev) => (
                        <div key={ev.id} className="flyer">
                            {ev.type === 'item' ? '🎁' : '💬'}
                        </div>
                    ))}
                </div>
            )}
            {/* Header */}
            <div className="player-card__header" onClick={() => setExpanded(!expanded)}>
                <div className="player-card__identity">
                    <span className={`player-card__status-dot${player.connected ? ' player-card__status-dot--online' : ''}`} />
                    <span className="player-card__character">{player.characterName}</span>
                    <span className="player-card__meta">
                        {player.class} {player.level} &middot; {player.playerName}
                    </span>
                </div>
                <div className="player-card__quick-stats">
                    <span className="player-card__ac">AC {player.ac}</span>
                    <span className="player-card__expand">{expanded ? '\u25B2' : '\u25BC'}</span>
                </div>
            </div>

            {/* HP Bar + controls (hidden for pending players) */}
            {player.status !== 'pending' && (
                <>
                    <div className="player-card__hp-bar">
                        <div
                            className="player-card__hp-fill"
                            style={{ width: `${hpPct}%`, backgroundColor: hpColor }}
                        />
                        <span className="player-card__hp-text">
                            {player.hpCurrent} / {player.hpMax}
                        </span>
                    </div>
                    <HPControls player={player} />
                </>
            )}

            {/* Status footer — approve/deny for pending, connection indicator otherwise */}
            <div className="player-card__status-footer">
                {player.status === 'pending' ? (
                    <div className="player-card__approval-actions">
                        <span className="player-card__status-label player-card__status-label--pending">Awaiting Approval</span>
                        <div className="player-card__approval-btns">
                            <button
                                className="btn btn-success btn-sm"
                                onClick={() => emitLobbyApprove(player.token)}
                            >
                                Approve
                            </button>
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={() => emitLobbyKick(player.token)}
                            >
                                Deny
                            </button>
                        </div>
                    </div>
                ) : player.status === 'kicked' ? (
                    <span className="player-card__status-label player-card__status-label--kicked">Kicked</span>
                ) : (
                    <div className="player-card__connection-status">
                        <span className={`player-card__connection-dot${player.connected ? ' player-card__connection-dot--connected' : ' player-card__connection-dot--warning'}`} />
                        <span className="player-card__connection-text">
                            {player.connected ? 'Connected' : 'Connection Lost'}
                        </span>
                    </div>
                )}
            </div>

            {/* Expanded section */}
            {expanded && (
                <div className="player-card__body">
                    {/* Ability scores */}
                    <div className="player-card__abilities">
                        {abilityKeys.map((key) => {
                            const score = player.abilities[key]
                            return (
                                <div key={key} className="player-card__ability">
                                    <span className="player-card__ability-label">{key}</span>
                                    <span className="player-card__ability-score">{score}</span>
                                    <span className="player-card__ability-mod">
                                        {formatModifier(score)}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Conditions */}
                    <div className="player-card__section">
                        <span className="player-card__section-label">Conditions</span>
                        <ConditionControls player={player} />
                    </div>

                    {/* Inventory */}
                    <div className="player-card__section">
                        <span className="player-card__section-label">Inventory</span>
                        <ItemControls player={player} onFly={handleFly} />
                    </div>

                    {/* Currency */}
                    <div className="player-card__section">
                        <span className="player-card__section-label">Currency</span>
                        <CurrencyControls player={player} />
                    </div>

                    {/* Whisper */}
                    <div className="player-card__section">
                        <WhisperControl player={player} onFly={handleFly} />
                    </div>
                </div>
            )}
        </div>
    )
}
