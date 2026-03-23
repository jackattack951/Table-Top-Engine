# Sprint 20 — Scene Save System + Summary + Plan/Play Mode

> Technical specification for implementation. Not yet active — queued after Sprint 17e.

---

## Problem

Scene state auto-persists silently via debounced `patchScene()`. The DM has:
- **No summary view** of what's configured in a scene (media, NPCs, items, atmosphere, fog)
- **No save feedback** — changes persist without visual confirmation
- **No mode distinction** — Plan and Play modes have identical editing capability
- **No export** — can't get a scene summary outside the app

The scene data model is already comprehensive and fully persistent. This is a UX sprint, not a data architecture sprint.

---

## What Already Persists (no changes needed)

| Category | Persistence Method |
|---|---|
| Scene fields (media, particles, colorGrade, gbColorGrade, audioMood, fog, notes, branches) | `PATCH /api/scenes/:id` via debounced `persistToScene()` in `connection.ts` (2000ms) |
| Junction links (scene_npcs, scene_items, scene_notes) | Immediate REST calls |
| Fog bitmap | `PATCH /api/scenes/:id/fog` |
| AV state (particles, colorGrade, gbColorGrade, audioMood) | Store subscriptions → `persistToScene()` in `connection.ts` lines 354, 441–443 |

---

## Phase A: Scene Summary + API Endpoint

### A1: Summary REST Endpoint

**File:** `src/api/server.ts`

Add `GET /api/scenes/:id/summary` returning aggregated scene data in a single response:

```typescript
interface SceneSummaryResponse {
    scene: Scene
    npcs: NPC[]
    notes: Note[]
    items: SceneItem[]  // Item + status from scene_items junction
}
```

Uses existing DB functions — no new queries:
- `getScene(id)` → scene record
- `getNPCsForScene(id)` → linked NPCs with sort order
- `getNotesForScene(id)` → linked notes with sort order
- `getItemsForScene(id)` → linked items with status (hidden/loot/acquired)

### A2: Summary Hook

**File (NEW):** `src/ui/hooks/use-scene-summary.ts`

```typescript
function useSceneSummary(sceneId: string | null): {
    summary: SceneSummaryResponse | null
    loading: boolean
    error: string | null
}
```

Lazy fetch — only called when scene card expands. Returns cached data if scene ID unchanged.

### A3: SceneSummary Component

**File (NEW):** `src/ui/components/scene-summary.tsx`

Read-only display rendered at the **top** of expanded SceneCard (always visible, no toggle).

**Sections:**

| Section | Content | Source |
|---|---|---|
| Media | BG filename, GB filename (or "None assigned") | `scene.backgroundAssetId`, `scene.gameboardAssetId` |
| Atmosphere | Particle type + intensity %, mood %, color grade preset name or "Custom" | `scene.particles`, `scene.audioMood`, `scene.colorGrade` matched against `COLOR_GRADE_PRESETS` |
| Fog | Enabled/Disabled | `scene.fogEnabled` |
| NPCs | Bulleted name list with count | `summary.npcs` |
| Items | Name + status badge (hidden/loot/acquired) | `summary.items` |
| Notes | Title + type badge | `summary.notes` |
| Branches | Label → target scene name | `scene.branches` resolved against scene list |

**Export buttons:**
- **Copy Summary** → `navigator.clipboard.writeText(markdown)`
- **Download .md** → `Blob` URL + `<a download>` trigger

**Pure function** `buildSceneSummaryMarkdown(summary)` extracted for testing.

### Markdown Export Format

```markdown
# Scene: The Dragon's Lair

## Media
- **Background:** cave-entrance.webm
- **Gameboard:** dragon-lair-map.png

## Atmosphere
- **Particles:** Embers (75%)
- **Mood:** 85%
- **BG Color Grade:** Firelight
- **GB Color Grade:** Default
- **Fog:** Enabled

## NPCs (2)
- Smaug the Terrible
- Kobold Sentry

## Items (2)
- Dragonscale Shield [hidden]
- Gold Hoard [loot]

## Notes (2)
- [scene] Encounter Setup
- [lore] Dragon History

## Branches (2)
- Peaceful Resolution → The Aftermath
- Combat → Dragon Fight
```

