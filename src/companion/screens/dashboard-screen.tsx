/**
 * DashboardScreen — live player dashboard on companion.
 * Mobile-first layout showing HP, AC, abilities, conditions, inventory, currency.
 * All data comes from companion-store, updated in real-time by companion-sync.
 *
 * Sprint 13a.
 */
import { useState, useRef, useEffect } from 'react'
import { useCompanionStore } from '../stores/companion-store'
import { formatModifier, formatTime } from '@shared/player-types'
import type { AbilityScore, PlayerWhisper } from '@shared/player-types'
import { companionEmit } from '../lib/companion-sync'
import { vibrate } from '../lib/haptics'
import { EVENTS } from '@shared/socket-events'
import { MessageThread } from '../components/message-thread'

// ── Dice roller types ─────────────────────────────────────────────────────────

type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

interface DiceRoll {
    die: DieType
    result: number
    timestamp: number
}

const DICE: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

function rollDie(die: DieType): number {
    const max = parseInt(die.substring(1), 10)
    return Math.floor(Math.random() * max) + 1
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Must match CSS animation duration for hpDamage / hpHeal keyframes. */
const HP_FLASH_MS = 600

function HPBar({ current, max }: { current: number; max: number }): JSX.Element {
    const pct = max > 0 ? Math.round((current / max) * 100) : 0
    const prevRef = useRef(current)
    const [flash, setFlash] = useState<'damage' | 'heal' | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    
    // Floating Combat Text state
    const [fctEvents, setFctEvents] = useState<{ id: number; amount: number }[]>([])
    const fctIdRef = useRef(0)

    useEffect(() => {
        if (current !== prevRef.current) {
            const amount = current - prevRef.current
            const type = amount < 0 ? 'damage' : 'heal'
            setFlash(type)
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => setFlash(null), HP_FLASH_MS)
            
            // FCT Event
            const newId = ++fctIdRef.current
            setFctEvents((prev) => [...prev, { id: newId, amount }])
            setTimeout(() => {
                setFctEvents((prev) => prev.filter((ev) => ev.id !== newId))
            }, 1500)

            // Vibrate on damage (mobile)
            if (type === 'damage') vibrate([100, 50, 100])
            prevRef.current = current
        }
    }, [current])

    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [])

    const barColor =
        pct > 50 ? 'var(--color-success)' :
        pct > 25 ? 'var(--color-warning)' :
        'var(--color-danger)'

    let hpClass = 'dashboard__hp'
    if (flash === 'damage') hpClass += ' dashboard__hp--damage'
    if (flash === 'heal') hpClass += ' dashboard__hp--heal'
    if (pct <= 25 && pct > 0) hpClass += ' dashboard__hp--critical'

    return (
        <div className={hpClass} style={{ position: 'relative' }}>
            {fctEvents.length > 0 && (
                <div className="combatant-fct-container">
                    {fctEvents.map((ev) => (
                        <div
                            key={ev.id}
                            className={`fct-number ${ev.amount > 0 ? 'fct-number--heal' : 'fct-number--dmg'}`}
                        >
                            {ev.amount > 0 ? '+' : ''}{ev.amount}
                        </div>
                    ))}
                </div>
            )}
            <div className="dashboard__hp-bar">
                <div
                    className="dashboard__hp-fill"
                    style={{ width: `${pct}%`, background: barColor }}
                />
            </div>
            <span className="dashboard__hp-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {current} / {max} HP
            </span>
        </div>
    )
}

