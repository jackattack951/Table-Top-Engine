/**
 * TTRPG Stage Manager — API Specification
 * Living documentation for REST endpoints and Socket.io events.
 * Not imported at runtime — this file is documentation + type reference.
 *
 * Source of truth: src/api/server.ts (REST routes) + shared/socket-events.ts (event names).
 * Keep this file in sync when server.ts changes.
 */

// ── Documentation types ──────────────────────────────────────────────────────

export interface EndpointDoc {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  requestBody?: string   // TypeScript type name or inline shape
  response: string       // TypeScript type name or inline shape
  statusCodes: Record<number, string>
}

export interface SocketEventDoc {
  event: string          // The EVENTS.* constant value
  direction: 'cockpit→server' | 'server→av-display' | 'server→cockpit' | 'bidirectional'
  payload: string        // TypeScript type shape
  description: string
}

// ── REST API ─────────────────────────────────────────────────────────────────

export const REST_API: EndpointDoc[] = [
  // ── Health ─────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/health',
    description: 'Returns server liveness status, current app mode, and total campaign count. Use to confirm the server is up before connecting.',
    response: '{ status: "ok"; mode: AppMode; campaignCount: number }',
    statusCodes: {
      200: 'Server is running',
    },
  },

  // ── Campaigns ──────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/campaigns',
    description: 'Returns all campaigns stored in the local SQLite database, sorted by creation date.',
    response: 'Campaign[]',
    statusCodes: {
      200: 'Array of Campaign objects (may be empty)',
      503: 'Database not available (server started without DB)',
    },
  },
  {
    method: 'POST',
    path: '/api/campaigns',
    description: 'Create a new campaign. Generates a UUID and timestamps automatically.',
    requestBody: '{ name: string; system?: string }',
    response: 'Campaign',
    statusCodes: {
      201: 'Campaign created successfully',
      400: 'name is missing or empty',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'GET',
    path: '/api/campaigns/:id',
    description: 'Retrieve a single campaign by its UUID.',
    response: 'Campaign',
    statusCodes: {
      200: 'Campaign found',
      404: 'Campaign not found',
      503: 'Database not available',
    },
  },
  {
    method: 'PATCH',
    path: '/api/campaigns/:id',
    description: 'Update name and/or system of an existing campaign. Only provided fields are updated.',
    requestBody: '{ name?: string; system?: string }',
    response: 'Campaign',
    statusCodes: {
      200: 'Campaign updated',
      404: 'Campaign not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'DELETE',
    path: '/api/campaigns/:id',
    description: 'Permanently delete a campaign and all its associated scenes and NPCs.',
    response: 'empty',
    statusCodes: {
      204: 'Campaign deleted',
      404: 'Campaign not found',
      503: 'Database not available',
    },
  },

  // ── Scenes ─────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/campaigns/:id/scenes',
    description: 'List all scenes belonging to a campaign, sorted by sortOrder.',
    response: 'Scene[]',
    statusCodes: {
      200: 'Array of Scene objects',
      404: 'Campaign not found',
      503: 'Database not available',
    },
  },
  {
    method: 'POST',
    path: '/api/campaigns/:id/scenes',
    description: 'Create a new scene in the specified campaign. sortOrder is appended to the end of the scene list. AV defaults: particles=none, standard color grade.',
    requestBody: '{ name: string }',
    response: 'Scene',
    statusCodes: {
      201: 'Scene created',
      400: 'name is missing or empty',
      404: 'Campaign not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'GET',
    path: '/api/scenes/:id',
    description: 'Retrieve a single scene by its UUID. Used by the AV Display to fetch full scene state on SCENE_LOAD events.',
    response: 'Scene',
    statusCodes: {
      200: 'Scene found',
      404: 'Scene not found',
      503: 'Database not available',
    },
  },
  {
    method: 'PATCH',
    path: '/api/scenes/:id',
    description: 'Update any scene properties. All fields are optional. Pass only the fields to change.',
    requestBody: `Partial<{
  name: string
  sortOrder: number
  backgroundPath: string | null
  overlays: string[]
  particles: { type: ParticleType; intensity: number }
  colorGrade: ColorGrade
  gbColorGrade: ColorGrade
  audioMood: number
  notes: string
  linkedNPCIds: string[]
  linkedLocationIds: string[]
  scratchpad: string
  branches: { label: string; targetSceneId: string; transitionNote: string }[]
}>`,
    response: 'Scene',
    statusCodes: {
      200: 'Scene updated',
      404: 'Scene not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'DELETE',
    path: '/api/scenes/:id',
    description: 'Permanently delete a scene by UUID.',
    response: 'empty',
    statusCodes: {
      204: 'Scene deleted',
      404: 'Scene not found',
      503: 'Database not available',
    },
  },

  // ── NPCs ───────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/campaigns/:id/npcs',
    description: 'List all NPCs belonging to a campaign.',
    response: 'NPC[]',
    statusCodes: {
      200: 'Array of NPC objects',
      404: 'Campaign not found',
      503: 'Database not available',
    },
  },
  {
    method: 'POST',
    path: '/api/campaigns/:id/npcs',
    description: 'Create a new NPC in the specified campaign.',
    requestBody: '{ name: string; statBlock?: Record<string, unknown>; personality?: string; notes?: string }',
    response: 'NPC',
    statusCodes: {
      201: 'NPC created',
      400: 'name is missing or empty',
      404: 'Campaign not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'PATCH',
    path: '/api/npcs/:id',
    description: 'Update NPC fields. All fields optional.',
    requestBody: 'Partial<{ name: string; statBlock: Record<string, unknown>; personality: string; notes: string }>',
    response: 'NPC',
    statusCodes: {
      200: 'NPC updated',
      404: 'NPC not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'DELETE',
    path: '/api/npcs/:id',
    description: 'Permanently delete an NPC by UUID.',
    response: 'empty',
    statusCodes: {
      204: 'NPC deleted',
      404: 'NPC not found',
      503: 'Database not available',
    },
  },

  // ── Notes ───────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/campaigns/:id/notes',
    description: 'List all notes belonging to a campaign. Optional ?type= query param filters by NoteType.',
    response: 'Note[]',
    statusCodes: {
      200: 'Array of Note objects',
      400: 'Invalid type filter',
      404: 'Campaign not found',
      503: 'Database not available',
    },
  },
  {
    method: 'POST',
    path: '/api/campaigns/:id/notes',
    description: 'Create a new note in the specified campaign.',
    requestBody: '{ title: string; type?: NoteType; body?: string; tags?: string[] }',
    response: 'Note',
    statusCodes: {
      201: 'Note created',
      400: 'title is missing or empty',
      404: 'Campaign not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'GET',
    path: '/api/notes/:id',
    description: 'Retrieve a single note by its UUID.',
    response: 'Note',
    statusCodes: {
      200: 'Note found',
      404: 'Note not found',
      503: 'Database not available',
    },
  },
  {
    method: 'PATCH',
    path: '/api/notes/:id',
    description: 'Update note fields. All fields optional. sourceFile is NOT exposed — import pipeline only.',
    requestBody: 'Partial<{ title: string; type: NoteType; body: string; tags: string[] }>',
    response: 'Note',
    statusCodes: {
      200: 'Note updated',
      404: 'Note not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'DELETE',
    path: '/api/notes/:id',
    description: 'Permanently delete a note. Cascade removes scene_notes links.',
    response: 'empty',
    statusCodes: {
      204: 'Note deleted',
      404: 'Note not found',
      503: 'Database not available',
    },
  },

  // ── Scene-Note Junction ──────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/scenes/:id/notes',
    description: 'List all notes linked to a scene, ordered by sort_order.',
    response: 'Note[]',
    statusCodes: {
      200: 'Array of linked Note objects',
      404: 'Scene not found',
      503: 'Database not available',
    },
  },
  {
    method: 'POST',
    path: '/api/scenes/:id/notes/:noteId',
    description: 'Link a note to a scene. Idempotent (INSERT OR IGNORE).',
    response: '{ linked: true }',
    statusCodes: {
      201: 'Link created',
      404: 'Scene or Note not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
  {
    method: 'DELETE',
    path: '/api/scenes/:id/notes/:noteId',
    description: 'Remove a note-to-scene link.',
    response: 'empty',
    statusCodes: {
      204: 'Link removed',
      404: 'Scene not found',
      503: 'Database not available',
    },
  },

  // ── Scratchpad ───────────────────────────────────────────────────────────────
  {
    method: 'PATCH',
    path: '/api/scenes/:id/scratchpad',
    description: 'Update the per-scene scratchpad text. Auto-saved from the UI with 500ms debounce.',
    requestBody: '{ scratchpad: string }',
    response: 'Scene',
    statusCodes: {
      200: 'Scratchpad updated',
      400: 'scratchpad must be a string',
      404: 'Scene not found',
      503: 'Database not available',
      500: 'Internal server error',
    },
  },
]

// ── Socket.io API ─────────────────────────────────────────────────────────────

export const SOCKET_API: SocketEventDoc[] = [
  // ── Client → Server (cockpit commands relayed to av-display) ───────────────
  {
    event: 'mood:update',
    direction: 'cockpit→server',
    payload: '{ value: number }   // 0.0 (calm) – 1.0 (dramatic)',
    description: 'Set the atmosphere mood slider. Server relays to av-display. Server caches moodValue for STATE_SYNC replay.',
  },
  {
    event: 'scene:load',
    direction: 'cockpit→server',
    payload: '{ sceneId: string }',
    description: 'Load a scene by UUID onto the AV display. Server relays to av-display and broadcasts to all other cockpit clients. Server caches activeSceneId.',
  },
  {
    event: 'scene:branch',
    direction: 'cockpit→server',
    payload: '{ targetSceneId: string }',
    description: 'Activate a scene branch transition. Relayed to av-display.',
  },
  {
    event: 'scene:trigger',
    direction: 'cockpit→server',
    payload: '{ label: string }',
    description: 'Fire a named scene trigger (e.g. "lightning", "door-open"). Relayed to av-display and all cockpit clients.',
  },
  {
    event: 'combat:sync',
    direction: 'cockpit→server',
    payload: '{ combatants: Combatant[] }',
    description: 'Full combatant list broadcast from cockpit. Relayed to av-display (combat overlay) and all other cockpit clients (multi-device sync). Server caches combatState.',
  },
  {
    event: 'combat:nextTurn',
    direction: 'cockpit→server',
    payload: '{}',
    description: 'Advance to the next combatant in initiative order. Relayed to av-display.',
  },
  {
    event: 'combat:update',
    direction: 'cockpit→server',
    payload: 'CombatState   // { combatants: Combatant[]; currentRound: number; activeCombatantId: string | null }',
    description: 'Full CombatState broadcast (Sprint 4+). Replaces combat:sync for multi-field updates. Relayed to av-display and cockpit clients.',
  },
  {
    event: 'sfx:trigger',
    direction: 'cockpit→server',
    payload: 'SFXClip   // { id, label, filePath, loop, volume, spatial?: { x, y } }',
    description: 'Trigger a sound effect on the AV display. x/y use normalized map coords (0–1). Relayed directly to av-display.',
  },
  {
    event: 'sfx:stop',
    direction: 'cockpit→server',
    payload: '{ clipId: string }',
    description: 'Stop a looping SFX clip by ID. Relayed to av-display.',
  },
  {
    event: 'av:particles',
    direction: 'cockpit→server',
    payload: '{ type: ParticleType; intensity: number }   // ParticleType: "none" | "rain" | "snow" | "ash" | "embers" | "dust" | "fog"',
    description: 'Set the particle system type and intensity. Server caches avState.particles and relays to av-display.',
  },
  {
    event: 'av:colorgrade',
    direction: 'cockpit→server',
    payload: '{ brightness: number; contrast: number; saturation: number; temperature: number; tint: string }   // All -1.0–1.0, tint is hex',
    description: 'Apply post-processing color grade to the AV display. Includes target: "BG" | "GB" for role-specific grading. Server caches avState.colorGrade / avState.gbColorGrade and relays to av-display.',
  },
  {
    event: 'av:fog:erase',
    direction: 'cockpit→server',
    payload: '{ path: { x: number; y: number }[]; brushSize?: number }',
    description: 'Erase a stroke on the Fog of War layer. Coordinates are normalized (0–1). Relayed to av-display.',
  },
  {
    event: 'av:ping',
    direction: 'cockpit→server',
    payload: '{ x: number; y: number }   // Normalized 0–1',
    description: 'Fire a visual ping indicator at a map location. Relayed to av-display.',
  },
  {
    event: 'av:fx-overlay',
    direction: 'cockpit→server',
    payload: '{ clipId: string; url: string; loopOffset: number; active: boolean }',
    description: 'Play (active: true) or stop (active: false) a VP9+alpha WebM FX overlay on the av-display. loopOffset is seconds to seek back on loop to prevent stutter.',
  },
  {
    event: 'content:load',
    direction: 'cockpit→server',
    payload: "{ assetType: 'video' | 'audio-stem' | 'fx-overlay'; filePath: string; targetEngine?: 'background' | 'gameboard' }",
    description: "Dynamically load an asset onto the AV display at runtime. For 'video': loads into background or gameboard engine. For 'fx-overlay': loads and immediately plays the clip. For 'audio-stem': loads the file into all three mood zones (calm/tense/dramatic) for development/preview. Relayed to av-display.",
  },
  {
    event: 'app:modeChange',
    direction: 'cockpit→server',
    payload: "{ mode: 'headless' | 'play' | 'plan' }",
    description: 'Request application mode change. Server calls onModeChange callback (Electron main process) to create or destroy BrowserWindows. Server caches appMode.',
  },
  {
    event: 'campaign:select',
    direction: 'cockpit→server',
    payload: '{ campaignId: string; campaignName: string }',
    description: 'Notify server which campaign is active. Server caches activeCampaignId and activeCampaignName for STATE_SYNC replay on reconnect.',
  },

  // ── Notes system (cockpit → server → all other cockpits, never av-display) ─
  {
    event: 'note:create',
    direction: 'cockpit→server',
    payload: '{ note: Note }',
    description: 'Broadcast when a note is created. Server relays to all other cockpit clients.',
  },
  {
    event: 'note:update',
    direction: 'cockpit→server',
    payload: '{ note: Note }',
    description: 'Broadcast when a note is updated. Server relays to all other cockpit clients.',
  },
  {
    event: 'note:delete',
    direction: 'cockpit→server',
    payload: '{ noteId: string }',
    description: 'Broadcast when a note is deleted. Server relays to all other cockpit clients.',
  },
  {
    event: 'note:link',
    direction: 'cockpit→server',
    payload: '{ sceneId: string; noteId: string }',
    description: 'Broadcast when a note is linked to a scene. Server relays to all other cockpit clients.',
  },
  {
    event: 'note:unlink',
    direction: 'cockpit→server',
    payload: '{ sceneId: string; noteId: string }',
    description: 'Broadcast when a note is unlinked from a scene. Server relays to all other cockpit clients.',
  },
  {
    event: 'scene:scratchpad',
    direction: 'cockpit→server',
    payload: '{ sceneId: string; scratchpad: string }',
    description: 'Broadcast when a scene scratchpad is updated. Server relays to all other cockpit clients.',
  },

  // ── Server → Client (connection lifecycle + state) ────────────────────────
  {
    event: 'state:sync',
    direction: 'server→cockpit',
    payload: `{
  activeCampaignId: string | null
  activeCampaignName: string | null
  activeSceneId: string | null
  combatState: CombatState | null
  moodValue: number
  avState: { particles: { type: ParticleType; intensity: number }; colorGrade: ColorGrade; gbColorGrade: ColorGrade } | null
  appMode: AppMode
}`,
    description: 'Full server state dump emitted to a client immediately after it joins a room. Allows tablets, phones, and replacement windows to restore full state without page reload.',
  },
  {
    event: 'client:join',
    direction: 'cockpit→server',
    payload: "{ room: 'av-display' | 'cockpit' }",
    description: 'Client declares which Socket.io room it belongs to. Emitted immediately after connection. The server calls socket.join(room) and responds with STATE_SYNC.',
  },
]
