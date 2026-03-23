/**
 * NPCs Tab — Sprint 5 (CSS polish pass: Sprint 15).
 * NPC list fetched from REST API, real-time search filter, inline stat block
 * panel, Add NPC form, Edit NPC form, and Delete with confirmation.
 * Touch-optimised for iPad DM use at the table.
 *
 * Sprint 5: Added Edit (PATCH /api/npcs/:id) and Delete (DELETE /api/npcs/:id).
 * Local React state is mutated directly — no Zustand for this list.
 * Fetch URLs are absolute via getServerUrl() to work in browser dev mode.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import { getServerUrl } from '../lib/sync'
import type { NPC } from '@core/types'
import { abilityModifier, formatModifier } from '@shared/player-types'

// ── Stat helpers ──────────────────────────────────────────────────────────────

function statVal(statBlock: Record<string, unknown>, key: string): number {
    const v = statBlock[key]
    return typeof v === 'number' ? v : 10
}

// ── NPC Stat Block ────────────────────────────────────────────────────────────

function StatBlock({ npc }: { npc: NPC }) {
    const sb = npc.statBlock
    const ac = typeof sb['ac'] === 'number' ? sb['ac'] : null
    const hp = typeof sb['hp'] === 'number' ? sb['hp'] : null
    const speed = typeof sb['speed'] === 'string' ? sb['speed'] : null
    const passivePerception = typeof sb['passive_perception'] === 'number'
        ? sb['passive_perception']
        : typeof sb['str'] === 'number'
            ? 10 + abilityModifier(statVal(sb, 'wis'))
            : null

    const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

    const actions = Array.isArray(sb['actions'])
        ? (sb['actions'] as { name?: unknown; description?: unknown }[])
        : []

    return (
        <div className="npc-stat-block">
            <div className="npc-stat-block__header">
                <span className="npc-stat-block__name">{npc.name}</span>
            </div>

            {/* Core defenses */}
            <div className="npc-stat-block__row">
                {ac !== null && <span><strong>AC</strong> {ac}</span>}
                {hp !== null && <span><strong>HP</strong> {hp}</span>}
                {speed && <span><strong>Speed</strong> {speed}</span>}
                {passivePerception !== null && <span><strong>Passive Perc.</strong> {passivePerception}</span>}
            </div>

            {/* Ability scores */}
            {STATS.some((s) => typeof sb[s] === 'number') && (
                <div className="npc-stat-block__stats">
                    {STATS.map((stat) => (
                        <div key={stat} className="npc-stat-block__stat">
                            <span className="npc-stat-block__stat-label">{stat.toUpperCase()}</span>
                            <span className="npc-stat-block__stat-value">{statVal(sb, stat)}</span>
                            <span className="npc-stat-block__stat-mod">{formatModifier(statVal(sb, stat))}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Personality / traits */}
            {npc.personality && (
                <div className="npc-stat-block__section">
                    <strong>Personality: </strong>{npc.personality}
                </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
                <div className="npc-stat-block__section">
                    <strong>Actions</strong>
                    {actions.map((action, i) => (
                        <div key={i} className="npc-stat-block__action">
                            {typeof action.name === 'string' && (
                                <strong>{action.name}. </strong>
                            )}
                            {typeof action.description === 'string' && action.description}
                        </div>
                    ))}
                </div>
            )}

            {/* Notes */}
            {npc.notes && (
                <div className="npc-stat-block__section">
                    {npc.notes}
                </div>
            )}
        </div>
    )
}

// ── NPC Form (shared between Add and Edit) ────────────────────────────────────

interface NPCFormProps {
    /** Pre-populated values for edit mode; omit for add mode */
    initial?: NPC
    title: string
    submitLabel: string
    campaignId: string
    onSubmit: (data: Omit<NPC, 'id'>) => void
    onCancel: () => void
}

const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

function NPCForm({ initial, title, submitLabel, campaignId, onSubmit, onCancel }: NPCFormProps) {
    const [name, setName] = useState(initial?.name ?? '')
    const [ac, setAc] = useState(
        typeof initial?.statBlock['ac'] === 'number' ? String(initial.statBlock['ac']) : ''
    )
    const [hp, setHp] = useState(
        typeof initial?.statBlock['hp'] === 'number' ? String(initial.statBlock['hp']) : ''
    )
    const [personality, setPersonality] = useState(initial?.personality ?? '')
    const [stats, setStats] = useState<Record<string, string>>(
        Object.fromEntries(
            STAT_KEYS.map((k) => [
                k,
                typeof initial?.statBlock[k] === 'number' ? String(initial.statBlock[k]) : '10',
            ])
        )
    )

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return
        const statBlock: Record<string, unknown> = {}
        if (ac) statBlock['ac'] = parseInt(ac, 10)
        if (hp) statBlock['hp'] = parseInt(hp, 10)
        for (const k of STAT_KEYS) {
            const v = parseInt(stats[k] ?? '10', 10)
            if (!isNaN(v)) statBlock[k] = v
        }
        onSubmit({
            campaignId,
            name: name.trim(),
            statBlock,
            personality: personality.trim(),
            notes: initial?.notes ?? '',
        })
    }

    return (
        <form onSubmit={handleSubmit} className="npc-form">
            <div className="section-label">{title}</div>

            <input className="form-input" placeholder="Name" value={name}
                onChange={(e) => setName(e.target.value)} required autoFocus aria-label="NPC name" />

            <div className="npc-form__grid">
                <div>
                    <label className="form-label">AC</label>
                    <input className="form-input" type="number" placeholder="10" value={ac}
                        onChange={(e) => setAc(e.target.value)} min={1} aria-label="Armor Class" />
                </div>
                <div>
                    <label className="form-label">HP</label>
                    <input className="form-input" type="number" placeholder="10" value={hp}
                        onChange={(e) => setHp(e.target.value)} min={1} aria-label="Hit Points" />
                </div>
            </div>

            {/* Ability scores */}
            <div>
                <div className="form-label">Ability Scores</div>
                <div className="npc-form__stats-grid">
                    {STAT_KEYS.map((k) => (
                        <div key={k}>
                            <label className="form-label form-label--center">{k}</label>
                            <input
                                className="form-input form-input--stat"
                                type="number" value={stats[k]} min={1} max={30}
                                onChange={(e) => setStats((prev) => ({ ...prev, [k]: e.target.value }))}
                                aria-label={k}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <input className="form-input" placeholder="Personality traits (optional)" value={personality}
                onChange={(e) => setPersonality(e.target.value)} aria-label="Personality" />

            <div className="npc-form__actions">
                <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">{submitLabel}</button>
            </div>
        </form>
    )
}

// ── Main NPCsTab ──────────────────────────────────────────────────────────────

export function NPCsTab(): React.JSX.Element {
    const { activeCampaignId } = useAppStore()

    const [npcs, setNpcs] = useState<NPC[]>([])
    const [loading, setLoading] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    /** ID of the NPC currently being edited; null = no edit form open */
    const [editingId, setEditingId] = useState<string | null>(null)
    /** Action-specific error messages shown per NPC card */
    const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

    const fetchNPCs = useCallback(async () => {
        if (!activeCampaignId) { setNpcs([]); return }
        setLoading(true)
        setFetchError(null)
        try {
            const r = await fetch(`${getServerUrl()}/api/campaigns/${activeCampaignId}/npcs`)
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            setNpcs(await r.json() as NPC[])
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Failed to load NPCs')
        } finally {
            setLoading(false)
        }
    }, [activeCampaignId])

    useEffect(() => { void fetchNPCs() }, [fetchNPCs])

    async function handleAddNPC(data: Omit<NPC, 'id'>) {
        if (!activeCampaignId) return
        try {
            const r = await fetch(`${getServerUrl()}/api/campaigns/${activeCampaignId}/npcs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const created = await r.json() as NPC
            setNpcs((prev) => [...prev, created])
            setShowAddForm(false)
            setExpandedId(created.id)
        } catch (err) {
            console.error('[NPCsTab] add NPC error:', err)
        }
    }

    async function handleEditNPC(data: Omit<NPC, 'id'>) {
        if (!editingId) return
        try {
            const r = await fetch(`${getServerUrl()}/api/npcs/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const updated = await r.json() as NPC
            setNpcs((prev) => prev.map((n) => (n.id === editingId ? updated : n)))
            setActionErrors((prev) => {
                const next = { ...prev }
                delete next[editingId]
                return next
            })
            setEditingId(null)
            setExpandedId(updated.id)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to save NPC'
            setActionErrors((prev) => ({ ...prev, [editingId]: msg }))
            console.error('[NPCsTab] edit NPC error:', err)
        }
    }

    async function handleDeleteNPC(npc: NPC) {
        if (!window.confirm(`Delete "${npc.name}"? This cannot be undone.`)) return
        try {
            const r = await fetch(`${getServerUrl()}/api/npcs/${npc.id}`, { method: 'DELETE' })
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            setNpcs((prev) => prev.filter((n) => n.id !== npc.id))
            setActionErrors((prev) => {
                const next = { ...prev }
                delete next[npc.id]
                return next
            })
            if (expandedId === npc.id) setExpandedId(null)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to delete NPC'
            setActionErrors((prev) => ({ ...prev, [npc.id]: msg }))
            console.error('[NPCsTab] delete NPC error:', err)
        }
    }

    function toggleExpand(id: string) {
        // Collapse edit form when collapsing
        if (expandedId === id) setEditingId(null)
        setExpandedId((prev) => (prev === id ? null : id))
    }

    const filtered = useMemo(
        () => search.trim()
            ? npcs.filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
            : npcs,
        [search, npcs]
    )

    return (
        <div className="tab-panel tab-panel--flush">
            <div className="npc-tab">

                {/* Search + add button */}
                <div className="npc-tab__toolbar">
                    <input
                        className="form-input npc-tab__search"
                        type="search"
                        placeholder="Search NPCs\u2026"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search NPCs"
                    />
                    <button
                        className="btn btn-primary btn-sm npc-tab__add-btn"
                        onClick={() => { setShowAddForm((v) => !v); setEditingId(null) }}
                    >
                        {showAddForm ? 'Cancel' : '+ Add NPC'}
                    </button>
                </div>

                <div className="npc-tab__content">

                    {showAddForm && activeCampaignId && (
                        <NPCForm
                            title="Add NPC"
                            submitLabel="Add NPC"
                            campaignId={activeCampaignId}
                            onSubmit={(data) => void handleAddNPC(data)}
                            onCancel={() => setShowAddForm(false)}
                        />
                    )}

                    {!activeCampaignId && !showAddForm && (
                        <div className="tab-placeholder tab-placeholder--compact">
                            <span className="tab-placeholder__icon">&#128100;</span>
                            <div className="tab-placeholder__title">No Campaign</div>
                            <p className="tab-placeholder__desc">
                                Open or create a campaign to manage NPCs.
                            </p>
                        </div>
                    )}

                    {activeCampaignId && loading && (
                        <p className="npcs-tab__status loading-spinner">Loading NPCs…</p>
                    )}

                    {activeCampaignId && fetchError && (
                        <p className="text-error">{fetchError}</p>
                    )}

                    {activeCampaignId && !loading && filtered.length === 0 && !showAddForm && (
                        <div className="tab-placeholder tab-placeholder--compact-sm">
                            <div className="tab-placeholder__title">
                                {search ? 'No results' : 'No NPCs yet'}
                            </div>
                            <p className="tab-placeholder__desc">
                                {search ? `No NPCs match "${search}".` : 'Add your first NPC to get started.'}
                            </p>
                        </div>
                    )}

                    {filtered.map((npc) => (
                        <div key={npc.id} className="npc-list-item">
                            {/* Summary row — tap to expand */}
                            <button
                                className="npc-list-item__row"
                                onClick={() => toggleExpand(npc.id)}
                                aria-expanded={expandedId === npc.id}
                                aria-controls={`npc-panel-${npc.id}`}
                            >
                                <div className="npc-list-item__avatar">
                                    {npc.name[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div className="npc-list-item__info">
                                    <span className="npc-list-item__name">{npc.name}</span>
                                    {npc.personality && (
                                        <span className="npc-list-item__desc">
                                            {npc.personality.slice(0, 60)}{npc.personality.length > 60 ? '\u2026' : ''}
                                        </span>
                                    )}
                                </div>
                                <div className="npc-list-item__stats">
                                    {typeof npc.statBlock['ac'] === 'number' && (
                                        <span>AC {npc.statBlock['ac']}</span>
                                    )}
                                    {typeof npc.statBlock['hp'] === 'number' && (
                                        <span>HP {npc.statBlock['hp']}</span>
                                    )}
                                    <span className="npc-list-item__expand">
                                        {expandedId === npc.id ? '\u25B2' : '\u25BC'}
                                    </span>
                                </div>
                            </button>

                            {/* Expanded stat block + edit/delete controls */}
                            {expandedId === npc.id && (
                                <div id={`npc-panel-${npc.id}`} role="region" aria-label={`${npc.name} stat block`}>
                                    {actionErrors[npc.id] && (
                                        <div className="npc-action-error">
                                            {actionErrors[npc.id]}
                                        </div>
                                    )}
                                    {editingId === npc.id ? (
                                        <NPCForm
                                            title={`Edit: ${npc.name}`}
                                            submitLabel="Save Changes"
                                            campaignId={npc.campaignId}
                                            initial={npc}
                                            onSubmit={(data) => void handleEditNPC(data)}
                                            onCancel={() => setEditingId(null)}
                                        />
                                    ) : (
                                        <>
                                            <StatBlock npc={npc} />
                                            <div className="npc-list-item__controls">
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setEditingId(npc.id)}
                                                    aria-label={`Edit ${npc.name}`}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => void handleDeleteNPC(npc)}
                                                    aria-label={`Delete ${npc.name}`}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
