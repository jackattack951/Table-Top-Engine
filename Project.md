# TTRPG Stage Manager — Project Specification

**Document Type:** Unified Project Reference
**Last Updated:** March 2026
**Status:** Sprints 0–17b + 17d Complete — 753 Tests Passing (44 test files) — Player Companion MVP Done — v0.6 Polish In Progress (17c audio blocked on assets, 17e packaging next)

---

## 1. Product Vision

### What It Is
A **DM cockpit and theatrical atmosphere engine** for in-person TTRPG sessions. The app is the runtime layer a Dungeon Master uses *at the table* — fast access to campaign data, immersive audiovisual atmosphere on a connected TV/projector, and a device-agnostic control surface that works from an iPad, laptop, or second desktop.

### What It Is Not
- Not a cloud-hosted VTT (Roll20, Foundry)
- Not a content-creation suite (no complex audio routing, no line-of-sight algorithms)
- Not a note-taking app (it *consumes* notes from where DMs already work)

### The Problem It Solves
DMs currently juggle 4+ tools at the table simultaneously. This app is the **glue layer** — fast access to everything they need, with cinematic atmosphere that no existing tool provides.

### Design Philosophy
- **"The focus is the game."** Every feature must serve the live session, not distract from it.
- **Speed over completeness** — every table-time interaction must be instant.
- **Import, don't rebuild** — respect where DMs already keep their content.
- **Atmosphere in service of the game** — the AV system supports the session, never dominates it.
- **Push-button atmosphere machine** — the DM is not a DJ or video editor.

### Target Market
- **Primary:** D&D 5e Dungeon Masters running in-person sessions
- **Expansion:** Full TTRPG community (Pathfinder 2e, Call of Cthulhu, etc.)
- **Distribution:** Desktop application (Electron)

---

## 2. Competitive Landscape

| Tool | Strength | Gap This App Fills |
|---|---|---|
| D&D Beyond | Character sheets, rules reference | No AV, no campaign management, online only |
| Foundry VTT | Full VTT, maps, modules | Complex, expensive, overkill for theatre-of-mind |
| Obsidian + plugins | Notes, lore authoring | No table-time UI, no AV, no combat tracker |
| AI dungeon tools | Generative content | Not a DM tool at all |

**This app does not compete directly with any of them — it sits alongside them.**

The long-term competitive moat is the content library. The app itself could be replicated; a library of high-quality, cohesive, purpose-built TTRPG atmosphere content is much harder to copy.

---

## 3. Application Architecture

### 3.1 Core Architecture

The app is a single **Electron application** that serves dual purposes: it is both the AV rendering engine (outputting to a connected TV/projector) and a web server hosting the DM's control interface on the local network. Any device on the LAN can connect as a cockpit.

```
+------------------------------------------------------+
|                   ELECTRON APP                        |
|                                                       |
|  +------------------+   +--------------------------+  |
|  |  Main Process     |   |  Renderer: AV Display    |  |
|  |  (Node.js)        |   |  (Second BrowserWindow)  |  |
|  |                   |   |                           |  |
|  |  - Express/WS     |   |  - PixiJS compositor     |  |
|  |    Server         |<->|  - WebCodecs video       |  |
|  |  - SQLite DB      |   |  - Web Audio mood engine |  |
|  |  - File system    |   |  - Particle systems      |  |
|  |  - Worker threads |   |  - GLSL color grading    |  |
|  |  - Auth/License   |   |                           |  |
|  +--------+----------+   +--------------------------+  |
|           |                                           |
|           |  WebSocket + REST API                     |
|           |                                           |
+-----------+-------------------------------------------+
            |
    +-------v--------+
    |  LAN Network    |
    |                 |
    |  iPad / Laptop  |  <-- DM Cockpit (Web UI)
    |  Second Desktop |  <-- + Stream Deck / Companion
    |  Phone (DM)     |  <-- Lightweight cockpit access
    |  Phone (Player) |  <-- Player Companion (QR join → dashboard)
    +-----------------+
```

### 3.2 Electron Process Architecture

```
Main Process (Node.js)
  |-- Express + Socket.io server (hosts cockpit web UI + real-time relay)
  |-- File system access (campaign data, assets, imports)
  |-- SQLite database (better-sqlite3)
  |-- Worker Threads for CPU-intensive tasks
  |-- Window management (BrowserWindows)
  |-- IPC bridge to renderer processes
  +-- License/auth token management

Renderer Process - AV Display (Chromium)
  |-- PixiJS rendering pipeline (WebGL)
  |-- WebCodecs video decode
  |-- Tone.js mood engine (BPM-accurate stem scheduling)
  |-- Web Audio API SFX soundboard (PannerNode spatial audio)
  |-- Web Workers for offloading render thread
  +-- No interactive UI - display only

Renderer Process - Local Cockpit (Chromium) [when not Headless]
  |-- Full DM cockpit interface
  |-- Real-time AV preview (PixiJS, local)
  +-- Same UI served to LAN clients
```

#### Display Detection and Output Management

The Electron main process is responsible for:

- **Display enumeration:** On startup, `screen.getAllDisplays()` identifies all connected monitors and projectors. The cockpit display is excluded from the available outputs list.
- **Live hot-plug detection:** `screen.on('display-added')` and `screen.on('display-removed')` events push updated display lists to the cockpit UI in real-time. When a DM plugs in a projector mid-session, it appears immediately.
- **Output window lifecycle:** Output windows (BrowserWindows) are created and destroyed on demand via IPC, never automatically. Each output window receives its role (`BG` or `GB`) as a URL query parameter so the renderer knows which systems to initialize.
- **Headless mode proxy:** When no local cockpit exists, output management commands flow through Socket.io → Express server → IPC → main process, using the same callback pattern as `applyMode()`.

### 3.3 Application Modes

Three boot modes, selected on the launch screen before entering the cockpit:

