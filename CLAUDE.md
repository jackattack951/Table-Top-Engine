# TTRPG Stage Manager — Claude Code Project Instructions

## Project Status

**Sprints 0–23 Complete + 17c Blocked** — 954 tests passing (56 test files). Player Companion MVP done. Notes system Phase 1 done. Sprint 18 (Program/Preview + Crossfade + Sliders) complete. Sprint 19 (PDF Import + Parser Enhancement) complete. Sprint 20 (Scene Save + Summary + Plan/Play Mode) complete. Sprint 21 (Player Companion v2: Two-Way Comms) complete. Sprint 22 (Scene Summary + Save Indicator + Plan/Play Mode + AV Idle Screen) complete. Sprint 23 (Settings Tab + Theme/Density Toggles + Audio Device Manager) complete. Sprint 17c (ambient audio) blocked on OGG audio files. Sprint 17e (demo tokens + packaging) follows 17c. CampaignSelector removed — superseded by launch screen campaign selection. See `planning/Sprints.md` for full sprint history and `planning/Backlog.md` for the feature backlog.

## Project Overview

Electron desktop application: a DM cockpit and theatrical atmosphere engine for in-person TTRPG sessions. See `Project.md` for the full specification.

**Core architecture:** Single Electron app that renders AV output (PixiJS, WebCodecs, Web Audio API) to a second monitor and hosts a web UI cockpit on the LAN for device-agnostic DM control.

---

## Starting a New Session

At the start of every conversation, before the user gives a task:

1. **Pull latest changes:** Run `git pull` to sync with the remote repo before doing anything else.
2. **CLAUDE.md + MEMORY.md** load automatically — review them for current project state.
3. **Read `planning/Sprints.md`** for active/blocked sprints and `planning/Backlog.md` for pending features.
4. **Ask the user** what they want to work on. Don't assume.

---

## Workflow

There are three levels of work, each with a defined flow. Follow them in order.

### Level 1: Task (every individual unit of work)

1. **Read before writing.** Read relevant files. Check `Project.md` for architectural context.
2. **Implement.** Write code following all conventions in this file.
3. **Test.** `npx vitest run` must pass.
4. **Simplify.** Invoke the `simplify` skill to review changed code for reuse, quality, and efficiency. It fixes issues automatically.
5. **Test again** if simplify made changes.
6. **Summarize.** List files modified, tests added, follow-up items.

### Level 2: Phase (each sub-sprint in a multi-phase sprint)

Phases are sub-sprints (e.g., 16a, 16b, 16c) broken out during the complexity check.

1. **Complete all tasks** in the phase using the Level 1 flow above.
2. **Invoke the reviewer agent:**
   ```
   Use the stage-manager-reviewer agent to review phase [X]
   ```
   The reviewer (`.claude/agents/stage-manager-reviewer.md`) audits changed files against architecture rules, CSS design system, test coverage, and code quality. It produces a report: passed items, issues (bug/violation/gap), and next steps. **It does not fix issues** — the user decides what to address.
3. **Fix** any issues the reviewer flagged.
4. **Test.** `npx vitest run` must pass after fixes.
5. **Check-in** with the user. Get approval before proceeding to the next phase.

### Level 3: Sprint (full sprint completion, e.g., all of Sprint 16)

1. **All phases complete** and passing.
2. **Post-Sprint UI Gate** (if UI was touched):
   - No new hardcoded colors in CSS or TSX
   - No new `!important` rules
   - New form inputs use `.form-input` / `.form-select`
   - All `style={}` props reference `var(--token)` values (not raw values)
   - No new `inputStyle` or similar inline style objects
3. **Invoke `revise-claude-md`** to capture learnings from the sprint into CLAUDE.md.
4. **Update `planning/Sprints.md`** — add completion summary, check off items, update test count.
5. **Summarize** the full sprint to the user: what was built, test count, any backlog items generated.

### Task Type Variations

The Level 1 flow is the default. These task types modify it:

| Task Type | Modifications to Level 1 |
|---|---|
| **New feature / sprint work** | Full flow. If UI involved, invoke `frontend-design` before step 2 (implement). |
| **Bug fix** | Full flow. Skip `frontend-design` unless the fix is visual. |
| **UI work** | Invoke `frontend-design` BEFORE step 2. Full flow otherwise. |
| **Doc updates / housekeeping** | Steps 1–2 only. Skip `simplify` — no code changed. |
| **Code review (on request)** | Invoke reviewer agent directly. Not a task flow. |

