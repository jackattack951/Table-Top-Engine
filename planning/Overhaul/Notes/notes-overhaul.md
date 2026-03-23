# Notes System Overhaul — Master Specification

> **Status:** Approved — Ready for Implementation
> **Date:** March 2026
> **Companion doc:** `DM_App_Notes_System_Brief.docx.md` (competitive research & design principles)

---

## Current State

The Notes system was built across Sprints 8–10 and is fully functional:

- **Note entity** with full CRUD (REST API + Socket.io sync)
- **5 note types:** scene, location, npc, lore, general
- **Many-to-many** scene-note linking via `scene_notes` junction table
- **Per-scene scratchpad** (survives re-imports)
- **CodeMirror 6** markdown editor with `[Trigger: Label]` syntax highlighting
- **Edit/Preview toggle** with inline markdown rendering
- **Zustand store** (`useNotesStore`) with notes, activeNoteId, sceneNoteLinks
- **Split-pane Notes Tab** — searchable/filterable list (left) + editor (right)
- **Obsidian import** — single file + vault folder, re-import merge by sourceFile
- **Scene branching** with transitionNote and outcome-based navigation
- **Notes strip** on Dashboard (scene notes read-only + scratchpad)
- **Tags** — free-form string array, displayed as pill badges with add/remove

### What This Overhaul Adds

The existing system treats notes as flat documents. This overhaul transforms them into an **interconnected knowledge base** — the DM types `[[Mira Ashveil]]` in a quest note and can navigate directly to that NPC's page. Notes gain structured metadata (status, pin, color, archive) and new view modes for different workflows.

---

## Phase 1 — Core Enhancements

These are the must-haves. Each is self-contained and can be implemented as a sub-sprint.

### 1.1 Wikilinks + Backlinks

**The single highest-value feature.** Transforms notes from a folder of documents into a living world encyclopedia.

**Editor behavior:**
- Typing `[[` in CodeMirror opens an autocomplete dropdown
- Fuzzy search of all notes in the current campaign as the DM types
- Selecting a note inserts `[[Note Title]]` which renders as a styled link
- Clicking a wikilink in preview mode navigates to that note (sets `activeNoteId`)
- Clicking a wikilink in edit mode opens the target note

**Backlinks panel:**
- Below the editor, a "Referenced By" section lists all notes that contain `[[This Note Title]]`
- Computed on render by scanning all note bodies for `[[title]]` matches
- Each backlink is clickable — navigates to the referencing note

**Broken links:**
- If a linked note is deleted, the wikilink renders with a warning style (strikethrough + muted color)
- Tooltip: "Note not found"

**Data model:** No schema changes. Wikilinks are plain text in the note body. Backlinks are computed at read time from an in-memory index.

**Implementation:**
- CodeMirror extension: custom completion source triggered by `[[`
- CodeMirror decoration: ViewPlugin to style `[[...]]` spans
- `parseNotes()` update: render `[[Title]]` as clickable links in preview mode
- Backlinks helper: `getBacklinks(noteId)` scans all notes for `[[title]]` references

### 1.2 Pinned Notes

- New `pinned: boolean` field on Note (default `false`)
- DB migration: `ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`
- Pinned notes render at the top of the notes list, separated by a divider
- Toggle via a pin icon button in the note editor metadata bar
- Pin state persists across sessions

### 1.3 Archive (Soft Delete)

- New `archived: boolean` field on Note (default `false`)
- DB migration: `ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`
- Archived notes are hidden from the default notes list
- "Show Archived" toggle in the notes list sidebar (or filter option)
- Delete action becomes "Archive" — moves to archived state
- "Delete Permanently" available only from archived view (with confirmation)
- Archived notes retain all links and backlinks but are visually muted

### 1.4 Quick Capture

