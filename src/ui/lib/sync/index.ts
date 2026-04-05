/**
 * Barrel re-export for the sync module.
 * All existing imports of '../lib/sync' continue to work unchanged.
 */

// Connection infrastructure
export { initSync, getSocket, getServerUrl, onPreviewFrame, safeEmit, debounce } from './connection'
export type { PreviewFrameData, SocketLike } from './connection'

// Scene & content
export { loadScene, selectCampaign, fireTrigger, emitSceneBranch, emitScratchpad, loadContent } from './scene-sync'

// AV, fog, SFX, preview, output
export {
    triggerSFX, stopSFX,
    playFXOverlay, stopFXOverlay,
    startPreview, stopPreview,
    emitFogBrush, emitFogToggle, emitFogReset, emitFogUpdate,
    emitEnvironmentChange, emitBreathingHold,
    emitOutputEnable, emitOutputDisable, fetchDisplays,
} from './av-sync'

// Notes & items
export {
    emitNoteCreate, emitNoteUpdate, emitNoteDelete,
    emitNoteLink, emitNoteUnlink,
    emitItemCreate, emitItemUpdate, emitItemDelete,
} from './notes-sync'

// Player & lobby
export {
    emitLobbyApprove, emitLobbyKick, emitReadyCheck, emitGoLive, emitEndSession,
    emitAdjustHP, emitAddCondition, emitRemoveCondition,
    emitSendItem, emitRemoveItem, emitUpdateCurrency,
    emitWhisper, emitBroadcast, emitQROverlay,
    emitReplyToPlayer,
} from './player-sync'
