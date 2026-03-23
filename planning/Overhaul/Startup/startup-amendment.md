# Project.md Amendment — Startup Sequence Overhaul

> This document contains the exact changes to apply to `Project.md`.
> Each section shows what to replace or add.
>
> **Amendment naming convention:** Each overhaul folder contains a `*-amendment.md` file
> named `{feature}-amendment.md` (e.g., `notes-scenes-amendment.md`, `startup-amendment.md`).
> Amendments live colocated with their design docs in their respective `Overhaul/{Feature}/` folder.

---

## Change 1: Update Section 3.3 (Application Modes)

**Replace** the mode table in section 3.3 with:

### 3.3 Application Modes

Three boot modes, selected on the launch screen before entering the cockpit:

| Mode | Local Cockpit | Web Server | AV Outputs | Use Case |
|---|---|---|---|---|
| **Headless** | No | Required (LAN hosting forced) | User-enabled from LAN cockpit | Dedicated media server box — DM controls from iPad/laptop on LAN |
| **Play** | Yes | Optional (Local or Host) | User-enabled from Dashboard / AV tab | DM runs everything from one machine; enables outputs when ready |
| **Plan** | Yes | Optional | User-enabled (optional, for preview) | Between-session prep — scene building, note editing, campaign management |

Each mode supports **Local Only** or **Host on LAN** network toggle. Mode switching doesn't require restart; connected LAN clients update accordingly.

**AV outputs are never auto-created.** In all modes, the DM explicitly enables outputs from the cockpit. Each output is tagged with a role (BG or GB) and targets a specific connected display or a windowed pop-out. See Section 4.10 for details.

---

## Change 2: Update Section 3.2 (Electron Process Architecture)

**Append** to section 3.2, after the existing process descriptions:

#### Display Detection and Output Management

The Electron main process is responsible for:

- **Display enumeration:** On startup, `screen.getAllDisplays()` identifies all connected monitors and projectors. The cockpit display is excluded from the available outputs list.
- **Live hot-plug detection:** `screen.on('display-added')` and `screen.on('display-removed')` events push updated display lists to the cockpit UI in real-time. When a DM plugs in a projector mid-session, it appears immediately.
- **Output window lifecycle:** Output windows (BrowserWindows) are created and destroyed on demand via IPC, never automatically. Each output window receives its role (`BG` or `GB`) as a URL query parameter so the renderer knows which systems to initialize.
- **Headless mode proxy:** When no local cockpit exists, output management commands flow through Socket.io → Express server → IPC → main process, using the same callback pattern as `applyMode()`.

---

## Change 3: Add Section 4.10 (AV Output Management)

**Add** after section 4.9 (or as new section at the end of Section 4):

### 4.10 AV Output Management

AV output windows are user-controlled, not automatic. No AV window is created on application startup.

#### Output Roles

Each output window renders a strict subset of the layer stack:

| Role | Tag | Layers Rendered | Use Case |
|------|-----|-----------------|----------|
| **Background** | `BG` | Background Video Engine, Weather Particles (rain/snow/ash/embers/dust/fog), FX Overlays (VP9+alpha WebM loops), Color Grade filter | Ambient scene atmosphere — TV behind DM, wall-mounted display |
| **Game Board** | `GB` | GameBoard Video Engine, Fog of War, Ping Tool, Color Grade filter (independent instance) | Tactical battle map — projector on table, secondary monitor for players |

**One display = one role.** A physical display cannot be both BG and GB simultaneously. If only one external display is available, the DM chooses which role it serves.

#### Enabling Outputs

From the **Dashboard tab** (quick-access):
- An "Outputs" section shows detected displays as compact cards with display name, resolution, and a role dropdown (Disabled / BG / GB).
- If no external displays are detected, a "Pop Out Window" button creates a windowed BrowserWindow on the primary display, tagged with the chosen role.
- Two pop-out windows can be open simultaneously (one BG, one GB) for testing and scene building.

From the **AV tab** (full management):
- Same display cards with additional controls: fullscreen toggle, disconnect button.

#### AV Renderer Role Awareness

Each output window's renderer reads its role from a URL query parameter (`?role=BG` or `?role=GB`). The renderer only initializes systems relevant to its role:

- **BG renderer:** Background VideoEngine, ParticleSystem, FXLoopPlayer, ColorGradeFilter. Listens only for `SCENE_LOAD` (background), `AV_PARTICLES`, `AV_FX_OVERLAY`, `AV_COLORGRADE`.
- **GB renderer:** GameBoard VideoEngine, FogOfWar, PingTool, ColorGradeFilter. Listens only for `SCENE_LOAD` (gameboard), `AV_FOG_ERASE`, `AV_PING`, `AV_COLORGRADE`.
- **Both audio systems** (MoodEngine, SFXSoundboard) initialize on the BG renderer only. The GB renderer is silent — the game board display doesn't produce sound.