- Global keyboard shortcut: `Ctrl+Shift+N` (configurable)
- Opens a small floating modal from any tab — even during combat
- Fields: title (auto-focused), optional body textarea
- "Save" creates a note with `type: 'general'`, no tags, no links
- Modal closes immediately — back to what the DM was doing in under 3 seconds
- New notes appear at top of notes list for later organization
- The modal is a top-level component in `App.tsx`, not inside any tab

### 1.5 Expanded Note Types

Current types: `scene | location | npc | lore | general`

Add three new types:

| Type | Icon Color | Status Values | Use Case |
|---|---|---|---|
| `quest` | Amber | Active, In Progress, Resolved, Failed | Quest/hook tracking |
| `session` | Blue | Draft, Complete | Session log / recap |
| `faction` | Purple | Active, Dissolved, Hidden | Faction tracking |

**Implementation:**
- Update `NoteType` union in `types.ts`
- Update notes-list grouping to include new types
- Each type gets a distinct accent color in the list and editor
- Type-specific status dropdown (see 1.6)

### 1.6 Status Field

- New `status: string | null` field on Note (default `null`)
- DB migration: `ALTER TABLE notes ADD COLUMN status TEXT`
- Status values are contextual to note type:

| Note Type | Available Statuses |
|---|---|
| npc | Alive, Dead, Unknown, Missing |
| quest | Active, In Progress, Resolved, Failed |
| session | Draft, Complete |
| faction | Active, Dissolved, Hidden |
| location | Active, Destroyed, Hidden |
| scene | — (no status, scenes have their own lifecycle) |
| lore | — |
| general | — |

- Rendered as a dropdown in the note editor metadata bar
- Filterable in the notes list sidebar
- Displayed as a small badge on note list items

### 1.7 Note Color Coding

- New `color: string | null` field on Note (default `null`)
- DB migration: `ALTER TABLE notes ADD COLUMN color TEXT`
- 8 color options: `red, orange, amber, green, teal, blue, purple, pink`
- Each maps to a CSS custom property for the note card's left border or background tint
- Color picker in the note editor metadata bar (8 circular swatches)
- Colors are visible in both list view and card grid view
- Distinct from type colors — this is user-assignable for personal organization

### 1.8 Card Grid View

- Toggle between List View (current) and Card Grid View in the notes list panel
- Card Grid: masonry-style layout showing note title, type badge, color stripe, first ~2 lines of body, tag pills
- Cards are clickable — select the note for editing
- Pinned notes appear first in both views
- View preference stored in `useNotesStore` or `useAppStore`
- Grid uses CSS `columns` or CSS Grid for responsive masonry

### 1.9 Entity Extraction

**Two complementary approaches** for pulling structured entities (scenes, NPCs, items, locations, factions) out of campaign documents and notes.

#### Feature A — Smart Import Parser

Upload or paste a full campaign document → the app parses it and presents an extraction preview → the DM reviews, checks/unchecks, tweaks → "Import" creates all entities with cross-links.

**UI Flow:**

1. **Entry point:** "Import Campaign Document" button in Notes tab toolbar (or a dedicated import panel)
2. **Input:** File picker (`.md`, `.txt`, `.docx.md`) or paste-in textarea for raw text
3. **Parse phase:** The parser scans the document and identifies entities using structural patterns:
   - **Scenes:** Headings matching `## Scene N:` or `### Scene N —` patterns, with location and description
   - **NPCs:** `NPC — Name` blocks, table rows with Race/Class/Role/Alignment, personality text
   - **Items:** `Items in Scene X` sections, item lists with descriptions, Appendix-style item references
   - **Locations:** Location names extracted from scene headings (`Scene 1: The Crash Site — Wreckage Field`)
   - **Factions:** Faction headings or grouped NPC affiliations
4. **Preview panel:** Shows categorized results in a checklist UI:
   ```
   ✅ 24 Scenes
      ☑ Scene 1: The Crash Site — Wreckage Field
      ☑ Scene 2: First Contact — The Forest Edge
      ...
   ✅ 9 NPCs
      ☑ Mira Ashveil (Human, Artificer, Neutral Good)
      ☑ Dren Voss (Half-Orc, Fighter, Lawful Neutral)
      ...
   ✅ 30 Items
      ☑ Signal Beacon (critical)
      ☑ Mira's Journal
      ...
   ```
