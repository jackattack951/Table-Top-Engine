/**
 * DashboardTab — 3-column cockpit layout (Sprint 10b).
 *
 * Layout:
 *   [GBPreviewColumn] [CenterColumn] [QuickAccessColumn]
 *   [Scene Timeline — Sprint 10d]
 *   [Notes Strip — Sprint 10e]
 *
 * OutputSection, Scene Library, and BranchPanel have been moved to their
 * respective dedicated tabs (AV tab and Scenes tab).
 */
import React from 'react'
import { useSceneStore } from '@ui/stores/scene-store'
import { useAppStore } from '@ui/stores/app-store'
import { useScenes } from '@ui/hooks/use-scenes'
import { GBPreviewColumn } from './dashboard/gb-preview-column'
import { CenterColumn } from './dashboard/center-column'
import { QuickAccessColumn } from './dashboard/quick-access-column'
import { SceneTimeline } from './dashboard/scene-timeline'
import { NotesStrip } from './dashboard/notes-strip'
import { TransportBar } from './dashboard/transport-bar'

export function DashboardTab(): React.JSX.Element {
    const activeScene = useSceneStore((s) => s.activeScene)
    const cuedScene = useSceneStore((s) => s.cuedScene)
    const previewScene = useSceneStore((s) => s.previewScene)
    const activeCampaignId = useAppStore((s) => s.activeCampaignId)
    const { scenes, loading, error, refetch } = useScenes(activeCampaignId)

    return (
        <div className="dashboard">
            {/* ── Main content: 3-column scene dashboard ─────────────────── */}
            <div className="dashboard__columns">
                <GBPreviewColumn />
                <CenterColumn />
                <QuickAccessColumn />
            </div>

            {/* ── Transport bar — volume + CUE/TAKE above timeline ────── */}
            <TransportBar scenes={scenes} />

            {/* ── Scene Timeline — always visible ────────────────────────── */}
            <div className="dashboard__timeline" aria-label="Scene timeline">
                <SceneTimeline scenes={scenes} loading={loading} error={error} refetch={refetch} />
            </div>

            {/* ── Notes Strip — scene mode, preview, or when cued ─────── */}
            {(activeScene || cuedScene || previewScene) && (
                <div className="dashboard__notes">
                    <NotesStrip />
                </div>
            )}
        </div>
    )
}
