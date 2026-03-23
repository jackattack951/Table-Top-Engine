# GGTTRPG UI Overhaul Guide

This document serves as the comprehensive master plan for polishing the UI and UX of the GGTTRPG application. The goal is to increase functionality, usability, efficiency, and immersion across the entire platform.

---

## 0. Foundation (COMPLETED)

The foundation work establishes the responsive layout system, production-grade color palette, and information density that all subsequent overhaul work builds on. See `Overhaul/UI/foundation-spec.md` for full technical details.

### 0.1. Responsive Layout System (DONE)
- **What landed:** Max-width constraints prevent panels from stretching on ultrawide monitors. Content caps at 1800px and centers. Dashboard, AV tab, and combat tab all have appropriate width limits.
- **Breakpoints:** 1024px (tablet) → 1440px (desktop) → 1920px (primary target). Panels stop growing at ~1920px; wider viewports get breathing room, not wider panels.
- **Dashboard:** `max-width: var(--content-max-width)` with `margin-inline: auto`. Grid reflows: 1 col (mobile) → 2 col (1024px) → 3 col (1440px).
- **AV Tab:** Same tiered grid reflow replacing the old single 767px breakpoint.
- **Combat Tab:** Capped at 1000px width.
- **Layout tokens:** `--content-max-width: 1800px`, `--panel-max-width: 600px`, `--panel-min-width: 320px` in `shared/design-tokens.css`.

### 0.2. Color Palette — Production Surface (DONE)
- **Direction:** Shifted from "gamer UI" (purple accent, pure black backgrounds) to "broadcast control surface" (neutral grays, teal accent, visible borders). References: OBS Studio, Resolume Arena, Blackmagic ATEM.
- **Accent:** Teal `#2DD4BF` — cool/technical, does not conflict with warning/danger status colors.
- **Backgrounds:** Warmer neutrals (`#141416` → `#1C1C1F` → `#252528` → `#2E2E32`). Not pure black.
- **Borders:** More visible (`#35353A` / `#45454B`) — panels read as distinct regions.
- **Text:** Slightly muted default (`#D4D4D8`), bright white reserved for active/important.
- **Radii:** Tighter (3/5/8/10px) for production-tool feel, less "bubbly."
- **PixiJS:** `shared/color-constants.ts` updated to match teal accent.

### 0.3. Spacing & Density (DONE)
- **~20% tighter** padding and gaps across header, tab bar, dashboard, AV tab, combat tab.
- **Tab buttons:** Uppercase, tracked lettering (`--text-xs`, `font-weight: 600`, `letter-spacing: 0.04em`). Production-style control labels.
- **Header:** Reduced from 52px to 40px min-height.
- **Utility class:** `.label-caps` for section headers (11px, 600 weight, uppercase, tracked).

### 0.4. LobbyPanel Removal (DONE)
- Removed the `<LobbyPanel />` dropdown from the cockpit header (`App.tsx`). All player/lobby functionality now lives exclusively in the collapsible right-hand `PlayerSidebar`.
- `lobby-panel.tsx` and its test file still exist on disk — can be deleted once confirmed fully unused.

### 0.5. Hardcoded Color Cleanup (DONE)
- Extracted hardcoded copper color `#c4875a` to `--color-copper` token.
- Fixed breakpoint overlap at 1024px (tablet max-width → 1023px).

---

## 1. Dashboard (The Control Center)

The Dashboard is the GM's primary interface during gameplay. It must support high information density without feeling cramped, and allow for extreme flexibility.

### 1.1. Dockable Panel System — FlexLayout (Next Priority)
- **Concept:** Replace the fixed 3-column CSS grid with `flexlayout-react`, giving the DM a fully customizable dockable workspace.
- **PREP / PLAY Mode Integration:**
  - **PREP mode:** Panels are draggable, resizable, splittable. Drag a panel tab to dock it alongside, above, below, or as a new tab in another panel set. Resize splits by dragging dividers.
  - **PLAY mode:** Layout locks. All drag handles, resize grips, and drop zones disappear. Zero risk of accidental rearrangement mid-session.
- **Panel Factories:** Each dashboard component (GB Preview, SFX/Environment/AMB, Combat/Spells/Notes/NPC/Dice, Scene Timeline, Notes Strip) becomes a registered panel factory that FlexLayout can instantiate anywhere.
- **Layout Persistence:** Save layout JSON to SQLite per campaign. Restore on campaign load. Provide a "Reset to Default" option.
- **Default Layout:** Ships with a sensible default matching the current 3-column + timeline + notes arrangement.
- **Implementation Phases:**
  - Phase A: Install `flexlayout-react`, wire up panel factories, default layout
  - Phase B: PREP/PLAY toggle integration, drag/resize/dock in PREP only
  - Phase C: Layout persistence (SQLite per campaign, restore on load)