| Mode | Local Cockpit | Web Server | AV Outputs | Use Case |
|---|---|---|---|---|
| **Headless** | No | Required (LAN hosting forced) | User-enabled from LAN cockpit | Dedicated media server box — DM controls from iPad/laptop on LAN |
| **Play** | Yes | Optional (Local or Host) | User-enabled from Dashboard / AV tab | DM runs everything from one machine; enables outputs when ready |
| **Plan** | Yes | Optional | User-enabled (optional, for preview) | Between-session prep — scene building, note editing, campaign management |

Each mode supports **Local Only** or **Host on LAN** network toggle. Mode switching doesn't require restart; connected LAN clients update accordingly.

**AV outputs are never auto-created.** In all modes, the DM explicitly enables outputs from the cockpit. Each output is tagged with a role (BG or GB) and targets a specific connected display or a windowed pop-out. See Section 4.10 for details.

### 3.4 Cockpit Device Agnosticism

The cockpit is a web UI. It runs identically on any device that has a browser:
- **iPad** - touch-optimized, the "classic" DM controller
- **Laptop** - full keyboard/mouse, ideal for complex prep or play
- **Second Desktop** - allows connection of external peripherals (Stream Deck, Companion, MIDI controllers)
- **Phone** - lightweight access for quick adjustments

The cockpit **never renders the heavy AV pipeline**. It sends commands and receives state. When a real-time preview is needed, the approach adapts to context:
- **Local cockpit (Electron):** A smaller PixiJS render in the DM's own window - high quality, zero latency.
- **LAN cockpit (Web UI):** Compressed canvas snapshots from the Electron renderer, streamed at a modest framerate (~10-15fps). Enough to confirm atmosphere, not meant to be cinematic.

---

## 4. Rendering and AV Pipeline

### 4.1 Core Rendering Approach

All compositing, color correction, and particle work happens on the **GPU** via WebGL. CPU core limitations are largely irrelevant when the architecture is correct.

### 4.2 Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| Compositing and rendering | PixiJS | Fast 2D WebGL, layer management, filters |
| Video decode | WebCodecs API | Hardware-accelerated, frames go directly to GPU as textures |
| Color correction | GLSL shaders via PixiJS filters | Full cinematic grading on GPU |
| Pre-rendered FX | VP9 + alpha WebM loops | Transparency compositing, hardware decoded |
| Particle systems | PixiJS ParticleContainer | Single draw call, thousands of particles at 1080p |
| Audio — Mood Engine | Tone.js (AV Display renderer only) | BPM-accurate Transport clock, downbeat stem scheduling |
| Audio — Video | Web Audio API / HTMLVideoElement | Locked to video frames natively |
| Audio — SFX Soundboard | Web Audio API + PannerNode | Spatial-ready, x/y map coordinates → surround placement |

### 4.3 Resolution Strategy

**Launch at 1080p. Architect resolution-agnostically.**

- 1080p is roughly 1/4 the pixels of 4K - dramatically wider hardware support
- Scaling 4K source video to 1080p output is essentially free on GPU (and produces better quality via supersampling)
- All compositing work happens *after* downscale - overlays and particles run at 1080p cost
- Never hardcode resolution:

```js
const OUTPUT_CONFIG = {
  width: 1920,
  height: 1080,
  // Bump to 3840x2160 for future 4K unlock
}
```

- Unlock 4K as a **premium feature** post-launch
- Dual 4K outputs create significant GPU memory pressure - limit to single output at launch

### 4.4 PixiJS Layer Stack

```
Stage
  |-- Background Layer    → Background video engine (VideoTexture from WebCodecs)
  |-- Game Board Layer    → Game board video engine (VideoTexture from WebCodecs)
  |-- Fog Layer           → Bitmap fog of war (FogOfWar: OffscreenCanvas → PixiJS Sprite via CanvasSource)
  |-- FX Layer            → WebM loops (fog, smoke) as VideoTextures
  |-- Overlay Layer       → Static/animated image overlays
  |-- Particle Layer      → PixiJS ParticleContainer (rain, snow, ash, embers)
  |-- Color Grade Layer   → GLSL filter (applied to full stage)
  +-- UI Layer            → Combat tracker overlay, ping indicators
```

Each layer is a PixiJS Container — independently toggleable, reorderable, and opacity-adjustable.

#### Role-Based Layer Rendering

When AV outputs use the one-display-one-role model (Section 4.10), each output window renders only its assigned layers:

| Layer | BG Output | GB Output |
|-------|-----------|-----------|
| Background | Yes | — |
| Game Board | — | Yes |
| Fog | — | Yes |
| FX | Yes | — |
| Overlay | — | Yes |
| Particle | Yes | — |
| Color Grade | Yes (independent) | Yes (independent) |
| UI | — | Yes |

Audio systems (MoodEngine, SFXSoundboard) run exclusively on the BG output. The GB output is silent.

### 4.4.1 Dual Video Engine Architecture

The AV pipeline runs **two independent video engines** — one for the scene background and one for the tactical game board. They are **identical in implementation** (same class, same WebCodecs pipeline) but operate as separate instances on separate layers.

| Engine | Layer | Active When |
|---|---|---|
| **Background Video Engine** | `background` (bottom) | Always — ambient scene loops (campfire, dungeon, forest, sea) |
| **Game Board Video Engine** | `gameboard` (above background, below FX) | DM activates map mode — shows tactical map video/image |

The DM can show background only, game board only, or both simultaneously (e.g., animated map over ambient backdrop). The game board layer sits above the background so it composites on top. Both engines are controlled independently from the AV Tab in the cockpit.

**Implementation note:** Both use the same `VideoEngine` class. `LayerStack` holds two named instances: `engines.background` and `engines.gameboard`. Both feed WebCodecs-decoded frames to their respective PixiJS `VideoTexture`.

### 4.5 Video Decode Pipeline (per engine)