### Sprint Complexity Check — Required Before Implementation

Before starting any sprint or major feature:

1. **Read the sprint scope** in `planning/Sprints.md` and any related docs in `planning/Overhaul/`
2. **Assess complexity** — count distinct subsystems touched, new files needed, cross-cutting concerns
3. **If complex (>3 subsystems or >10 new/modified files):** Break into sub-sprints (a, b, c...) with clear phase boundaries. Present the breakdown to the user before writing code.
4. **Single-phase sprints** skip Level 2 — go directly from Level 1 tasks to Level 3 sprint completion.

## Skills — When to Invoke

| Skill | Trigger | Automatic? |
|---|---|---|
| `simplify` | After every task (Level 1, step 4) | **Yes** — always run after writing/modifying code |
| `frontend-design` | Any UI work: new components, screens, tabs, visual changes | **Yes** — invoke before starting UI implementation |
| `revise-claude-md` | After full sprint completion (Level 3, step 3) | **Yes** — always run at sprint end |

**`frontend-design`** (at `Skills/skills/skills/frontend-design/SKILL.md`): Read and follow its guidelines for distinctive, production-grade design that avoids generic AI aesthetics. Invoke at the START of UI work, not after — it informs design decisions.

**`simplify`**: Invoke at the END of each task. It reviews changed code for reuse, clarity, and efficiency, then applies fixes automatically. Re-run tests after.

**`revise-claude-md`**: Invoke once per full sprint. Captures patterns, pitfalls, and conventions discovered during the sprint into CLAUDE.md for future sessions.

---

## Development Strategy — UI in Browser, Backend in Electron

The cockpit UI (React) is developed and iterated **directly in the browser** via Vite dev server (`localhost:5180`). Electron is present from day one for all backend and AV concerns.

| Layer | Dev Environment | Why |
|---|---|---|
| Cockpit React UI (tabs, combat, scene, notes) | **Browser** (Vite dev server) | Fast visual iteration, hot reload, no Electron overhead |
| Express + WebSocket server | **Electron main process** | Runs in Node.js context, cannot be deferred |
| SQLite (better-sqlite3) | **Electron main process** | Native C++ module — must compile against Electron Node headers |
| AV Display renderer (PixiJS, WebCodecs) | **Electron renderer** (BrowserWindow) | WebCodecs is Chromium-only; second monitor requires Electron window management |
| IPC bridge (main ↔ renderer) | **Electron** | Core to architecture, must be real from Sprint 0 |

**Rule:** When building cockpit UI components, target the Vite browser dev server first (`npm run dev:cockpit`). Use the WebSocket stub (`src/ui/lib/ws-stub.ts`) to simulate server responses. When building anything that touches the file system, SQLite, IPC, or AV rendering — always work inside Electron.

### Dev Server Ports

| Port | Service | Notes |
|---|---|---|
| **8080** | Express + Socket.io server | Hardcoded in `electron/main.ts`, serves built cockpit + companion + REST API |
| **5180** | Cockpit Vite dev server | `strictPort: true` — standalone browser dev with ws-stub |
| **5181** | Companion Vite dev server | `strictPort: true`, `host: true`. Mobile UI dev with companion-ws-stub |
| **5174** | AV Display Vite | electron-vite renderer |

### npm Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Builds cockpit + companion → starts Electron + Vite concurrently. Full experience. |
| `npm run dev:cockpit` | Standalone browser dev at `localhost:5180` (ws-stub, no Electron). Fast UI iteration. |
| `npm run dev:companion` | Standalone companion dev at `localhost:5181` (companion-ws-stub). Mobile UI iteration. |
| `npm run dev:electron` | Electron only — requires cockpit + companion already built. |
| `npm run build:cockpit` | Builds cockpit to `out/cockpit/` (used by Express in both dev and production). |
| `npm run build:companion` | Builds companion to `out/companion/` (served by Express at `/companion/*`). |

### Startup Sequence (dev mode)

1. `npm run build:cockpit` compiles cockpit UI to `out/cockpit/` (with `__COCKPIT_BROWSER_DEV__: false`)
2. `npm run build:companion` compiles companion UI to `out/companion/` (with `__COMPANION_BROWSER_DEV__: false`)
3. `electron-vite dev` starts → Electron main process boots → Express server starts on port 8080
4. Cockpit BrowserWindow loads `http://localhost:8080` → gets built cockpit → connects to real Socket.io
5. `vite dev:cockpit` starts on port 5180 (for standalone browser hot-reload development)
6. `vite dev:companion` starts on port 5181 (for standalone companion mobile dev)

