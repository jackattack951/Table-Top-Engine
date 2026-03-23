# Player Companion — Implementation Guide

## Architecture

The companion app runs as a separate browser-based React app served by the existing Express server on port 8080. It shares Socket.io infrastructure and TypeScript types with the cockpit but has its own Vite build, entry point, and CSS.

```
DM's Machine (Electron)
├── Express server (port 8080)
│   ├── /api/*        → REST API routes
│   ├── /companion/*  → serves built companion app (player phones)
│   ├── /*            → serves built cockpit app (DM browser/Electron)
│   └── Socket.io
│       ├── Room: 'av-display'  (AV Display windows)
│       ├── Room: 'cockpit'     (DM cockpit clients)
│       └── Room: 'player'      (player companion clients)
└── Electron main process
    ├── AV Display BrowserWindow
    └── Cockpit BrowserWindow (loads from :8080)
```

Players connect from their phones via LAN — same network, no internet required.

---

## Express Route Registration Order (CRITICAL)

Routes MUST be registered in this order to avoid the SPA catch-all conflict:

```
1. express.json() middleware
2. /api/* REST routes (health, campaigns, scenes, etc.)
3. /companion static files → express.static(companionDist)
4. /companion/* SPA fallback → serves companion index.html
5. Cockpit static files → express.static(cockpitDist)
6. /* Cockpit SPA catch-all → serves cockpit index.html
```

The cockpit `*` catch-all MUST come last. Without this ordering, companion routes like `/companion/dashboard` would serve cockpit HTML instead of companion HTML.

```typescript
// 3. Companion static files
const companionDist = options?.companionDistPath ?? join(__dirname, '../companion')
expressApp.use('/companion', express.static(companionDist))

// 4. Companion SPA fallback (BEFORE cockpit catch-all)
expressApp.get('/companion/*', (_req, res) => {
    res.sendFile(join(companionDist, 'index.html'))
})

// 5. Cockpit static files (existing)
expressApp.use(express.static(cockpitDist))

// 6. Cockpit SPA catch-all (LAST — existing, unchanged)
expressApp.get('*', (_req, res) => {
    res.sendFile(join(cockpitDist, 'index.html'))
})
```

### `createServer()` Signature Update

Add `companionDistPath` to the options interface:

```typescript
export function createServer(
    config: AppConfig,
    onModeChange?: (mode: AppConfig['appMode']) => void,
    dbInterface?: DBInterface,
    options?: {
        cockpitDistPath?: string
        companionDistPath?: string  // NEW
        isDev?: boolean
        onOutputEnable?: (displayId: number | 'windowed', role: string) => void
        onOutputDisable?: (role: string) => void
        onGetDisplays?: () => DisplayInfo[]
    },
): void
```

In `electron/main.ts`, compute companion path alongside cockpit path:
```typescript
const companionDistPath = IS_DEV
    ? join(__dirname, '../../out/companion')
    : join(__dirname, '../companion')
```

---

## New File Structure

```
/src
  /companion                    — companion app (separate Vite build)
    main.tsx                    — React entry point
    App.tsx                     — Root component, state-machine routing
    index.css                   — Mobile-first styles (imports shared tokens)
    index.html                  — HTML entry with mobile viewport meta tags
    /screens
      join-screen.tsx           — Join form (name, stats)
      lobby-screen.tsx          — Waiting room post-submission
      dashboard-screen.tsx      — Live player dashboard
    /components
      hp-bar.tsx                — Visual HP bar
      ability-grid.tsx          — 6 ability scores with modifiers
      condition-badges.tsx      — Active conditions display
      inventory-list.tsx        — Item list
      currency-display.tsx      — Gold/silver/copper
      dice-roller.tsx           — Client-side dice roller
      whisper-inbox.tsx         — Sealed whisper messages
    /stores
      companion-store.ts        — Zustand store for local player state
    /lib
      companion-sync.ts         — Socket.io connection for companion
      companion-ws-stub.ts      — Browser dev stub (simulates server events)

/src/api
  player-handlers.ts            — Extracted player/session socket handlers (NEW)

/src/ui
  /tabs/players                 — DM Players panel (cockpit side)
    players-panel.tsx           — Main panel component
    player-card.tsx             — Per-player card with actions
    player-actions.tsx          — HP/condition/item/whisper controls
    broadcast-panel.tsx         — Broadcast to all players
  /components
    lobby-panel.tsx             — DM lobby overlay (pre-Go Live)

/src/ui/stores
  player-store.ts               — Cockpit-side player state (all players)
  player-store.test.ts

/shared
  socket-events.ts              — Extended with player/lobby/session events
  player-types.ts               — PlayerCharacter interface (shared)
  design-tokens.css             — Extracted CSS custom properties (shared)

/vite.companion.config.ts       — Companion Vite build config
/tsconfig.companion.json        — TypeScript config for companion
```

