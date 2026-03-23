# TTRPG Stage Manager — UI Current State Document

> Reference document for external UI review. Describes every screen, component, and layout in the cockpit and companion apps as of Sprint 17d.

---

## Table of Contents

1. [App Architecture](#app-architecture)
2. [Design System](#design-system)
3. [Cockpit Screens](#cockpit-screens)
4. [Cockpit Tabs (9 total)](#cockpit-tabs)
5. [Companion App](#companion-app)
6. [Reusable Components](#reusable-components)
7. [Animation Library](#animation-library)
8. [State Management](#state-management)
9. [File Reference](#file-reference)

---

## App Architecture

Two separate UIs share a CSS token layer:

| App | Target | Framework | Stylesheet | Entry |
|-----|--------|-----------|------------|-------|
| **Cockpit** | Desktop browser / Electron window | React + TypeScript | `src/ui/index.css` (~8,950 lines) | `src/ui/App.tsx` |
| **Companion** | Mobile browser (phone/tablet) | React + TypeScript | `src/companion/index.css` (~1,217 lines) | `src/companion/App.tsx` |

Both import `shared/design-tokens.css` (~122 lines) for shared CSS custom properties.

**No CSS frameworks.** No Tailwind, no CSS-in-JS, no preprocessors. Plain CSS with custom properties and BEM-like naming.

### App Lifecycle (Cockpit)

```
CinematicIntro (typewriter animation, skippable)
    |
LaunchScreen (mode select + campaign select, two columns)
    |
Cockpit Shell (header + tab bar + tab content + optional player sidebar)
    |
    +-- No campaign selected: CampaignSelector
    +-- Campaign selected, no active scene: Campaign Home
    +-- Campaign selected, active scene: Gameplay Dashboard (3-column)
```

### App Lifecycle (Companion)

```
JoinScreen (character creation form)
    |
LobbyScreen (waiting for DM approval + ready check)
    |
DashboardScreen (live gameplay: HP, abilities, inventory, dice)
    |
EndedScreen (session over placeholder)
```

---

## Design System

### Color Palette

All colors use CSS custom properties from `shared/design-tokens.css`. Dark theme only, no light mode.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#141416` | Main background |
| `--color-surface` | `#1C1C1F` | Primary surface |
| `--color-surface-2` | `#252528` | Secondary surface (cards) |
| `--color-surface-3` | `#2E2E32` | Tertiary surface (hover) |
| `--color-border` | `#35353A` | Soft borders |
| `--color-border-2` | `#45454B` | Stronger borders |
| `--color-text` | `#D4D4D8` | Primary text |
| `--color-text-2` | `#8B8B92` | Secondary text (labels) |
| `--color-text-3` | `#56565C` | Muted text (disabled) |
| `--color-accent` | `#2DD4BF` | Teal accent (active, links, controls) |
| `--color-accent-dim` | `#14B8A6` | Hover accent |
| `--color-accent-glow` | `rgba(45,212,191,0.15)` | Subtle glow backgrounds |
| `--color-success` | `#4ade80` | Green (healthy, positive) |
| `--color-warning` | `#fbbf24` | Amber (caution) |
| `--color-danger` | `#f87171` | Red (errors, critical) |
| `--color-calm` | `#60a5fa` | Blue (mood zone: peaceful) |
| `--color-tense` | `#f59e0b` | Orange (mood zone: tension) |
| `--color-dramatic` | `#ef4444` | Red (mood zone: combat) |

### Typography

- **Font family:** Inter, system-ui, -apple-system, sans-serif
- **Monospace:** Menlo, Consolas, monospace
- **Size scale:** `--text-xs` (11px), `--text-sm` (13px), `--text-base` (15px), `--text-lg` (17px), `--text-xl` (20px), `--text-2xl` (24px)
- **Weights used:** 400 (body), 500 (labels), 600 (card titles), 700 (headings), 800 (large numerals)
- **Labels pattern:** `--text-xs` or `--text-sm`, weight 600, uppercase, letter-spacing 0.04-0.08em

### Spacing Scale

8px base: `--space-1` (4px) through `--space-8` (32px)

### Radius

`--radius-sm` (3px), `--radius-md` (5px), `--radius-lg` (8px), `--radius-xl` (10px), `--radius-full` (9999px)

### Shadows

4 levels (`--shadow-sm` through `--shadow-xl`), heavy alpha for dark-on-dark depth.

### Transitions

`--transition-fast` (0.1s), `--transition-base` (0.15s), `--transition-slow` (0.25s)

### Component Patterns

| Pattern | Class | Notes |
|---------|-------|-------|
| Buttons | `.btn` + `.btn-primary` / `.btn-ghost` / `.btn-danger` / `.btn-secondary` | 44px min-height, teal accent for primary |
| Form inputs | `.form-input` / `.form-select` | Accent border on focus + glow shadow |
| Cards | `.av-card` | 1px border, `.av-card--active` for glow state |
| Empty states | `.tab-placeholder` | Emoji icon + heading + actionable sub-text |
| Compact labels | `.label-caps` | Uppercase, letter-spaced, small |
| Muted text | `.text-muted` | `color-text-2` |

---

## Cockpit Screens

### 1. Cinematic Intro (`src/ui/screens/cinematic-intro.tsx`)

- Full-screen typewriter text animation
- Skippable via localStorage flag (`skipIntro`)
- Skip checkbox on launch screen controls this
- Auto-advances to launch screen after animation completes

### 2. Launch Screen (`src/ui/screens/launch-screen.tsx`)

Two-column layout:

**Left column — Mode Selection:**
- 3 mode cards: Headless / Play / Plan
- Each card has icon, title, description
- Selected card gets accent border
- Network mode toggle (Host/Join) nested inside mode cards (hidden for Plan)

**Right column — Campaign Selection:**
- Campaign list fetched from REST API
- Create new campaign form (name + rule system dropdown)
- Progress bar during connection
- Error display with retry
- QR code panel for companion join URL
- Session code display + copy button
- Version badge
- Logo (placeholder, marked for replacement)
- "Start Session" button: enabled only when campaign selected + connection ready

### 3. Cockpit Shell (main app frame)

```
.cockpit-shell (flex column, full height)
  +-- .cockpit-header (40px, campaign name, session code, connection status, mode toggle)
  +-- .tab-bar (scrollable, 9 tab buttons, active = teal underline)
  +-- .cockpit-main (flex row)
       +-- .tab-content (scrollable, fills remaining space)
       |    +-- ErrorBoundary wraps tab content
       |    +-- Active tab component renders here
       +-- PlayerSidebar (collapsible, 48px collapsed / 320px expanded)
            Only visible when sessionPhase !== 'inactive'
```

---

## Cockpit Tabs

### Tab 1: Dashboard (`src/ui/tabs/DashboardTab.tsx`)

The main live-session control surface. Two modes:

**Campaign Home mode** (no active scene):
- Global campaign view panel (`campaign-home-panel.tsx`)
- Factions, lore, NPCs, items, scene roster overview
- Scene timeline still visible at bottom

**Gameplay mode** (active scene loaded):
Three-column layout + timeline + notes strip.

```
.dashboard__columns (3 equal columns)
  +-- Left: GBPreviewColumn (gb-preview-column.tsx)
  |   +-- 16:9 gameboard preview image (from scene's gameboardAssetId)
  |   +-- FogOverlay canvas (fog-overlay.tsx) — HTML5 Canvas, 1920x1080
  |   +-- FogControls (fog-controls.tsx) — brush size, mode, reset
  |
  +-- Center: CenterColumn (center-column.tsx)
  |   +-- 3 sub-tabs: SFX | ENV | AMB
  |   +-- SFX sub-tab: SFXPanel (sfx-panel.tsx)
  |   |   6 sound effect trigger buttons with spatial audio
  |   +-- ENV sub-tab: EnvironmentPanel (environment-panel.tsx)
  |   |   Environmental effects and presets
  |   +-- AMB sub-tab: AtmosphereControl (atmosphere-control.tsx)
  |       5 environment buttons (Forest/Cave/Tavern/Night/Ocean)
  |       3 mood buttons (Calm/Tense/Dramatic) — color-coded green/yellow/red
  |       2 volume sliders (Ambience + SFX)
  |
  +-- Right: QuickAccessColumn (quick-access-column.tsx)
      +-- 5 sub-tabs: Combat | Spells | Items | NPC | Dice
      +-- QuickCombat (quick-combat.tsx) — mini initiative tracker
      +-- QuickSpells (quick-spells.tsx) — spell search
      +-- QuickItems (quick-items.tsx) — scene items with status badges (hidden/loot/acquired)
      +-- QuickNPCs (quick-npcs.tsx) — NPC roster
      +-- QuickDice (quick-dice.tsx) — dice roller

.dashboard__timeline (bottom strip)
  +-- SceneTimeline (scene-timeline.tsx) — horizontal node flow, active node pulses

.dashboard__notes (bottom strip, below timeline)
  +-- NotesStrip (notes-strip.tsx) — scene-linked notes scroller
```

**Key interaction patterns:**
- Fog painting: pointer events on HTML5 Canvas, brush strokes debounce-saved as PNG
- Item status badges: click to cycle hidden -> loot -> acquired -> hidden
- Sub-tab navigation within center and right columns
- Scene timeline: click node to load scene, drag to reorder

### Tab 2: Scenes (`src/ui/tabs/ScenesTab.tsx`)

Scene flow management with expandable cards.

- Scene card grid (each is a `SceneCard` component from `scene-card.tsx`)
- Cards expand inline to show full editor
- Drag-to-reorder scenes
- Inline "Add Scene" form at bottom
- Each expanded card contains:
  - Name editor
  - Scratchpad (markdown text area)
  - Branch management (add/remove scene transitions)
  - Media assignment (background + gameboard pickers)
  - Linked notes display with unlink buttons
  - Starting scene marker toggle
  - Scene advancer component (`scene-advancer.tsx`)

### Tab 3: Combat (`src/ui/tabs/CombatTab.tsx`)

Initiative tracker with HP management.

- Combatant list sorted by initiative
- Each row (`CombatantRow`):
  - Initiative number
  - Name
  - HP bar (color: green > amber > red based on %)
  - Damage/heal buttons: -10, -5, -1, +1, +5, +10
  - Condition chips (toggle on/off): Blinded, Charmed, Deafened, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious
  - Reorder up/down buttons
  - Remove button
- Active turn: accent border + `active-turn-pulse` glow animation
- Round counter + "Next Turn" button
- Add Combatant form (name, HP, initiative, AC)
- "Clear All" danger button

### Tab 4: NPCs (`src/ui/tabs/NPCsTab.tsx`)

NPC roster with stat blocks.

- Real-time search filter
- NPC list with expandable stat blocks
- Stat block: AC, HP, speed, passive perception, 6 ability scores, personality, actions
- Add/Edit/Delete NPC forms
- Touch-optimized for iPad (44px tap targets)

### Tab 5: Spells & Reference (`src/ui/tabs/SpellsTab.tsx`)

Bundled 5e SRD reference (fully offline, no API calls).

- Search bar (filters by name, class, school, description)
- Filter pills: Spells, Monsters, Conditions (toggleable, `.srd-filter__pill.active` gets accent glow)
- Result cards expand to show full details
- Type-specific card colors: teal (spell), red (monster), amber (condition)
- Data from bundled JSON via `src/reference/srd-search` module

### Tab 6: Notes (`src/ui/tabs/NotesTab.tsx`)

Wiki-style notes + items + document import.

```
.notes-tab (two-column layout)
  +-- Sub-view toggle: Notes | Items | Import Document (button)
  |
  +-- If Items view: ItemsPanel (items-panel.tsx)
  |   Item CRUD with rarity badges, category/tag management
  |
  +-- If Notes view:
      +-- .notes-tab__sidebar (left, ~280px)
      |   +-- NotesList (notes-list.tsx) — filterable, grouped by type
      |   +-- ImportPanel (import-panel.tsx) — quick import buttons
      |
      +-- .notes-tab__main (right, fills remaining)
          +-- NoteEditor (note-editor.tsx) if active note selected
          |   Title, metadata bar, markdown body, wikilink support,
          |   scene linking, inline entity extraction toolbar
          +-- Empty state placeholder if no note selected

  +-- DocumentImportModal (document-import-modal.tsx) — large overlay
      Paste/import markdown documents, preview extracted entities
```

**Wikilink system:** Type `[[` to autocomplete note references. Click wikilinks to navigate between notes. Backlinks panel shows reverse references.

### Tab 7: Media (`src/ui/tabs/media/`)

Media asset library management.

```
.media-tab (two-column layout)
  +-- Left column:
  |   +-- MediaFilterBar (media-filter-bar.tsx) — type filter + search + view toggle
  |   +-- MediaGrid (media-grid.tsx) — asset cards in grid or list view
  |       Each card: AssetCard (asset-card.tsx) — thumbnail + name + type badge
  |   +-- MediaImportButton (media-import-button.tsx) — upload/import
  |
  +-- Right column:
      +-- MediaDetailPanel (media-detail-panel.tsx) — selected asset details
          Name, type, tags, categories, file info
          Edit metadata, delete with confirmation
```

### Tab 8: Players (`src/ui/tabs/PlayersTab.tsx`)

DM-facing player session management. Only visible when a session is live.

- Player count badge: "X connected / Y total"
- Broadcast panel (send message/item to all players)
- Whisper All button
- Copy session code button
- Player card grid:
  - Each `PlayerCard` (`players/player-card.tsx`):
    - Character name, player name, class, level
    - HP bar + adjust buttons
    - AC display
    - Conditions list + add/remove
    - Inventory + send item
    - Currency display + update
    - Whisper button
    - Kick button (danger)

### Tab 9: AV (`src/ui/tabs/av/AVTab.tsx`)

Theatrical mixing console for AV outputs.

```
.av-tab
  +-- AVToolbar (av-toolbar.tsx) — compact top strip
  |   Output status dots (BG: green/gray, GB: green/gray)
  |   Display assignment dropdowns
  |   Pop-out window buttons
  |
  +-- .av-tab__columns (two scrollable columns)
      +-- Game Board column:
      |   +-- .av-tab__column-label (sticky header: "Game Board")
      |   +-- GBSettingsZone (gb-settings-zone.tsx)
      |       +-- Media card (browse library, change, clear)
      |       +-- Fog of War card (toggle + FogOverlay canvas + FogControls)
      |       +-- Color Grade card (presets, 5 sliders, tint picker, reset)
      |
      +-- Background column:
          +-- .av-tab__column-label (sticky header: "Background")
          +-- BGSettingsZone (bg-settings-zone.tsx)
              +-- Media card
              +-- Particles card (7 type buttons + intensity slider)
              +-- Color Grade card (same controls as GB)
```

**AV card active state:** `.av-card--active` adds accent border glow when a feature is in use (media assigned, particles on, fog enabled).

**Color grade controls:**
- 5 preset buttons (Neutral, Warm, Cool, Vivid, Muted)
- 5 sliders: Brightness, Contrast, Saturation, Temperature (all -1 to +1)
- 1 color picker: Tint
- Reset button

**Particle types:** Off, Rain, Snow, Ash, Embers, Dust, Fog

---

## Companion App

### Join Screen (`src/companion/screens/join-screen.tsx`)

Character creation form. Mobile-optimized.

- Fields: Player name, Character name, Class (dropdown), Level, HP (current/max), AC
- Ability scores: STR, DEX, CON, INT, WIS, CHA — 3x2 grid on small screens, 6-column on 420px+
- Session code input: monospace, centered, uppercase, letter-spaced
- Session code can pre-fill from URL query param (`?session=ABCD23`)
- Save/load via localStorage
- Error display with shake animation
- Entrance animation: staggered `joinFadeUp` on form fields

### Lobby Screen (`src/companion/screens/lobby-screen.tsx`)

Waiting room after joining.

- Character info card (submitted details read-only)
- Status banner with 3 states:
  - **Pending** (amber glow, `lobbyPendingGlow` animation): "Waiting for DM approval..."
  - **Approved** (teal glow): "Approved! Waiting for session to start..."
  - **Ready check** (green glow, `readyBtnPulse`): "DM is starting! Confirm ready?"
- Ready confirm button (pulses)
- Connection indicator dot (online/offline)
- Haptic vibration on ready check prompt

### Dashboard Screen (`src/companion/screens/dashboard-screen.tsx`)

Live gameplay view. Mobile-first, real-time updates from server.

- **Header:** Character name, player name, online/offline dot
- **HP Bar:** Color fill (green/amber/red), current/max numbers
  - Damage flash: red background + shake (`hpDamage`)
  - Heal flash: green background (`hpHeal`)
  - Critical HP: heartbeat pulse (`heartbeat`)
- **AC:** Shield icon + number
- **Ability Scores:** 3x2 grid (responsive to 6-column), score + modifier
- **Conditions:** Status effect pills with per-condition animations:
  - Poison (green pulse), Fire (orange flicker), Ice (blue shimmer)
  - Fear (violet tremble), Holy (gold glow), Stun (wobble)
  - Slow (desaturated), Invisible (opacity flicker), Blind (dark pulse), Charm (purple glow)
- **Inventory:** Item list with quantity, use button
- **Currency:** Gold, Silver, Copper displays
- **Whispers:** DM messages with wax seal aesthetic, unread accent bar
- **Dice Roller:** d4, d6, d8, d10, d12, d20, d100 buttons
  - Nat 20: gold celebration flash
  - Nat 1: red fumble shake

---

## Reusable Components

### Layout & Structure

| Component | File | Purpose |
|-----------|------|---------|
| TabBar | `src/ui/components/TabBar.tsx` | 9-tab navigation, active underline |
| ModeToggle | `src/ui/components/ModeToggle.tsx` | Headless/Play/Plan dropdown in header |
| ConnectionStatus | `src/ui/components/ConnectionStatus.tsx` | Live/Offline dot indicator |
| ErrorBoundary | `src/ui/components/error-boundary.tsx` | Graceful error catch, wraps tab content |
| PlayerSidebar | `src/ui/components/player-sidebar.tsx` | Collapsible sidebar (48px/320px) |
| Logo | `src/ui/components/Logo.tsx` | Placeholder SVG (marked for replacement) |

### Modals & Dialogs

| Component | File | Purpose |
|-----------|------|---------|
| MediaPicker | `src/ui/components/media-picker.tsx` | Asset selection overlay |
| DocumentImportModal | `src/ui/components/document-import-modal.tsx` | Paste/import documents |
| ExtractEntityModal | `src/ui/components/extract-entity-modal.tsx` | Create NPC/Item from text selection |

### Data Display

| Component | File | Purpose |
|-----------|------|---------|
| SceneCard | `src/ui/components/scene-card.tsx` | Expandable scene editor card |
| SceneAdvancer | `src/ui/components/scene-advancer.tsx` | Scene transition UI |
| NotesList | `src/ui/components/notes-list.tsx` | Filterable note sidebar list |
| NoteEditor | `src/ui/components/note-editor.tsx` | Markdown + wikilink editor |
| ItemsPanel | `src/ui/components/items-panel.tsx` | Item CRUD panel |
| BacklinksPanel | `src/ui/components/backlinks-panel.tsx` | Reverse wikilink references |
| NoteLinker | `src/ui/components/note-linker.tsx` | Wikilink autocomplete |
| ImportPanel | `src/ui/components/import-panel.tsx` | Quick import buttons |
| PlayerCard | `src/ui/tabs/players/player-card.tsx` | Per-player DM control card |
| OutputSection | `src/ui/components/output-section.tsx` | AV output status + controls |
| LobbyPanel | `src/ui/components/lobby-panel.tsx` | Approve/reject players |
| QRCodePanel | `src/ui/components/qr-code-panel.tsx` | QR code for companion join |
| CopyButton | `src/ui/components/copy-button.tsx` | Copy-to-clipboard with confirmation |
| PerfOverlay | `src/ui/components/perf-overlay.tsx` | Dev FPS/memory counter |

---

## Animation Library

### UI Feedback
| Name | Duration | Usage |
|------|----------|-------|
| `tabMount` | 0.15s | Tab content fade-in |
| `spinnerRotate` | 0.7s | Loading spinner |
| `pulse-dot` | 2s | Connection status dot |
| `active-turn-pulse` | 2s | Combat active turn glow |
| `scene-pulse` | 2s | Scene timeline active node |
| `readyBtnPulse` | 1.5s | Lobby ready button glow |

### Status Effects (Companion)
| Name | Duration | Visual |
|------|----------|--------|
| `poisonPulse` | 2.5s | Green glow |
| `firePulse` | 1.5s | Orange flicker |
| `icePulse` | 3s | Blue shimmer |
| `fearShake` | 2.5s | Violet micro-tremor |
| `holyGlow` | 2s | Gold divine glow |
| `stunWobble` | 1.2s | Rotation wobble |
| `slowPulse` | 4s | Desaturated opacity |
| `invisFlicker` | 3s | Irregular opacity |

### HP & Damage (Companion)
| Name | Duration | Visual |
|------|----------|--------|
| `hpDamage` | 0.5s | Red flash + shake |
| `hpHeal` | 0.5s | Green flash |
| `heartbeat` | 1.5s | Critical HP pulse |
| `nat20Flash` | 0.6s | Gold celebration |
| `nat1Shake` | 0.4s | Red fumble shake |

### Lobby & Join (Companion)
| Name | Duration | Visual |
|------|----------|--------|
| `joinFadeUp` | 0.4s | Form field entrance |
| `errorShake` | 0.4s | Error shake |
| `lobbyPendingGlow` | 3s | Amber ambient glow |
| `lobbyApprovedFlash` | 0.8s | Teal success flash |

---

## State Management

Zustand stores, one per domain. Components read from stores; sync layer (`src/ui/lib/sync.ts`) handles all socket communication.

| Store | File | Key State |
|-------|------|-----------|
| AppStore | `src/ui/stores/app-store.ts` | `hasLaunched`, `appMode`, `networkMode`, `activeCampaignId`, `isConnected` |
| SceneStore | `src/ui/stores/scene-store.ts` | `activeScene`, scene list |
| CombatStore | `src/ui/stores/combat-store.ts` | `combatants[]`, `currentRound`, `activeCombatantId` |
| MoodStore | `src/ui/stores/mood-store.ts` | `value` (0-1 slider), `environmentId`, `ambienceVolume`, `sfxVolume` |
| AVStore | `src/ui/stores/av-store.ts` | `particles`, `colorGrade`, `gbColorGrade` |
| FogStore | `src/ui/stores/fog-store.ts` | `fogEnabled`, `brushSize`, `brushMode`, `isEnlarged` |
| NotesStore | `src/ui/stores/notes-store.ts` | `notes[]`, `activeNoteId`, `sceneNoteLinks` |
| ItemsStore | `src/ui/stores/items-store.ts` | `items[]`, `activeItemId` |
| OutputStore | `src/ui/stores/output-store.ts` | `availableDisplays`, `outputs { BG, GB }` |
| PlayerStore | `src/ui/stores/player-store.ts` | `players[]`, `sessionPhase`, `sessionCode` |
| CompanionStore | `src/companion/stores/companion-store.ts` | `phase`, character state, inventory, currency |

---

## File Reference

### Cockpit UI Files

```
src/ui/
  main.tsx                          — React DOM entry
  App.tsx                           — Root: intro -> launch -> cockpit lifecycle
  index.css                         — All cockpit styles (~8,950 lines)

  screens/
    cinematic-intro.tsx             — Typewriter intro animation
    launch-screen.tsx               — Mode + campaign selection (two columns)

  tabs/
    DashboardTab.tsx                — 3-column live session cockpit
    ScenesTab.tsx                   — Scene card grid + editor
    CombatTab.tsx                   — Initiative tracker + HP management
    NPCsTab.tsx                     — NPC roster + stat blocks
    SpellsTab.tsx                   — 5e SRD reference (offline)
    NotesTab.tsx                    — Wiki notes + items + import
    PlayersTab.tsx                  — DM player management

    dashboard/
      gb-preview-column.tsx         — Left: gameboard preview + fog
      center-column.tsx             — Center: SFX / ENV / AMB sub-tabs
      quick-access-column.tsx       — Right: Combat / Spells / Items / NPC / Dice
      scene-timeline.tsx            — Bottom: horizontal scene flow
      notes-strip.tsx               — Bottom: scene-linked notes
      campaign-home-panel.tsx       — Campaign overview (no active scene)
      fog-overlay.tsx               — HTML5 Canvas fog painting
      fog-controls.tsx              — Fog brush controls
      sfx-panel.tsx                 — SFX soundboard triggers
      environment-panel.tsx         — Environmental effects
      atmosphere-control.tsx        — Ambient audio controls (env + mood + volume)
      quick-combat.tsx              — Mini combat panel
      quick-dice.tsx                — Dice roller
      quick-items.tsx               — Item list with status badges
      quick-npcs.tsx                — NPC quick roster
      quick-spells.tsx              — Spell quick search

    av/
      AVTab.tsx                     — AV root: toolbar + two columns
      av-toolbar.tsx                — Output status + display assignment
      bg-settings-zone.tsx          — Background column controls
      gb-settings-zone.tsx          — Game Board column controls
      color-grade-presets.ts        — Shared color grade constants

    media/
      media-tab.tsx                 — Media library root
      media-grid.tsx                — Asset grid/list view
      media-filter-bar.tsx          — Filter + search + view toggle
      media-detail-panel.tsx        — Selected asset detail panel
      asset-card.tsx                — Asset thumbnail card
      media-import-button.tsx       — Upload/import button

    players/
      player-card.tsx               — Per-player DM control card

  components/
    TabBar.tsx                      — 9-tab navigation
    ModeToggle.tsx                  — Mode dropdown
    ConnectionStatus.tsx            — Live/Offline dot
    error-boundary.tsx              — Error catch wrapper
    player-sidebar.tsx              — Collapsible player sidebar
    Logo.tsx                        — Placeholder logo
    media-picker.tsx                — Asset selection modal
    document-import-modal.tsx       — Document paste/import overlay
    extract-entity-modal.tsx        — Entity extraction from text
    scene-card.tsx                  — Expandable scene card
    scene-advancer.tsx              — Scene transition UI
    notes-list.tsx                  — Filterable note list
    note-editor.tsx                 — Markdown + wikilink editor
    items-panel.tsx                 — Item CRUD panel
    backlinks-panel.tsx             — Reverse reference display
    note-linker.tsx                 — Wikilink autocomplete
    import-panel.tsx                — Quick import buttons
    output-section.tsx              — AV output controls
    lobby-panel.tsx                 — Player approve/reject
    qr-code-panel.tsx              — QR code generator
    copy-button.tsx                 — Copy to clipboard
    perf-overlay.tsx                — Dev performance overlay
    DevTestPanel.tsx                — Dev utilities (hidden in prod)
    quick-capture.tsx               — Screenshot utility
    markdown-editor.tsx             — Markdown input component

  stores/
    app-store.ts
    scene-store.ts
    combat-store.ts
    mood-store.ts
    av-store.ts
    fog-store.ts
    notes-store.ts
    items-store.ts
    output-store.ts
    player-store.ts

  hooks/
    use-scenes.ts                   — Scene fetch/mutate
    use-notes.ts                    — Note CRUD
    use-items.ts                    — Item CRUD
    use-assets.ts                   — Media asset CRUD + getAssetFileUrl()
    use-scene-items.ts              — Scene-specific items with status
    use-scene-npcs.ts               — Scene-specific NPCs

  lib/
    sync.ts                         — Central socket sync layer
    ws-stub.ts                      — Browser dev mock socket
    perf-client.ts                  — Latency measurement
    dice-parser.ts                  — Dice notation parser
```

### Companion UI Files

```
src/companion/
  main.tsx                          — React DOM entry
  App.tsx                           — State-machine: join -> lobby -> dashboard -> ended
  index.css                         — Companion styles (~1,217 lines)

  screens/
    join-screen.tsx                 — Character creation form
    lobby-screen.tsx                — Waiting + ready check
    dashboard-screen.tsx            — Live gameplay (HP, abilities, inventory, dice)

  stores/
    companion-store.ts              — All companion state

  lib/
    companion-sync.ts               — Companion socket sync
    companion-ws-stub.ts            — Browser dev mock
    haptics.ts                      — Mobile vibration API
```

### Shared Files

```
shared/
  design-tokens.css                 — CSS custom properties (both apps import)
  color-constants.ts                — PixiJS color values aligned with CSS tokens
  socket-events.ts                  — All socket event name constants
  ipc-channels.ts                   — Electron IPC channel constants
  player-types.ts                   — Player companion shared types
```
