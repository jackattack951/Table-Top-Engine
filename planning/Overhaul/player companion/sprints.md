# Player Companion — Sprint Breakdown

## Sprint Overview

The MVP is broken into 4 sprints, each delivering a testable increment. Sprints build on each other sequentially.

| Sprint | Name | Deliverable |
|---|---|---|
| **11** | Foundation & Join Flow | Companion Vite build, Express routing, join form, session tokens, player store |
| **12** | Lobby System | DM lobby panel, approve/kick, ready check, Go Live transition |
| **13** | Player Dashboard | Live dashboard with HP, conditions, inventory, currency, dice roller, whispers |
| **14** | DM Players Panel | Per-player controls in cockpit: HP adjust, conditions, items, whispers, broadcast |

---

## Sprint 11 — Foundation & Join Flow

**Goal:** Player scans QR, sees a join form, submits stats, and the server tracks them.

### 11a — Build Infrastructure & Naming Cleanup
- Rename `src/integrations/companion/` → `src/integrations/bitfocus/` (resolve naming conflict with Player Companion)
- Update all Bitfocus Companion imports and test references
- Create `vite.companion.config.ts` with:
  - `base: '/companion/'` (CRITICAL — ensures asset URLs resolve correctly)
  - `__COMPANION_BROWSER_DEV__` flag (true in serve mode, false in build)
  - `__COMPANION_SERVER_URL__` define (localhost:8080 in dev, empty in prod)
  - `host: true` on dev server (exposes to LAN for phone testing)
  - Port 5181, `strictPort: true`
- Create `tsconfig.companion.json` (extends root, adds DOM types + JSX)
- Create `src/companion/index.html` with mobile viewport meta tags
- Create `src/companion/main.tsx` entry point
- Create `src/companion/App.tsx` — state-machine routing (join → lobby → dashboard → ended/expired)
- Create `src/companion/index.css` — mobile-first, imports `shared/design-tokens.css`
- Extract `:root` CSS tokens from `src/ui/index.css` → `shared/design-tokens.css`
- Update `src/ui/index.css` to `@import` the shared tokens
- Add npm scripts: `build:companion`, `dev:companion`
- Update `dev` script: build cockpit + companion before concurrent start
- Update `build:all` to include companion
- Add `companionDistPath` to `createServer()` options interface in `src/api/server.ts`
- Update `electron/main.ts` to pass `companionDistPath` to `createServer()`
- Express serves companion at `/companion/*` — static + SPA fallback BEFORE cockpit catch-all
- Create `src/companion/lib/companion-ws-stub.ts` for browser dev mode
- Verify companion loads in mobile browser on LAN
- Update CLAUDE.md: add port 5181 to dev server ports table
- Verify electron-builder config includes `out/companion/**/*`

### 11b — Session & Token System
- Create `shared/player-types.ts` — `PlayerCharacter`, `PlayerItem`, `PlayerWhisper`, `MAX_PLAYERS`, `abilityModifier()`
- Add all new events to `shared/socket-events.ts`:
  - Player: `PLAYER_JOIN`, `PLAYER_TOKEN`, `PLAYER_RECONNECT`, `PLAYER_STATE`, `PLAYER_SESSION_EXPIRED`
  - Lobby: `LOBBY_STATE`, `LOBBY_APPROVE`, `LOBBY_KICK`, `LOBBY_READY_CHECK`, `LOBBY_READY_CONFIRM`
  - Session: `SESSION_GO_LIVE`, `SESSION_STARTED`, `SESSION_END`, `SESSION_ENDED`
  - DM push: `PLAYER_HP_UPDATE`, `PLAYER_CONDITION_ADD`, `PLAYER_CONDITION_REMOVE`, `PLAYER_ITEM_ADD`, `PLAYER_ITEM_REMOVE`, `PLAYER_CURRENCY_UPDATE`, `PLAYER_WHISPER`, `PLAYER_BROADCAST`
  - DM action: `DM_ADJUST_HP`, `DM_ADD_CONDITION`, `DM_REMOVE_CONDITION`, `DM_SEND_ITEM`, `DM_REMOVE_ITEM`, `DM_UPDATE_CURRENCY`, `DM_WHISPER`, `DM_BROADCAST`
