# Startup Overhaul — Implementation Spec

> Phased implementation plan translating the design decisions from `startup-overhaul-overview.md` into actionable development tasks.

**Prerequisite:** Read `startup-overhaul-overview.md` for full design context and decisions.

---

## Phase 1: Launch Screen UI Overhaul

**Goal:** Replace the current LaunchScreen with the new two-column, card-based design. Merge campaign selection into the launch screen. No AV output changes yet — this phase is UI-only.

### 1.1 — New Zustand State

**File:** `src/ui/stores/app-store.ts`

Add state to support the new launch screen:

```typescript
interface AppState {
    // Existing (keep)
    appMode: AppMode | null      // CHANGE: default from 'play' → null (no pre-selection)
    networkMode: NetworkMode
    isConnected: boolean
    hasLaunched: boolean
    activeCampaignId: string | null
    activeCampaignName: string | null

    // Existing actions (keep)
    setAppMode: (mode: AppMode) => void
    setNetworkMode: (mode: NetworkMode) => void
    setConnected: (connected: boolean) => void
    setLaunched: () => void
    setActiveCampaign: (id: string, name: string) => void
    clearActiveCampaign: () => void
}
```

Key change: `appMode` initial value changes from `'play'` to `null`. The "Start Session" button is disabled until `appMode !== null && activeCampaignId !== null`.

### 1.2 — Install Phosphor Icons

```bash
npm install @phosphor-icons/react
```

Icon mapping for mode cards:
- Headless: `<Broadcast />` or `<Monitor />`
- Play: `<GameController />` or `<PlayCircle />`
- Plan: `<NotePencil />` or `<PencilSimple />`

### 1.3 — Rewrite LaunchScreen Component

**File:** `src/ui/screens/launch-screen.tsx`

**Structure:**
```
launch-screen (full-screen dark bg)
  └─ launch-card (max-width ~780px, two-column)
      ├─ launch-branding (logo SVG + title + subtitle)
      ├─ launch-body (two-column flex)
      │   ├─ launch-col-left (mode selection)
      │   │   ├─ section label: "Mode"
      │   │   ├─ ModeCard × 3 (horizontal row)
      │   │   │   └─ each: icon + name + description
      │   │   │   └─ active card: expanded with network toggle inside
      │   │   └─ (if Host selected: IP + QR code panel)
      │   └─ launch-col-right (campaign selection)
      │       ├─ section label: "Campaign"
      │       ├─ campaign list (compact rows)
      │       │   └─ each: name + system badge + last-played
      │       │   └─ last-used: pre-selected (subtle highlight)
      │       └─ "+ New Campaign" inline form
      ├─ launch-footer
      │   ├─ "Start Session →" button (disabled until mode + campaign selected)
      │   └─ version + license text (bottom-center)
      └─ fade-in animation (opacity 0→1, ~300ms ease-out)
```

**Sub-components to extract:**
- `ModeCard` — icon + label + description + network toggle (when active)
- Campaign list — reuse/adapt logic from existing `campaign-selector.tsx`
- `NewCampaignForm` — extract from `campaign-selector.tsx` (already exists as internal component)

**Network toggle logic within ModeCard:**
- Headless selected → auto-set `networkMode: 'host'`, show note "Headless requires LAN hosting", no toggle
- Plan selected → auto-set `networkMode: 'local'`, hide network toggle entirely
- Play selected → show Local/Host toggle inside the card

**Smart defaults on mode select:**
```typescript
function handleModeSelect(mode: AppMode) {
    setAppMode(mode)
    if (mode === 'headless') setNetworkMode('host')
    if (mode === 'plan') setNetworkMode('local')
    // Play: keep current networkMode selection
}
```

### 1.4 — Campaign Data Fetching on Launch Screen

The launch screen now needs campaign data before the socket is connected. Two options:

**Option A (Electron):** Use IPC `MAIN_CAMPAIGN_LIST` to fetch from SQLite directly (no server needed).
**Option B (Browser dev):** Fetch from REST `GET /api/campaigns` (requires server running).

Since the server starts before the cockpit window loads, REST fetch should work in both cases. Reuse the `fetchCampaigns()` helper from `campaign-selector.tsx`.

**Timing:** Fetch campaigns on launch screen mount. Show loading spinner in the campaign column while fetching.

### 1.5 — "Start Session" Button Logic