### 1.2. Resizable Vertical Splitter (Dashboard)
- **Concept:** Before full FlexLayout, add a simple drag handle between the columns area and the notes strip, allowing the DM to control how much vertical space each gets.
- **Status:** Noted for implementation. May be superseded by FlexLayout (Section 1.1).

### 1.3. Thematic Bleed (Immersion)
- **Concept:** The Dashboard should visually reflect the narrative environment.
- **Mechanics:**
  - When the GM selects an Environment preset (e.g., Tavern, Rain, Cave), the overall CSS variables of the application (background gradients, accent colors, panel opacities) shift subtly to match the mood.
  - Include ambient, non-intrusive visual effects (e.g., slow-moving rain lines, floating embers, or atmospheric glowing orbs in the background) that enhance the atmosphere without reducing text readability.

### 1.4. Micro-Interactions & Kinetic Feedback
- **Concept:** The UI should feel snappy, physical, and immediately responsive to GM actions.
- **Mechanics:**
  - **Quick Dice:** Replace static numbers with animated, rolling transitions (ticking numbers before settling on the final result). Highlight critical successes and failures with distinct colors (e.g., green for 20, red for 1).
  - **Combat Tracker:** Health bar adjustments should transition smoothly (`width 0.4s ease-out`) rather than snapping instantly. Health bar colors should dynamically shift based on percentage (e.g., turning yellow below 50%, red and pulsing below 25%).
  - **General Polish:** Utilize smooth transitions for accordion expansions (like in `QuickSpells`), hover states, and drag-and-drop operations to make the application feel premium.

### 1.5. Persistent Scratchpad (Reliability)
- **Concept:** Prevent accidental data loss for quick session notes.
- **Mechanics:** Wire the `NotesStrip` scratchpad to `localStorage` or `sessionStorage` with a debounce function, ensuring text remains safely stored even if the GM accidentally refreshes the page.

---

## 2. Scenes Tab (The Narrative Architect)

The Scenes Tab (`ScenesTab.tsx`, `scene-card.tsx`, `scene-advancer.tsx`) manages the campaign's structural flow. It currently uses a vertical list of expandable cards. While functional, it feels more like a database interface than a creative writing or flowchart tool.

### 2.1. Visual Flowchart Layout (Usability & Efficiency)
- **Concept:** Move from a top-down list to a 2D or visual node-based flowchart (similar to Miro or Obsidian Canvas).
- **Mechanics:**
  - Since scenes have `branches` pointing to other `targetSceneId`s, the relationship between scenes is non-linear. A visual web/tree makes this instantly understandable.
  - Allow the GM to pan and zoom around their scene web.
  - Dragging a connection from one Scene Node to another instantly creates a branch.
  - *Fallback option:* If a full 2D canvas is too complex, switch to a horizontal Kanban-style board (e.g., "Past", "Active", "Future Branches").

### 2.2. Card Redesign & Collapsible Density (Density)
- **Concept:** The current `SceneCard` requires clicking to expand and see branches or notes, forcing the GM to open and close cards repeatedly to find information.
- **Mechanics:**
  - Design a denser, "glanceable" card state that shows the branch labels and connected note titles as small inline tags without needing full expansion.
  - Add quick-action hover buttons directly on the collapsed card (e.g., "Load Scene", "Add Note") so the GM doesn't have to expand the card to perform basic actions.

### 2.3. Scene Advancer Polish (Kinetic Feedback)
- **Concept:** When a GM selects a branch in the `SceneAdvancer`, the transition should feel weighty and momentous, pulling the party into the next narrative beat.
- **Mechanics:**
  - Replace the current 2-second basic text toast with a dramatic visual transition that sweeps across the screen or fades the UI out and back in.
  - Animate the active scene indicator moving physically from the old card to the new card along the branch line.

---

## 3. Combat Tab (The Tactical HUD)

The Combat Tab (`CombatTab.tsx`) is the most mechanically dense view. It tracks initiative, HP, conditions, and turn order. Currently, it functions like a spreadsheet with buttons. We need it to feel like a high-speed tactical HUD.

### 3.1. Compact & Expandable Rows (Usability & Density)
- **Concept:** The current combatant rows take up significant vertical space, which means in a large combat, the GM has to scroll constantly.
- **Mechanics:**
  - Standardize a much thinner row for combatants whose turn it *is not*. Show only Avatar, Name, mini-HP bar, and mini-Initiative.
  - Automatically expand the row for the *Active* combatant, revealing the full damage/heal buttons, condition toggles, and detailed stats.
  - Allow manual expansion of any row by clicking it.

