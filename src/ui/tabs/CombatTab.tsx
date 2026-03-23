/**
 * Combat Tab — Sprint 4 (CSS polish pass: Sprint 15).
 * Full cockpit view: initiative order, HP tracking, conditions, add/remove combatants.
 * Round counter, Next Turn, and full condition toggle panel.
 * State changes emit COMBAT_SYNC via the Zustand subscription in sync.ts.
 * AV Display combat overlay is in src/systems/av/components/combat-overlay.tsx.
 */
import React, { memo, useCallback, useMemo, useState, useRef } from 'react'
import { useCombatStore } from '../stores/combat-store'
import { useAppStore } from '../stores/app-store'
import { getHPPercent, getHPClass, getInitials, COMBAT_CONDITIONS } from '../lib/combat-utils'
import type { Combatant } from '@core/types'

// ── Add Combatant Form ────────────────────────────────────────────────────────

interface AddCombatantFormProps {
    onAdd: (data: Omit<Combatant, 'id' | 'sortOrder'>) => void
    onCancel: () => void
}

const AddCombatantForm = memo(function AddCombatantForm({ onAdd, onCancel }: AddCombatantFormProps) {
    const [name, setName] = useState('')
    const [initiative, setInitiative] = useState('')
    const [hpMax, setHpMax] = useState('')
    const [ac, setAc] = useState('10')
    const [isPlayer, setIsPlayer] = useState(true)

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim() || !initiative || !hpMax) return
        const hp = parseInt(hpMax, 10)
        onAdd({
            name: name.trim(),
            npcId: null,
            initiative: parseInt(initiative, 10),
            hpCurrent: hp,
            hpMax: hp,
            ac: parseInt(ac, 10) || 10,
            conditions: [],
            isPlayer,
        })
    }

    return (
        <form onSubmit={handleSubmit} className="combat-add-form">
            <div className="section-label">Add Combatant</div>
            <div className="combat-add-form__grid">
                <input className="form-input" placeholder="Name" value={name}
                    onChange={(e) => setName(e.target.value)} required aria-label="Combatant name" autoFocus />
                <input className="form-input" type="number" placeholder="Init" value={initiative}
                    onChange={(e) => setInitiative(e.target.value)} required aria-label="Initiative" min={1} max={30} />
                <input className="form-input" type="number" placeholder="HP" value={hpMax}
                    onChange={(e) => setHpMax(e.target.value)} required aria-label="Max HP" min={1} />
                <input className="form-input" type="number" placeholder="AC" value={ac}
                    onChange={(e) => setAc(e.target.value)} aria-label="Armor Class" min={1} />
            </div>
            <div className="combat-add-form__options">
                <label className="combat-add-form__checkbox">
                    <input type="checkbox" checked={isPlayer} onChange={(e) => setIsPlayer(e.target.checked)} />
                    Player Character
                </label>
                <div className="combat-add-form__actions">
                    <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">
                        Add
                    </button>
                </div>
            </div>
        </form>
    )
})

// ── Combatant Row ─────────────────────────────────────────────────────────────

