/**
 * QuickCombat — compact combat view for the Dashboard right column.
 * Reads from useCombatStore directly. Shows round counter, combatant list
 * with HP bars, +/-1 HP buttons, and a Next Turn button.
 * Omits: add form, condition toggles, reorder controls, remove buttons.
 */
import React, { memo } from 'react'
import { useCombatStore } from '../../stores/combat-store'
import { getHPPercent, getHPClass, getInitials } from '../../lib/combat-utils'

// ── Compact Combatant Row ──────────────────────────────────────────────────────

interface QuickCombatRowProps {
    id: string
    name: string
    hpCurrent: number
    hpMax: number
    isPlayer: boolean
    isActive: boolean
    onAdjustHP: (id: string, amount: number) => void
}

const QuickCombatRow = memo(function QuickCombatRow({
    id, name, hpCurrent, hpMax, isPlayer, isActive, onAdjustHP,
}: QuickCombatRowProps) {
    const pct = getHPPercent(hpCurrent, hpMax)
    const hpClass = getHPClass(pct)

    return (
        <div className={`quick-combat__row${isActive ? ' active' : ''}`} role="listitem">
            <div className={`quick-combat__avatar${isPlayer ? ' quick-combat__avatar--player' : ' quick-combat__avatar--npc'}`}>
                {getInitials(name)}
            </div>
            <div className="quick-combat__name" title={name}>{name}</div>
            <div className="quick-combat__hp-bar">
                <div
                    className={`quick-combat__hp-fill${hpClass ? ` quick-combat__hp-fill--${hpClass}` : ''}`}
                    style={{ width: `${pct}%` }}
                    role="meter"
                    aria-valuenow={hpCurrent}
                    aria-valuemax={hpMax}
                    aria-valuemin={0}
                    aria-label={`${name} HP`}
                />
            </div>
            <span className="quick-combat__hp-text">{hpCurrent}/{hpMax}</span>
            <div className="quick-combat__hp-btns">
                <button
                    onClick={() => onAdjustHP(id, 1)}
                    aria-label={`Heal ${name} by 1`}
                    className="quick-combat__hp-btn quick-combat__hp-btn--heal"
                >+</button>
                <button
                    onClick={() => onAdjustHP(id, -1)}
                    aria-label={`Deal 1 damage to ${name}`}
                    className="quick-combat__hp-btn quick-combat__hp-btn--dmg"
                >-</button>
            </div>
        </div>
    )
})

// ── Main component ─────────────────────────────────────────────────────────────

export function QuickCombat(): React.JSX.Element {
    const { combatants, currentRound, activeCombatantId, adjustHP, nextTurn } = useCombatStore()
    const sorted = combatants.slice().sort((a, b) => a.sortOrder - b.sortOrder)

    return (
        <div className="quick-combat">
            <div className="quick-combat__round">
                Round <strong>{currentRound}</strong>
            </div>

            {sorted.length === 0 ? (
                <p className="quick-combat__empty">No active encounter</p>
            ) : (
                <div className="quick-combat__list" role="list" aria-label="Initiative order">
                    {sorted.map((c) => (
                        <QuickCombatRow
                            key={c.id}
                            id={c.id}
                            name={c.name}
                            hpCurrent={c.hpCurrent}
                            hpMax={c.hpMax}
                            isPlayer={c.isPlayer}
                            isActive={c.id === activeCombatantId}
                            onAdjustHP={adjustHP}
                        />
                    ))}
                </div>
            )}

            <button
                className="quick-combat__next-btn btn btn-primary"
                onClick={nextTurn}
                disabled={sorted.length === 0}
                aria-label="Advance to next turn"
            >
                Next Turn
            </button>
        </div>
    )
}