### 3.2. Visual Urgency & State Bleed (Immersion & Kinetic Feedback)
- **Concept:** The UI should immediately communicate the state of the battle without requiring the GM to read numbers.
- **Mechanics:**
  - **Bloodied State:** If a combatant drops below 25% HP, the row's background should pulse softly with a red tint, and the avatar border should crack or splinter visually (using SVGs/CSS).
  - **Condition Visuals:** Instead of just text chips ("poisoned", "stunned"), accompany conditions with intuitive icons (e.g., a green droplet for poison, a dizzy swirl for stunned). Animate these icons subtly (e.g., a slow drip animation for poison) to draw the GM's eye to ongoing effects.
  - **Next Turn Animation:** When clicking "Next Turn," the active turn indicator shouldn't just instantly snap. It should slide forcefully down the list to the next combatant, settling with a satisfying visual "clunk" (using Framer Motion).

### 3.3. Boss/Important NPC Highlighting (Efficiency)
- **Concept:** Make it instantly obvious who the major threats are.
- **Mechanics:** Give the GM an option to mark a combatant as a "Boss" or "Elite." This changes their row styling to be more ornate (e.g., a thicker, gold/spiked border) and pins their HP bar to the top of the combat view regardless of their initiative order, ensuring the GM never loses track of the primary antagonist.

---

## 4. NPCs Tab (The Cast Directory)

The NPCs Tab (`NPCsTab.tsx`) provides a list-based view with inline stat blocks. It's functional, but can feel dry and lacks visual hierarchy when browsing a large cast of characters.

### 4.1. Visual Roster Grid (Usability)
- **Concept:** Transition from a pure text list to a visual "roster" or grid of character cards.
- **Mechanics:**
  - Represent NPCs as cards featuring visual avatars or portraits (even if just generated initials/colors initially, leaving room for future image uploads).
  - The cards should display key glanceable info: Name, core concept/personality snippet, and a quick-action button to send them directly to the active Combat tracker.

### 4.2. Stat Block Redesign (Density & Aesthetics)
- **Concept:** The currently expanded `StatBlock` feels like reading a raw JSON dump. It needs to look like a premium TTRPG book.
- **Mechanics:**
  - Use a classic, parchment-style (or sleek sci-fi, depending on the game theme) UI box for the stat block.
  - Visually separate core stats (STR/DEX) into bold, stylized badges rather than a plain table flexbox.
  - Implement a two-column layout for the stat block so viewing it doesn't push the rest of the NPC list off the bottom of the screen.

### 4.3. Seamless Inline Editing (Efficiency)
- **Concept:** Fixing a typo mid-session shouldn't require opening a massive form.
- **Mechanics:** Implement "click-to-edit" (or a subtle edit pencil icon) on individual fields within the stat block, rather than replacing the entire block with the `NPCForm`.

---

## 5. Spells & Reference Tab (The Rulebook)

The Spells Tab (`SpellsTab.tsx`) essentially serves as the SRD search engine. Given that it relies purely on local JSON searching, speed and clarity are paramount here.

### 5.1. Focused Search Experience (Usability)
- **Concept:** The search field should be the absolute hero of this tab.
- **Mechanics:**
  - Increase the size of the search input field and add a keyboard shortcut (e.g., `Ctrl+K` or `/`) to instantly focus it from anywhere in the app when the Spells tab is open.
  - Implement "fuzzy" highlighting so the user sees exactly *why* a result appeared (e.g., highlighting "fire" within the description of a spell).

### 5.2. Pinned Reference Cards (Efficiency)
- **Concept:** Often a GM looks up a rule (like "Grappled") and needs to keep it visible while looking up something else.
- **Mechanics:** Add a "Pin to Desk" icon on any expanded `ResultCard`. Clicking it pulls the card out of the search results flow and pins it to the top of the Spells tab (or perhaps to the persistent scratchpad area), so the GM can perform a new search without losing their current reference.

### 5.3. Visual Spell Tags (Density & Aesthetics)
- **Concept:** Make spell characteristics instantly identifiable without reading block text.
- **Mechanics:** Replace textual information like components (V,S,M), cast time, and range with a row of stylized iconography (e.g., a small hourglass icon for cast time, a crosshair icon for range).

---

## 6. Notes Tab (The Obsidian Notebook)

The Notes Tab (`NotesTab.tsx`) uses a standard dual-pane layout (List on left, Editor on right). While clean, it can feel restrictive for GMs who prefer spatial organization or need to reference multiple notes simultaneously.