Both the Background Video Engine and the Game Board Video Engine use this identical pipeline:

```
[Video Source (up to 4K)]
      |
[Decode via WebCodecs → GPU texture at native res]
      |
[Downsample to 1080p framebuffer]
      |
[Apply layers, overlays, particles, color correction]  ← all at 1080p cost
      |
[Output to AV Display BrowserWindow]
```

The two engines run concurrently and independently. Each manages its own `VideoDecoder`, `VideoFrame` queue, and `PixiJS VideoTexture`.

### 4.6 Pre-rendered FX (WebM Loops)

- VP9 + alpha channel WebM for fog, smoke, and complex volumetric effects
- Full transparency compositing over video backgrounds
- Hardware decoded, lands directly on GPU as texture
- Build a **per-clip loop offset parameter** to handle stutter at loop points without re-encoding
- PixiJS VideoTexture accepts WebM loops natively - entire compositing stack lives in one scene graph

### 4.7 Particle Presets

Use ParticleContainer (not regular Container) for single draw call performance. Use a **texture atlas/spritesheet** for all particle sprites - one texture bind for all types.

Launch presets: **Rain, Snow, Ash, Embers, Dust, Fog**

### 4.8 Color Correction

Applied as a PixiJS filter (GLSL shader) to the entire stage:

```js
const colorGradeFilter = new PIXI.Filter(vertexSrc, fragmentSrc, uniforms);
app.stage.filters = [colorGradeFilter];

// Uniforms
uniforms: {
  brightness, contrast, saturation,
  temperature, tint,
  liftGammaGain  // cinematic grading
}
```

Controlled via sliders on the cockpit - adjustments sync to the AV display in real time.

### 4.9 External Monitor Output

- Second BrowserWindow positioned on external display, set to fullscreen
- Each window has its own WebGL context - renders independently
- Use OffscreenCanvas for shared resources between contexts if needed
- Genlock/frame-accurate sync between outputs is not achievable in Electron - not needed for this use case

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

## 5. Audio Architecture

### 5.1 Three Independent Audio Systems

These systems do not sync to each other and operate completely independently. This is intentional — video can cut or crossfade freely without disrupting the mood engine, and SFX clips trigger instantly without waiting on musical timing.

**System 1 - Video Audio**
- Handled automatically by WebCodecs / HTMLVideoElement
- Audio stays locked to video frames natively — sync is free
- Master volume and mute controls
- No additional architecture needed

**System 2 - Procedural Mood Engine (Tone.js)**
- Driven by the Mood Slider + scene variables
- Uses Tone.js Transport as the BPM-aware clock (built on Web Audio API internally)
- Downbeat-accurate stem scheduling: stem swaps are queued on measure boundaries, never at arbitrary points
- No video timecode dependency
- Crossfades audio stems as mood changes — never hard-cuts between states

**System 3 - SFX Soundboard (Web Audio API)**
- Standalone one-shot and looping clip trigger system
- Completely independent of the mood engine and video audio
- Every clip routes through a `PannerNode` — even when spatial values are neutral
- Designed for spatial audio from day one: `SFXClip.spatial` exposes `{ x, y }` as normalized map coordinates (0–1)
- Internal mapping: map `x` → `PannerNode.positionX` (-1 to +1, left→right); map `y` → `PannerNode.positionZ` (-1 to +1, front→rear); `PannerNode.positionY` fixed at 0
- `AudioContext.listener` is fixed at room center
- On stereo output: left/right panning only. On surround (5.1/7.1): full room placement via OS routing

### 5.2 The Mood Slider

A single linear slider on the cockpit - calm to dramatic. Intentionally minimal. The DM moves it as encounter tension escalates, and everything in the mood engine responds.

```js
const moodEngine = {
  currentMood: 0,       // 0.0 to 1.0 (calm to dramatic)
  variables: {
    timeOfDay,          // dawn / day / dusk / night
    weather,            // clear / rain / storm
    intensity,          // calm / tense / dramatic
  }
}
```

Variable combinations map to audio layer weights. Stems **crossfade** rather than tracks swapping - smooth, natural transitions.

**Mood Mapping (Launch Implementation):**
- **0.0-0.3 (Calm):** Soft melody stems only, percussion muted
- **0.3-0.7 (Neutral/Tense):** Light percussion introduced, medium melody stems crossfade in
- **0.7-1.0 (Dramatic):** Full percussion, heavy bass stems, high intensity
- Stem swaps scheduled on the downbeat of the next musical measure (e.g., every 8 bars) to avoid awkward cuts

**Post-launch expansion:** Multi-axis control (tension, energy, atmosphere) as an advanced option.

### 5.3 Environmental Audio Link

Environmental controls (e.g., rain particle toggle) also drive ambient SFX layers in the mood engine. Turning on rain particles simultaneously fades in a rain ambient audio bed.

### 5.4 SFX Soundboard — Spatial Audio Model

```typescript
interface SFXClip {
  id: string;
  label: string;          // e.g. "Thunder Crack", "Door Creak"
  filePath: string;
  loop: boolean;
  volume: number;         // 0.0–1.0
  spatial?: {
    x: number;            // normalized map X (0–1), maps to left→right
    y: number;            // normalized map Y (0–1), maps to front→rear
  };
}
```

All SFX triggers route through a `PannerNode`. When `spatial` is undefined, `PannerNode` defaults to center-neutral (no panning effect). Spatial audio is activated by providing coordinates — no architectural change required at that point.

Future: Map Ping tool and Scene Trigger events can carry spatial coordinates, placing SFX precisely in the room from a map tap.

---

## 6. Core Data Models

### 6.1 Campaign