#### IPC and Socket Event Flow

Output management uses the same architectural patterns as mode switching:

**Local cockpit (Play/Plan mode):**
```
Cockpit UI → IPC invoke → Electron main → create/destroy BrowserWindow
```

**LAN cockpit (Headless mode):**
```
Browser cockpit → Socket.io → Express server → callback → Electron main → create/destroy BrowserWindow
```

---

## Change 4: Update Section 7.1 (Launch Screen / Startup)

**Replace** any existing launch screen description (or add if not present) with:

### 7.1 Launch Screen

The launch screen is the first UI the DM sees on app open. It consolidates mode selection, network configuration, and campaign selection into a single two-column card.

```
+──────────────────────────────────────────────────────────+
│          [Logo SVG]  App Name                            │
│          subtitle                                        │
│                                                          │
│  ┌── Mode ──────────────┐  ┌── Campaign ──────────────┐  │
│  │                      │  │                          │  │
│  │  [Headless] [Play]   │  │  ● Campaign A  (5e)     │  │
│  │  [Plan]              │  │  ○ Campaign B  (PF2e)   │  │
│  │                      │  │  ○ Campaign C  (CoC)    │  │
│  │  ▼ Selected card:    │  │                          │  │
│  │  icon + desc         │  │  [+ New Campaign]        │  │
│  │  [Local] [Host]      │  │                          │  │
│  │  192.168.x.x [QR]   │  │                          │  │
│  └──────────────────────┘  └──────────────────────────┘  │
│                                                          │
│  [════════════ Start Session → ═══════════════]          │
│              v0.8.0 · Free Tier                          │
+──────────────────────────────────────────────────────────+
```

**Design decisions:**

| Element | Decision |
|---------|----------|
| **Logo** | Custom SVG — hybrid theater + TTRPG concept (spotlight/masks + D20/grid). Flexible for potential rebrand. |
| **Visual tone** | Clean & modern dark theme. Professional, not fantasy-ornate. |
| **Entry animation** | Subtle fade-in (~300ms ease-out) on app open. |
| **Mode cards** | Card-based selection with Phosphor icons. No pre-selection — DM must choose. |
| **Network toggle** | Lives inside the active mode card. Smart defaults: Headless→Host (forced), Plan→Local (hidden), Play→both shown. |
| **Host info** | When Host selected: show LAN IP + port + QR code inside the mode card. |
| **Campaign list** | Compact rows: name + rule system badge + last-played date. Last-used campaign is subtly pre-selected. |
| **New Campaign** | Inline form appears in-place (name + rule system dropdown). No navigation away. |
| **Start Session** | Disabled until mode + campaign selected. Shows progress bar on click. Button text: "Start Session →". |
| **Version/license** | Bottom-center: `v0.8.0 · Free Tier` |
| **Card width** | ~780px max (two-column). Responsive: stacks vertically on narrow viewports. |

**Transition on "Start Session":**
1. Button shows internal progress bar + "Starting…" text
2. Socket.io connects, mode confirmed, campaign data loads
3. Button fills completely
4. **Fade through black:** launch screen fades to black (~200ms) → hold black (~100ms) → cockpit fades in (~300ms)
5. Cockpit lands on Dashboard tab

**Error handling:** If socket connection fails (5-second timeout), button reverts, inline error message + "Retry" appears below button. All selections preserved.

**No separate campaign selector screen.** Campaign selection is integrated into the launch screen. The `CampaignSelector` component is retained for the "Switch Campaign" button in the cockpit header.

---

## Change 5: Update Section 7.2 (Table-Time Cockpit UI)

**Replace** the tab bar and table in section 7.2 with:

```
+--------------------------------------------------------------+
| [Dashboard] [Scenes] [Combat] [NPCs] [Spells] [Notes] [AV]  |
+--------------------------------------------------------------+
|                                                               |
|         Context-sensitive content area                        |
|                                                               |
+--------------------------------------------------------------+
```

| Tab | Purpose | Design Priority |
|---|---|---|
| **Dashboard** | Environment presets, SFX soundboard, AV state controls, **output management** (enable/disable BG/GB outputs on detected displays) | Quick-access atmosphere + output control |
| **Scenes** | Card-based scene flow: drag-to-reorder, inline expand, branches, linked notes, scratchpad | Visual campaign structure |
| **Combat** | Initiative, HP, conditions, turn order | Bulletproof reliability |
| **NPCs** | Quick stat block view | Read speed, not editing |
| **Spells/Attacks** | Fast search, one-click details | Search performance |
| **Notes** | Split-pane notes manager: browsable list + rich markdown editor (CodeMirror 6). Scene linking. Import. | Import quality, editing speed |
| **AV** | Mood slider, particle toggles, color grade, **full output management** (fullscreen toggle, disconnect, display details) | Minimal, non-distracting |