### 6.1. Multi-Document/Canvas Layout (Flexibility)
- **Concept:** Escape the strict dual-pane constraint.
- **Mechanics:**
  - Similar to the Dashboard's Dockable Tabs, allow GMs to split the right-hand editor pane horizontally or vertically to view two or more notes side-by-side.
  - *Advanced:* Implement a full "Canvas" view where notes can be placed arbitrarily on an infinite board and linked together visually, functioning as a relationship map or corkboard.

### 6.2. Rich Bi-Directional Linking (Usability)
- **Concept:** While notes string together with scenes easily, the *content* of the notes should drive navigation.
- **Mechanics:**
  - Implement full auto-complete for linking. Typing `[[` inside the editor should instantly bring up a searchable dropdown of other Notes, NPCs, Spells, and Scenes.
  - Clicking a linked entity inside a note should open a small, non-obtrusive popover preview of that entity instead of navigating away and losing context entirely.

### 6.3. Focus Mode (Immersion)
- **Concept:** Writing prep requires getting out of the "system administrator" mindset.
- **Mechanics:** Add a "Focus Mode" toggle that smoothly hides the sidebar list, expands the editor to 80% width, centers the text, and dims the background, creating a distraction-free writing environment.

---

## 7. AV Tab (The Production Booth)

The AV Tab (`AVTab.tsx`) dictates what the players see. It's currently a rigid 3x2 grid of settings and previews.

### 7.1. Drag-to-Player Projection (Kinetics & Control)
- **Concept:** The act of showing a visual to players should feel tactile and authoritative.
- **Mechanics:**
  - Instead of just clicking a dropdown to set the GameBoard, allow the GM to drag an image asset from a media library side-panel directly onto the "GB Preview" drop zone.
  - When the asset drops, trigger a satisfying "broadcast" animation (like a sonar ping or a glowing shockwave) confirming that the image is now live on the player screens.

### 7.2. Unified Media Library (Usability)
- **Concept:** Finding assets is currently disconnected from deploying them.
- **Mechanics:** Break the rigid 3x2 grid. Standardize a dedicated, searchable, taggable Media Library panel that can dock alongside the Previews, allowing instant access to maps, tokens, and background visuals without leaving the AV tab.

### 7.3. Live Player View Mirroring (Reliability)
- **Concept:** GMs often worry: "Are they *actually* seeing what I think they are seeing?"
- **Mechanics:** The GB Preview shouldn't just be a static thumbnail; it should be a scaled-down iframe or exact live replica of the current active player view, including real-time fog-of-war updates or pointer movements, providing absolute confidence.

---

## 8. Global Theming (Personalization & Accessibility)

Thanks to the application's **unified CSS architecture**, applying and swapping themes will be a seamless, instant process without requiring complex component-level rewrites. A sci-fi campaign can instantly feel different from a high-fantasy one just by toggling global variables.

### 8.1. Robust Light & Dark Modes (Accessibility)
- **Concept:** Ensure the app is comfortable to use in varying physical environments.
- **Mechanics:**
  - Leverage the existing unified CSS to swap color variables cleanly based on a `data-theme="dark"` or `data-theme="light"` root attribute.
  - Implement a dedicated toggle in the global settings, defaulting to the user's system preference (`prefers-color-scheme`).
  - **Light Mode Specifics:** Ensure high contrast for text. Backgrounds shouldn't be stark `#FFF`, but softer paper/parchment off-whites (e.g., `#F9F9F6`) to reduce eye strain.
  - **Dark Mode Specifics:** Avoid pure `#000` backgrounds. Use deep charcoals/blues (e.g., `#0F1115` as currently used, or `#1A1C23`) to allow for distinct panel elevation shadows.

### 8.2. Hot-Swappable Theme Palettes (Personalization)
- **Concept:** Allow the GM to easily reskin the entire application with a single click.
- **Mechanics:**
  - Because the CSS is already unified, we can provide a "Theme Picker" in settings that simply injects a new set of CSS variables.
  - Curated palettes could include:
    - *Cyberpunk:* Neon pinks/cyans on pure black backgrounds with square borders.
    - *High Fantasy:* Gold accents, deep crimson highlights, serif fonts, and parchment-textured backgrounds.
    - *Grimdark:* Muted grays, rust colors, and heavy shadows.
    - *VTT Classic:* The current clean, modern dark mode.

### 8.3. "Thematic Bleed" Integration (Immersion)
- **Concept:** Tie the global themes back to the Environment Panel.
- **Mechanics:** As mentioned in the Dashboard section, allow certain Environment presets to temporarily override the global theme colors. For example, if the GM is using the "VTT Classic" theme, selecting the "Lava Cave" environment could temporarily shift the `--color-bg` to have a deep reddish tint and change `--color-primary` from purple to fiery orange until the environment is cleared.