### Import Boundary Rule

- Companion code (`src/companion/`) NEVER imports from cockpit (`src/ui/`)
- Cockpit code (`src/ui/`) NEVER imports from companion (`src/companion/`)
- Both import shared types from `shared/` and core types from `src/core/`

---

## Shared Types — `shared/player-types.ts`

```typescript
export const MAX_PLAYERS = 8

export interface PlayerCharacter {
  // Identity
  token: string
  socketId: string
  playerName: string
  characterName: string

  // Stats
  class: string
  level: number
  hpCurrent: number
  hpMax: number
  ac: number

  // Ability scores
  abilities: {
    STR: number
    DEX: number
    CON: number
    INT: number
    WIS: number
    CHA: number
  }

  // Session state (DM-managed, pushed to player)
  conditions: string[]
  inventory: PlayerItem[]
  currency: { gold: number; silver: number; copper: number }
  whispers: PlayerWhisper[]

  // Connection & lobby state
  status: 'pending' | 'approved' | 'kicked' | 'ready' | 'live'
  connected: boolean  // false when phone sleeps / disconnects
}

export interface PlayerItem {
  id: string
  name: string
  quantity: number
  description: string
}

export interface PlayerWhisper {
  id: string
  message: string
  timestamp: number
  read: boolean
}

export type AbilityScore = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

/** Calculate ability modifier from score: floor((score - 10) / 2) */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}
```

**Note:** Types live in `shared/player-types.ts`, NOT in `src/core/types.ts`. Session-specific types belong alongside `socket-events.ts`. Core types holds persistent data models (Campaign, Scene, Note).

---

## Shared CSS Design Tokens — `shared/design-tokens.css`

Extract the `:root` custom properties from `src/ui/index.css` into `shared/design-tokens.css`. Both cockpit and companion import this file. Component-level CSS remains independent.

```css
/* shared/design-tokens.css — imported by both cockpit and companion */
:root {
  --color-bg: #0a0a0a;
  --color-surface: #141414;
  /* ... all existing tokens ... */
}
```

Cockpit `src/ui/index.css`:
```css
@import '../../shared/design-tokens.css';
/* cockpit-specific component styles below */
```

Companion `src/companion/index.css`:
```css
@import '../../shared/design-tokens.css';
/* companion-specific mobile-first styles below */
```

---

## Socket Events

All new events added to `shared/socket-events.ts`. Never hardcode strings.

### Player ↔ Server

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `player:join` | Player → Server | `{ sessionCode, playerName, characterName, class, level, hp, maxHp, ac, abilities }` | Submit join form |
| `player:token` | Server → Player | `{ token }` | Assign session token |
| `player:reconnect` | Player → Server | `{ token }` | Reconnect with existing token |
| `player:state` | Server → Player | `PlayerCharacter` | Full state sync (on connect/reconnect) |
| `player:sessionExpired` | Server → Player | `{}` | Session no longer exists (app restarted) |

### Lobby Events

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `lobby:state` | Server → Cockpit | `{ players: PlayerCharacter[], phase: string, sessionCode: string }` | Full lobby/session state |
| `lobby:approve` | Cockpit → Server | `{ token }` | DM approves player |
| `lobby:kick` | Cockpit → Server | `{ token }` | DM kicks player |
| `lobby:readyCheck` | Cockpit → Server | `{}` | DM initiates ready check |
| `lobby:readyConfirm` | Player → Server | `{ token }` | Player confirms ready |
| `session:goLive` | Cockpit → Server | `{}` | DM starts session |
| `session:started` | Server → Players | `{}` | All players transition to dashboard |
| `session:end` | Cockpit → Server | `{}` | DM ends the session |
| `session:ended` | Server → Players | `{}` | All players see "Session Ended" screen |

