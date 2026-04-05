/**
 * Spells & Reference Tab — Sprint 5 (CSS polish pass: Sprint 15, pins+history: Sprint 24c).
 * Fully local SRD reference for spells, monsters, and conditions.
 * No REST calls — reads directly from bundled JSON via srd-search module.
 * Supports name/class/school/description search, filter-by-type pills,
 * search history chips, and pinned spells (session-scoped via spells-store).
 */
import React, { useState, useMemo } from 'react'
import {
    searchSRD,
    lookupSRDEntry,
    type SRDSearchResult,
    type SpellEntry,
    type MonsterEntry,
    type MonsterAction,
    type ConditionEntry,
    type FilterType,
} from '@reference/srd-search'
import { formatModifier } from '@shared/player-types'
import { useSpellsStore } from '@ui/stores/spells-store'

// ── Expanded detail cards ─────────────────────────────────────────────────────

function SpellCard({ spell }: { spell: SpellEntry }): React.JSX.Element {
    const levelLabel = spell.level === 0 ? 'Cantrip' : `${spell.level}${ordinalSuffix(spell.level)}-level`
    return (
        <div className="srd-detail">
            <div className="srd-detail__subtitle">
                {levelLabel} {spell.school}
            </div>
            <div className="srd-detail__meta">
                <span><strong>Casting Time:</strong> {spell.castingTime}</span>
                <span><strong>Range:</strong> {spell.range}</span>
                <span><strong>Duration:</strong> {spell.duration}</span>
                <span><strong>Components:</strong> {spell.components}</span>
            </div>
            <div className="srd-detail__classes">
                <strong>Classes:</strong> {spell.classes.join(', ')}
            </div>
            <p className="srd-detail__desc">
                {spell.description}
            </p>
            {spell.higherLevels && (
                <p className="srd-detail__higher">
                    <strong>At Higher Levels.</strong> {spell.higherLevels}
                </p>
            )}
        </div>
    )
}

