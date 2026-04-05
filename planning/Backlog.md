# Feature Backlog

> Prioritized future features not yet in active development.
> For active/completed sprint work, see `Sprints.md`.
> For the high-level project overview, see `Project.md` in the project root.

---

## SMALL — Quick Wins / Polish

### Dashboard Atmosphere Slider
Quick-access slider on the dashboard that adjusts multiple atmosphere values at once as it moves (particles intensity, mood, color grade temperature/saturation). Single control for "weather intensity" without opening the AV tab. Designed for live Play mode — fast atmosphere shifts mid-session without tab-switching.
Requires: Sprint 20 (Plan/Play mode distinction) for mode-aware behavior.

### SFX Soundboard — Expand to 9 Triggers
Currently 6 SFX clips on the soundboard. Add 3 more slots for a total of 9 trigger buttons. New clips TBD — candidates: rain/downpour, horse gallop, arrow volley, glass shatter, chains/lock, crowd gasp, wolf howl, bell toll, explosion.

### SFX Tab Overhaul
Full overhaul pass on the SFX tab/panel. Scope TBD — user-identified for future design work.

### Notes Tab UI Polish
Light touch-up pass on the Notes tab layout and UX. User-identified, scope TBD.

### Spell Search History + Pinned Spells
Track recent spell lookups in the Spells tab. Show recent searches in both:
- The full Spells reference tab
- The dashboard quick-reference spells section

Also let the DM pin 3-5 frequently-used spells (Counterspell, Shield, Healing Word) to the dashboard quick-reference panel, similar to NPC/Item quick panels.
Store in Zustand (session-scoped, no DB persistence needed).

### Player Dashboard UI Improvements
General polish pass on the companion player dashboard screen. Layout, spacing, readability.

### Scene "Ready" Indicator
Visual indicator on scene roster/timeline showing scene completeness: has media assigned? NPCs linked? Fog painted? Items linked?
Green/yellow/red dot or progress ring so DM can see at a glance which scenes still need prep work.

### Encounter Difficulty Indicator
Parse CR values from imported stat blocks and calculate encounter difficulty (Easy/Medium/Hard/Deadly) based on party size and level. Show difficulty indicators in scene/encounter preview. Reference standard 5e XP thresholds.
Requires: Enhanced stat block parsing (see MEDIUM backlog item below).

---

## MEDIUM — Multi-Task Features

### D&D Stat Block Parser
Extend `document-parser.ts` to parse full 5e stat blocks (AC, HP, STR/DEX/CON/INT/WIS/CHA, Speed, CR, actions, legendary actions). Create NPC entities with complete stat data. Also handle OSR-format stat blocks (AC, HD, Mv, Att, Dmg, Sv). Currently only detects stat block _presence_ for combatant flagging — this would extract the actual values.

### PDF Image/Map Extraction
Use pdfjs-dist's image extraction API to pull embedded images from campaign PDFs. Preview extracted images in the import modal. Allow DM to assign images as scene background/gameboard media and save to the campaign asset library. Useful for extracting dungeon maps, area maps, and NPC portraits from published adventures.
Requires: `pdfjs-dist` (already installed in Sprint 19).

### Scene Save System (Prep Mode)
Scene save/restore needs a comprehensive design pass. In Prep Mode, changing media sources, audio, particles, etc. should feel concrete:
- **Save Scene button** that captures all scene state (media BG/GB, audio, particles, color grade, fog, linked NPCs/items)
- **Visual receipt** after save showing what's configured (media sources, audio files, linked entities)
- Scenes currently store basic metadata but need full state capture: active locations with linked media, combat tracker state, mood engine settings, fog of war data, and AV configuration
- Location sub-entities within scenes should allow DMs to pre-configure media presets and flip between them without losing scene state
- Foundational for import system (locations reference media) and live session experience

### Scene Preview on Dashboard (Program/Preview)
Video mixer-style Program/Preview in the scene timeline:
- **Single click** on a scene in the timeline = Preview (shows notes, media summary, linked NPCs/items)
- **Double-click or "Go Live" button** = loads the scene into the active session
- Preview panel sits adjacent to the scene timeline, similar to broadcast mixing boards

> **Note:** Partially implemented in Sprint 18 (cued scene + TAKE workflow). Full preview panel with media summary still pending.

### Scene Transitions
When loading a scene via Go Live, support transition types between scenes:
- Cut (instant), fade-to-black, crossfade
- Fade-through-black pattern already exists from cinematic intro (200ms out -> 100ms black -> 300ms in)
- A 1-second crossfade on the AV Display would be cinematic — layer stack already supports it

> **Note:** Partially implemented in Sprint 18d (A/B deck crossfade). Transition type selection UI still pending.

