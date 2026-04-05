# Sprint History & Active Sprints

> Single source of truth for all sprint work. Updated after every sprint completion.
> For backlog items not yet in active development, see `Backlog.md`.

**Current test count: 879 tests passing across 50 test files.**

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
| 20 | Scene Save + Summary + Plan/Play Mode | PLANNED | — |
| 21a | Player → DM Messaging + Bidirectional Whisper | COMPLETE | 867 |
| 21b | DM Roll Prompt System | COMPLETE | 867 |
| 21c | Character Select from Campaign DB | COMPLETE | 879 |

---

## Sprint 21 — Player Companion v2: Two-Way Comms (COMPLETE)

**879 tests (43 new across 3 test files)**

**21a — Player → DM Messaging + Bidirectional Whisper:**
- `PLAYER_SEND_MESSAGE` / `DM_PLAYER_MESSAGE` — player sends message to DM; stored on player state
- `DM_REPLY_TO_PLAYER` / `PLAYER_DM_REPLY` — DM replies to specific player thread
- `PLAYER_RAISE_HAND` / `DM_HAND_UPDATE` — hand raise/lower with cockpit notification
- `PlayerMessage` type with `fromDM` flag; messages persisted in session state
- `player-card.tsx` updated: message thread + reply input + hand raise indicator
- Companion dashboard: message thread panel + raise hand button
- **867 tests**

**21b — DM Roll Prompt System:**
- 6 new socket events: ROLL_PROMPT_SEND, PLAYER_ROLL_PROMPT, ROLL_RESULT_SUBMIT, DM_ROLL_RESULT, ROLL_PROMPT_CANCEL, ROLL_PROMPT_ACTIVE
- `RollPrompt` + `RollResult` types in shared/player-types.ts
- Server: `rollPrompts` on SessionState, countdown clamp, targeting, cancel + cleanup
- `RollPromptOverlay` (companion): full-screen modal, countdown timer, one-tap roll, auto-dismiss with `useRef` cleanup
- `RollPromptPanel` (cockpit): die selector, quick labels, countdown, per-player targets, live results with crit/fumble
- Player store: `rollResults[]` + `activePromptId` (clears results on new prompt)
- **867 tests**

**21c — Character Select from Campaign DB:**
- Migration 010: `player_characters` table (campaign-scoped, class/level/maxHp/ac/abilities JSON)
- DB functions: `getPlayerCharacters`, `createPlayerCharacter`, `deletePlayerCharacter`
- REST: `GET/POST/DELETE /api/campaigns/:id/characters`, `GET /api/sessions/:code/info`
- Socket: `SESSION_SET_CHAR_MODE` (validates + echoes), `SESSION_CHAR_MODE` (store update)
- 3 modes: `manual-only` | `roster-and-manual` | `roster-only`
- Companion join screen: fetches session info on code entry, roster picker with AbortController for race protection
- `CharacterRosterPanel` (cockpit): mode selector buttons, roster list with delete, add form
- CSS fix: replaced undefined tokens (--bg-secondary etc.) with canonical design system tokens
- **879 tests**

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

### Sprint 20 — Scene Save System + Summary + Plan/Play Mode (PLANNED)

**Why:** Scene state auto-persists silently. DMs have no summary view, no save feedback, and Plan/Play modes are functionally identical. This sprint makes scene prep feel robust and deliberate.

**Scope (3 phases):**
- [ ] **Phase A — Scene Summary:** `GET /api/scenes/:id/summary` endpoint, `SceneSummary` component (always visible in expanded SceneCard), Markdown export (clipboard + .md download)
- [ ] **Phase B — Save Indicator:** `lastSavedAt` in scene store, `persistToScene` emits save signal, "Saved" badge with fade animation on SceneCard
- [ ] **Phase C — Plan/Play Mode:** Soft-disable editing in Play mode (media, branches, note linking, scene creation, drag reorder). Scratchpad + atmosphere controls stay editable. `.plan-only` CSS approach.

**Key files:** `scene-card.tsx`, `server.ts`, `connection.ts`, `scene-store.ts`, `ModeToggle.tsx`, `ScenesTab.tsx`

**Full technical spec:** `planning/Overhaul/Scene Save/scene-save-spec.md`

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
