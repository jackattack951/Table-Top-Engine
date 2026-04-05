/**
 * Scenes Tab — Sprint 8f.
 * Card-based scene flow with inline expand, drag-to-reorder, scratchpad,
 * linked notes, branches, and scene advancer.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import { useSceneStore } from '../stores/scene-store'
import { useNotesStore } from '../stores/notes-store'
import { loadScene, emitSceneBranch, emitScratchpad, emitNoteLink, emitNoteUnlink, getServerUrl } from '../lib/sync'
import { useScenes, postScene, patchScene } from '../hooks/use-scenes'
import { useNotes, linkNoteToScene, unlinkNoteFromScene } from '../hooks/use-notes'
import { SceneCard } from '../components/scene-card'
import type { Scene, SceneBranch } from '@core/types'
import type { MediaAsset } from '@shared/asset-types'

export function ScenesTab(): React.JSX.Element {
    const { activeCampaignId, appMode } = useAppStore()
    const isPlayMode = appMode === 'play'
    const { scenes, loading, error, refetch } = useScenes(activeCampaignId)
    const { activeScene, setActiveScene, cuedScene } = useSceneStore()

    // Load notes for the campaign so we can link them to scenes
    useNotes(activeCampaignId)
    const notes = useNotesStore((s) => s.notes)
    const getNotesForScene = useNotesStore((s) => s.getNotesForScene)

    const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null)
    const [closingSceneId, setClosingSceneId] = useState<string | null>(null)
    const [showNewForm, setShowNewForm] = useState(false)
    const [newName, setNewName] = useState('')
    const [creating, setCreating] = useState(false)
    const [transitionToast, setTransitionToast] = useState<string | null>(null)
    const [startingSceneId, setStartingSceneId] = useState<string | null>(null)

    // Fetch campaign's startingSceneId
    useEffect(() => {
        if (!activeCampaignId) { setStartingSceneId(null); return }
        fetch(`${getServerUrl()}/api/campaigns/${activeCampaignId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((campaign) => { if (campaign) setStartingSceneId(campaign.startingSceneId ?? null) })
            .catch(() => { /* ignore */ })
    }, [activeCampaignId])

    // ── Scene handlers ───────────────────────────────────────────────────────

    function handleToggleExpand(sceneId: string): void {
        if (expandedSceneId === sceneId) {
            setClosingSceneId(sceneId)
            setTimeout(() => {
                setExpandedSceneId(null)
                setClosingSceneId(null)
            }, 200)
        } else {
            setExpandedSceneId(sceneId)
        }
    }

    function closeOverlay(): void {
        if (expandedSceneId) {
            setClosingSceneId(expandedSceneId)
            setTimeout(() => {
                setExpandedSceneId(null)
                setClosingSceneId(null)
            }, 200)
        }
    }

    function handleLoad(scene: Scene): void {
        setActiveScene(scene)
        loadScene(scene.id)
    }

    const handleSaveScratchpad = useCallback(async (sceneId: string, scratchpad: string): Promise<void> => {
        try {
            const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/scratchpad`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scratchpad }),
            })
            if (!r.ok) throw new Error(`Scratchpad save failed: ${r.status}`)
            emitScratchpad(sceneId, scratchpad)
            // Update the active scene in store if this scene is active
            const currentActive = useSceneStore.getState().activeScene
            if (currentActive && currentActive.id === sceneId) {
                useSceneStore.getState().setActiveScene({ ...currentActive, scratchpad })
            }
        } catch (err) {
            console.error('[ScenesTab] scratchpad save error:', err)
        }
    }, [])

    async function handleLinkNote(sceneId: string, noteId: string): Promise<void> {
        // Capture previous state for revert
        const prevLinks = useNotesStore.getState().sceneNoteLinks[sceneId] ?? []
        try {
            // Optimistic update
            useNotesStore.getState().setSceneNoteLinks(sceneId, [...prevLinks, noteId])
            await linkNoteToScene(sceneId, noteId)
            emitNoteLink(sceneId, noteId)
        } catch (err) {
            console.error('[ScenesTab] link note error:', err)
            // Revert to previous state
            useNotesStore.getState().setSceneNoteLinks(sceneId, prevLinks)
        }
    }

    async function handleUnlinkNote(sceneId: string, noteId: string): Promise<void> {
        // Capture previous state for revert
        const prevLinks = useNotesStore.getState().sceneNoteLinks[sceneId] ?? []
        try {
            // Optimistic update
            useNotesStore.getState().setSceneNoteLinks(
                sceneId,
                prevLinks.filter((id) => id !== noteId)
            )
            await unlinkNoteFromScene(sceneId, noteId)
            emitNoteUnlink(sceneId, noteId)
        } catch (err) {
            console.error('[ScenesTab] unlink note error:', err)
            // Revert to previous state
            useNotesStore.getState().setSceneNoteLinks(sceneId, prevLinks)
        }
    }

    async function handleAddBranch(sceneId: string, branch: SceneBranch): Promise<void> {
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene) return
        try {
            const updated = await patchScene(sceneId, {
                branches: [...scene.branches, branch],
            })
            if (activeScene?.id === sceneId) setActiveScene(updated)
            await refetch()
        } catch (err) {
            console.error('[ScenesTab] add branch error:', err)
        }
    }

    async function handleRemoveBranch(sceneId: string, branchIndex: number): Promise<void> {
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene) return
        try {
            const branches = scene.branches.filter((_, i) => i !== branchIndex)
            const updated = await patchScene(sceneId, { branches })
            if (activeScene?.id === sceneId) setActiveScene(updated)
            await refetch()
        } catch (err) {
            console.error('[ScenesTab] remove branch error:', err)
        }
    }

    function handleAdvance(targetSceneId: string, transitionNote: string): void {
        const doAdvance = (): void => {
            emitSceneBranch(targetSceneId)
            const target = scenes.find((s) => s.id === targetSceneId)
            if (target) {
                // setActiveScene triggers SCENE_LOAD via sync.ts subscription — no need for loadScene()
                setActiveScene(target)
                setExpandedSceneId(target.id)
            }
        }

        if (transitionNote) {
            setTransitionToast(transitionNote)
            setTimeout(() => {
                setTransitionToast(null)
                doAdvance()
            }, 2000)
        } else {
            doAdvance()
        }
    }

    async function handleSetStartingScene(sceneId: string | null): Promise<void> {
        if (!activeCampaignId) return
        try {
            const r = await fetch(`${getServerUrl()}/api/campaigns/${activeCampaignId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startingSceneId: sceneId }),
            })
            if (r.ok) setStartingSceneId(sceneId)
        } catch (err) {
            console.error('[ScenesTab] set starting scene error:', err)
        }
    }

    async function handleAssignMedia(sceneId: string, slot: 'background' | 'gameboard', asset: MediaAsset | null): Promise<void> {
        try {
            const patch = slot === 'background'
                ? { backgroundAssetId: asset?.id ?? null }
                : { gameboardAssetId: asset?.id ?? null }
            const updated = await patchScene(sceneId, patch)
            if (activeScene?.id === sceneId) setActiveScene(updated)
            await refetch()
        } catch (err) {
            console.error('[ScenesTab] assign media error:', err)
        }
    }

    async function handleCreate(): Promise<void> {
        if (!activeCampaignId || !newName.trim()) return
        setCreating(true)
        try {
            await postScene(activeCampaignId, newName.trim())
            setNewName('')
            setShowNewForm(false)
            await refetch()
        } catch (err) {
            console.error('[ScenesTab] create error:', err)
        } finally {
            setCreating(false)
        }
    }

    // ── Drag-and-drop reorder ────────────────────────────────────────────────
    const draggedIdRef = useRef<string | null>(null)

    function handleDragStart(_e: React.DragEvent, sceneId: string): void {
        draggedIdRef.current = sceneId
    }

    function handleDragOver(e: React.DragEvent): void {
        e.preventDefault()
    }

    async function handleDrop(_e: React.DragEvent, targetSceneId: string): Promise<void> {
        const draggedId = draggedIdRef.current
        draggedIdRef.current = null
        if (!draggedId || draggedId === targetSceneId) return

        const sorted = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder)
        const fromIdx = sorted.findIndex((s) => s.id === draggedId)
        const toIdx = sorted.findIndex((s) => s.id === targetSceneId)
        if (fromIdx === -1 || toIdx === -1) return

        // Reorder
        const [moved] = sorted.splice(fromIdx, 1)
        sorted.splice(toIdx, 0, moved!)

        // Update sortOrder for all affected scenes
        try {
            const updates = sorted.map((scene, idx) =>
                patchScene(scene.id, { sortOrder: idx })
            )
            await Promise.all(updates)
            await refetch()
        } catch (err) {
            console.error('[ScenesTab] reorder error:', err)
        }
    }

    // Sort scenes by sortOrder for display
    const sortedScenes = useMemo(() => [...scenes].sort((a, b) => a.sortOrder - b.sortOrder), [scenes])

    return (
        <div className="tab-panel">
            <div className="scenes-tab__content">
                <div className="section-label">Scene Flow</div>

                {activeCampaignId === null && (
                    <div className="tab-placeholder tab-placeholder--compact">
                        <span className="tab-placeholder__icon">&#127916;</span>
                        <div className="tab-placeholder__title">No Campaign</div>
                        <p className="tab-placeholder__desc">
                            Open or create a campaign to manage scenes.
                        </p>
                    </div>
                )}

                {activeCampaignId !== null && (
                    <>
                        {loading && <p className="scenes-tab__status loading-spinner">Loading scenes…</p>}
                        {error && <p className="scenes-tab__status scenes-tab__status--error">{error}</p>}

                        {!loading && !error && scenes.length === 0 && (
                            <div className="tab-placeholder tab-placeholder--compact-sm">
                                <div className="tab-placeholder__title">No scenes yet</div>
                                <p className="tab-placeholder__desc">
                                    Create one to get started.
                                </p>
                            </div>
                        )}

                        {expandedSceneId && (
                            <div
                                className={`scene-overlay-backdrop${closingSceneId ? ' scene-overlay-backdrop--closing' : ''}`}
                                onClick={closeOverlay}
                                aria-hidden="true"
                            />
                        )}

                        <div className="scene-card-grid">
                            {sortedScenes.map((scene) => (
                                <SceneCard
                                    key={scene.id}
                                    scene={scene}
                                    isActive={activeScene?.id === scene.id}
                                    isCued={cuedScene?.id === scene.id}
                                    expanded={expandedSceneId === scene.id}
                                    isClosing={closingSceneId === scene.id}
                                    linkedNotes={getNotesForScene(scene.id)}
                                    allNotes={notes}
                                    allScenes={scenes}
                                    onToggleExpand={handleToggleExpand}
                                    onLoad={handleLoad}
                                    onSaveScratchpad={(id, val) => void handleSaveScratchpad(id, val)}
                                    onLinkNote={(id, noteId) => void handleLinkNote(id, noteId)}
                                    onUnlinkNote={(id, noteId) => void handleUnlinkNote(id, noteId)}
                                    onAddBranch={(id, branch) => void handleAddBranch(id, branch)}
                                    onRemoveBranch={(id, idx) => void handleRemoveBranch(id, idx)}
                                    onAdvance={handleAdvance}
                                    onAssignMedia={(id, slot, asset) => void handleAssignMedia(id, slot, asset)}
                                    isStartingScene={startingSceneId === scene.id}
                                    onSetStartingScene={(id) => void handleSetStartingScene(id)}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDrop={(e, targetId) => void handleDrop(e, targetId)}
                                />
                            ))}
                        </div>

                        {!isPlayMode && (showNewForm ? (
                            <div className="scenes-tab__new-form">
                                <input
                                    className="form-input scenes-tab__new-input"
                                    placeholder="Scene name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
                                    autoFocus
                                />
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => void handleCreate()}
                                    disabled={creating || !newName.trim()}
                                >
                                    {creating ? '...' : 'Create'}
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setShowNewForm(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn btn-ghost scenes-tab__add-btn"
                                onClick={() => setShowNewForm(true)}
                            >
                                + New Scene
                            </button>
                        ))}
                    </>
                )}

                {/* ── Transition Toast ────────────────────────────────────── */}
                {transitionToast && (
                    <div className="scene-transition-toast">
                        <div className="scene-transition-toast__content">
                            {transitionToast}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