```typescript
const canLaunch = appMode !== null && activeCampaignId !== null

function handleStartSession() {
    if (!canLaunch) return
    setLaunchState('loading')  // local state: 'idle' | 'loading' | 'error'
    setLaunched()              // triggers socket connection via useSocketConnection
    // Socket connection + campaign load happens via existing sync.ts flow
    // On success: transition begins (Phase 3)
    // On error: revert to 'error' state, show inline message
}
```

### 1.6 — CSS Updates

**File:** `src/ui/index.css`

- Widen `.launch-card` max-width from 440px → ~780px
- Add two-column flex layout (`.launch-body { display: flex; gap: ... }`)
- Add `.mode-card` styles (vertical card with icon, accent border on active, expand animation)
- Add `.mode-card__network-toggle` (small toggle inside active card)
- Responsive: stack columns vertically below 640px viewport width
- Fade-in: `.launch-card { animation: fadeIn 300ms ease-out; }`
- Move campaign list styles from `.campaign-selector` into `.launch-campaign-list`

### 1.7 — Remove Separate CampaignSelector Screen

**File:** `src/ui/App.tsx`

Remove the `activeCampaignId === null` gate that shows `<CampaignSelector />`. After `hasLaunched`, the app goes directly to the cockpit tabs (campaign is already selected on the launch screen).

```typescript
// BEFORE:
if (!hasLaunched) return <LaunchScreen />
if (activeCampaignId === null) return <CampaignSelector />
return <CockpitShell />

// AFTER:
if (!hasLaunched) return <LaunchScreen />
return <CockpitShell />  // campaign guaranteed selected by launch screen
```

Keep `CampaignSelector` component for potential reuse (e.g., "Switch Campaign" in cockpit header), but remove it from the main gate.

### 1.8 — Update Tests

- Update `app-store` tests: `appMode` default is now `null`, not `'play'`
- Add tests for launch screen campaign fetching
- Test that "Start Session" is disabled when mode or campaign is null
- Test network mode smart defaults (headless → host, plan → local)

---

## Phase 2: AV Output Management

**Goal:** Remove auto-created AV window. Add display detection, user-enabled outputs, and role tagging. This is the most architecturally significant phase.

### 2.1 — New Output Store

**New file:** `src/ui/stores/output-store.ts`

```typescript
interface DisplayInfo {
    id: number           // Electron display id
    label: string        // e.g., "HDMI-2 — Samsung TV"
    width: number
    height: number
    bounds: { x: number; y: number; width: number; height: number }
    internal: boolean    // true for the built-in/primary display
}

type OutputRole = 'BG' | 'GB'

interface OutputConfig {
    displayId: number | 'windowed'    // Electron display ID or 'windowed' for pop-out
    role: OutputRole
    fullscreen: boolean
    active: boolean
}

interface OutputState {
    availableDisplays: DisplayInfo[]
    outputs: {
        BG: OutputConfig | null
        GB: OutputConfig | null
    }

    // Actions
    setDisplays: (displays: DisplayInfo[]) => void
    enableOutput: (displayId: number | 'windowed', role: OutputRole) => void
    disableOutput: (role: OutputRole) => void
    toggleFullscreen: (role: OutputRole) => void
}
```

### 2.2 — New IPC Channels

**File:** `shared/ipc-channels.ts`

Add:
```typescript
// Output management
OUTPUT_LIST_DISPLAYS: 'main:output:listDisplays',
OUTPUT_ENABLE: 'main:output:enable',           // { displayId, role }
OUTPUT_DISABLE: 'main:output:disable',         // { role }
OUTPUT_TOGGLE_FULLSCREEN: 'main:output:fullscreen', // { role }
OUTPUT_DISPLAYS_CHANGED: 'output:displaysChanged',  // main → cockpit (push)
```

### 2.3 — New Socket Events

**File:** `shared/socket-events.ts`

Add:
```typescript
OUTPUT_STATE: 'output:state',         // broadcast current output config
OUTPUT_ENABLE: 'output:enable',       // { displayId, role }
OUTPUT_DISABLE: 'output:disable',     // { role }
OUTPUT_DISPLAYS_CHANGED: 'output:displaysChanged', // push to cockpit clients
```

### 2.4 — Electron Main Process Changes

**File:** `electron/main.ts`

**Remove:**
- Auto-creation of AV window in `app.whenReady()` (`createAVDisplayWindow()` calls)
- AV window creation/destruction from `applyMode()`

