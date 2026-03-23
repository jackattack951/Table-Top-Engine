/**
 * Notes and items system socket emitters.
 */
import { EVENTS } from '@shared/socket-events'
import type { Note, Item } from '@core/types'
import { getSocket } from './connection'

// ── Note system helpers ───────────────────────────────────────────────────────

/** Emit a note creation event to other cockpit clients. */
export function emitNoteCreate(note: Note): void {
    getSocket()?.emit(EVENTS.NOTE_CREATE, { note })
}

/** Emit a note update event to other cockpit clients. */
export function emitNoteUpdate(note: Note): void {
    getSocket()?.emit(EVENTS.NOTE_UPDATE, { note })
}

/** Emit a note deletion event to other cockpit clients. */
export function emitNoteDelete(noteId: string): void {
    getSocket()?.emit(EVENTS.NOTE_DELETE, { noteId })
}

/** Emit a note-scene link event to other cockpit clients. */
export function emitNoteLink(sceneId: string, noteId: string): void {
    getSocket()?.emit(EVENTS.NOTE_LINK, { sceneId, noteId })
}

/** Emit a note-scene unlink event to other cockpit clients. */
export function emitNoteUnlink(sceneId: string, noteId: string): void {
    getSocket()?.emit(EVENTS.NOTE_UNLINK, { sceneId, noteId })
}

// ── Item system helpers (Sprint 15g) ──────────────────────────────────────────

/** Emit an item creation event to other cockpit clients. */
export function emitItemCreate(item: Item): void {
    getSocket()?.emit(EVENTS.ITEM_CREATE, { item })
}

/** Emit an item update event to other cockpit clients. */
export function emitItemUpdate(item: Item): void {
    getSocket()?.emit(EVENTS.ITEM_UPDATE, { item })
}

/** Emit an item deletion event to other cockpit clients. */
export function emitItemDelete(itemId: string): void {
    getSocket()?.emit(EVENTS.ITEM_DELETE, { itemId })
}
