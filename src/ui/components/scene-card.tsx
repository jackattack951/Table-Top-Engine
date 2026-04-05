/**
 * Scene Card — Sprint 8f + Media Library integration.
 * Displays scene name, notes snippet, branch count, active indicator.
 * Inline expand/collapse shows: media slots, linked notes, scratchpad, branches, advancer.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { SceneAdvancer } from './scene-advancer'
import { MediaPicker } from './media-picker'
import { SceneSummary } from './scene-summary'
import { getAssetFileUrl } from '../hooks/use-assets'
import { useSceneSummary } from '../hooks/use-scene-summary'
import { useSceneStore } from '../stores/scene-store'
import { useAppStore } from '../stores/app-store'
import type { Scene, SceneBranch, Note } from '@core/types'
import type { MediaAsset } from '@shared/asset-types'

export interface SceneCardProps {
    scene: Scene
    isActive: boolean
    isCued?: boolean
    expanded: boolean
    isClosing?: boolean
    linkedNotes: Note[]
    allNotes: Note[]
    allScenes: Scene[]
    onToggleExpand: (sceneId: string) => void
    onLoad: (scene: Scene) => void
    onSaveScratchpad: (sceneId: string, scratchpad: string) => void
    onLinkNote: (sceneId: string, noteId: string) => void
    onUnlinkNote: (sceneId: string, noteId: string) => void
    onAddBranch: (sceneId: string, branch: SceneBranch) => void
    onRemoveBranch: (sceneId: string, branchIndex: number) => void
    onAdvance: (targetSceneId: string, transitionNote: string) => void
    onAssignMedia?: (sceneId: string, slot: 'background' | 'gameboard', asset: MediaAsset | null) => void
    /** Whether this scene is the campaign's starting scene */
    isStartingScene?: boolean
    /** Toggle this scene as the campaign's starting scene */
    onSetStartingScene?: (sceneId: string | null) => void
    /** HTML5 drag-and-drop callbacks for reorder */
    onDragStart: (e: React.DragEvent, sceneId: string) => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent, targetSceneId: string) => void
}

/**
 * Scene card with inline expand/collapse.
 * Collapsed: name, notes snippet, badge, active indicator.
 * Expanded: linked notes, scratchpad, branches, advancer (if active).
 */