**Key invariant:** The Express server is always ready before the cockpit window opens. No race conditions. **NEVER redirect from Express to Vite dev server** — serve built files instead.

### Browser Dev Detection

`IS_BROWSER_DEV` in `src/ui/lib/sync.ts` uses two checks:
1. `__COCKPIT_BROWSER_DEV__` compile-time flag (set by `vite.cockpit.config.ts` in `serve` mode only, NOT in `build` mode)
2. `!('electronAPI' in window)` — runtime check for the Electron preload API

Both must be true for browser dev mode. This ensures: standalone browser dev uses ws-stub, Electron always uses real Socket.io, LAN clients use real Socket.io.

---

## Tech Stack

- **Runtime:** Electron (main process: Node.js, renderer: Chromium)
- **Frontend:** React + TypeScript (custom CSS design system — no Tailwind, no CSS-in-JS)
- **Rendering:** PixiJS (WebGL), WebCodecs API, GLSL shaders
- **Audio (Mood Engine):** Tone.js — permitted **only** in `/src/systems/audio/` for downbeat-accurate stem scheduling
- **Audio (Video):** Web Audio API / HTMLVideoElement natively. No Tone.js.
- **Audio (SFX Soundboard):** Web Audio API — every clip routes through a `PannerNode` for spatial audio. `spatial?: { x, y }` normalized 0–1. Listener fixed at room center.
- **Database:** SQLite via better-sqlite3
- **API:** Express + Socket.io — named events from `shared/socket-events.ts`, rooms (`av-display`, `cockpit`, `player`)
- **State:** Zustand — one store per domain. Central `src/ui/lib/sync.ts` subscribes to stores and broadcasts via WebSocket. Components never touch WebSocket directly.

---

## Project Structure

```
/src
  /core            — campaign data, state management, data models, DB
  /systems         — combat, audio, av, import, mood engine
  /ui              — components, screens, tabs (cockpit UI)
  /companion       — player companion app (separate Vite build)
  /reference       — bundled 5e SRD data
  /api             — REST + WebSocket server, route handlers, player handlers
  /integrations    — Bitfocus Companion module
/electron          — main process, window management, IPC bridge
/shared            — socket-events.ts, ipc-channels.ts, player-types.ts, design-tokens.css, color-constants.ts
/planning          — Sprints.md, Backlog.md, Overhaul/ (design docs, specs, subsystem details)
```

---

## Architecture Rules — Do Not Violate

1. **The Electron app ALWAYS does the rendering.** The web cockpit never runs PixiJS, WebCodecs, or the particle pipeline.
2. **Audio and video are decoupled systems.** Mood engine (Tone.js) and video audio (WebCodecs/HTMLVideoElement) never reference each other.
3. **Feature hierarchy: Campaign Manager → Scene System → AV Output.** Never let AV features block campaign management.
4. **Offline-first.** No hard dependencies on network connectivity for core functionality.
5. **Resolution-agnostic.** Never hardcode pixel dimensions. Use the OUTPUT_CONFIG object.
6. **The cockpit is device-agnostic.** Web UI must work on iPad, laptop, phone, second desktop.
7. **Three modes: Headless / Play / Plan.** Each with Local / Host network toggle.
8. **ParticleContainer, not Container** for particle systems. Single draw call. Texture atlas.
9. **WebM FX loops use VP9 + alpha.** Per-clip loop offset for stutter handling.
10. **Stem crossfades on the downbeat.** Schedule on musical measure boundaries, not arbitrary points.
11. **Every SFX clip routes through a PannerNode.** Even when spatial is neutral. Never connect directly to `AudioContext.destination`.
12. **Two video engines, one class.** `engines.background` and `engines.gameboard` — same `VideoEngine` class, separate `LayerStack` layers. Never merge.
13. **AV outputs are user-enabled, never auto-created.** No auto AV windows on startup or mode change.
14. **One display, one role.** BG or GB, never both simultaneously. Role from URL query parameter.
15. **Fog of war: cockpit uses HTML5 Canvas, AV uses OffscreenCanvas → PixiJS Sprite.** Coords normalized 0–1 in transit.
16. **Normalized coordinates at system boundaries.** Normalize ALL values (x, y, AND radius/size) when crossing cockpit → AV.