5. **Edit before import:** DM can uncheck entities to skip, edit names/types, reassign categories
6. **Import action:** Creates all checked entities as notes (scenes as `scene` type, NPCs as `npc` type, etc.) and items as Item entities. Cross-links via wikilinks are auto-inserted where relationships were detected.

**Parser architecture:**

- `src/systems/import/document-parser.ts` — core parsing engine
- Pattern-based extraction using regex + structural heuristics (not AI-dependent)
- Returns `ExtractionResult` with categorized entity arrays
- Each extracted entity carries: `title`, `type`, `body` (raw content), `metadata` (parsed fields), `sourceRange` (line numbers in original doc), `relationships` (references to other extracted entities)
- The parser is **rule-based first** with well-defined pattern matchers per entity type. AI-assisted parsing is a Phase 3 enhancement.

**Supported document patterns** (derived from `The_Last_Signal_Campaign.docx.md` analysis):

| Entity | Detection Pattern |
|---|---|
| Scene | `## Scene N:` heading, `### Scene N —` heading |
| NPC | `NPC — Name` or `**NPC — Name**` block, table with Race/Class/Role columns |
| Item | `Items in Scene` sections, `Appendix A` item lists, bulleted item descriptions |
| Location | Location name after scene title colon/dash, `Location:` field in scene blocks |
| Faction | `Faction:` labels, grouped NPC affiliations, `## Factions` headings |
| Read Aloud | `> READ ALOUD` or `**READ ALOUD**` boxed text → stored as scene body content |

**Cross-linking on import:**
- When an NPC name appears in a scene's body, insert `[[NPC Name]]` wikilink
- When an item is mentioned in a scene, insert `[[Item Name]]` wikilink
- Scene-note links created via `scene_notes` junction table where scenes reference NPCs/items
- `sourceFile` field on created notes tracks the original document for re-import merge

#### Feature B — Inline Extract

DM is reading or editing a note, selects a text block describing an entity → right-click (or toolbar button) → "Extract as NPC / Item / Location" → entity is created from the selected content.

**UI Flow:**

1. **Trigger:** Select text in the CodeMirror editor → context menu appears with "Extract Entity" submenu
2. **Submenu options:** Extract as NPC, Extract as Item, Extract as Location, Extract as Quest, Extract as Faction
3. **Extraction modal:** Pre-fills fields parsed from the selected text:
   - **Title:** Best-guess name (first bold text, first line, or heading)
   - **Type:** Pre-selected based on the submenu choice
   - **Body:** The selected text as markdown
   - **Parsed fields:** For NPCs: race, class, alignment if detected. For items: rarity, properties if detected.
4. **DM confirms/edits** the pre-filled data → "Create" button
5. **On creation:**
   - New entity (note or item) is created
   - The selected text in the source note is replaced with (or appended with) a `[[Entity Title]]` wikilink
   - The source note now links to the extracted entity

**Implementation:**
- CodeMirror context menu extension (or floating toolbar on selection)
- `extractEntityFromText(text: string, targetType: NoteType | 'item')` — heuristic parser that pulls structured fields from a text block
- Reuses the same pattern matchers from Feature A's document parser
- Modal component: `ExtractEntityModal.tsx`

**Depends on:** Phase 1.1 (Wikilinks) for the auto-linking behavior

### 1.10 Item Entity

Items do not exist in the system yet. This feature adds a first-class Item entity for tracking magic items, quest objects, equipment, and loot.

**Data model:**

