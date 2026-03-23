/**
 * Notes Tab — Sprint 8d / 8e / 15g.
 * Two-column layout: NotesList (left) + NoteEditor (right).
 * Sub-view toggle: Notes | Items.
 * Orchestrates note CRUD, scene linking, sync, and import.
 */
import React, { useState, useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import { useNotesStore } from '../stores/notes-store'
import { useNotes, postNote, patchNote, deleteNote, linkNoteToScene, unlinkNoteFromScene } from '../hooks/use-notes'
import { useScenes } from '../hooks/use-scenes'
import { NotesList } from '../components/notes-list'
import { NoteEditor } from '../components/note-editor'
import { ImportPanel } from '../components/import-panel'
import { ItemsPanel } from '../components/items-panel'
import { DocumentImportModal } from '../components/document-import-modal'
import { postItem } from '../hooks/use-items'
import { useItemsStore } from '../stores/items-store'
import { emitNoteCreate, emitNoteUpdate, emitNoteDelete, emitNoteLink, emitNoteUnlink, emitItemCreate } from '../lib/sync'
import type { ExtractConfirmData } from '../components/extract-entity-modal'
import type { Note, NoteType } from '@core/types'

type SubView = 'notes' | 'items'

export function NotesTab(): React.JSX.Element {
    const [subView, setSubView] = useState<SubView>('notes')
    const [showDocImport, setShowDocImport] = useState(false)
    const { activeCampaignId } = useAppStore()
    const { notes, activeNoteId, sceneNoteLinks, setActiveNoteId } = useNotesStore()
    const { loading, error, refetch } = useNotes(activeCampaignId)
    const { scenes } = useScenes(activeCampaignId)

    const activeNote = notes.find((n) => n.id === activeNoteId) ?? null

    const handleCreateNote = useCallback(async () => {
        if (!activeCampaignId) return
        try {
            const note = await postNote(activeCampaignId, { title: 'Untitled Note', type: 'general' as NoteType })
            useNotesStore.getState().addNote(note)
            useNotesStore.getState().setActiveNoteId(note.id)
            emitNoteCreate(note)
        } catch (err) {
            console.error('[NotesTab] create error:', err)
        }
    }, [activeCampaignId])

    const handleSaveNote = useCallback(async (id: string, patch: Partial<Pick<Note, 'title' | 'type' | 'body' | 'tags' | 'pinned' | 'archived' | 'status' | 'color'>>) => {
        // Optimistic local update — prevents stale-prop overwrite race
        // (e.g. REST round-trip returning old body while user is still typing)
        useNotesStore.getState().updateNote(id, patch)
        try {
            const updated = await patchNote(id, patch)
            emitNoteUpdate(updated)
        } catch (err) {
            console.error('[NotesTab] save error:', err)
        }
    }, [])

    const handleDeleteNote = useCallback(async (id: string) => {
        try {
            await deleteNote(id)
            useNotesStore.getState().removeNote(id)
            emitNoteDelete(id)
        } catch (err) {
            console.error('[NotesTab] delete error:', err)
        }
    }, [])

    const handleLinkScene = useCallback(async (sceneId: string, noteId: string) => {
        try {
            await linkNoteToScene(sceneId, noteId)
            const links = useNotesStore.getState().sceneNoteLinks[sceneId] ?? []
            if (!links.includes(noteId)) {
                useNotesStore.getState().setSceneNoteLinks(sceneId, [...links, noteId])
            }
            emitNoteLink(sceneId, noteId)
        } catch (err) {
            console.error('[NotesTab] link error:', err)
        }
    }, [])

    const handleUnlinkScene = useCallback(async (sceneId: string, noteId: string) => {
        try {
            await unlinkNoteFromScene(sceneId, noteId)
            const links = useNotesStore.getState().sceneNoteLinks[sceneId] ?? []
            useNotesStore.getState().setSceneNoteLinks(sceneId, links.filter((id) => id !== noteId))
            emitNoteUnlink(sceneId, noteId)
        } catch (err) {
            console.error('[NotesTab] unlink error:', err)
        }
    }, [])

    /** Inline Extract: create entity from selected text, replace selection with wikilink */
    const handleExtractEntity = useCallback(async (
        data: ExtractConfirmData,
        replaceSelection: (wikilink: string) => void,
    ) => {
        if (!activeCampaignId) return
        try {
            if (data.type === 'item') {
                const item = await postItem(activeCampaignId, {
                    name: data.title,
                    description: data.body,
                    rarity: data.rarity ?? null,
                    category: data.category ?? null,
                    properties: data.properties ?? [],
                    tags: data.tags ?? [],
                })
                useItemsStore.getState().addItem(item)
                emitItemCreate(item)
            } else {
                // Build NPC body with metadata header if applicable
                let body = data.body
                if (data.type === 'npc' && (data.race || data.class || data.alignment)) {
                    const metaLines: string[] = []
                    if (data.race) metaLines.push(`Race: ${data.race}`)
                    if (data.class) metaLines.push(`Class: ${data.class}`)
                    if (data.alignment) metaLines.push(`Alignment: ${data.alignment}`)
                    body = metaLines.join('\n') + '\n\n' + body
                }
                const note = await postNote(activeCampaignId, {
                    title: data.title,
                    type: data.type as NoteType,
                    body,
                    tags: data.tags,
                })
                useNotesStore.getState().addNote(note)
                emitNoteCreate(note)
            }
            // Replace selected text with wikilink to the new entity
            replaceSelection(`[[${data.title}]]`)
        } catch (err) {
            console.error('[NotesTab] extract error:', err)
        }
    }, [activeCampaignId])

    // No campaign selected
    if (!activeCampaignId) {
        return (
            <div className="tab-panel">
                <div className="tab-placeholder tab-placeholder--compact">
                    <span className="tab-placeholder__icon">&#128221;</span>
                    <div className="tab-placeholder__title">No Campaign</div>
                    <p className="tab-placeholder__desc">
                        Open or create a campaign to manage notes.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="tab-panel notes-tab">
            {/* Sub-view toggle — Notes | Items + Document Import */}
            <div className="notes-tab__subview-toggle">
                <button
                    className={`notes-tab__subview-btn ${subView === 'notes' ? 'active' : ''}`}
                    onClick={() => setSubView('notes')}
                >
                    Notes
                </button>
                <button
                    className={`notes-tab__subview-btn ${subView === 'items' ? 'active' : ''}`}
                    onClick={() => setSubView('items')}
                >
                    Items
                </button>
                <button
                    className="btn btn-ghost notes-tab__doc-import-btn"
                    onClick={() => setShowDocImport(true)}
                >
                    Import Document
                </button>
            </div>

            {showDocImport && (
                <DocumentImportModal
                    campaignId={activeCampaignId}
                    onClose={() => setShowDocImport(false)}
                    onImportComplete={() => {
                        setShowDocImport(false)
                        void refetch()
                    }}
                />
            )}

            {subView === 'items' ? (
                <ItemsPanel />
            ) : (
                <>
                    {/* Left panel — note list */}
                    <div className="notes-tab__sidebar">
                        {loading && (
                            <p className="text-muted notes-tab__status loading-spinner">Loading notes…</p>
                        )}
                        {error && (
                            <p className="text-error notes-tab__status">{error}</p>
                        )}
                        {!loading && !error && (
                            <NotesList
                                notes={notes}
                                activeNoteId={activeNoteId}
                                onSelectNote={setActiveNoteId}
                                onCreateNote={() => void handleCreateNote()}
                            />
                        )}
                        {/* Import panel — bottom of sidebar */}
                        <ImportPanel
                            campaignId={activeCampaignId}
                            onImportComplete={() => void refetch()}
                        />
                    </div>

                    {/* Right panel — editor or empty state */}
                    <div className="notes-tab__main">
                        {activeNote ? (
                            <NoteEditor
                                note={activeNote}
                                allNotes={notes}
                                allScenes={scenes}
                                sceneNoteLinks={sceneNoteLinks}
                                onSave={(id, patch) => void handleSaveNote(id, patch)}
                                onDelete={(id) => void handleDeleteNote(id)}
                                onLinkScene={(sceneId, noteId) => void handleLinkScene(sceneId, noteId)}
                                onUnlinkScene={(sceneId, noteId) => void handleUnlinkScene(sceneId, noteId)}
                                onNavigateNote={(noteId) => setActiveNoteId(noteId)}
                                onExtractEntity={(data, replace) => void handleExtractEntity(data, replace)}
                            />
                        ) : (
                            <div className="notes-tab__empty-state">
                                <p className="notes-tab__empty-title">Select a note</p>
                                <p>Choose a note from the list or create a new one.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
