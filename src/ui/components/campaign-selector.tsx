/**
 * CampaignSelector — shown when no campaign is active.
 * Fetches GET /api/campaigns, lists them as tappable rows.
 * Includes an inline "New Campaign" form that POSTs to /api/campaigns
 * and auto-selects the created campaign.
 *
 * On selection calls useAppStore.setActiveCampaign(id, name).
 * No socket calls — REST fetch only (data fetching, not commands).
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import { selectCampaign, getServerUrl } from '../lib/sync'
import { SYSTEM_LABELS } from '@core/types'
import type { Campaign, RuleSystem } from '@core/types'

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchCampaigns(): Promise<Campaign[]> {
    const r = await fetch(`${getServerUrl()}/api/campaigns`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Campaign[]>
}

async function createCampaign(name: string, system: RuleSystem): Promise<Campaign> {
    const r = await fetch(`${getServerUrl()}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, system }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Campaign>
}

// ── New Campaign Form ─────────────────────────────────────────────────────────

interface NewCampaignFormProps {
    onCreated: (campaign: Campaign) => void
    onCancel: () => void
}

function NewCampaignForm({ onCreated, onCancel }: NewCampaignFormProps): React.JSX.Element {
    const [name, setName] = useState('')
    const [system, setSystem] = useState<RuleSystem>('5e')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent): Promise<void> {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        setError(null)
        try {
            const campaign = await createCampaign(name.trim(), system)
            onCreated(campaign)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create campaign')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={(e) => void handleSubmit(e)}
            className="campaign-selector__form"
        >
            <div className="label-caps">New Campaign</div>

            <input
                className="form-input"
                placeholder="Campaign name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                aria-label="Campaign name"
            />

            <select
                className="form-select"
                value={system}
                onChange={(e) => setSystem(e.target.value as RuleSystem)}
                aria-label="Rule system"
            >
                {(Object.entries(SYSTEM_LABELS) as [RuleSystem, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                ))}
            </select>

            {error && (
                <div className="campaign-selector__error">{error}</div>
            )}

            <div className="campaign-selector__form-actions">
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !name.trim()}
                >
                    {saving ? 'Creating…' : 'Create'}
                </button>
            </div>
        </form>
    )
}

// ── CampaignSelector ──────────────────────────────────────────────────────────

export function CampaignSelector(): React.JSX.Element {
    const { setActiveCampaign } = useAppStore()

    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [showNewForm, setShowNewForm] = useState(false)

    const loadCampaigns = useCallback(async (): Promise<void> => {
        setLoading(true)
        setFetchError(null)
        try {
            const data = await fetchCampaigns()
            setCampaigns(data)
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Failed to load campaigns')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void loadCampaigns() }, [loadCampaigns])

    function handleSelect(campaign: Campaign): void {
        setActiveCampaign(campaign.id, campaign.name)
        selectCampaign(campaign.id, campaign.name)
    }

    function handleCreated(campaign: Campaign): void {
        setCampaigns((prev) => [...prev, campaign])
        setShowNewForm(false)
        setActiveCampaign(campaign.id, campaign.name)
        selectCampaign(campaign.id, campaign.name)
    }

    function systemLabel(system: string): string {
        return SYSTEM_LABELS[system as RuleSystem] ?? system
    }

    return (
        <div className="campaign-selector" role="main" aria-label="Campaign selector">
            <div className="campaign-selector__title">Select Campaign</div>

            {loading && (
                <p className="campaign-selector__loading loading-spinner">Loading campaigns…</p>
            )}

            {fetchError && (
                <p className="campaign-selector__error">{fetchError}</p>
            )}

            {!loading && campaigns.length === 0 && !fetchError && (
                <div className="campaign-selector__empty">
                    <p className="campaign-selector__empty-heading">No campaigns yet</p>
                    <p className="campaign-selector__empty-sub">
                        Create a campaign to organize your scenes, NPCs, and notes.
                    </p>
                </div>
            )}

            {campaigns.length > 0 && (
                <div
                    className="campaign-selector__list"
                    role="list"
                    aria-label="Campaign list"
                >
                    {campaigns.map((campaign) => (
                        <button
                            key={campaign.id}
                            className="campaign-row"
                            onClick={() => handleSelect(campaign)}
                            role="listitem"
                            aria-label={`Select campaign: ${campaign.name}`}
                        >
                            <span className="campaign-row__name">
                                {campaign.name}
                            </span>
                            <span className="campaign-row__system">
                                {systemLabel(campaign.system)}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {showNewForm ? (
                <NewCampaignForm
                    onCreated={handleCreated}
                    onCancel={() => setShowNewForm(false)}
                />
            ) : (
                <button
                    className="btn btn-ghost campaign-selector__new-btn"
                    onClick={() => setShowNewForm(true)}
                >
                    + New Campaign
                </button>
            )}
        </div>
    )
}