---

## Code Conventions

- TypeScript strict mode everywhere
- Prefer functional React components with hooks
- Name files in kebab-case: `mood-engine.ts`, `combat-tracker.tsx`
- Colocate tests next to source files: `mood-engine.test.ts`
- Use absolute imports from `/src` root
- All Socket.io events use named constants from `shared/socket-events.ts` — never hardcode event strings
- All IPC messages use typed channels from `shared/ipc-channels.ts`
- Document public APIs with JSDoc
- No `any` types — use `unknown` and narrow

---

## CSS & Design System Conventions

Custom CSS design system — no Tailwind, no CSS-in-JS, no preprocessors. All styles in `src/ui/index.css` with CSS custom properties as the token layer. Shared tokens in `shared/design-tokens.css` (imported by both cockpit and companion).

### Rules

1. **Always use CSS custom properties.** Never hardcode colors, spacing, typography, radius, shadows, or transitions. Use `var(--token)` everywhere.
2. **Prefer CSS classes over inline styles.** Inline styles only for truly dynamic/computed values. Layout properties (`display: flex`, `gap`, `padding`) belong in CSS classes.
3. **BEM-like naming:** `.component__element--modifier`. Use `.active`, `.disabled`, `.open` for JS-toggled state.
4. **Form inputs use shared classes:** `className="form-input"` / `className="form-select"`. Never create component-local `inputStyle` objects.
5. **Buttons extend `.btn` base class:** `.btn .btn-primary`, `.btn .btn-ghost`, `.btn .btn-danger`, `.btn .btn-secondary`.
6. **No `!important`.** Fix specificity structurally.
7. **PixiJS colors import from `shared/color-constants.ts`** to stay aligned with CSS tokens.
8. **Reuse existing tokens before creating new ones.** Check `:root` in `index.css` first.
9. **Refer to `planning/Overhaul/UI/css-unification-spec.md`** for the token inventory and extraction backlog.

---

## Key Files

### Architecture & Config
- `Project.md` — Full project specification. **Read first for any architectural question.**
- `planning/Sprints.md` — Complete sprint history + active/blocked sprints
- `planning/Backlog.md` — Prioritized future features (SMALL/MEDIUM/LARGE)
- `planning/Overhaul/OVERHAUL-SUMMARY.md` — Status of all overhaul areas
- `src/core/types.ts` — Core TypeScript interfaces (Campaign, Scene, NPC, Item, Note, etc.)
- `shared/socket-events.ts` — All socket event name constants
- `shared/ipc-channels.ts` — All IPC channel constants
- `shared/player-types.ts` — Player companion shared types
- `shared/design-tokens.css` — Shared CSS custom properties
- `shared/color-constants.ts` — PixiJS color values aligned with CSS tokens

### Backend
- `electron/main.ts` — Electron main process, window management, IPC bridge, port check
- `src/api/server.ts` — Express + Socket.io server, REST routes, socket event handlers
- `src/api/player-handlers.ts` — Player session/lobby/DM-push socket handlers
- `src/core/db/db.ts` — SQLite database operations (campaigns, scenes, NPCs, notes, items, assets)

### Stores (Zustand)
- `src/ui/stores/app-store.ts` — `hasLaunched`, `appMode`, `networkMode`
- `src/ui/stores/scene-store.ts` — Active scene, scene list
- `src/ui/stores/combat-store.ts` — Combat tracker state
- `src/ui/stores/mood-store.ts` — Mood engine state
- `src/ui/stores/av-store.ts` — AV state (particles, colorGrade, gbColorGrade)
- `src/ui/stores/fog-store.ts` — Fog state (fogEnabled, brushSize, brushMode)
- `src/ui/stores/notes-store.ts` — Notes, wikilinks, backlinks
- `src/ui/stores/items-store.ts` — Item entity CRUD
- `src/ui/stores/output-store.ts` — Output management (DisplayInfo, OutputRole)
- `src/ui/stores/player-store.ts` — Connected player sessions
- `src/ui/stores/settings-store.ts` — Persisted user settings (theme, density, audio devices, companion config). Uses Zustand `persist` middleware with key `stage-manager-settings`.