const CombatantRow = memo(function CombatantRow({
    combatant, isActive, onAdjustHP, onToggleCondition,
    onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: {
    combatant: Combatant
    isActive: boolean
    onAdjustHP: (id: string, amount: number) => void
    onToggleCondition: (id: string, condition: string) => void
    onRemove: (id: string) => void
    onMoveUp: (id: string) => void
    onMoveDown: (id: string) => void
    canMoveUp: boolean
    canMoveDown: boolean
}) {
    const pct = getHPPercent(combatant.hpCurrent, combatant.hpMax)
    const hpClass = getHPClass(pct)
    const [showConditions, setShowConditions] = useState(false)

    // Floating Combat Text state
    const [fctEvents, setFctEvents] = useState<{ id: number; amount: number }[]>([])
    const fctIdRef = useRef(0)

    const handleHPClick = useCallback((amount: number) => {
        // Trigger actual HP logic
        onAdjustHP(combatant.id, amount)
        // Add visual text
        const newId = ++fctIdRef.current
        setFctEvents((prev) => [...prev, { id: newId, amount }])
        // Cleanup after animation
        setTimeout(() => {
            setFctEvents((prev) => prev.filter((ev) => ev.id !== newId))
        }, 1500)
    }, [combatant.id, onAdjustHP])

    return (
        <div
            className={`combatant-row${isActive ? ' active-turn' : ''}${combatant.isPlayer ? ' is-player' : ''}`}
            role="listitem"
        >
            {/* Initiative + reorder */}
            <div className="combatant-row__init-col">
                <button
                    className="hp-btn hp-btn--sm"
                    onClick={() => onMoveUp(combatant.id)}
                    disabled={!canMoveUp}
                    aria-label="Move up"
                    style={{ opacity: canMoveUp ? 1 : 0.3 }}
                >▲</button>
                <span className="combatant-init">{combatant.initiative}</span>
                <button
                    className="hp-btn hp-btn--sm"
                    onClick={() => onMoveDown(combatant.id)}
                    disabled={!canMoveDown}
                    aria-label="Move down"
                    style={{ opacity: canMoveDown ? 1 : 0.3 }}
                >▼</button>
            </div>

            {/* Initials avatar + name + conditions */}
            <div className="combatant-row__info">
                <div className="combatant-row__name-row">
                    <div className={`combatant-row__avatar${combatant.isPlayer ? ' combatant-row__avatar--player' : ''}`}>
                        {getInitials(combatant.name)}
                    </div>
                    <span className="combatant-name">{combatant.name}</span>
                    {!combatant.isPlayer && (
                        <span className="combatant-row__ac">AC {combatant.ac}</span>
                    )}
                </div>

                {combatant.conditions.length > 0 && (
                    <div className="conditions">
                        {combatant.conditions.map((c) => (
                            <button key={c} className="condition-chip"
                                onClick={() => onToggleCondition(combatant.id, c)}
                                aria-label={`Remove condition: ${c}`}>{c}</button>
                        ))}
                    </div>
                )}

                {showConditions && (
                    <div className="combatant-row__condition-picker">
                        {COMBAT_CONDITIONS.map((cond) => (
                            <button key={cond}
                                className={`combatant-row__condition-toggle${combatant.conditions.includes(cond) ? ' active' : ''}`}
                                onClick={() => onToggleCondition(combatant.id, cond)}
                                aria-pressed={combatant.conditions.includes(cond)}
                            >
                                {cond}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* HP bar + text */}
            <div className="combatant-hp">
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
                <div className="combatant-hp__bar-bg">
                    <div className={`combatant-hp__bar-fill ${hpClass}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="combatant-hp__text">{combatant.hpCurrent} / {combatant.hpMax}</span>
            </div>

            <div className="combatant-hp-btns">
                {([1, 5, 10] as const).map((n) => (
                    <button key={`+${n}`} className="hp-btn heal"
                        onClick={() => handleHPClick(n)}
                        aria-label={`Heal ${combatant.name} by ${n}`}>+{n}</button>
                ))}
                {([1, 5, 10] as const).map((n) => (
                    <button key={`-${n}`} className="hp-btn dmg"
                        onClick={() => handleHPClick(-n)}
                        aria-label={`Deal ${n} damage to ${combatant.name}`}>-{n}</button>
                ))}
            </div>

            {/* Condition panel toggle + remove */}
            <div className="combatant-row__actions">
                <button
                    className="hp-btn hp-btn--icon"
                    onClick={() => setShowConditions((v) => !v)}
                    aria-expanded={showConditions}
                    aria-label="Toggle conditions"
                    title="Toggle conditions panel"
                >
                    {showConditions ? '\u2715' : 'cnd'}
                </button>
                <button
                    className="hp-btn hp-btn--icon hp-btn--danger btn-danger-stripe"
                    onClick={() => onRemove(combatant.id)}
                    aria-label={`Remove ${combatant.name}`}
                    title="Remove combatant"
                >
                    del
                </button>
            </div>
        </div>
    )
})

// ── Main component ────────────────────────────────────────────────────────────

export function CombatTab(): React.JSX.Element {
    const {
        combatants, currentRound, activeCombatantId,
        adjustHP, toggleCondition, nextTurn,
        addCombatant, removeCombatant, reorder, reset,
    } = useCombatStore()
    const appMode = useAppStore((s) => s.appMode)
    const [showAddForm, setShowAddForm] = useState(false)

    const handleAdjustHP = useCallback((id: string, amount: number) => adjustHP(id, amount), [adjustHP])
    const handleToggleCondition = useCallback((id: string, condition: string) => toggleCondition(id, condition), [toggleCondition])
    const handleRemove = useCallback((id: string) => removeCombatant(id), [removeCombatant])

    const sorted = useMemo(() => combatants.slice().sort((a, b) => a.sortOrder - b.sortOrder), [combatants])

    function handleMoveUp(id: string): void {
        const idx = sorted.findIndex((c) => c.id === id)
        if (idx > 0) reorder(idx, idx - 1)
    }
    function handleMoveDown(id: string): void {
        const idx = sorted.findIndex((c) => c.id === id)
        if (idx < sorted.length - 1) reorder(idx, idx + 1)
    }

    return (
        <div className="tab-panel tab-panel--flush">
            <div className="combat-tab">
                {/* Header */}
                <div className="combat-header">
                    <div className="combat-round">Round <strong>{currentRound}</strong></div>
                    <div className="combat-header__actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm((v) => !v)}>
                            + Add
                        </button>
                        {combatants.length > 0 && (
                            <button className="btn btn-sm btn-danger-stripe" onClick={reset}>
                                Reset
                            </button>
                        )}
                        <button
                            id="btn-next-turn"
                            className="btn-next-turn"
                            onClick={nextTurn}
                            disabled={combatants.length === 0}
                            aria-label="Advance to next turn"
                        >
                            Next Turn &rarr;
                        </button>
                    </div>
                </div>

                {showAddForm && (
                    <AddCombatantForm
                        onAdd={(data) => { addCombatant(data); setShowAddForm(false) }}
                        onCancel={() => setShowAddForm(false)}
                    />
                )}

                {combatants.length === 0 && !showAddForm && (
                    <div className="tab-placeholder tab-placeholder--compact">
                        <span className="tab-placeholder__icon">&#9876;</span>
                        <div className="tab-placeholder__title">No combatants</div>
                        <p className="tab-placeholder__desc">
                            {appMode === 'plan'
                                ? 'Add combatants to begin tracking initiative.'
                                : 'Start combat to track initiative and HP.'}
                        </p>
                        <button className="btn btn-primary"
                            onClick={() => setShowAddForm(true)}>
                            + Add First Combatant
                        </button>
                    </div>
                )}

                {combatants.length > 0 && (
                    <div className="combatant-list" role="list" aria-label="Initiative order">
                        {sorted.map((c, idx) => (
                            <CombatantRow
                                key={c.id}
                                combatant={c}
                                isActive={c.id === activeCombatantId}
                                onAdjustHP={handleAdjustHP}
                                onToggleCondition={handleToggleCondition}
                                onRemove={handleRemove}
                                onMoveUp={handleMoveUp}
                                onMoveDown={handleMoveDown}
                                canMoveUp={idx > 0}
                                canMoveDown={idx < sorted.length - 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