**Add:**

```typescript
// Track output windows by role
let outputWindows: { BG: BrowserWindow | null; GB: BrowserWindow | null } = { BG: null, GB: null }

function getAvailableDisplays(): DisplayInfo[] {
    const allDisplays = screen.getAllDisplays()
    const cockpitDisplay = cockpitWindow?.getBounds()
    // Filter out the display the cockpit is on (if identifiable)
    return allDisplays.map((d, i) => ({
        id: d.id,
        label: `Display ${i + 1} (${d.size.width}×${d.size.height})`,
        width: d.size.width,
        height: d.size.height,
        bounds: d.bounds,
        internal: d.internal ?? (i === 0),
    }))
}

function createOutputWindow(displayId: number | 'windowed', role: OutputRole): void {
    if (outputWindows[role]) {
        outputWindows[role]!.destroy()
    }

    let windowOptions: Electron.BrowserWindowConstructorOptions

    if (displayId === 'windowed') {
        // Pop-out window on primary display
        windowOptions = {
            width: 1280, height: 720,
            title: `AV Output — ${role}`,
            fullscreen: false, frame: true,
        }
    } else {
        // Target specific external display
        const display = screen.getAllDisplays().find(d => d.id === displayId)
        if (!display) return
        windowOptions = {
            x: display.bounds.x, y: display.bounds.y,
            width: display.bounds.width, height: display.bounds.height,
            fullscreen: !IS_DEV, frame: IS_DEV,
            title: `AV Output — ${role}`,
        }
    }

    const win = new BrowserWindow({
        ...windowOptions,
        backgroundColor: '#000000',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true, nodeIntegration: false, sandbox: false,
        },
    })

    // Pass role via URL query parameter so the renderer knows what to initialize
    const baseUrl = process.env['ELECTRON_RENDERER_URL'] ?? `file://${join(__dirname, '../renderer/index.html')}`
    win.webContents.loadURL(`${baseUrl}?role=${role}`)

    win.on('closed', () => { outputWindows[role] = null })
    outputWindows[role] = win
}

function destroyOutputWindow(role: OutputRole): void {
    if (outputWindows[role]) {
        outputWindows[role]!.destroy()
    }
}
```

**Display change listener:**
```typescript
screen.on('display-added', () => {
    const displays = getAvailableDisplays()
    cockpitWindow?.webContents.send(IPC.OUTPUT_DISPLAYS_CHANGED, displays)
})
screen.on('display-removed', () => {
    const displays = getAvailableDisplays()
    cockpitWindow?.webContents.send(IPC.OUTPUT_DISPLAYS_CHANGED, displays)
})
```

**New IPC handlers:**
```typescript
ipcMain.handle(IPC.OUTPUT_LIST_DISPLAYS, () => getAvailableDisplays())
ipcMain.handle(IPC.OUTPUT_ENABLE, (_e, displayId, role) => createOutputWindow(displayId, role))
ipcMain.handle(IPC.OUTPUT_DISABLE, (_e, role) => destroyOutputWindow(role))
ipcMain.on(IPC.OUTPUT_TOGGLE_FULLSCREEN, (_e, role) => { /* toggle per-role */ })
```

### 2.5 — AV Display Renderer Role Awareness

**File:** `src/systems/av/main.tsx`

The AV renderer reads its role from the URL query string and only initializes relevant systems:

```typescript
const urlParams = new URLSearchParams(window.location.search)
const role = urlParams.get('role') as 'BG' | 'GB' | null