### DM → Player Push Events

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `player:hpUpdate` | Server → Player | `{ current, max }` | Update HP |
| `player:conditionAdd` | Server → Player | `{ condition }` | Add condition |
| `player:conditionRemove` | Server → Player | `{ condition }` | Remove condition |
| `player:itemAdd` | Server → Player | `PlayerItem` | Add item to inventory |
| `player:itemRemove` | Server → Player | `{ id }` | Remove item |
| `player:currencyUpdate` | Server → Player | `{ gold, silver, copper }` | Update currency |
| `player:whisper` | Server → Player | `{ id, message, timestamp }` | Private message |
| `player:broadcast` | Server → All Players | `{ type, content }` | Broadcast message/item |

### DM Cockpit → Server (action triggers)

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `dm:adjustHp` | Cockpit → Server | `{ token, amount }` | Adjust player HP |
| `dm:addCondition` | Cockpit → Server | `{ token, condition }` | Add condition to player |
| `dm:removeCondition` | Cockpit → Server | `{ token, condition }` | Remove condition |
| `dm:sendItem` | Cockpit → Server | `{ token, item }` | Send item to player |
| `dm:removeItem` | Cockpit → Server | `{ token, itemId }` | Remove item from player |
| `dm:updateCurrency` | Cockpit → Server | `{ token, currency }` | Update currency |
| `dm:whisper` | Cockpit → Server | `{ tokens[], message }` | Whisper to player(s) |
| `dm:broadcast` | Cockpit → Server | `{ type, content }` | Broadcast to all |

### Server-Side Event Routing

Every `dm:*` event follows this server-side flow:

1. **Validate** — check token exists in session state
2. **Mutate** — update canonical player state on server
3. **Push to player** — emit `player:*` event to targeted socket via token→socketId mapping
4. **Push to cockpit** — emit `lobby:state` to ALL cockpit clients (`io.to('cockpit').emit(...)`)

This ensures: multiple cockpit clients stay in sync, player dashboards update, and the server remains the single source of truth.

---

## CLIENT_JOIN Expansion

The existing `CLIENT_JOIN` event handler must expand:

```typescript
socket.on(EVENTS.CLIENT_JOIN, (payload: {
    room: 'av-display' | 'cockpit' | 'player'
    sessionCode?: string
    token?: string
}) => {
    const { room, sessionCode, token } = payload

    if (room === 'player') {
        // Validate session code
        if (!sessionState || sessionCode !== sessionState.sessionCode) {
            socket.emit(EVENTS.PLAYER_SESSION_EXPIRED)
            return
        }
        // Handle reconnection or new join
        socket.join('player')
        if (token && sessionState.players[token]) {
            // Reconnect: restore state, update socket mapping
            sessionState.players[token].socketId = socket.id
            sessionState.players[token].connected = true
            tokenToSocket.set(token, socket.id)
            socketToToken.set(socket.id, token)
            socket.emit(EVENTS.PLAYER_STATE, sessionState.players[token])
        }
        // New joins handled via separate player:join event
    } else {
        socket.join(room)
        // Existing STATE_SYNC behavior
        const syncPayload = { ...serverState }
        if (sessionState) {
            syncPayload.sessionState = {
                players: Object.values(sessionState.players),
                phase: sessionState.phase,
                sessionCode: sessionState.sessionCode,
            }
        }
        socket.emit(EVENTS.STATE_SYNC, syncPayload)
    }
})
```

---

## Server-Side Session Management

### Session State (separate from ServerState)

```typescript
interface SessionState {
  sessionCode: string
  players: Record<string, PlayerCharacter>  // token → player (Record, NOT Map)
  phase: 'lobby' | 'ready-check' | 'live' | 'ended'
}

// Token ↔ Socket mapping for targeted delivery
const tokenToSocket = new Map<string, string>()  // token → socket.id
const socketToToken = new Map<string, string>()  // socket.id → token

let sessionState: SessionState | null = null
```

**Lifecycle:**
- Created when DM enters Play + Host mode
- Cleared when DM changes mode, ends session, or app closes
- NOT mixed into the existing `serverState` (different lifecycle)

### Session Code Generation

```typescript
const SESSION_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  // 30 chars, no 0/O/I/L/1

function generateSessionCode(): string {
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += SESSION_CODE_CHARS[Math.floor(Math.random() * SESSION_CODE_CHARS.length)]
    }
    return code
}
```

