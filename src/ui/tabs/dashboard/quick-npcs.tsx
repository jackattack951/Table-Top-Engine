/**
 * QuickNPCs — scene-linked NPC panel for the Dashboard right column.
 * Shows NPCs linked to the active scene with compact cards.
 * Allows unlinking existing NPCs and linking new ones from the campaign list.
 *
 * Uses useSceneNPCs hook for scene-linked NPCs and fetches all campaign NPCs
 * to populate the "Link NPC" dropdown.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useSceneStore } from '../../stores/scene-store'
import { useAppStore } from '../../stores/app-store'
import { useSceneNPCs } from '../../hooks/use-scene-npcs'
import { getServerUrl } from '../../lib/sync'
import type { NPC } from '@core/types'

// ── Compact NPC Card ───────────────────────────────────────────────────────────

interface QuickNPCCardProps {
    npc: NPC
    onUnlink: (npcId: string) => void
}

function QuickNPCCard({ npc, onUnlink }: QuickNPCCardProps): React.JSX.Element {
    const ac = typeof npc.statBlock['ac'] === 'number' ? npc.statBlock['ac'] : null
    const hp = typeof npc.statBlock['hp'] === 'number' ? npc.statBlock['hp'] : null
    const personality = npc.personality
        ? npc.personality.slice(0, 60) + (npc.personality.length > 60 ? '…' : '')
        : null

    return (
        <div className="quick-npc__card">
            <div className="quick-npc__card-header">
                <span className="quick-npc__name">{npc.name}</span>
                <button
                    className="btn btn-ghost quick-npc__unlink-btn"
                    onClick={() => onUnlink(npc.id)}
                    aria-label={`Unlink ${npc.name} from scene`}
                >
                    Unlink
                </button>
            </div>
            {(ac !== null || hp !== null) && (
                <div className="quick-npc__badges">
                    {ac !== null && (
                        <span className="quick-npc__badge">AC {ac}</span>
                    )}
                    {hp !== null && (
                        <span className="quick-npc__badge">HP {hp}</span>
                    )}
                </div>
            )}
            {personality && (
                <p className="quick-npc__personality">{personality}</p>
            )}
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QuickNPCs(): React.JSX.Element {
    const activeScene = useSceneStore((s) => s.activeScene)
    const activeCampaignId = useAppStore((s) => s.activeCampaignId)
    const sceneId = activeScene?.id ?? null

    const { npcs, loading, error, linkNPC, unlinkNPC } = useSceneNPCs(sceneId)

    // All campaign NPCs for the "Link" dropdown
    const [allNPCs, setAllNPCs] = useState<NPC[]>([])
    const [allNPCsLoading, setAllNPCsLoading] = useState(false)
    const [selectedNPCId, setSelectedNPCId] = useState('')
    const [linkError, setLinkError] = useState<string | null>(null)

    const fetchAllNPCs = useCallback(async () => {
        if (!activeCampaignId) { setAllNPCs([]); return }
        setAllNPCsLoading(true)
        try {
            const r = await fetch(`${getServerUrl()}/api/campaigns/${activeCampaignId}/npcs`)
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            setAllNPCs(await r.json() as NPC[])
        } catch {
            setAllNPCs([])
        } finally {
            setAllNPCsLoading(false)
        }
    }, [activeCampaignId])

    useEffect(() => { void fetchAllNPCs() }, [fetchAllNPCs])

    // Reset selection when scene changes
    useEffect(() => { setSelectedNPCId('') }, [sceneId])

    // Filter out already-linked NPCs from dropdown
    const linkedIds = new Set(npcs.map((n) => n.id))
    const availableNPCs = allNPCs.filter((n) => !linkedIds.has(n.id))

    async function handleLink() {
        if (!selectedNPCId || !sceneId) return
        setLinkError(null)
        try {
            await linkNPC(selectedNPCId)
            setSelectedNPCId('')
        } catch (err) {
            setLinkError(err instanceof Error ? err.message : 'Failed to link NPC')
        }
    }

    async function handleUnlink(npcId: string) {
        setLinkError(null)
        try {
            await unlinkNPC(npcId)
        } catch (err) {
            setLinkError(err instanceof Error ? err.message : 'Failed to unlink NPC')
        }
    }

    if (!sceneId) {
        return (
            <div className="quick-npc">
                <p className="quick-npc__empty">Select a scene to view linked NPCs</p>
            </div>
        )
    }

    return (
        <div className="quick-npc">
            {loading && (
                <p className="quick-npc__status">Loading…</p>
            )}
            {error && (
                <p className="quick-npc__status quick-npc__status--error">{error}</p>
            )}
            {linkError && (
                <p className="quick-npc__status quick-npc__status--error">{linkError}</p>
            )}

            {!loading && npcs.length === 0 && (
                <p className="quick-npc__empty">No NPCs linked to this scene</p>
            )}

            {npcs.map((npc) => (
                <QuickNPCCard
                    key={npc.id}
                    npc={npc}
                    onUnlink={(id) => void handleUnlink(id)}
                />
            ))}

            {/* Link NPC section */}
            {activeCampaignId && (
                <div className="quick-npc__link-row">
                    <select
                        className="form-select"
                        value={selectedNPCId}
                        onChange={(e) => setSelectedNPCId(e.target.value)}
                        aria-label="Select NPC to link"
                        disabled={allNPCsLoading || availableNPCs.length === 0}
                    >
                        <option value="">
                            {allNPCsLoading
                                ? 'Loading…'
                                : availableNPCs.length === 0
                                    ? 'All NPCs linked'
                                    : 'Link an NPC…'}
                        </option>
                        {availableNPCs.map((n) => (
                            <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                    </select>
                    <button
                        className="btn btn-primary quick-npc__link-btn"
                        onClick={() => void handleLink()}
                        disabled={!selectedNPCId}
                        aria-label="Link selected NPC to scene"
                    >
                        Add
                    </button>
                </div>
            )}
        </div>
    )
}
