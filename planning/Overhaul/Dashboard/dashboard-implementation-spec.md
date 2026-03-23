# Dashboard Overhaul — Detailed Implementation Spec

## Phase Breakdown

Ten sub-sprints (10a through 10j), designed to be independently completable, testable, and reviewable.

### Dependency Graph

```
10a (Data Model) ─┬─ 10c (Quick Access: uses scene-NPC links)
                  ├─ 10d (Timeline: uses nextSceneId + sortOrder)
                  └─ 10g (Fog Data Model: extends migration pattern)
                       ├─ 10h (Fog Cockpit UI)
                       └─ 10i (Fog AV Renderer)

10b (Layout Shell) ─┬─ 10c (Right Column)
                    ├─ 10d (Timeline)
                    ├─ 10e (Notes Strip)
                    ├─ 10f (Dice)
                    └─ 10h (Fog UI)

10j (Cinematic Intro): independent
```

**Execution order:** 10a → 10b → 10c/10d/10e/10f (parallel-safe) → 10g → 10h → 10i → 10j

---

## Sprint 10a: Data Model Foundation + Scene Linking

### Goal
Add `nextSceneId` to scenes and build scene-NPC / scene-encounter junction tables. Pure backend work.

### Database Migration (`003_dashboard_overhaul.sql`)

```sql
-- Scene linked-list ordering
ALTER TABLE scenes ADD COLUMN next_scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL;

-- Scene-NPC junction (many-to-many)
CREATE TABLE scene_npcs (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scene_id, npc_id)
);
CREATE INDEX idx_scene_npcs_scene ON scene_npcs(scene_id);
CREATE INDEX idx_scene_npcs_npc ON scene_npcs(npc_id);

-- Scene-Encounter junction (many-to-many)
CREATE TABLE scene_encounters (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  encounter_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scene_id, encounter_id)
);
CREATE INDEX idx_scene_encounters_scene ON scene_encounters(scene_id);
```

### Type Changes (`src/core/types.ts`)

```typescript
export interface Scene {
  // ... existing fields ...
  nextSceneId: string | null;  // NEW — linked-list primary path
}
```

### DB Functions to Add (`src/core/db/db.ts`)

- `getNPCsForScene(sceneId: string): NPC[]`
- `linkNPCToScene(sceneId: string, npcId: string, sortOrder?: number): void`
- `unlinkNPCFromScene(sceneId: string, npcId: string): void`
- `getSceneNPCLinks(campaignId: string): Array<{ sceneId: string; npcId: string }>`
- Same pattern for encounters when encounter system is built

### REST Routes to Add (`src/api/server.ts`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scenes/:id/npcs` | NPCs linked to a scene |
| POST | `/api/scenes/:id/npcs/:npcId` | Link NPC to scene |
| DELETE | `/api/scenes/:id/npcs/:npcId` | Unlink NPC from scene |
| GET | `/api/campaigns/:id/scene-npc-links` | Bulk links for campaign |

`PATCH /api/scenes/:id` updated to accept `nextSceneId`.

### Files
- `src/core/db/migrations/003_dashboard_overhaul.sql` (NEW)
- `src/core/types.ts` (modify)
- `src/core/db/db.ts` (modify)
- `src/api/server.ts` (modify)
- `src/core/db/db.test.ts` (modify)

---

## Sprint 10b: Dashboard 3-Column Layout Shell

### Goal
Restructure DashboardTab into a CSS Grid layout. Extract existing sections into sub-components.

### Layout CSS

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: auto auto 1fr;
  gap: var(--spacing-md);
  height: 100%;
  padding: var(--spacing-md);
}

/* Row 1: Three columns */
.dashboard-column { /* shared column styles */ }
.dashboard-column--left { /* GB preview */ }
.dashboard-column--center { /* SFX/Weather/AMB */ }
.dashboard-column--right { /* Quick access */ }

/* Row 2: Scene timeline (full width) */
.dashboard-grid__timeline {
  grid-column: 1 / -1;
}

/* Row 3: Notes strip (full width) */
.dashboard-grid__notes {
  grid-column: 1 / -1;
}
```

### Sub-tab Pattern

Each column uses a shared sub-tab switcher pattern:

```typescript
// Sub-tab navigation within a column
interface SubTab { id: string; label: string; component: React.FC }

