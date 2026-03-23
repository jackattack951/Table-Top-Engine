# Standalone Demo Build — Implementation Guide

A static HTML demo of the TTRPG Stage Manager cockpit UI. Read-only showcase: all tabs navigate, data is pre-populated, no backend required. Hostable anywhere (GitHub Pages, Netlify, local file server).

---

## Architecture

7 new files, ~670 lines. Zero changes to existing source code.

```
src/demo/
  index.html          — HTML entry point
  main.tsx            — React entry: fetch interceptor, store hydration, render
  DemoApp.tsx         — Simplified App shell (skips intro/launch, starts in cockpit)
  fixtures.ts         — Pre-populated campaign, scenes, NPCs, notes, items, combat
  demo-sync.ts        — No-op sync layer (prevents socket.io-client from bundling)
  demo-use-socket.ts  — No-op useSocketConnection hook
vite.demo.config.ts   — Vite build config (project root, based on cockpit config)
```

## How It Works

### 1. Fetch Interceptor (main.tsx)

Instead of aliasing every hook, we intercept `window.fetch` before React renders. All existing hooks (`useScenes`, `useNotes`, etc.) call fetch normally — the interceptor catches `/api/*` requests and returns fixture data.

**Route map:**
| Pattern | Returns |
|---------|---------|
| `GET /api/campaigns` | Fixture campaign list |
| `GET /api/campaigns/:id` | Fixture campaign |
| `GET /api/campaigns/:id/scenes` | Fixture scenes |
| `GET /api/campaigns/:id/npcs` | Fixture NPCs |
| `GET /api/campaigns/:id/notes` | Fixture notes |
| `GET /api/campaigns/:id/items` | Fixture items |
| `GET /api/campaigns/:id/scene-note-links` | Fixture scene-note links |
| `GET /api/scenes/:id/npcs` | Fixture NPCs for scene |
| `GET /api/scenes/:id/items` | Fixture items for scene |
| `GET /api/displays` | Empty array |
| `GET /api/lan-info` | `{ url: 'http://demo.local' }` |
| `POST/PATCH/DELETE /api/*` | Return 200 + echo input (visual feedback) |

### 2. Vite Aliases (vite.demo.config.ts)

Only 2 aliases needed to cut the socket.io-client dependency:

```ts
resolve: {
  alias: {
    // ... same aliases as cockpit config, plus:
    '@ui/lib/sync': resolve(__dirname, 'src/demo/demo-sync'),
    '@ui/lib/use-socket': resolve(__dirname, 'src/demo/demo-use-socket'),
  }
}
```

### 3. Store Hydration (main.tsx)

Before rendering, call Zustand store setters directly:

```ts
useAppStore.getState().setAppMode('play')
useAppStore.getState().setLaunched()
useAppStore.getState().setActiveCampaign('demo-campaign-1', 'The Crimson Citadel')
useSceneStore.getState().setActiveScene(fixtures.scenes[0])
useCombatStore.getState().setCombatants(fixtures.combatants)
useNotesStore.getState().setNotes(fixtures.notes)
useItemsStore.getState().setItems(fixtures.items)
useAVStore.getState().setParticles('rain', 0.6)
```

### 4. DemoApp.tsx

Simplified version of `src/ui/App.tsx`:
- Skips `CinematicIntro` and `LaunchScreen`
- Skips `useSocketConnection` (aliased to no-op)
- Starts directly in the cockpit view
- Renders the same shell: header, `TabBar`, `renderTab()`
- Replaces `ConnectionStatus` with a "Demo" badge

## What Works

- All 9 tabs navigate correctly
- Dashboard: scene info, NPC list, item list, notes, encounters
- Combat tracker with pre-populated encounter
- Notes tab with markdown editor, wikilinks, backlinks
- Scenes tab with scene cards and timeline
- Spells tab with SRD search (bundled JSON, no backend)
- Fog of war canvas (painting works visually, doesn't persist)
- Color grade sliders, particle type buttons (visual only)

## What's Inert

- Socket.io connections (no-op sync layer)
- Import pipeline (modal opens, submit is no-op)
- Media library (empty state, no fixture assets yet)
- AV Display pop-outs (requires Electron)
- Player companion / QR codes
- Data mutations (create/edit/delete are no-ops with console.log)

## Fixture Data (fixtures.ts)

Themed around a sample campaign — **"The Crimson Citadel"**:

- **Campaign:** The Crimson Citadel (5e, dark fantasy)
- **Scenes (3-4):**
  - "The Shattered Gate" — party approaches a ruined fortress
  - "Hall of Echoes" — interior exploration, trap encounter
  - "The Blood Throne" — climactic boss arena
  - "Merchant's Rest" — safe haven / downtime
- **NPCs (4-5):**
  - Kael Duskwalker — elven ranger guide (ally)
  - Mordecai the Pale — undead sorcerer (BBEG)
  - Brin Copperhand — dwarven merchant (neutral)
  - Captain Voss — city guard commander (ally)
  - The Whisperer — mysterious cloaked figure (unknown)
- **Items (4-5):**
  - Crimson Shard (wondrous, quest item)
  - Cloak of Shadows (wondrous, uncommon)
  - Healing Potion (potion, common)
  - Rusted Iron Key (mundane, quest item)
- **Notes (5-6):**
  - Session 1 recap
  - Quest: "The Missing Scouts"
  - Lore: "History of the Crimson Citadel"
  - NPC note linked to Mordecai
  - Scene note linked to Blood Throne
- **Combat (3-4 combatants):**
  - Pre-populated initiative order for a sample encounter

## npm Scripts

```json
{
  "dev:demo": "vite --config vite.demo.config.ts",
  "build:demo": "vite build --config vite.demo.config.ts"
}
```

## Build Output

- Static files in `out/demo/`
- `base: './'` — relative paths, works at any URL
- Estimated bundle: ~2-3MB
- No server required — open `index.html` directly or host anywhere

## Key Principle

**Zero changes to existing source files.** The demo is a parallel entry point that reuses all components, stores, hooks, and CSS through the fetch interceptor + 2 Vite aliases. The real app is completely unaffected.