function AbilityGrid({ abilities }: { abilities: Record<AbilityScore, number> }): JSX.Element {
    return (
        <div className="dashboard__abilities">
            {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => {
                const score = abilities[ab]
                return (
                    <div key={ab} className="dashboard__ability">
                        <span className="dashboard__ability-label">{ab}</span>
                        <span className="dashboard__ability-score">{score}</span>
                        <span className="dashboard__ability-mod">
                            {formatModifier(score)}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

/** Visual style variants for condition badges. */
type ConditionVariant = 'poison' | 'fire' | 'ice' | 'fear' | 'holy' | 'stun' | 'slow' | 'invis' | 'blind' | 'charm'

/** Map condition names to visual style variants. Unknown conditions fall back to default (warning). */
const CONDITION_VARIANTS: Record<string, ConditionVariant> = {
    poisoned: 'poison',
    burning: 'fire', 'on fire': 'fire',
    frozen: 'ice', paralyzed: 'ice',
    frightened: 'fear',
    blessed: 'holy', inspired: 'holy',
    stunned: 'stun',
    slowed: 'slow', exhaustion: 'slow',
    invisible: 'invis',
    blinded: 'blind',
    charmed: 'charm',
    prone: 'slow',
    restrained: 'ice',
    deafened: 'stun',
    incapacitated: 'fear',
    petrified: 'slow',
    unconscious: 'fear',
}

/** Glyph icons for each condition variant. */
const CONDITION_ICONS: Record<ConditionVariant, string> = {
    poison: '\u2620',   // ☠
    fire: '\uD83D\uDD25',     // 🔥
    ice: '\u2744',      // ❄
    fear: '\uD83D\uDC41',     // 👁
    holy: '\u2728',     // ✨
    stun: '\u2B50',     // ⭐
    slow: '\u231B',     // ⌛
    invis: '\uD83D\uDC7B',    // 👻
    blind: '\uD83D\uDE36',    // 😶
    charm: '\uD83D\uDC9C',    // 💜
}

function getConditionVariant(condition: string): ConditionVariant | undefined {
    return CONDITION_VARIANTS[condition.toLowerCase()]
}

function ConditionBadges({ conditions }: { conditions: string[] }): JSX.Element | null {
    if (conditions.length === 0) return null
    return (
        <div className="dashboard__section">
            <span className="dashboard__section-label">Conditions</span>
            <div className="dashboard__conditions">
                {conditions.map((c) => {
                    const variant = getConditionVariant(c)
                    const icon = variant ? CONDITION_ICONS[variant] : null
                    const cls = variant
                        ? `dashboard__condition dashboard__condition--${variant}`
                        : 'dashboard__condition'
                    return (
                        <span key={c} className={cls}>
                            {icon && <span className="dashboard__condition-icon">{icon}</span>}
                            {c}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

function InventoryList({ inventory }: { inventory: Array<{ id: string; name: string; quantity: number; description: string }> }): JSX.Element | null {
    if (inventory.length === 0) return null
    return (
        <div className="dashboard__section">
            <span className="dashboard__section-label">Inventory</span>
            <div className="dashboard__inventory">
                {inventory.map((item) => (
                    <div key={item.id} className="dashboard__item">
                        <div className="dashboard__item-header">
                            <span className="dashboard__item-name">{item.name}</span>
                            {item.quantity > 1 && (
                                <span className="dashboard__item-qty">x{item.quantity}</span>
                            )}
                        </div>
                        {item.description && (
                            <span className="dashboard__item-desc">{item.description}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function CurrencyDisplay({ currency }: { currency: { gold: number; silver: number; copper: number } }): JSX.Element {
    return (
        <div className="dashboard__currency">
            <span className="dashboard__coin dashboard__coin--gold">
                <span className="dashboard__coin-icon">G</span>
                {currency.gold}
            </span>
            <span className="dashboard__coin dashboard__coin--silver">
                <span className="dashboard__coin-icon">S</span>
                {currency.silver}
            </span>
            <span className="dashboard__coin dashboard__coin--copper">
                <span className="dashboard__coin-icon">C</span>
                {currency.copper}
            </span>
        </div>
    )
}

function DiceRoller(): JSX.Element {
    const [history, setHistory] = useState<DiceRoll[]>([])
    const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null)

    function handleRoll(die: DieType): void {
        const result = rollDie(die)
        const roll: DiceRoll = { die, result, timestamp: Date.now() }
        setLastRoll(roll)
        setHistory((prev) => [roll, ...prev].slice(0, 20))
    }

    return (
        <div className="dashboard__section">
            <span className="dashboard__section-label">Dice Roller</span>
            <div className="dashboard__dice-buttons">
                {DICE.map((die) => (
                    <button
                        key={die}
                        className="dashboard__dice-btn"
                        onClick={() => handleRoll(die)}
                    >
                        {die}
                    </button>
                ))}
            </div>
            {lastRoll && (
                <div className={`dashboard__dice-result${
                    lastRoll.die === 'd20' && lastRoll.result === 20 ? ' dashboard__dice-result--nat20' :
                    lastRoll.die === 'd20' && lastRoll.result === 1 ? ' dashboard__dice-result--nat1' : ''
                }`}>
                    <span className="dashboard__dice-result-value">{lastRoll.result}</span>
                    <span className="dashboard__dice-result-die">
                        {lastRoll.die}
                        {lastRoll.die === 'd20' && lastRoll.result === 20 && ' — CRIT!'}
                        {lastRoll.die === 'd20' && lastRoll.result === 1 && ' — FUMBLE'}
                    </span>
                </div>
            )}
            {history.length > 1 && (
                <div className="dashboard__dice-history">
                    {history.slice(1, 6).map((roll, i) => (
                        <span key={roll.timestamp + '-' + i} className="dashboard__dice-history-item">
                            {roll.die}: {roll.result}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

function WhisperInbox({ whispers }: { whispers: PlayerWhisper[] }): JSX.Element | null {
    const [open, setOpen] = useState(false)
    const [readIds, setReadIds] = useState<Set<string>>(new Set())

    if (whispers.length === 0) return null

    const unreadCount = whispers.filter((w) => !w.read && !readIds.has(w.id)).length

    function markRead(id: string): void {
        setReadIds((prev) => new Set(prev).add(id))
        // Vibrate briefly on reveal (mobile)
        vibrate(50)
    }

    return (
        <div className="dashboard__section">
            <button
                className="dashboard__whisper-toggle"
                onClick={() => setOpen(!open)}
            >
                <span className="dashboard__section-label">Whispers</span>
                {unreadCount > 0 && (
                    <span className="dashboard__whisper-badge">{unreadCount}</span>
                )}
            </button>
            {open && (
                <div className="dashboard__whisper-list">
                    {whispers.slice().reverse().map((w) => {
                        const isRead = w.read || readIds.has(w.id)
                        return (
                            <div
                                key={w.id}
                                className={`dashboard__whisper${isRead ? ' dashboard__whisper--read' : ''}`}
                                onClick={() => !isRead && markRead(w.id)}
                            >
                                {!isRead ? (
                                    <div className="dashboard__whisper-sealed">
                                        <span className="dashboard__whisper-seal" aria-hidden="true" />
                                        <span>Tap to break the seal</span>
                                    </div>
                                ) : (
                                    <div className="dashboard__whisper-revealed">
                                        <span className="dashboard__whisper-from">From the DM</span>
                                        <span className="dashboard__whisper-message">{w.message}</span>
                                    </div>
                                )}
                                <span className="dashboard__whisper-time">{formatTime(w.timestamp)}</span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function DashboardScreen(): JSX.Element {
    const {
        playerName, characterName, class: charClass, level,
        hpCurrent, hpMax, ac, abilities,
        conditions, inventory, currency, whispers,
        connected,
    } = useCompanionStore()

    return (
        <div className="dashboard">
            {/* Header */}
            <div className="dashboard__header">
                <div className="dashboard__identity">
                    <span className="dashboard__character">{characterName || 'Unnamed'}</span>
                    <span className="dashboard__player">{playerName}</span>
                </div>
                <div className="dashboard__connection">
                    <span className={`dashboard__dot ${connected ? 'dashboard__dot--online' : 'dashboard__dot--offline'}`} />
                </div>
            </div>

            {/* Stat row */}
            <div className="dashboard__stat-row">
                <span className="dashboard__stat">Lv{level} {charClass}</span>
                <span className="dashboard__stat dashboard__stat--ac">AC {ac}</span>
            </div>

            {/* HP */}
            <HPBar current={hpCurrent} max={hpMax} />

            {/* Body — scrollable content */}
            <div className="dashboard__body">
                {/* Abilities */}
                <AbilityGrid abilities={abilities} />

                {/* Conditions */}
                <ConditionBadges conditions={conditions} />

                {/* Inventory */}
                <InventoryList inventory={inventory} />

                {/* Currency */}
                <div className="dashboard__section">
                    <span className="dashboard__section-label">Currency</span>
                    <CurrencyDisplay currency={currency} />
                </div>

                {/* Dice Roller */}
                <DiceRoller />

                {/* Whispers */}
                <WhisperInbox whispers={whispers} />

                {/* Message DM */}
                <MessageThread />
            </div>
        </div>
    )
}
