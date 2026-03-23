# Pre-Beta (v0.6) Release Polish Plan

**Goal:** Refine the existing app for its first external distribution to testers. Cleanup, consistency, first-impression polish, and baseline audio playback. Feature work beyond this scope deferred to future betas.

**Current State:** 753 tests, 44 test files, Sprints 0–16c complete. All core tabs functional. Audio engine plumbed but running on oscillator placeholders — no audible output for testers yet.

**Progress (as of 2026-03-11):** Sprints 17a, 17b, and 17d complete. Sprint 17c (audio) deferred until OGG audio files are sourced — will be built as a single batch. Sprint 17e (demo tokens + packaging) follows 17c.

---

## Sprint 17a — Cleanup + Launch Screen Polish

### Phase: Single phase (no sub-sprints needed — <10 files, 2 subsystems)

### Tasks

#### A1: Delete Orphaned AV Files
**Size:** XS | **Files:** 3

Delete these unused files from the old AV tab 3x2 grid layout (replaced in Sprint 14):
- `src/ui/tabs/av/global-settings-zone.tsx`
- `src/ui/tabs/av/gb-preview-zone.tsx`
- `src/ui/tabs/av/bg-preview-zone.tsx`

**Verify:** Grep for imports of these files to confirm they're truly dead. Run `npm test` after deletion.

---

#### A2: Migrate `inputStyle` in campaign-selector.tsx
**Size:** XS | **Files:** 1

`src/ui/components/campaign-selector.tsx` has an inline `inputStyle` object (lines 47–52) applied to input + select elements. Replace with `.form-input` / `.form-select` CSS classes.

**Before:**
```tsx
const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface-3)',
  border: '1px solid var(--color-border-2)',
  ...
};
<input style={inputStyle} />
```

**After:**
```tsx
<input className="form-input" />
```

---

#### A3: Inline Style Audit — Classify and Triage
**Size:** S-M | **Files:** ~15

59 `style={{` occurrences across cockpit UI. Not all need migration — classify each:

| Category | Action |
|----------|--------|
| **Layout-only** (`display`, `flex`, `gap`, `gridTemplate`) | Migrate to CSS class |
| **Dynamic/computed** (`width: percentage`, `color: statusColor`) | Keep as inline (correct usage) |
| **Token-backed** (`background: var(--token)`) | Migrate to CSS class |
| **One-off positioning** (`position: absolute`, `top: X`) | Keep if truly unique |

**Priority files** (most occurrences):
1. `campaign-selector.tsx` — 11 (handled in A2 + remaining)
2. `import-panel.tsx` — 9
3. `NPCsTab.tsx` — 6
4. `CombatTab.tsx` — 6
5. `note-editor.tsx` — 5
6. `SpellsTab.tsx` — 5

**Non-priority** (1–3 occurrences, likely dynamic): `App.tsx`, `player-card.tsx`, `NotesTab.tsx`, `DevTestPanel.tsx`, `lobby-panel.tsx`, `document-import-modal.tsx`, `markdown-editor.tsx`, `notes-list.tsx`, `note-linker.tsx`, `quick-spells.tsx`, `quick-dice.tsx`, `quick-combat.tsx`, `launch-screen.tsx`

**Rule:** Don't force-migrate dynamic styles. Only migrate styles that should be CSS classes.

---

#### A4: Cinematic Intro — Add Skip Preference
**Size:** S | **Files:** 2

Currently the typewriter intro plays every app launch. Add a localStorage preference:

1. In `cinematic-intro.tsx`: Check `localStorage.getItem('skipIntro')` — if `'true'`, call `onComplete()` immediately
2. In `launch-screen.tsx`: Add a small toggle/checkbox: "Skip intro on startup" that sets `localStorage.setItem('skipIntro', 'true'|'false')`

**Design:** Subtle — small text link or checkbox in the bottom corner of the launch screen. Not prominent.

---

#### A5: Improve Empty Campaign State
**Size:** S | **Files:** 1

When no campaigns exist, the launch screen shows plain text: "No campaigns yet. Create one below."

Improve to:
- Slightly larger, friendlier messaging
- Emphasize the "New Campaign" button (maybe auto-expand the form)
- Brief one-liner explaining what a campaign is for first-time users

**Keep it minimal** — no illustrations, no onboarding wizard. Just better copy and visual hierarchy.

---

#### A6: Add Error Boundary
**Size:** S | **Files:** 2 (new component + App.tsx)