const SubTabNav: React.FC<{ tabs: SubTab[]; active: string; onChange: (id: string) => void }>;
```

### Component Extraction

| Source (DashboardTab.tsx) | Target |
|---------------------------|--------|
| SFX Soundboard (lines 451-503) | `dashboard/sfx-panel.tsx` |
| Environment Presets (lines 269-365) | `dashboard/environment-panel.tsx` |
| (New) GB Preview wrapper | `dashboard/gb-preview-column.tsx` |
| (New) Sub-tab container | `dashboard/center-column.tsx` |
| (New) Sub-tab container | `dashboard/quick-access-column.tsx` |

Scene library and BranchPanel are removed from Dashboard (scenes managed in ScenesTab; replaced by timeline in 10d).

### Files
- `src/ui/tabs/dashboard/` (NEW directory)
- `src/ui/tabs/dashboard/sfx-panel.tsx` (NEW)
- `src/ui/tabs/dashboard/environment-panel.tsx` (NEW)
- `src/ui/tabs/dashboard/gb-preview-column.tsx` (NEW)
- `src/ui/tabs/dashboard/center-column.tsx` (NEW)
- `src/ui/tabs/dashboard/quick-access-column.tsx` (NEW)
- `src/ui/tabs/DashboardTab.tsx` (REWRITE)
- `src/ui/index.css` (add dashboard grid classes)

---

## Sprint 10c: Right Column Quick-Access Panel

### Goal
Scene-contextual quick access with compact views of Combat, NPCs, Spells. Placeholders for Items and Dice.

### Quick Combat (`quick-combat.tsx`)
- Reads from `useCombatStore` directly
- Shows: combatant list (sorted by initiative), HP bars (color-coded), "Next Turn" button
- Does NOT include: add form, condition toggles, reorder controls
- Link to "Open full Combat tab" for advanced operations

### Quick NPCs (`quick-npcs.tsx`)
- Calls `GET /api/scenes/:id/npcs` for active scene
- Shows: NPC cards (name, AC, HP, ability score highlights)
- "Link NPC" dropdown to add scene-NPC association
- "Unlink" button per NPC card
- New hook: `useSceneNPCs(sceneId)` in `src/ui/hooks/use-scene-npcs.ts`

### Quick Spells (`quick-spells.tsx`)
- Reuses `searchSRD` from `src/reference/srd-search.ts`
- Compact results: name + level + school (one line per result)
- Expand for full spell card
- No filter pills (space-constrained)

### Quick Items (`quick-items.tsx`)
- Placeholder: "Items system coming soon"

### Quick Dice (`quick-dice.tsx`)
- Placeholder in 10c, replaced with real roller in 10f

### Files
- `src/ui/tabs/dashboard/quick-combat.tsx` (NEW)
- `src/ui/tabs/dashboard/quick-npcs.tsx` (NEW)
- `src/ui/tabs/dashboard/quick-spells.tsx` (NEW)
- `src/ui/tabs/dashboard/quick-items.tsx` (NEW)
- `src/ui/tabs/dashboard/quick-dice.tsx` (NEW)
- `src/ui/hooks/use-scene-npcs.ts` (NEW)
- `src/ui/tabs/dashboard/quick-access-column.tsx` (modify)

---

## Sprint 10d: Scene Timeline Strip

### Goal
Horizontal scene flow: Past → [Current] → Future with pulsing active scene, branch forks, drag-and-drop.

### Data Flow
1. `useScenes(campaignId)` provides all scenes with `sortOrder`
2. `useSceneStore.activeScene` identifies the current scene
3. Scenes sorted by `sortOrder` → rendered left-to-right
4. Scenes before active = "past" (dimmed styling)
5. Active scene = pulsing highlight
6. Scenes after active = "future" (normal styling)

### Branch/Fork Display
- If a scene has `branches[]`, render small fork indicators below the node
- Fork indicators show target scene name
- Clicking a fork navigates to that scene

### Drag-and-Drop Reorder
- Independent scenes (not a fork target) can be dragged to any position
- Dependent scenes (fork targets) move with their parent
- On drop: recalculate `sortOrder` values, `PATCH` updated scenes
- Uses `patchScene(id, { sortOrder })` — same pattern as ScenesTab

### Scene Dependencies
- When creating a new scene, option to flag it as "dependent on" another scene (making it a fork)
- Dependent = it's a branch target of the parent scene
- Independent = exists in the timeline on its own, freely draggable

### Pulsing Animation CSS

```css
.scene-timeline__node--active {
  animation: scene-pulse 2s ease-in-out infinite;
}

