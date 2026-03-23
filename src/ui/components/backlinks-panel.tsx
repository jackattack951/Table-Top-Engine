/**
 * BacklinksPanel — shows all notes that reference the current note via [[wikilinks]].
 * Computed at render time by scanning note bodies.
 * Sprint 15f.
 */
import React, { useMemo, useState } from 'react'
import type { Note, NoteType } from '@core/types'

interface BacklinksPanelProps {
    /** The note currently being viewed */
    currentNote: Note
    /** All notes in the campaign */
    allNotes: Note[]
    /** Navigate to a note by ID */
    onNavigate: (noteId: string) => void
}

const TYPE_SHORT: Record<NoteType, string> = {
    scene: 'SCN',
    quest: 'QST',
    npc: 'NPC',
    faction: 'FCT',
    location: 'LOC',
    lore: 'LOR',
    session: 'SES',
    general: 'GEN',
}

/**
 * Find all notes whose body contains [[currentNote.title]].
 * Case-insensitive match.
 */
function getBacklinks(currentNote: Note, allNotes: Note[]): Note[] {
    if (!currentNote.title) return []
    const titleLower = currentNote.title.toLowerCase()
    // Build a regex that matches [[Title]] case-insensitively
    // Escape regex special chars in the title
    const escaped = titleLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\[\\[${escaped}\\]\\]`, 'i')

    return allNotes.filter((n) => {
        if (n.id === currentNote.id) return false // don't self-reference
        return pattern.test(n.body)
    })
}

export function BacklinksPanel({
    currentNote,
    allNotes,
    onNavigate,
}: BacklinksPanelProps): React.JSX.Element | null {
    const [isCollapsed, setIsCollapsed] = useState(false)

    const backlinks = useMemo(
        () => getBacklinks(currentNote, allNotes),
        [currentNote, allNotes],
    )

    if (backlinks.length === 0) return null

    return (
        <div className="backlinks-panel">
            <button
                className="backlinks-panel__header"
                onClick={() => setIsCollapsed((v) => !v)}
                aria-expanded={!isCollapsed}
            >
                <span className={`note-group-chevron${isCollapsed ? ' note-group-chevron--collapsed' : ''}`}>
                    ▼
                </span>
                Referenced By ({backlinks.length})
            </button>

            {!isCollapsed && (
                <div className="backlinks-panel__list">
                    {backlinks.map((note) => (
                        <button
                            key={note.id}
                            className="backlinks-panel__item"
                            onClick={() => onNavigate(note.id)}
                        >
                            <span className={`note-type-dot note-type-dot--${note.type}`} />
                            <span className="backlinks-panel__item-title">
                                {note.title || 'Untitled'}
                            </span>
                            <span className="backlinks-panel__item-type">
                                {TYPE_SHORT[note.type]}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