### UI
- `src/ui/App.tsx` — Root UI: cinematic intro → launch screen → cockpit
- `src/ui/lib/sync.ts` — Central sync layer, `IS_BROWSER_DEV`, `initSync()`
- `src/ui/screens/launch-screen.tsx` — Two-column launch, mode selection, QR code
- `src/ui/screens/cinematic-intro.tsx` — Typewriter intro animation
- `src/ui/tabs/dashboard/` — Dashboard 3-column layout sub-components
- `src/ui/tabs/av/AVTab.tsx` — AV tab: toolbar + 2-column channel strip layout
- `src/ui/tabs/PlayersTab.tsx` — DM Players tab (player cards + broadcast)

### AV Display
- `src/systems/av/layer-stack.ts` — PixiJS layer compositor (8 layers)
- `src/systems/av/fog-of-war.ts` — OffscreenCanvas fog → PixiJS Sprite via CanvasSource
- `src/systems/av/color-grade-filter.ts` — GLSL color grade filter
- `src/systems/av/idle-screen.ts` — Idle/standby overlay added to `app.stage` at index 0, BELOW LayerStack

### Companion
- `src/companion/App.tsx` — Player companion root (state-machine: join→lobby→dashboard→ended)
- `src/companion/screens/dashboard-screen.tsx` — Player dashboard

---

## Database Migrations

Migrations live in `src/core/db/migrations/`:

| Migration | Purpose |
|---|---|
| `001_initial_schema.sql` | Core tables: campaigns, scenes, npcs |
| `002_notes_system.sql` | Notes + scene_notes junction + scratchpad |
| `003_dashboard_overhaul.sql` | next_scene_id, scene_npcs, scene_encounters |
| `004_fog_of_war.sql` | fog_data BLOB, fog_enabled |
| `005_media_library.sql` | assets table, asset_campaign_tags |
| `006_gb_color_grade.sql` | gb_color_grade column on scenes |
| `010_player_characters.sql` | player_characters table (campaign-scoped, Sprint 21c) |

---

## Patterns and Pitfalls (Lessons Learned)

1. **Canvas state + React:** Never use conditional JSX trees (different return paths) for components sharing a Canvas. React remounts → destroys painted state. Use CSS class toggling.
2. **Orphaned timers in React:** Store timer IDs in `useRef` and add a separate cleanup `useEffect`. `setInterval` callbacks can't return cleanup functions.
3. **Socket listener stacking:** When `connectSocket()` may be called multiple times (reconnect), always `off()` previous listeners before attaching new ones.
4. **Normalized coordinate completeness:** Normalize ALL values (x, y, AND radius/size) when crossing boundaries. A forgotten radius caused invisible brush strokes.
5. **PixiJS v8 string blend modes:** Use `blendMode: 'erase'` (string), not `PIXI.BLEND_MODES.ERASE` (enum removed in v8).
6. **CORS across Electron renderers:** Express MUST have CORS middleware on REST routes (not just Socket.io). AV Display loads from port 5174/file:// but fetches from port 8080. Without REST CORS, fetch fails silently → black screen.
7. **AV Display late-join timing:** AV Display must handle `STATE_SYNC` to catch up on the active scene, not just `SCENE_LOAD`. Output windows connect AFTER the starting scene auto-loads.
8. **Wire up media pickers end-to-end:** `onSelect` must call `patchScene()` AND update the local store. Don't just close the dialog.
9. **PixiJS v8 uniform access:** Uniforms are plain values on `resources.uniforms.uniforms` — direct assign (`u['uBrightness'] = 0.5`), NOT `{ value }` wrappers.
10. **PixiJS extensionless URL loading:** `PIXI.Assets.load()` fails on URLs without extensions. Use `fetch()` → `blob()` → `Image()` → `decode()` → `ImageSource` → `Texture`.
11. **Role-specific socket event targeting:** Add `target: 'BG' | 'GB'` to payloads. Each AV Display checks its `role` URL param before applying. Server caches state per-target for STATE_SYNC.
12. **Fog of War pipeline completeness:** All four events (FOG_BRUSH, FOG_UPDATE, FOG_TOGGLE, FOG_RESET) must be emitted by cockpit AND handled by AV Display.
13. **Zustand persist middleware:** Use `persist` from `zustand/middleware` for settings that survive restarts. Storage key convention: `stage-manager-settings`. Always include a `version` field for future migrations.
14. **Volume defaults — apply once per session:** Apply default volumes on session start using a `_volumesInitialized` guard flag. Without this guard, every socket reconnect re-applies defaults and overwrites live DM adjustments.
15. **Companion socket leak:** In `initCompanionSync`, always call `socket.disconnect()` on the previous socket before creating a new one. Missing this causes event listener accumulation across reconnects.
16. **AppearanceToggle generic:** `ThemeToggle` and `DensityToggle` both use the shared `AppearanceToggle<T>` component. Use this pattern for any future two-option toggle (type-safe, consistent UI, single implementation).
17. **`setSinkId` scope:** `HTMLVideoElement.setSinkId()` works for routing video audio to a specific output device. `AudioContext` has no `setSinkId` — routing AudioContext output requires a separate implementation. Don't assume parity.
18. **Character select has 3 modes:** `roster-only`, `roster-and-manual`, `manual-only` — controlled by DM settings. The mode flows settings-store → session config payload → REST endpoint → companion. All three cases must be tested.
19. **Idle screen placement:** Add idle/standby overlays via `app.stage.addChildAt(container, 0)` BEFORE LayerStack initializes. Never add idle content as a LayerStack layer — it has a fixed set of named layers with specific roles.
20. **Auto-snapshot on TAKE:** Place snapshot side effects in `TransportBar`'s TAKE button `onClick` handler, not inside Zustand store actions. Store actions must stay pure (no side effects).

