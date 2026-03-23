

| DM APP Notes System Overhaul *Feature Design Brief* v1.0  —  Electron / Node.js |
| :---: |

# **Executive Summary**

This brief defines the complete overhaul of the Notes system within the DM App. Drawing from deep research into the industry’s leading note-taking applications — Obsidian, Milanote, Google Keep, Bear, Notion, and World Anvil — it distills the best patterns, features, and UX decisions and translates them into a cohesive, DM-specific notes experience built for Electron and Node.js.

The core principle: a DM’s notes are not generic documents. They are a living web of interconnected world knowledge — NPCs, locations, quests, lore, and session logs — that must be fast to create, easy to navigate, and instantly retrievable mid-session. This system is designed around that reality.

# **1\. Competitive Landscape Analysis**

The following apps were researched for their layout, feature set, organizational philosophy, and UX patterns most relevant to DM use cases.

## **1.1 Obsidian — The Knowledge Network**

| Feature | What It Does | DM Relevance |
| :---- | :---- | :---- |
| Bidirectional Links | Linking a note to another auto-creates a backlink in both directions | High — Link NPCs to locations, quests to factions |
| Graph View | Visual node map of all note connections | High — See your world’s web at a glance |
| Canvas | Infinite freeform 2D board for notes and images | Medium — Session planning boards, encounter layouts |
| Vault / Local Storage | All notes stored as Markdown files on device | High — No cloud dependency, instant access mid-session |
| Folding / Collapsing | Collapse headings and indented blocks | High — Hide spoiler content during play |
| Tabs & Split Panes | Multiple notes open side by side | High — Reference NPC while viewing location note |
| Tags \+ Tag Hierarchy | Nested tags like \#npc/villain, \#npc/ally | High — Filter all villains across campaigns |
| Plugin Ecosystem | Kanban, calendar, database views via community plugins | Medium — Inspiration for modular feature design |

| KEY INSIGHT: *Key Obsidian Insight: The most beloved feature is bidirectional linking. DMs on Reddit and forums consistently describe it as transformative for world-building because it mirrors how memory actually works — you think of an NPC and immediately see every place, quest, and faction they’re connected to.* |
| :---- |

## **1.2 Milanote — The Visual Canvas**

| Feature | What It Does | DM Relevance |
| :---- | :---- | :---- |
| Infinite Canvas Board | Drag-and-drop spatial layout for notes, images, links | High — Session prep boards, encounter staging |
| Nested Boards | Boards inside boards for hierarchical organization | High — Campaign \> Arc \> Session structure |
| Mixed Media Cards | Text, image, checklist, link, file on same board | Medium — NPC cards with portrait images |
| Column Layout | Structured column view as alternative to freeform | Medium — Structured session notes |
| Color-Coded Cards | Visual grouping by card background color | High — Distinguish note types at a glance |
| Templates | Pre-built board layouts for common use cases | High — NPC, Location, Quest templates |

| KEY INSIGHT: *Key Milanote Insight: The killer feature for DMs is the ability to see notes spatially rather than in a list. Campaign structure becomes visible as a map of relationships rather than a folder hierarchy. Consider offering a Board View as an optional layout mode.* |
| :---- |

## **1.3 Google Keep — Speed and Simplicity**

| Feature | What It Does | DM Relevance |
| :---- | :---- | :---- |
| Card Grid / Masonry Layout | Notes displayed as a visual card grid, not a list | High — Scannable overview of all active notes |
| Color-Coded Notes | Assign background color per note | High — Quick type identification (red=danger, green=safe) |
| Pinned Notes | Pin important notes to the top of the view | High — Pin current session notes |
| Labels (Flat Tags) | Categorize notes with labels, filter by label | High — Filter by NPC, Location, Quest, etc. |
| Checklists | Inline checkboxes within notes | Medium — Quest objective tracking |
| Quick Capture | Floating action button for instant new note | High — Mid-session quick note capture |
| Archive | Hide completed notes without deleting | High — Archive resolved quests, dead NPCs |
| Grid / List Toggle | Switch between card grid and compact list view | High — User preference for note density |

