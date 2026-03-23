/**
 * Player lobby and DM action socket emitters.
 */
import { EVENTS } from '@shared/socket-events'
import { getSocket, safeEmit } from './connection'

// ── Player Lobby helpers (Sprint 11d) ─────────────────────────────────────────

/** DM approves a pending player by token. Server mutates state and broadcasts. */
export function emitLobbyApprove(token: string): void {
    getSocket()?.emit(EVENTS.LOBBY_APPROVE, { token })
}

/** DM kicks a player by token. Server removes them and broadcasts. */
export function emitLobbyKick(token: string): void {
    getSocket()?.emit(EVENTS.LOBBY_KICK, { token })
}

/** DM initiates a ready check. All approved players receive the prompt. */
export function emitReadyCheck(): void {
    getSocket()?.emit(EVENTS.LOBBY_READY_CHECK)
}

/** DM starts the session. All ready players transition to dashboard. */
export function emitGoLive(): void {
    getSocket()?.emit(EVENTS.SESSION_GO_LIVE)
}

/** DM ends the session. All players see the ended screen. */
export function emitEndSession(): void {
    getSocket()?.emit(EVENTS.SESSION_END)
}

// ── DM Player Action helpers (Sprint 14) ──────────────────────────────────────

/** Adjust a player's HP by amount (positive = heal, negative = damage). */
export function emitAdjustHP(token: string, amount: number): void {
    getSocket()?.emit(EVENTS.DM_ADJUST_HP, { token, amount })
}

/** Add a condition to a player. */
export function emitAddCondition(token: string, condition: string): void {
    getSocket()?.emit(EVENTS.DM_ADD_CONDITION, { token, condition })
}

/** Remove a condition from a player. */
export function emitRemoveCondition(token: string, condition: string): void {
    getSocket()?.emit(EVENTS.DM_REMOVE_CONDITION, { token, condition })
}

/** Send an item to a player's inventory. */
export function emitSendItem(token: string, item: { name: string; quantity: number; description: string }): void {
    getSocket()?.emit(EVENTS.DM_SEND_ITEM, { token, item })
}

/** Remove an item from a player's inventory by ID. */
export function emitRemoveItem(token: string, itemId: string): void {
    getSocket()?.emit(EVENTS.DM_REMOVE_ITEM, { token, itemId })
}

/** Update a player's currency. */
export function emitUpdateCurrency(token: string, currency: { gold: number; silver: number; copper: number }): void {
    getSocket()?.emit(EVENTS.DM_UPDATE_CURRENCY, { token, currency })
}

/** Send a whisper to one or more players (targeted, not broadcast). */
export function emitWhisper(tokens: string[], message: string): void {
    getSocket()?.emit(EVENTS.DM_WHISPER, { tokens, message })
}

/** Broadcast a message or item to all connected players. */
export function emitBroadcast(type: string, content: string): void {
    getSocket()?.emit(EVENTS.DM_BROADCAST, { type, content })
}

/** Show or hide QR overlay on all AV Display outputs. */
export function emitQROverlay(show: boolean, qrDataUrl?: string, sessionCode?: string): void {
    safeEmit(EVENTS.SESSION_QR_OVERLAY, { show, qrDataUrl, sessionCode })
}