No error boundary exists. If a tab throws during render, the entire app crashes.

1. Create `src/ui/components/error-boundary.tsx` — class component (React requirement), shows a "Something went wrong" message with a "Reload Tab" button
2. Wrap the cockpit tab content area in `App.tsx` with the error boundary
3. Don't wrap launch screen or cinematic intro (those should hard-fail if broken)

**Keep it simple:** No error reporting service, no stack traces shown to user. Just a graceful fallback.

---

#### A7: Review Error Messages
**Size:** XS | **Files:** scan all

Audit user-facing error strings for:
- Technical jargon (replace with plain language)
- Missing context (what failed, what to try)
- Consistency (same tone across all error states)

Known error surfaces:
- Launch screen: campaign fetch error, connection timeout, campaign creation error
- Campaign selector: fetch/create errors
- Media tab: upload errors
- Socket disconnection states

---

#### A8: Branding TODO Acknowledgment
**Size:** XS | **Files:** 0

The single TODO in the codebase (`launch-screen.tsx:557`) marks temp branding. This is a known placeholder — document it as a pre-beta known item, not a blocker. Logo + app name will be finalized separately from code polish.

---

### Sprint 17a Checklist — ✅ COMPLETE

```
[x] A1: Delete 3 orphaned AV files, verify no imports, tests pass
[x] A2: Migrate inputStyle → .form-input/.form-select in campaign-selector
[x] A3: Audit 59 inline styles, migrate layout/token styles to CSS classes (59 → 11, all remaining are dynamic/legitimate)
[x] A4: Add skip-intro localStorage preference
[x] A5: Polish empty campaign state messaging
[x] A6: Add error boundary around cockpit tab content
[x] A7: Audit error messages for plain language
[x] A8: Document branding placeholder as known item
[x] Run full test suite — all 753+ tests pass
[x] Invoke simplify skill on changed files
[x] Invoke reviewer agent on Sprint 17a
```

### Estimated Scope
- **Files modified:** ~12–18
- **New files:** 1 (error-boundary.tsx)
- **Deleted files:** 3
- **Risk:** Low — no architectural changes, no new dependencies

---

## Sprint 17b — Per-Tab Polish Pass

### Phase: Single phase — CSS/UI changes only, no schema changes

**Scope decision:** Item states (Hidden/Loot/Acquired) requires a DB migration (`scene_items.status` column) and is deferred to a future beta. Scene "Ready" indicator requires defining what "ready" means (media? NPCs? notes?) — deferred. Spell search history and pinned spells are small features, not polish — deferred. This sprint is **visual polish only**.

### Tasks

#### B1: Combat Active-Turn Pulse
**Size:** XS | **Files:** 1 (CSS)

Active combatant has `.active-turn` class (border + background only). Add a subtle pulse animation matching the `.scene-pulse` pattern already in the codebase.

#### B2: AV Tab Sticky Column Headers
**Size:** S | **Files:** 1 (CSS)

Column headers (Game Board / Background) scroll away. Add `position: sticky; top: 0` with a background so content scrolls beneath them.

#### B3: AV Tab Column Separator
**Size:** XS | **Files:** 1 (CSS)

No visual divider between the two AV columns. Add a `border-right` on the left column.

#### B4: Players Tab — Copy Session Code Button
**Size:** S | **Files:** 1

Session code in PlayersTab header has no copy button. The LaunchScreen already has a `SessionCodeDisplay` component with copy-to-clipboard — reuse it or add a simple copy button inline.

#### B5: Empty States — Add Icons
**Size:** S | **Files:** 3-4 (CSS)

Replace plain text empty states with subtle icon + text in:
- MediaTab (currently emoji 📚 — replace with CSS icon or remove emoji)
- PlayersTab ("No players connected yet" — add hint about session code)
- NPCsTab (already using `.tab-placeholder` — improve copy)

Keep it minimal — no illustrations, just better copy and visual hierarchy.

#### B6: Notes Strip — Column Divider + Section Emphasis
**Size:** XS | **Files:** 1 (CSS)

Add a vertical border between Scene Notes and Scratchpad columns. Strengthen section headers (slightly larger, accent underline or color).

#### B7: Scene Timeline — Tooltip on Truncated Names
**Size:** XS | **Files:** 1

Scene names truncate with ellipsis but have no `title` attribute. Add `title={scene.name}` to the node label.

