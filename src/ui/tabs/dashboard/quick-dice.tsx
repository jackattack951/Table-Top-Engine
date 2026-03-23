/**
 * QuickDice — Dice roller widget for the dashboard right column.
 *
 * Features:
 * - Preset buttons for common dice: d4, d6, d8, d10, d12, d20, d100
 * - Custom notation input (e.g., "2d6+4") with Roll button and Enter key support
 * - Advantage / Disadvantage toggle (affects d20 preset only)
 * - Result display: large total with individual dice breakdown
 * - Roll history: last 10 rolls, most recent first, with Clear button
 *
 * All state is local. No store, no socket events, no persistence.
 */
import React, { useState, useRef, useCallback } from 'react'
import { parseDiceNotation, rollDice, type RollResult, type DiceRoll } from '../../lib/dice-parser'

// ── Constants ──────────────────────────────────────────────────────────────────

const PRESET_DICE = [4, 6, 8, 10, 12, 20, 100] as const

const MAX_HISTORY = 10

type AdvMode = 'normal' | 'advantage' | 'disadvantage'

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Format the result of a normal roll for display in history.
 * e.g., "d20 → [14] = 14"
 */
function formatHistoryEntry(result: RollResult): string {
    const diceStr = result.individual.join(', ')
    return `${result.input} → [${diceStr}] = ${result.total}`
}

/**
 * Roll two d20 dice for advantage/disadvantage and return an augmented result.
 * The two dice are stored in `individual`; `total` is the chosen die (plus modifier).
 */
