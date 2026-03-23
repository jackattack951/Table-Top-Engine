# Overhaul Summary — TTRPG Stage Manager

> Generated 2026-03-09. Updated 2026-03-10 (Sprint 16c complete). Comprehensive audit of all overhaul documents vs. current implementation.

---

## 1. Dashboard Overhaul (Sprints 10a–10j)

**Status: COMPLETE**

Replaced a single-column dashboard with a **3-column command center layout** plus scene timeline, fog of war, dice roller, and cinematic intro.

### What It Covered
- 3-column grid: GB Preview (left) | SFX/Environment/AMB (center) | Quick Access (right)
- Scene timeline with drag-and-drop, branching, past/current/future styling
- Bottom notes strip + in-memory scratchpad
- Fog of war: data model, cockpit canvas painting, AV Display renderer (4 socket events)
- Dice roller: parser, crypto-random rolls, advantage/disadvantage, roll history
- Scene-NPC linking: junction table, REST routes, hooks
- Cinematic intro: typewriter animation, skip support, phase integration

### Documents
| File | Purpose |
|------|---------|
| `dashboard-overview.md` | Vision & requirements for 10-phase overhaul |
| `dashboard-implementation-spec.md` | Detailed sprint breakdown (10a–10j) |

### Remaining Items
- ~~Quick Items placeholder~~ — **DONE** (Sprint 16c). Wired to real Item entity system with scene-item junction.
- **Item states** — Quick Items shows "Unlink" but needs clear states: Hidden/Loot/Acquired + player assignment
- **Scene Preview** — Video mixer-style Program/Preview in scene timeline (single click = preview, double-click = go live)
- **Per-Scene Fog** — DB supports it (fog_data/fog_enabled per scene) but cockpit applies globally. Need save/restore on scene switch.

---

## 2. Layouts (Reference Mockups)

**Status: PARTIALLY SUPERSEDED**

### What It Covered
Two PNG mockups showing target layouts:
- `Dashboard.png` — 3-column dashboard with fog, SFX, quick-access, timeline, notes
- `AV Tab UI.png` — Old 3x2 grid layout with side-by-side preview frames

### Current State
- **Dashboard.png** — Still accurate. Implementation matches the mockup.
- **AV Tab UI.png** — **SUPERSEDED**. Sprint 14 replaced the 3x2 grid with toolbar + 2-column channel strip layout. The new design is better. This mockup can be archived.

---

## 3. Notes System Overhaul (Sprints 15a–15i)

**Status: PHASE 1 COMPLETE. Phases 2–3 are future work.**

Transformed basic notes into a **living, interconnected knowledge base** with wikilinks, backlinks, entity extraction, item tracking, color coding, and smart import.

### What It Covered
- Competitive research (Obsidian, Notion, Bear, Milanote, Google Keep)
- Phase 1: Wikilinks, pinned notes, archive, quick capture, expanded types, status field, color coding, card grid, smart import parser, inline extract, Item entity
- Phase 2: Graph view, kanban, split pane, collapsible sections, slash commands, hierarchical tags, full-text search
- Phase 3: Board/canvas view, timeline view, hover preview, AI assist, templates, export

### Documents
| File | Purpose |
|------|---------|
| `DM_App_Notes_System_Brief.docx.md` | Competitive research & design principles |
| `The_Last_Signal_Campaign.docx.md` | Reference campaign for testing import parser |
| `notes-overhaul.md` | Master spec: Phase 1–3 feature breakdown |

### Implemented (Phase 1)
- Wikilinks + backlinks (CodeMirror 6 extension, autocomplete, broken link detection)
- Pinned notes, archive (soft delete), color coding (8-color palette)
- Quick capture (Ctrl+Shift+N global hotkey)
- Expanded note types (quest, session, faction)
- Status field (type-contextual dropdown)
- Card grid view (masonry toggle)
- Smart Import Parser (document-parser.ts, ExtractionPreview UI)
- Inline Extract (entity-extractor.ts, ExtractEntityModal)
- Item entity (full CRUD, rarity, category, properties, tags)

### Not Implemented (Phase 2 — Power Features)
- **2.1 Note Graph View** — Force-directed visualization (Obsidian-style)
- **2.2 Kanban View** — Quest board with drag-and-drop status columns
- **2.3 Split Pane / Note Tabs** — Multiple notes open simultaneously
- **2.4 Collapsible Sections** — CodeMirror folding
- **2.5 Slash Commands** — `/` autocomplete for block types
- **2.6 Hierarchical Tags** — Nested tag tree (`#npc/villain`)
- **2.7 Full-Text Search** — In-memory index, Ctrl+K global search

### Not Implemented (Phase 3 — Stretch Goals)
- Board/canvas view, timeline view, hover preview, AI assist, templates, export

---

## 4. Startup Sequence Overhaul (Sprint 9)

**Status: COMPLETE**

Redesigned the first-run experience: mode selection, campaign selection, AV output management, transitions, and branding.

### What It Covered
- Launch screen: two-column layout (mode cards | campaign list)
- Mode cards with Phosphor icons, network toggle inside active card
- QR code + LAN IP for Host mode
- Progress bar in "Start Session" button with error handling
- Fade-through-black transition (200ms out → 100ms black → 300ms in)
- AV output management: user-enabled (never auto-created), display detection, hot-plug, role tagging (BG/GB)
- Dashboard as default landing tab
- Custom SVG logo, version + license display

### Documents
| File | Purpose |
|------|---------|
| `startup-overhaul-overview.md` | Design rationale + feature specs |
| `startup-implementation-spec.md` | 5-phase implementation roadmap |
| `startup-amendment.md` | Exact Project.md changes to codify specs |