### A4: Wire into SceneCard

**File:** `src/ui/components/scene-card.tsx`

- Import `useSceneSummary` hook
- Fetch when `expanded` becomes true
- Render `<SceneSummary>` before the action row (first thing visible in expanded state)

### A5: CSS

**File:** `src/ui/index.css`

```css
.scene-summary { /* compact grid, subtle recessed background */ }
.scene-summary__section { /* label + value pairs */ }
.scene-summary__label { /* muted color, small caps */ }
.scene-summary__value { /* normal weight */ }
.scene-summary__badge { /* pill-style for status/type */ }
.scene-summary__actions { /* copy + download buttons row */ }
```

### A6: Tests

- `src/ui/hooks/use-scene-summary.test.ts` — mock fetch, verify data shape
- `src/ui/components/scene-summary.test.ts` — verify `buildSceneSummaryMarkdown()` output

---

## Phase B: Save Indicator

### B1: Save State in Store

**File:** `src/ui/stores/scene-store.ts`

```typescript
// Add to SceneState interface:
lastSavedAt: number | null
setLastSavedAt: (ts: number) => void
```

Resets to `null` when `activeScene` changes.

### B2: Emit Save Signal

**File:** `src/ui/lib/sync/connection.ts`

Enhance `persistToScene()`:

```typescript
function persistToScene<T>(toPartial: (value: T) => Partial<Scene>, ms = 2000) {
    return debounce((value: T) => {
        const sceneId = useSceneStore.getState().activeScene?.id
        if (sceneId) {
            void patchScene(sceneId, toPartial(value))
                .then(() => useSceneStore.getState().setLastSavedAt(Date.now()))
                .catch(() => {})
        }
    }, ms)
}
```

**Flow:** user edits → 2s debounce → PATCH fires → resolve → `setLastSavedAt()` → UI indicator appears → fades over 2s.

### B3: Save Indicator in SceneCard

**File:** `src/ui/components/scene-card.tsx`

- Subscribe to `lastSavedAt` from scene store
- Show "Saved" badge near scene card header with fade-out animation
- Appears when `lastSavedAt` changes, fades over 2 seconds

### B4: CSS

```css
.scene-card__save-indicator {
    /* small pill, positioned near header */
    animation: save-flash 2s ease-out forwards;
}

@keyframes save-flash {
    0% { opacity: 1; }
    70% { opacity: 1; }
    100% { opacity: 0; }
}
```

### B5: Tests

- Extend `src/ui/stores/scene-store.test.ts` — verify `lastSavedAt` state transitions

---

## Phase C: Plan/Play Mode Distinction

### Design: Soft-Disable Approach

Use CSS `.plan-only` class with `pointer-events: none` + reduced opacity on editing sections. No prop-drilling `disabled` to every child.

**Play mode allows (session actions):**
- Load Scene / TAKE
- Scene Advancer (branch navigation)
- Scratchpad editing (DMs jot session notes mid-play)
- AV atmosphere controls (color grade, particles, mood — real-time tools)

**Play mode disables (prep actions):**
- Media assignment (BG/GB browse/change/clear)
- Branch add/remove
- Note link/unlink
- Scene creation (+ New Scene)
- Drag-to-reorder scenes

### C1: SceneCard Mode Awareness

**File:** `src/ui/components/scene-card.tsx`

```typescript
const { appMode } = useAppStore()
const isPlayMode = appMode === 'play'
```

- Media picker section: wrap in `{!isPlayMode && (...)}`
- Branch add/remove buttons: wrap in `{!isPlayMode && (...)}`
- Note link/unlink controls: wrap in `{!isPlayMode && (...)}`
- Scratchpad textarea: NO change (stays editable)
- Load Scene + Advancer: NO change (play actions)

