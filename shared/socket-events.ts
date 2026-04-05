/**
 * Socket.io event name constants — shared between server and all clients.
 * Import from this file everywhere. Never hardcode event name strings.
 *
 * Rooms:
 *   'av-display' — AV Display BrowserWindow joins on connect
 *   'cockpit'    — All cockpit clients (iPad, browser, second desktop) join on connect
 */
export const EVENTS = {
    // Client → Server (cockpit commands)
    MOOD_UPDATE: 'mood:update',         // { value: number } 0.0–1.0
    SCENE_LOAD: 'scene:load',           // { sceneId: string }
    SCENE_CUE: 'scene:cue',             // { sceneId: string } — cockpit → server → av-display: preload media onto standby deck
    SCENE_BRANCH: 'scene:branch',       // { targetSceneId: string }
    SCENE_TRIGGER: 'scene:trigger',     // { label: string }
    COMBAT_SYNC: 'combat:sync',         // { combatants: Combatant[] }
    COMBAT_NEXT_TURN: 'combat:nextTurn', // {}
    COMBAT_UPDATE: 'combat:update',     // Full CombatState — replaces COMBAT_SYNC for Sprint 4+
    SFX_TRIGGER: 'sfx:trigger',         // { clipId: string, spatial?: { x: number, y: number } }
    SFX_STOP: 'sfx:stop',              // { clipId: string }
    AV_PARTICLES: 'av:particles',       // { type: ParticleType, intensity: number }
    AV_COLORGRADE: 'av:colorgrade',     // { brightness, contrast, saturation, temperature, tint }
    AV_FOG_ERASE: 'av:fog:erase',      // { paths: { x: number, y: number }[][] }
    AV_PING: 'av:ping',                // { x: number, y: number } normalized 0–1
    /** { clipId: string; url: string; loopOffset: number; active: boolean } */
    AV_FX_OVERLAY: 'av:fx-overlay',   // play (active: true) or stop (active: false) a VP9+alpha FX loop
    /**
     * Load asset content onto the AV Display.
     * Payload: { assetType: 'video' | 'audio-stem' | 'fx-overlay'; filePath: string; targetEngine?: 'background' | 'gameboard' }
     */
    CONTENT_LOAD: 'content:load',
    APP_MODE_CHANGE: 'app:modeChange',  // { mode: AppMode }
    CAMPAIGN_SELECT: 'campaign:select', // { campaignId: string, campaignName: string }

    // Performance instrumentation (Sprint 7)
    PERF_PING: 'perf:ping',            // { t: number } — client sends timestamp
    PERF_PONG: 'perf:pong',            // echoed back by server for RTT measurement

    // Real-time preview (Sprint 7b)
    PREVIEW_START: 'preview:start',    // cockpit → server → av-display  { fps?: number, quality?: number }
    PREVIEW_STOP: 'preview:stop',      // cockpit → server → av-display
    PREVIEW_FRAME: 'preview:frame',    // av-display → server → cockpit  { frame: ArrayBuffer, ts: number, width: number, height: number }

    // Notes system (Sprint 8 — cockpit room only, never relayed to av-display)
    NOTE_CREATE: 'note:create',             // { note: Note }
    NOTE_UPDATE: 'note:update',             // { note: Note }
    NOTE_DELETE: 'note:delete',             // { noteId: string }
    NOTE_LINK: 'note:link',                 // { sceneId: string, noteId: string }
    NOTE_UNLINK: 'note:unlink',             // { sceneId: string, noteId: string }
    SCENE_SCRATCHPAD: 'scene:scratchpad',   // { sceneId: string, scratchpad: string }

    // Sprint 9b: Output management (cockpit room only)
    OUTPUT_STATE: 'output:state',             // { BG: OutputConfig | null, GB: OutputConfig | null }
    OUTPUT_ENABLE: 'output:enable',           // { displayId: number | 'windowed', role: 'BG' | 'GB' }
    OUTPUT_DISABLE: 'output:disable',         // { role: 'BG' | 'GB' }
    OUTPUT_DISPLAYS_CHANGED: 'output:displaysChanged', // { displays: DisplayInfo[] }

    // Sprint 10g: Fog of War (cockpit → av-display relay)
    FOG_UPDATE: 'fog:update',                 // { sceneId: string; fogData: string } — full bitmap sync (base64 PNG)
    FOG_BRUSH: 'fog:brush',                   // { sceneId: string; strokes: Array<{ x: number; y: number; radius: number; reveal: boolean }> } — incremental brush relay
    FOG_TOGGLE: 'fog:toggle',                 // { sceneId: string; enabled: boolean } — enable/disable fog
    FOG_RESET: 'fog:reset',                   // { sceneId: string } — clear all fog

    // Server → Client (state sync)
    STATE_SYNC: 'state:sync',           // Full state dump on client connect
    CLIENT_JOIN: 'client:join',         // { room: 'av-display' | 'cockpit' }

    // Sprint 11b: Player ↔ Server
    PLAYER_JOIN: 'player:join',                   // Player → Server: submit join form
    PLAYER_TOKEN: 'player:token',                 // Server → Player: assign session token
    PLAYER_RECONNECT: 'player:reconnect',         // Player → Server: reconnect with token
    PLAYER_STATE: 'player:state',                 // Server → Player: full state sync
    PLAYER_SESSION_EXPIRED: 'player:sessionExpired', // Server → Player: session not found
    PLAYER_JOIN_REJECTED: 'player:joinRejected',  // Server → Player: join rejected (full, etc.)

    // Sprint 11b: Lobby events
    LOBBY_STATE: 'lobby:state',                   // Server → Cockpit: full lobby/session state
    LOBBY_APPROVE: 'lobby:approve',               // Cockpit → Server: DM approves player
    LOBBY_KICK: 'lobby:kick',                     // Cockpit → Server: DM kicks player
    LOBBY_READY_CHECK: 'lobby:readyCheck',        // Cockpit → Server: DM initiates ready check
    LOBBY_READY_CONFIRM: 'lobby:readyConfirm',    // Player → Server: player confirms ready

    // Sprint 11b: Session lifecycle
    SESSION_GO_LIVE: 'session:goLive',            // Cockpit → Server: DM starts session
    SESSION_STARTED: 'session:started',           // Server → Players: transition to dashboard
    SESSION_END: 'session:end',                   // Cockpit → Server: DM ends session
    SESSION_ENDED: 'session:ended',               // Server → Players: show ended screen

    // Sprint 11b: DM → Player push (server-mediated)
    PLAYER_HP_UPDATE: 'player:hpUpdate',          // { current, max }
    PLAYER_CONDITION_ADD: 'player:conditionAdd',  // { condition }
    PLAYER_CONDITION_REMOVE: 'player:conditionRemove', // { condition }
    PLAYER_ITEM_ADD: 'player:itemAdd',            // PlayerItem
    PLAYER_ITEM_REMOVE: 'player:itemRemove',      // { id }
    PLAYER_CURRENCY_UPDATE: 'player:currencyUpdate', // { gold, silver, copper }
    PLAYER_WHISPER: 'player:whisper',             // { id, message, timestamp }
    PLAYER_BROADCAST: 'player:broadcast',         // { type, content }

    // Phase 6: QR overlay on AV Display
    SESSION_QR_OVERLAY: 'session:qrOverlay',      // { show: boolean, qrDataUrl?: string, sessionCode?: string }

    // Sprint 11b: DM cockpit → Server actions
    DM_ADJUST_HP: 'dm:adjustHp',                  // { token, amount }
    DM_ADD_CONDITION: 'dm:addCondition',           // { token, condition }
    DM_REMOVE_CONDITION: 'dm:removeCondition',     // { token, condition }
    DM_SEND_ITEM: 'dm:sendItem',                  // { token, item }
    DM_REMOVE_ITEM: 'dm:removeItem',              // { token, itemId }
    DM_UPDATE_CURRENCY: 'dm:updateCurrency',      // { token, currency }
    DM_WHISPER: 'dm:whisper',                     // { tokens[], message }
    DM_BROADCAST: 'dm:broadcast',                 // { type, content }

    // Sprint 17c: Atmosphere audio
    ENVIRONMENT_CHANGE: 'environment:change',   // { environmentId: string } — cockpit → server → av-display
    MASTER_VOLUME: 'audio:masterVolume',         // { volume: number } 0.0–1.0 — cockpit → server → av-display
    AMBIENCE_VOLUME: 'audio:ambienceVolume',    // { volume: number } 0.0–1.0 — cockpit → server → av-display
    MUSIC_VOLUME: 'audio:musicVolume',          // { volume: number } 0.0–1.0 — cockpit → server → av-display
    SFX_VOLUME: 'audio:sfxVolume',              // { volume: number } 0.0–1.0 — cockpit → server → av-display
    BG_VIDEO_VOLUME: 'audio:bgVideoVolume',     // { volume: number } 0.0–1.0 — cockpit → server → av-display
    GB_VIDEO_VOLUME: 'audio:gbVideoVolume',     // { volume: number } 0.0–1.0 — cockpit → server → av-display
    BREATHING_HOLD: 'audio:breathingHold',      // { seconds: number } — cockpit → server → av-display

    // Sprint 21a: Player ↔ DM messaging + raise hand
    PLAYER_SEND_MESSAGE: 'player:sendMessage',   // Player → Server: { message: string }
    DM_PLAYER_MESSAGE: 'dm:playerMessage',        // Server → Cockpit: { token, playerName, characterName, id, message, timestamp }
    PLAYER_RAISE_HAND: 'player:raiseHand',        // Player → Server: { raised: boolean }
    DM_HAND_UPDATE: 'dm:handUpdate',              // Server → Cockpit: { token, raised: boolean }
    DM_REPLY_TO_PLAYER: 'dm:replyToPlayer',       // Cockpit → Server: { token, message: string }
    PLAYER_DM_REPLY: 'player:dmReply',            // Server → Player: PlayerMessage

    // Sprint 15g: Items system (cockpit room only)
    ITEM_CREATE: 'item:create',             // { item: Item }
    ITEM_UPDATE: 'item:update',             // { item: Item }
    ITEM_DELETE: 'item:delete',             // { itemId: string }
    ITEM_STATUS_CHANGE: 'item:statusChange', // { sceneId, itemId, status } — cockpit + player

    // Server ↔ Client (connection lifecycle)
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error',
} as const

export type EventName = typeof EVENTS[keyof typeof EVENTS]