@keyframes scene-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
  50% { box-shadow: 0 0 12px 4px var(--accent-glow); }
}
```

### Connector Line
A horizontal line connects scene nodes. The "pulsing line emanating from the active scene" extends from the active node outward in both directions.

### Files
- `src/ui/tabs/dashboard/scene-timeline.tsx` (NEW)
- `src/ui/index.css` (add timeline classes)
- `src/ui/tabs/DashboardTab.tsx` (integrate)

---

## Sprint 10e: Bottom Notes Strip + Scratchpad

### Goal
Read-only current-scene notes (left) + per-session scratchpad (right).

### Scene Notes (left half)
- Reads linked notes via `useNotesStore.getNotesForScene(activeSceneId)`
- Renders with `parseNotes()` from `src/ui/lib/parse-notes.tsx`
- Read-only — editing happens in the Notes tab
- Scrollable if content exceeds container height
- Shows "No notes linked to this scene" if empty

### Scratchpad (right half)
- Simple `<textarea>` with `className="form-input"`
- In-memory state (React `useState`) — clears on app restart
- Auto-saves to future campaign report system (deferred)
- Placeholder text: "Session notes..."

### Files
- `src/ui/tabs/dashboard/notes-strip.tsx` (NEW)
- `src/ui/index.css` (add `.notes-strip` classes)
- `src/ui/tabs/DashboardTab.tsx` (integrate)

---

## Sprint 10f: Dice Roller

### Goal
Pure-UI dice roller. No backend needed.

### Notation Parser (`dice-parser.ts`)

```typescript
interface DiceRoll {
  count: number;    // e.g., 2
  sides: number;    // e.g., 6
  modifier: number; // e.g., +4 or -2
}

interface RollResult {
  input: string;           // "2d6+4"
  parsed: DiceRoll;
  individual: number[];    // [3, 5]
  total: number;           // 12
  timestamp: number;
}

function parseDiceNotation(input: string): DiceRoll;
function rollDice(roll: DiceRoll): RollResult;
```

Supports: `d20`, `2d6`, `4d8+3`, `1d20-1`, `d100`

### UI Components
- Preset buttons: d4, d6, d8, d10, d12, d20, d100
- Text input for custom notation
- "Roll" button (or Enter to roll)
- Advantage / Disadvantage toggle (d20 only — rolls 2d20, takes higher/lower)
- Roll history: last 10 rolls in scrollable list
- Result display: total (large) + individual dice (small)
- Uses `crypto.getRandomValues()` for randomness

### Files
- `src/ui/tabs/dashboard/quick-dice.tsx` (REWRITE)
- `src/ui/lib/dice-parser.ts` (NEW)
- `src/ui/lib/dice-parser.test.ts` (NEW)
- `src/ui/index.css` (add dice roller classes)

---

## Sprint 10g: Fog of War — Data Model + Socket Events

### Goal
Backend foundation for fog of war system.

### Database Migration (`004_fog_of_war.sql`)

```sql
ALTER TABLE scenes ADD COLUMN fog_data BLOB DEFAULT NULL;
ALTER TABLE scenes ADD COLUMN fog_enabled INTEGER NOT NULL DEFAULT 0;
```

### Type Changes

```typescript
export interface Scene {
  // ... existing fields ...
  fogEnabled: boolean;
  fogData: string | null;  // base64 PNG or null
}
```

### Socket Events (`shared/socket-events.ts`)

```typescript
export const FOG_UPDATE = 'fog:update';   // Full bitmap sync (base64 PNG)
export const FOG_BRUSH = 'fog:brush';     // Incremental stroke relay
export const FOG_TOGGLE = 'fog:toggle';   // Enable/disable fog
export const FOG_RESET = 'fog:reset';     // Clear all fog
```

### Fog Brush Payload

```typescript
interface FogBrushStroke {
  x: number;       // 0-1 normalized position
  y: number;       // 0-1 normalized position
  radius: number;  // 0-1 normalized brush size
  reveal: boolean; // true = reveal, false = conceal
}

