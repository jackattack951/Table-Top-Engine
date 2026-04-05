/**
 * RollPromptPanel — DM control for sending roll prompts to players.
 * Allows the DM to specify a die, label, countdown, and target players.
 * Shows incoming roll results in real-time.
 */
import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/player-store'
import { emitRollPrompt, emitCancelRollPrompt } from '../../lib/sync'
import { formatTime } from '@shared/player-types'

const DIE_OPTIONS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const COMMON_LABELS = ['Perception', 'Stealth', 'Investigation', 'Insight', 'Athletics', 'Persuasion', 'Deception', 'Initiative']

export function RollPromptPanel(): React.JSX.Element {
    const players = usePlayerStore((s) => s.players)
    const rollResults = usePlayerStore((s) => s.rollResults)
    const activePromptId = usePlayerStore((s) => s.activePromptId)
    const [die, setDie] = useState('d20')
    const [label, setLabel] = useState('')
    const [countdown, setCountdown] = useState(30)
    const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set())

    const liveTokens = Object.values(players)
        .filter((p) => p.status === 'live' && p.connected)
        .map((p) => p.token)

    const toggleToken = (token: string) => {
        setSelectedTokens((prev) => {
            const next = new Set(prev)
            if (next.has(token)) next.delete(token)
            else next.add(token)
            return next
        })
    }

    const selectAll = () => setSelectedTokens(new Set(liveTokens))
    const clearAll = () => setSelectedTokens(new Set())

    const sendPrompt = () => {
        const targets = selectedTokens.size > 0 ? [...selectedTokens] : liveTokens
        if (targets.length === 0) return
        emitRollPrompt(targets, die, label.trim() || die, countdown)
        setLabel('')
    }

    const cancelPrompt = () => {
        if (activePromptId) emitCancelRollPrompt(activePromptId)
    }

    const promptedResults = activePromptId
        ? rollResults.filter((r) => r.promptId === activePromptId)
        : []

    return (
        <div className="roll-prompt-panel">
            <span className="roll-prompt-panel__title">Roll Prompt</span>

            {/* Die selector */}
            <div className="roll-prompt-panel__die-row">
                {DIE_OPTIONS.map((d) => (
                    <button
                        key={d}
                        className={`btn roll-prompt-panel__die-btn${die === d ? ' roll-prompt-panel__die-btn--active' : ''}`}
                        onClick={() => setDie(d)}
                    >
                        {d}
                    </button>
                ))}
            </div>

            {/* Label */}
            <div className="roll-prompt-panel__label-row">
                <input
                    className="form-input roll-prompt-panel__label-input"
                    placeholder="Roll label (e.g. Perception)"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                />
                <div className="roll-prompt-panel__quick-labels">
                    {COMMON_LABELS.map((l) => (
                        <button
                            key={l}
                            className="btn btn-ghost roll-prompt-panel__quick-label"
                            onClick={() => setLabel(l)}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Countdown */}
            <div className="roll-prompt-panel__countdown-row">
                <label className="roll-prompt-panel__countdown-label">Countdown (s)</label>
                <input
                    type="number"
                    className="form-input roll-prompt-panel__countdown-input"
                    value={countdown}
                    min={0}
                    max={300}
                    onChange={(e) => setCountdown(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
                <span className="roll-prompt-panel__countdown-hint">0 = no timer</span>
            </div>

            {/* Target selection */}
            {liveTokens.length > 0 && (
                <div className="roll-prompt-panel__targets">
                    <div className="roll-prompt-panel__targets-header">
                        <span className="roll-prompt-panel__targets-label">
                            Targets {selectedTokens.size > 0 ? `(${selectedTokens.size})` : '(all)'}
                        </span>
                        <button className="btn btn-ghost" onClick={selectAll}>All</button>
                        <button className="btn btn-ghost" onClick={clearAll}>Clear</button>
                    </div>
                    <div className="roll-prompt-panel__player-list">
                        {Object.values(players)
                            .filter((p) => p.status === 'live' && p.connected)
                            .map((p) => (
                                <label key={p.token} className="roll-prompt-panel__player-item">
                                    <input
                                        type="checkbox"
                                        checked={selectedTokens.has(p.token)}
                                        onChange={() => toggleToken(p.token)}
                                    />
                                    <span>{p.characterName || p.playerName}</span>
                                </label>
                            ))}
                    </div>
                </div>
            )}

            {/* Send / Cancel */}
            <div className="roll-prompt-panel__actions">
                <button
                    className="btn btn-primary"
                    onClick={sendPrompt}
                    disabled={liveTokens.length === 0}
                >
                    Send Roll Prompt
                </button>
                {activePromptId && (
                    <button className="btn btn-danger" onClick={cancelPrompt}>
                        Cancel Prompt
                    </button>
                )}
            </div>

            {/* Results */}
            {promptedResults.length > 0 && (
                <div className="roll-prompt-panel__results">
                    <span className="roll-prompt-panel__results-label">Results</span>
                    {promptedResults.map((r) => (
                        <div key={`${r.token}-${r.timestamp}`} className="roll-prompt-panel__result-row">
                            <span className="roll-prompt-panel__result-name">
                                {r.characterName || r.playerName}
                            </span>
                            <span className="roll-prompt-panel__result-die">{r.die}</span>
                            <span className={`roll-prompt-panel__result-value${
                                r.die === 'd20' && r.result === 20 ? ' roll-prompt-panel__result-value--crit' :
                                r.die === 'd20' && r.result === 1 ? ' roll-prompt-panel__result-value--fumble' : ''
                            }`}>
                                {r.result}
                            </span>
                            <span className="roll-prompt-panel__result-time">
                                {formatTime(r.timestamp)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