```js
const campaign = {
  id,
  name,                     // "Curse of Strahd"
  system: "5e",             // drives reference content and sheet templates

  world: {
    locations: [],
    factions: [],
    lore: [],               // indexed from import
  },

  characters: {
    playerCharacters: [],   // full character sheets
    npcs: [],               // stat blocks + personality + notes
  },

  scenes: [],               // AV scene configs with branching

  sessions: [
    {
      id,
      date,
      notes: "",
      combatLogs: [],
    }
  ],

  importSources: [],        // watched vault/folder paths
}
```

### 6.2 Scene

```js
const scene = {
  id,
  name,                     // "Tavern - The Rusty Flagon"

  // AV State (everything needed to reproduce atmosphere)
  backgroundVideo,          // video or image path
  overlays: [],             // active WebM FX layers
  particles: {
    type: 'none',           // rain / snow / ash / embers / dust / fog / none
    intensity: 0.5,
  },
  colorGrade: {
    brightness, contrast, saturation,
    temperature, tint,
    liftGammaGain,
  },
  audioMood: 0.3,           // default mood slider position

  // Campaign Data
  notes: "",                // DEPRECATED — use Note entities via scene_notes junction
  scratchpad: "",           // Per-scene DM session notes (survives re-imports)
  linkedNPCs: [],
  linkedLocations: [],

  // Branching
  branches: [
    {
      label: "Tavern (Peaceful)",
      targetSceneId: "scene_12",
      transitionNote: "Don't forget: Aldric has the key now",
    },
  ],
}
```

### 6.3 Rule System (System-Agnostic Layer)

```js
const ruleSystem = {
  id: '5e',
  name: 'D&D 5th Edition',

  reference: {
    spells: [],
    monsters: [],
    conditions: [],
    classes: [],
    items: [],
  },

  characterSheet: {
    template: '5e-sheet',
    stats: ['STR','DEX','CON','INT','WIS','CHA'],
  },

  combatRules: {
    initiativeType: 'd20+DEX',
    hasAdvantage: true,
    actionTypes: ['action', 'bonus', 'reaction', 'free'],
  }
}
```

Keeping rule systems as plugin objects means adding Pathfinder 2e, Call of Cthulhu, etc. is a new ruleset file, not a refactor.

### 6.4 Note

A Note is a standalone content entity that attaches to scenes via a many-to-many relationship. Notes hold the DM's authored content — lore, instructions, reference material — while scenes own their AV state, branches, and per-session scratchpad.

```js
const note = {
  id,
  campaignId,
  title: "The Dragon's Hoard",
  type: 'scene',            // 'scene' | 'location' | 'npc' | 'lore' | 'general'
  body: "# The Dragon's Hoard\n\nThe chamber floor is...",  // Markdown content
  tags: ['act2', 'dungeon', 'boss'],
  sourceFile: '/path/to/vault/Scenes/dragons_hoard.md',     // null if created in-app
  createdAt,
  updatedAt,
}
```

**Key design rules:**
- A Note can be linked to **multiple scenes** (e.g., a location description used in three encounters)
- A Scene can have **multiple notes** linked (e.g., lore + NPC reference)
- A Scene with **no notes** is fully valid — it works with only AV triggers and branches
- The `scratchpad` field lives on the **Scene**, not the Note — it is per-scene session context
- When a note is first linked to a scene, the **note title populates the scene name** (the DM can rename after)
- On Obsidian re-import, `body` and `tags` update but **scratchpad is never overwritten**
- Notes are **cockpit-only content** — they never sync to the AV Display

---

## 7. Feature Set

### Feature Hierarchy

```
Campaign Manager  (the brain)
        |
Scene System      (the bridge)
        |
AV Output         (the atmosphere)
```

The AV system serves the scene system, which serves the campaign manager. **Never let the atmosphere layer eat the development roadmap.**

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

### 7.2 Table-Time Cockpit UI

The primary interface during live play. Every interaction must be zero friction.

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

### 7.3 Prep Mode vs Play Mode

Two distinct UI states, selectable at launch or switchable during a session:

- **Prep Mode** - Full editing, world building, session planning, import management, scene authoring. No AV output required. Includes **Scene Recorder** (see below).
- **Play Mode** - Read-optimized, fast access, minimal UI noise. AV rendering active. Every element optimized for speed under pressure.

#### 7.3.1 Scene Recorder (Plan Mode Feature)

Plan Mode includes a **Scene Recorder** — a persistent record button visible from all screens/tabs while in Plan Mode. The recorder captures the DM's selections across the entire cockpit UI and writes them back to a scene definition, functioning like a macro recorder at the scene level.

**Workflow:**
1. DM enters Plan Mode and selects (or creates) the scene they want to configure
2. A persistent **Record** button appears in a fixed position, visible from every tab
3. DM navigates through tabs and makes selections: background media, game board image, weather effects, intensity levels, NPCs, items, notes, mood settings, etc.
4. Each selection is captured as a recorded action (not granular keystroke-level — just the selected values/assets)
5. DM clicks **Save to Scene** to write all recorded actions back to the scene definition

**What gets recorded (selection-level, not keystroke-level):**
- Background media selection (image/video)
- Game Board media selection
- Weather/particle effect selections and intensity
- Mood engine settings (intensity slider value, stem selections)
- NPC assignments to the scene
- Item placements
- Notes linked to the scene
- Combat encounter setup (if configured)
- Color grade / overlay settings
- SFX assignments

**Key design points:**
- The recorder is **only visible in Plan Mode** — never shown during Play Mode
- It captures *what was selected*, not *how* (no undo history, no keystroke replay)
- This is scene-authoring-by-doing: instead of filling out a scene config form, the DM just sets things up as if they were running the session, then saves the result
- The Record button should be non-intrusive but always accessible (floating action button or fixed toolbar element)

### 7.4 Combat Tracker (Highest Priority Feature)

DMs live in this panel during encounters. Must be bulletproof.

