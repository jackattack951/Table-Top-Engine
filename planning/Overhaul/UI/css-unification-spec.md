# CSS Unification — Implementation Specification

**Document Type:** Overhaul Implementation Guide
**Created:** March 2026
**Status:** Phase 1 (Documentation + Token Foundation) — Ready for Implementation

---

## 1. Executive Summary

A comprehensive CSS audit of the TTRPG Stage Manager codebase revealed a well-structured design system with ~95% adherence to CSS custom properties. The project uses a single global stylesheet (`src/ui/index.css`, 2,094 lines) with no CSS frameworks, preprocessors, or CSS-in-JS libraries.

**What's working well:**
- Comprehensive design token system (~45 CSS custom properties)
- Consistent BEM-style class naming (~150+ semantic classes)
- Dark theme native design
- Apple HIG 44px tap targets throughout
- 3 responsive breakpoints (mobile/tablet/desktop)
- No framework bloat — pure CSS

**What needs fixing:**
- 5 hardcoded `#fff` values in CSS + 3 in TSX files
- 8+ manual `rgba()` constructions that should be tokens
- 227 inline styles across 15 TSX files (mostly layout/flexbox)
- Duplicated `inputStyle` objects in 2+ components
- No shared color constants for PixiJS ↔ CSS alignment
- 1 `!important` override that should be fixed properly
- Performance overlay uses no design tokens at all

---

## 2. Design Token Inventory

### 2.1 Existing Tokens (`:root` in `index.css`)

#### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#0a0a0a` | Page/app background |
| `--color-surface` | `#141414` | Elevated surface level 1 |
| `--color-surface-2` | `#1e1e1e` | Elevated surface level 2 |
| `--color-surface-3` | `#282828` | Elevated surface level 3 |
| `--color-border` | `#2a2a2a` | Default border |
| `--color-border-2` | `#383838` | Stronger border |
| `--color-text` | `#e8e8e8` | Primary text |
| `--color-text-2` | `#a0a0a0` | Secondary text |
| `--color-text-3` | `#5a5a5a` | Tertiary/disabled text |
| `--color-accent` | `#6c63ff` | Primary action (purple) |
| `--color-accent-dim` | `#4f48c4` | Accent hover state |
| `--color-accent-glow` | `rgba(108, 99, 255, 0.2)` | Accent transparent bg |
| `--color-success` | `#4ade80` | Success/healthy state |
| `--color-warning` | `#fbbf24` | Warning/active turn |
| `--color-danger` | `#f87171` | Danger/low HP |
| `--color-danger-dim` | `#b91c1c` | Danger hover state |
| `--color-calm` | `#60a5fa` | Mood zone: calm |
| `--color-tense` | `#f59e0b` | Mood zone: tense |
| `--color-dramatic` | `#ef4444` | Mood zone: dramatic |

#### Spacing
| Token | Value |
|-------|-------|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |

#### Typography
| Token | Value |
|-------|-------|
| `--font-base` | `'Inter', system-ui, -apple-system, sans-serif` |
| `--text-xs` | `11px` |
| `--text-sm` | `13px` |
| `--text-base` | `15px` |
| `--text-lg` | `17px` |
| `--text-xl` | `20px` |
| `--text-2xl` | `24px` |

#### Radius, Shadows, Transitions
| Token | Value |
|-------|-------|
| `--radius-sm` | `4px` |
| `--radius-md` | `8px` |
| `--radius-lg` | `12px` |
| `--radius-xl` | `16px` |
| `--radius-full` | `9999px` |
| `--tap-target` | `44px` |
| `--transition-fast` | `0.1s ease` |
| `--transition-base` | `0.15s ease` |
| `--transition-slow` | `0.25s ease` |
| `--shadow-sm` | `0 1px 3px rgba(0, 0, 0, 0.5)` |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.6)` |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.7)` |

### 2.2 New Tokens Required

These fill gaps where hardcoded values are currently used:

```css
/* White text (for accent backgrounds) */
--color-text-white: #ffffff;

/* Warning opacity variants (scene triggers, combat overlay, CodeMirror) */
--color-warning-glow: rgba(251, 191, 36, 0.2);
--color-warning-subtle: rgba(251, 191, 36, 0.12);
--color-warning-faint: rgba(251, 191, 36, 0.08);

/* Accent opacity variant */
--color-accent-subtle: rgba(108, 99, 255, 0.08);

/* Danger opacity variant */
--color-danger-glow: rgba(248, 113, 113, 0.1);

/* Background overlays */
--color-bg-overlay: rgba(10, 10, 10, 0.9);
--color-bg-overlay-light: rgba(10, 10, 10, 0.75);

/* White alpha variants (combat overlay — AV Display) */
--color-white-alpha-08: rgba(255, 255, 255, 0.08);
--color-white-alpha-40: rgba(255, 255, 255, 0.4);
--color-white-alpha-50: rgba(255, 255, 255, 0.5);
--color-white-alpha-85: rgba(255, 255, 255, 0.85);
--color-white-alpha-90: rgba(255, 255, 255, 0.9);

/* Monospace font stack */
--font-mono: 'Menlo', 'Consolas', monospace;
```