- 6 uppercase alphanumeric characters
- Excludes ambiguous chars: 0, O, I, L, 1
- Generated on Play + Host mode entry
- Cleared on mode change

### Token Assignment
- On `player:join`, server generates UUID token via `crypto.randomUUID()`
- Stored in player's localStorage
- On reconnect, player sends token → server restores state
- If token not found or session expired → `player:sessionExpired` event

### Player Disconnect Handling

```typescript
socket.on('disconnect', () => {
    const token = socketToToken.get(socket.id)
    if (token && sessionState?.players[token]) {
        sessionState.players[token].connected = false
        socketToToken.delete(socket.id)
        tokenToSocket.delete(token)

        // Notify cockpit
        io.to('cockpit').emit(EVENTS.LOBBY_STATE, {
            players: Object.values(sessionState.players),
            phase: sessionState.phase,
            sessionCode: sessionState.sessionCode,
        })

        // Auto-remove after timeout (optional)
        setTimeout(() => {
            if (sessionState?.players[token] && !sessionState.players[token].connected) {
                // Player did not reconnect — leave in state but mark stale
            }
        }, 5 * 60 * 1000)  // 5 minutes
    }
})
```

### Session End

```typescript
// DM clicks "End Session"
socket.on(EVENTS.SESSION_END, () => {
    if (!sessionState) return
    sessionState.phase = 'ended'
    io.to('player').emit(EVENTS.SESSION_ENDED)
    io.to('cockpit').emit(EVENTS.LOBBY_STATE, {
        players: [],
        phase: 'ended',
        sessionCode: '',
    })
    // Cleanup
    tokenToSocket.clear()
    socketToToken.clear()
    sessionState = null
})
```

### Max Player Limit

```typescript
socket.on(EVENTS.PLAYER_JOIN, (data) => {
    if (!sessionState) return
    if (Object.keys(sessionState.players).length >= MAX_PLAYERS) {
        socket.emit('player:joinRejected', { reason: 'Session is full' })
        return
    }
    // ... proceed with join
})
```

### Player State Persistence
- MVP: in-memory only. Session state lost on app restart.
- Future: persist to SQLite for session resume across crashes.

---

## Server Handler Extraction — `src/api/player-handlers.ts`

The main `server.ts` is already 782 lines. All player/session socket handlers go in a separate module:

```typescript
import type { Server, Socket } from 'socket.io'
import type { SessionState } from './session-types'
import { EVENTS } from '../../shared/socket-events'
import { MAX_PLAYERS } from '../../shared/player-types'

export function registerPlayerHandlers(
    io: Server,
    socket: Socket,
    getSessionState: () => SessionState | null,
    setSessionState: (state: SessionState | null) => void,
    tokenToSocket: Map<string, string>,
    socketToToken: Map<string, string>,
): void {
    // All player:*, dm:*, lobby:*, session:* handlers registered here
}
```

Called from `server.ts` inside the `io.on('connection')` handler:
```typescript
io.on('connection', (socket) => {
    registerPlayerHandlers(io, socket, () => sessionState, (s) => { sessionState = s }, tokenToSocket, socketToToken)
    // ... existing cockpit/AV handlers
})
```

---

## Vite Companion Config — `vite.companion.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import pkg from './package.json'

export default defineConfig(({ command }) => ({
  root: resolve(__dirname, 'src/companion'),
  plugins: [react()],
  define: {
    __COMPANION_BROWSER_DEV__: command === 'serve' ? 'true' : 'false',
    __COMPANION_SERVER_URL__: command === 'serve'
        ? JSON.stringify('http://localhost:8080')
        : JSON.stringify(''),  // empty = use window.location.origin
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'out/companion'),
    emptyOutDir: true,
  },
  base: '/companion/',  // CRITICAL: ensures asset URLs prefix with /companion/
  server: {
    port: 5181,
    strictPort: true,
    host: true,  // Expose to LAN for phone testing
  },
}))
```

**Key differences from cockpit config:**
- `base: '/companion/'` — ensures built asset URLs resolve correctly when served at `/companion/*`
- `__COMPANION_BROWSER_DEV__` flag — companion equivalent of `__COCKPIT_BROWSER_DEV__`
- `__COMPANION_SERVER_URL__` — points to Express in dev, empty in production (uses origin)
- `host: true` — exposes dev server to LAN so phones can access Vite directly for UI iteration

---

## TypeScript Config — `tsconfig.companion.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "outDir": "./out/companion-types"
  },
  "include": [
    "src/companion/**/*",
    "shared/**/*"
  ]
}
```

---

## Companion App Routing — State Machine

No routing library. Screen transitions driven by state, not URL paths.

```typescript
// src/companion/App.tsx
type Screen = 'join' | 'lobby' | 'dashboard' | 'ended' | 'expired'