**Cockpit View (DM):**
- Initiative order with drag-to-reorder
- HP tracking with quick +/- buttons (not manual typing)
- Conditions as one-click toggles (poisoned, stunned, prone, etc.)
- Full monster stat blocks: AC, attacks, abilities
- Quick-math buttons (e.g., -14 HP)
- Round counter
- One-click link from combatant to full stat block and attacks
- Linked to NPC data

**AV Display View (Players):**
- Sleek, transparent overlay on the atmosphere
- Character portraits and initiative order only
- **No monster HP visible** - DM controls what players see
- Turn highlighting with subtle audio cue on turn change

### 7.5 Scene Management and Branching

**The Problem:** DMs prepare multiple paths (e.g., "fight the guards" vs. "bribe the guards"), but linear scene lists force frantic scrolling mid-session.

**The Solution:** A card-based scene flow with outcome-aware branching.

**Scenes Tab — Card-Based Flow:**
- Each scene is a visual card showing title, linked note count, branch count, and active indicator
- Cards are **draggable** for reordering during prep
- Clicking a card **expands it inline** to show full details:
  - Linked Notes (with link/unlink controls)
  - Scratchpad (per-scene session notes)
  - Branches (labeled outcomes with optional transition notes)
  - AV Preview (particles, mood, color summary) + Load/Save buttons
  - Outcome Navigator (during play: choice buttons for each branch)

**Outcome-Based Navigation During Play:**
- **0 branches:** No outcome navigator — DM uses manual scene selection
- **1 branch:** A single "Next: [label]" button
- **2+ branches:** Labeled choice buttons — the DM taps the outcome that happened
- Each branch can carry a **transition note** — a brief DM reminder ("Don't forget: Aldric now has the key") shown as a toast when transitioning
- Tapping a branch instantly loads all visual, audio, and tracker data for the target scene

**Branching is purely additive.** A DM who doesn't use it never sees it. A scene with no branches works exactly like it does today.

### 7.6 Scene Triggers (Macro Buttons)

The DM can embed triggers directly in their markdown notes:

```markdown
The party enters the throne room. The king rises from his seat.

[Trigger: Boss Music]
[Trigger: Ash Storm]
[Trigger: Dim Lights]
```

These render as **clickable buttons** in the cockpit that instantly fire commands to the AV engine. Zero context-switching - the DM reads their notes and fires atmosphere changes inline.

Scene Triggers are authored inline in note markdown content. The `[Trigger: Label]` syntax renders as clickable amber buttons in the cockpit. The rich markdown editor (CodeMirror 6) provides syntax highlighting for trigger syntax.

Triggers are broadcast via Socket.io to all cockpit clients for multi-device sync.

### 7.7 Interactive Map Tools

**Bitmap Fog of War:**
- **Cockpit (DM):** HTML5 Canvas overlay on the game board preview. Free-form brush painting with selectable brush sizes (small/medium/large). Reveal mode erases fog; conceal mode paints it back. Enlarge button opens a full-screen painting modal (CSS class toggle preserves canvas state). Auto-saves as base64 PNG on stroke end (500ms debounce).
- **AV Display (Players):** PixiJS `FogOfWar` on the fog layer (above game board, below FX). Graphics overlay with erase blend mode for reveal strokes. Opaque black wherever fog covers.
- **Data flow:** Cockpit paints on Canvas → normalized 0–1 coordinates sent via `FOG_BRUSH` for incremental strokes → periodically sends full PNG bitmap via `FOG_UPDATE` → AV renderer scales back to OUTPUT_CONFIG dimensions.
- **Storage:** PNG blob stored per scene in SQLite (`fog_data` column). `fog_enabled` toggle per scene.
- **Socket events:** `FOG_UPDATE`, `FOG_BRUSH`, `FOG_TOGGLE`, `FOG_RESET`

**The Ping Tool:**
- DM taps a point on their cockpit map view
- AV display shows an animated crosshair/sonar ripple at those coordinates
- Draws players' eyes to a specific location without verbal direction

### 7.8 Import System

Treat imports as **read + index**, not convert. The source of truth stays in the DM's existing tool.

**Two import paths:**

| Path | Use Case | UX |
|------|----------|-----|
| **Single file** | Drop one note in quickly | Drag-and-drop or file picker |
| **Vault folder** | Bulk import an Obsidian vault | Browse folder, scan recursively |

**Frontmatter recognition:**

```yaml
---
type: scene
trigger_1: Thunder|sfx|thunder
trigger_2: Tense Music|mood|0.8
tags:
  - act2
  - dungeon
---
```

| Frontmatter `type` | Import behavior |
|---------------------|-----------------|
| `scene` | Creates a Note entity + optionally auto-creates a Scene (toggle) |
| `npc` | Creates a Note entity + creates an NPC record |
| `location` | Creates a Note entity |
| `lore` | Creates a Note entity |
| (none) | Creates a Note entity of type `general` |

**Re-import merge rules:**
- Match existing notes by `sourceFile` path
- Update `body` and `tags` from the file
- **Never overwrite** scratchpad (lives on Scene, not Note)
- Preserve manually renamed titles
- Deleted notes are re-created (no tombstone tracking)

**Auto-create scenes toggle:** When enabled (default), `type: scene` notes auto-create a Scene with the note title as the scene name. When disabled, all imports create only Note entities — the DM links to scenes manually.

**Obsidian live sync is a killer feature.** The DM updates notes between sessions in their vault - the app reflects changes automatically. The moment of "it just found everything" is the primary free-to-paid conversion hook.

### 7.9 5e SRD Reference (Bundled)

- Full D&D 5e SRD available under Creative Commons license
- Bundled directly into the app - no API, no internet dependency
- Works completely offline (critical - venues have terrible wifi)
- Instant local search across all spells, monsters, items, conditions

---

## 8. External Integration and API

### 8.1 REST + Socket.io API

The Express + Socket.io server that hosts the cockpit web UI also serves as a **public control API**. Any tool on the network can connect and send commands.