function rollWithAdvantage(
    sides: number,
    mode: 'advantage' | 'disadvantage',
    modifier: number
): { result: RollResult; chosenIndex: number } {
    const base: DiceRoll = { count: 2, sides, modifier }
    const result = rollDice(base, `2d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ''}`)
    const [a, b] = result.individual
    const chosenIndex = mode === 'advantage' ? (a >= b ? 0 : 1) : a <= b ? 0 : 1
    const chosenVal = result.individual[chosenIndex]
    return {
        result: {
            ...result,
            total: chosenVal + modifier,
        },
        chosenIndex,
    }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ResultDisplayProps {
    result: RollResult | null
    advMode: AdvMode
    /** Index of the chosen die when adv/disadv is active (0 or 1), or -1 for normal. */
    chosenIndex: number
}

function ResultDisplay({ result, advMode, chosenIndex }: ResultDisplayProps): React.JSX.Element {
    if (!result) {
        return (
            <div className="quick-dice__result">
                <div className="quick-dice__result-total" aria-label="No roll yet">—</div>
                <div className="quick-dice__result-detail">Roll a die to see results</div>
            </div>
        )
    }

    const { individual, total, input, parsed } = result
    const isAdvDisadv = advMode !== 'normal' && parsed.sides === 20 && individual.length === 2
    const modeLabel = advMode === 'advantage' ? 'advantage' : 'disadvantage'

    let detailText: string
    if (isAdvDisadv) {
        const [a, b] = individual
        detailText = `2d20: [${a}, ${b}] → ${individual[chosenIndex]} (${modeLabel})`
        if (parsed.modifier !== 0) {
            const modStr = parsed.modifier > 0 ? `+${parsed.modifier}` : `${parsed.modifier}`
            detailText += ` ${modStr} = ${total}`
        }
    } else if (individual.length === 1) {
        detailText = `${input}: [${individual[0]}]`
        if (parsed.modifier !== 0) {
            const modStr = parsed.modifier > 0 ? `+${parsed.modifier}` : `${parsed.modifier}`
            detailText += ` ${modStr} = ${total}`
        }
    } else {
        const diceStr = individual.join(' + ')
        detailText = `${input}: [${diceStr}]`
        if (parsed.modifier !== 0) {
            const modStr = parsed.modifier > 0 ? `+${parsed.modifier}` : `${parsed.modifier}`
            detailText += ` ${modStr} = ${total}`
        }
    }

    return (
        <div className="quick-dice__result" aria-live="polite" aria-atomic="true">
            <div className="quick-dice__result-total">{total}</div>
            <div className="quick-dice__result-detail">{detailText}</div>
        </div>
    )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function QuickDice(): React.JSX.Element {
    const [advMode, setAdvMode] = useState<AdvMode>('normal')
    const [customInput, setCustomInput] = useState('')
    const [customError, setCustomError] = useState(false)
    const [lastResult, setLastResult] = useState<RollResult | null>(null)
    const [chosenIndex, setChosenIndex] = useState(-1)
    const [history, setHistory] = useState<Array<{ label: string; total: number; id: number }>>([])
    const historyCounter = useRef(0)

    // ── Roll execution ────────────────────────────────────────────────────────

    const recordRoll = useCallback((result: RollResult, label: string): void => {
        const entry = {
            label,
            total: result.total,
            id: ++historyCounter.current,
        }
        setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY))
    }, [])

    const handlePresetRoll = useCallback(
        (sides: number): void => {
            // Only apply advantage/disadvantage to d20
            if (sides === 20 && advMode !== 'normal') {
                const { result, chosenIndex: idx } = rollWithAdvantage(20, advMode, 0)
                setLastResult(result)
                setChosenIndex(idx)
                const modeShort = advMode === 'advantage' ? 'adv' : 'dis'
                recordRoll(result, `d20 (${modeShort})`)
            } else {
                const parsed: DiceRoll = { count: 1, sides, modifier: 0 }
                const result = rollDice(parsed, `d${sides}`)
                setLastResult(result)
                setChosenIndex(-1)
                recordRoll(result, `d${sides}`)
            }
        },
        [advMode, recordRoll]
    )

    const handleCustomRoll = useCallback((): void => {
        const trimmed = customInput.trim()
        if (!trimmed) return

        const parsed = parseDiceNotation(trimmed)
        if (!parsed) {
            setCustomError(true)
            return
        }

        setCustomError(false)
        const result = rollDice(parsed, trimmed)
        setLastResult(result)
        setChosenIndex(-1)
        recordRoll(result, formatHistoryEntry(result))
    }, [customInput, recordRoll])

    const handleCustomKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>): void => {
            if (e.key === 'Enter') {
                handleCustomRoll()
            }
        },
        [handleCustomRoll]
    )

    const handleCustomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
        setCustomInput(e.target.value)
        setCustomError(false)
    }, [])

    const handleClearHistory = useCallback((): void => {
        setHistory([])
    }, [])

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="quick-dice">
            {/* Preset dice buttons */}
            <div className="quick-dice__presets" role="group" aria-label="Preset dice">
                {PRESET_DICE.map((sides) => (
                    <button
                        key={sides}
                        className="quick-dice__preset-btn"
                        onClick={() => handlePresetRoll(sides)}
                        aria-label={`Roll d${sides}`}
                        type="button"
                    >
                        d{sides}
                    </button>
                ))}
            </div>

            {/* Advantage / Disadvantage toggle */}
            <div
                className="quick-dice__adv-group"
                role="group"
                aria-label="Advantage mode for d20"
            >
                <button
                    className={`quick-dice__adv-btn${advMode === 'normal' ? ' active' : ''}`}
                    onClick={() => setAdvMode('normal')}
                    type="button"
                    aria-pressed={advMode === 'normal'}
                >
                    Normal
                </button>
                <button
                    className={`quick-dice__adv-btn${advMode === 'advantage' ? ' active' : ''}`}
                    onClick={() => setAdvMode('advantage')}
                    type="button"
                    aria-pressed={advMode === 'advantage'}
                >
                    Adv
                </button>
                <button
                    className={`quick-dice__adv-btn${advMode === 'disadvantage' ? ' active' : ''}`}
                    onClick={() => setAdvMode('disadvantage')}
                    type="button"
                    aria-pressed={advMode === 'disadvantage'}
                >
                    Disadv
                </button>
            </div>

            {/* Custom notation input */}
            <div className="quick-dice__custom">
                <input
                    className={`form-input quick-dice__custom-input${customError ? ' quick-dice__custom-input--error' : ''}`}
                    type="text"
                    value={customInput}
                    onChange={handleCustomChange}
                    onKeyDown={handleCustomKeyDown}
                    placeholder="e.g. 2d6+4"
                    aria-label="Custom dice notation"
                    aria-invalid={customError}
                    spellCheck={false}
                />
                <button
                    className="btn btn-primary"
                    onClick={handleCustomRoll}
                    type="button"
                    aria-label="Roll custom dice"
                >
                    Roll
                </button>
            </div>

            {/* Result display */}
            <ResultDisplay result={lastResult} advMode={advMode} chosenIndex={chosenIndex} />

            {/* Roll history */}
            {history.length > 0 && (
                <div>
                    <div className="quick-dice__history-header">
                        <span className="quick-dice__history-label">History</span>
                        <button
                            className="btn btn-ghost quick-dice__clear-btn"
                            onClick={handleClearHistory}
                            type="button"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="quick-dice__history" role="log" aria-label="Roll history" aria-live="polite">
                        {history.map((entry) => (
                            <div key={entry.id} className="quick-dice__history-entry">
                                <span>{entry.label}</span>
                                <span className="quick-dice__history-total">{entry.total}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
