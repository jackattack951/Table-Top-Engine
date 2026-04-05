# Sprint History & Active Sprints

> Single source of truth for all sprint work. Updated after every sprint completion.
> For backlog items not yet in active development, see `Backlog.md`.

**Current test count: 836 tests passing across 47 test files.**

---

## Status Overview

| Sprint | Focus | Status | Tests At Completion |
|--------|-------|--------|---------------------|
| 0 | Scaffolding & Foundation | COMPLETE | — |
| 1 | Local Bridge & State Sync | COMPLETE | — |
| 2 | Visual Engine & Maps | COMPLETE | — |
| 3 | Mood Engine | COMPLETE | — |
| 4 | TTRPG Tools & Database | COMPLETE | — |
| 5 | Content & Reference | COMPLETE | — |
| 6 | External Integration | COMPLETE | — |
| 6a | Boot-Up Experience + Real SFX | COMPLETE | 158 |
| 7a | Performance + Preview | COMPLETE | 172 |
| 7b | Real-Time Preview | COMPLETE | 172 |
| 8a | Notes Data Model | COMPLETE | 196 |
| 8b | Notes REST API | COMPLETE | 208 |
| 8c | Notes Store + Sync | COMPLETE | 228 |
| 8d | Notes Tab UI + CodeMirror 6 | COMPLETE | 240 |
| 8e | Import Pipeline Overhaul | COMPLETE | 259 |
| 8f | Scenes Tab | COMPLETE | 286 |
| 9a | Launch Screen UI | COMPLETE | — |
| 9b | AV Output Management | COMPLETE | — |
| 9c | Transition & Polish | COMPLETE | — |
| 9d | Logo & Branding | COMPLETE | — |
| 9 polish | Polish Pass | COMPLETE | 328 |
| 10a | Data Model Foundation | COMPLETE | ~350 |
| 10b | Dashboard 3-Column Layout | COMPLETE | — |
| 10c | Right Column Quick-Access | COMPLETE | — |
| 10d | Scene Timeline Strip | COMPLETE | — |
| 10e | Bottom Notes Strip + Scratchpad | COMPLETE | — |
| 10f | Dice Roller | COMPLETE | — |
| 10g | Fog of War Data Model | COMPLETE | ~400 |
| 10h | Fog of War Cockpit UI | COMPLETE | ~414 |
| 10i | Fog of War AV Renderer | COMPLETE | 437 |
| 10j | Cinematic Launch Intro | COMPLETE | 440 |
| 11a | Companion Build Infrastructure | COMPLETE | 440 |
| 11b–14 | Player Companion MVP | COMPLETE | 597 |
| Media Library | Phase 5 Media Library | COMPLETE | ~650 |
| Post-Sprint Polish | Bug Fixes (3 phases) | COMPLETE | 672 |
| Live Testing | Live Testing Bug Fixes | COMPLETE | 672 |
| Code Cleanup | Cleanup + AV Display Fixes | COMPLETE | 649 |
| 15 | Notes System Overhaul Phase 1 | COMPLETE | 706 |
| 16c | Overhaul TODO Cleanup | COMPLETE | — |
| 17a | Cleanup + Launch Screen Polish | COMPLETE | 753 |
| 17b | Per-Tab Polish | COMPLETE | 753 |
| 17c | Ambient Audio Engine | BLOCKED (OGG files) | 768 (partial) |
| 17d | Companion Polish | COMPLETE | 753 |
| 17e | Demo Token + Packaging | NEXT (after 17c) | — |
| 18a | Video Buffering Fix | COMPLETE | 777 |
| 18b | Cued Scene + Preview Notes | COMPLETE | 793 |
| 18c | A/B Deck Video Engine | COMPLETE | ~814 |
| 18d | TAKE Crossfade | COMPLETE | — |
| 18e | Vertical Slider Overhaul | COMPLETE | — |
| 18f | Transport Bar | COMPLETE | 819 |
| 19 | PDF Import + Parser Enhancement | COMPLETE | 836 |
| 20 | Scene Save + Summary + Plan/Play Mode | SUPERSEDED (→ Sprint 22) | — |
| 21a | Player → DM Messaging + Bidirectional Whisper | PLANNED | — |
| 21b | DM Roll Prompt System | PLANNED | — |
| 21c | Character Select from Campaign DB | PLANNED | — |
| 22a | Scene Summary + Save Indicator + Plan/Play Mode | PLANNED | — |
| 22b | Named Saves + Undo on Load | PLANNED | — |
| 22c | AV Output Idle Screen | PLANNED | — |
| 23a | Settings Page + Audio Device Selection | PLANNED | — |
| 23b | Display Assignment + Volume Persistence | PLANNED | — |
| 23c | Theme Toggle + Export/Import Prefs | PLANNED | — |

---

## Active / Blocked Sprints

### Sprint 17c — Ambient Audio Engine (BLOCKED on OGG audio files)

**Why:** Audio is a core pillar of the "theatrical atmosphere engine" pitch. Testers need to hear something. The full procedural stem system is too complex for pre-beta, but the plumbing is 90% done.

