/**
 * CharacterRosterPanel — DM control for managing the pre-defined character roster
 * and setting the character select mode for the current session.
 *
 * Reads/writes characters via REST API (campaign-scoped).
 * Mode changes emit SESSION_SET_CHAR_MODE via socket.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { usePlayerStore } from '../../stores/player-store'
import { useAppStore } from '../../stores/app-store'
import { emitSetCharMode, getServerUrl } from '../../lib/sync'
import type { RosterCharacter, CharacterSelectMode } from '@shared/player-types'

const CLASSES = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
    'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
    'Warlock', 'Wizard',
] as const

const MODE_OPTIONS: { value: CharacterSelectMode; label: string; desc: string }[] = [
    { value: 'manual-only', label: 'Manual Only', desc: 'Players type their own character details' },
    { value: 'roster-and-manual', label: 'Roster + Manual', desc: 'Players choose from roster or enter manually' },
    { value: 'roster-only', label: 'Roster Only', desc: 'Players must select a pre-defined character' },
]

const EMPTY_FORM = { characterName: '', class: 'Fighter', level: 1, maxHp: 10, ac: 10 }

export function CharacterRosterPanel(): React.JSX.Element {
    const characterSelectMode = usePlayerStore((s) => s.characterSelectMode)
    const activeCampaignId = useAppStore((s) => s.activeCampaignId)

    const [characters, setCharacters] = useState<RosterCharacter[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [addError, setAddError] = useState<string | null>(null)

    const fetchRoster = useCallback(async () => {
        if (!activeCampaignId) return
        const url = `${getServerUrl()}/api/campaigns/${activeCampaignId}/characters`
        try {
            const res = await fetch(url)
            if (!res.ok) return
            const data = await res.json() as RosterCharacter[]
            setCharacters(data)
        } catch {
            // Network error — silently ignore
        }
    }, [activeCampaignId])

    useEffect(() => {
        void fetchRoster()
    }, [fetchRoster])

    const handleModeChange = (mode: CharacterSelectMode) => {
        emitSetCharMode(mode)
    }

    const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!form.characterName.trim() || !activeCampaignId) {
            setAddError('Character name is required')
            return
        }
        setLoading(true)
        setAddError(null)
        try {
            const url = `${getServerUrl()}/api/campaigns/${activeCampaignId}/characters`
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterName: form.characterName.trim(),
                    class: form.class,
                    level: form.level,
                    maxHp: form.maxHp,
                    ac: form.ac,
                }),
            })
            if (!res.ok) {
                setAddError('Failed to add character')
                return
            }
            setForm(EMPTY_FORM)
            setShowAddForm(false)
            await fetchRoster()
        } catch {
            setAddError('Network error')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!activeCampaignId) return
        try {
            const url = `${getServerUrl()}/api/campaigns/${activeCampaignId}/characters/${id}`
            await fetch(url, { method: 'DELETE' })
            await fetchRoster()
        } catch {
            // Silently ignore — roster will be out of sync until next fetch
        }
    }

    return (
        <div className="char-roster-panel">
            <span className="char-roster-panel__title">Character Roster</span>

            {/* Mode selector */}
            <div className="char-roster-panel__modes">
                {MODE_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        className={`char-roster-panel__mode-btn${characterSelectMode === opt.value ? ' char-roster-panel__mode-btn--active' : ''}`}
                        onClick={() => handleModeChange(opt.value)}
                    >
                        <span className="char-roster-panel__mode-label">{opt.label}</span>
                        <span className="char-roster-panel__mode-desc">{opt.desc}</span>
                    </button>
                ))}
            </div>

            {/* Roster list — only meaningful in roster modes */}
            {characterSelectMode !== 'manual-only' && (
                <>
                    <div className="char-roster-panel__list">
                        {characters.length === 0 ? (
                            <p className="char-roster-panel__empty">No characters in roster. Add one below.</p>
                        ) : (
                            characters.map((char) => (
                                <div key={char.id} className="char-roster-panel__row">
                                    <div className="char-roster-panel__row-info">
                                        <span className="char-roster-panel__row-name">{char.characterName}</span>
                                        <span className="char-roster-panel__row-meta">
                                            Lv{char.level} {char.class} &middot; {char.maxHp}&nbsp;HP &middot; AC&nbsp;{char.ac}
                                        </span>
                                    </div>
                                    <button
                                        className="btn btn-ghost char-roster-panel__delete-btn"
                                        onClick={() => void handleDelete(char.id)}
                                        aria-label={`Remove ${char.characterName}`}
                                    >
                                        &#10005;
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add character */}
                    {showAddForm ? (
                        <form className="char-roster-panel__add-form" onSubmit={(e) => void handleAddSubmit(e)}>
                            <input
                                className="form-input"
                                placeholder="Character name"
                                value={form.characterName}
                                onChange={(e) => setForm((f) => ({ ...f, characterName: e.target.value }))}
                                maxLength={50}
                                required
                            />
                            <div className="char-roster-panel__add-row">
                                <select
                                    className="form-select char-roster-panel__add-class"
                                    value={form.class}
                                    onChange={(e) => setForm((f) => ({ ...f, class: e.target.value }))}
                                >
                                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <input
                                    className="form-input char-roster-panel__add-num"
                                    type="number" placeholder="Lv" min={1} max={20}
                                    value={form.level}
                                    onChange={(e) => setForm((f) => ({ ...f, level: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) }))}
                                />
                                <input
                                    className="form-input char-roster-panel__add-num"
                                    type="number" placeholder="HP" min={1} max={999}
                                    value={form.maxHp}
                                    onChange={(e) => setForm((f) => ({ ...f, maxHp: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                                />
                                <input
                                    className="form-input char-roster-panel__add-num"
                                    type="number" placeholder="AC" min={0} max={99}
                                    value={form.ac}
                                    onChange={(e) => setForm((f) => ({ ...f, ac: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                                />
                            </div>
                            {addError && <p className="text-error">{addError}</p>}
                            <div className="char-roster-panel__add-actions">
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Adding…' : 'Add Character'}
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => { setShowAddForm(false); setAddError(null) }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button className="btn btn-secondary char-roster-panel__add-btn" onClick={() => setShowAddForm(true)}>
                            + Add Character
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