### Scene Intro Videos
Optional intro video per scene that plays on scene load before transitioning to the standard BG/GB display. Use cases: cinematic establishing shots, AI-generated flyover sequences, pre-rendered title cards, dramatic reveals.
- DM assigns an intro video file in scene settings (optional — scenes without one load normally)
- On Go Live: intro video plays full-screen on AV Display -> transition (fade/cut) -> normal BG + GB layers appear
- Intro respects the Scene Transitions system (e.g., fade-through-black into intro, then fade from intro into gameplay view)
- Audio: intro video's own audio track plays during intro, then hands off to the mood engine / segmented audio
- Skip option: DM can cut the intro mid-play (hotkey or cockpit button) for when players have seen it before

### "What's Different?" Scene Diff Toast
On scene switch, show a small toast/notification summarizing what changed: new NPCs, items revealed, fog areas opened. Helps the DM track what players are about to experience. Especially useful with per-scene fog.

### Item Acquisition -> Session Log Entry
When a player acquires an item, auto-generate a timestamped log entry for session recaps. Creates a paper trail of loot distribution that feeds into session notes.

### Per-Scene Fog of War State
DB already has `fog_data` + `fog_enabled` per scene. But the cockpit currently applies fog globally:
- When fog is enabled, it applies to ALL scenes (global toggle)
- Fix: fog state (enabled + painted data) should save/restore per scene
- DM should be able to pre-paint fog reveals in Prep Mode, save, and have them restore when the scene loads during play
- On scene switch: save current fog to outgoing scene, load fog from incoming scene
- Add a simple undo buffer (last 5-10 brush strokes) — one wrong click can reveal areas the party shouldn't see yet, and there's no going back currently

### Video Engine Layer Audit
Review how the video engine loads and saves layers. Ensure layer state (BG media, GB media, overlays) persists correctly with the scene save system. This is a prerequisite for Scene Save to work properly.

---

## LARGE — Major Features

### Notes System — Phase 2 (Power Features)
- **Note Graph View** — Obsidian-style force-directed visualization of note relationships
- **Kanban View** — Quest notes displayed as drag-and-drop board by status
- **Split Pane / Note Tabs** — Multiple notes open simultaneously
- **Collapsible Sections** — CodeMirror folding extensions
- **Slash Commands** — `/` autocomplete for inserting block types
- **Hierarchical Tags** — Nested tag tree structure (`#npc/villain`)
- **Full-Text Search** — In-memory index (Lunr/FlexSearch), Ctrl+K global search

See `planning/Overhaul/Notes/notes-overhaul.md` for full Phase 2 spec.

### Notes System — Phase 3 (Stretch Goals)
- Board/canvas view (Milanote-style spatial authoring)
- Timeline view (chronological session logs)
- Hover preview (popouts on wikilink hover)
- AI assist (tag suggestions, NPC generation, session summaries)
- Note templates (pre-built field structures per type)
- Export (PDF/Markdown/HTML output)

See `planning/Overhaul/Notes/notes-overhaul.md` for full Phase 3 spec.

### UI Per-Tab Polish
- **Dockable panels** — FlexLayout integration for customizable dashboard layouts
- **Thematic bleed** — Environment preset selection shifts CSS variables
- **Micro-interactions** — Dice rolling transitions, health bar gradients, combat slide animations
- **Scenes flowchart** — Visual node graph or kanban for scene relationships
- **Combat visual urgency** — Bloodied pulsing, condition icon animations, boss highlighting
- **NPCs roster grid** — Card layout with avatars, parchment-style stat blocks
- **Spells enhancements** — Ctrl+K search, pinned reference cards, spell tag icons
- **Global theming** — Light mode toggle, hot-swappable palettes (Cyberpunk/Fantasy/Grimdark)

See `planning/Overhaul/UI/UI_Overhaul.md` for full per-tab vision.

### Player Companion — v2 Features
- Full character creator (game system presets, derived stats, Basic/Advanced modes)
- Game system configs (D&D 5e, PF2e, CoC, Shadowrun JSON presets)
- Two-way player interaction (player actions, not just receive)
- Session persistence (SQLite save/restore — currently in-memory only)
- Native app wrapper (Capacitor/PWA)
- Initiative integration with combat tracker
- Atmosphere broadcast to player screens

See `planning/Overhaul/player companion/` for MVP specs and implementation guide.

### Segmented Audio Engine (Adaptive Music)
Replace the mood matrix approach with a segmented track system for musically coherent scene scoring.

**Concept:** Each setting+mood combination has a complete music track split into three files — **Intro**, **Loop** (repeatable), and **Outro**. During playback, the Intro plays once, then the Loop repeats indefinitely. On mood change, the Outro plays, cross-dissolving (2s overlap) into the next track's Intro, which flows into the new Loop. Tracks are generated as complete pieces in Suno AI, then manually segmented in a DAW to preserve musicality.

