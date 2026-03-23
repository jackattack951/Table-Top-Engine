/**
 * LaunchScreen — first thing the DM sees on app open.
 *
 * Two-column card layout:
 *   Left:  Mode selection (Headless / Play / Plan) with smart network toggle
 *   Right: Campaign selection (list + inline "New Campaign" form)
 *
 * On "Start Session" → sets activeCampaign + hasLaunched → App renders cockpit.
 *
 * Spec: Overhaul/Startup/startup-implementation-spec.md Phase 1
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Broadcast, PlayCircle, NotePencil } from '@phosphor-icons/react'
import { useAppStore } from '../stores/app-store'
import { usePlayerStore } from '../stores/player-store'
import { CopyButton } from '../components/copy-button'
import { QRCodePanel } from '../components/qr-code-panel'
import { selectCampaign, getServerUrl } from '../lib/sync'
import { Logo } from '../components/Logo'
import { SYSTEM_LABELS } from '@core/types'
import type { AppMode, NetworkMode, Campaign, RuleSystem } from '@core/types'

// Injected by vite.cockpit.config.ts at build time
declare const __APP_VERSION__: string | undefined
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'

// ── Mode card definitions ────────────────────────────────────────────────────

const APP_MODES: Array<{
    id: AppMode
    label: string
    desc: string
    tooltip: string
    icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill' }>
}> = [
    {
        id: 'headless',
        label: 'Headless',
        desc: 'AV display only — control from a LAN device',
        tooltip: 'Headless: This PC runs the AV display for players. You control it from your phone, iPad, or another device via LAN.',
        icon: Broadcast,
    },
    {
        id: 'play',
        label: 'Play',
        desc: 'Full cockpit + AV display on second monitor',
        tooltip: 'Play: Full cockpit UI on this screen + AV output on a second monitor or projector. Optionally host on LAN for device control.',
        icon: PlayCircle,
    },
    {
        id: 'plan',
        label: 'Plan',
        desc: 'Prep mode — build scenes and manage campaign',
        tooltip: 'Plan: Build scenes, manage NPCs and notes, and prep your campaign. No AV output, no network — local only.',
        icon: NotePencil,
    },
]

// ── API helpers (reused from campaign-selector) ──────────────────────────────

function getBaseUrl(): string {
    // sync.ts may not be initialized yet on the launch screen.
    // getServerUrl() returns '' before initSync — fall back to localhost:8080.
    const url = getServerUrl()
    return url || 'http://localhost:8080'
}

async function fetchCampaigns(): Promise<Campaign[]> {
    const r = await fetch(`${getBaseUrl()}/api/campaigns`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Campaign[]>
}

async function createCampaign(name: string, system: RuleSystem): Promise<Campaign> {
    const r = await fetch(`${getBaseUrl()}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, system }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Campaign>
}

function systemLabel(system: string): string {
    return SYSTEM_LABELS[system as RuleSystem] ?? system
}

// ── Session Code Display ─────────────────────────────────────────────────────

function SessionCodeDisplay({ code }: { code: string }): React.JSX.Element {
    return (
        <div className="session-code" role="region" aria-label="Session code">
            <span className="session-code__label">Session Code</span>
            <div className="session-code__value-row">
                <code className="session-code__value">{code}</code>
                <CopyButton text={code} className="btn btn-ghost session-code__copy" label="Copy session code" />
            </div>
        </div>
    )
}

// ── New Campaign Form ────────────────────────────────────────────────────────

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
            className="launch-new-campaign"
            onSubmit={(e) => void handleSubmit(e)}
        >
            <div className="launch-new-campaign__title">New Campaign</div>

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
                <div className="launch-new-campaign__error">{error}</div>
            )}

            <div className="launch-new-campaign__actions">
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

// ── LaunchScreen ─────────────────────────────────────────────────────────────

export function LaunchScreen(): React.JSX.Element {
    const {
        appMode,
        networkMode,
        setAppMode,
        setNetworkMode,
        setLaunched,
        activeCampaignId,
        setActiveCampaign,
    } = useAppStore()

    const sessionCode = usePlayerStore((s) => s.sessionCode)

    const [lanUrl, setLanUrl] = useState<string | null>(null)
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loadingCampaigns, setLoadingCampaigns] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [showNewForm, setShowNewForm] = useState(false)

    // ── Smart network defaults on mode select ────────────────────────────────

    function handleModeSelect(mode: AppMode): void {
        setAppMode(mode)
        if (mode === 'headless') setNetworkMode('host')
        if (mode === 'plan') setNetworkMode('local')
        // Play: keep current networkMode selection
    }

    // ── Network toggle visibility logic ──────────────────────────────────────

    const showNetworkToggle = appMode === 'play'
    const networkNote =
        appMode === 'headless'
            ? 'Headless requires LAN hosting'
            : appMode === 'plan'
              ? 'Plan mode runs locally'
              : null

    // ── Fetch LAN URL when host mode ─────────────────────────────────────────

    useEffect(() => {
        if (networkMode !== 'host') {
            setLanUrl(null)
            return
        }
        const fetchLANInfo = async (): Promise<void> => {
            try {
                const electronAPI = (window as Window & { electronAPI?: { getLANInfo?: () => Promise<{ ip: string; port: number; url: string }> } }).electronAPI
                if (electronAPI?.getLANInfo) {
                    const info = await electronAPI.getLANInfo()
                    setLanUrl(info.url)
                    return
                }
                const res = await fetch('http://localhost:8080/api/lan-info')
                if (!res.ok) throw new Error('LAN info fetch failed')
                const data = await res.json() as { url: string }
                setLanUrl(data.url)
            } catch (err) {
                console.warn('[LaunchScreen] Could not fetch LAN info:', err)
                setLanUrl(null)
            }
        }
        void fetchLANInfo()
    }, [networkMode])

    // ── Fetch campaigns on mount ─────────────────────────────────────────────

    const loadCampaigns = useCallback(async (): Promise<void> => {
        setLoadingCampaigns(true)
        setFetchError(null)
        try {
            const data = await fetchCampaigns()
            setCampaigns(data)
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Failed to load campaigns')
        } finally {
            setLoadingCampaigns(false)
        }
    }, [])

    useEffect(() => { void loadCampaigns() }, [loadCampaigns])

    // ── Campaign selection ───────────────────────────────────────────────────

    function handleSelectCampaign(campaign: Campaign): void {
        setActiveCampaign(campaign.id, campaign.name)
    }

    function handleCampaignCreated(campaign: Campaign): void {
        setCampaigns((prev) => [...prev, campaign])
        setActiveCampaign(campaign.id, campaign.name)
        setShowNewForm(false)
    }

    // ── Start session ────────────────────────────────────────────────────────

    const canLaunch = appMode !== null && activeCampaignId !== null

    const [launchState, setLaunchState] = useState<'idle' | 'loading' | 'error'>('idle')
    const [launchError, setLaunchError] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)

    // Track active timeout and subscription for cleanup on retry (MF-1, MF-2)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const unsubRef = useRef<(() => void) | null>(null)

    function cleanupLaunchRefs(): void {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    }

    function handleConnected(startTime: number): void {
        cleanupLaunchRefs()
        setProgress(60)

        // Read fresh campaign state in case it changed (SF-4)
        const { activeCampaignId: campId, activeCampaignName: campName } = useAppStore.getState()
        if (campId && campName) {
            selectCampaign(campId, campName)
        }
        setProgress(90)

        // Enforce minimum 500ms loading display to prevent flash
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        setTimeout(() => setProgress(100), remaining)
    }

    function handleStartSession(): void {
        if (!canLaunch) return

        // Clean up any stale refs from a previous attempt (MF-2)
        cleanupLaunchRefs()

        setLaunchState('loading')
        setLaunchError(null)
        setProgress(10)

        const startTime = Date.now()
        setLaunched()
        setProgress(30)

        // 5-second timeout for connection
        timeoutRef.current = setTimeout(() => {
            if (!useAppStore.getState().isConnected) {
                // Clean up subscription on timeout (MF-1)
                if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
                timeoutRef.current = null
                setLaunchState('error')
                setLaunchError('Connection timed out — is the server running?')
                setProgress(0)
            }
        }, 5000)

        // Subscribe to isConnected — fire handleConnected once
        unsubRef.current = useAppStore.subscribe(
            (s) => s.isConnected,
            (connected) => {
                if (!connected) return
                handleConnected(startTime)
            },
        )

        // Immediate check: in browser dev mode initSync sets isConnected synchronously
        if (useAppStore.getState().isConnected) {
            handleConnected(startTime)
        }
    }

    function handleRetry(): void {
        cleanupLaunchRefs()
        setLaunchState('idle')
        setLaunchError(null)
        setProgress(0)
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="launch-screen" role="main" aria-label="Stage Manager launch">
            <div className="launch-card">
                <div className="launch-branding">
                    <Logo size={48} className="launch-logo" />
                    <h1 className="launch-title">Stage Manager</h1>
                    <p className="launch-subtitle">DM Cockpit &amp; AV Engine</p>
                </div>

                <div className="launch-body">
                    {/* ── Left column: Mode selection ─────────────────────── */}
                    <div className="launch-col">
                        <span className="launch-section-label">Mode</span>

                        <div className="launch-mode-cards">
                            {APP_MODES.map((m) => {
                                const Icon = m.icon
                                const isActive = appMode === m.id
                                return (
                                    <button
                                        key={m.id}
                                        className={`mode-card${isActive ? ' mode-card--active' : ''}`}
                                        onClick={() => handleModeSelect(m.id)}
                                        aria-pressed={isActive}
                                        title={m.tooltip}
                                    >
                                        <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
                                        <span className="mode-card__label">{m.label}</span>
                                        <span className="mode-card__desc">{m.desc}</span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Network toggle — only for Play mode */}
                        {showNetworkToggle && (
                            <div className="launch-network">
                                <span className="launch-network__label">Network</span>
                                <div
                                    className="launch-network__btns"
                                    role="group"
                                    aria-label="Select network mode"
                                >
                                    <button
                                        className={`launch-network__btn${networkMode === 'local' ? ' active' : ''}`}
                                        onClick={() => setNetworkMode('local')}
                                        aria-pressed={networkMode === 'local'}
                                    >
                                        Local Only
                                    </button>
                                    <button
                                        className={`launch-network__btn${networkMode === 'host' ? ' active' : ''}`}
                                        onClick={() => setNetworkMode('host')}
                                        aria-pressed={networkMode === 'host'}
                                    >
                                        Host on LAN
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Network mode note for headless/plan */}
                        {networkNote && (
                            <p className="launch-mode-note" role="note">{networkNote}</p>
                        )}

                        {/* QR codes when host mode */}
                        {networkMode === 'host' && lanUrl && (
                            <>
                                {/* Primary: companion QR for players */}
                                {sessionCode && (
                                    <QRCodePanel
                                        serverUrl={`${lanUrl}/companion?session=${sessionCode}`}
                                        label="Players scan to join"
                                    />
                                )}
                                {/* Session code for manual entry */}
                                {sessionCode && (
                                    <SessionCodeDisplay code={sessionCode} />
                                )}
                                {/* Secondary: cockpit QR for DM remote */}
                                <QRCodePanel serverUrl={lanUrl} label="DM remote access" />
                            </>
                        )}
                    </div>

                    {/* ── Right column: Campaign selection ────────────────── */}
                    <div className="launch-col">
                        <span className="launch-section-label">Campaign</span>

                        {loadingCampaigns && (
                            <p className="launch-campaign-loading loading-spinner">Loading campaigns…</p>
                        )}

                        {fetchError && (
                            <div className="launch-campaign-error">
                                <span>{fetchError}</span>
                                <button
                                    className="launch-campaign-error__retry"
                                    onClick={() => void loadCampaigns()}
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {!loadingCampaigns && campaigns.length === 0 && !fetchError && (
                            <div className="launch-campaign-empty">
                                <p className="launch-campaign-empty__heading">No campaigns yet</p>
                                <p className="launch-campaign-empty__sub">
                                    Create a campaign to organize your scenes, NPCs, and notes.
                                </p>
                            </div>
                        )}

                        {campaigns.length > 0 && (
                            <div
                                className="launch-campaign-list"
                                role="list"
                                aria-label="Campaign list"
                            >
                                {campaigns.map((campaign) => (
                                    <button
                                        key={campaign.id}
                                        className={`launch-campaign-row${activeCampaignId === campaign.id ? ' launch-campaign-row--selected' : ''}`}
                                        onClick={() => handleSelectCampaign(campaign)}
                                        role="listitem"
                                        aria-label={`Select campaign: ${campaign.name}`}
                                        aria-pressed={activeCampaignId === campaign.id}
                                    >
                                        <span className="launch-campaign-row__name">
                                            {campaign.name}
                                        </span>
                                        <span className="launch-campaign-row__system">
                                            {systemLabel(campaign.system)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {showNewForm ? (
                            <NewCampaignForm
                                onCreated={handleCampaignCreated}
                                onCancel={() => setShowNewForm(false)}
                            />
                        ) : (
                            <button
                                className="btn btn-ghost launch-new-campaign-btn"
                                onClick={() => setShowNewForm(true)}
                            >
                                + New Campaign
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Start Session button ────────────────────────────────── */}
                <button
                    className={`launch-start-btn${launchState === 'loading' ? ' launch-start-btn--loading' : ''}`}
                    onClick={launchState === 'error' ? handleRetry : handleStartSession}
                    disabled={launchState === 'loading' || !canLaunch}
                    aria-label="Start session"
                >
                    {launchState === 'loading' && (
                        <span
                            className="launch-start-btn__progress"
                            style={{ width: `${progress}%` }}
                        />
                    )}
                    {launchState === 'loading' ? 'Starting…' : launchState === 'error' ? 'Retry →' : 'Start Session →'}
                </button>

                {launchError && (
                    <div className="launch-error" role="alert">
                        <span>{launchError}</span>
                        <button className="launch-error__retry" onClick={handleRetry}>
                            Retry
                        </button>
                    </div>
                )}

                {/* TODO: Replace temp branding with final logo + app name when ready */}
                <div className="launch-meta">
                    <span>TTRPG Stage Manager · v{APP_VERSION} · Preview</span>
                    <label className="launch-meta__skip-intro">
                        <input
                            type="checkbox"
                            defaultChecked={(() => { try { return localStorage.getItem('skipIntro') === 'true' } catch { return false } })()}
                            onChange={(e) => { try { localStorage.setItem('skipIntro', String(e.target.checked)) } catch { /* */ } }}
                        />
                        Skip intro
                    </label>
                </div>
            </div>
        </div>
    )
}
