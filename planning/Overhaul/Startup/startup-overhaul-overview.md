# Startup Sequence Overhaul — Overview

> Design document for refining the full startup UX: app open → launch screen → campaign selection → cockpit landing.

---

## Current Flow (before overhaul)

1. **Electron boots** — DB init, license check, port check, server start, window creation
2. **LaunchScreen** — Sword emoji branding, App Mode (Headless/Play/Plan), Network Mode (Local/Host), "Enter Cockpit" button
3. **Socket connects** — `hasLaunched` gate releases, sync layer initializes
4. **Campaign Selector** — List of campaigns + inline "New Campaign" form
5. **Cockpit Tabs** — Scene (default), Combat, NPCs, Spells, Notes, AV

## New Flow (after overhaul)

1. **Electron boots** — DB init, license check, port check, server start, **cockpit window only** (no AV window), detect connected displays
2. **Launch Screen** — Two-column card: mode selection (card-based w/ Phosphor icons + network toggle inside) | campaign list. Fade-in on open.
3. **"Start Session →"** — Progress bar in button → socket connects → fade through black
4. **Dashboard landing** — Quick-access atmosphere controls + **output management** (enable BG/GB on detected displays)
5. **Cockpit Tabs** — Dashboard, Scenes, Combat, NPCs, Spells, Notes, AV
6. **AV outputs enabled on demand** — DM tags displays as BG or GB from Dashboard/AV tab. Windowed pop-out available if no external display.

## Items to Refine

| # | Item | Status |
|---|------|--------|
| 1 | First Impression & Branding | **Done** |
| 2 | App Mode Selection | **Done** |
| 3 | Network Mode Selection | **Done** |
| 4 | "Enter Cockpit" Action | **Done** |
| 5 | Campaign Selection / Creation | **Done** |
| 6 | Post-Launch Transition | **Done** |
| 7 | Initial Cockpit Landing (Dashboard) | **Done** |
| 8 | AV Output Management (no auto-window) | **Done** |

---

## Item 1 — First Impression & Branding

**Current state:**
- Full-screen dark background with centered 440px card
- Sword emoji (⚔) as icon with blue glow filter
- "Stage Manager" title (24px bold)
- "DM Cockpit & AV Engine" subtitle (small gray)
- No animation, no logo asset, no version info

**Decisions:**

1. **Logo:** Custom SVG asset — hybrid concept combining theater/stage imagery (spotlight, curtains, masks) with TTRPG elements (D20, grid). Design should be flexible enough to survive a potential app name change.
2. **App name:** Currently "Stage Manager" — **open to rebrand**. Logo design should not be tightly coupled to the name text.
3. **Subtitle:** "DM Cockpit & AV Engine" — to be revisited once name is finalized.
4. **Visual tone:** Clean & modern dark theme. Professional and minimal (think VS Code / Discord splash), not fantasy-ornate.
5. **Entry animation:** Subtle fade-in (~300ms). Card fades in smoothly on app open.
6. **Version + license:** Displayed at **bottom-center of card** (e.g., `v0.8.0 · Free Tier`). Small, unobtrusive text below the main action button.
7. **Card width:** Currently 440px max — may widen slightly to accommodate new layout (revisit during later items).

---

## Item 2 — App Mode Selection

**Current state:**
- Section label: "App Mode"
- 3 equal-width buttons in a row: Headless / Play / Plan
- Active button gets blue glow + accent border
- Contextual help text below changes based on selection:
  - Headless: "AV display only — control from a LAN device"
  - Play: "Full cockpit + AV display on second monitor"
  - Plan: "Prep mode — build scenes and manage campaign"

**Decisions:**

1. **Names:** Keep Headless / Play / Plan but add **Phosphor icons** to each card for visual clarity.
2. **Layout:** Card-based selection — 3 horizontal cards side-by-side, each showing icon + name + short description.
3. **Preview:** Tooltip on hover — shows a mini wireframe diagram of what windows/setup each mode creates (e.g., Play = [Cockpit] + [AV Display on second monitor]).
4. **Default:** **No pre-selection.** DM must consciously choose a mode before proceeding. This prevents accidental wrong-mode launches. The "Enter" button should be disabled until a mode is selected.
5. **Icon suggestions (Phosphor):**
   - Headless: `Monitor` or `Broadcast` (remote control concept)
   - Play: `GameController` or `Play` (game night / live session)
   - Plan: `NotePencil` or `Pencil` (prep/building concept)
