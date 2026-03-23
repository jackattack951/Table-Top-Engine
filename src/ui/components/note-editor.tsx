/**
 * NoteEditor — right panel of the Notes Tab.
 * Title, type, tags, pin/archive, status, color, CodeMirror body editor, and scene linking.
 * Sprint 8d / 15b.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MarkdownEditor } from './markdown-editor'
import type { MarkdownEditorHandle } from './markdown-editor'
import { NoteLinker } from './note-linker'
import { parseNotes } from '../lib/parse-notes'
import { fireTrigger } from '../lib/sync'
import { ExtractEntityModal } from './extract-entity-modal'
import type { ExtractTarget, ExtractConfirmData } from './extract-entity-modal'
import type { Note, NoteType, NoteColor, Scene } from '@core/types'
import { NOTE_STATUS_OPTIONS, NOTE_COLORS } from '@core/types'
import type { WikilinkExtensionOptions } from '../lib/cm-wikilink'
import { BacklinksPanel } from './backlinks-panel'

const NOTE_TYPES: NoteType[] = ['scene', 'quest', 'npc', 'faction', 'location', 'lore', 'session', 'general']

const TYPE_DISPLAY: Record<NoteType, string> = {
    scene: 'Scene',
    quest: 'Quest',
    npc: 'NPC',
    faction: 'Faction',
    location: 'Location',
    lore: 'Lore',
    session: 'Session',
    general: 'General',
}

interface NoteEditorProps {
    note: Note
    allNotes: Note[]
    allScenes: Scene[]
    sceneNoteLinks: Record<string, string[]>
    onSave: (id: string, patch: Partial<Pick<Note, 'title' | 'type' | 'body' | 'tags' | 'pinned' | 'archived' | 'status' | 'color'>>) => void
    onDelete: (id: string) => void
    onLinkScene: (sceneId: string, noteId: string) => void
    onUnlinkScene: (sceneId: string, noteId: string) => void
    onNavigateNote: (noteId: string) => void
    /** Called when DM extracts an entity from selected text. Caller creates the entity. */
    onExtractEntity?: (data: ExtractConfirmData, replaceSelection: (wikilink: string) => void) => void
}