#### B8: Combat HP Buttons — Responsive Wrap
**Size:** S | **Files:** 1 (CSS)

6 HP buttons in a row wrap awkwardly on narrow screens. Add flex-wrap with consistent gap so they degrade gracefully to 2 rows.

#### B9: Filter Pill Active State (SpellsTab)
**Size:** XS | **Files:** 1 (CSS)

Active filter pill needs stronger visual differentiation — accent background + text color, not just subtle background shift.

#### B10: Media Tab — Remove Emoji Empty State
**Size:** XS | **Files:** 1

Replace the 📚 emoji (3rem, 40% opacity) with a plain text empty state matching the `.tab-placeholder` pattern used everywhere else.

### Sprint 17b Checklist — ✅ COMPLETE

```
[x] B1: Combat active-turn pulse animation
[x] B2: AV tab sticky column headers
[~] B3: AV tab column separator — columns have individual borders but no explicit divider between them (minor gap)
[x] B4: Players tab copy session code
[x] B5: Empty state improvements (Media, Players, NPCs) — emoji-based icons with actionable copy
[x] B6: Notes strip column divider + section emphasis
[x] B7: Scene timeline tooltip on truncated names
[x] B8: Combat HP buttons responsive wrap
[x] B9: Spells filter pill active state
[x] B10: Media tab remove emoji empty state — switched from 📚 to 🎬 (semantically better)
[x] Run full test suite
[x] Invoke simplify skill on changed files
```

### Estimated Scope
- **Files modified:** ~10-12
- **New files:** 0
- **Risk:** Very low — CSS-only changes + minor JSX tweaks

### Deferred from Original 17b Scope
- Item states (Hidden/Loot/Acquired) — needs DB migration, deferred to future beta
- Scene "Ready" indicator — needs definition of "ready", deferred
- Spell search history — feature, not polish
- Pinned spells — feature, not polish

---

## Sprint 17c — Ambient Audio Engine (Beta Audio) — ⏳ BLOCKED (waiting on audio files)

**Why:** Audio is a core pillar of the "theatrical atmosphere engine" pitch. Testers need to *hear* something. The full procedural stem system is too complex for pre-beta, but the plumbing is 90% done — Tone.js pipeline, socket wiring, mood store, and AV Display handler all exist. Currently running on inaudible oscillator placeholders.

### Design: Two-Axis Ambient System

The DM controls audio on two axes:

**Axis 1 — Environment** (where are we?): Forest, Cave, Tavern, Night, Ocean
Each environment has 3 pre-mixed OGG stems that share key/BPM.

