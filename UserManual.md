# TTRPG Stage Manager — User Manual

## Table of Contents

1. [Campaign Document Import](#campaign-document-import)

---

## Campaign Document Import

The import system reads a campaign document (markdown or plain text) and extracts structured entities — scenes, NPCs, items, locations, factions, and lore — for use in the Stage Manager. This section documents the syntax the parser recognizes and best practices for writing campaign documents that import cleanly.

### Document Structure Overview

A campaign document is organized with **headings** (`##`) that define sections. The parser reads top-down, so **position matters** — entities inside a scene belong to that scene, entities outside any scene are global.

```
## Lore                          ← global lore section
## Factions                      ← global factions
## Scene 1 — The Lost Tomb       ← scene container begins
  **NPC — Elder Voss**           ← NPC, belongs to Scene 1
  **Creature — Stone Golem**     ← combatant, belongs to Scene 1
  ## Items                       ← items, belong to Scene 1
  ## Locations                   ← locations, belong to Scene 1
## Scene 2 — The Forest Edge     ← Scene 1 ends, Scene 2 begins
## Items                         ← global items (outside any scene)
```

**Key rule:** Sections end when the next section of equal or higher level begins. No closing tags needed.

---

### Scenes

Scenes are the primary containers. Everything between one scene heading and the next belongs to that scene.

**Format:**
```
## Scene [number] — [Title]
```

**Accepted separators:** `—` (em-dash), `–` (en-dash), `-` (hyphen), `:` (colon)

**Examples:**
```
## Scene 1 — The Lost Tomb
## Scene 1: The Lost Tomb
## Scene 1 - The Lost Tomb
## **Scene 1 — The Lost Tomb**
```

All four are equivalent. Bold wrapping is tolerated but not required. The scene number determines ordering. The title is the display name.

**Freeform content** below the heading (narrative descriptions, DM notes, read-aloud text) is captured as the scene body. The parser does not require any specific structure inside a scene — just use the entity headings below to mark NPCs, items, locations, etc.

---

### NPCs & Combatants

NPCs are characters, creatures, monsters, and any entity the party interacts with. The keyword used determines the default behavior.

**Format:**
```
**[Keyword] — [Name]**
```

Or as a heading:
```
### [Keyword]: [Name]
```

**Keywords and auto-tagging:**

| Keyword | Auto-Tag | Combatant? |
|---|---|---|
| `NPC` | *(none)* | No |
| `Character` | *(none)* | No |
| `Ally` | `ally` | No |
| `Patron` | `patron` | No |
| `Villain` | `villain` | No |
| `Enemy` | `enemy` | Yes |
| `Creature` | `creature` | Yes |
| `Monster` | `monster` | Yes |
| `Beast` | `beast` | Yes |
| `Boss` | `boss` | Yes |

**Combatants** are auto-added to the combat tracker when their scene is triggered. Non-combatants appear in the scene notes panel. The DM can override this during import or at any time in the app.

**Faction reference:** Add a faction name in parentheses after the NPC name to auto-link:
```
**NPC — Silas Rem** (Iron Compact)
**Enemy — Commander Vaas** (Iron Compact, defected)
```

**NPC body content:** Everything below the NPC tag until the next entity or section heading is captured as the NPC body. Use any structure you like:

```
**NPC — Elder Dara Voss**
Description: A woman of sixty with sharp eyes and a patchwork coat.
Role: Primary quest-giver in Act 1.
Motivation: Keep Rusthollow alive.
Key Trait: She never lies outright — she just chooses which truths to share.
```

Or freeform prose:

```
**NPC — Elder Dara Voss**
A woman of sixty with one eye milky-white from scarring. She runs Rusthollow
with pragmatic wisdom and quiet desperation. She does not trust easily.
```

The parser extracts structured fields (Description, Role, Race, Class, Alignment, Motivation) when present but does not require them.

**Stat blocks:** If an NPC or combatant has stats (HP, AC, ability scores, etc.), the parser flags it as a combatant regardless of keyword. Stats can be formatted however you like — the parser looks for common patterns:

```
**Creature — Ashfield Trackers**
HP: 45
AC: 14
STR: 16  DEX: 12  CON: 14  INT: 6  WIS: 10  CHA: 4
```

---

### Items

Items are listed under an `## Items` heading. If the heading is inside a scene, the items belong to that scene. If the heading is outside any scene, the items are global (available across the campaign).

**Format:**
```
## Items
  [Name] x[Quantity] ([tags]) — [Description]
```

**Components:**
- **Name** — the item name (required)
- **Quantity** — `xN` after the name (optional, default 1)
- **Tags** — parenthetical, comma-separated (optional)
- **Description** — after a `—`, `–`, `-`, or `:` separator (optional if using sub-lines)

**Examples:**
```
## Items
  Flame Tongue (rare, attunement, loot) — A sword that erupts in flame when drawn
  Healing Potion x5 (common, consumable, loot) — Restores 2d4+2 HP
  Anti-Rad Pills x10 (common, consumable, given) — Tastes like chalk
  The Data Chip (quest)
    Description: Black matte composite, pre-Fracture manufacture
    Notes: Required to enter the Cradle
```

**Tag types:**

| Tag Type | Purpose | Examples |
|---|---|---|
| **Rarity** | Item rarity level | `common`, `uncommon`, `rare`, `very-rare`, `legendary`, `artifact` |
| **Properties** | Permanent item traits | `attunement`, `consumable`, `cursed`, `finesse`, `versatile`, `thrown`, `light`, `heavy`, `two-handed` |
| **Scene State** | How the item exists in this scene | `loot`, `hidden`, `given`, `placed`, `quest` |

**Scene states explained:**

| State | Meaning |
|---|---|
| `loot` | Available to be picked up freely |
| `hidden` | Requires discovery (perception check, puzzle, secret door) |
| `given` | Handed to the party by an NPC or event |
| `placed` | Exists in the scene but not necessarily obtainable |
| `quest` | Plot-critical item, tracked separately |

**Multi-scene items:** The same item can appear in multiple scene `## Items` lists with different states. Once the party acquires the item in any scene, it is suppressed in later scenes:

```
## Scene 1 — The Lost Tomb
## Items
  Sword of Fire (rare, attunement, loot) — Sitting on a pedestal, unguarded

## Scene 5 — The Dragon's Hoard
## Items
  Sword of Fire (rare, attunement, hidden) — Buried under gold, DC 18 Perception

## Scene 9 — The Merchant Camp
## Items
  Sword of Fire (rare, attunement, given) — The merchant offers it as payment
```

Three chances to acquire the same sword. Once found, it won't appear again.

**Detailed items with sub-lines:** For complex items, use indented sub-lines instead of (or in addition to) the inline description:

```
## Items
  Flame Tongue (rare, attunement, loot)
    Description: A longsword with a blade that ignites on command
    Damage: 2d6 fire
    Notes: Found in the dragon's hoard, requires attunement by a martial class
  Simple Rations x10 (common, consumable, loot) — Trail food, nothing special
```

---

### Locations

Locations are visual/atmospheric presets within a scene. They change the background and gameboard media but don't carry separate save state. When a scene is active, the DM gets buttons to flip between its locations.

**Format:**
```
## Locations
  [Name] — [Description]
```

`## Locations` must be inside a scene. Each indented line is a location.

**Example:**
```
## Scene 1 — Rusthollow

## Locations
  The Market — Bustling overpass market, traders and crowds
  The East Gate — Settlement entrance, guard posts, dust storms
  The Overpass Hall — Council meeting room, cramped and loud

**NPC — Elder Dara Voss**
...
```

- The first location listed is the default when the scene loads
- Media (background images, gameboard maps) is linked in the app, not in the document
- Multiple scenes can reference locations with the same name — they auto-link

**Optional sub-lines:**
```
## Locations
  The Market — Bustling overpass market
    Mood: Crowded, noisy, smoky
    Time of Day: Late afternoon
  The East Gate — Settlement entrance
    Mood: Tense, dusty, exposed
```

---

### Factions

Factions are campaign-wide organizations. They live **outside any scene** as a top-level section.

**Format:**
```
## Factions
  [Name] — [Description]
```

**Example:**
```
## Factions
  The Iron Compact — Techno-mercantilists controlling pre-Fracture salvage routes
  The Hollow Earth — Survivalists living underground, afraid of the surface
  Covenant of the Restored God — Religious zealots who believe the Fracture was divine
```

**Optional sub-lines:**
```
## Factions
  The Iron Compact — Techno-mercantilists
    Goals: Technological dominance over all Ashlands factions
    Methods: Trade leverage, espionage, military force
    Alignment: Lawful Evil
```

**NPC-faction linking:** NPCs reference factions in their parenthetical tags:
```
**NPC — Silas Rem** (Iron Compact)
```

If an NPC references a faction name not defined in `## Factions`, the parser creates a stub entry automatically.

---

### Lore

Lore entries are campaign-wide world-building notes. They live **outside any scene** as a top-level section.

**Format:**
```
## Lore
  [Name] — [Description]
```

**Synonym headings** — all treated identically:
- `## Lore`
- `## History`
- `## World`
- `## Setting`
- `## Backstory`

**Example:**
```
## Lore
  The Fracture — The catastrophic event of 2041 that ended civilization
    Nuclear warheads, bioweapons, and atmospheric poison deployed within six hours.
    By the next morning, civilization was over. The survivors adapted.
  The Ashlands — The post-apocalyptic American Midwest
    Irradiated zones called Deadfields, mutant predators, dust storms.
    Water is currency. Medicine is religion. Information is power.
  AXIOM — A pre-war AI built by the Meridian Group
    Waiting 200 years to judge whether humanity deserves restoration.
```

---

### Complete Example Document

```markdown
# The Last Signal — A Campaign for the Ashlands

## Lore
  The Fracture — The catastrophic event of 2041 that ended civilization
  The Ashlands — The post-apocalyptic Midwest, year 2247 A.F.
  The Deadfields — Irradiated zones that glow at night
  The Cradle — A pre-Fracture facility with the power to restore the world

## Factions
  The Iron Compact — Techno-mercantilists controlling salvage routes
  The Hollow Earth — Survivalists living underground
  Covenant of the Restored God — Religious zealots

## Scene 1 — Rusthollow

A town of 340 souls built into a collapsed interstate overpass.

## Locations
  The Market — Bustling overpass market under cracked concrete
  The East Gate — Settlement entrance with guard shack
  The Overpass Hall — Council meeting room

**NPC — Elder Dara Voss**
Description: A woman of sixty with sharp eyes and a patchwork coat.
Role: Primary quest-giver and voice of pragmatic wisdom.
Motivation: Keep Rusthollow alive.

**NPC — Silas Rem** (Iron Compact)
Description: Forty, slim, carefully groomed. Synthetic coat, spotless.
Role: Act 1 antagonist representative.

**Creature — Ashfield Trackers**
HP: 45  AC: 14
Description: Three mutant coyotes the size of Great Danes.
Behaviour: Not immediately aggressive. Assessing the party.

## Items
  Rusthollow Market Goods x3 (common, consumable, loot) — Purified water and dried rations
  Dara's Flask (uncommon, placed) — Pre-Fracture steel, engraved 'Camp Pendleton 2038'
  Missing Persons Notice (common, quest) — 40 water-tokens for news of Cael Dorn

## Scene 2 — The Dying Man

A scavenger arrives at the east gate, bleeding and clutching a data chip.

## Locations
  The East Gate Shack — Guard shack at the settlement edge

**NPC — Cael Dorn**
Description: Mid-thirties, aged past his years. Two missing fingers.
Fate: Dies within the hour.

## Items
  The Data Chip (quest, loot) — Black matte composite, plays a looping broadcast
  Cael's Journal (uncommon, loot) — Three weeks of deteriorating handwriting
```

---

### Quick Reference

| Entity | Heading | Scope | Key Syntax |
|---|---|---|---|
| Scene | `## Scene N — Title` | Top-level | Separators: `—` `–` `-` `:` |
| NPC | `**Keyword — Name**` | Inside scene | Keywords: NPC, Character, Ally, Patron, Villain, Enemy, Creature, Monster, Beast, Boss |
| Items | `## Items` | Inside scene (scene items) or top-level (global) | `Name xN (tags) — Description` |
| Locations | `## Locations` | Inside scene | `Name — Description` |
| Factions | `## Factions` | Top-level only | `Name — Description`, NPCs link via `(Faction Name)` |
| Lore | `## Lore` | Top-level only | Synonyms: History, World, Setting, Backstory |

### Tips for Best Results

1. **Use `##` headings for sections.** The parser relies on heading levels to determine boundaries. `## Scene`, `## Items`, `## Locations`, `## Factions`, `## Lore` are the primary markers.
2. **Position matters.** Entities inside a scene belong to that scene. Entities outside any scene are global.
3. **Bold NPC tags are recommended** (`**NPC — Name**`) but the parser also accepts heading format (`### NPC: Name`).
4. **Item tags are comma-separated in parentheses.** Mix rarity, properties, and scene states freely: `(rare, attunement, hidden)`.
5. **Indentation signals sub-content.** Indented lines below an item or location are parsed as detail fields.
6. **Keep scene numbers sequential.** The parser uses them for ordering.
7. **Faction names must match exactly** between the `## Factions` section and NPC parenthetical references.
8. **Don't worry about bold formatting in headings.** `## **Scene 1 — Title**` works the same as `## Scene 1 — Title`.