---

## 3. Hardcoded Color Fixes

### 3.1 CSS — `src/ui/index.css`

| Line | Current | Replace With |
|------|---------|-------------|
| 234 | `.mode-toggle__btn.active { color: #fff; }` | `var(--color-text-white)` |
| 293 | `.btn-next-turn { color: #fff; }` | `var(--color-text-white)` |
| 616 | `.btn-primary { color: #fff; }` | `var(--color-text-white)` |
| 636 | `.btn-danger { color: #fff; }` | `var(--color-text-white)` |
| 1760 | `.launch-enter-btn { color: #fff; }` | `var(--color-text-white)` |
| 669 | `.scene-trigger-btn { background: rgba(251, 191, 36, 0.12); }` | `var(--color-warning-subtle)` |
| 683 | `.scene-trigger-btn:hover { background: rgba(251, 191, 36, 0.22); }` | `var(--color-warning-glow)` |
| 688 | `.scene-trigger-btn:active { background: rgba(251, 191, 36, 0.32); }` | Keep — unique active opacity, or add `--color-warning-active: rgba(251, 191, 36, 0.32)` |
| 1187 | `.scene-advancer { background: rgba(108, 99, 255, 0.08); }` | `var(--color-accent-subtle)` |
| 1240 | `.scene-transition-toast__content { background: rgba(10, 10, 10, 0.9); }` | `var(--color-bg-overlay)` |
| 1428 | `.npc-action-error { background: rgba(248, 113, 113, 0.1); }` | `var(--color-danger-glow)` |
| 1460 | `.combat-overlay__title { color: rgba(255, 255, 255, 0.5); }` | `var(--color-white-alpha-50)` |
| 1471 | `.combat-overlay__row { background: rgba(10, 10, 10, 0.75); }` | `var(--color-bg-overlay-light)` |
| 1472 | `.combat-overlay__row { border: ... rgba(255, 255, 255, 0.08); }` | `var(--color-white-alpha-08)` |
| 1478 | `.combat-overlay__row.active-turn { border-color: rgba(251, 191, 36, 0.7); }` | Keep — unique opacity, or add token |
| 1479 | `.combat-overlay__row.active-turn { background: rgba(251, 191, 36, 0.12); }` | `var(--color-warning-subtle)` |
| 1480 | `.combat-overlay__row.active-turn { box-shadow: ... rgba(251, 191, 36, 0.2); }` | `var(--color-warning-glow)` |
| 1487 | `.combat-overlay__avatar { background: rgba(255, 255, 255, 0.08); }` | `var(--color-white-alpha-08)` |
| 1493 | `.combat-overlay__avatar { color: rgba(255, 255, 255, 0.9); }` | `var(--color-white-alpha-90)` |
| 1498 | `.combat-overlay__row.active-turn .avatar { background: rgba(251, 191, 36, 0.25); }` | Keep — unique opacity |
| 1506 | `.combat-overlay__name { color: rgba(255, 255, 255, 0.85); }` | `var(--color-white-alpha-85)` |
| 1519 | `.combat-overlay__init { color: rgba(255, 255, 255, 0.4); }` | `var(--color-white-alpha-40)` |
| 2064 | `.cm-trigger-highlight { background: rgba(251, 191, 36, 0.15); }` | `var(--color-warning-subtle)` (close enough at 0.12 vs 0.15, or add specific token) |
| 1855-1867 | `.perf-overlay` uses `rgba(0,0,0,0.8)`, `#888`, `monospace`, `10px`, `4px` | Use tokens: `--color-bg-overlay`, `--color-text-3`, `--font-mono`, `--text-xs` (closest), `--radius-sm` |

### 3.2 TSX Files

| File | Line | Current | Replace With |
|------|------|---------|-------------|
| `DashboardTab.tsx` | ~488 | `color: mode === m ? '#fff' : 'var(--color-text-3)'` | `'var(--color-text-white)'` |
| `CombatTab.tsx` | ~168 | `color: '#fff'` | `'var(--color-text-white)'` |
| `AVTab.tsx` | ~161 | `tint: '#ffffff'` | Acceptable — this is a shader uniform reset value, not a style. Document as exception. |

### 3.3 PixiJS Files