```typescript
export interface Item {
    id: string
    campaignId: string
    name: string
    description: string       // markdown body
    rarity: ItemRarity | null
    type: ItemType | null      // weapon, armor, potion, wondrous, quest, etc.
    properties: string[]       // e.g. ['attunement', 'cursed', 'consumable']
    tags: string[]             // free-form tags (same pattern as notes)
    sourceNoteId: string | null // note this item was extracted from
    createdAt: string
    updatedAt: string
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact' | 'quest'
export type ItemType = 'weapon' | 'armor' | 'potion' | 'scroll' | 'wondrous' | 'ring' | 'staff' | 'wand' | 'quest' | 'tool' | 'other'
```

**Schema:**

```sql
-- Migration 008_items.sql

CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rarity TEXT,
    type TEXT,
    properties TEXT NOT NULL DEFAULT '[]',  -- JSON array
    tags TEXT NOT NULL DEFAULT '[]',         -- JSON array
    source_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_campaign ON items(campaign_id);

-- Junction table: items linked to scenes
CREATE TABLE IF NOT EXISTS scene_items (
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    PRIMARY KEY (scene_id, item_id)
);
```

**UI:**
- Items tab or Items section within the Notes tab (TBD — could be a sub-view of notes or its own tab)
- Item cards show name, rarity badge (color-coded), type icon, description preview
- Items are wikilink-able: `[[Item Name]]` works the same as note wikilinks
- Items appear in the extraction preview (Feature A) and can be created via Inline Extract (Feature B)

**Zustand store:** `useItemsStore` — items array, activeItemId, CRUD actions

**API:** Full REST CRUD (`/api/campaigns/:id/items`) + Socket.io sync events

---

## Phase 2 — Power Features

Higher complexity, significant value. Implement after Phase 1 is stable.

### 2.1 Note Graph View

Visual node map of all linked notes (Obsidian-style). Each note is a node, wikilinks are edges. Current note highlighted. Clickable nodes navigate to that note.

**Technical approach:**
- Lightweight force-directed graph (d3-force or a minimal canvas renderer)
- Computed from wikilink index built in Phase 1
- Read-only visualization — not an editor
- Optional panel/overlay accessible from the Notes tab

### 2.2 Kanban View

Quest-type notes displayed as a drag-and-drop kanban board organized by status columns (Active → In Progress → Resolved → Failed). Drag a quest card between columns to update its status.

**Depends on:** Phase 1.5 (quest type) + Phase 1.6 (status field)

### 2.3 Split Pane / Note Tabs

- Open multiple notes simultaneously in tabs within the editor panel
- Split pane: view two notes side by side (e.g., NPC + Location during a scene)
- Tab state stored in `useNotesStore`

### 2.4 Collapsible Sections

- Fold/unfold content under headings in the CodeMirror editor
- CodeMirror 6 has folding extensions — wire into the existing editor
- Collapsed state is ephemeral (not persisted)

### 2.5 Slash Commands

- Type `/` in the editor to open a block type picker
- Insert: heading, bullet list, checklist, horizontal divider, code block, table
- CodeMirror completion extension triggered by `/` at line start

### 2.6 Hierarchical Tags

- Support nested tags: `#npc/villain`, `#location/city/inn`
- Tag browser in sidebar shows tree structure with counts
- Click a parent tag to filter all children
- No schema change — tags are already string arrays, nesting is by convention

### 2.7 Full-Text Search

- Replace current title-only search with full-text body search
- In-memory index built at campaign load (FlexSearch or simple regex scan)
- Results ranked by relevance, matching terms highlighted
- Filter by type, tag, status, color
- Accessible via Ctrl+K from anywhere in the app

---

## Phase 3 — Stretch Goals

Major features, each could be its own sprint. Implement when core system is mature.

### 3.1 Board / Canvas View

Milanote-style freeform spatial board for session planning. Drag note cards onto an infinite 2D canvas. Draw connections between them. Separate from the graph view — this is an authoring tool.

### 3.2 Timeline View

Session log notes displayed as a vertical timeline, ordered by creation date. Visual representation of campaign history.