| KEY INSIGHT: *Key Keep Insight: The masonry card grid is extremely effective for quick scanning. The entire philosophy is speed — open, capture, close. DMs need this during sessions when they’re managing live play. The Quick Capture pattern should be a first-class feature.* |
| :---- |

## **1.4 Notion — The Flexible Workspace**

| Feature | What It Does | DM Relevance |
| :---- | :---- | :---- |
| Database Views | Same data viewed as Table, Board, Gallery, Calendar, List | High — NPCs as gallery, quests as board, sessions as list |
| Page Templates | Pre-built page structures for common content types | High — NPC Template, Location Template, etc. |
| Slash Commands | Type / to insert any block type inline | High — Fast rich content creation |
| Linked Databases | Reference a database from another page | Medium — Show an NPC’s related quests on their page |
| Properties / Metadata | Structured fields on every page (status, type, tags) | High — NPC status: Alive/Dead, Quest status: Active/Complete |
| Nested Pages | Pages within pages, unlimited depth | High — Campaign \> Region \> City \> Location |
| Inline Mentions | @mention any page or person | High — Reference NPCs by name inline in text |

## **1.5 Bear — The Beautiful Markdown Editor**

| Feature | What It Does | DM Relevance |
| :---- | :---- | :---- |
| Live Markdown Preview | Renders formatting as you type, no raw symbols visible | High — Clean reading experience for long lore notes |
| Hashtag Organization | Tags created by typing \#tagname inline in note text | Medium — Tag notes without leaving the editor |
| Focus Mode | Distraction-free full-screen writing | Medium — Pre-session writing and world-building |
| Nested Tags | \#npc/main, \#location/city/inn etc. | High — Hierarchical type organization |
| Beautiful Typography | Carefully designed reading/writing experience | Medium — Sets the aesthetic bar for note editor quality |
| Note Linking | Link to other notes via \[\[Note Title\]\] | High — Core cross-reference feature |

# **2\. DM-Specific Note Categories**

A DM’s notes fall into distinct, well-understood categories. Each category has different structural needs, different metadata requirements, and different access patterns. The notes system must be aware of these types — not treat all notes as generic documents.

| Note Type | Key Fields | Common Actions | View Priority |
| :---- | :---- | :---- | :---- |
| NPC | Name, Status (Alive/Dead/Unknown), Faction, Location, Personality, Secrets | Quick reference mid-session, link to quests/locations | Gallery or Card Grid |
| Location | Name, Type (City/Dungeon/Wilderness), Region, Connections, DM Notes, Player-visible description | Open during exploration scenes, link to NPCs present | List or Nested Tree |
| Quest / Hook | Title, Status (Active/Resolved/Failed), Giver NPC, Reward, Objectives (checklist) | Track completion, link to related NPCs and locations | Kanban Board |
| Session Log | Session \#, Date, Summary, Key Events, Player Decisions, Cliffhanger | Review before next session, link to notes created in session | Chronological List |
| Lore / World Notes | Title, Category (History/Magic/Religion/etc.), Free-form text | Reference during play, build wiki-style knowledge base | Tag-filtered List |
| Faction | Name, Alignment, Leader NPC, Goals, Enemies, Current Activities | Reference during political scenes | Card Grid |
| Item / Treasure | Name, Type, Description, Value, Current Holder | Track player loot, reference during shopping/rewards | List |
| Session Prep | Strong Start, Scenes, Secrets & Clues, Monsters, Treasure (Sly Flourish 8-step) | Pre-session planning | Structured Template |

| DEVELOPER NOTE: *Implementation Note: The app should ship with these 8 note types as built-in templates with predefined field structures. Users should also be able to create custom note types. Each type should have a distinct icon and color in the UI for instant visual identification.* |
| :---- |

# **3\. Layout Architecture**

The notes system should be a dedicated section of the app with its own layout. It should never feel like an afterthought panel bolted onto a character sheet. Based on competitive research, the following layout architecture is recommended.

## **3.1 Three-Panel Layout (Primary)**

This is the core layout, inspired by Obsidian’s proven three-column structure:

* Left Panel — Navigation Sidebar (collapsible, \~220px)

  * Note type filter tabs (All, NPCs, Locations, Quests, Sessions, Lore, etc.)

  * Tag/label browser with note count badges

  * Search bar with type and tag filters

  * Starred / Pinned notes section at top

  * Recent notes list