**4 Moods:** Calm, Neutral, Tense, Dramatic. Neutral fills the gap between ambient pads (Calm) and suspense (Tense) — it's the "default score" for general exploration, travel, and conversation.

**5 Settings:** Forest, Cave, Tavern, Night, Ocean.

**3 Independent Layers:**

| Layer | Tied to | Purpose |
|---|---|---|
| Ambience (foley) | Setting | Always-playing environmental foley (Freesound). Changes with setting, not mood. |
| Music (segmented) | Setting + Mood | Intro → Loop → Outro playback. Cross-dissolve on mood/setting change. |
| SFX (soundboard) | Independent | DM-triggered one-shots, spatial audio (already built). |

**Transition modes:**
- **Graceful** (default): Finish current loop → play Outro → 2s cross-dissolve → next Intro
- **Hard cut**: DM override — immediate stop → next Intro (no outro, no dissolve)

**Breathing timer:** During Calm/Neutral, ambience and music volume alternate dominance on a 5-min cycle to prevent listener fatigue. Paused during Tense/Dramatic (music stays dominant).

**File count:** 5 ambience + 60 music segments (5 settings × 4 moods × 3 segments) + 6 SFX = **71 OGG files**

**Phase 1 — Single Track per Mood/Setting:**
- File naming: `{setting}-{mood}-intro.ogg`, `{setting}-{mood}-loop.ogg`, `{setting}-{mood}-outro.ogg`
- Playback engine: Intro → Loop (repeat) → Outro on mood change → 2s cross-dissolve → next Intro
- DM selects setting + mood from cockpit; hard-cut override option
- One track per mood/setting combination

**Phase 2 — Playlist Rotation:**
- Multiple tracks per mood/setting (e.g., `forest-calm-01/`, `forest-calm-02/`)
- Engine cycles through tracks: after N loop iterations, graceful transition to next track in the pool
- Endless playlist feel — distinct compositions rotate so music never feels repetitive
- Shuffle/sequential ordering option

**Phase 3 — Ambient Texture Layer:**
- Procedural matrix layer (pads, drones, environmental textures) runs underneath the segmented music bed
- Two independent layers: composed music on top, generative atmosphere below
- Matrix approach works well for ambient textures where musicality matters less

See `planning/Overhaul/audio/ambient-audio-production.md` for full production guide, Suno prompts, segmentation workflow, and file structure.

### Scene Recorder (Plan Mode)
Plan Mode gets a persistent Record button that captures all DM selections across tabs (BG, GB, weather, intensity, NPCs, items, notes, mood, etc.) and writes them back to a scene definition. Scene authoring by doing — configure the cockpit as if running a live session, then save the result. See Project.md Section 7.3.1 for full spec.

---

## Completed Backlog Items

> Items that were in the backlog and have since been implemented.

### Done — Sprint 16c (2026-03-10)
- ~~Dashboard — Quick Items Widget~~ — wired to real Item entity system
- ~~Campaign Home Panel~~ — dashboard view when no scene active
- ~~Import Pipeline~~ — Document Import Modal rewired to server-side `runImportPipeline()`
- ~~Campaign Home Import Button~~
- ~~Campaign Home <-> Gameplay Dashboard navigation~~
- ~~ExtractionPreview lore category~~
- ~~Express JSON body limit~~ — increased to 5MB

### Done — Sprint 17a/17b (2026-03-11)
- ~~Orphaned Code Cleanup~~ — 3 old AV tab files deleted
- ~~CSS Unification — Form Input Migration~~ — inline styles 59 -> 11
- ~~Error Boundary~~ — wraps cockpit tab content
- ~~Skip Intro Preference~~ — localStorage toggle
- ~~Empty Campaign State~~ — improved copy/hierarchy
- ~~Error Message Audit~~ — all plain language
- ~~Combat Active-Turn Pulse~~
- ~~AV Tab Sticky Headers~~
- ~~Players Tab Copy Session Code~~
- ~~Scene Timeline Tooltips~~
- ~~Combat HP Buttons~~ — flex-wrap
- ~~Spells Filter Pill~~ — stronger active state
- ~~Empty State Polish~~ — emoji icons + actionable copy

### Done — Sprint 24a (2026-04-05)
- ~~Dashboard Notes Strip Empty on Initial Load (Bug)~~ — added `useNotes(activeCampaignId)` to `DashboardTab.tsx`
- ~~Item States in Quick Reference~~ — `status` column on `scene_items`, Hidden/Loot/Acquired states in `quick-items.tsx` (migration 009)

### Done — CSS Unification
- ~~Inline Style Extraction~~ — Reduced to 11 in Sprint 17a (all dynamic/computed). No further extraction needed.
