/**
 * Scene, combat, and campaign socket event handlers.
 * Extracted from server.ts to keep handler modules focused.
 * Called inside io.on('connection') for each new socket.
 */
import type { Server, Socket } from 'socket.io'
import { EVENTS } from '../../shared/socket-events'
import type { CombatState } from '../core/types'
import type { ServerState } from './server-types'

export function registerSceneHandlers(
    io: Server,
    socket: Socket,
    serverState: ServerState,
    relay: (event: string, room: 'av-display' | 'cockpit' | 'player') => void,
): void {
    // ── Pure relays (cockpit → av-display) ────────────────────────────────────
    relay(EVENTS.SCENE_CUE, 'av-display')
    relay(EVENTS.ENVIRONMENT_CHANGE, 'av-display')
    relay(EVENTS.CONTENT_LOAD, 'av-display')
    relay(EVENTS.SESSION_QR_OVERLAY, 'av-display')
    relay(EVENTS.COMBAT_NEXT_TURN, 'av-display')

    // ── State-caching handlers ────────────────────────────────────────────────

    socket.on(EVENTS.SCENE_LOAD, (payload) => {
        const { sceneId } = payload as { sceneId: string }
        serverState.activeSceneId = sceneId
        io.to('av-display').emit(EVENTS.SCENE_LOAD, payload)
        // Also sync all other cockpit clients so LAN devices stay in sync
        socket.to('cockpit').emit(EVENTS.SCENE_LOAD, payload)
    })

    socket.on(EVENTS.COMBAT_SYNC, (payload) => {
        serverState.combatState = payload as CombatState
        io.to('av-display').emit(EVENTS.COMBAT_SYNC, payload)
        socket.to('cockpit').emit(EVENTS.COMBAT_SYNC, payload)
    })

    socket.on(EVENTS.SCENE_BRANCH, (payload) => {
        const { targetSceneId } = payload as { targetSceneId: string }
        serverState.activeSceneId = targetSceneId
        // Relay branch event to other cockpit clients and AV display
        socket.to('cockpit').emit(EVENTS.SCENE_BRANCH, payload)
        io.to('av-display').emit(EVENTS.SCENE_LOAD, { sceneId: targetSceneId })
    })

    socket.on(EVENTS.SCENE_TRIGGER, (payload) => {
        // Relay trigger to AV display and all cockpit clients
        io.to('av-display').emit(EVENTS.SCENE_TRIGGER, payload)
        socket.to('cockpit').emit(EVENTS.SCENE_TRIGGER, payload)
    })

    socket.on(EVENTS.CAMPAIGN_SELECT, (payload) => {
        const { campaignId, campaignName } = payload as { campaignId: string; campaignName: string }
        serverState.activeCampaignId = campaignId
        serverState.activeCampaignName = campaignName
    })
}