- Expand `CLIENT_JOIN` handler: room union `'av-display' | 'cockpit' | 'player'`, add `sessionCode` and `token` fields
- Create separate `sessionState` (not mixed into `serverState`) with lifecycle tied to Play+Host mode
- Session code generation: 6-char uppercase alphanumeric, no 0/O/I/L/1
- Token generation via `crypto.randomUUID()`
- Token ↔ socket mapping: `Map<string, string>` both directions
- Player disconnect handling: mark `connected: false`, notify cockpit, allow reconnection
- Session expired handling: `player:sessionExpired` event when no active session
- Max player enforcement: reject `player:join` beyond `MAX_PLAYERS` (8)
- Create `src/api/player-handlers.ts` — extracted handler module (keeps `server.ts` from growing past 1000 lines)
- Extend `STATE_SYNC` payload to include `sessionState` when session is active (cockpit reconnect support)

### 11c — Join Form & Player Store
- Build join form UI (mobile-first): player name, character name, class, level, HP/max HP, AC, 6 ability scores
- Create `src/companion/stores/companion-store.ts` — Zustand store for local player state
- Create `src/companion/lib/companion-sync.ts` — Socket.io connection, event listeners, reconnection logic
- On submit: emit `PLAYER_JOIN` with stats + session code → server assigns token → player routes to lobby screen
- Store token in localStorage for reconnection
- Create `src/ui/stores/player-store.ts` — cockpit-side player state using `Record<string, PlayerCharacter>` (NOT Map)
- Update QR code on launch screen: primary QR points to companion join URL in Play+Host mode, cockpit URL shown as text below
- Add session code plain text display for manual entry fallback

### 11 Tests
- Session code generation (uniqueness, format, excluded chars)
- Token assignment and reconnection (valid token, expired token, no session)
- Player data validation on server (missing fields, max players)
- Join form companion store updates
- Socket event round-trip (join → token response)
- Companion Vite build produces valid output at `out/companion/`
- Express serves companion at `/companion/*` without SPA catch-all conflict
- `player-handlers.ts` handler registration and basic event routing

---

## Sprint 12 — Lobby System

**Goal:** DM sees connected players, approves/kicks them, runs a ready check, and launches the session.

### 12a — DM Lobby Panel
- New `src/ui/components/lobby-panel.tsx` — overlay/banner at top of cockpit
- Visible during `lobby` and `ready-check` session phases (post-`hasLaunched`, pre-Go Live)
- Displays a card per connected player: name, character name, class, level, HP, AC, ability scores with modifiers
- Connection status indicator per player (connected/disconnected)
- Approve and Kick buttons per player
- Session code + mini QR displayed in lobby header (for late joiners)
- Auto-dismisses when Go Live is clicked

### 12b — Ready Check & Go Live
- Once all players approved, DM can trigger Ready Check
- Player companion: lobby screen shows approval status, ready check prompt, transition to dashboard
- DM cockpit: live ready status per player, Go Live button unlocks when all confirmed
- Go Live broadcasts `session:started` to all player sockets → all transition to dashboard simultaneously
- After Go Live: lobby panel dismisses, Players tab becomes visible in TabBar

### 12c — Session End Flow
- "End Session" button in cockpit (lobby panel header or Players tab header)
- `session:end` → server clears `sessionState`, emits `session:ended` to all players
- Player dashboards show "Session Ended" screen
- New session code generated on next Play+Host launch