**Why Socket.io:** Named events replace raw message string parsing. Built-in rooms allow broadcasting to `av-display` clients and `cockpit` clients independently. Auto-reconnect means iPad sleep/wake is transparent to the DM.

**Socket.io Rooms:**
- `av-display` — AV Display BrowserWindow joins this room on connect
- `cockpit` — All cockpit clients (iPad, laptop, browser) join this room
- Server rebroadcasts cockpit commands to `av-display`, and state sync to `cockpit`

Core API surface:
- Scene control (load scene, trigger branch, fire Scene Trigger)
- Mood slider (set value, increment/decrement)
- Particle control (toggle type, set intensity)
- SFX trigger (clip ID + optional spatial coordinates)
- Combat tracker (next turn, adjust HP, add/remove combatant)
- Transport control (play/pause video, mute audio)
- State queries (current scene, mood value, combat state)

### 8.2 Bitfocus Companion Module (Launch Integration)

Companion is the hub that already talks to everything in the TTRPG streamer/creator ecosystem - lights, OBS, audio mixers, camera switchers. A Companion module ships at launch, allowing DMs to:

- Wire physical buttons to scene changes, mood shifts, and combat actions
- Integrate the app into existing Companion button pages alongside OBS, Hue, and audio controls
- Trigger Scene Triggers from hardware without touching the cockpit UI

The Companion module connects to the same Express + Socket.io server the cockpit uses.

### 8.3 Elgato Stream Deck Plugin (Fast Follow)

Native Stream Deck plugin as a post-launch priority. Many DMs already have Stream Decks on their table. The plugin would expose the same core actions (scene switching, mood control, combat tracker) as native Stream Deck buttons with custom icons.

### 8.4 Third-Party Extensibility

Because the API is open on the LAN, advanced users can build their own integrations:
- MIDI controllers for mood/color grade sliders
- Philips Hue or LIFX lighting tied to scene atmosphere
- OBS scene switching synced to in-app scene changes
- Custom scripts and automation

---

## 9. Authentication and Licensing

### 9.1 Offline-First Philosophy

The app is designed for venues with unreliable or no internet. The auth system must **never** prevent a DM from running their game.

### 9.2 License States

| State | Condition | Behavior |
|---|---|---|
| **Active** | Valid cached token, within TTL | Full access to all features, store, and updates |
| **Grace** | Expired token, offline | Full functionality. No access to community store, marketplace, or updates |
| **Lapsed** | Online but subscription expired | Prompt renewal. Premium AV features restricted. Free-tier features always available. Campaign data never locked or deleted |

### 9.3 Core Rules

- The app **phones home when it can**, caches a valid license token locally with a configurable TTL
- The app **never** interrupts a live session for license reasons - not even a notification
- If the DM goes permanently offline and never renews, the app continues to function with whatever content and features they had. They lose access to the community store, marketplace, and future updates only.
- License renewal happens **only when the app detects connectivity** - never blocks, never nags during play
- Campaign data belongs to the DM. It is never locked, encrypted against them, or held hostage by license state.

---

## 10. Content Strategy

### 10.1 Launch Environment List

Core D&D 5e location archetypes - finite and achievable:

| Environment | Weather/Atmosphere Variants |
|---|---|
| Tavern | Clear, Rain, Storm - Day/Night |
| Dungeon / Cave | Clear, Foggy, Dripping |
| Forest / Wilderness | Clear, Rain, Storm, Snow, Foggy |
| City / Urban | Clear, Rain, Storm, Night |
| Castle / Keep | Clear, Stormy, Foggy |
| Underdark | Unique FX palette |
| Coastal / Ocean | Clear, Rain, Storm |
| Mountains | Clear, Snow, Storm, Foggy |

### 10.2 Per-Scene Asset Requirements

Each environment needs:
- Looping background video(s)
- 2-3 WebM overlay options (fog, mist, atmosphere)
- Audio mood stems covering calm-to-dramatic range
- Default particle and color correction preset
- Scene preset wired into the app

### 10.3 Content Production Pipeline

```
Scene Brief
    |
Art/Video -> background video + WebM overlays
    |
Audio -> mood stems for environment
    |
Dev -> wire into scene preset in app
    |
QA -> playtest at an actual table in real game conditions
```

> **Critical:** Test atmosphere in a real dimly-lit game room. Things that look great on a monitor can feel wrong in actual play conditions.

---

## 11. Business Model

### 11.1 Free Tier - The Complete DM Tool

Genuinely good, not crippled. Builds trust and word of mouth.
- Full campaign management
- Character sheets, NPCs, combat tracker
- 5e SRD reference (bundled, offline)
- Obsidian / markdown import with live sync
- Basic scene management

### 11.2 Subscription - The Atmosphere Layer

The AV system is the natural paywall - most expensive to maintain, appeals to DMs running immersive setups.
- Full AV output system (PixiJS compositor, WebCodecs, multi-monitor)
- WebM overlay library
- Particle systems and color correction controls
- Procedural mood engine and audio packs
- Multi-scene transitions and branching
- Community store and marketplace access
- Future: 4K output unlock

### 11.3 Pricing Structure

```
Free tier        - Core campaign management, forever
$5-7 / month     - Atmosphere (AV system, overlays, particles, audio)
$10-12 / month   - Atmosphere + premium content packs
Lifetime deal    - Strong appeal in TTRPG community, excellent for launch cash flow
```

### 11.4 Content Packs (Additional Revenue)

Themed scene packs sold separately or bundled in higher subscription tier. Eventually: community-created packs with revenue share model.

### 11.5 Electron Advantage for Monetization

- No app store cut - full billing control
- Stripe or Paddle for desktop subscriptions
- License keys straightforward to implement

---

## 12. Technical Stack Summary

