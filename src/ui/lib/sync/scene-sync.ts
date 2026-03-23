/**
 * Scene, campaign, and content loading socket emitters.
 */
import { EVENTS } from '@shared/socket-events'
import { getSocket } from './connection'

/** Load a scene by ID — emits SCENE_LOAD to the server, which relays to AV Display. */
export function loadScene(sceneId: string): void {
    getSocket()?.emit(EVENTS.SCENE_LOAD, { sceneId })
}

/** Notify the server which campaign the cockpit has selected. */
export function selectCampaign(id: string, name: string): void {
    getSocket()?.emit(EVENTS.CAMPAIGN_SELECT, { campaignId: id, campaignName: name })
}

/** Fire a scene trigger by label — emits SCENE_TRIGGER to server. */
export function fireTrigger(label: string): void {
    getSocket()?.emit(EVENTS.SCENE_TRIGGER, { label })
}

/** Emit a scene branch event to advance to the target scene. */
export function emitSceneBranch(targetSceneId: string): void {
    getSocket()?.emit(EVENTS.SCENE_BRANCH, { targetSceneId })
}

/** Emit a scratchpad update event to other cockpit clients. */
export function emitScratchpad(sceneId: string, scratchpad: string): void {
    getSocket()?.emit(EVENTS.SCENE_SCRATCHPAD, { sceneId, scratchpad })
}

/**
 * Load an asset onto the AV Display at runtime.
 * @param assetType The type of content to load
 * @param filePath Absolute or relative path / URL to the asset
 * @param targetEngine For 'video' assets: which engine layer receives the load ('background' | 'gameboard')
 */
export function loadContent(
    assetType: 'video' | 'audio-stem' | 'fx-overlay',
    filePath: string,
    targetEngine?: 'background' | 'gameboard',
): void {
    getSocket()?.emit(EVENTS.CONTENT_LOAD, { assetType, filePath, targetEngine })
}