async function boot() {
    const layerStack = new LayerStack()
    await layerStack.init(canvas)

    if (role === 'BG' || role === null) {
        // Background role: background video + particles + FX + color grade
        const bgEngine = new VideoEngine(layerStack.getLayer('background'))
        const particles = new ParticleSystem(layerStack.getLayer('particle'), atlas)
        const fxPlayer = new FXLoopPlayer(layerStack.getLayer('fx'))
        // Register BG-relevant socket listeners
    }

    if (role === 'GB' || role === null) {
        // GameBoard role: gameboard video + fog + ping + color grade
        const gbEngine = new VideoEngine(layerStack.getLayer('gameboard'))
        const fog = new FogOfWar(layerStack.getLayer('overlay'))
        const ping = new PingTool(layerStack.getLayer('ui'))
        // Register GB-relevant socket listeners
    }
}
```

When `role === null` (fallback/legacy): initialize everything (backward compatible).

### 2.6 — Server-Side Output Proxy (Headless Mode)

**File:** `src/api/server.ts`

Add socket event handlers that proxy output management to Electron main:

```typescript
socket.on(EVENTS.OUTPUT_ENABLE, (payload) => {
    onOutputEnable?.(payload.displayId, payload.role)
    io.to('cockpit').emit(EVENTS.OUTPUT_STATE, getCurrentOutputState())
})
socket.on(EVENTS.OUTPUT_DISABLE, (payload) => {
    onOutputDisable?.(payload.role)
    io.to('cockpit').emit(EVENTS.OUTPUT_STATE, getCurrentOutputState())
})
```

Pass `onOutputEnable` and `onOutputDisable` callbacks from `electron/main.ts` to `createServer()`, same pattern as the existing `applyMode` callback.

### 2.7 — Dashboard Output Cards UI

**File:** `src/ui/tabs/DashboardTab.tsx` (new file, or renamed from `SceneTab.tsx`)

**Outputs section:**
```
┌─ Outputs ─────────────────────────────────────────────┐
│                                                        │
│  ┌──Display Card──────┐  ┌──Display Card──────┐       │
│  │ HDMI-2 Samsung TV  │  │ DP-1 Epson Proj.   │       │
│  │ 1920×1080          │  │ 1280×800            │       │
│  │ [Disabled ▾]       │  │ [BG ▾]              │       │
│  └────────────────────┘  └─────────────────────┘       │
│                                                        │
│  No external displays?  [Pop Out Window ▾]             │
│                          BG | GB                       │
└────────────────────────────────────────────────────────┘
```

Each display card has a dropdown: Disabled / BG / GB. Selecting a role triggers `enableOutput(displayId, role)` via IPC. If a role is already assigned to another display, prompt to reassign.

### 2.8 — AV Tab Full Output Management

**File:** `src/ui/tabs/AVTab.tsx`

Replace the current "Display Window" section with full output management:
- Same display cards as Dashboard but with additional controls:
  - Fullscreen toggle per output
  - Disconnect button
- Keep existing mood slider, particles, and color grade sections

### 2.9 — Update applyMode()

`applyMode()` no longer creates/destroys AV windows. It only manages the cockpit window:

```typescript
function applyMode(newMode: AppConfig['appMode']): void {
    appConfig.appMode = newMode
    const needsCockpit = newMode === 'play' || newMode === 'plan'
    if (needsCockpit && !cockpitWindow) createCockpitWindow()
    else if (!needsCockpit && cockpitWindow) cockpitWindow.destroy()
    // AV outputs are managed independently — no change here
}
```

### 2.10 — Tests

- Test `output-store.ts`: enableOutput, disableOutput, display list updates
- Test display detection IPC roundtrip (mock Electron screen API)
- Test role-based initialization in AV renderer (BG-only vs GB-only)
- Test headless mode output proxy (socket → IPC → window creation)

---

## Phase 3: Transition and Polish

**Goal:** Implement the fade-through-black transition, loading states, error handling, and entry animation.

### 3.1 — Fade-Through-Black Transition

**File:** `src/ui/App.tsx` + new `src/ui/components/ScreenTransition.tsx`

State machine for transition:
```
LaunchScreen (visible)
  → user clicks "Start Session"
  → button shows progress bar ("Starting…")
  → socket connects + campaign data loads
  → launch screen fades to black (opacity 1→0, 200ms)
  → hold black (100ms)
  → cockpit fades in (opacity 0→1, 300ms)
  → transition complete
```

Implementation: CSS animation classes + React state:
```typescript
type TransitionPhase = 'launch' | 'fadeOut' | 'black' | 'fadeIn' | 'cockpit'
```

Use `onAnimationEnd` callbacks to advance phases. The `ScreenTransition` wrapper component handles the animation overlay.

### 3.2 — Progress Bar in Button

**File:** `src/ui/screens/launch-screen.tsx`

The "Start Session" button contains an internal progress bar:
```css
.start-session-btn {
    position: relative;
    overflow: hidden;
}
.start-session-btn__progress {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    background: var(--color-accent-dim);
    transition: width 200ms ease-out;
}
```

Progress stages mapped to width percentages:
- 0%: idle
- 30%: connecting socket
- 60%: confirming mode
- 90%: loading campaign data
- 100%: ready → begin fade transition

Minimum display time: 500ms (prevent flash on instant connect).

### 3.3 — Error Handling

If socket connection fails within a timeout (e.g., 5 seconds):
- Progress bar resets
- Button text reverts to "Start Session →"
- Inline error message appears below button: "Connection failed — server may not be running"
- "Retry" link/button appears
- All launch screen selections are preserved

```typescript
const CONNECT_TIMEOUT_MS = 5000