### 12 Tests
- Lobby state management (approve, kick, ready states)
- Ready check flow (all confirm → Go Live unlocks)
- Partial ready (some confirm, some don't — Go Live stays locked)
- Kicked player receives notification and can rejoin
- Go Live event broadcasts to all players
- Session end cleanup (state cleared, players notified)
- Multiple cockpit clients receive lobby state updates
- Disconnected player shown as disconnected in lobby (not removed)

---

## Sprint 13 — Player Dashboard

**Goal:** Players see a live dashboard on their phone that updates in real time as the DM pushes changes.

### 13a — Dashboard Layout
- Mobile-first dashboard UI: HP bar, AC badge, ability scores grid with auto-calculated modifiers, conditions area, inventory list, currency display
- State-machine screen transitions (not URL-based routing)
- Dashboard receives push events and updates companion store
- Reconnection handling: on socket reconnect, re-emit `CLIENT_JOIN` with token → server restores state

### 13b — Dice Roller
- Built into dashboard — purely client-side, no server involvement
- Dice available: d4, d6, d8, d10, d12, d20, d100
- Roll animation and result display
- Session roll history (stored in local state, not persisted)

### 13c — Whisper System (Player Side)
- Incoming whisper triggers notification (visual + vibration on mobile via Vibration API)
- Sealed envelope icon — tap to reveal
- Whisper history visible only to recipient
- Server delivers whisper via targeted socket emission (token→socketId mapping)

### 13 Tests
- Dashboard renders all player data correctly
- HP bar updates on `player:hpUpdate` event
- Conditions add/remove on events
- Inventory add/remove on events
- Currency update on event
- Dice roller produces valid results within range per die type
- Whisper delivery to correct player only
- Reconnection restores full player state
- Phone sleep/wake reconnection cycle

---

## Sprint 14 — DM Players Panel

**Goal:** DM has full per-player control from the cockpit — HP, conditions, items, whispers, and broadcast.

### 14a — Players Tab UI
- Add `'players'` to `TabBar` as a conditional tab (visible when `sessionPhase === 'live'` and players connected)
- Expand `TabId` type in `TabBar.tsx`
- Add `case 'players'` to `renderTab()` in `App.tsx`
- Per-player card: character name, player name, HP bar, AC, conditions badges, ability scores, connection status
- Quick action buttons: HP +/-, Add Condition, Send Item, Whisper
- Session code + mini QR in tab header (for late joiners)

### 14b — DM Actions (Server-Authoritative)
- HP adjust: emits `dm:adjustHp` → server mutates state → pushes to player + cockpit
- Condition toggle: emits `dm:addCondition` / `dm:removeCondition` → server mutates → pushes
- Item send: emits `dm:sendItem` → server mutates → pushes
- Currency update: emits `dm:updateCurrency` → server mutates → pushes
- Cockpit NEVER locally mutates player state — always waits for server response via `lobby:state`

### 14c — Whisper & Broadcast (DM Side)
- Whisper: text input on player card, target one or multi-select
- Emits `dm:whisper` with `tokens[]` → server delivers to targeted sockets only
- Broadcast: separate panel, send message or item to all connected players
- Emits `dm:broadcast` → server emits to all sockets in `player` room

### 14d — Combat Store HP Sync (Server-Mediated)
- When DM adjusts HP in combat tracker for an `isPlayer` combatant:
  - `sync.ts` emits `COMBAT_SYNC` to server
  - Server checks if combatant matches a session player by name
  - If match: server updates `sessionState.players[token].hpCurrent`
  - Server pushes `player:hpUpdate` to player + `lobby:state` to cockpit
- No direct store-to-store sync on the client — server is the mediator
- Only echo guard needed: existing `_applyingRemoteCombatUpdate` in `sync.ts`

### 14 Tests
- DM HP adjust pushes to correct player (via server)
- DM condition add/remove pushes to correct player
- DM item send pushes to correct player
- Whisper targets only selected player(s) — not broadcast to room
- Broadcast reaches all players
- Combat tracker HP change syncs to player dashboard (server-mediated)
- Multiple cockpit clients stay in sync after DM actions
- Disconnected player reconnects and receives accumulated state changes

---

## Post-MVP — Future Sprints

These are not planned in detail yet. Listed for reference.

| Feature | Notes |
|---|---|
| Full character creator (basic + advanced) | Step-by-step and tabbed modes |
| Game system presets | D&D 5e, PF2e, CoC, Shadowrun JSON configs |
| Two-way player interaction | Players interact with items, discoveries |
| Native app wrapper | Capacitor for iOS/Android |
| Custom system builder | DM defines fields, classes, races |
| Session persistence | Save/restore player state across sessions (SQLite) |
| Initiative integration | Player-submitted initiative modifier feeds combat tracker |
| PWA support | Web app manifest for "Add to Home Screen" on phones |