**Default landing tab:** Dashboard. No tab state remembered across sessions.

---

## Change 6: Update Section 4.4 (PixiJS Layer Stack)

**Append** to the layer stack description:

#### Role-Based Layer Rendering

When AV outputs use the one-display-one-role model (Section 4.10), each output window renders only its assigned layers:

| Layer | BG Output | GB Output |
|-------|-----------|-----------|
| Background | Yes | — |
| Game Board | — | Yes |
| FX | Yes | — |
| Overlay | — | Yes |
| Particle | Yes | — |
| Color Grade | Yes (independent) | Yes (independent) |
| UI | — | Yes |

Audio systems (MoodEngine, SFXSoundboard) run exclusively on the BG output. The GB output is silent.

---

## Change 7: Add to Section 12 (Technical Stack Summary)

**Add** to the Technical Stack Summary table:

| Icons | Phosphor Icons — clean weight-adjustable icons for mode cards and UI elements |
| QR Code | `qrcode` npm package — generates QR code SVG for Host on LAN mode |

---

## Change 8: Add to Section 15 (Development Roadmap)

**Add** after the latest sprint (Sprint 7 or Sprint 8 if Notes overhaul sprint is added first):

### Sprint 9: Startup Sequence Overhaul

**Phase 1 — Launch Screen UI:**
- [ ] Install Phosphor Icons (`@phosphor-icons/react`)
- [ ] Change `appMode` default from `'play'` to `null` (no pre-selection)
- [ ] Rewrite `LaunchScreen` component: two-column card, mode cards with icons, integrated campaign list
- [ ] Add network toggle inside mode cards with smart defaults (Headless→Host, Plan→Local)
- [ ] Add campaign data fetching on launch screen mount (REST fetch)
- [ ] Add "Start Session →" button with disabled state validation
- [ ] Remove separate `CampaignSelector` gate from `App.tsx`
- [ ] Update CSS: wider card (~780px), two-column layout, responsive stacking

**Phase 2 — Tab Restructure:**
- [ ] Rename `SceneTab` → `DashboardTab` (environment presets, SFX soundboard, AV controls)
- [ ] Create placeholder `ScenesTab` (card-based flow, implemented in Sprint 8)
- [ ] Update `TabBar` to 7 tabs: Dashboard, Scenes, Combat, NPCs, Spells, Notes, AV
- [ ] Set default landing tab to Dashboard

**Phase 3 — AV Output Management:**
- [ ] Remove auto-creation of AV Display window from `electron/main.ts`
- [ ] Add display enumeration (`getAvailableDisplays()`) and hot-plug listeners
- [ ] Create `output-store.ts` Zustand store (available displays, active outputs)
- [ ] Add `OUTPUT_*` IPC channels and socket events
- [ ] Implement `createOutputWindow(displayId, role)` and `destroyOutputWindow(role)`
- [ ] Add role-aware initialization to AV Display renderer (`?role=BG` / `?role=GB`)
- [ ] Build output management UI on Dashboard (compact display cards) and AV tab (full controls)
- [ ] Add windowed pop-out support (BG or GB) for no-external-display scenarios
- [ ] Implement headless mode output proxy (Socket.io → server → IPC → main)

**Phase 4 — Transition and Polish:**
- [ ] Implement fade-through-black transition (launch → cockpit)
- [ ] Add progress bar inside "Start Session" button with staged progress
- [ ] Add inline error handling + retry on connection failure
- [ ] Add entry fade-in animation on launch screen
- [ ] Add QR code generation for Host on LAN mode
- [ ] Add version + license display at bottom-center of launch card
- [ ] Add tooltip previews for mode cards (mini wireframe diagrams)

**Phase 5 — Branding:**
- [ ] Design and create custom SVG logo (hybrid theater + TTRPG)
- [ ] Replace sword emoji with logo component
- [ ] Update Electron window titles if app name changes

---

## Change 9: Update CLAUDE.md Architecture Rules

**Append** to the "Architecture Rules — Do Not Violate" section:

13. **AV outputs are user-enabled, never auto-created.** The Electron main process must not create AV Display windows on startup or during mode changes. Output windows are created only when the DM explicitly enables them from the cockpit UI (Dashboard or AV tab). Each output is tagged with exactly one role: BG (Background) or GB (Game Board).
14. **One display, one role.** A physical display or windowed pop-out renders either BG layers or GB layers, never both simultaneously. The AV renderer reads its role from a URL query parameter and initializes only the relevant systems.

---

*End of Amendment*