* Center Panel — Note List (\~300px)

  * Scrollable list or card grid of notes filtered by left panel selection

  * Toggle between List View and Card Grid View

  * Sort by: Modified, Created, Name, Type

  * Quick-create button at top of list

* Right Panel — Note Editor (fills remaining space)

  * Full rich-text editor with markdown support

  * Note metadata panel (type, tags, status, linked notes) at top

  * Backlinks section at bottom showing all notes that reference this one

## **3.2 Alternative View Modes**

Users should be able to switch the main content area between view modes:

* List View — Default, compact, shows note title \+ excerpt \+ type icon

* Card Grid View — Google Keep-style masonry grid, color-coded by type or user color

* Kanban View — Columns for Quest statuses (Active, In Progress, Resolved, Failed)

* Timeline View — Session logs and dated notes in chronological order

* Board View (Stretch Goal) — Milanote-style freeform canvas for campaign/session planning

| DEVELOPER NOTE: *Developer Note: Start with List View and Card Grid as the two core modes. Kanban and Timeline are high-value additions for Phase 2\. The Board/Canvas view is a major feature and should be scoped separately.* |
| :---- |

## **3.3 Quick Capture (Floating)**

A persistent floating action button (FAB) or keyboard shortcut (e.g., Ctrl+Shift+N) should be available at all times in the app — even when in other sections like combat or character sheets. Activating it opens a small Quick Note modal that lets the DM jot something down in under 3 seconds and auto-files it to an Inbox or Unsorted category for later organization.

# **4\. Note Editor Features**

The editor is where DMs spend the most time. It must be excellent. The benchmark is Bear’s typography quality combined with Notion’s slash-command block system and Obsidian’s wikilink system.

## **4.1 Core Editing Capabilities**

| Feature | Description | Priority |
| :---- | :---- | :---- |
| Rich Text / Markdown | Live markdown rendering (WYSIWYG style, not raw symbols) | P0 — Must Have |
| Headings H1-H3 | Structural headings for organizing long notes | P0 — Must Have |
| Bold, Italic, Underline | Standard inline formatting | P0 — Must Have |
| Ordered & Unordered Lists | Bullet and numbered lists | P0 — Must Have |
| Checklists | Checkbox lists for quest objectives, prep checklists | P0 — Must Have |
| Code Blocks | For stat blocks, tables of numbers, game mechanics | P1 — High Value |
| Tables | Inline tables for stat comparisons, encounter tables | P1 — High Value |
| Horizontal Divider | Visual section break within a note | P1 — High Value |
| Collapsible Sections | Fold/unfold sections under a heading | P1 — High Value |
| Image Embed | Insert/paste images inline (NPC portraits, maps) | P1 — High Value |
| Slash Commands | Type / to open block type picker | P1 — High Value |
| Focus / Zen Mode | Full-screen distraction-free editor | P2 — Nice to Have |
| Typeface Options | Choose from 2-3 comfortable reading fonts | P2 — Nice to Have |

## **4.2 Note Metadata Panel**

Every note should have a metadata panel (collapsible, above the editor body) with the following fields. These are stored as structured data, not in the note text.

* Note Type — Dropdown (NPC, Location, Quest, etc.) with color-coded icon

* Status — Contextual to note type (NPC: Alive/Dead/Unknown; Quest: Active/Resolved/Failed)

* Tags — Free-form tags, shown as pill badges, type-ahead suggestions

* Linked Notes — Manually link related notes; shown as clickable chips

* Created / Modified — Auto-generated timestamps

* Campaign — Which campaign this note belongs to (supports multi-campaign)

* Pinned / Starred — Toggle to pin to top of note list

## **4.3 Wikilinks — Core Cross-Reference System**