6. **Card dimensions:** Each card is equal width, filling the card container. Active card gets accent border + subtle glow (current accent style).

---

## Item 3 — Network Mode Selection

**Current state:**
- Section label: "Network"
- 2 equal-width buttons: Local Only / Host on LAN
- Contextual help text for Host mode explains LAN browser access

**Decisions:**

1. **Visibility:** Smart defaults + auto-hide based on app mode:
   - **Headless:** Network is forced to Host (no toggle shown — it's the only option that makes sense). Display a note: "Headless requires LAN hosting."
   - **Plan:** Network section is hidden or defaulted to Local (prep doesn't need networking). If shown, default to Local with no emphasis.
   - **Play:** Show both Local / Host options — DM chooses.
2. **Presentation:** Toggle lives **inside each mode card**. When a mode card is selected and expanded/active, a small Local/Host toggle appears within it. This eliminates the separate "Network" section entirely.
3. **Host info:** When Host on LAN is selected, show:
   - **LAN IP address + port** (e.g., `192.168.1.42:8080`)
   - **QR code** that players can scan to open the cockpit on their device
   - This info appears within the mode card or as a slide-down panel below it.
4. **Interaction:** Selecting a mode card reveals its network toggle (if applicable). The card expands slightly to accommodate the toggle + any Host info.

---

## Item 4 — "Enter Cockpit" Action

**Current state:**
- Full-width blue accent button at card bottom
- Text: "Enter Cockpit →"
- No loading state, no validation, instant `setLaunched()` call

**Decisions:**

1. **Button text:** **"Start Session →"** — frames the action in TTRPG terms. Works regardless of app name.
2. **Behavior:** Brief loading state (1-2 sec) — show a spinner/progress indicator while socket connects and server confirms mode, then transition to cockpit.
3. **Validation:** Button is **disabled** until both a mode AND a campaign are selected (since campaign selection is now merged into the launch screen — see Item 5).
4. **Merge:** Campaign selection is now **integrated into the launch screen**. The "Start Session" button only activates when the DM has chosen: mode + network + campaign. This eliminates the separate campaign selector screen.
5. **Loading sequence on click:**
   - Button shows spinner + "Starting…"
   - `setLaunched()` fires → Socket.io connects
   - Server receives mode/network/campaign
   - Brief connection confirmation
   - Transition to cockpit

---

## Item 5 — Campaign Selection / Creation

**Current state:**
- Shown after LaunchScreen (separate screen)
- Campaign list with rule system badges (D&D 5e, PF2e, CoC, Custom)
- Inline "New Campaign" form with name input + rule system dropdown
- No campaign thumbnails, no recents, no favorites

**Decisions:**

> **Major change:** Campaign selection is now merged INTO the launch screen. The separate `CampaignSelector` screen is eliminated.

1. **Layout:** Two-column layout within the launch card:
   - **Left column:** Mode cards (3 stacked vertically or mini-cards) + network toggle within active card
   - **Right column:** Campaign list + new campaign form
   - Card max-width widens from 440px → **~750-800px** to accommodate two columns
   - On mobile/narrow screens: columns stack vertically (responsive)

2. **Campaign list:** Compact list rows — each row shows:
   - Campaign name
   - Rule system badge (D&D 5e, PF2e, CoC, Custom)
   - Last-played date (or "New" if never opened)
   - Selected state: accent border/highlight

3. **New Campaign:** Inline form — click "+ New Campaign" and a form row appears in-place:
   - Campaign name input
   - Rule system dropdown
   - Create button
   - No navigation away from launch screen

4. **Quick resume:** Last-used campaign is **subtly pre-selected** in the list (highlighted but not given special "Resume" UI). DM can confirm or change before hitting "Start Session."

5. **Empty state:** If no campaigns exist, the right column shows a friendly empty state with a prominent "+ Create Your First Campaign" button.

6. **Plan mode exception:** In Plan mode, campaign selection is required (you need something to prep). In Headless mode, campaign may still be needed (for scene loading). All three modes require a campaign.

---

## Item 6 — Post-Launch Transition

**Current state:**
- Instant React state swap (no animation)
- LaunchScreen → Campaign Selector → Cockpit (hard cuts)
- No loading indicator while socket connects

**Decisions:**

1. **Transition animation:** **Fade through black.** Launch screen fades to black (~200ms), hold black briefly (~100ms), then cockpit fades in (~300ms). Theatrical "curtain" moment — sets the tone that you're stepping onto the stage.

2. **Loading state:** **Progress bar in the "Start Session" button.** When clicked:
   - Button text changes to "Starting…"
   - A progress bar fills across the button width
   - Progress stages: connecting socket → confirming mode → loading campaign data
   - On completion: button fills fully → fade-through-black begins

3. **Error handling:** **Inline error + retry on the launch screen.** If socket connection fails:
   - "Start Session" button reverts to its normal state
   - An error message appears below the button (red text): "Connection failed — server may not be running"
   - "Retry" button appears next to the error
   - DM stays on the launch screen with all their selections preserved
   - No modals, no navigation — everything recoverable in place

4. **Timing:** Total transition from click to cockpit visible: ~1-2 seconds (connection + fade). If connection is instant, add a minimum ~500ms delay so the progress bar doesn't flash and disappear.

---

## Item 7 — Initial Cockpit Landing (Dashboard)

**Current state:**
- Scene tab is the default `activeTab`
- No dedicated dashboard or session-start experience
- Per project-md-amendment.md: Scene tab to be renamed "Dashboard" with env presets, SFX soundboard, AV controls

**Decisions:**

1. **Default landing:** **Dashboard tab** (as specified in project-md-amendment.md). This is the first tab shown after the fade-through-black transition. Contains environment presets, SFX soundboard, and AV state controls — quick-access atmosphere.

2. **Welcome state:** **Straight to work.** No welcome banner or session summary. The cockpit header already displays campaign name and mode. DMs want to get into their session immediately.

3. **Tab structure:** **Adopt the amended tabs:**
   - **Dashboard** — Environment presets, SFX soundboard, AV state controls (renamed from Scene)
   - **Scenes** — New card-based scene flow (drag-to-reorder, inline expand, branches)
   - **Combat** — Initiative, HP, conditions, turn order
   - **NPCs** — Quick stat block view
   - **Spells** — Fast SRD search
   - **Notes** — Split-pane notes manager (CodeMirror 6)
   - **AV** — Mood slider, particles, color grading

4. **State persistence:** No tab state remembered across sessions (always land on Dashboard). Can revisit this later if DMs request it.

---

## Item 8 — AV Output Management (No Auto-Window on Startup)

**Current state:**
- `electron/main.ts` auto-creates an AV Display window on startup based on `appConfig.appMode`
- Play/Headless modes immediately spawn a fullscreen window on the second monitor (display index 1)
- Both video engines (BG + GB) render into layers of a single composited LayerStack canvas
- `applyMode()` creates/destroys the AV window when mode changes
- No user control over which display gets which content
- No display detection UI — hardcoded to `avDisplayIndex: 1`

**Decisions:**

> **Major architectural change:** AV windows are NO LONGER auto-created on startup. The DM explicitly enables outputs from the cockpit after the session starts.

### 8.1 — Startup Behavior

1. **Zero AV windows on boot.** Electron main process starts the server and cockpit window ONLY. No AV Display window is created regardless of app mode.
2. **Display detection runs on startup** — enumerate connected external monitors/projectors via `screen.getAllDisplays()`. Store the list as available outputs.
3. **Live hot-plug detection** — listen for Electron `screen` display-added/display-removed events. Update the available outputs list in real-time. Notify the cockpit UI when a display is connected or disconnected (toast or badge update).

### 8.2 — Output Tagging Model

Each external display (or windowed pop-out) is assigned **exactly one role:**

| Role | Tag | Layers Rendered |
|------|-----|-----------------|
| **Background** | `BG` | Background Video Engine, Weather Particles, FX Overlays (VP9+alpha), Color Grade |
| **Game Board** | `GB` | GameBoard Video Engine, Fog of War, Ping Tool, Color Grade (independent instance) |

- **One display = one role.** A display cannot be both BG and GB simultaneously.
- If only one external display is available, the DM chooses whether it's BG or GB.
- If two+ external displays are available, each can be tagged independently.
- Color grade applies to both output types but as **independent instances** (different settings per output is possible, or synced — default synced).

### 8.3 — Enabling Outputs (User Flow)

**From Dashboard (quick-access):**
- An "Outputs" section shows detected displays as compact cards:
  - Display name/label (e.g., "HDMI-2 — Samsung TV", "DP-1 — Epson Projector")
  - Resolution info
  - Status: Disabled / BG / GB
  - Enable button → opens a role picker (BG or GB)
- If no external displays detected: show a "Pop Out Window" button to create a windowed display

**From AV Tab (full management):**
- Same output cards but with additional controls:
  - Fullscreen toggle per output
  - Resolution/scaling options
  - Disconnect/disable button
  - Display preview thumbnail (if feasible)

**Windowed Pop-Out (no external display):**
- Click "Pop Out Window" → choose role (BG or GB)
- Creates a windowed (non-fullscreen) BrowserWindow on the primary display
- Can open **two** pop-out windows (one BG, one GB) for testing/scene building
- Pop-outs follow the same one-role rule as external displays

### 8.4 — Architecture Impact

**`electron/main.ts` changes:**
- Remove auto-creation of AV window from `app.whenReady()`
- Remove AV window creation from `applyMode()` — mode no longer controls AV windows
- New function: `createOutputWindow(displayId, role: 'BG' | 'GB')` — creates a window on a specific display with a specific role
- New function: `destroyOutputWindow(role: 'BG' | 'GB')` — closes an output window
- New function: `getAvailableDisplays()` — returns connected displays (minus the cockpit display)
- Listen for `screen.on('display-added')` and `screen.on('display-removed')` events

**New IPC channels:**
- `OUTPUT_LIST_DISPLAYS` — cockpit → main → returns available external displays
- `OUTPUT_ENABLE` — cockpit → main (displayId, role) → creates output window
- `OUTPUT_DISABLE` — cockpit → main (role) → destroys output window
- `OUTPUT_DISPLAYS_CHANGED` — main → cockpit (push notification when displays connect/disconnect)
- `OUTPUT_TOGGLE_FULLSCREEN` — cockpit → main (role) → toggle fullscreen on specific output

**New socket events:**
- `OUTPUT_STATE` — broadcast current output configuration to all clients
- `OUTPUT_ENABLE` / `OUTPUT_DISABLE` — relay output changes

**AV Display renderer changes (`src/systems/av/main.tsx`):**
- Must accept a `role` parameter (BG or GB) passed via URL query string or IPC
- Only initializes the relevant systems for its role:
  - BG role: Background VideoEngine, ParticleSystem, FXLoopPlayer, ColorGrade
  - GB role: GameBoard VideoEngine, FogOfWar, PingTool, ColorGrade
- Only listens for socket events relevant to its role

**Video engine notification:**
- When an output is enabled, the corresponding video engine is told its output is active
- When an output is disabled, the engine pauses/stops rendering
- The cockpit UI reflects which engines are active (Dashboard shows BG/GB status indicators)

**Zustand store changes (`av-store.ts` or new `output-store.ts`):**
- Track available displays: `availableDisplays: DisplayInfo[]`
- Track active outputs: `activeOutputs: { BG?: { displayId, windowId, fullscreen }, GB?: { displayId, windowId, fullscreen } }`
- Actions: `enableOutput(displayId, role)`, `disableOutput(role)`, `setDisplays(displays)`

### 8.5 — Mode Interaction (Revised)

With AV windows now user-controlled, mode behavior changes:

| Mode | Cockpit Window | AV Outputs | Notes |
|------|---------------|------------|-------|
| **Play** | Yes | User-enabled from Dashboard/AV tab | DM enables outputs after session starts |
| **Plan** | Yes | User-enabled (optional, for preview) | DM can pop out a windowed preview for scene building |
| **Headless** | No (LAN only) | User-enabled from LAN cockpit | LAN-connected DM enables outputs remotely |

- Play and Plan modes: identical output management UX
- Headless mode: output management happens via the LAN web cockpit (the IPC calls need to be bridged through Socket.io → server → main process)

### 8.6 — Headless Mode Consideration

Since Headless mode has no local cockpit window, output management commands must flow:
```
LAN Cockpit (browser) → Socket.io → Server → IPC → Electron Main → Create/Destroy Output Window
```
This requires the server to proxy output management IPC calls — a new set of socket event handlers in `server.ts` that invoke `applyOutput()` callbacks similar to the existing `applyMode()` pattern.
