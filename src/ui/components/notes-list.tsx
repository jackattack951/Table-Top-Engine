/**
 * NotesList — left panel of the Notes Tab.
 * Searchable, filterable list of notes grouped by type.
 * Supports List View and Card Grid View.
 * Pinned notes at top, archive toggle, status badges, color stripes, type dots.
 * Sprint 8d / 15b / 15c.
 */
import React, { useState, useMemo } from 'react'
import { useNotesStore } from '../stores/notes-store'
import type { NotesViewMode } from '../stores/notes-store'
import type { Note, NoteType } from '@core/types'

interface NotesListProps {
    notes: Note[]
    activeNoteId: string | null
    onSelectNote: (noteId: string) => void
    onCreateNote: () => void
}

const TYPE_ORDER: NoteType[] = ['scene', 'quest', 'npc', 'faction', 'location', 'lore', 'session', 'general']

const TYPE_LABELS: Record<NoteType, string> = {
    scene: 'Scene Notes',
    quest: 'Quests',
    npc: 'NPC Notes',
    faction: 'Factions',
    location: 'Location Notes',
    lore: 'Lore',
    session: 'Session Logs',
    general: 'General',
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

function statusSlug(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-')
}

function getExcerpt(body: string, maxLen = 80): string {
    if (!body) return ''
    // Strip markdown formatting for cleaner excerpt
    const clean = body
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/\[(.+?)\]\(.*?\)/g, '$1')
        .replace(/\[Trigger:\s*(.+?)\]/g, '$1')
        .trim()
    return clean.length > maxLen ? clean.slice(0, maxLen) + '…' : clean
}

// ─── List View Item ──────────────────────────────────────────────────────────