| Layer | Technology |
|---|---|
| Desktop wrapper | Electron |
| Frontend runtime | Node.js / Web stack (React + TypeScript) |
| Rendering / compositing | PixiJS (WebGL) |
| Video decode | WebCodecs API |
| Particle systems | PixiJS ParticleContainer |
| Color correction | GLSL shaders via PixiJS filters |
| Pre-rendered FX | VP9 + alpha WebM loops |
| Audio — Mood Engine | Tone.js (AV Display renderer only) |
| Audio — Video | Web Audio API / HTMLVideoElement |
| Audio — SFX Soundboard | Web Audio API + PannerNode (spatial-ready) |
| Multi-threading | Worker Threads (main process) + Web Workers (renderer) |
| Local database | SQLite (better-sqlite3) |
| State management | Zustand (one store per domain, central sync.ts for WebSocket broadcast) |
| API layer | Express + Socket.io (named events, rooms for AV Display vs cockpit clients, auto-reconnect) |
| External integration | Bitfocus Companion module (launch), Stream Deck plugin (fast follow) |
| Notes editor | CodeMirror 6 (same engine as Obsidian) — markdown syntax, dark theme |
| Icons | Phosphor Icons — clean weight-adjustable icons for mode cards and UI elements |
| QR Code | `qrcode` npm package — generates QR code SVG for Host on LAN mode |
| Styling | Custom CSS design system — CSS custom properties, BEM-like classes, single `index.css` stylesheet |

### 12.1 Design System

The cockpit UI uses a **custom CSS design system** with no external CSS frameworks. All styling flows through CSS custom properties defined in `src/ui/index.css`.

**Token categories:**
- **Colors:** 19 color tokens (backgrounds, surfaces, borders, text, accent, semantic) + opacity variants for overlays and glows
- **Spacing:** 7-step scale (`--space-1` through `--space-8`: 4px to 32px)
- **Typography:** Inter font family, 6-step type scale (`--text-xs` through `--text-2xl`: 11px to 24px)
- **Radius:** 5 variants (`--radius-sm` through `--radius-full`)
- **Transitions:** 3 speeds (fast 0.1s, base 0.15s, slow 0.25s)
- **Shadows:** 3 depths (sm, md, lg)
- **Tap target:** 44px minimum (Apple HIG compliance)

**Design principles:**
- Dark theme native — all colors assume near-black background
- Touch-optimized — 44px minimum interactive targets
- Device-agnostic — responsive breakpoints at 767px, 1024px
- No framework bloat — pure CSS, no Tailwind/CSS-in-JS
- BEM-like class naming: `.component__element--modifier`

**Reference:** See `planning/Overhaul/UI/css-unification-spec.md` for the complete token inventory, audit findings, and extraction backlog.

### Recommended Folder Structure

```
/src
  /core            - campaign data, state management, data models
  /systems         - combat, audio, av, import, mood engine
  /ui              - components, screens, tabs (shared between local + web cockpit)
  /reference       - bundled 5e SRD data
  /assets          - scene content, audio packs, particle presets
  /api             - REST + WebSocket server, route handlers
  /integrations    - Companion module, Stream Deck plugin
/electron          - main process, window management, IPC bridge
```

---

## 13. Multi-Core Strategy

Node.js is single-threaded by default but multiple cores are accessible:

| Use Case | Approach |
|---|---|
| CPU-intensive computation (procedural generation) | Worker Threads (worker_threads) |
| Running isolated tasks/scripts | Child Process (child_process) |
| Keeping the render thread responsive | Web Workers (renderer process) |

Worker Threads are the primary tool - feeding procedural generation data to the GPU pipeline without blocking the UI.

---

## 14. Known Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Dual 4K GPU memory pressure | Limit to single 1080p output at launch, unlock 4K later |
| WebM loop stutter at loop point | Build per-clip loop offset parameter |
| Video decode bottleneck at 4K | Defer 4K to post-launch, validate WebCodecs limits early |
| Scope creep from AV system | Enforce feature hierarchy: Campaign then Scene then AV |
| Content volume for launch | Finite environment list, quality over quantity |
| Native npm module bundling in Electron | Test compiled C++ dependencies (better-sqlite3) early in build |
| Venue wifi unreliability | Offline-first architecture, generous license caching |
| Cockpit latency over LAN | WebSocket for real-time commands, REST for state queries |

---

## 15. Development Roadmap

### Post-Sprint UI Gate

After every sprint, before moving to the next, run a CSS consistency check:
- No new hardcoded colors in CSS or TSX files (all values reference `var(--token)`)
- No new `!important` rules
- New form inputs use `.form-input` / `.form-select` shared classes
- All inline `style={}` props use token references, not raw pixel/color values
- No new duplicated style objects across components

See `planning/Overhaul/UI/css-unification-spec.md` for the full checklist.

### Sprint History

> Full details for every sprint: `planning/Sprints.md`

**819 tests passing across 46 test files.**

#### Foundation (Sprints 0-7b)
- [x] Sprint 0 — Scaffolding (monorepo, auth, Express + Socket.io, SQLite)
- [x] Sprint 1 — Local Bridge & State Sync (cockpit shell, Zustand stores, sync layer)
- [x] Sprint 2 — Visual Engine & Maps (PixiJS, WebCodecs, particles, fog, color grade)
- [x] Sprint 3 — Mood Engine (Tone.js, BPM-accurate crossfades)
- [x] Sprint 4 — TTRPG Tools & Database (combat tracker, notes, scenes, NPCs, Obsidian import)
- [x] Sprint 5 — Content & Reference (5e SRD, environment presets)
- [x] Sprint 6 — External Integration (Bitfocus Companion, Stream Deck)
- [x] Sprint 6a — Boot-Up Experience + Real SFX (LaunchScreen, SFX soundboard, port detection)
- [x] Sprint 7a/7b — Performance + Real-Time Preview (perf monitoring, canvas preview pipeline)

