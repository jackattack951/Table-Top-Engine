/**
 * NotesStrip — Sprint 10e + 18b/18c (preview mode).
 *
 * Bottom strip on the Dashboard split into two halves:
 *   Left:  Scene Notes (read-only, linked to active or preview scene)
 *   Right: Scratchpad (in-memory textarea, session-scoped)
 *
 * Priority: activeScene is default. When the DM clicks a scene to preview,
 * previewScene overrides the display. cuedScene does NOT auto-show notes.
 *
 * Preview mode (previewScene set):
 *   - Green glow border around the strip
 *   - Preview banner showing scene name
 *   - Notes show the preview scene's linked notes instead of the active scene's
 */
import React, { useCallback, useState } from 'react'
import { useSceneStore } from '../../stores/scene-store'
import { useNotesStore } from '../../stores/notes-store'
import { parseNotes } from '../../lib/parse-notes'
import type { Note, Scene } from '@core/types'

// ─── Scene Notes (left half) ─────────────────────────────────────────────────

interface SceneNotesProps {
    scene: Scene | null
}

function SceneNotes({ scene }: SceneNotesProps): React.JSX.Element {
    const getNotesForScene = useNotesStore((s) => s.getNotesForScene)

    if (!scene) {
        return (
            <p className="notes-strip__empty">Select a scene to view notes</p>
        )
    }

    const notes: Note[] = getNotesForScene(scene.id)

    if (notes.length === 0) {
        return (
            <p className="notes-strip__empty">No notes linked to this scene</p>
        )
    }

    return (
        <>
            {notes.map((note) => (
                <NoteEntry key={note.id} note={note} />
            ))}
        </>
    )
}

interface NoteEntryProps {
    note: Note
}

function NoteEntry({ note }: NoteEntryProps): React.JSX.Element {
    // No-op handler — scene notes are read-only in the strip.
    // Trigger buttons render but do nothing here; editing happens in Notes tab.
    const handleTrigger = useCallback((_label: string) => {
        // Read-only view — triggers are visible but not interactive from the strip
    }, [])

    return (
        <div className="notes-strip__note">
            {note.title && (
                <p className="notes-strip__note-title">{note.title}</p>
            )}
            <div className="notes-strip__content">
                {parseNotes(note.body, handleTrigger)}
            </div>
        </div>
    )
}

// ─── Scratchpad (right half) ─────────────────────────────────────────────────

function Scratchpad(): React.JSX.Element {
    const [text, setText] = useState('')

    return (
        <textarea
            className="form-input notes-strip__scratchpad"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Session notes..."
            aria-label="Session scratchpad"
        />
    )
}

// ─── NotesStrip ───────────────────────────────────────────────────────────────

export function NotesStrip(): React.JSX.Element {
    const activeScene = useSceneStore((s) => s.activeScene)
    const previewScene = useSceneStore((s) => s.previewScene)

    // Priority: previewScene (DM clicked) > activeScene (default)
    // cuedScene is NOT in this chain — it doesn't auto-show notes
    const isPreview = previewScene !== null
    const displayScene = previewScene ?? activeScene

    return (
        <div className={`notes-strip${isPreview ? ' notes-strip--preview' : ''}`}>
            {/* Preview banner — visible when DM is previewing a scene */}
            {isPreview && (
                <div className="notes-strip__preview-banner">
                    <span className="notes-strip__preview-label">
                        PREVIEW: {previewScene.name}
                    </span>
                </div>
            )}

            {/* Left: Scene Notes */}
            <div className="notes-strip__section">
                <p className="notes-strip__header">
                    {isPreview ? 'Preview Notes' : 'Scene Notes'}
                </p>
                <div className="notes-strip__content">
                    <SceneNotes scene={displayScene} />
                </div>
            </div>

            {/* Right: Scratchpad */}
            <div className="notes-strip__section">
                <p className="notes-strip__header">Scratchpad</p>
                <Scratchpad />
            </div>
        </div>
    )
}