### C2: ScenesTab Mode Awareness

**File:** `src/ui/tabs/ScenesTab.tsx`

- `+ New Scene` button/form: `{!isPlayMode && (...)}`
- Drag-to-reorder: `draggable={!isPlayMode}`

### C3: ModeToggle Enhancement

**File:** `src/ui/components/ModeToggle.tsx`

Add mode description subtitles:

```tsx
<button className={`mode-toggle__btn${...}`}>
    Prep
    <span className="mode-toggle__desc">Full editing</span>
</button>
<button className={`mode-toggle__btn${...}`}>
    Play
    <span className="mode-toggle__desc">Session mode</span>
</button>
```

### C4: SceneTimeline Mode Awareness

**File:** `src/ui/tabs/dashboard/scene-timeline.tsx`

- `draggable={!isPlayMode}` on scene nodes

### C5: AV Zone Settings

**Files:** `src/ui/tabs/av/bg-settings-zone.tsx`, `src/ui/tabs/av/gb-settings-zone.tsx`

- Media browse buttons: `{!isPlayMode && (...)}`
- Color grade sliders: NO change (live atmosphere adjustment)
- Particle controls: NO change (live atmosphere adjustment)

### C6: CSS

```css
.plan-only {
    opacity: 0.4;
    pointer-events: none;
}
/* Accessibility */
[aria-disabled="true"] .plan-only { cursor: not-allowed; }
```

### C7: Tests

- Store-contract tests verifying mode state transitions

---

## Files Summary

| File | Phase | Action |
|---|---|---|
| `src/api/server.ts` | A | Add `GET /api/scenes/:id/summary` route |
| `src/ui/components/scene-summary.tsx` | A | **NEW** — summary display + Markdown export |
| `src/ui/hooks/use-scene-summary.ts` | A | **NEW** — fetch hook |
| `src/ui/components/scene-card.tsx` | A, B, C | Summary section, save indicator, mode gating |
| `src/ui/stores/scene-store.ts` | B | Add `lastSavedAt` state |
| `src/ui/lib/sync/connection.ts` | B | Emit save-complete signal from `persistToScene` |
| `src/ui/components/ModeToggle.tsx` | C | Mode descriptions |
| `src/ui/tabs/ScenesTab.tsx` | C | Hide editing in Play mode |
| `src/ui/tabs/dashboard/scene-timeline.tsx` | C | Disable drag in Play mode |
| `src/ui/tabs/av/bg-settings-zone.tsx` | C | Hide media browse in Play mode |
| `src/ui/tabs/av/gb-settings-zone.tsx` | C | Hide media browse in Play mode |
| `src/ui/index.css` | A, B, C | Summary, save indicator, plan-only styles |

**New test files:** ~3

---

## Design Decisions (Confirmed with User)

1. **Summary section:** Always visible at top of expanded SceneCard — no toggle.
2. **Markdown export:** Both clipboard copy AND .md file download.
3. **Scratchpad in Play mode:** Remains editable — DMs jot session notes mid-play.
4. **Atmosphere controls in Play:** Remain editable — color grade, particles, mood are real-time DM tools.

---

## Related Backlog Item

### SMALL — Dashboard Atmosphere Slider
Quick-access slider on the dashboard that adjusts multiple atmosphere values at once as it moves (particles intensity, mood, color grade temperature/saturation). Single control for "weather intensity" without opening the AV tab. Designed for live play — fast atmosphere shifts mid-session.

---

## Verification Plan

1. **Phase A:** Expand scene card → complete summary visible. Copy Summary → paste → readable Markdown. Download .md → valid file.
2. **Phase B:** Change color grade → 2s debounce → "Saved" indicator appears and fades on scene card.
3. **Phase C:** Switch to Play → editing hidden/disabled. Switch to Prep → full editing restored. Load Scene + advancer still work in Play. Scratchpad editable in both modes.
4. `npx vitest run` — all tests pass.