interface FogBrushEvent {
  sceneId: string;
  strokes: FogBrushStroke[];
}
```

### Zustand Store (`fog-store.ts`)

```typescript
interface FogState {
  fogEnabled: boolean;
  brushSize: 'small' | 'medium' | 'large';
  brushMode: 'reveal' | 'conceal';
  isEnlarged: boolean;
  // Actions
  setFogEnabled: (enabled: boolean) => void;
  setBrushSize: (size: 'small' | 'medium' | 'large') => void;
  setBrushMode: (mode: 'reveal' | 'conceal') => void;
  setEnlarged: (enlarged: boolean) => void;
}
```

### Files
- `src/core/db/migrations/004_fog_of_war.sql` (NEW)
- `src/core/types.ts` (modify)
- `src/core/db/db.ts` (modify)
- `shared/socket-events.ts` (modify)
- `src/api/server.ts` (modify)
- `src/ui/lib/sync.ts` (modify)
- `src/ui/stores/fog-store.ts` (NEW)
- `src/ui/stores/fog-store.test.ts` (NEW)

---

## Sprint 10h: Fog of War — Cockpit UI (Canvas Painting)

### Goal
Interactive fog painting overlay using HTML5 Canvas (not PixiJS — Architecture Rule 1).

### Canvas Setup
- Canvas element overlaid on GB preview (absolute positioned)
- Canvas resolution matches game board aspect ratio (e.g., 1920x1080 scaled)
- Initial state: fully fogged (black) or loaded from scene's `fogData`
- DM sees fog at 50% opacity (semi-transparent black)

### Brush Painting
- `pointerdown` → start painting
- `pointermove` → continuous brush strokes
- `pointerup` → stop painting, debounce-save to DB
- Brush rendered as circle at cursor position
- Canvas compositing:
  - Reveal mode: `globalCompositeOperation = 'destination-out'` (erases fog)
  - Conceal mode: `globalCompositeOperation = 'source-over'` (paints fog)

### Brush Sizes
| Name | Pixel Radius | Use Case |
|------|-------------|----------|
| Small | 10px | Fine detail, doorways |
| Medium | 25px | Rooms, corridors |
| Large | 50px | Large areas, outdoor |

### Enlarge Mode
- Click "Enlarge" → fog-overlay renders as a CSS modal
- Modal uses most of the viewport for precision painting
- Close returns to compact preview size
- Fog state persists between compact/enlarged views (same canvas)

### Save Flow
1. On `pointerup` (stroke ends): debounce 500ms
2. `canvas.toDataURL('image/png')` → base64 string
3. `PATCH /api/scenes/:id/fog` with base64 body
4. Simultaneously emit `FOG_BRUSH` for real-time relay to AV Display

### Controls (`fog-controls.tsx`)
- Three brush size buttons (S / M / L) with active indicator
- Reveal / Conceal toggle
- "Reset Fog" button → fills canvas black (all fogged) or clears (all revealed)
- "Reset" should confirm before executing

### Files
- `src/ui/tabs/dashboard/fog-overlay.tsx` (NEW)
- `src/ui/tabs/dashboard/fog-controls.tsx` (NEW)
- `src/ui/tabs/dashboard/gb-preview-column.tsx` (modify)
- `src/ui/index.css` (add fog classes)

---

## Sprint 10i: Fog of War — AV Display Renderer

### Goal
Render opaque black fog mask on AV Display via PixiJS.

### PixiJS Integration
- `FogOfWar` class manages a `PIXI.Graphics` overlay with erase blend mode for reveal strokes
- Layer position: above game board layer, below combat overlay
- Fog is fully opaque black on the output (players see nothing where fog covers)

### Socket Listeners
- `AV_FOG_ERASE` → erase paths on the fog overlay (reveal areas)
- `FOG_TOGGLE` → show/hide fog layer
- `FOG_RESET` → reset fog to full opaque

### Files
- `src/systems/av/fog-of-war.ts`
- `src/systems/av/layer-stack.ts` (fog layer between gameboard and FX)

---

## Sprint 10j: Cinematic Launch Intro

### Goal
Alien-style green monospace text typewriter effect before existing LaunchScreen.

### Animation Sequence
1. Full black screen
2. Green monospace text types character-by-character (60ms per character)
3. Text: `<Company Name> presents` (line 1) → pause 500ms → `<Software Name>` (line 2)
4. Hold for 1.5 seconds
5. Fade to black (500ms)
6. Transition to existing LaunchScreen

### Skip
- Click anywhere or press any key to skip
- Immediately fades to LaunchScreen

### App.tsx Phase Changes

```typescript
// Current phases: null → 'launch' → 'app'
// New phases:     null → 'intro' → 'launch' → 'app'
```

### CSS

```css
.cinematic-intro {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
}

.cinematic-intro__text {
  font-family: 'Courier New', monospace;
  color: var(--color-success);  /* green from tokens */
  font-size: 2rem;
  white-space: pre;
  overflow: hidden;
  border-right: 2px solid var(--color-success);
  animation: blink-cursor 0.7s step-end infinite;
}

@keyframes blink-cursor {
  50% { border-color: transparent; }
}
```

### Files
- `src/ui/screens/cinematic-intro.tsx` (NEW)
- `src/ui/App.tsx` (modify — add intro phase)
- `src/ui/index.css` (add cinematic classes)

---

## Verification Checklist (per sub-sprint)

- [ ] `npm test` — all existing + new tests pass
- [ ] `npm run dev:cockpit` — dashboard renders in browser
- [ ] `npm run dev` — full Electron app works, socket relay functional
- [ ] No hardcoded colors in new CSS/TSX
- [ ] No `!important` rules
- [ ] New form inputs use `.form-input` / `.form-select`
- [ ] All `style={}` props reference `var(--token)` values
- [ ] BEM naming for all new CSS classes
- [ ] Two-agent workflow: dev implements → reviewer checks