export function NoteEditor({
    note,
    allNotes,
    allScenes,
    sceneNoteLinks,
    onSave,
    onDelete,
    onLinkScene,
    onUnlinkScene,
    onNavigateNote,
    onExtractEntity,
}: NoteEditorProps): React.JSX.Element {
    const [localTitle, setLocalTitle] = useState(note.title)
    const [isEditing, setIsEditing] = useState(true)
    const [newTag, setNewTag] = useState('')
    const [showTagInput, setShowTagInput] = useState(false)
    const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const bodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Extract entity state
    const editorHandleRef = useRef<MarkdownEditorHandle | null>(null)
    const bodyWrapRef = useRef<HTMLDivElement | null>(null)
    const [selectedText, setSelectedText] = useState('')
    const [selectionCoords, setSelectionCoords] = useState<{ top: number; left: number } | null>(null)
    const [extractModal, setExtractModal] = useState<{ text: string; type: ExtractTarget } | null>(null)
    const [extractCreating, setExtractCreating] = useState(false)

    // Compute toolbar position relative to body-wrap (absolute, not fixed)
    const toolbarPos = useMemo(() => {
        if (!selectionCoords || !bodyWrapRef.current) return null
        const wrapRect = bodyWrapRef.current.getBoundingClientRect()
        return {
            top: selectionCoords.top - wrapRect.top - 40,
            left: selectionCoords.left - wrapRect.left,
        }
    }, [selectionCoords])

    // Reset local state when switching notes
    useEffect(() => {
        setLocalTitle(note.title)
        return () => {
            if (titleTimer.current) clearTimeout(titleTimer.current)
            if (bodyTimer.current) clearTimeout(bodyTimer.current)
        }
    }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // Derive linked scene IDs for this note (invert the sceneId→noteId[] map)
    const linkedSceneIds = useMemo(() => {
        const ids: string[] = []
        for (const [sceneId, noteIds] of Object.entries(sceneNoteLinks)) {
            if (noteIds.includes(note.id)) ids.push(sceneId)
        }
        return ids
    }, [sceneNoteLinks, note.id])

    // Status options for current note type
    const statusOptions = NOTE_STATUS_OPTIONS[note.type] ?? null

    // Wikilink support — known titles for broken-link detection + autocomplete config
    const knownTitles = useMemo(() => {
        const set = new Set<string>()
        for (const n of allNotes) set.add(n.title.toLowerCase())
        return set
    }, [allNotes])

    const handleWikilinkNavigate = useCallback((title: string) => {
        const target = allNotes.find((n) => n.title.toLowerCase() === title.toLowerCase())
        if (target) onNavigateNote(target.id)
    }, [allNotes, onNavigateNote])

    // Stable ref-based wikilink config so CodeMirror extension reads latest values
    const allNotesRef = useRef(allNotes)
    allNotesRef.current = allNotes
    const navigateRef = useRef(handleWikilinkNavigate)
    navigateRef.current = handleWikilinkNavigate

    const wikilinkConfig = useMemo<WikilinkExtensionOptions>(() => ({
        getNotes: () => allNotesRef.current.map((n) => ({ id: n.id, title: n.title })),
        onNavigate: (title) => navigateRef.current(title),
    }), []) // stable — reads from refs

    const handleTitleChange = useCallback((value: string) => {
        setLocalTitle(value)
        if (titleTimer.current) clearTimeout(titleTimer.current)
        titleTimer.current = setTimeout(() => {
            onSave(note.id, { title: value })
        }, 500)
    }, [note.id, onSave])

    const handleBodyChange = useCallback((value: string) => {
        if (bodyTimer.current) clearTimeout(bodyTimer.current)
        bodyTimer.current = setTimeout(() => {
            onSave(note.id, { body: value })
        }, 500)
    }, [note.id, onSave])

    const handleTypeChange = useCallback((type: NoteType) => {
        // Clear status if new type doesn't support it
        const newStatusOptions = NOTE_STATUS_OPTIONS[type]
        const statusPatch: { status?: string | null } = {}
        if (note.status && (!newStatusOptions || !newStatusOptions.includes(note.status))) {
            statusPatch.status = null
        }
        onSave(note.id, { type, ...statusPatch })
    }, [note.id, note.status, onSave])

    const handleAddTag = useCallback(() => {
        const tag = newTag.trim()
        if (!tag || note.tags.includes(tag)) {
            setNewTag('')
            setShowTagInput(false)
            return
        }
        onSave(note.id, { tags: [...note.tags, tag] })
        setNewTag('')
        setShowTagInput(false)
    }, [newTag, note.id, note.tags, onSave])

    const handleRemoveTag = useCallback((tag: string) => {
        onSave(note.id, { tags: note.tags.filter((t) => t !== tag) })
    }, [note.id, note.tags, onSave])

    const handleDelete = useCallback(() => {
        if (note.archived) {
            if (window.confirm(`Permanently delete "${note.title}"? This cannot be undone.`)) {
                onDelete(note.id)
            }
        } else {
            onSave(note.id, { archived: true })
        }
    }, [note.id, note.title, note.archived, onDelete, onSave])

    const handleTrigger = useCallback((label: string) => {
        fireTrigger(label)
    }, [])

    // Selection change handler for extract toolbar
    const handleSelectionChange = useCallback((text: string, coords: { top: number; left: number } | null) => {
        setSelectedText(text)
        setSelectionCoords(coords)
    }, [])

    const handleExtractConfirm = useCallback((data: ExtractConfirmData) => {
        if (!onExtractEntity) return
        setExtractCreating(true)
        onExtractEntity(data, (wikilink: string) => {
            editorHandleRef.current?.replaceSelection(wikilink)
            setExtractModal(null)
            setExtractCreating(false)
            setSelectedText('')
        })
    }, [onExtractEntity])

    return (
        <div className="note-editor">
            {/* Header: title + pin/archive + delete */}
            <div className="note-editor__header">
                <input
                    className="note-editor__title"
                    value={localTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Note title"
                    aria-label="Note title"
                />
                <div className="note-editor__header-actions">
                    <button
                        className={`note-editor__icon-btn${note.pinned ? ' active' : ''}`}
                        onClick={() => onSave(note.id, { pinned: !note.pinned })}
                        title={note.pinned ? 'Unpin' : 'Pin to top'}
                        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                    >
                        &#x1F4CC;
                    </button>
                    <button
                        className={`note-editor__icon-btn note-editor__icon-btn--archive${note.archived ? ' active' : ''}`}
                        onClick={() => onSave(note.id, { archived: !note.archived })}
                        title={note.archived ? 'Unarchive' : 'Archive'}
                        aria-label={note.archived ? 'Unarchive note' : 'Archive note'}
                    >
                        &#x1F4E6;
                    </button>
                    <button
                        className="btn btn-ghost note-editor__delete-btn"
                        onClick={handleDelete}
                    >
                        {note.archived ? 'Delete' : 'Archive'}
                    </button>
                </div>
            </div>

            {/* Type + Status + Color + Tags row */}
            <div className="note-editor__meta-row">
                <select
                    className="form-select"
                    value={note.type}
                    onChange={(e) => handleTypeChange(e.target.value as NoteType)}
                    aria-label="Note type"
                >
                    {NOTE_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_DISPLAY[t]}</option>
                    ))}
                </select>

                {/* Status dropdown — only for types that support it */}
                {statusOptions && (
                    <select
                        className="form-select"
                        value={note.status ?? ''}
                        onChange={(e) => onSave(note.id, { status: e.target.value || null })}
                        aria-label="Note status"
                    >
                        <option value="">No status</option>
                        {statusOptions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                )}

                {/* Color picker */}
                <div className="note-color-picker">
                    {NOTE_COLORS.map((c) => (
                        <button
                            key={c}
                            className={`note-color-picker__swatch note-color-picker__swatch--${c}${note.color === c ? ' active' : ''}`}
                            onClick={() => onSave(note.id, { color: note.color === c ? null : c as NoteColor })}
                            title={c}
                            aria-label={`Set color: ${c}`}
                            type="button"
                        />
                    ))}
                    {note.color && (
                        <button
                            className="note-color-picker__clear"
                            onClick={() => onSave(note.id, { color: null })}
                            title="Clear color"
                            aria-label="Clear color"
                            type="button"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* Tags row */}
            <div className="note-editor__tags-row">
                {note.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                        {tag}
                        <button
                            className="tag-chip__remove"
                            onClick={() => handleRemoveTag(tag)}
                            aria-label={`Remove tag: ${tag}`}
                            type="button"
                        >
                            ×
                        </button>
                    </span>
                ))}

                {showTagInput ? (
                    <input
                        className="form-input note-editor__tag-input"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTag()
                            if (e.key === 'Escape') { setNewTag(''); setShowTagInput(false) }
                        }}
                        onBlur={handleAddTag}
                        placeholder="tag"
                        autoFocus
                    />
                ) : (
                    <button
                        className="btn btn-ghost note-editor__add-tag-btn"
                        onClick={() => setShowTagInput(true)}
                    >
                        + tag
                    </button>
                )}
            </div>

            {/* Edit/Preview toggle */}
            <div className="note-editor__toggle-bar">
                <button
                    className="btn btn-ghost note-editor__toggle-btn"
                    onClick={() => setIsEditing((v) => !v)}
                >
                    {isEditing ? 'Preview' : 'Edit'}
                </button>
            </div>

            {/* Body */}
            {isEditing ? (
                <div className="note-editor__body-wrap" ref={bodyWrapRef}>
                    <MarkdownEditor
                        value={note.body}
                        onChange={handleBodyChange}
                        placeholder="Write your notes here…\n\nType [[ to link notes. Supports **bold**, *italic*, and [Trigger: Label]."
                        wikilinkConfig={wikilinkConfig}
                        editorRef={editorHandleRef}
                        onSelectionChange={handleSelectionChange}
                    />

                    {/* Extract toolbar — appears when text is selected */}
                    {onExtractEntity && selectedText.length > 3 && selectionCoords && toolbarPos && (
                        <div
                            className="extract-toolbar"
                            style={{
                                top: `${toolbarPos.top}px`,
                                left: `${toolbarPos.left}px`,
                            }}
                        >
                            <span className="extract-toolbar__label">Extract:</span>
                            {(['npc', 'item', 'location', 'quest', 'faction'] as ExtractTarget[]).map((t) => (
                                <button
                                    key={t}
                                    className="extract-toolbar__btn"
                                    onClick={() => setExtractModal({ text: selectedText, type: t })}
                                >
                                    {t === 'npc' ? 'NPC' : t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Extract entity modal */}
                    {extractModal && (
                        <ExtractEntityModal
                            selectedText={extractModal.text}
                            targetType={extractModal.type}
                            onConfirm={handleExtractConfirm}
                            onCancel={() => { setExtractModal(null); setExtractCreating(false) }}
                            creating={extractCreating}
                        />
                    )}
                </div>
            ) : (
                <div
                    className={`note-editor__preview${!note.body ? ' note-editor__preview--empty' : ''}`}
                    role="region"
                    aria-label="Note preview"
                >
                    {note.body
                        ? parseNotes(note.body, {
                            onTrigger: handleTrigger,
                            onWikilinkClick: handleWikilinkNavigate,
                            knownTitles,
                        })
                        : 'Click Edit to write notes.'}
                </div>
            )}

            {/* Backlinks — notes that reference this note via [[wikilinks]] */}
            <BacklinksPanel
                currentNote={note}
                allNotes={allNotes}
                onNavigate={onNavigateNote}
            />

            {/* Scene linker */}
            <div className="note-editor__linker">
                <NoteLinker
                    linkedSceneIds={linkedSceneIds}
                    allScenes={allScenes}
                    onLink={(sceneId) => onLinkScene(sceneId, note.id)}
                    onUnlink={(sceneId) => onUnlinkScene(sceneId, note.id)}
                />
            </div>
        </div>
    )
}
