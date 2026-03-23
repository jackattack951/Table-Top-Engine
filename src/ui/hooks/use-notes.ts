/**
 * Shared note fetch/mutate helpers — Sprint 8d.
 * Used by NotesTab. Mirrors use-scenes.ts pattern.
 */
import { useState, useEffect, useCallback } from 'react'
import { getServerUrl } from '../lib/sync'
import { useNotesStore } from '../stores/notes-store'
import type { Note, NoteType } from '@core/types'

export function useNotes(campaignId: string | null) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchNotes = useCallback(async () => {
        if (!campaignId) {
            useNotesStore.getState().setNotes([])
            return
        }
        setLoading(true)
        useNotesStore.getState().setLoading(true)
        setError(null)
        try {
            const [notesRes, linksRes] = await Promise.all([
                fetch(`${getServerUrl()}/api/campaigns/${campaignId}/notes`),
                fetch(`${getServerUrl()}/api/campaigns/${campaignId}/scene-note-links`),
            ])
            if (!notesRes.ok) throw new Error(`HTTP ${notesRes.status}`)
            const notes = await notesRes.json() as Note[]
            useNotesStore.getState().setNotes(notes)
            if (linksRes.ok) {
                const links = await linksRes.json() as Record<string, string[]>
                for (const [sceneId, noteIds] of Object.entries(links)) {
                    useNotesStore.getState().setSceneNoteLinks(sceneId, noteIds)
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load notes')
        } finally {
            setLoading(false)
            useNotesStore.getState().setLoading(false)
        }
    }, [campaignId])

    useEffect(() => { void fetchNotes() }, [fetchNotes])
    return { loading, error, refetch: fetchNotes }
}

export async function postNote(
    campaignId: string,
    data: { title: string; type?: NoteType; body?: string; tags?: string[]; pinned?: boolean; archived?: boolean; status?: string | null; color?: Note['color'] | null },
): Promise<Note> {
    const r = await fetch(`${getServerUrl()}/api/campaigns/${campaignId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Note>
}

export async function patchNote(
    id: string,
    data: Partial<Pick<Note, 'title' | 'type' | 'body' | 'tags' | 'pinned' | 'archived' | 'status' | 'color'>>,
): Promise<Note> {
    const r = await fetch(`${getServerUrl()}/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Note>
}

export async function deleteNote(id: string): Promise<void> {
    const r = await fetch(`${getServerUrl()}/api/notes/${id}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export async function fetchSceneNotes(sceneId: string): Promise<Note[]> {
    const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/notes`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Note[]>
}

export async function linkNoteToScene(sceneId: string, noteId: string): Promise<void> {
    const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/notes/${noteId}`, {
        method: 'POST',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export async function unlinkNoteFromScene(sceneId: string, noteId: string): Promise<void> {
    const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/notes/${noteId}`, {
        method: 'DELETE',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
}
