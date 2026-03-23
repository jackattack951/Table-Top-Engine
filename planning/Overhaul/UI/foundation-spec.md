# UI Foundation Spec — Responsive Layout, Color Palette, Spacing & Density

**Status:** Draft — awaiting review before implementation
**Depends on:** `design-tokens.css`, `src/ui/index.css`, all tab components
**Related:** `UI_Overhaul.md` (parent vision doc), `css-unification-spec.md` (token extraction)

---

## Problem Statement

The cockpit UI has zero width constraints above 767px. On a 3440x1440 ultrawide, every panel stretches to fill the viewport — dashboard columns hit ~1130px each, combatant rows span 3400px, and the AV grid zones balloon to unusable widths. The color palette leans "gamer" (purple accent, deep black backgrounds) rather than "production control surface." Spacing is uniform and airy where it should be dense and hierarchical.

This spec covers three foundation phases that must land before any per-tab polish or dockable panel work.

---

## Target Viewports

| Token | Width | Target Device | Role |
|-------|-------|---------------|------|
| `--bp-tablet` | `1024px` | iPad, small laptop | Minimum supported |
| `--bp-desktop` | `1440px` | Standard laptop | Comfortable baseline |
| `--bp-full` | `1920px` | Full HD monitor | **Primary design target** |
| `--bp-wide` | `2560px` | QHD / Ultrawide | Panels stop growing, space redistributed |

**Core principle:** Content density plateaus at ~1920px. Wider viewports get more panels visible or more breathing room — never wider panels.

---

## Phase 1: Responsive Container System

### 1.1 New Layout Tokens

Add to `shared/design-tokens.css`:

```css
/* Layout constraints */
--content-max-width: 1800px;       /* Hard cap for single-flow content */
--panel-max-width: 600px;          /* Max width for any individual panel/zone */
--panel-min-width: 320px;          /* Min width before panel collapses/stacks */

/* Breakpoints (for reference — used in media queries, not as var()) */
/* 1024px  — tablet */
/* 1440px  — desktop */
/* 1920px  — full HD */
/* 2560px  — wide */
```

### 1.2 Cockpit Shell Changes

**`.cockpit-main`** — No changes (stays `flex: 1`).

**`.tab-content`** — Add horizontal centering with max-width:

```css
.tab-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  /* NEW: prevent infinite stretch */
  max-width: var(--content-max-width);
  margin-inline: auto;          /* Center within cockpit-main */
  width: 100%;                  /* Fill up to max-width */
}
```

> **Decision point:** Should `.tab-content` get max-width, or should each tab manage its own? Per-tab control is more flexible (e.g., AV tab might want wider than Dashboard), but a shell-level cap is simpler and consistent. **Recommendation:** Shell-level cap at 1800px, individual tabs can override with their own max-width if needed.

### 1.3 Dashboard Tab — Breakpoint Behavior

**Current:** `grid-template-columns: 1fr 1fr 1fr` (always 3 equal columns)

**Proposed:**

| Viewport | Columns | Notes Strip | Behavior |
|----------|---------|-------------|----------|
| < 1024px | 1 column, stacked | Below content | Panels stack vertically, scrollable |
| 1024–1439px | 2 columns | Below columns | GB Preview + Center; Quick Access below or tabbed |
| 1440–1919px | 3 columns | Below columns | Current layout with constrained widths |
| 1920px+ | 3 columns | **Surfaces as 4th column** | Notes strip lifts beside the 3 columns instead of below |

```css
/* Dashboard responsive grid */
.dashboard__columns {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: 1fr;  /* Mobile-first: single column */
}

@media (min-width: 1024px) {
  .dashboard__columns {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 1440px) {
  .dashboard__columns {
    grid-template-columns: 1fr 1fr 1fr;
  }
}

/* Wide: notes strip surfaces as 4th column */
@media (min-width: 1920px) {
  .dashboard {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr minmax(280px, 320px);
    grid-template-rows: 1fr auto;
  }
  .dashboard__columns {
    display: contents; /* Children participate in parent grid */
  }
  .dashboard__notes {
    grid-column: 4;
    grid-row: 1 / -1;
  }
  .dashboard__timeline {
    grid-column: 1 / 4;
  }
}
```