### 3.3 Hover Preview

Hover over a wikilink to see a popout preview card of the linked note (title, type, first ~4 lines of body). No navigation required — quick reference.

### 3.4 AI Assist

- Auto-suggest tags based on note content
- Generate NPC names, location descriptions, quest hooks via Claude API
- Summarize session logs
- Requires `claude-api` skill integration

### 3.5 Templates

Pre-built field structures per note type. Creating a new NPC note opens with predefined sections (Name, Race, Class, Personality, Secrets, Connections). Templates are editable by the DM.

### 3.6 Export

Export notes as PDF, Markdown, or HTML. Print-friendly NPC sheets and session handouts.

---

## Schema Changes Summary

**Migration 007** — Notes enhancements (Phase 1.2–1.7):

```sql
-- Migration 007_notes_enhancements.sql

ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN status TEXT;
ALTER TABLE notes ADD COLUMN color TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(archived);
```

**Migration 008** — Items entity (Phase 1.10):

```sql
-- Migration 008_items.sql

CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rarity TEXT,
    type TEXT,
    properties TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    source_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_campaign ON items(campaign_id);

CREATE TABLE IF NOT EXISTS scene_items (
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    PRIMARY KEY (scene_id, item_id)
);
```

Update `NoteType` in `types.ts`:
```typescript
export type NoteType = 'scene' | 'location' | 'npc' | 'lore' | 'general' | 'quest' | 'session' | 'faction'
```

Update `Note` interface:
```typescript
export interface Note {
    id: string
    campaignId: string
    title: string
    type: NoteType
    body: string
    tags: string[]
    sourceFile: string | null
    pinned: boolean          // NEW
    archived: boolean        // NEW
    status: string | null    // NEW
    color: string | null     // NEW
    createdAt: string
    updatedAt: string
}
```

New `Item` interface (see 1.10 for full definition):
```typescript
export interface Item {
    id: string
    campaignId: string
    name: string
    description: string
    rarity: ItemRarity | null
    type: ItemType | null
    properties: string[]
    tags: string[]
    sourceNoteId: string | null
    createdAt: string
    updatedAt: string
}
```

---

## Implementation Order

Phase 1 sub-sprints (recommended sequence):

| Sub-sprint | Features | Why this order |
|---|---|---|
| 15a | Schema migration 007 + expanded types + status + pinned + archived + color | Data model foundation — everything else reads from these fields |
| 15b | Notes list UI updates: pin section, archive filter, status badges, color stripes, type icons for new types | Visible payoff from 15a, pure UI work |
| 15c | Card Grid view toggle | New view mode, independent of other features |
| 15d | Quick Capture modal | Independent component, high DM value |
| 15e | Wikilinks — CodeMirror autocomplete + decoration + preview rendering | Core editor enhancement |
| 15f | Backlinks panel + wikilink navigation | Completes the wikilink system |
| 15g | Item entity — migration 008, types, store, API, basic UI | Data model for items before extraction needs it |
| 15h | Smart Import Parser — document parser engine + preview/confirm UI | Feature A: whole-document extraction |
| 15i | Inline Extract — CodeMirror context menu + extraction modal + auto-linking | Feature B: selection-level extraction (depends on 15e wikilinks) |

---

## Design Principles (from the Brief)

1. **Speed above all.** Every note retrieval under 2 seconds. DM cannot be hunting while players wait.
2. **Context-aware.** Surface relevant notes automatically based on active scene.
3. **Notes serve the DM.** Intelligent defaults, zero maintenance overhead.
4. **The world is connected.** Wikilinks and backlinks are as valuable as the content itself.
5. **Never lose a note.** Archive instead of delete. Soft delete only.
6. **Markdown is power, not obligation.** Rich WYSIWYG editing that outputs clean markdown.
7. **Dark theme is home.** The aesthetic should feel like a DM's tome — dark, warm, purposeful.

---

*End of Specification*