| File | Line | Current | Action |
|------|------|---------|--------|
| `ping-tool.ts` | 11 | `const PING_COLOR = 0x6c63ff` | Import from `shared/color-constants.ts` |
| `fog-of-war.ts` | 34, 66, 79 | `0x000000` | Import BLACK from shared. Low priority — standard rendering value. |
| `layer-stack.ts` | 50 | `backgroundColor: 0x000000` | Import BLACK from shared. Low priority. |
| `particle-system.ts` | 92 | `g.fill(0xffffff)` | Import WHITE from shared. Low priority — placeholder texture. |
| `color-grade-filter.ts` | 56, 89 | `tint: '#ffffff'` | Exception — shader uniform defaults. Document. |

---

## 4. Form Input Unification

### Problem
`campaign-selector.tsx` and `NPCsTab.tsx` both define identical `inputStyle` objects:
```typescript
const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface-3)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text)',
  padding: '8px var(--space-3)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-base)',
  width: '100%',
}
```

### Solution
Add shared CSS classes to `index.css`:

```css
/* ─── Form Inputs (shared) ───────────────────────────────────────────────── */

.form-input {
  background: var(--color-surface-3);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  padding: 8px var(--space-3);
  font-size: var(--text-sm);
  font-family: var(--font-base);
  width: 100%;
  transition: border-color var(--transition-base);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.form-input::placeholder {
  color: var(--color-text-3);
}

.form-input--textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}

.form-select {
  background: var(--color-surface-3);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  padding: 8px var(--space-3);
  font-size: var(--text-sm);
  font-family: var(--font-base);
  width: 100%;
  transition: border-color var(--transition-base);
}

.form-select:focus {
  outline: none;
  border-color: var(--color-accent);
}
```

**Migration:** Replace `style={inputStyle}` with `className="form-input"` in:
- `campaign-selector.tsx` (all input/textarea elements using `inputStyle`)
- `NPCsTab.tsx` (all input/textarea elements using `inputStyle`)
- `scene-card.tsx` (already has `.scene-card__input` — can extend or alias)

---

## 5. Inline Style Extraction Strategy

### Priority Order

Inline style extraction is **Phase 3 work** — not part of the initial token fix. This section documents what to extract during a future UI polish sprint.

### 5.1 DashboardTab.tsx (46 inline styles — highest priority)

**Extractable patterns:**
| Pattern | Count | Proposed Class |
|---------|-------|---------------|
| Flex column with gap | 8 | `.stack` (with `--stack-gap` custom prop) |
| Flex row with gap | 6 | `.row` (with `--row-gap` custom prop) |
| Section margin-top | 4 | `.mt-3`, `.mt-4` or use existing `.section-label` margins |
| Button presets (particle/SFX mode buttons) | 12 | `.preset-btn`, `.preset-btn--active` |
| inputStyle objects | 5 | `.form-input` (from Section 4) |
| Small control buttons | 4 | `.btn--sm` |

### 5.2 SpellsTab.tsx (40 inline styles)

**Extractable patterns:**
| Pattern | Count | Proposed Class |
|---------|-------|---------------|
| Spell result card | 6 | `.spell-result-card` |
| Stat cell (AC, level, etc.) | 8 | `.stat-cell`, `.stat-cell__label`, `.stat-cell__value` |
| Search input | 2 | `.form-input` (from Section 4) |
| Detail section | 4 | `.detail-section`, `.detail-section__label` |

### 5.3 NPCsTab.tsx (30 inline styles)

**Extractable patterns:**
| Pattern | Count | Proposed Class |
|---------|-------|---------------|
| NPC form inputs | 8 | `.form-input` (from Section 4) |
| Stat input row | 6 | `.stat-input-row` |
| Form layout (flex column) | 4 | `.stack` |
| Action buttons | 3 | `.btn--sm` |

### 5.4 CombatTab.tsx (29 inline styles)

**Extractable patterns:**
| Pattern | Count | Proposed Class |
|---------|-------|---------------|
| Add combatant form | 8 | `.form-input` + `.stack` |
| Quick damage buttons | 5 | Already have `.hp-btn` — extend |
| Status indicators | 4 | Token-ize colors |

### 5.5 Remaining Components (lower priority)

| Component | Count | Notes |
|-----------|-------|-------|
| campaign-selector.tsx | 13 | Mostly form inputs → `.form-input` |
| note-editor.tsx | 13 | Layout + form inputs |
| AVTab.tsx | 11 | Sliders + layout |
| import-panel.tsx | 11 | Form inputs + progress |
| ScenesTab.tsx | 10 | Mostly covered by scene-card classes |
| notes-list.tsx | 8 | Mostly covered by note-list classes |

---

## 6. Shared PixiJS Color Constants

### New File: `shared/color-constants.ts`