#### Notes & Scenes Overhaul (Sprint 8)
- [x] Sprint 8a — Notes Data Model (migration, CRUD, junction table)
- [x] Sprint 8b — Notes REST API (9 endpoints, bulk links)
- [x] Sprint 8c — Notes Store + Sync (Zustand, 6 socket events)
- [x] Sprint 8d — Notes Tab UI + CodeMirror 6 (split-pane editor, trigger decorations)
- [x] Sprint 8e — Import Pipeline Overhaul (Note entities, re-import merge, single-file import)
- [x] Sprint 8f — Scenes Tab (card layout, SceneAdvancer, drag-to-reorder)

#### Startup Sequence Overhaul (Sprint 9)
- [x] Sprint 9a — Launch Screen UI (two-column card, mode selection)
- [x] Sprint 9b — AV Output Management (user-enabled outputs, display detection, role tagging)
- [x] Sprint 9c — Transition & Polish (fade-through-black, QR code, error handling)
- [x] Sprint 9d — Logo & Branding (placeholder SVG logo)
- [x] Sprint 9 — Polish Pass + Dev Startup Fix + CSS Unification Phase 1

#### Dashboard Overhaul (Sprint 10)
- [x] Sprint 10a-10f — Data model, 3-column layout, quick-access, timeline, notes strip, dice roller
- [x] Sprint 10g-10i — Fog of War (data model, cockpit canvas, AV renderer)
- [x] Sprint 10j — Cinematic Launch Intro

#### Player Companion MVP (Sprints 11-14)
- [x] Sprint 11 — Build infrastructure, join flow, session tokens
- [x] Sprint 12 — Lobby system, ready check, Go Live
- [x] Sprint 13 — Player dashboard (HP, conditions, inventory, dice, whispers)
- [x] Sprint 14 — DM Players tab (per-player controls, broadcast, combat sync)

#### Notes Phase 1 + Media + Polish
- [x] Sprint 15 — Notes System Phase 1 (wikilinks, backlinks, color coding, smart import, item entities)
- [x] Media Library — Asset management, MediaPicker, scene-based loading
- [x] Post-Sprint Polish — 17 bug fixes across 3 phases + live testing
- [x] Code Cleanup — Orphaned code removal, AV Display fixes, independent BG/GB color grading

#### v0.6 Release Polish (Sprint 17)
- [x] Sprint 17a — Cleanup + Launch Screen Polish (error boundary, skip intro, inline styles 59->11)
- [x] Sprint 17b — Per-Tab Polish (combat pulse, sticky headers, empty states, tooltips)
- [ ] Sprint 17c — Ambient Audio Engine (BLOCKED — OGG audio files needed)
- [x] Sprint 17d — Companion Polish
- [ ] Sprint 17e — Demo Token + Packaging (NEXT after 17c)

#### Program/Preview Playback (Sprint 18)
- [x] Sprint 18a — Video buffering fix (canplaythrough, fade-in, abort)
- [x] Sprint 18b — Cued scene + preview notes (takeScene, autoCue, TAKE button)
- [x] Sprint 18c — A/B deck video engine (DeckPair, preload/take/cold-load)
- [x] Sprint 18d — TAKE crossfade (RAF animation, cancel mid-crossfade)
- [x] Sprint 18e — Vertical slider overhaul (VerticalFader, bipolar mode, ColorGradeCard)
- [x] Sprint 18f — Transport bar (CUE/TAKE above timeline, useClickOutside, useScenes lifted)

#### Overhaul TODO Cleanup
- [x] Sprint 16c — Quick Items widget, Campaign Home, import pipeline, Express body limit

---

## 16. Backlog & Next Steps

> Full feature specs: `planning/Backlog.md`

### Quick Wins / Polish
- [ ] Item states in Quick Reference (Hidden/Loot/Acquired) — needs DB migration
- [ ] Dashboard notes strip empty on initial scene load (bug — likely fetch timing)
- [ ] SFX Tab overhaul
- [ ] Notes Tab UI polish
- [ ] Spell search history + pinned spells
- [ ] Player dashboard UI improvements
- [ ] Scene "Ready" indicator

### Multi-Task Features
- [ ] Scene Save System (Prep Mode) — full state capture + visual receipt
- [ ] Scene Preview on Dashboard — partial (Sprint 18 did cued scene; full preview panel pending)
- [ ] Scene Transitions — partial (Sprint 18d did crossfade; transition type selection pending)
- [ ] Scene Intro Videos — optional pre-scene cinematic playback
- [ ] "What's Different?" Scene Diff Toast
- [ ] Item Acquisition -> Session Log Entry
- [ ] Per-Scene Fog of War State — DB ready, cockpit needs save/restore on scene switch
- [ ] Video Engine Layer Audit

### Major Features
- [ ] Notes System Phase 2 — graph view, kanban, split pane, slash commands, full-text search
- [ ] Notes System Phase 3 — canvas view, timeline, AI assist, templates, export
- [ ] UI Per-Tab Polish — dockable panels, theming, micro-interactions, flowcharts
- [ ] Player Companion v2 — character creator, game system configs, persistence, native app
- [ ] Segmented Audio Engine — intro/loop/outro adaptive music with playlist rotation
- [ ] Scene Recorder (Plan Mode) — capture DM selections into scene definitions

---

## 17. Go-To-Market Notes

### Community Strategy
The TTRPG community is deeply passionate and will evangelize a good tool relentlessly. Content creators - streamers, actual play podcasters, YouTubers - are massive free distribution channels. DMs are already frustrated juggling multiple tools and are willing to pay for something that solves the problem.

### Key Early Actions
1. Get a usable beta in front of actual play streamers and popular TTRPG content creators early
2. A single video of someone using it at their table is worth months of marketing
3. The "a DM built this for DMs" story is genuine and resonates strongly
4. Polish the Obsidian import first - the moment of "it just found everything" is the primary conversion hook
5. The Companion/Stream Deck integration is a natural demo moment for streamer audiences

---

**End of Document**