### Remaining Items
- **Mode card tooltip previews** — Mini wireframe diagrams on hover (nice-to-have)
- **Display preview thumbnails** — Visual thumbnail in AV tab output cards (nice-to-have)

---

## 5. UI Overhaul (Foundation + CSS Unification + Per-Tab Polish)

**Status: FOUNDATION COMPLETE (~99%). CSS UNIFICATION ~85%. PER-TAB POLISH NOT STARTED.**

Shifted the visual identity from "gamer UI" to **production control surface** (teal accent, warm neutrals, tight density, broadcast aesthetic).

### What It Covered
- **Foundation**: Responsive layout, color palette shift (purple → teal), spacing/density tightening
- **CSS Unification**: Token extraction to `shared/design-tokens.css`, hardcoded color cleanup, `.form-input`/`.form-select` shared classes
- **Per-Tab Polish**: Dockable panels, micro-interactions, stat block redesign, visual flowcharts, combat urgency, theme system

### Documents
| File | Purpose |
|------|---------|
| `UI_Overhaul.md` | Master vision: 8 sections covering all tabs + global theming |
| `css-unification-spec.md` | Token audit, hardcoded color fixes, form input migration |
| `foundation-spec.md` | Responsive breakpoints, palette options, density spec |

### Implemented
- Color palette shift (purple → teal, warm neutrals, no pure black)
- Spacing/density tightening (~20% reduction)
- Responsive breakpoints (1024/1440px dashboard columns)
- Token extraction to `shared/design-tokens.css`
- Hardcoded color cleanup (95%+ compliance, no `!important`)
- AV Tab overhaul (toolbar + 2-column channel strips)
- Shared color constants (`shared/color-constants.ts`)

### Not Implemented — CSS Cleanup
- **Form input migration in cockpit tabs** — `.form-input`/`.form-select` adopted in companion but NOT in DashboardTab, CombatTab, NPCsTab, SpellsTab, AVTab (still use inline `inputStyle` objects)
- **Inline style extraction** — ~227+ inline `style={{}}` props across cockpit tabs need extraction to CSS classes
- **Orphaned LobbyPanel** — `lobby-panel.tsx` + `lobby-panel.test.ts` no longer imported; safe to delete

### Not Implemented — Per-Tab Features
- **Dockable panels** (FlexLayout integration)
- **Thematic bleed** (environment preset → CSS variable override)
- **Micro-interactions** (dice rolling animation, health bar gradient, combat slide)
- **Scenes flowchart** (visual node graph or kanban)
- **Combat visual urgency** (bloodied pulsing, condition icons, boss highlighting)
- **NPCs roster grid** (card layout with avatars, parchment stat blocks)
- **Spells enhancements** (Ctrl+K search, pinned cards, spell tag icons)
- **Notes canvas layout** (multi-document spatial view)
- **Global theming** (light mode, hot-swappable palettes)

---

## 6. Player Companion (Sprints 11–14)

**Status: MVP COMPLETE**

Players scan a QR code to join on their phones, enter the lobby, get approved by the DM, then receive a live dashboard with HP, conditions, inventory, and whispers.

### What It Covered
- Separate Vite build served at `/companion/*` on port 8080
- Session flow: Join → Lobby → Ready Check → Go Live → Dashboard
- Server-authoritative state with session tokens for reconnection
- DM Players tab with per-player controls (HP, conditions, items, whispers, broadcast)
- Combat HP sync between combat tracker and player sessions

### Documents
| File | Purpose |
|------|---------|
| `overview.md` | MVP scope (current) |
| `overview_REF.md` | Original full vision (reference, superseded) |
| `implementation-guide.md` | Detailed technical spec (current) |
| `implementation-guide_REF.md` | Original technical spec (reference, superseded) |
| `sprints.md` | Sprint breakdown with sub-phases and test plans |

### Implemented (All 4 sprints)
- Sprint 11: Vite build, session/token system, join form, player types, QR code
- Sprint 12: Lobby panel, approve/kick, ready check, Go Live, session end
- Sprint 13: Player dashboard, dice roller, whisper system
- Sprint 14: DM Players tab, per-player controls, broadcast, combat sync

### Not Implemented (Post-MVP / v2)
- **Full character creator** (game system presets, derived stats, Basic/Advanced modes)
- **Game system configs** (D&D 5e, PF2e, CoC, Shadowrun JSON presets)
- **Two-way player interaction** (player actions, not just receive)
- **Session persistence** (SQLite save/restore, currently in-memory only)
- **Native app wrapper** (Capacitor/PWA)
- **Initiative integration** with combat tracker
- **Atmosphere broadcast** to player screens

---

## Cross-Cutting Observations

### Documents to Archive
- `Overhaul/Layouts/AV Tab UI.png` — Superseded by Sprint 14 AV Tab redesign
- `Overhaul/player companion/overview_REF.md` — Original vision, superseded by MVP
- `Overhaul/player companion/implementation-guide_REF.md` — Original spec, superseded by MVP

### Orphaned Code to Delete
- `src/ui/components/lobby-panel.tsx` + `lobby-panel.test.ts` — No longer imported
- `src/ui/tabs/av/global-settings-zone.tsx` — Old AV grid layout (if still on disk)
- `src/ui/tabs/av/gb-preview-zone.tsx` — Old AV grid layout (if still on disk)
- `src/ui/tabs/av/bg-preview-zone.tsx` — Old AV grid layout (if still on disk)
