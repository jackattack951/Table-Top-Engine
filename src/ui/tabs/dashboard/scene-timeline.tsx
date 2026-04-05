/**
 * SceneTimeline — Horizontal scrollable scene timeline strip (Sprint 10d + 18b).
 *
 * Displays scenes in order: Past → [Active] → Cued → Future.
 * Supports click-to-cue (when a scene is live), click-to-load (first scene),
 * branch fork indicators, TAKE button, and HTML5 drag-and-drop reordering.
 *
 * Data flow:
 *   - useScenes(activeCampaignId) — fetches all scenes for the active campaign
 *   - useSceneStore — reads activeScene, cuedScene, previewScene; writes setPreviewScene, setCuedScene, takeScene, autoCue
 *   - useAppStore — reads activeCampaignId
 *   - loadScene(id) — emits SCENE_LOAD via sync layer
 *   - patchScene(id, data) — PATCHes a scene's sortOrder via REST
 *
 * Sprint 18c: Three-state flow — Preview (click) → Cue (CUE button) → Live (TAKE button).
 * Clicking sets previewScene (cockpit-only, no AV). CUE commits it (triggers AV preload).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useSceneStore } from '@ui/stores/scene-store'
import { useAppStore } from '@ui/stores/app-store'
import { patchScene } from '@ui/hooks/use-scenes'
import { loadScene } from '@ui/lib/sync'
import type { Scene } from '@core/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeVariant = 'past' | 'active' | 'cued' | 'preview' | 'future'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeVariant(
    scene: Scene,
    activeScene: Scene | null,
    cuedScene: Scene | null,
    previewScene: Scene | null,
): NodeVariant {
    if (activeScene && scene.id === activeScene.id) return 'active'
    if (cuedScene && scene.id === cuedScene.id) return 'cued'
    if (previewScene && scene.id === previewScene.id) return 'preview'
    if (!activeScene) return 'future'
    return scene.sortOrder < activeScene.sortOrder ? 'past' : 'future'
}

/**
 * Recalculate sortOrder values after a drag-and-drop reorder.
 * Returns an array of { id, sortOrder } for every scene whose sortOrder changed.
 */
function recalcSortOrders(
    scenes: Scene[],
    draggedId: string,
    targetId: string,
): Array<{ id: string; sortOrder: number }> {
    if (draggedId === targetId) return []

    const sorted = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder)
    const draggedIdx = sorted.findIndex((s) => s.id === draggedId)
    const targetIdx = sorted.findIndex((s) => s.id === targetId)
    if (draggedIdx === -1 || targetIdx === -1) return []

    // Remove dragged item then re-insert at target position
    const [dragged] = sorted.splice(draggedIdx, 1)
    // After removal, find where target now is
    const newTargetIdx = sorted.findIndex((s) => s.id === targetId)
    const insertAt = draggedIdx < targetIdx ? newTargetIdx + 1 : newTargetIdx
    sorted.splice(insertAt, 0, dragged)

    // Assign sequential sortOrder values starting from 0
    const changed: Array<{ id: string; sortOrder: number }> = []
    sorted.forEach((scene, idx) => {
        const newOrder = idx * 10
        if (scene.sortOrder !== newOrder) {
            changed.push({ id: scene.id, sortOrder: newOrder })
        }
    })
    return changed
}

// ─── SceneNode ────────────────────────────────────────────────────────────────

interface SceneNodeProps {
    scene: Scene
    variant: NodeVariant
    allScenes: Scene[]
    onNavigate: (scene: Scene) => void
    onDragStart: (id: string) => void
    onDragOver: (e: React.DragEvent, id: string) => void
    onDrop: (targetId: string) => void
    isDragging: boolean
    isDragOver: boolean
    draggable: boolean
}

function SceneNode({
    scene,
    variant,
    allScenes,
    onNavigate,
    onDragStart,
    onDragOver,
    onDrop,
    isDragging,
    isDragOver,
    draggable,
}: SceneNodeProps): React.JSX.Element {
    const hasBranches = scene.branches.length > 0

    const handleBranchClick = useCallback(
        (e: React.MouseEvent, targetSceneId: string) => {
            e.stopPropagation()
            const target = allScenes.find((s) => s.id === targetSceneId)
            if (target) onNavigate(target)
        },
        [allScenes, onNavigate],
    )

    const nodeClass = [
        'scene-timeline__node',
        variant !== 'future' && `scene-timeline__node--${variant}`,
        isDragging && 'dragging',
        isDragOver && 'drag-over',
    ].filter(Boolean).join(' ')

    return (
        <button
            className={nodeClass}
            onClick={() => onNavigate(scene)}
            draggable={draggable}
            onDragStart={() => { if (draggable) onDragStart(scene.id) }}
            onDragOver={(e) => onDragOver(e, scene.id)}
            onDrop={() => onDrop(scene.id)}
            aria-current={variant === 'active' ? 'true' : undefined}
            aria-label={`Scene: ${scene.name}${variant === 'active' ? ' (active)' : variant === 'cued' ? ' (cued)' : ''}`}
            title={scene.name}
        >
            <div className="scene-timeline__node-content">
                <span className="scene-timeline__node-name">{scene.name}</span>
                {variant === 'active' && <span className="live-dot scene-timeline__live-dot" />}
            </div>

            {hasBranches && (
                <div className="scene-timeline__forks">
                    {scene.branches.map((branch) => (
                        <button
                            key={branch.targetSceneId}
                            className="scene-timeline__fork"
                            onClick={(e) => handleBranchClick(e, branch.targetSceneId)}
                            title={branch.transitionNote || branch.label}
                            aria-label={`Branch: ${branch.label}`}
                        >
                            {branch.label}
                        </button>
                    ))}
                </div>
            )}
        </button>
    )
}