---

## Testing

- Unit tests: Vitest (`npx vitest run`) — always use `run` flag to avoid watch mode hanging
- Run specific test: `npx vitest run mood-engine`
- Run tests before committing
- Test env is `node` — no DOM. UI tests are store-contract tests (no jsdom rendering)
- SFX tests: mock AudioContext globally BEFORE importing the module under test
- Re-apply `vi.stubGlobal('fetch', ...)` in `beforeEach` after `vi.clearAllMocks()`
- PixiJS mocking: mock entire `pixi.js` module with MockContainer/MockGraphics/MockSprite
- Fog renderer tests: use normalized coords in test data (e.g., `radius: 25/1920`)

---

## Dependencies — Check Before Adding

Do not add new dependencies without justification. Especially:
- **Tone.js** — permitted **only** in `/src/systems/audio/` for the mood engine. Never in cockpit UI or main process.
- **No cloud databases** — SQLite only, local persistence
- **No CSS frameworks** — Custom CSS design system only (no Tailwind, no CSS-in-JS)
- If uncertain, check `Project.md` Section 12 (Technical Stack Summary)

---

## Git Conventions

- Branch naming: `feature/mood-engine`, `fix/websocket-relay`, `refactor/layer-stack`
- Commit messages: imperative mood, max 72 chars first line
- One logical change per commit
- Not yet live to git — all development is local. No branches or PRs currently.

## Known Placeholders

- **Branding is TEMP** — `Logo.tsx` + `logo.svg` are placeholder. Marked for replacement before release.

---

## Reference Documents

| Document | Purpose |
|---|---|
| `Project.md` | Full project specification — architecture, vision, roadmap overview |
| `planning/Sprints.md` | Complete sprint history + active/blocked sprint details |
| `planning/Backlog.md` | Prioritized future feature backlog (SMALL/MEDIUM/LARGE) |
| `planning/Overhaul/OVERHAUL-SUMMARY.md` | Status of all overhaul areas with remaining work items |
| `planning/Overhaul/UI/css-unification-spec.md` | CSS token inventory and inline style extraction backlog |
| `planning/Overhaul/UI/foundation-spec.md` | Responsive breakpoints, palette, density spec |
| `planning/Overhaul/UI/UI_Overhaul.md` | Master UI vision: per-tab polish, theming, micro-interactions |
| `planning/Overhaul/Notes/notes-overhaul.md` | Notes system Phase 1–3 feature breakdown |
| `planning/Overhaul/player companion/overview.md` | Player Companion MVP scope |
| `planning/Overhaul/player companion/sprints.md` | Companion sprint breakdown |
| `planning/Overhaul/Dashboard/dashboard-implementation-spec.md` | Dashboard sprint breakdown (10a–10j) |
| `planning/Overhaul/Startup/startup-overhaul-overview.md` | Startup sequence design rationale |
| `planning/Overhaul/v1-release-polish.md` | v0.6 pre-beta polish plan (Sprints 17a–17e) |
