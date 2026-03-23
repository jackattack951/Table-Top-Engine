# Dashboard Overhaul — Overview

## Purpose

Replace the current single-column DashboardTab with a **command center layout** that surfaces quick access to all major systems, minimizing tab switching during live play sessions.

## Current State

The existing `DashboardTab.tsx` (508 lines) is a vertically stacked single column containing:
1. AV Outputs section (display list, role dropdowns, pop-out buttons)
2. Environment Presets (selector + variant buttons + apply)
3. Scene Library (flat list with create form + branch panel)
4. SFX Soundboard (spatial sliders + 6 dev clip buttons)

**Problems identified (First Impression review):**
- Too much tab switching required during live play
- No game board preview on the dashboard
- No fog of war support
- Scene navigation is a flat list with no sense of narrative flow
- SFX, combat, NPCs, spells scattered across separate tabs
- No quick reference notes visible during play

## Target Layout

Reference diagram: `Overhaul/Layouts/Dashboard.png`

```
+------------------+------------------+------------------+
|  AV Container    | SFX/Weather/AMB  | Quick Access     |
|                  |                  | Panel            |
|  [GB Preview]    | [SFX] [ENV] [AMB]| [Combat][Spells] |
|  1920x1080       |                  | [Items][NPC]     |
|  scaled          | [button grid]    | [Dice]           |
|                  |                  |                  |
|  *Fog Toggle*    |                  | [Selected View]  |
+------------------+------------------+------------------+
|              Scene Flow Timeline                       |
| Past | Past | Past | [CURRENT] | Future | Fork | Fork |
+--------------------------------------------------------+
|                                                        |
|              Notes Container                           |
|  [Scene Notes - read only]  |  [Scratchpad]           |
|                                                        |
+--------------------------------------------------------+
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | 3-column + timeline + notes | Maximizes information density for DM during play |
| Quick access scope | Scene-contextual | Shows only data relevant to the active scene |
| Fog of War | Free-form brush painting | Most flexible for varied map layouts |
| Scene timeline | Linked list + drag-and-drop | Linear narrative flow with fork support |
| Notes | Read-only scene notes + scratchpad | Quick reference without risk of accidental edits |
| Scratchpad | Per-session, in-memory | Lightweight; logged to future campaign report system |

## System Status for Quick Access Panel

| System | Status | Dashboard Integration |
|--------|--------|----------------------|
| Combat | Built (Sprint 4) | Compact view: initiative, HP bars, next turn |
| NPCs | Built (Sprint 5) | Scene-linked NPC list with compact stat blocks |
| Spells | Built (read-only SRD) | Embedded search, compact results |
| Items | Not built | Placeholder until system exists |
| Dice | Not built | New pure-UI roller (no backend needed) |

## New Features Required

1. **Fog of War** — Free-form brush painting, DM sees transparent overlay, output shows opaque black. Stored as PNG blob per scene in SQLite.
2. **Scene Timeline** — Horizontal visual flow with past/current/future, branch forks, drag-and-drop reorder.
3. **Dice Roller** — d4-d100 presets, custom notation parser ("2d6+4"), roll history, advantage/disadvantage.
4. **Scene-NPC Links** — Many-to-many junction table in SQLite. DM assigns NPCs to scenes.
5. **Scene-Encounter Links** — Many-to-many junction table. Pre-configured encounters linked to scenes.
6. **Cinematic Launch Intro** — Alien-style green text typewriter effect before existing LaunchScreen.

## Data Model Changes

- `nextSceneId` field on scenes (linked-list primary path)
- `scene_npcs` junction table (scene_id, npc_id, sort_order)
- `scene_encounters` junction table (scene_id, encounter details)
- `fog_data` BLOB column on scenes (PNG bitmap)
- `fog_enabled` boolean column on scenes

## Related Documents

- Layout diagram: `Overhaul/Layouts/Dashboard.png`
- Detailed implementation spec: `Overhaul/Dashboard/dashboard-implementation-spec.md`
- User feedback: `First impression.md`
- CSS design system: `Overhaul/UI/css-unification-spec.md`