export function SceneCard({
    scene,
    isActive,
    isCued,
    expanded,
    isClosing,
    linkedNotes,
    allNotes,
    allScenes,
    onToggleExpand,
    onLoad,
    onSaveScratchpad,
    onLinkNote,
    onUnlinkNote,
    onAddBranch,
    onRemoveBranch,
    onAdvance,
    onAssignMedia,
    isStartingScene,
    onSetStartingScene,
    onDragStart,
    onDragOver,
    onDrop,
}: SceneCardProps): React.JSX.Element {
    const isPlayMode = useAppStore((s) => s.appMode === 'play')
    const lastSavedAt = useSceneStore((s) => s.lastSavedAt)
    const [showSaved, setShowSaved] = useState(false)
    const { summary, loading: summaryLoading } = useSceneSummary(expanded ? scene.id : null)

    useEffect(() => {
        if (!isActive || lastSavedAt === null) return
        setShowSaved(true)
        const timer = setTimeout(() => setShowSaved(false), 2500)
        return () => clearTimeout(timer)
    }, [isActive, lastSavedAt])

    const [pickerSlot, setPickerSlot] = useState<'background' | 'gameboard' | null>(null)
    const branchCount = scene.branches.length
    const notesSnippet = scene.notes
        ? scene.notes.slice(0, 80) + (scene.notes.length > 80 ? '...' : '')
        : null

    // ── Scratchpad with debounced auto-save ───────────────────────────────────
    const [scratchpadValue, setScratchpadValue] = useState(scene.scratchpad ?? '')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingScratchpadRef = useRef<{ sceneId: string; value: string } | null>(null)

    // Sync from parent when scene changes
    useEffect(() => {
        setScratchpadValue(scene.scratchpad ?? '')
    }, [scene.id, scene.scratchpad])

    const handleScratchpadChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value
        setScratchpadValue(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        pendingScratchpadRef.current = { sceneId: scene.id, value }
        debounceRef.current = setTimeout(() => {
            pendingScratchpadRef.current = null
            onSaveScratchpad(scene.id, value)
        }, 500)
    }, [scene.id, onSaveScratchpad])

    // Flush pending scratchpad save on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            if (pendingScratchpadRef.current) {
                const { sceneId, value } = pendingScratchpadRef.current
                pendingScratchpadRef.current = null
                onSaveScratchpad(sceneId, value)
            }
        }
    }, [onSaveScratchpad])

    // ── Note linking ──────────────────────────────────────────────────────────
    const [showNoteDropdown, setShowNoteDropdown] = useState(false)
    const [noteSearch, setNoteSearch] = useState('')

    const linkedNoteIds = useMemo(() => new Set(linkedNotes.map((n) => n.id)), [linkedNotes])
    const availableNotes = useMemo(
        () => allNotes.filter(
            (n) => !linkedNoteIds.has(n.id) && n.title.toLowerCase().includes(noteSearch.toLowerCase())
        ),
        [allNotes, linkedNoteIds, noteSearch]
    )

    // ── Branch management ─────────────────────────────────────────────────────
    const [showAddBranch, setShowAddBranch] = useState(false)
    const [newBranchLabel, setNewBranchLabel] = useState('')
    const [newBranchTarget, setNewBranchTarget] = useState('')
    const [newBranchNote, setNewBranchNote] = useState('')
    const [expandedTransition, setExpandedTransition] = useState<number | null>(null)

    const otherScenes = useMemo(() => allScenes.filter((s) => s.id !== scene.id), [allScenes, scene.id])

    function handleAddBranch(): void {
        if (!newBranchLabel.trim() || !newBranchTarget) return
        const branch: SceneBranch = {
            label: newBranchLabel.trim(),
            targetSceneId: newBranchTarget,
            transitionNote: newBranchNote.trim(),
        }
        onAddBranch(scene.id, branch)
        setNewBranchLabel('')
        setNewBranchTarget('')
        setNewBranchNote('')
        setShowAddBranch(false)
    }

    // ── Drag state ────────────────────────────────────────────────────────────
    const [isDragging, setIsDragging] = useState(false)

    return (
        <div
            className={[
                'scene-card',
                isActive && 'scene-card--active',
                isCued && !isActive && 'scene-card--cued',
                expanded && 'scene-card--expanded',
                isClosing && 'scene-card--closing',
                isDragging && 'scene-card--dragging',
            ].filter(Boolean).join(' ')}
            draggable={!isPlayMode}
            onDragStart={(e) => {
                if (isPlayMode) return
                setIsDragging(true)
                onDragStart(e, scene.id)
            }}
            onDragEnd={() => setIsDragging(false)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, scene.id)}
        >
            {/* ── Collapsed header (always visible) ─────────────────────── */}
            <button
                className="scene-card__header"
                onClick={() => onToggleExpand(scene.id)}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Collapse' : 'Expand'} scene: ${scene.name}`}
            >
                <span className="scene-card__drag-handle" aria-hidden="true">::</span>
                <span className="scene-card__name">{scene.name}</span>
                <span className="scene-card__header-badges">
                    {isStartingScene && <span className="scene-card__badge scene-card__badge--starting">{'\u2605'}</span>}
                    {isActive && <span className="scene-card__badge scene-card__badge--live"><span className="live-dot" />LIVE</span>}
                    {showSaved && <span className="scene-card__save-indicator">Saved</span>}
                    {linkedNotes.length > 0 && (
                        <span className="scene-card__badge">
                            {linkedNotes.length} note{linkedNotes.length !== 1 ? 's' : ''}
                        </span>
                    )}
                    {branchCount > 0 && (
                        <span className="scene-card__badge">
                            {branchCount} branch{branchCount !== 1 ? 'es' : ''}
                        </span>
                    )}
                </span>
                <span className={`scene-card__chevron${expanded ? ' scene-card__chevron--open' : ''}`}>
                    {'\u25B6'}
                </span>
            </button>

            {!expanded && notesSnippet && (
                <p className="scene-card__notes">{notesSnippet}</p>
            )}

            {/* ── Expanded content ──────────────────────────────────────── */}
            {expanded && (
                <div className="scene-card__expand-content">

                    {/* ── Scene Summary ─────────────────────────────────────── */}
                    {summaryLoading && <p className="scene-summary__loading">Loading summary…</p>}
                    {summary && <SceneSummary summary={summary} allScenes={allScenes} />}

                    {/* Load Scene + Starting Scene row */}
                    <div className="scene-card__action-row">
                        <button
                            className={`btn ${isActive ? 'btn-ghost' : 'btn-primary'} scene-card__load-btn`}
                            onClick={() => onLoad(scene)}
                            disabled={isActive}
                        >
                            {isActive ? 'Currently Active' : 'Load Scene'}
                        </button>
                        {onSetStartingScene && (
                            <button
                                className={`btn btn-ghost btn-sm scene-card__starting-btn${isStartingScene ? ' scene-card__starting-btn--active' : ''}`}
                                onClick={() => onSetStartingScene(isStartingScene ? null : scene.id)}
                                title={isStartingScene ? 'Remove as starting scene' : 'Set as starting scene'}
                                aria-label={isStartingScene ? 'Remove as starting scene' : 'Set as starting scene'}
                            >
                                {isStartingScene ? '\u2605 Starting' : '\u2606 Set Starting'}
                            </button>
                        )}
                    </div>

                    {/* ── Media Slots (BG + GB) — hidden in Play mode ── */}
                    {onAssignMedia && !isPlayMode && (
                        <div className="scene-card__media-slots">
                            <div className="scene-card__media-slot">
                                <span className="scene-card__media-label">Background</span>
                                {scene.backgroundAssetId ? (
                                    <div className="scene-card__media-assigned">
                                        <img
                                            className="scene-card__media-thumb"
                                            src={getAssetFileUrl(scene.backgroundAssetId)}
                                            alt="Background"
                                        />
                                        <div className="scene-card__media-actions">
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setPickerSlot('background')}
                                            >
                                                Change
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => onAssignMedia(scene.id, 'background', null)}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className="btn btn-ghost btn-sm scene-card__media-browse"
                                        onClick={() => setPickerSlot('background')}
                                    >
                                        Browse Library
                                    </button>
                                )}
                            </div>

                            <div className="scene-card__media-slot">
                                <span className="scene-card__media-label">Gameboard</span>
                                {scene.gameboardAssetId ? (
                                    <div className="scene-card__media-assigned">
                                        <img
                                            className="scene-card__media-thumb"
                                            src={getAssetFileUrl(scene.gameboardAssetId)}
                                            alt="Gameboard"
                                        />
                                        <div className="scene-card__media-actions">
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setPickerSlot('gameboard')}
                                            >
                                                Change
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => onAssignMedia(scene.id, 'gameboard', null)}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className="btn btn-ghost btn-sm scene-card__media-browse"
                                        onClick={() => setPickerSlot('gameboard')}
                                    >
                                        Browse Library
                                    </button>
                                )}
                            </div>

                            <MediaPicker
                                open={pickerSlot !== null}
                                onClose={() => setPickerSlot(null)}
                                onSelect={(asset) => {
                                    if (pickerSlot) onAssignMedia(scene.id, pickerSlot, asset)
                                    setPickerSlot(null)
                                }}
                                categoryFilter={pickerSlot ? [pickerSlot] : undefined}
                                selectedAssetId={pickerSlot === 'background' ? scene.backgroundAssetId : scene.gameboardAssetId}
                                title={pickerSlot === 'background' ? 'Select Background' : 'Select Gameboard'}
                            />
                        </div>
                    )}

                    {/* ── Scene Advancer (only when active + has branches) ── */}
                    {isActive && (
                        <SceneAdvancer
                            branches={scene.branches}
                            allScenes={allScenes}
                            onAdvance={onAdvance}
                        />
                    )}

                    {/* ── Linked Notes ──────────────────────────────────────── */}
                    <div className="scene-card__section">
                        <div className="scene-card__section-label">Linked Notes</div>
                        <div className="scene-card__note-pills">
                            {linkedNotes.length === 0 && (
                                <span className="scene-card__empty-hint">No linked notes</span>
                            )}
                            {linkedNotes.map((note) => (
                                <span key={note.id} className="scene-card__note-pill">
                                    {note.title}
                                    {!isPlayMode && (
                                        <button
                                            className="scene-card__note-pill-remove"
                                            onClick={() => onUnlinkNote(scene.id, note.id)}
                                            aria-label={`Unlink note: ${note.title}`}
                                        >
                                            x
                                        </button>
                                    )}
                                </span>
                            ))}
                        </div>
                        {showNoteDropdown && !isPlayMode ? (
                            <div className="scene-card__note-link-form">
                                <input
                                    className="scene-card__input"
                                    placeholder="Search notes..."
                                    value={noteSearch}
                                    onChange={(e) => setNoteSearch(e.target.value)}
                                    autoFocus
                                />
                                <div className="scene-card__note-dropdown">
                                    {availableNotes.length === 0 && (
                                        <div className="scene-card__note-dropdown-empty">
                                            No matching notes
                                        </div>
                                    )}
                                    {availableNotes.slice(0, 10).map((note) => (
                                        <button
                                            key={note.id}
                                            className="scene-card__note-dropdown-item"
                                            onClick={() => {
                                                onLinkNote(scene.id, note.id)
                                                setNoteSearch('')
                                                setShowNoteDropdown(false)
                                            }}
                                        >
                                            <span className="scene-card__note-dropdown-type">{note.type}</span>
                                            {note.title}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="btn btn-ghost scene-card__btn-sm"
                                    onClick={() => { setShowNoteDropdown(false); setNoteSearch('') }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            !isPlayMode && (
                                <button
                                    className="btn btn-ghost scene-card__btn-sm"
                                    onClick={() => setShowNoteDropdown(true)}
                                >
                                    + Link Note
                                </button>
                            )
                        )}
                    </div>

                    {/* ── Scratchpad ────────────────────────────────────────── */}
                    <div className="scene-card__section">
                        <div className="scene-card__section-label">Scratchpad</div>
                        <textarea
                            className="scene-card__scratchpad"
                            value={scratchpadValue}
                            onChange={handleScratchpadChange}
                            placeholder="Session notes..."
                            rows={4}
                        />
                    </div>

                    {/* ── Branches ──────────────────────────────────────────── */}
                    <div className="scene-card__section">
                        <div className="scene-card__section-label">Branches</div>
                        <div className="scene-card__branch-list">
                            {scene.branches.map((branch, idx) => {
                                const target = allScenes.find((s) => s.id === branch.targetSceneId)
                                return (
                                    <div key={`${branch.label}-${branch.targetSceneId}`} className="scene-card__branch-item">
                                        <div className="scene-card__branch-row">
                                            <span className="scene-card__branch-label">
                                                {branch.label}
                                            </span>
                                            {target && (
                                                <span className="scene-card__branch-target">
                                                    {target.name}
                                                </span>
                                            )}
                                            <button
                                                className="scene-card__branch-toggle"
                                                onClick={() => setExpandedTransition(
                                                    expandedTransition === idx ? null : idx
                                                )}
                                                aria-label={`Toggle transition note for branch: ${branch.label}`}
                                            >
                                                {branch.transitionNote ? 'note' : '...'}
                                            </button>
                                            {!isPlayMode && (
                                                <button
                                                    className="scene-card__branch-remove"
                                                    onClick={() => onRemoveBranch(scene.id, idx)}
                                                    aria-label={`Remove branch: ${branch.label}`}
                                                >
                                                    x
                                                </button>
                                            )}
                                        </div>
                                        {expandedTransition === idx && (
                                            <div className="scene-card__branch-transition">
                                                {branch.transitionNote || '(no transition note)'}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {showAddBranch && !isPlayMode ? (
                            <div className="scene-card__branch-form">
                                <input
                                    className="scene-card__input"
                                    placeholder="Branch label (e.g. Peaceful outcome)"
                                    value={newBranchLabel}
                                    onChange={(e) => setNewBranchLabel(e.target.value)}
                                    autoFocus
                                />
                                <select
                                    className="scene-card__select"
                                    value={newBranchTarget}
                                    onChange={(e) => setNewBranchTarget(e.target.value)}
                                >
                                    <option value="">-- Select target scene --</option>
                                    {otherScenes.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <textarea
                                    className="scene-card__input scene-card__branch-note-input"
                                    placeholder="Transition note (optional)"
                                    value={newBranchNote}
                                    onChange={(e) => setNewBranchNote(e.target.value)}
                                    rows={2}
                                />
                                <div className="scene-card__branch-form-actions">
                                    <button
                                        className="btn btn-ghost scene-card__btn-sm"
                                        onClick={() => setShowAddBranch(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary scene-card__btn-sm"
                                        onClick={handleAddBranch}
                                        disabled={!newBranchLabel.trim() || !newBranchTarget}
                                    >
                                        Add Branch
                                    </button>
                                </div>
                            </div>
                        ) : (
                            !isPlayMode && (
                                <button
                                    className="btn btn-ghost scene-card__btn-sm"
                                    onClick={() => setShowAddBranch(true)}
                                >
                                    + Add Branch
                                </button>
                            )
                        )}
                    </div>

                </div>
            )}
        </div>
    )
}