Inspired by Obsidian’s most loved feature, wikilinks allow DMs to create a networked knowledge base. When a DM types \[\[ in the editor, an autocomplete dropdown appears showing matching notes. Selecting one inserts a clickable link that navigates to that note.

* Syntax: \[\[Note Title\]\] — renders as a styled hyperlink in the editor

* Autocomplete: Fuzzy search of all notes in the current campaign as you type

* Backlinks: Every note shows a ‘Referenced By’ section listing all notes that link to it

* Broken Links: If a linked note is deleted, the link is styled with a warning color (not silently broken)

* Hover Preview (Stretch): Hover over a wikilink to see a quick-preview popout of the linked note

| HIGH PRIORITY: *This is the most impactful feature the notes system can offer. The ability to type \[\[Mira Ashveil\]\] in a quest note and navigate directly to that NPC’s full page transforms the notes from a folder of documents into a living, interconnected world encyclopedia.* |
| :---- |

# **5\. Organization System**

## **5.1 Tagging Strategy**

Tags are the primary organization mechanism alongside note types. The system should support:

* Flat tags: \#faction, \#secret, \#important, \#player-visible

* Hierarchical tags: \#npc/villain, \#location/city, \#quest/main-arc

* Auto-suggest existing tags as the user types to prevent duplicates

* Tag browser in the sidebar showing all tags with note counts

* Click any tag to filter the note list instantly

* Notes can have unlimited tags

## **5.2 Campaign Scoping**

All notes belong to a specific Campaign. The notes system should:

* Show only notes for the currently active campaign by default

* Allow a ‘Search All Campaigns’ mode for finding notes across the entire vault

* Support duplicating a note from one campaign to another

* Notes created in the Campaign setup flow should auto-link to the campaign

## **5.3 Search**

Search must be fast and intelligent, not an afterthought. Requirements:

* Global search bar accessible via Ctrl+F or Ctrl+K from anywhere in the app

* Full-text search across all note body content

* Filter search by note type, tag, or campaign

* Results ranked by recency and relevance

* Highlight matching search terms in results

* Search history / recent searches

## **5.4 Inbox / Unsorted**

Notes created via Quick Capture land in an Inbox section — visible at the top of the sidebar. The DM processes this inbox by assigning proper types, tags, and links. This follows the GTD-inspired capture-then-organize workflow. The inbox count shows as a badge number so it’s never forgotten.

# **6\. Key UX Patterns to Implement**

## **6.1 From Google Keep**

* Color-coded note cards — user assigns a color to a note for visual scanning

* Pin notes to top of list — current session notes always visible first

* Archive instead of delete — completed quests and dead NPCs go to archive, not trash

* Masonry card grid — optional layout mode for visual people

* Quick Capture FAB — always-accessible fast note creation

## **6.2 From Obsidian**

* Bidirectional wikilinks — \[\[Note Name\]\] syntax with auto-backlink tracking

* Collapsible sections in editor — fold long notes during sessions

* Tabs — multiple notes open simultaneously, switch without losing place

* Split pane — view two notes side by side (e.g., NPC \+ Location during a scene)

* Tag hierarchy — nested tags like \#npc/villain for rich filtering

## **6.3 From Notion**

* Note type templates — new NPC opens with predefined fields pre-filled

* Structured metadata fields — Status, Type, Campaign as structured properties (not free text)

* Slash commands — / to insert rich content blocks without leaving the keyboard

* Inline @mentions — @NPC name, @Location name inserts a link inline

## **6.4 From Milanote**

* Board view (session prep) — spatial card layout for pre-session planning

* Mixed media cards — notes can contain images (NPC portrait), text, and checklists

* Color-coded section organization — visual grouping of note types

# **7\. Technical Recommendations**

The following are implementation notes for your developer, based on common patterns in Electron/Node.js note apps.

## **7.1 Data Storage**

* Store notes as JSON files on disk (one file per note), organized in campaign folders

* Each note file: { id, title, type, body, tags, status, linkedNotes, createdAt, modifiedAt, pinned, color, campaign }

* Build a local in-memory index at startup for fast search (Lunr.js or FlexSearch are excellent choices)

* Backlinks can be computed from the index — scan all notes for \[\[Title\]\] references

* No cloud sync required for v1; local file storage is the right pattern for a DM tool

## **7.2 Editor Library Options**

| Library | Pros | Cons | Recommendation |
| :---- | :---- | :---- | :---- |
| TipTap (ProseMirror) | Very powerful, extensible, great docs, supports slash commands, wikilinks via extensions | Larger bundle size | RECOMMENDED — Best fit |
| Quill.js | Mature, well-supported, simpler API | Less extensible, older ecosystem | Fallback option |
| CodeMirror 6 | Excellent for markdown source mode, lightweight | More work to build WYSIWYG | Only if raw markdown preferred |
| Slate.js | Highly customizable React-based editor | More complex to implement | If using React renderer |

## **7.3 IPC Architecture**

Following the existing app architecture pattern:

* notes:create — creates new note file, returns note object with generated ID

* notes:update — saves note content and metadata to disk

* notes:delete — moves note to .trash subfolder (soft delete)

* notes:archive — sets note.archived \= true, removes from main list

* notes:search (query, filters) — returns ranked search results from index

* notes:getBacklinks (noteId) — returns all notes that contain \[\[This Note Title\]\]

* notes:getAll (campaignId) — returns all non-archived notes for a campaign

## **7.4 File Structure**

Suggested additions to the existing project:

**renderer/notes/**  — All notes UI components

  NotesList.js, NoteEditor.js, NotesSidebar.js, NoteCard.js, QuickCapture.js

**main/notes.js**  — IPC handlers, file I/O, search index

**data/{campaignId}/notes/**  — Note JSON files, .trash/, .archive/ subfolders

# **8\. Phased Rollout Plan**

Not everything should be built at once. Here’s a recommended phasing:

## **Phase 1 — Core Notes (Must Have)**

| Feature | Description |
| :---- | :---- |
| Note Types | 8 built-in types (NPC, Location, Quest, Session, Lore, Faction, Item, Prep) with templates |
| Rich Text Editor | Headings, bold/italic, bullets, checklists, images via TipTap |
| Metadata Panel | Type, Status, Tags, Campaign, Timestamps, Pinned toggle |
| Wikilinks | \[\[Note Name\]\] syntax with autocomplete, renders as clickable link |
| Backlinks Panel | Shows all notes that link to current note |
| Search | Full-text search with type \+ tag filters |
| List \+ Card Views | Toggle between compact list and masonry card grid |
| Quick Capture | Keyboard shortcut modal for fast note creation |
| Pin \+ Archive | Pin to top; archive completed notes without deleting |
| Color Coding | User-assignable note color (8 options) |

## **Phase 2 — Power Features (High Value)**

| Feature | Description |
| :---- | :---- |
| Kanban View | Quest notes displayed as a drag-and-drop kanban board by status |
| Timeline View | Session logs shown as a vertical timeline |
| Split Pane | View two notes side by side |
| Note Tabs | Open multiple notes in tabs within the editor panel |
| Note Graph View | Visual node map of linked notes (Obsidian-style) |
| Slash Commands | / to insert rich content blocks (table, image, divider, etc.) |
| Inline Mentions | @mention to link to a note by name inline in text |
| Collapsible Sections | Fold content under headings |

## **Phase 3 — Stretch Goals**

| Feature | Description |
| :---- | :---- |
| Board / Canvas View | Milanote-style freeform spatial board for session planning |
| Hover Preview | Hover over a wikilink to see a popout preview of the linked note |
| AI Assist | Auto-suggest tags, generate NPC names, summarize session logs via Claude API |
| Export | Export notes as PDF, Markdown, or HTML |
| Note History | Version history for notes — undo major edits |
| Print / Share | Print-friendly NPC sheets and session handouts |

# **9\. Design Principles**

These should guide every decision in the notes system implementation:

* **1\.** Speed above all. A DM cannot be hunting for a note while players are waiting. Every retrieval action should take under 2 seconds.

* **2\.** Context-aware. The app should know when you’re in an active session and surface the most relevant notes automatically.

* **3\.** Notes serve the DM, not the other way around. The system should have intelligent defaults and require zero maintenance to stay functional.

* **4\.** The world is connected. Relationships between notes (wikilinks, backlinks) are as valuable as the note content itself.

* **5\.** Never lose a note. Soft delete only. Archive rather than delete. Version history in Phase 3\.

* **6\.** Markdown is power, not obligation. Offer rich WYSIWYG editing that outputs clean markdown under the hood.

* **7\.** The dark theme is home. The app aesthetic should feel like a tome or a dungeon master’s screen — dark, warm, purposeful.

*End of Brief*  
Questions or clarifications: review with developer before sprint planning.