**Axis 2 — Mood** (what's the energy?): Calm → Tense → Dramatic
Three buttons. MoodEngine crossfades between stems on the downbeat.

Example: DM selects "Cave" → calm drips + pads playing. Combat starts → DM clicks "Dramatic" → crossfade to war drums + aggressive texture, still in the cave sound palette.

### What Already Works (No Changes Needed)
- `MoodEngine` class with Tone.js Transport, BPM timing, measure-boundary crossfades
- `useMoodStore` (value 0–1) synced via `MOOD_UPDATE` socket event
- AV Display lazy-inits MoodEngine on first mood event, applies on scene load
- Environment presets in dashboard set `audioMood` on scenes
- `SFXSoundboard` class with spatial PannerNode routing (fully functional)
- `SFXPanel` in dashboard with spatial sliders + trigger/stop UI
- 447 lines of test coverage across both systems

### Audio File Requirements

**Format:** OGG Vorbis (.ogg) — gapless looping, good compression, native Chromium decode.

**Stem Specifications:**
- **Length:** 2–4 minutes (seamless loop via `Tone.Player({ loop: true })`)
- **Looping:** Must loop cleanly — no silence at head/tail, consistent amplitude at loop boundary
- **BPM:** All 3 zones within an environment MUST share the same BPM (crossfades are musical)
- **Key:** All 3 zones within an environment SHOULD be in related keys (same key ideal, relative minor/major acceptable)
- **Mix:** Each stem is a full pre-mixed track (not separated instruments)

**Per-Environment Stem Set (3 files each):**

| Zone | Character | Example Content |
|---|---|---|
| **Calm** | Ambient, atmospheric, no percussion | Pads, drones, subtle texture, nature sounds |
| **Tense** | Building energy, light rhythm | Pads + soft rhythmic element, subtle percussion, uneasy texture |
| **Dramatic** | Full intensity, driving | War drums, aggressive synths, urgent rhythm, full arrangement |

**Required Environments (5 for v0.6):**

```
src/systems/audio/stems/
├── forest/
│   ├── forest-calm.ogg        # ~2-4 min, birds + gentle pads
│   ├── forest-tense.ogg       # ~2-4 min, darker texture + light pulse
│   └── forest-dramatic.ogg    # ~2-4 min, drums + urgent strings/synths
├── cave/
│   ├── cave-calm.ogg          # drips + low drone
│   ├── cave-tense.ogg         # echoing pulse + rumble
│   └── cave-dramatic.ogg      # pounding drums + aggressive reverb
├── tavern/
│   ├── tavern-calm.ogg        # warm fireplace + gentle lute-like pads
│   ├── tavern-tense.ogg       # darker tone + rhythmic tension
│   └── tavern-dramatic.ogg    # bar-fight energy + driving beat
├── night/
│   ├── night-calm.ogg         # crickets + soft ambient wash
│   ├── night-tense.ogg        # wind + unsettling pulse
│   └── night-dramatic.ogg     # storm + full battle percussion
└── ocean/
    ├── ocean-calm.ogg         # waves + serene pads
    ├── ocean-tense.ogg        # building swells + dark undertow
    └── ocean-dramatic.ogg     # crashing waves + epic drums
```

**Total: 15 OGG files. Estimated size: ~2-4MB each = ~30-60MB total.**

**Per-Environment Config (bundled in code):**

```typescript
interface EnvironmentAudioConfig {
    id: string              // 'forest' | 'cave' | 'tavern' | 'night' | 'ocean'
    label: string           // 'Forest'
    bpm: number             // e.g. 80 — transport tempo for this environment
    stems: {
        calm: string        // relative path: '/audio/stems/forest/forest-calm.ogg'
        tense: string
        dramatic: string
    }
}
```

**SFX Files (served alongside stems):**

```
src/systems/audio/sfx/
├── thunder.ogg             # ~2-4 sec one-shot
├── door-creak.ogg          # ~1-2 sec one-shot
├── sword-clash.ogg         # ~1-2 sec one-shot
├── magic-burst.ogg         # ~2-3 sec one-shot
├── footsteps.ogg           # ~3-5 sec loop
└── campfire.ogg            # ~5-10 sec loop
```

**Total SFX: 6 OGG files, ~1-5MB total.**

### What Needs to Be Built

#### C1: Environment + Mood Button UI
**Size:** S-M | **Files:** 1–2 new components

Add an **Atmosphere Control** card to the Dashboard (alongside existing EnvironmentPanel/SFXPanel):
- **Environment row:** 5 buttons (Forest, Cave, Tavern, Night, Ocean) — selecting one loads that environment's 3 stems
- **Mood row:** 3 buttons (Calm, Tense, Dramatic) — clicking one sets `useMoodStore` value (0.15 / 0.5 / 0.85)
- Active environment + mood highlighted
- No slider — buttons only for fast mid-session control

#### C2: Replace Oscillators with Tone.Player
**Size:** M | **Files:** 1 (mood-engine.ts) + 1 new (audio-config.ts)

- Swap oscillator creation in `init()` to create `Tone.Player` instances with `loop: true`
- Add `loadEnvironment(config)` method: loads 3 OGG stems, sets transport BPM, wires to crossfade nodes
- Keep existing CrossFade + measure-boundary scheduling (already correct)
- Fallback: if audio files are missing, log a warning and stay silent (don't crash)
- Add environment audio config registry (maps environment ID → stem paths + BPM)

#### C3: Bundle Audio Files
**Size:** S | **Files:** 15 stems + 6 SFX + config

User-sourced OGG files placed in `src/systems/audio/stems/` and `src/systems/audio/sfx/`.
Served via Express static route (e.g., `GET /audio/stems/forest/forest-calm.ogg`).

#### C4: Wire SFX Panel to Real Files
**Size:** S | **Files:** 1–2

Update existing `SFXPanel` dev clips to point at real bundled OGG files instead of empty `filePath: ''`. The SFXSoundboard + UI already work — just needs real audio paths.

#### C5: Volume Controls
**Size:** S | **Files:** 1–2

Add volume sliders to the atmosphere control card:
- **Ambience volume** — wires to `MoodEngine.setMasterVolume()`
- **SFX volume** — wires to SFXSoundboard gain node
Wire to existing volume nodes (already built in both engines).

### Sprint 17c Checklist

```
[ ] C1: Atmosphere control card — environment buttons + mood buttons
[ ] C2: Replace oscillators with Tone.Player + loadEnvironment()
[ ] C3: Bundle 15 environment stems + 6 SFX clips (user-sourced OGG)
[ ] C4: Wire SFXPanel dev clips to real audio file paths
[ ] C5: Volume sliders for ambience + SFX
[ ] Add Express static route for /audio/ directory
[ ] Verify crossfade between zones works with real OGG stems
[ ] Verify environment switching loads new stem set cleanly
[ ] Verify SFX spatial positioning works end-to-end
[ ] Run full test suite — update mood-engine tests for Tone.Player
[ ] Invoke simplify skill on changed files
[ ] Invoke reviewer agent on Sprint 17c
```

### What This Does NOT Include (Deferred)
- Separated instrument layers (drums vs melody vs pads) — each stem is a full mix
- Audio asset management UI (upload/tag/organize custom stems)
- Mood engine ↔ particle system auto-linking
- Per-scene audio persistence beyond `audioMood` field
- BPM/key auto-analysis of imported audio files
- Custom crossfade timing or advanced mixing controls
- User-uploadable custom environments

### Estimated Scope
- **Files modified:** ~5–8
- **New files:** 2–3 (UI components + audio config) + 21 (audio assets)
- **Risk:** Medium — Tone.js lazy-init and user-gesture requirements need careful testing in Electron
- **Blocked on:** User sourcing 21 OGG audio files (15 stems + 6 SFX)

---

## Sprint 17d — Companion Polish + Cross-Cutting Quality — ✅ COMPLETE

User satisfied with current companion app state. No further polish needed for v0.6.

---

## Sprint 17e — Demo Token System + Packaging — 🔜 NEXT (after 17c)

*(Detailed breakdown to be written when 17c is complete)*

**Preview:**
- Extend `src/core/auth/auth.ts` with demo tier + days-remaining helper
- Demo token generation script
- Launch screen gate for lapsed licenses
- "Demo — X days remaining" badge in cockpit
- Electron Builder packaging + installer
- Distribution test on clean Windows machine

---

## Features Deferred to Future Betas

| Feature | Why Deferred |
|---------|-------------|
| Per-scene fog save/restore | Medium complexity, DB ready but cockpit needs rework |
| Scene preview / program-preview | New interaction pattern, not blocking |
| Notes Phase 2 (graph, kanban, split pane) | Large feature set, current notes are functional |
| Full procedural stem system | Requires audio asset pipeline, per-scene configs, layered mixing |
| Scene transitions (cut/fade/crossfade) | Nice-to-have, not blocking |
| Player Companion v2 | Character creator, system configs, persistence |
| UI micro-interactions | Polish layer, not functional |
| Full-text search (Ctrl+K) | Requires search index |
| Mood ↔ particle linking | Ambient audio tied to particle type — needs stem library first |

---

## Sprint Roadmap Summary

| Sprint | Focus | Status |
|--------|-------|--------|
| **17a** | Cleanup + Launch Screen Polish | ✅ Complete |
| **17b** | Per-Tab Polish Pass | ✅ Complete |
| **17c** | Ambient Audio Engine | ⏳ Blocked — waiting on OGG audio files |
| **17d** | Companion Polish + Cross-Cutting | ✅ Complete |
| **17e** | Demo Token System + Packaging | 🔜 After 17c |

**Target:** v0.6 pre-beta — functional enough for testers to run sessions with audio, visuals, and player companions.

---

## Audit Results (Sprint 17 Planning)

| Category | Finding | Status |
|----------|---------|--------|
| `!important` in CSS | 0 in source | CLEAN |
| `console.log` in production code | 0 (only in stubs/dev panel) | CLEAN |
| TODO/FIXME comments | 1 (branding placeholder — known) | ACKNOWLEDGED |
| Orphaned files | 3 AV tab files | ✅ DELETED in A1 |
| `inputStyle` objects | 1 (campaign-selector) | ✅ MIGRATED in A2 |
| Inline `style={{}}` | 59 → 11 (all remaining are dynamic) | ✅ TRIAGED in A3 |
| Error boundaries | 0 → 1 (error-boundary.tsx) | ✅ ADDED in A6 |
| Skip intro preference | Not implemented → localStorage toggle | ✅ ADDED in A4 |