function handleStartSession() {
    setLaunchState('loading')
    setLaunched()

    const timer = setTimeout(() => {
        if (!useAppStore.getState().isConnected) {
            setLaunchState('error')
            setErrorMsg('Connection timed out — is the server running?')
        }
    }, CONNECT_TIMEOUT_MS)

    // Watch for connection success
    const unsub = useAppStore.subscribe(
        (s) => s.isConnected,
        (connected) => {
            if (connected) {
                clearTimeout(timer)
                unsub()
                beginTransition()
            }
        }
    )
}
```

### 3.4 — Entry Fade-In Animation

```css
@keyframes launchFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
.launch-card {
    animation: launchFadeIn 300ms ease-out;
}
```

### 3.5 — QR Code for Host Mode

When Host on LAN is selected, generate a QR code for the server URL.

**Option A (lightweight):** Use `qrcode` npm package to generate SVG inline.
**Option B (no dependency):** Use a canvas-based QR generator.

Recommend Option A: `npm install qrcode` (small, well-maintained).

Display inside the active mode card when Host is selected:
```
┌─ Play ──────────────┐
│ 🎮 Full cockpit +   │
│    AV display        │
│                      │
│ Network: [Local][Host]│
│                      │
│ ┌─QR─┐ 192.168.1.42 │
│ │    │ :8080         │
│ └────┘               │
└──────────────────────┘
```

### 3.6 — Version + License Display

Bottom-center of launch card:
```typescript
const version = app.getVersion() // via IPC or injected at build time
const license = useLicenseState() // from existing license check

<div className="launch-meta">
    v{version} · {license === 'licensed' ? 'Pro' : 'Free Tier'}
</div>
```

### 3.7 — Tooltip Previews for Mode Cards

On hover (desktop) or long-press (touch), show a tooltip with a mini wireframe:

```
┌─ Play ─────────────────────────────┐
│                                     │
│  ┌─Cockpit─┐     ┌─AV Display─┐   │
│  │ DM UI   │     │ Players    │   │
│  │ (local) │     │ (2nd mon)  │   │
│  └─────────┘     └────────────┘   │
│                                     │
│  Full cockpit + AV on 2nd monitor  │
└─────────────────────────────────────┘
```

Use CSS `::after` pseudo-element or a small tooltip component. Keep it simple — text + box-drawing characters or a tiny SVG.

---

## Phase 4: Tab Restructure + Dashboard

**Goal:** Rename Scene tab → Dashboard, add new Scenes tab, update tab bar and routing.

### 4.1 — Rename SceneTab → DashboardTab

**File:** Rename `src/ui/tabs/SceneTab.tsx` → `src/ui/tabs/DashboardTab.tsx`

Move the existing environment presets, SFX soundboard, and scene-save/load controls into the Dashboard. This is the content that's currently in SceneTab — it becomes the quick-access atmosphere panel.

Add the **Outputs section** (from Phase 2) to the Dashboard.

### 4.2 — Create New ScenesTab

**New file:** `src/ui/tabs/ScenesTab.tsx`

This is the card-based scene flow from the Notes & Scenes overhaul amendment. Placeholder for now — will be fully implemented in Sprint 8 (Notes & Scenes overhaul).

### 4.3 — Update Tab Bar

**File:** `src/ui/components/TabBar.tsx`

Update tab definitions:
```typescript
const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'combat', label: 'Combat' },
    { id: 'npcs', label: 'NPCs' },
    { id: 'spells', label: 'Spells' },
    { id: 'notes', label: 'Notes' },
    { id: 'av', label: 'AV' },
]
```

### 4.4 — Update App.tsx Routing

```typescript
type TabId = 'dashboard' | 'scenes' | 'combat' | 'npcs' | 'spells' | 'notes' | 'av'

const [activeTab, setActiveTab] = useState<TabId>('dashboard')  // default landing