function MonsterCard({ monster }: { monster: MonsterEntry }): React.JSX.Element {
    const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
    return (
        <div className="srd-detail">
            <div className="srd-detail__subtitle">
                {monster.size} {monster.type}
            </div>
            <div className="srd-detail__meta srd-detail__meta--3col">
                <span><strong>AC:</strong> {monster.ac}</span>
                <span><strong>HP:</strong> {monster.hp}</span>
                <span><strong>Speed:</strong> {monster.speed}</span>
                <span><strong>CR:</strong> {monster.cr}</span>
                <span><strong>Passive Perc.:</strong> {monster.passivePerception}</span>
            </div>
            {/* Ability scores */}
            <div className="srd-stats">
                {STATS.map((stat) => (
                    <div key={stat} className="srd-stats__cell">
                        <div className="srd-stats__label">{stat}</div>
                        <div className="srd-stats__value">{monster[stat]}</div>
                        <div className="srd-stats__mod">{formatModifier(monster[stat])}</div>
                    </div>
                ))}
            </div>
            {monster.description && (
                <p className="srd-detail__desc srd-detail__desc--muted">
                    {monster.description}
                </p>
            )}
            {monster.actions.length > 0 && (
                <div>
                    <div className="srd-detail__section-label">Actions</div>
                    {monster.actions.map((action: MonsterAction, i: number) => (
                        <div key={i} className="srd-detail__action">
                            <strong>{action.name}.</strong> {action.description}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function ConditionCard({ condition }: { condition: ConditionEntry }): React.JSX.Element {
    return (
        <div className="srd-detail">
            <p className="srd-detail__desc">
                {condition.description}
            </p>
            <ul className="srd-condition__effects">
                {condition.effects.map((effect: string, i: number) => (
                    <li key={i}>{effect}</li>
                ))}
            </ul>
        </div>
    )
}

// ── Result card row ───────────────────────────────────────────────────────────

function ResultCard({
    result,
    expanded,
    onToggle,
    pinned,
    onPin,
}: {
    result: SRDSearchResult
    expanded: boolean
    onToggle: () => void
    pinned: boolean
    onPin: () => void
}): React.JSX.Element {
    const cardClass = `srd-card srd-card--${result.type}${expanded ? ' srd-card--expanded' : ''}`

    return (
        <div className={cardClass}>
            <div className="srd-card__row">
                <button
                    className="srd-card__header"
                    onClick={onToggle}
                    aria-expanded={expanded}
                >
                    <span className={`srd-card__type srd-card__type--${result.type}`}>
                        {result.type}
                    </span>
                    <div className="srd-card__info">
                        <div className="srd-card__name">{result.name}</div>
                        <div className="srd-card__summary">{result.summary}</div>
                    </div>
                    <span className="srd-card__expand">
                        {expanded ? '\u25B2' : '\u25BC'}
                    </span>
                </button>
                <button
                    className={`srd-card__pin${pinned ? ' srd-card__pin--active' : ''}`}
                    onClick={onPin}
                    aria-label={pinned ? `Unpin ${result.name}` : `Pin ${result.name}`}
                    aria-pressed={pinned}
                    title={pinned ? 'Unpin' : 'Pin to top'}
                >
                    {pinned ? '\u2605' : '\u2606'}
                </button>
            </div>
            {expanded && (
                <div className="srd-card__body">
                    {result.type === 'spell' && <SpellCard spell={result.data as SpellEntry} />}
                    {result.type === 'monster' && <MonsterCard monster={result.data as MonsterEntry} />}
                    {result.type === 'condition' && <ConditionCard condition={result.data as ConditionEntry} />}
                </div>
            )}
        </div>
    )
}

// ── Ordinal helper ────────────────────────────────────────────────────────────

function ordinalSuffix(n: number): string {
    if (n === 1) return 'st'
    if (n === 2) return 'nd'
    if (n === 3) return 'rd'
    return 'th'
}

// ── Filter pills ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'spell', label: 'Spells' },
    { value: 'monster', label: 'Monsters' },
    { value: 'condition', label: 'Conditions' },
]

// ── Main SpellsTab ────────────────────────────────────────────────────────────

export function SpellsTab(): React.JSX.Element {
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<FilterType>('all')
    const [expandedName, setExpandedName] = useState<string | null>(null)

    const searchHistory = useSpellsStore((s) => s.searchHistory)
    const pinnedSpellIds = useSpellsStore((s) => s.pinnedSpellIds)
    const pushHistory = useSpellsStore((s) => s.pushHistory)
    const clearHistory = useSpellsStore((s) => s.clearHistory)
    const pinSpell = useSpellsStore((s) => s.pinSpell)
    const unpinSpell = useSpellsStore((s) => s.unpinSpell)

    const results = useMemo((): SRDSearchResult[] => {
        return searchSRD(query, filter)
    }, [query, filter])

    const pinnedResults = useMemo(
        () => pinnedSpellIds.map(lookupSRDEntry).filter((r): r is SRDSearchResult => r !== undefined),
        [pinnedSpellIds],
    )

    const isEmpty = query.trim() === ''

    function toggleExpand(name: string): void {
        setExpandedName((prev) => (prev === name ? null : name))
    }

    function handleQueryChange(value: string): void {
        setQuery(value)
        setExpandedName(null)
    }

    function handleQueryBlur(): void {
        const trimmed = query.trim()
        if (trimmed) pushHistory(trimmed)
    }

    function togglePin(resultKey: string): void {
        if (pinnedSpellIds.includes(resultKey)) {
            unpinSpell(resultKey)
        } else {
            pinSpell(resultKey)
        }
    }

    return (
        <div className="tab-panel tab-panel--flush">
            <div className="srd-tab">

                {/* Search bar + filter pills */}
                <div className="srd-tab__toolbar">
                    <input
                        className="form-input srd-tab__search"
                        type="search"
                        placeholder="Search spells, monsters, conditions\u2026"
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onBlur={handleQueryBlur}
                        aria-label="Search SRD reference"
                        autoFocus
                    />

                    <div className="srd-filter">
                        {FILTER_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                className={`srd-filter__pill${filter === opt.value ? ' active' : ''}`}
                                onClick={() => { setFilter(opt.value); setExpandedName(null) }}
                                aria-pressed={filter === opt.value}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent searches */}
                {searchHistory.length > 0 && isEmpty && (
                    <div className="srd-history">
                        <span className="srd-history__label">Recent</span>
                        <div className="srd-history__chips">
                            {searchHistory.map((q) => (
                                <button
                                    key={q}
                                    className="srd-history__chip"
                                    onClick={() => handleQueryChange(q)}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                        <button className="srd-history__clear" onClick={clearHistory}>
                            Clear
                        </button>
                    </div>
                )}

                {/* Pinned spells */}
                {pinnedResults.length > 0 && isEmpty && (
                    <div className="srd-pinned">
                        <div className="srd-pinned__label">Pinned</div>
                        {pinnedResults.map((result) => {
                            const key = `${result.type}:${result.name}`
                            return (
                                <ResultCard
                                    key={key}
                                    result={result}
                                    expanded={expandedName === key}
                                    onToggle={() => toggleExpand(key)}
                                    pinned
                                    onPin={() => togglePin(key)}
                                />
                            )
                        })}
                    </div>
                )}

                {/* Results list */}
                <div className="srd-tab__results">
                    {isEmpty && pinnedResults.length === 0 && (
                        <div className="tab-placeholder tab-placeholder--compact">
                            <span className="tab-placeholder__icon">&#128218;</span>
                            <div className="tab-placeholder__title">Spells &amp; Reference</div>
                            <p className="tab-placeholder__desc">
                                Search the 5e SRD &mdash; spells, monsters, and conditions. Fully offline.
                            </p>
                        </div>
                    )}

                    {!isEmpty && results.length === 0 && (
                        <div className="tab-placeholder tab-placeholder--compact-sm">
                            <div className="tab-placeholder__title">No results</div>
                            <p className="tab-placeholder__desc">
                                No matches for &ldquo;{query}&rdquo;.
                            </p>
                        </div>
                    )}

                    {results.map((result) => {
                        const key = `${result.type}:${result.name}`
                        return (
                            <ResultCard
                                key={key}
                                result={result}
                                expanded={expandedName === key}
                                onToggle={() => toggleExpand(key)}
                                pinned={pinnedSpellIds.includes(key)}
                                onPin={() => togglePin(key)}
                            />
                        )
                    })}

                    {results.length === 20 && (
                        <p className="srd-tab__hint">
                            Showing first 20 results &mdash; refine your search for more specific results.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
