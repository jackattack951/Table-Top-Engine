/**
 * QuickSpells — embedded SRD search panel for the Dashboard right column.
 * Space-constrained: no filter pills, search across all types.
 * Shows up to 10 results; click a result to expand full details.
 * Uses searchSRD directly (offline, no REST calls).
 */
import React, { useState, useMemo } from 'react'
import {
    searchSRD,
    type SRDSearchResult,
    type SpellEntry,
    type MonsterEntry,
    type MonsterAction,
    type ConditionEntry,
} from '@reference/srd-search'

const MAX_RESULTS = 10

// ── Type badge colors ──────────────────────────────────────────────────────────

const TYPE_COLOR: Record<SRDSearchResult['type'], string> = {
    spell: 'var(--color-accent)',
    monster: 'var(--color-danger)',
    condition: 'var(--color-warning)',
}

// ── Compact detail cards ───────────────────────────────────────────────────────

function SpellDetail({ spell }: { spell: SpellEntry }): React.JSX.Element {
    const levelLabel = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`
    return (
        <div className="quick-spells__detail">
            <div className="quick-spells__detail-meta">
                {levelLabel} {spell.school} — {spell.castingTime}, {spell.range}
            </div>
            <div className="quick-spells__detail-meta">
                Duration: {spell.duration} | Components: {spell.components}
            </div>
            <p className="quick-spells__detail-body">{spell.description}</p>
            {spell.higherLevels && (
                <p className="quick-spells__detail-body quick-spells__detail-body--italic">
                    <strong>At Higher Levels.</strong> {spell.higherLevels}
                </p>
            )}
        </div>
    )
}

function MonsterDetail({ monster }: { monster: MonsterEntry }): React.JSX.Element {
    return (
        <div className="quick-spells__detail">
            <div className="quick-spells__detail-meta">
                {monster.size} {monster.type} | CR {monster.cr}
            </div>
            <div className="quick-spells__detail-meta">
                AC {monster.ac} | HP {monster.hp} | Speed {monster.speed}
            </div>
            {monster.description && (
                <p className="quick-spells__detail-body">{monster.description}</p>
            )}
            {monster.actions.length > 0 && (
                <div className="quick-spells__detail-actions">
                    {monster.actions.map((action: MonsterAction, i: number) => (
                        <p key={i} className="quick-spells__detail-body">
                            <strong>{action.name}.</strong> {action.description}
                        </p>
                    ))}
                </div>
            )}
        </div>
    )
}

function ConditionDetail({ condition }: { condition: ConditionEntry }): React.JSX.Element {
    return (
        <div className="quick-spells__detail">
            <p className="quick-spells__detail-body">{condition.description}</p>
            <ul className="quick-spells__detail-effects">
                {condition.effects.map((effect: string, i: number) => (
                    <li key={i}>{effect}</li>
                ))}
            </ul>
        </div>
    )
}

// ── Single result row ──────────────────────────────────────────────────────────

function QuickSpellResult({
    result,
    expanded,
    onToggle,
}: {
    result: SRDSearchResult
    expanded: boolean
    onToggle: () => void
}): React.JSX.Element {
    return (
        <div className={`quick-spells__result${expanded ? ' expanded' : ''}`}>
            <button
                className="quick-spells__result-btn"
                onClick={onToggle}
                aria-expanded={expanded}
            >
                <span
                    className="quick-spells__result-type"
                    style={{ color: TYPE_COLOR[result.type] }}
                >
                    {result.type}
                </span>
                <span className="quick-spells__result-name">{result.name}</span>
                <span className="quick-spells__result-summary">{result.summary}</span>
                <span className="quick-spells__result-chevron">{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div className="quick-spells__result-expand">
                    {result.type === 'spell' && <SpellDetail spell={result.data as SpellEntry} />}
                    {result.type === 'monster' && <MonsterDetail monster={result.data as MonsterEntry} />}
                    {result.type === 'condition' && <ConditionDetail condition={result.data as ConditionEntry} />}
                </div>
            )}
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QuickSpells(): React.JSX.Element {
    const [query, setQuery] = useState('')
    const [expandedKey, setExpandedKey] = useState<string | null>(null)

    const results = useMemo((): SRDSearchResult[] => {
        return searchSRD(query).slice(0, MAX_RESULTS)
    }, [query])

    function handleQueryChange(value: string): void {
        setQuery(value)
        setExpandedKey(null)
    }

    function toggleExpand(key: string): void {
        setExpandedKey((prev) => (prev === key ? null : key))
    }

    return (
        <div className="quick-spells">
            <input
                className="form-input quick-spells__search"
                type="search"
                placeholder="Search spells, monsters, conditions…"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                aria-label="Search SRD reference"
            />

            {query.trim() === '' && (
                <p className="quick-spells__hint">Type to search the 5e SRD</p>
            )}

            {query.trim() !== '' && results.length === 0 && (
                <p className="quick-spells__hint">No results for "{query}"</p>
            )}

            {results.length > 0 && (
                <div className="quick-spells__results" role="list">
                    {results.map((result) => {
                        const key = `${result.type}:${result.name}`
                        return (
                            <QuickSpellResult
                                key={key}
                                result={result}
                                expanded={expandedKey === key}
                                onToggle={() => toggleExpand(key)}
                            />
                        )
                    })}
                </div>
            )}
        </div>
    )
}