function App() {
    const [screen, setScreen] = useState<Screen>('join')

    useEffect(() => {
        // On load, check for stored token
        const token = localStorage.getItem('companion-token')
        if (token) {
            // Attempt reconnection
            connectCompanion(sessionCode, token)
            // Server responds with player:state (success) or player:sessionExpired (failure)
        }
    }, [])

    switch (screen) {
        case 'join': return <JoinScreen onJoined={() => setScreen('lobby')} />
        case 'lobby': return <LobbyScreen onLive={() => setScreen('dashboard')} />
        case 'dashboard': return <DashboardScreen />
        case 'ended': return <SessionEndedScreen />
        case 'expired': return <SessionExpiredScreen onRejoin={() => setScreen('join')} />
    }
}
```

Express SPA fallback serves `index.html` for all `/companion/*` paths. The app state determines which screen to show, not the URL.

---

## Companion Browser Dev Stub — `src/companion/lib/companion-ws-stub.ts`

Simulates server events for standalone browser development without Electron:

```typescript
class CompanionWsStub {
    // Simulates:
    // - Token assignment on join (after 500ms)
    // - Lobby approval after 2s
    // - HP updates at timed intervals
    // - A sample whisper message after 5s
    // - A sample condition add after 3s
}
```

Toggle via `__COMPANION_BROWSER_DEV__` flag (set `true` in `vite.companion.config.ts` serve mode only).

---

## Companion `index.html` — Mobile Meta Tags

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0a0a" />
    <title>Player Companion</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
</body>
</html>
```

**Critical:** The viewport meta tag prevents iOS zoom on input focus (requires minimum 16px font on inputs). The `theme-color` matches the app's dark background.

---

## Cockpit-Side Player Store — `src/ui/stores/player-store.ts`

Uses `Record<string, PlayerCharacter>`, NOT `Map`. Zustand's `subscribeWithSelector` uses shallow equality — Map instances compare by reference, causing unnecessary re-renders.

```typescript
interface PlayerStoreState {
    players: Record<string, PlayerCharacter>  // token → player
    sessionPhase: 'inactive' | 'lobby' | 'ready-check' | 'live' | 'ended'
    sessionCode: string | null
    setPlayers: (players: PlayerCharacter[]) => void
    setSessionPhase: (phase: PlayerStoreState['sessionPhase']) => void
    setSessionCode: (code: string | null) => void
    reset: () => void
}
```

---

## HP Sync — Server-Authoritative Pattern

**The server is the single source of truth for player HP.** The cockpit never locally mutates player HP and then tries to sync — it always emits to the server and receives the authoritative update back.

### Flow: DM Adjusts HP in Players Panel
1. Cockpit emits `dm:adjustHp` → server
2. Server mutates `sessionState.players[token].hpCurrent`
3. Server emits `player:hpUpdate` → targeted player socket
4. Server emits `lobby:state` → ALL cockpit clients
5. Cockpit `usePlayerStore` updates from `lobby:state` (not from local action)

### Flow: DM Adjusts HP in Combat Tracker
1. Combat tracker adjusts HP locally in `useCombatStore`
2. `sync.ts` subscription emits `COMBAT_SYNC` → server
3. Server checks if combatant `isPlayer` && matches a session player by name
4. If match: server updates `sessionState.players[token].hpCurrent`
5. Server emits `player:hpUpdate` → targeted player socket
6. Server emits `lobby:state` → ALL cockpit clients

This approach eliminates the three-way echo guard problem entirely. Only one echo guard is needed: the existing `_applyingRemoteCombatUpdate` flag in `sync.ts` for combat store updates.

---

## QR Code Strategy

In **Play + Host** mode, the launch screen shows:
- **Primary QR** (large): companion join URL — `http://<lan-ip>:8080/companion/join?session=<code>`
- **Text below**: cockpit LAN URL — `http://<lan-ip>:8080` (for DM remote access)
- **Session code**: displayed as plain text for manual entry fallback

Label the QR clearly: **"Players scan here"**

### Post-Launch Session Code Access

Late-joining players need the session code after the DM leaves the launch screen. Show the session code (and mini QR) in:
- The **Players tab** header (when tab is visible)
- Or a collapsible info banner in the cockpit header bar

---

## Cockpit UI Integration

### Lobby Panel — `src/ui/components/lobby-panel.tsx`

An overlay/banner at the top of the cockpit, visible during `lobby` and `ready-check` session phases (post-`hasLaunched`, pre-Go Live):

- Connected player list with stats, approve/kick buttons
- Ready check trigger and per-player ready status
- Go Live button (unlocked when all players confirmed)
- Auto-dismisses when Go Live is clicked

### Players Tab — Conditional Visibility

Add `'players'` to the `TABS` array in `TabBar.tsx` as a **conditional entry**:
- Only visible when `sessionPhase === 'live'` and players are connected
- If selected but no players, falls back to Dashboard
- Keeps the tab bar clean when the feature is not in use

### TabId Type Expansion

```typescript
const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'combat', label: 'Combat' },
    { id: 'npcs', label: 'NPCs' },
    { id: 'spells', label: 'Spells' },
    { id: 'notes', label: 'Notes' },
    { id: 'av', label: 'AV' },
    { id: 'players', label: 'Players', conditional: true },  // NEW
] as const
```

---

## Naming Conflict Resolution

`src/integrations/companion/` is the **Bitfocus Companion** module (Stream Deck integration). `src/companion/` is the **Player Companion** app. Same word, different systems.

**Resolution:** Rename `src/integrations/companion/` → `src/integrations/bitfocus/`. Update all imports and test references. The Bitfocus module is the smaller, less user-facing component.

---

## npm Scripts (additions)

```json
{
  "build:companion": "vite build --config vite.companion.config.ts",
  "dev:companion": "vite --config vite.companion.config.ts",
  "dev": "npm run build:cockpit && npm run build:companion && concurrently \"npm run dev:electron\" \"npm run dev:cockpit\" \"npm run dev:companion\"",
  "build:all": "electron-vite build && npm run build:cockpit && npm run build:companion"
}
```

### Dev Ports Summary

| Port | Service | Notes |
|---|---|---|
| 8080 | Express + Socket.io | Serves cockpit + companion built files |
| 5180 | Cockpit Vite dev server | `strictPort: true`. Standalone browser dev. |
| 5181 | Companion Vite dev server | `strictPort: true`, `host: true`. Phone UI iteration. |
| 5174 | AV Display Vite | electron-vite renderer |

---

## Electron-Builder Packaging

Verify/update the electron-builder config to include `out/companion/**/*` in the packaged application alongside `out/cockpit/**/*`. Without this, production builds serve 404s for companion routes.

---

## Conditions Reference

Standard conditions available in the DM's condition picker. System-agnostic labels:

```
Blinded, Charmed, Deafened, Frightened, Grappled, Incapacitated,
Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained,
Stunned, Unconscious, Exhaustion (1-6), Concentrating
```

DM can also type custom condition names (freetext input).

---

## Key Invariants

1. **Companion never imports cockpit code.** Shared types live in `shared/`. Companion has its own stores, sync, and components.
2. **All player events use constants from `shared/socket-events.ts`.** No hardcoded event strings.
3. **Player state is server-authoritative.** The server is the single source of truth for HP, conditions, inventory. Cockpit emits actions to server, receives authoritative updates back. Companion displays what the server tells it.
4. **Whispers are private.** Server emits to specific socket only via token→socketId mapping, never broadcast to room.
5. **Token survives reconnect.** Phone sleep/wake reconnects automatically and restores state. Server marks player as disconnected, not removed.
6. **Session code validates on connect.** Wrong code or expired session → `player:sessionExpired` event. Player clears localStorage and sees join form.
7. **Companion CSS imports shared tokens.** Both cockpit and companion import `shared/design-tokens.css` for color/spacing consistency. Component-level CSS is independent.
8. **Express route order is critical.** API routes → companion static → companion SPA fallback → cockpit static → cockpit catch-all. Never reverse.
9. **Max 8 players per session.** Server rejects joins beyond `MAX_PLAYERS`.
10. **Server handlers extracted.** Player/session socket logic lives in `src/api/player-handlers.ts`, not inline in `server.ts`.