function NoteItem({ note, isActive, onSelect }: { note: Note; isActive: boolean; onSelect: () => void }) {
    const colorClass = note.color ? ` note-list-item--color-${note.color}` : ''
    const activeClass = isActive ? ' note-list-item--active' : ''
    const archivedClass = note.archived ? ' note-list-item--archived' : ''
    const pinnedClass = note.pinned ? ' note-list-item--pinned' : ''

    return (
        <button
            className={`note-list-item${activeClass}${archivedClass}${pinnedClass}${colorClass}`}
            onClick={onSelect}
            aria-current={isActive ? 'true' : undefined}
        >
            <span className={`note-type-dot note-type-dot--${note.type}`} />
            <span className="note-list-item__content">
                <span className="note-list-item__title">
                    {note.title || 'Untitled'}
                </span>
                {note.pinned && <span className="note-list-item__pin-icon" title="Pinned">&#x1F4CC;</span>}
                {note.status && (
                    <span className={`note-status-badge note-status-badge--${statusSlug(note.status)}`}>
                        {note.status}
                    </span>
                )}
            </span>
        </button>
    )
}

// ─── Card Grid Item ──────────────────────────────────────────────────────────

function NoteCard({ note, isActive, onSelect }: { note: Note; isActive: boolean; onSelect: () => void }) {
    const colorClass = note.color ? ` note-card--color-${note.color}` : ''
    const activeClass = isActive ? ' note-card--active' : ''
    const archivedClass = note.archived ? ' note-card--archived' : ''
    const excerpt = getExcerpt(note.body)

    return (
        <div
            className={`note-card${activeClass}${archivedClass}${colorClass}`}
            onClick={onSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
            aria-current={isActive ? 'true' : undefined}
        >
            <div className="note-card__header">
                <span className={`note-type-dot note-type-dot--${note.type}`} />
                <span className="note-card__title">{note.title || 'Untitled'}</span>
                {note.pinned && <span className="note-card__pin">&#x1F4CC;</span>}
            </div>
            <div className="note-card__meta">
                <span className="note-card__type-badge">{TYPE_SHORT[note.type]}</span>
                {note.status && (
                    <span className={`note-status-badge note-status-badge--${statusSlug(note.status)}`}>
                        {note.status}
                    </span>
                )}
            </div>
            {excerpt && <div className="note-card__excerpt">{excerpt}</div>}
            {note.tags.length > 0 && (
                <div className="note-card__tags">
                    {note.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="note-card__tag">{tag}</span>
                    ))}
                    {note.tags.length > 4 && (
                        <span className="note-card__tag">+{note.tags.length - 4}</span>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── View Toggle ─────────────────────────────────────────────────────────────

function ViewToggle({ mode, onChange }: { mode: NotesViewMode; onChange: (m: NotesViewMode) => void }) {
    return (
        <div className="notes-list__view-toggle">
            <button
                className={`notes-list__view-btn${mode === 'list' ? ' active' : ''}`}
                onClick={() => onChange('list')}
                title="List view"
                aria-label="List view"
            >
                &#x2630;
            </button>
            <button
                className={`notes-list__view-btn${mode === 'grid' ? ' active' : ''}`}
                onClick={() => onChange('grid')}
                title="Grid view"
                aria-label="Grid view"
            >
                &#x25A6;
            </button>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function NotesList({
    notes,
    activeNoteId,
    onSelectNote,
    onCreateNote,
}: NotesListProps): React.JSX.Element {
    const viewMode = useNotesStore((s) => s.viewMode)
    const setViewMode = useNotesStore((s) => s.setViewMode)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState<NoteType | 'all'>('all')
    const [showArchived, setShowArchived] = useState(false)
    const [collapsedGroups, setCollapsedGroups] = useState<Set<NoteType>>(new Set())

    const filtered = useMemo(() => {
        return notes
            .filter((n) => showArchived || !n.archived)
            .filter((n) => typeFilter === 'all' || n.type === typeFilter)
            .filter((n) => !searchQuery || n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }, [notes, showArchived, typeFilter, searchQuery])

    const pinnedNotes = useMemo(() => filtered.filter((n) => n.pinned), [filtered])
    const unpinnedNotes = useMemo(() => filtered.filter((n) => !n.pinned), [filtered])

    const grouped = useMemo(() => {
        return TYPE_ORDER
            .map((type) => ({ type, items: unpinnedNotes.filter((n) => n.type === type) }))
            .filter((g) => g.items.length > 0)
    }, [unpinnedNotes])

    const archivedCount = useMemo(() => notes.filter((n) => n.archived).length, [notes])

    function toggleGroup(type: NoteType) {
        setCollapsedGroups((prev) => {
            const next = new Set(prev)
            if (next.has(type)) next.delete(type)
            else next.add(type)
            return next
        })
    }

    return (
        <div className="notes-list">
            {/* Search + filter + view toggle */}
            <div className="notes-list__toolbar">
                <input
                    className="form-input"
                    placeholder="Search notes…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search notes"
                />
                <div className="notes-list__filters">
                    <select
                        className="form-select notes-list__filter-select"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as NoteType | 'all')}
                        aria-label="Filter by type"
                    >
                        <option value="all">All Types</option>
                        {TYPE_ORDER.map((t) => (
                            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                        ))}
                    </select>
                    <ViewToggle mode={viewMode} onChange={setViewMode} />
                    {archivedCount > 0 && (
                        <label className="notes-list__archive-toggle">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                            />
                            Archived ({archivedCount})
                        </label>
                    )}
                </div>
            </div>

            {/* Note list / grid */}
            <div className="notes-list__scroll">
                {filtered.length === 0 && (
                    <p className="notes-list__empty">
                        {notes.length === 0 ? 'No notes yet.' : 'No matching notes.'}
                    </p>
                )}

                {viewMode === 'list' ? (
                    /* ── List View ───────────────────────────────────────────── */
                    <>
                        {/* Pinned section */}
                        {pinnedNotes.length > 0 && (
                            <div>
                                <div className="notes-list__pinned-header">
                                    <span>&#x1F4CC;</span> Pinned
                                </div>
                                {pinnedNotes.map((note) => (
                                    <NoteItem
                                        key={note.id}
                                        note={note}
                                        isActive={note.id === activeNoteId}
                                        onSelect={() => onSelectNote(note.id)}
                                    />
                                ))}
                                {unpinnedNotes.length > 0 && <hr className="notes-list__pinned-divider" />}
                            </div>
                        )}

                        {/* Grouped unpinned notes */}
                        {grouped.map(({ type, items }) => {
                            const isCollapsed = collapsedGroups.has(type)
                            return (
                                <div key={type}>
                                    <button
                                        className="note-group-header"
                                        onClick={() => toggleGroup(type)}
                                        aria-expanded={!isCollapsed}
                                    >
                                        <span className={`note-group-chevron${isCollapsed ? ' note-group-chevron--collapsed' : ''}`}>
                                            ▼
                                        </span>
                                        <span className={`note-type-dot note-type-dot--${type}`} />
                                        {TYPE_LABELS[type]} ({items.length})
                                    </button>

                                    {!isCollapsed && items.map((note) => (
                                        <NoteItem
                                            key={note.id}
                                            note={note}
                                            isActive={note.id === activeNoteId}
                                            onSelect={() => onSelectNote(note.id)}
                                        />
                                    ))}
                                </div>
                            )
                        })}
                    </>
                ) : (
                    /* ── Card Grid View ─────────────────────────────────────── */
                    <div className="note-card-grid note-card-grid--sidebar">
                        {pinnedNotes.length > 0 && (
                            <>
                                <div className="note-card-grid__section-label">
                                    <span>&#x1F4CC;</span> Pinned
                                </div>
                                {pinnedNotes.map((note) => (
                                    <NoteCard
                                        key={note.id}
                                        note={note}
                                        isActive={note.id === activeNoteId}
                                        onSelect={() => onSelectNote(note.id)}
                                    />
                                ))}
                                {unpinnedNotes.length > 0 && <hr className="note-card-grid__divider" />}
                            </>
                        )}
                        {unpinnedNotes.map((note) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                isActive={note.id === activeNoteId}
                                onSelect={() => onSelectNote(note.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="notes-list__actions">
                <button
                    className="btn btn-ghost notes-list__new-btn"
                    onClick={onCreateNote}
                >
                    + New Note
                </button>
            </div>
        </div>
    )
}