```typescript
/**
 * Shared color constants for PixiJS rendering.
 * These must stay aligned with the CSS custom properties in src/ui/index.css.
 * When updating a color here, update the corresponding CSS token too.
 */
export const COLORS = {
  /** Matches --color-accent (#6c63ff) */
  ACCENT: 0x6c63ff,
  /** Standard black for canvas backgrounds, fog fill */
  BLACK: 0x000000,
  /** Standard white for placeholder textures */
  WHITE: 0xffffff,
} as const;
```

### Migration
- `ping-tool.ts` line 11: `const PING_COLOR = 0x6c63ff` → `import { COLORS } from '@shared/color-constants'` + `const PING_COLOR = COLORS.ACCENT`
- Other PixiJS files (fog-of-war, layer-stack, particle-system): Low priority. The `0x000000` and `0xffffff` values are standard rendering primitives. Migrate when touching those files for other reasons.

---

## 7. `!important` Fix

### Problem
`.notes-tab` has `padding: 0 !important;` (line 1921) because `.tab-panel` applies `padding: var(--space-4)` and the notes tab needs zero padding for its split-pane layout.

### Solution
Increase specificity without `!important`:
```css
.tab-panel.notes-tab {
    padding: 0;
}
```
Or use the existing `.notes-tab` selector if it already has higher specificity than `.tab-panel`. Check if `.notes-tab` is applied to the same element as `.tab-panel` — if so, the compound selector `.tab-panel.notes-tab` wins.

---

## 8. CSS Class Naming Conventions

### Rules Going Forward

1. **BEM-like naming:** `.component__element--modifier`
   - Component: `.scene-card`
   - Element: `.scene-card__header`
   - Modifier: `.scene-card--active`, `.scene-card--expanded`

2. **State classes:** Use `.active`, `.disabled`, `.open`, `.collapsed` directly on the element (not BEM modifier) for JS-toggled states.

3. **Section labels:** Always use `.section-label` class for uppercase category headers.

4. **Buttons:** Extend `.btn` base class with `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-secondary`, `.btn--sm`.

5. **Form inputs:** Always use `.form-input` or `.form-select` for form elements.

6. **No inline styles** unless the value is truly dynamic (computed at runtime from JS state, not a design token). Layout with `style={{ flex: 1 }}` is acceptable only when CSS cannot express it.

7. **No hardcoded colors, spacing, or typography values** anywhere — always reference tokens.

---

## 9. Post-Sprint UI Gate Checklist

After every sprint, before moving to the next:

- [ ] **No new hardcoded colors:** `grep -rn "color:.*#" src/ui/` should only match CSS custom property definitions
- [ ] **No new `rgba()` outside `:root`:** All opacity variants are defined as tokens
- [ ] **No new `!important`:** All specificity issues resolved structurally
- [ ] **Form inputs use `.form-input` / `.form-select`:** No new `inputStyle` objects
- [ ] **New components use existing tokens:** Check all `style={}` props use `var(--token)` values
- [ ] **Inline styles justified:** Any new inline styles are for truly dynamic values only
- [ ] **Tests pass:** `npm test` — no regressions

---

## 10. Implementation Phases

### Phase 1: Documentation + Token Foundation (THIS PHASE)
- [x] Create this spec document
- [ ] Add CSS conventions to CLAUDE.md
- [ ] Add design system reference to Project.md
- [ ] Add 14+ new tokens to `:root` in `index.css`
- [ ] Replace all hardcoded colors in `index.css`
- [ ] Replace hardcoded colors in 2 TSX files
- [ ] Fix perf overlay to use tokens
- [ ] Fix `!important` on `.notes-tab`
- [ ] Create `shared/color-constants.ts`
- [ ] Update `ping-tool.ts` to use shared constants
- [ ] Add shared `.form-input` / `.form-select` classes

### Phase 2: Form Input Migration (next sprint or polish pass)
- [ ] Replace `inputStyle` in `campaign-selector.tsx` with `.form-input`
- [ ] Replace `inputStyle` in `NPCsTab.tsx` with `.form-input`
- [ ] Audit all `<input>` and `<select>` elements for consistent class usage

### Phase 3: Inline Style Extraction (dedicated UI polish sprint)
- [ ] DashboardTab.tsx — extract 46 inline styles to CSS classes
- [ ] SpellsTab.tsx — extract 40 inline styles to CSS classes
- [ ] NPCsTab.tsx — extract 30 inline styles to CSS classes
- [ ] CombatTab.tsx — extract 29 inline styles to CSS classes
- [ ] Remaining components (campaign-selector, note-editor, AVTab, import-panel)

### Phase 4: Layout Utilities (optional polish)
- [ ] Add `.stack` / `.row` layout utility classes
- [ ] Add `.pill-badge` shared class
- [ ] Final sweep of all components

---

**End of Document**