**Design: Two-Axis Ambient System**
- **Axis 1 — Environment** (where are we?): Forest, Cave, Tavern, Night, Ocean. Each has 3 pre-mixed OGG stems sharing key/BPM.
- **Axis 2 — Mood** (what's the energy?): Calm / Tense / Dramatic. Three buttons. MoodEngine crossfades between stems on the downbeat.

**Already completed (2026-03-13):**
- MIX tab added to dashboard center column
- 5-channel mixer (MixerPanel): Ambience, Music, SFX, BG Video, GB Video
- Master fader: always-visible horizontal strip on dashboard
- Breathing timer selector: 15s/30s/1min/2min/5min
- Full signal chain wired: cockpit store -> debounced socket -> server relay -> AV Display
- Socket events: MASTER_VOLUME, MUSIC_VOLUME, BG_VIDEO_VOLUME, GB_VIDEO_VOLUME, BREATHING_HOLD
- 768 tests passing

**Key files modified:**
- `src/ui/tabs/dashboard/mixer-panel.tsx` — 5-channel fader + breathing timer
- `src/ui/tabs/dashboard/master-fader.tsx` — always-visible master volume strip
- `src/ui/stores/mood-store.ts` — masterVolume, musicVolume, bgVideoVolume, gbVideoVolume
- `src/systems/audio/mood-engine.ts` — musicVol gain node, setMusicVolume()
- `src/systems/av/video-engine.ts` — setVolume()

**Still TODO:**
- [ ] C1: Atmosphere control card — environment buttons + mood buttons
- [ ] C2: Replace oscillators with Tone.Player + loadEnvironment()
- [ ] C3: Bundle 15 environment stems + 6 SFX clips (blocked on OGG files)
- [ ] C4: Wire SFXPanel dev clips to real audio file paths
- [ ] C5: Volume sliders for ambience + SFX
- [ ] Add Express static route for /audio/ directory
- [ ] Verify crossfade between zones works with real OGG stems
- [ ] Run full test suite

**Audio file requirements:** 15 OGG stems (5 environments x 3 moods) + 6 SFX clips. See `planning/Overhaul/audio/ambient-audio-production.md` and `planning/Overhaul/v1-release-polish.md` for full specs.

---

### Sprint 17e — Demo Token System + Packaging (NEXT after 17c)

- Extend `src/core/auth/auth.ts` with demo tier + days-remaining helper
- Demo token generation script
- Launch screen gate for lapsed licenses
- "Demo — X days remaining" badge in cockpit
- Electron Builder packaging + installer
- Distribution test on clean Windows machine

---

### Sprint 20 — Scene Save System + Summary + Plan/Play Mode (SUPERSEDED → Sprint 22)

> **Superseded.** Sprint 22 incorporates the full Sprint 20 spec (Phases A, B, C) and adds named saves, undo on load, and AV idle screen. Implement Sprint 22 instead of Sprint 20.

**Full technical spec (still valid as Phase 22a input):** `planning/Overhaul/Scene Save/scene-save-spec.md`

---

### Sprint 19 — PDF Import + Parser Enhancement (COMPLETE)

**Why:** DMs prep from published PDF adventures (official WotC modules, DMs Guild, fan-made). The import system only accepted markdown/text. Adding PDF support widens the funnel with minimal rework — same pipeline, broader input.

**Completed:**
- [x] A1: Added `pdfjs-dist` dependency for PDF text extraction
- [x] A2: `pdf-extractor.ts` — `extractTextFromPDF()` utility using pdfjs-dist legacy build
- [x] A3: Wired PDF accept into Document Import Modal (`.pdf` alongside `.md`/`.txt`, async extraction with loading state)
- [x] B1: Parser — Scene detection for Part/Act/Chapter headings (D&D adventure module conventions)
- [x] B2: Parser — NPC detection for "Roleplaying [Name]" blocks + Ideal/Bond/Flaw field extraction
- [x] B3: Parser — Improved read-aloud text extraction (plain text markers: "read the following", "read or paraphrase")
- [x] C1: Tests for PDF extractor (6 tests)
- [x] C2: Tests for expanded parser patterns (17 new tests, 55 total document-parser tests)

**Test count:** 836 tests passing across 47 test files.

**Key files:**
- `src/systems/import/pdf-extractor.ts` (NEW) — PDF → text extraction
- `src/systems/import/pdf-extractor.test.ts` (NEW) — 6 tests
- `src/systems/import/document-parser.ts` — Expanded scene/NPC/read-aloud patterns
- `src/systems/import/document-parser.test.ts` — 17 new Sprint 19 tests
- `src/ui/components/document-import-modal.tsx` — PDF file accept + extraction UI

**D&D PDFs tested against (in `planning/Overhaul/Notes/DND Campaigns/`):**
- The Hangover (8 pages, one-shot)
- Tyranny in Phlan (40 pages, AL module)
- Challenge of the Frog Idol (23 pages, OSR dungeon)
- Six Faces of Death (48 pages, Dragonlance)
- Army of the Damned (74 pages, Innistrad)
- Elfhunt (20 pages, Chult jungle)
- Clam Island (106 pages), Winter's Splendor (26 pages)

**Not in scope (added to Backlog):** Full stat block parsing, PDF image/map extraction, encounter difficulty calculator, multi-column layout handling.

---

## Completed Sprint Details

### Sprint 0 — Scaffolding & Foundation
- Monorepo: `electron/`, `src/`, `shared/`, `preload/`
- TypeScript strict mode, electron-vite build setup
- Auth system (`src/core/auth/auth.ts`): safeStorage token caching, offline fallback
- Express + Socket.io server (`src/api/server.ts`): rooms, named events
- SQLite via better-sqlite3 (`src/core/db/`)
- IPC channels (`shared/ipc-channels.ts`), Socket events (`shared/socket-events.ts`)

### Sprint 1 — Local Bridge & State Sync
- Cockpit UI shell: TabBar, ModeToggle, ConnectionStatus
- Zustand stores: combat, mood, scene, av, app
- `src/ui/lib/sync.ts`: central store -> socket relay
- `src/ui/lib/ws-stub.ts`: browser dev simulation
- DevTestPanel for manual testing
- AV Display BrowserWindow in `electron/main.ts`

### Sprint 2 — Visual Engine & Maps
- PixiJS layer stack (`src/systems/av/layer-stack.ts`)
- Dual video engines: `engines.background`, `engines.gameboard` (same VideoEngine class)
- WebCodecs video decode pipeline
- GLSL color grade filter
- Particle presets: Rain, Snow, Ash, Embers, Dust, Fog
- Fog of War eraser + Ping tool

### Sprint 3 — Mood Engine
- `src/systems/audio/mood-engine.ts`: Tone.js Transport, BPM-accurate stem scheduling
- Zones: calm (0-0.34), tense (0.35-0.65), dramatic (0.66-1.0)
- Downbeat-accurate crossfades on musical measure boundaries
- 10 mood engine tests

### Sprint 4 — TTRPG Tools & Database
- SQLite schema migration (`001_initial_schema.sql`)
- Combat Tracker: initiative, HP, conditions, round counter
- Notes tab with Scene Trigger parsing
- Scene management: save/load, A/B branching
- NPC panel, Obsidian vault importer + live file watcher
- Full state sync on socket reconnect (STATE_SYNC event)

### Sprint 5 — Content & Reference
- 5e SRD bundled: spells, monsters, conditions (`src/reference/`)
- Fast local search with Fuse.js-style indexing
- Environment presets: 8 biomes x weather variants
- CONTENT_LOAD socket event for runtime asset loading

### Sprint 6 — External Integration
- Bitfocus Companion module (`src/integrations/bitfocus/`)
- Stream Deck preset layouts
- 18 companion tests
- Hardware test deferred to post-Sprint 7

### Sprint 6a — Boot-Up Experience + Real SFX
- LaunchScreen: full-screen mode selector with mode cards
- AppStore: `hasLaunched`, `setLaunched`, `setNetworkMode`
- Socket.io connection gated behind `hasLaunched`
- SFX Soundboard rewrite: AudioBufferSourceNode + fetch + decodeAudioData + buffer cache
- Port conflict detection in `electron/main.ts`
- Browser dev mode detection via `__COCKPIT_BROWSER_DEV__` Vite define
- **158 tests, 10 files**

### Sprint 7a — Performance + Preview
- `perf-monitor.ts`: FPS, memory, latency tracking
- PERF_PING/PERF_PONG socket events
- `GET /api/perf` and `GET /api/lan-info` REST endpoints
- **172 tests, 12 files**

### Sprint 7b — Real-Time Preview
- `preview-capture.ts`: canvas -> JPEG -> ArrayBuffer pipeline
- PREVIEW_START/STOP/FRAME socket events
- `preview-panel.tsx`: ImageBitmap rendering in cockpit
- **172 tests, 12 files**

### Sprint 8 — Notes & Scenes Overhaul

**8a — Notes Data Model:**
- Migration `002_notes_system.sql`: `notes` table, `scene_notes` junction, `scratchpad` column
- Full DB CRUD for notes, 35 DB tests. **196 tests, 14 files**

**8b — Notes REST API:**
- 9 note REST endpoints, bulk scene-note-links endpoint
- **208 tests, 15 files**

**8c — Notes Store + Sync:**
- `useNotesStore` Zustand store with `sceneNoteLinks` cache
- 6 Socket.io events, inbound handlers in sync.ts
- **228 tests, 16 files**

**8d — Notes Tab UI + CodeMirror 6:**
- Split-pane notes manager (NotesList + NoteEditor)
- CodeMirror 6 with markdown highlighting and trigger decorations
- `useNotes` hook with REST helpers, optimistic store updates
- **240 tests, 17 files**

**8e — Import Pipeline Overhaul:**
- All file types create Note entities, frontmatter `type` mapping
- Re-import merge by `sourceFile`, single-file import via IPC
- ImportPanel component. **259 tests, 17 files**

**8f — Scenes Tab:**
- Card-based Scenes Tab with inline expand/collapse
- SceneAdvancer, drag-to-reorder, linked notes pills
- **286 tests, 19 files**

### Sprint 9 — Startup Sequence Overhaul

**9a — Launch Screen UI:** Two-column card layout, mode cards with Phosphor icons, campaign list with REST fetch, "Start Session" button with progress bar.

**9b — AV Output Management:** Removed auto-creation (Rule 13), display enumeration + hot-plug, `output-store.ts`, windowed pop-out support, headless mode proxy.

**9c — Transition & Polish:** Entry fade-in, progress bar, QR code panel, version + license display.

**9d — Logo & Branding:** Custom SVG `Logo.tsx` component (placeholder).

**9 Polish Pass:** Extracted shared types, fixed return types, added OUTPUT_DISPLAYS_CHANGED handler, 12 store-contract tests. **328 tests, 22 files.**

**Dev Startup Sequence Fix:** Cockpit Vite port 5180 (`strictPort: true`), `IS_BROWSER_DEV` dual check, Express serves built files (no redirect), CORS middleware.

**CSS Unification Phase 1:** 21 CSS tokens, `.form-input`/`.form-select` classes, `shared/color-constants.ts`.

### Sprint 10 — Dashboard Overhaul

**10a — Data Model Foundation:** Migration `003_dashboard_overhaul.sql`, scene-NPC/encounter junction tables, REST routes.

**10b — Dashboard 3-Column Layout:** Extracted sub-components to `src/ui/tabs/dashboard/`.

**10c — Right Column Quick-Access:** Compact combat, scene-linked NPCs, SRD search, items placeholder.

**10d — Scene Timeline Strip:** Horizontal Past/Current/Future timeline, branch forks, drag-and-drop reorder.

**10e — Bottom Notes Strip + Scratchpad:** Read-only scene notes + per-session scratchpad.

**10f — Dice Roller:** Notation parser (`2d6+4`), d4-d100 presets, roll history, advantage/disadvantage.

**10g — Fog of War Data Model:** Migration `004_fog_of_war.sql`, 4 socket events, `fog-store.ts`.

**10h — Fog of War Cockpit UI:** HTML5 Canvas painting overlay, brush size/mode, enlarge modal via CSS class toggling, debounced PNG save.

**10i — Fog of War AV Renderer:** PixiJS fog rendering, fog layer in LayerStack (8 layers), normalized coordinate scaling. **437 tests, 25 files.**

**10j — Cinematic Launch Intro:** Alien-style green typewriter animation, click/key skip, fade to black. **440 tests, 26 files.**

### Sprints 11-14 — Player Companion MVP

**11a — Build Infrastructure:** Companion Vite build, `shared/design-tokens.css` extraction, Express routing (companion before cockpit catch-all), `base: '/companion/'`. **440 tests.**

**11b-14 — Full MVP:**
- Sprint 11b: Join flow (QR scan -> session code -> token)
- Sprint 12: Lobby + ready check + Go Live
- Sprint 13: Player dashboard (HP, AC, abilities, conditions, inventory, currency, dice, whispers)
- Sprint 14: DM Players tab (per-player controls, broadcast, combat HP sync)
- Player handlers in `src/api/player-handlers.ts`, shared types in `shared/player-types.ts`
- **597 tests, 35 files**

See `planning/Overhaul/player companion/` for detailed specs and implementation guide.

### Media Library (Phase 5)
- Migration `005_media_library.sql`: `assets` table, `asset_campaign_tags` junction
- Full asset CRUD REST endpoints, MediaPicker component, MediaTab
- Asset-based scene loading (`backgroundAssetId`/`gameboardAssetId`)
- **~650 tests**

### Post-Sprint Polish + Live Testing + Code Cleanup
- **Phase A:** 5 real bug fixes (stale socketId, VRAM leak, video listener leak, MediaPicker escape, startingSceneId)
- **Phase B:** 6 improvements (path validation, input validation, error feedback, inline style migration, currency validation, scene load errors)
- **Phase C:** 6 nice-to-haves (QR race condition, accessibility, tag feedback, debug logging, scratchpad flush, DB index)
- **Live Testing:** 9 bugs found during `npm run dev` testing (media import, session code, sidebar visibility, GB assignment, AV pickers, GB preview, fog overlay, STATE_SYNC, CORS)
- **Code Cleanup:** Wired orphaned PlayersTab, deleted fog-renderer.ts (superseded by fog-of-war.ts), independent BG/GB color grading (migration `006_gb_color_grade.sql`), extensionless URL fix for PIXI.Assets.load
- **649 tests, 40 files**

### Sprint 15 — Notes System Overhaul Phase 1
- Wikilinks + backlinks (CodeMirror 6 extension, autocomplete, "Referenced By" panel)
- Pinned notes, archive (soft delete), color coding (8-color palette)
- Quick capture (Ctrl+Shift+N), expanded types (quest, session, faction), status field
- Card grid view (masonry toggle)
- Smart Import Parser (regex extraction, preview UI, auto-wikilinks)
- Inline Extract (text selection -> modal -> create entity + wikilink)
- Item entity system (full CRUD, rarity, category, properties, tags)
- **706 tests, 43 files**

### Sprint 16c — Overhaul TODO Cleanup
- Dashboard Quick Items Widget wired to real Item entity system
- Campaign Home Panel (dashboard view when no scene active)
- Import Pipeline rewired to server-side `runImportPipeline()`
- Campaign Home Import Button, Campaign Home <-> Dashboard navigation
- ExtractionPreview lore category, Express JSON body limit (5MB)

### Sprint 17a — Cleanup + Launch Screen Polish
- Deleted 3 orphaned AV tab files
- CSS Unification: `inputStyle` migrated to `.form-input`/`.form-select`, inline styles 59 -> 11
- Error boundary (`error-boundary.tsx`) wraps cockpit tab content
- Skip intro localStorage preference
- Empty campaign state improved copy/hierarchy
- Error message audit (all plain language)
- **753 tests**

### Sprint 17b — Per-Tab Polish
- Combat active-turn pulse animation
- AV tab sticky column headers
- Players tab CopyButton for session code
- Scene timeline tooltips on truncated names
- Combat HP buttons flex-wrap
- Spells filter pill stronger active state
- Empty state polish (emoji icons + actionable copy across Media, Players, NPCs)
- **753 tests**

### Sprint 17d — Companion Polish
- User satisfied with companion state for v0.6. No further polish needed.

### Sprint 18 — Program/Preview Playback System

**18a — Video Buffering Fix:**
- `canplaythrough` wait with abort callback, 300ms fade-in, `cancelFade()`, `autoLoad: false`
- **777 tests** (9 new)

**18b — Cued Scene + Preview Notes:**
- `cuedScene` in scene-store, `takeScene(scenes)`, `autoCue(scenes)`, `findNextCue()` helper
- Timeline click-to-cue, TAKE button, preview notes with green glow + "PREVIEW" banner
- **793 tests** (16 new)

**18c — A/B Deck Video Engine:**
- `DeckPair` class with preload/take/cold-load, image pipeline, clearDeck cleanup
- **~814 tests** (21 new)

**18d — TAKE Crossfade:**
- RAF-based container alpha animation (configurable duration), cancelCrossfade with alpha-snap
- Empty-standby guard, fadingOutDeck tracking

**18e — Vertical Slider Overhaul:**
- `VerticalFader` component (groove+fill track, Dark Accent Cap handle, bipolar mode, 3 height variants)
- Mixer panel vertical channels, popout master fader, `ColorGradeCard` extraction

**18f — Transport Bar:**
- `TransportBar` replaces `MasterFader` above timeline
- Volume popout + CUE/TAKE buttons, `useClickOutside` hook extracted
- `useScenes` lifted to `DashboardTab` (single fetch, passed as props)
- **819 tests**

**Key design decisions (Sprint 18):**
- Cued scene logic: forward-advancing timeline, NOT PGM/PVW swap
- Green glow = cued, marching ants = live
- A/B deck: two VideoEngine instances per role, crossfade by animating sprite alpha
- Embedded video encoding: H.264 MP4, 1080p, 24fps, 4-6 Mbps VBR, strip audio

---

## Sprint 21 — Player Companion v2: Two-Way Comms (PLANNED)

**Why:** The Player Companion is currently receive-only — players get HP, conditions, items, and whispers from the DM but can't initiate anything. Two-way comms (player → DM messages, raise-hand, roll responses) transforms the companion from a scoreboard into a session-interactive tool. A generalized roll prompt system lets the DM call for group checks with dice type, DC, and countdown without switching apps. Character select from the campaign DB eliminates per-session stat re-entry for regular groups.

**Scope (3 phases):**
- [ ] **Phase 21a — Player → DM Messaging + Bidirectional Whisper:** Companion sends messages to DM, raise-hand / flag button, bidirectional whisper thread.
- [ ] **Phase 21b — DM Roll Prompt System:** DM picks die + label + optional DC + optional countdown → all/selected players see a full-screen prompt → roll → results aggregate live in the Players tab.
- [ ] **Phase 21c — Character Select from Campaign DB:** New `player_characters` table; players select a pre-created character on join instead of entering stats manually.

**Out of scope (items remaining in the LARGE backlog):** Full character creator with derived stats and Basic/Advanced modes; game system config presets (D&D 5e, PF2e, CoC JSON); session persistence (SQLite save/restore of full player state across sessions); native app wrapper (Capacitor/PWA); atmosphere broadcast to player screens; initiative integration with combat tracker.

---

### Phase 21a — Player → DM Messaging + Bidirectional Whisper

**Goal:** Players can send a message to the DM (one-on-one, not broadcast). The existing DM→Player whisper thread becomes a unified bidirectional thread per player. A "raise hand" button flags the DM's attention without a message.

**Tasks:**
- [ ] A1: Add 6 new event constants to `shared/socket-events.ts` (see below)
- [ ] A2: Add `PlayerMessage` interface to `shared/player-types.ts` — `{ id, message, timestamp, direction: 'dm-to-player' | 'player-to-dm' }`
- [ ] A3: Extend `PlayerCharacter` in `player-types.ts` — replace `whispers: PlayerWhisper[]` with `messages: PlayerMessage[]` (backward-compatible: import message thread renders both old whispers + new player messages); add `handRaised: boolean`
- [ ] A4: `src/api/player-handlers.ts` — `PLAYER_MESSAGE` handler: validate token, append to player's `messages` array, relay `PLAYER_MESSAGE_RECEIVED` to cockpit room
- [ ] A5: `player-handlers.ts` — `PLAYER_RAISE_HAND` handler: set `handRaised = true`, emit `PLAYER_HAND_UPDATE` to cockpit
- [ ] A6: `player-handlers.ts` — `DM_DISMISS_HAND` handler: set `handRaised = false`, emit `PLAYER_HAND_UPDATE` to cockpit + `PLAYER_HAND_DISMISSED` to player
- [ ] A7: Companion: `src/companion/components/message-input.tsx` (NEW) — compact textarea + Send button at bottom of dashboard screen; emits `PLAYER_MESSAGE`; Enter to submit, Shift+Enter for newline
- [ ] A8: Companion: `src/companion/components/message-thread.tsx` (NEW) — scrollable unified thread; DM messages right-aligned (received), player messages left-aligned (sent); replaces old whisper list
- [ ] A9: Companion: Raise Hand button on dashboard (header area) — toggles `handRaised` state, emits `PLAYER_RAISE_HAND`; shows "Hand raised — DM notified" feedback; grayed out until DM dismisses
- [ ] A10: Companion: handle `PLAYER_HAND_DISMISSED` — clear raise-hand state + show brief toast
- [ ] A11: Cockpit `src/ui/tabs/players/player-card.tsx` — notification badge (amber dot) when `handRaised === true` or unread messages exist; badge count shows unread message count
- [ ] A12: Cockpit `player-card.tsx` — expand section: replace whisper-send-only UI with full bidirectional message thread (same `message-thread` component or equivalent) + dismiss-hand button
- [ ] A13: Tests: extend `src/api/player-handlers.test.ts` — message relay, raise-hand state transitions, dismiss flow

**New socket events:**
```typescript
PLAYER_SEND_MESSAGE: 'player:sendMessage',       // Player → Server: { token, message }
PLAYER_MESSAGE_RECEIVED: 'player:msgReceived',   // Server → Cockpit: { token, message: PlayerMessage }
PLAYER_RAISE_HAND: 'player:raiseHand',           // Player → Server: { token }
DM_DISMISS_HAND: 'dm:dismissHand',               // Cockpit → Server: { token }
PLAYER_HAND_UPDATE: 'player:handUpdate',         // Server → Cockpit: { token, raised: boolean }
PLAYER_HAND_DISMISSED: 'player:handDismissed',   // Server → Player: {} (clear raise-hand UI)
```

**Key files:**
| File | Action |
|---|---|
| `shared/socket-events.ts` | Add 6 new events |
| `shared/player-types.ts` | Add `PlayerMessage`; extend `PlayerCharacter` |
| `src/api/player-handlers.ts` | 3 new handlers |
| `src/companion/components/message-input.tsx` | NEW |
| `src/companion/components/message-thread.tsx` | NEW |
| `src/companion/screens/dashboard-screen.tsx` | Integrate message thread + raise-hand button |
| `src/ui/tabs/players/player-card.tsx` | Notification badge + bidirectional thread |
| `src/api/player-handlers.test.ts` | Extend |

---

### Phase 21b — DM Roll Prompt System

**Goal:** DM selects a die type, optional label, optional DC, and optional countdown → server broadcasts a roll prompt to all (or selected) players → players roll on the companion → results appear in the DM Players tab in real time as they come in.

**Tasks:**
- [ ] B1: Add `RollPrompt`, `RollResult`, `DieType` types to `shared/player-types.ts`
- [ ] B2: Add 6 new event constants to `shared/socket-events.ts`
- [ ] B3: Extend `SessionState` in `player-types.ts`: `activePrompt: RollPrompt | null`, `promptResults: Record<string, RollResult>` (token → result)
- [ ] B4: `player-handlers.ts` — `DM_ROLL_PROMPT` handler: generate `promptId`, store in SessionState, broadcast `PLAYER_ROLL_PROMPT` to player room; if `countdown > 0`, schedule `setTimeout` to auto-close prompt and emit `ROLL_PROMPT_CLOSED` after expiry
- [ ] B5: `player-handlers.ts` — `PLAYER_ROLL_RESULT` handler: validate prompt still active + token hasn't already submitted; store result; push `ROLL_RESULTS_UPDATE` with full results array to cockpit room
- [ ] B6: `player-handlers.ts` — `DM_CLOSE_PROMPT` handler: clear `activePrompt`, emit `ROLL_PROMPT_CLOSED` to player room, clear `promptResults`
- [ ] B7: Companion: `src/companion/components/roll-prompt-overlay.tsx` (NEW) — full-screen overlay displayed when `PLAYER_ROLL_PROMPT` received
  - Shows die face (large text: "d20"), label, DC (if set), countdown ticker (counts down in real time from `endsAt`)
  - Optional modifier input (signed integer, for ability modifier)
  - "Roll" button: generates `Math.floor(Math.random() * sides) + 1`, displays result briefly (1.5s flip animation or number reveal), then emits `PLAYER_ROLL_RESULT` and closes overlay
  - Overlay auto-dismisses on `ROLL_PROMPT_CLOSED`
- [ ] B8: Companion: handle `PLAYER_ROLL_PROMPT` in dashboard — mount overlay; handle `ROLL_PROMPT_CLOSED` — unmount
- [ ] B9: Cockpit: `src/ui/tabs/players/roll-prompt-panel.tsx` (NEW) — panel in Players tab
  - Die selector: d4 / d6 / d8 / d10 / d12 / d20 / d100 button strip (single-select)
  - Label input (e.g., "Perception Check")
  - DC input (optional, integer)
  - Countdown input (optional, seconds; 0 = no timer)
  - Target: "All Players" (default) or individual player checkboxes
  - "Send Roll Prompt" button → emits `DM_ROLL_PROMPT`
  - Live results list: player name + character name + roll + total + pass/fail badge (if DC set); grays out players who haven't rolled; shows countdown bar if active
  - "Close Prompt" button dismisses prompt on all players
- [ ] B10: Tests: `player-handlers.test.ts` — prompt creation, result submission, duplicate-submit guard, auto-close timeout, close-before-all-submit, concurrent simultaneous submissions from two players arriving in the same tick (verify both recorded, no dropped result)

**New types (`shared/player-types.ts`):**
```typescript
export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

export interface RollPrompt {
    promptId: string
    die: DieType
    label: string
    dc?: number
    endsAt?: number        // unix ms timestamp; absent = no timer
    targetTokens?: string[] // absent = all players
}

export interface RollResult {
    token: string
    playerName: string
    characterName: string
    roll: number           // raw die result
    modifier: number       // player-entered modifier (default 0)
    total: number          // roll + modifier
    passed?: boolean       // present only when RollPrompt.dc is set
    submittedAt: number    // unix ms
}
```

**New socket events:**
```typescript
DM_ROLL_PROMPT: 'dm:rollPrompt',             // Cockpit → Server: { die, label, dc?, countdown?, targetTokens? }
PLAYER_ROLL_PROMPT: 'player:rollPrompt',     // Server → Players: RollPrompt
PLAYER_ROLL_RESULT: 'player:rollResult',     // Player → Server: { promptId, token, roll, modifier }
ROLL_RESULTS_UPDATE: 'roll:resultsUpdate',   // Server → Cockpit: { promptId, results: RollResult[] }
DM_CLOSE_PROMPT: 'dm:closePrompt',           // Cockpit → Server: { promptId }
ROLL_PROMPT_CLOSED: 'player:promptClosed',   // Server → Players: { promptId }
```

**Key files:**
| File | Action |
|---|---|
| `shared/socket-events.ts` | Add 6 new events |
| `shared/player-types.ts` | Add `DieType`, `RollPrompt`, `RollResult`; extend `SessionState` |
| `src/api/player-handlers.ts` | 3 new handlers + auto-close timeout |
| `src/companion/components/roll-prompt-overlay.tsx` | NEW — full-screen roll overlay |
| `src/companion/screens/dashboard-screen.tsx` | Mount/unmount overlay on prompt events |
| `src/ui/tabs/players/roll-prompt-panel.tsx` | NEW — prompt creation + live results |
| `src/ui/tabs/PlayersTab.tsx` | Integrate `RollPromptPanel` |
| `src/api/player-handlers.test.ts` | Extend |

---

### Phase 21c — Character Select from Campaign DB

**Goal:** DMs pre-create player character sheets in the campaign. On join, the companion's behavior depends on a DM-configured **character select mode** (3 modes — see below). Manual entry remains available as a fallback in most modes.

**Character select modes (DM-configured in Settings → Companion, Sprint 23b):**

| Mode | Behavior | Use case |
|---|---|---|
| `roster-only` | Players MUST pick from the DM's pre-built characters. No manual entry option. | One-shots with pre-gens |
| `roster-and-manual` | Players see the roster but can also tap "Enter my own" to input custom stats. | Regular groups where most have characters on file but a guest might drop in |
| `manual-only` | No roster shown. Players always enter their own stats. **Default** — preserves current behavior. | New campaigns, open tables |

The mode is stored in `settings-store` (Sprint 23b) and delivered to the companion via `GET /api/sessions/:code/info` → `{ ..., characterSelectMode }`.

**Design decision:** New `player_characters` table (not `npcs` — NPCs use an opaque `statBlock` JSON blob; player characters need typed first-class stat fields for server-side HP tracking and companion rendering).

**DB migration `007_player_characters.sql`:**
```sql
CREATE TABLE IF NOT EXISTS player_characters (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    name TEXT NOT NULL,
    class TEXT NOT NULL DEFAULT '',
    level INTEGER NOT NULL DEFAULT 1,
    hp_max INTEGER NOT NULL DEFAULT 10,
    hp_current INTEGER NOT NULL DEFAULT 10,
    ac INTEGER NOT NULL DEFAULT 10,
    str_score INTEGER NOT NULL DEFAULT 10,
    dex_score INTEGER NOT NULL DEFAULT 10,
    con_score INTEGER NOT NULL DEFAULT 10,
    int_score INTEGER NOT NULL DEFAULT 10,
    wis_score INTEGER NOT NULL DEFAULT 10,
    cha_score INTEGER NOT NULL DEFAULT 10,
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);
```

**Companion state machine transitions:**

Character select must happen *before* the player submits `PLAYER_JOIN` (which already contains character stats). The roster and mode are fetched via REST on session-code validation — not piggybacked on `PLAYER_TOKEN` after submit.

```
session-code-entry
  → REST GET /api/sessions/:code/info
    → { valid, campaignId, characterSelectMode, availableCharacters }

  Mode: roster-only
    → character-select screen (roster grid only, NO "Enter Manually" button)
    → "Play as [Name]" pre-fills join form → join-form → submit → lobby

  Mode: roster-and-manual
    → character-select screen (roster grid + "Enter Manually" button)
    → "Play as [Name]" pre-fills join form → join-form → submit → lobby
    → "Enter Manually" skips pre-fill → join-form → submit → lobby

  Mode: manual-only (default)
    → skip character-select entirely → join-form → submit → lobby
```

**Tasks:**
- [ ] C1: Migration `src/core/db/migrations/007_player_characters.sql`
- [ ] C2: `src/core/db/db.ts` — `getPlayerCharacters(campaignId)`, `createPlayerCharacter(data)`, `updatePlayerCharacter(id, data)`, `deletePlayerCharacter(id)`
- [ ] C3: `src/api/server.ts` — REST endpoints:
  - `GET /api/sessions/:code/info` → `{ valid: boolean, campaignId: string, characterSelectMode: 'roster-only' | 'roster-and-manual' | 'manual-only', availableCharacters: PlayerCharacterRecord[] }` — validates session code and returns character roster + mode (called before join form submission; no auth token required — session code is the credential). When mode is `manual-only`, `availableCharacters` is always `[]`.
  - `GET /api/campaigns/:id/characters` → character roster for campaign (DM-facing management)
  - `POST /api/campaigns/:id/characters` → create character
  - `PATCH /api/campaigns/:id/characters/:charId` → update
  - `DELETE /api/campaigns/:id/characters/:charId` → delete
- [ ] C4: Add `PlayerCharacterRecord` and `CharacterSelectMode` types to `shared/player-types.ts` — `CharacterSelectMode = 'roster-only' | 'roster-and-manual' | 'manual-only'`; `PlayerCharacterRecord` has typed first-class stat fields mirroring the DB columns (id, name, class, level, hpMax, hpCurrent, ac, strScore…chaScore, notes)
- [ ] C5: Companion join flow — companion `App.tsx` state machine routes based on `characterSelectMode` from the `/info` response:
  - On session-code entry: call `GET /api/sessions/:code/info` → get `characterSelectMode` + `availableCharacters`
  - If `mode === 'roster-only'`: transition to `character-select` screen showing roster grid only (no "Enter Manually" button). Player must pick a character.
  - If `mode === 'roster-and-manual'`: transition to `character-select` screen showing roster grid + "Enter Manually" button. Player can pick a character or enter their own.
  - If `mode === 'manual-only'` (default): skip `character-select` entirely → go straight to `join-form`
  - `src/companion/screens/character-select-screen.tsx` (NEW): grid of character cards (name, class, level, HP); "Play as [Name]" pre-fills the join-form state; "Enter Manually" button conditionally rendered (only when mode is `roster-and-manual`); "Back" returns to code-entry
  - After selection (or manual fallback): transition to `join-form` with pre-populated character state
  - On join-form submit: emit `PLAYER_JOIN` with full character stats as normal — no changes to the join handler
- [ ] C6: Cockpit: `src/ui/tabs/players/character-roster-panel.tsx` (NEW) — embedded in Campaign Home view or as a sub-section of the Players tab (visible when not in live session)
  - List of characters + "Add Character" inline form (name, class, level, HP, AC, ability scores)
  - Edit/delete inline actions
- [ ] C7: Tests: `player-characters.test.ts` (NEW) — DB CRUD round-trips; `GET /api/sessions/:code/info` returns roster; empty roster returns valid response with empty array

**No new socket events** — roster delivery is REST-only; `PLAYER_JOIN` payload is unchanged.

**Key files:**
| File | Action |
|---|---|
| `src/core/db/migrations/007_player_characters.sql` | NEW |
| `src/core/db/db.ts` | Add character CRUD |
| `shared/player-types.ts` | Add `PlayerCharacterRecord` |
| `src/api/server.ts` | 5 new REST routes (including `/sessions/:code/info`) |
| `src/companion/screens/character-select-screen.tsx` | NEW |
| `src/companion/App.tsx` | Insert `character-select` state into join flow state machine |
| `src/ui/tabs/players/character-roster-panel.tsx` | NEW |
| Tests | `player-characters.test.ts` (NEW) |

---

## Sprint 22 — Scene Save + Output Idle Screen (PLANNED)

**Why:** Sprint 20 was superseded by this sprint, which incorporates the full Sprint 20 spec (scene summary, save indicator, plan/play mode — see `planning/Overhaul/Scene Save/scene-save-spec.md`) and adds named saves, undo on scene load, and a polished AV idle screen. Together these make scene prep feel deliberate and the AV output feel finished at all times — even when no scene is loaded.

**Scope (3 phases):**
- [ ] **Phase 22a — Scene Summary + Save Indicator + Plan/Play Mode:** Full implementation of the Sprint 20 spec. Summary component in SceneCard, save indicator, Plan/Play editing gating.
- [ ] **Phase 22b — Named Saves + Undo on Load:** Snapshot table, DM can save/name/restore scene snapshots, auto-undo point created before every TAKE.
- [ ] **Phase 22c — AV Output Idle Screen:** PixiJS idle screen (logo glow + QR code + session code) shown on AV Display when no scene is loaded.

---

### Phase 22a — Scene Summary + Save Indicator + Plan/Play Mode

> This is the Sprint 20 spec in full. Refer to `planning/Overhaul/Scene Save/scene-save-spec.md` for detailed implementation notes. Summary of tasks:

**Tasks:**
- [ ] A1: `GET /api/scenes/:id/summary` endpoint in `src/api/server.ts` → `{ scene, npcs, notes, items }`
- [ ] A2: `src/ui/hooks/use-scene-summary.ts` (NEW) — lazy fetch hook, cached by sceneId
- [ ] A3: `src/ui/components/scene-summary.tsx` (NEW) — read-only grid: Media, Atmosphere, Fog, NPCs, Items, Notes, Branches sections. **Note:** Item status badges (hidden/loot/acquired) depend on the `status` column in `scene_items`, which doesn't exist yet (SMALL backlog item "Item States in Quick Reference"). The Items section must degrade gracefully — render item names without status badges if the column is absent, rather than failing.
- [ ] A4: `buildSceneSummaryMarkdown(summary)` pure function (in same file) — extracted for testability
- [ ] A5: Export buttons: "Copy Summary" (clipboard) + "Download .md" (Blob URL)
- [ ] A6: Wire `<SceneSummary>` into `src/ui/components/scene-card.tsx` — first thing rendered when card expands
- [ ] A7: CSS — `.scene-summary`, `.scene-summary__section`, `.scene-summary__label`, `.scene-summary__value`, `.scene-summary__badge`, `.scene-summary__actions` in `src/ui/index.css`
- [ ] A8: `lastSavedAt: number | null` + `setLastSavedAt(ts)` in `src/ui/stores/scene-store.ts`; resets to `null` on active scene change
- [ ] A9: `persistToScene()` in `src/ui/lib/sync/connection.ts` — call `setLastSavedAt(Date.now())` on successful PATCH resolve
- [ ] A10: "Saved" badge on `scene-card.tsx` — appears when `lastSavedAt` changes, fades out over 2s via `save-flash` keyframe
- [ ] A11: Plan/Play gating — `appMode === 'play'` read from `useAppStore` in: `scene-card.tsx` (hide media pickers, branch add/remove, note link/unlink), `ScenesTab.tsx` (hide + New Scene), `scene-timeline.tsx` (`draggable={!isPlayMode}`), `bg-settings-zone.tsx` + `gb-settings-zone.tsx` (hide media browse buttons)
- [ ] A12: `ModeToggle.tsx` — add mode description subtitles: "Full editing" under Prep, "Session mode" under Play
- [ ] A13: Tests: `use-scene-summary.test.ts`, `scene-summary.test.ts` (markdown output), extend `scene-store.test.ts` (lastSavedAt transitions)

**Key files:** See `planning/Overhaul/Scene Save/scene-save-spec.md` — Files Summary table.

---

### Phase 22b — Named Saves + Undo on Load

**Goal:** DM can save named snapshots of scene state at any point (e.g., "Before final boss reveal"). Every TAKE automatically creates an undo point. An "Undo" button appears for 15 seconds after a TAKE.

**DB migration `008_scene_snapshots.sql`:**
```sql
CREATE TABLE IF NOT EXISTS scene_snapshots (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    name TEXT NOT NULL,
    snapshot_data TEXT NOT NULL,   -- full Scene record serialized as JSON
    created_at INTEGER NOT NULL,
    is_auto INTEGER NOT NULL DEFAULT 0,  -- 1 = auto undo point, 0 = named save
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);
CREATE INDEX idx_snapshots_scene ON scene_snapshots(scene_id, created_at DESC);
```

**Tasks:**
- [ ] B1: Migration `src/core/db/migrations/008_scene_snapshots.sql`
- [ ] B2: `src/core/db/db.ts` — `createSnapshot(sceneId, campaignId, name, snapshotData, isAuto)`, `getSnapshots(sceneId)` (named only, ordered newest-first), `deleteSnapshot(id)`, `restoreSnapshot(id)` (deserializes `snapshot_data` → `PATCH /api/scenes/:id` — **AV/atmosphere fields only**: `backgroundPath`, `backgroundAssetId`, `gameboardPath`, `gameboardAssetId`, `particles`, `colorGrade`, `gbColorGrade`, `audioMood`, `fogEnabled`, `fogData`, `overlays`, `notes`, `scratchpad`; structural fields `id`, `sortOrder`, `nextSceneId`, `branches`, `campaignId` are never overwritten), `pruneAutoSnapshots(sceneId, keepCount = 5)` (trims old auto-snapshots)
- [ ] B3: REST endpoints in `src/api/server.ts`:
  - `GET /api/scenes/:id/snapshots` → named snapshots list
  - `POST /api/scenes/:id/snapshots` → create named save `{ name }` → `201 { snapshot }`
  - `DELETE /api/scenes/snapshots/:snapshotId` → delete
  - `POST /api/scenes/snapshots/:snapshotId/restore` → apply snapshot data back to scene → emit `SCENE_SNAPSHOT_RESTORED` to cockpit room
- [ ] B4: `src/ui/hooks/use-snapshots.ts` (NEW) — fetch + mutate hook; returns `{ snapshots, saving, createSnapshot, deleteSnapshot, restoreSnapshot }`
- [ ] B5: "Save Snapshot" button in `scene-card.tsx` (Plan mode only, appears in action row) — inline name input (defaults to "Snapshot — [date/time]"); calls `createSnapshot`
- [ ] B6: Snapshots list panel below summary in expanded SceneCard — shows named saves with timestamp and "Restore" button; empty state: "No named saves yet"
- [ ] B7: Auto-undo point on TAKE — triggered in the TAKE button `onClick` handler in `src/ui/tabs/dashboard/transport-bar.tsx`, *before* calling `takeScene(scenes)`. **Not inside `takeScene()` itself** — Zustand actions are pure state mutations and must not make REST calls. Sequence: onClick → `POST /api/scenes/:id/snapshots` (isAuto, name `"Auto — before TAKE"`) → on success, store returned `snapshotId` via `setLastUndoSnapshotId`, call `pruneAutoSnapshots` (auto-snapshots only, keep last 5) → then call `takeScene(scenes)`.
- [ ] B8: Undo state in scene-store: `lastUndoSnapshotId: string | null` + `setLastUndoSnapshotId(id: string | null)`; cleared after 15s via `setTimeout` in the same TransportBar handler that set it
- [ ] B9: "Undo" button in `src/ui/tabs/dashboard/transport-bar.tsx` — visible only when `lastUndoSnapshotId !== null`; calls `restoreSnapshot(lastUndoSnapshotId)` then clears state; disappears after 15s or when clicked
- [ ] B10: Socket event `SCENE_SNAPSHOT_RESTORED` → server emits to cockpit room after restore → cockpit refreshes active scene via `refetchScene()`
- [ ] B11: Tests: `snapshot-crud.test.ts` (NEW) — create/list/delete/restore round-trips; scene-store undo timeout; prune logic

**New socket events:**
```typescript
SCENE_SNAPSHOT_RESTORED: 'scene:snapshotRestored'  // Server → Cockpit: { sceneId } — cockpit should re-fetch scene
```

**Key files:**
| File | Action |
|---|---|
| `src/core/db/migrations/008_scene_snapshots.sql` | NEW |
| `src/core/db/db.ts` | Add snapshot CRUD + prune |
| `src/api/server.ts` | 4 new REST routes |
| `shared/socket-events.ts` | Add `SCENE_SNAPSHOT_RESTORED` |
| `src/ui/hooks/use-snapshots.ts` | NEW |
| `src/ui/components/scene-card.tsx` | Save Snapshot button + snapshots list panel |
| `src/ui/stores/scene-store.ts` | Add `lastUndoSnapshotId`, `setLastUndoSnapshotId` |
| `src/ui/tabs/dashboard/transport-bar.tsx` | TAKE onClick triggers auto-snapshot + undo button with 15s window |
| Tests | `snapshot-crud.test.ts` (NEW) |

---

### Phase 22c — AV Output Idle Screen

**Goal:** When no scene is loaded on the AV Display, show a polished idle screen rather than a black frame. The idle screen displays a glowing logo animation, the player join QR code, and the session code — so the AV output is always presentable between scenes.

**Design decisions:**
- **Not a LayerStack layer.** The LayerStack adds named containers directly to `app.stage` via `addChild`. Inserting an idle layer inside the stack would require renumbering all 8 existing layers. Instead, `IdleScreen` owns its own `PIXI.Container` and is added to `app.stage` as a sibling *before* `LayerStack` is initialized: `app.stage.addChildAt(idleContainer, 0)`. Since the LayerStack containers are added afterward, they automatically render on top. **No changes to `layer-stack.ts` required.**
- Reuses existing `SESSION_QR_OVERLAY` event infrastructure (already built in Sprint 11) to deliver QR data to AV Display.
- Logo animation: PixiJS Graphics (no new dependencies — simple pulsing glow ring using sinusoidal alpha on RAF). Placeholder until branding is finalized.
- Idle screen hides immediately on `SCENE_LOAD` / `STATE_SYNC` with a loaded scene; re-shows on `SESSION_ENDED` or if `STATE_SYNC` contains no active scene.

**Tasks:**
- [ ] C1: `src/systems/av/idle-screen.ts` (NEW) — `IdleScreen` class
  - `constructor(app: PIXI.Application)` — creates its own `PIXI.Container`, calls `app.stage.addChildAt(this.container, 0)` during construction so it renders behind all LayerStack layers
  - `show(qrDataUrl: string | null, sessionCode: string | null)` — makes container visible; starts RAF glow loop; renders QR sprite + session code `PIXI.Text` centered below logo; QR hidden if `qrDataUrl` is null
  - `hide()` — sets `container.visible = false`; cancels RAF
  - `destroy()` — removes container from stage; cancels RAF; cleanup
  - Logo: `PIXI.Graphics` circle/ring with pulsing alpha (0.4–1.0 over 3s sinusoidal) + centered "STAGE MANAGER" `PIXI.Text` in brand font
  - QR: `fetch(qrDataUrl)` → `Image` → `PIXI.Texture` (use existing extensionless URL load pattern from Pitfall #10)
- [ ] C2: AV Display `src/systems/av/main.tsx` — instantiate `IdleScreen` **before** `new LayerStack(app)` so idle container sits at stage child index 0; call `idleScreen.show(qrDataUrl, sessionCode)` on startup
- [ ] C3: AV Display — handle `STATE_SYNC`: the existing handler casts to `{ activeSceneId?: string | null }` — check `!state.activeSceneId` → `idleScreen.show(...)`; if `state.activeSceneId` present → `idleScreen.hide()`. *(Field is `activeSceneId`, not `sceneId` — confirmed in existing `main.tsx:355`.)*
- [ ] C4: AV Display — handle `SCENE_LOAD` → `idleScreen.hide()`; handle `SESSION_ENDED` → `idleScreen.show(...)`
- [ ] C5: AV Display — handle `SESSION_QR_OVERLAY` (already wired in Sprint 11): if idle screen visible, call `idleScreen.show(payload.qrDataUrl, payload.sessionCode)` to update QR in place
- [ ] C6: `electron/main.ts` — after Express is ready and session code is generated, emit `SESSION_QR_OVERLAY` with QR data to `av-display` room so idle screen shows on first AV window open
- [ ] C7: Tests: `idle-screen.test.ts` (NEW) — show/hide lifecycle with mock PixiJS Application and Container; verify `addChildAt(container, 0)` called on construction; no RAF leaks on destroy

**Key files:**
| File | Action |
|---|---|
| `src/systems/av/idle-screen.ts` | NEW — owns its own PIXI.Container, inserted at stage index 0 |
| `src/systems/av/main.tsx` | Instantiate IdleScreen before LayerStack; wire socket handlers |
| `electron/main.ts` | Emit QR data on server ready |
| `shared/socket-events.ts` | No new events — reuses `SESSION_QR_OVERLAY` |
| Tests | `idle-screen.test.ts` (NEW) |

---

## Sprint 23 — Global Settings Page (PLANNED)

**Why:** Configuration is scattered — display assignment lives in the AV toolbar, volume defaults aren't persisted, audio output device can't be changed, and there's no way to adjust theme or density. A dedicated Settings tab consolidates all of this, reduces cognitive load during sessions, and unlocks accessibility improvements (audio device routing for players with hearing setups, density for small tablets).

**Scope (3 phases):**
- [ ] **Phase 23a — Settings Page + Audio Device Selection:** New `SettingsTab`, `settings-store` (localStorage-backed, `zustand persist`), audio output device enumeration and `HTMLVideoElement.setSinkId()` routing for video elements.
- [ ] **Phase 23b — Display Assignment + Volume Persistence:** Extract `DisplayAssignmentPanel` to Settings; persist volume defaults; companion lobby config settings.
- [ ] **Phase 23c — Theme Toggle + Export/Import Prefs:** Light/dark theme toggle, density toggle, export settings to JSON, import from JSON.

---

### Phase 23a — Settings Page + Audio Device Selection

**Goal:** New Settings tab visible in the cockpit TabBar. Audio output device selection via `HTMLMediaElement.setSinkId()` scoped to video elements. All settings stored in `localStorage` so they survive app restarts without a DB migration.

**Tasks:**
- [ ] A1: `src/ui/stores/settings-store.ts` (NEW) — Zustand store with `localStorage` persistence via `zustand/middleware` `persist`. **Note:** No existing store uses the `persist` middleware — this is a new pattern in the codebase. Use storage key `'stage-manager-settings'` and include a `version: 1` field in the persisted state for future migration compatibility (zustand `persist` supports a `migrate` option). Ensure the store hydrates synchronously on mount so settings are available before `initSync()` fires.
  ```typescript
  interface SettingsState {
      audioOutputDeviceId: string           // '' = system default
      masterVolumeDefault: number           // 0.0–1.0, default 0.8
      musicVolumeDefault: number
      sfxVolumeDefault: number
      bgVideoVolumeDefault: number
      gbVideoVolumeDefault: number
  }
  ```
- [ ] A2: `src/systems/audio/audio-device-manager.ts` (NEW) — `AudioDeviceManager` singleton:
  - `enumerateOutputDevices()` → `Promise<MediaDeviceInfo[]>` (filters `audiooutput`, calls `navigator.mediaDevices.enumerateDevices()`)
  - `setOutputDevice(deviceId: string)` → calls `setSinkId(deviceId)` on **`HTMLVideoElement` instances only** (BG and GB video elements in the AV Display). This covers the most impactful routing path with a well-supported API.
  - **Out of scope for 23a:** `AudioContext.setSinkId()` (Chrome 110+ only, separate API) for the SFX soundboard and Tone.js mood engine AudioContexts — add to backlog as a follow-up item once `HTMLVideoElement` routing is validated.
  - Must handle browsers without `setSinkId` support gracefully (log warning, no throw)
- [ ] A3: `src/ui/tabs/SettingsTab.tsx` (NEW) — full-page settings layout:
  - Section headers (styled like existing tab section headers): "Audio", "Volumes", "Display" (placeholder for 23b), "Companion" (placeholder for 23b), "Appearance" (placeholder for 23c), "Data" (placeholder for 23c)
  - Audio section: `<DeviceSelector>` component + "Refresh Devices" button
  - Volumes section: six labeled sliders (Master, Music, SFX, BG Video, GB Video, Ambience) that set `settings-store` defaults
- [ ] A4: `src/ui/tabs/settings/device-selector.tsx` (NEW) — `<select className="form-select">` populated from `enumerateOutputDevices()`; "System Default" as first option (empty string value); calls `AudioDeviceManager.setOutputDevice` on change; handles permission denial gracefully
- [ ] A5: Add "Settings" entry to TabBar in `src/ui/App.tsx` (or `src/ui/components/TabBar.tsx`) — gear icon, last tab, always visible
- [ ] A6: CSS — settings tab layout: `src/ui/index.css` — `.settings-tab`, `.settings-section`, `.settings-section__title`, `.settings-row`, `.settings-row__label`, `.settings-row__control`
- [ ] A7: Tests: `settings-store.test.ts` (NEW) — default values, persist/hydrate cycle; `audio-device-manager.test.ts` (NEW) — mock `navigator.mediaDevices`, test `setSinkId` call, test graceful degradation

**Key files:**
| File | Action |
|---|---|
| `src/ui/stores/settings-store.ts` | NEW |
| `src/systems/audio/audio-device-manager.ts` | NEW |
| `src/ui/tabs/SettingsTab.tsx` | NEW |
| `src/ui/tabs/settings/device-selector.tsx` | NEW |
| `src/ui/App.tsx` | Add Settings tab to TabBar |
| `src/ui/index.css` | Settings layout styles |
| Tests | `settings-store.test.ts`, `audio-device-manager.test.ts` (NEW) |

---

### Phase 23b — Display Assignment + Volume Persistence

**Goal:** Extract display assignment from the AV toolbar into a richer Settings panel. Apply volume defaults from settings store when a session starts. Add companion lobby configuration to Settings.

**Tasks:**
- [ ] B1: `src/ui/tabs/settings/display-assignment-panel.tsx` (NEW) — full-detail display assignment:
  - Shows all connected displays with name, resolution, refresh rate (from `output-store.ts` `DisplayInfo`)
  - Assigns BG / GB roles via dropdown per display (same logic as compact av-toolbar, richer labeling)
  - "Open BG Output" / "Open GB Output" buttons (windowed pop-out option)
  - "No display connected" empty state with instructions
- [ ] B2: `src/ui/tabs/av/av-toolbar.tsx` — keep compact status-dot + quick-assign variant; add "Configure in Settings →" link that switches active tab to Settings
- [ ] B3: Volume defaults application: in `src/ui/lib/sync.ts` `initSync()` function — after socket connects (i.e., `hasLaunched = true`), read `settingsStore.{x}VolumeDefault` values and emit the corresponding volume socket events (`MASTER_VOLUME`, `MUSIC_VOLUME`, etc.) to initialize server state from saved defaults
- [ ] B4: `src/ui/tabs/settings/companion-settings-panel.tsx` (NEW):
  - **Character select mode:** 3-option segmented control — `roster-only` ("Pre-built only — players must pick from your roster"), `roster-and-manual` ("Roster + custom — players can pick or enter their own"), `manual-only` ("Manual entry only — players enter their own stats"). Default: `manual-only`. Stored in settings-store as `characterSelectMode`.
  - Max players: number input (1–8, default 8) → stored in settings-store
  - Lobby approval mode: toggle "Auto-approve" vs "Manual approval" → stored in settings-store
  - Require ready check: checkbox → stored in settings-store
  - Session code display length: number input (4–8 chars, default 6) → stored in settings-store
- [ ] B5: Wire companion settings to server: on `SESSION_GO_LIVE`, include `lobbyConfig` from settings-store in payload (including `characterSelectMode`); `player-handlers.ts` respects `maxPlayers` cap on `PLAYER_JOIN`; `GET /api/sessions/:code/info` reads `characterSelectMode` from session config to send to companion
- [ ] B6: Extend `settings-store.ts` with companion settings fields including `characterSelectMode: 'roster-only' | 'roster-and-manual' | 'manual-only'` (default: `'manual-only'`)
- [ ] B7: Tests: `display-assignment-panel.test.ts` — output store subscription, role assignment call; extend `settings-store.test.ts` — companion settings fields

**Key files:**
| File | Action |
|---|---|
| `src/ui/tabs/settings/display-assignment-panel.tsx` | NEW |
| `src/ui/tabs/settings/companion-settings-panel.tsx` | NEW |
| `src/ui/tabs/SettingsTab.tsx` | Wire in new panels |
| `src/ui/tabs/av/av-toolbar.tsx` | Add "Configure in Settings →" link |
| `src/ui/lib/sync.ts` | Apply volume defaults on `initSync` |
| `src/api/player-handlers.ts` | Respect `maxPlayers` from session config |
| `src/ui/stores/settings-store.ts` | Add companion config fields |

---

### Phase 23c — Theme Toggle + Export/Import Prefs

**Goal:** Light theme (parchment-warm daytime feel) togglable at runtime. Density toggle (comfortable vs compact) adjusts spacing tokens. Export all settings to a JSON file; import from that file to restore preferences on a new machine.

**Design decisions:**
- Theme switching: `document.documentElement.setAttribute('data-theme', 'light' | 'dark')`. CSS `[data-theme="light"]` overrides all `--color-*` tokens in `shared/design-tokens.css`. This works for both cockpit and companion (both import shared tokens).
- Light theme palette: warm parchment character — `--color-bg-primary: #f5f0e8`, `--color-text-primary: #1a1510`, `--color-surface: #ede8de`, `--color-border: #c8bfa8`. Gold accents unchanged — they read in both themes. Design should feel like ink-on-parchment, not a generic light mode.
- Density: `[data-density="compact"]` reduces `--spacing-*` tokens by ~25%. Two options only (comfortable = default, compact = smaller targets for tablet use).
- Export/import: round-trip JSON (`{ version: 1, settings: SettingsState, theme, density }`). Version field required for future migration compatibility.

**Tasks:**
- [ ] C1: `shared/design-tokens.css` — add `[data-theme="light"]` override block covering all `--color-*` custom properties with the warm parchment palette; add `[data-density="compact"]` block reducing `--spacing-xs` through `--spacing-xl` by 25%
- [ ] C2: `src/ui/tabs/settings/theme-toggle.tsx` (NEW) — two-button toggle: "Dark" (default) / "Light"; sets `document.documentElement.setAttribute('data-theme', ...)` + writes to `localStorage('theme')`; also reads `localStorage` on mount to restore saved theme
- [ ] C3: `src/ui/tabs/settings/density-toggle.tsx` (NEW) — two-button toggle: "Comfortable" / "Compact"; sets `data-density` attribute + writes to `localStorage('density')`
- [ ] C4: `src/ui/App.tsx` — on mount, read `localStorage('theme')` and `localStorage('density')` and apply to `document.documentElement` before first render (prevents flash-of-wrong-theme)
- [ ] C5: Export: "Export Settings" button in SettingsTab → serializes `useSettingsStore.getState()` + theme + density + version field → `new Blob([JSON.stringify(...)])` → `<a download="stage-manager-settings.json">` click trigger
- [ ] C6: Import: file input (`.json` accept) → `FileReader` → validate schema (check `version` field, check known keys) → `useSettingsStore.setState(...)` → apply theme/density to DOM → show "Settings imported" toast
- [ ] C7: Schema validation helper `validateSettingsExport(data: unknown): SettingsExport | null` (in `settings-store.ts`) — returns `null` on invalid shape; never throws
- [ ] C8: Tests: **No jsdom** — consistent with project test conventions (node env, no DOM rendering). `theme-toggle.test.ts` should test `localStorage` read/write logic only (not `document.documentElement` attribute mutations — those require jsdom). `settings-store.test.ts` — export round-trip JSON serialization, `validateSettingsExport` with valid payload, `validateSettingsExport` with invalid/missing fields returns `null`.

**New types (`src/ui/stores/settings-store.ts`):**
```typescript
interface SettingsExport {
    version: 1
    theme: 'dark' | 'light'
    density: 'comfortable' | 'compact'
    settings: SettingsState
}
```

**Key files:**
| File | Action |
|---|---|
| `shared/design-tokens.css` | `[data-theme="light"]` + `[data-density="compact"]` blocks |
| `src/ui/tabs/settings/theme-toggle.tsx` | NEW |
| `src/ui/tabs/settings/density-toggle.tsx` | NEW |
| `src/ui/tabs/SettingsTab.tsx` | Wire in toggles + export/import buttons |
| `src/ui/App.tsx` | Apply saved theme/density on mount |
| `src/ui/stores/settings-store.ts` | `validateSettingsExport`, `SettingsExport` type |
| Tests | `theme-toggle.test.ts`, extend `settings-store.test.ts` |

---

## Audit Results (Sprint 17 Planning)

| Category | Finding | Status |
|----------|---------|--------|
| `!important` in CSS | 0 in source | CLEAN |
| `console.log` in production code | 0 (only in stubs/dev panel) | CLEAN |
| TODO/FIXME comments | 1 (branding placeholder) | ACKNOWLEDGED |
| Orphaned files | 3 AV tab files | DELETED in 17a |
| `inputStyle` objects | 1 (campaign-selector) | MIGRATED in 17a |
| Inline `style={{}}` | 59 -> 11 (all remaining dynamic) | TRIAGED in 17a |
| Error boundaries | 0 -> 1 | ADDED in 17a |
| Skip intro preference | Not implemented | ADDED in 17a |