### 1.4 AV Tab — Breakpoint Behavior

**Current:** `grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr` (3x2 grid)

**Proposed:**

| Viewport | Layout | Behavior |
|----------|--------|----------|
| < 1024px | 1 column | Zones stack, scroll vertically |
| 1024–1439px | 2 columns | 2x3 grid, previews on top row |
| 1440px+ | 3 columns | Current 3x2, with max-width per zone |

```css
.av-tab {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: 1fr;
  height: 100%;
}

@media (min-width: 1024px) {
  .av-tab {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
  }
}

@media (min-width: 1440px) {
  .av-tab {
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
}
```

### 1.5 Combat Tab — Width Constraint

Combat is a single-column list. On ultrawide, rows should not span the full viewport.

```css
.combat-tab {
  max-width: 1000px;  /* Combat doesn't benefit from extreme width */
  margin-inline: auto;
  width: 100%;
}
```

### 1.6 Other Tabs

Each remaining tab (Scenes, Notes, NPCs, Spells, Media, Players) gets reviewed for the same pattern:
- Max-width appropriate to content type
- Grid reflow at breakpoints where applicable
- No panel wider than `--panel-max-width` unless it's a primary content area (editor, preview)

---

## Phase 2: Color Palette — Production Surface

### 2.1 Design Direction

Shift from "gaming UI" to "broadcast control surface." References: OBS Studio, Resolume Arena, Blackmagic ATEM Software, broadcast mixing desks.

**Principles:**
- Neutral grays for structure — color is reserved for meaning
- Backgrounds are warm-neutral dark, not blue-black or pure black
- Borders are visible and structural (panels have clear edges)
- Active/selected states use solid fills, not glows or blooms
- Text is slightly muted by default, bright white only for active/important items

### 2.2 Color Token Changes

**Current → Proposed** (two accent options presented for review):

#### Backgrounds & Surfaces

| Token | Current | Proposed | Notes |
|-------|---------|----------|-------|
| `--color-bg` | `#0a0a0a` | `#141416` | Slightly warmer, not pure black |
| `--color-surface` | `#141414` | `#1C1C1F` | Panel backgrounds — visible against bg |
| `--color-surface-2` | `#1e1e1e` | `#252528` | Elevated panels, dropdowns |
| `--color-surface-3` | `#282828` | `#2E2E32` | Hover states, active zones |

#### Borders

| Token | Current | Proposed | Notes |
|-------|---------|----------|-------|
| `--color-border` | `#2a2a2a` | `#35353A` | More visible — panels read as distinct regions |
| `--color-border-2` | `#383838` | `#45454B` | Active/focus borders |

#### Text

| Token | Current | Proposed | Notes |
|-------|---------|----------|-------|
| `--color-text` | `#e8e8e8` | `#D4D4D8` | Slightly muted — reduces eye strain |
| `--color-text-2` | `#a0a0a0` | `#8B8B92` | Secondary labels |
| `--color-text-3` | `#5a5a5a` | `#56565C` | Disabled/hint text |

#### Accent — Option A: Teal (Cool / Technical)

| Token | Current | Proposed | Feel |
|-------|---------|----------|------|
| `--color-accent` | `#6c63ff` (purple) | `#2DD4BF` (teal) | Resolume / technical control surface |
| `--color-accent-dim` | `#4f48c4` | `#14B8A6` | Pressed/active state |
| `--color-accent-glow` | `rgba(108,99,255,0.2)` | `rgba(45,212,191,0.15)` | Subtle highlight |
| `--color-accent-subtle` | `rgba(108,99,255,0.08)` | `rgba(45,212,191,0.06)` | Background tint |