// ─── Connector ───────────────────────────────────────────────────────────────

interface ConnectorProps {
    afterVariant: NodeVariant
}

function Connector({ afterVariant }: ConnectorProps): React.JSX.Element {
    const cls =
        afterVariant === 'active'
            ? 'scene-timeline__connector scene-timeline__connector--active'
            : 'scene-timeline__connector'
    return <div className={cls} aria-hidden="true" />
}

// ─── SceneTimeline ────────────────────────────────────────────────────────────

/**
 * Horizontal scrollable timeline strip showing all scenes in sortOrder sequence.
 * Click-to-cue when a scene is live; TAKE button commits cued scene.
 */
interface SceneTimelineProps {
    scenes: Scene[]
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function SceneTimeline({ scenes, loading, error, refetch }: SceneTimelineProps): React.JSX.Element {
    const isPlayMode = useAppStore((s) => s.appMode === 'play')
    const activeScene = useSceneStore((s) => s.activeScene)
    const cuedScene = useSceneStore((s) => s.cuedScene)
    const previewScene = useSceneStore((s) => s.previewScene)
    const setActiveScene = useSceneStore((s) => s.setActiveScene)
    const setPreviewScene = useSceneStore((s) => s.setPreviewScene)
    const autoCue = useSceneStore((s) => s.autoCue)

    // Drag-and-drop state
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)
    const dropPendingRef = useRef(false)

    // Sort scenes by sortOrder ascending (memoized — scenes ref changes on fetch)
    const sorted = useMemo(() => [...scenes].sort((a, b) => a.sortOrder - b.sortOrder), [scenes])

    // ── Navigation / Preview / Cueing ──────────────────────────────────────────

    const handleNavigate = useCallback(
        (scene: Scene) => {
            // If no scene is active yet, load immediately (first scene of session)
            if (!activeScene) {
                setActiveScene(scene)
                loadScene(scene.id)
                autoCue(scenes)
                return
            }
            // If clicking the already-active scene, clear preview
            if (scene.id === activeScene.id) {
                setPreviewScene(null)
                return
            }
            // Otherwise, set as preview (cockpit-only — no AV preload)
            setPreviewScene(scene)
        },
        [activeScene, setActiveScene, setPreviewScene, autoCue, scenes],
    )

    // ── Drag handlers ─────────────────────────────────────────────────────────

    const handleDragStart = useCallback((id: string) => {
        setDraggingId(id)
        dropPendingRef.current = false
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault()
        setDragOverId(id)
    }, [])

    const handleDrop = useCallback(
        async (targetId: string) => {
            if (!draggingId || draggingId === targetId || dropPendingRef.current) {
                setDraggingId(null)
                setDragOverId(null)
                return
            }

            dropPendingRef.current = true
            const changes = recalcSortOrders(scenes, draggingId, targetId)

            setDraggingId(null)
            setDragOverId(null)

            if (changes.length === 0) return

            try {
                await Promise.all(
                    changes.map(({ id, sortOrder }) => patchScene(id, { sortOrder })),
                )
                await refetch()
            } catch (err) {
                console.warn('[scene-timeline] drag reorder failed:', err)
                // Refetch to restore server truth even on error
                await refetch()
            }
        },
        [draggingId, scenes, refetch],
    )

    const handleDragEnd = useCallback(() => {
        setDraggingId(null)
        setDragOverId(null)
    }, [])

    // ── Empty / loading states ─────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="scene-timeline__empty">
                Loading scenes…
            </div>
        )
    }

    if (error) {
        return (
            <div className="scene-timeline__empty scene-timeline__empty--error">
                Failed to load scenes
            </div>
        )
    }

    if (sorted.length === 0) {
        return (
            <div className="scene-timeline__empty">
                No scenes — create one in the Scenes tab
            </div>
        )
    }

    // ── Timeline render ───────────────────────────────────────────────────────

    return (
        <div
            className="scene-timeline"
            role="list"
            aria-label="Scene timeline"
            onDragEnd={handleDragEnd}
        >
            {sorted.map((scene, idx) => {
                const variant = getNodeVariant(scene, activeScene, cuedScene, previewScene)
                const isLast = idx === sorted.length - 1

                return (
                    <React.Fragment key={scene.id}>
                        <SceneNode
                            scene={scene}
                            variant={variant}
                            allScenes={sorted}
                            onNavigate={handleNavigate}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            isDragging={draggingId === scene.id}
                            isDragOver={dragOverId === scene.id}
                            draggable={!isPlayMode}
                        />
                        {!isLast && <Connector afterVariant={variant} />}
                    </React.Fragment>
                )
            })}

        </div>
    )
}