function renderTab() {
    switch (activeTab) {
        case 'dashboard': return <DashboardTab />
        case 'scenes': return <ScenesTab />
        // ... rest unchanged
    }
}
```

### 4.5 — Tests

- Verify default tab is 'dashboard'
- Verify all 7 tabs render without errors
- Verify DashboardTab contains output management section

---

## Phase 5: Logo and Branding

**Goal:** Create the custom SVG logo and finalize branding.

### 5.1 — Logo Design

Create `src/assets/logo.svg` — hybrid theater + TTRPG concept:
- Theater spotlight or curtain element
- D20 or grid reference
- Clean, minimal line art that works at small sizes
- Monochrome with accent color variant

### 5.2 — Replace Emoji Icon

**File:** `src/ui/screens/launch-screen.tsx`

Replace `<span className="launch-icon">⚔</span>` with `<Logo className="launch-logo" />` (inline SVG component).

### 5.3 — Update Window Titles

**File:** `electron/main.ts`

If app name changes, update:
- `title: 'TTRPG Stage Manager — AV Display'`
- `title: 'TTRPG Stage Manager — Cockpit'`

---

## Implementation Order

| Order | Phase | Dependencies | Estimated Scope |
|-------|-------|-------------|-----------------|
| 1 | Phase 1 (Launch Screen UI) | None | ~15 files touched |
| 2 | Phase 4 (Tab Restructure) | Phase 1 (removes CampaignSelector gate) | ~6 files |
| 3 | Phase 2 (AV Output Mgmt) | Phase 4 (Dashboard exists) | ~12 files, new store |
| 4 | Phase 3 (Transition/Polish) | Phase 1 + 2 (full flow exists) | ~5 files |
| 5 | Phase 5 (Branding) | Phase 1 (launch screen exists) | ~3 files |

---

## Key Files Modified

| File | Phase | Changes |
|------|-------|---------|
| `src/ui/screens/launch-screen.tsx` | 1, 3, 5 | Complete rewrite |
| `src/ui/stores/app-store.ts` | 1 | `appMode` default → null |
| `src/ui/App.tsx` | 1, 3, 4 | Remove CampaignSelector gate, add transition, update tab routing |
| `src/ui/index.css` | 1, 3 | New launch screen styles, animations |
| `electron/main.ts` | 2 | Remove auto AV window, add output management, display detection |
| `shared/ipc-channels.ts` | 2 | Add OUTPUT_* channels |
| `shared/socket-events.ts` | 2 | Add OUTPUT_* events |
| `src/ui/stores/output-store.ts` | 2 | **New file** |
| `src/systems/av/main.tsx` | 2 | Role-aware initialization |
| `src/api/server.ts` | 2 | Output proxy for headless mode |
| `src/ui/tabs/DashboardTab.tsx` | 2, 4 | **Renamed** from SceneTab, add outputs section |
| `src/ui/tabs/ScenesTab.tsx` | 4 | **New file** (placeholder) |
| `src/ui/tabs/AVTab.tsx` | 2 | Replace display section with full output management |
| `src/ui/components/TabBar.tsx` | 4 | Add Dashboard + Scenes tabs |
| `src/ui/components/campaign-selector.tsx` | 1 | Extract reusable parts, component stays for "Switch" button |

---

## Verification

After each phase, verify:

1. **Phase 1:** Launch screen renders two columns. Mode cards work with Phosphor icons. Campaign list loads. "Start Session" disabled until mode + campaign selected. Network toggle smart defaults work. Existing tests still pass.

2. **Phase 4:** Dashboard tab is default. All 7 tabs route correctly. ScenesTab placeholder renders.

3. **Phase 2:** No AV window on startup. Displays detected and listed in Dashboard. Enabling BG/GB output creates correct window on correct display. Role parameter reaches AV renderer. Pop-out windows work. Headless mode proxies output commands.

4. **Phase 3:** Fade-through-black plays on session start. Progress bar fills in button. Error handling shows inline message on timeout. Entry fade-in animation plays.

5. **Phase 5:** Logo renders correctly at all sizes. Branding is cohesive.

**End-to-end test:** Open app → see launch screen with logo → select Play mode → Host on LAN → see QR code → select campaign → click "Start Session" → progress bar fills → fade to black → cockpit appears on Dashboard tab → enable BG output on external display → BG-only AV window appears on that display → enable GB pop-out → GB-only windowed display appears.