#### Accent — Option B: Amber (Warm / Broadcast)

| Token | Current | Proposed | Feel |
|-------|---------|----------|------|
| `--color-accent` | `#6c63ff` (purple) | `#F59E0B` (amber) | OBS / broadcast desk / warm authority |
| `--color-accent-dim` | `#4f48c4` | `#D97706` | Pressed/active state |
| `--color-accent-glow` | `rgba(108,99,255,0.2)` | `rgba(245,158,11,0.15)` | Subtle highlight |
| `--color-accent-subtle` | `rgba(108,99,255,0.08)` | `rgba(245,158,11,0.06)` | Background tint |

> **Note:** Amber conflicts with `--color-warning` (`#fbbf24`). If amber is chosen, warning would need to shift to orange (`#FB923C`) to maintain distinct semantic meaning.

#### Accent — Option C: Slate Blue (Neutral / Professional)

| Token | Current | Proposed | Feel |
|-------|---------|----------|------|
| `--color-accent` | `#6c63ff` (purple) | `#6B8AFF` (slate blue) | Cooler, less "gamer" than current purple, still blue-family |
| `--color-accent-dim` | `#4f48c4` | `#5471E0` | Pressed/active state |
| `--color-accent-glow` | `rgba(108,99,255,0.2)` | `rgba(107,138,255,0.15)` | Subtle highlight |
| `--color-accent-subtle` | `rgba(108,99,255,0.08)` | `rgba(107,138,255,0.06)` | Background tint |

#### Status Colors (unchanged or minor tweaks)

| Token | Current | Proposed | Notes |
|-------|---------|----------|-------|
| `--color-success` | `#4ade80` | `#4ade80` | Keep — universally understood |
| `--color-warning` | `#fbbf24` | `#fbbf24` (or `#FB923C` if amber accent) | Shift only if amber chosen |
| `--color-danger` | `#f87171` | `#f87171` | Keep — universally understood |

### 2.3 Additional Changes

- **Remove glow/bloom effects** from buttons and active states. Replace with solid background fills.
- **Panel borders become structural.** Every panel/zone gets a `1px solid var(--color-border)` border. Panels are clearly delineated regions, not floating cards.
- **Active tab indicator:** Solid `2px` bottom border in accent color, no glow.
- **Button hover states:** Background lightens one surface step (surface → surface-2), no color glow.

### 2.4 Radius Adjustments

Production tools use **tighter radii** than consumer apps:

| Token | Current | Proposed | Notes |
|-------|---------|----------|-------|
| `--radius-sm` | `4px` | `3px` | Slightly tighter |
| `--radius-md` | `8px` | `5px` | Noticeably tighter — less "bubbly" |
| `--radius-lg` | `12px` | `8px` | Still soft but professional |
| `--radius-xl` | `16px` | `10px` | Cards/modals |

---

## Phase 3: Spacing & Density

### 3.1 Spacing Scale Adjustments

The current scale is fine but usage needs tightening. No token value changes — instead, rules for which token to use where:

| Context | Current Common Usage | Target |
|---------|---------------------|--------|
| Panel internal padding | `--space-3` (12px) or `--space-4` (16px) | `--space-2` (8px) to `--space-3` (12px) |
| Gap between items in a list | `--space-3` (12px) | `--space-2` (8px) |
| Section headers to content | `--space-4` (16px) | `--space-3` (12px) |
| Between major sections | `--space-4` (16px) | `--space-4` (16px) — keep |
| Tab content padding | `--space-4` (16px) | `--space-3` (12px) |

**Goal:** ~20% tighter overall. Dense but not cramped.

### 3.2 Typography Hierarchy

Current text sizes are too uniform (most things are 13–15px). Production tools use sharper hierarchy:

| Role | Current | Proposed Token | Size |
|------|---------|----------------|------|
| Panel/zone headers | `--text-base` (15px) | `--text-sm` (13px) **bold, uppercase, letter-spaced** | Smaller but commanding |
| Primary content | `--text-base` (15px) | `--text-base` (15px) | Keep |
| Secondary labels | `--text-sm` (13px) | `--text-xs` (11px) | Tighter secondary |
| Values/data | `--text-sm` (13px) | `--text-sm` (13px) **medium weight** | Slightly emphasized |
| Tab labels | `--text-sm` (13px) | `--text-xs` (11px) **uppercase, tracked** | Compact tab bar |

**New utility class:**
```css
.label-caps {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-2);
}
```

This is the "section header" treatment used by OBS, Resolume, and most production software for zone labels.

### 3.3 Panel Structure

Every panel/zone should follow this internal structure:

```
┌─ Panel ──────────────────────────────────────┐
│ SECTION LABEL                          [...] │  ← .label-caps + optional actions
│──────────────────────────────────────────────│  ← 1px border-bottom
│ Content area                                 │  ← padding: var(--space-2) to var(--space-3)
│ Dense, functional layout                     │
│                                              │
└──────────────────────────────────────────────┘
```

- Header: `padding: var(--space-2) var(--space-3)`, border-bottom
- Content: `padding: var(--space-2) var(--space-3)`
- Panels are separated by `gap`, not margin — the parent grid owns spacing

---

## Implementation Order

0. **Pre-Phase Cleanup** — Remove `<LobbyPanel />` from `App.tsx`, consolidate player/lobby into sidebar only
1. **Phase 1a** — Add layout tokens to `design-tokens.css`
2. **Phase 1b** — Add `max-width` + `margin-inline: auto` to `.tab-content`
3. **Phase 1c** — Dashboard breakpoints (4 tiers)
4. **Phase 1d** — AV Tab breakpoints
5. **Phase 1e** — Combat Tab + remaining tabs width constraints
6. **Phase 2a** — Swap background/surface/border/text tokens
7. **Phase 2b** — Swap accent tokens (after color choice is made)
8. **Phase 2c** — Remove glow effects, add structural borders, tighten radii
9. **Phase 3a** — Tighten padding/gap across all panels
10. **Phase 3b** — Apply typography hierarchy (`.label-caps`, section headers)
11. **Phase 3c** — Panel structure pass (header/content separation)

Each step is a single commit, independently testable. Total: ~11 focused changes.

---

## Verification Checklist

After all phases, verify at each breakpoint:

- [ ] **1024px** — Panels stack/reflow, nothing overflows, touch targets preserved
- [ ] **1440px** — Comfortable layout, no wasted space, no cramping
- [ ] **1920px** — Optimal layout, everything visible, panels well-proportioned
- [ ] **3440px** — Panels do NOT stretch beyond max-width, extra space is gutters/margins
- [ ] **iPad 2048x1536** — Landscape works with 2-column layout
- [ ] No hardcoded pixel widths outside of tokens
- [ ] All existing tests pass
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- [ ] No `!important` rules added
- [ ] Companion app unaffected (or benefits from shared token changes)

---

## Decisions Made

1. **Accent color:** Teal (Option A) — `#2DD4BF` primary. Cool/technical, Resolume-inspired. Does not conflict with status colors.
2. **Tab content max-width:** Shell-level 1800px cap, individual tabs can override if needed.
3. **Dashboard 4th column at 1920px+:** Notes strip surfaces alongside the 3 columns.
4. **LobbyPanel removal:** Remove the `<LobbyPanel />` dropdown from `App.tsx` (line 137). All player/lobby functionality consolidates into the collapsible right-hand sidebar (`player-sidebar.tsx`). The lobby-panel component and CSS can be deleted once confirmed the sidebar is self-contained.

## Open Questions

1. **Companion app:** Should it inherit the palette changes from shared tokens, or maintain its own lighter/simpler palette?
