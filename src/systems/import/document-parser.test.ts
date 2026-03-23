/**
 * Document parser tests — Sprint 15h (updated Sprint 16).
 */
import { describe, it, expect } from 'vitest'
import { parseDocument, buildBodyWithWikilinks } from './document-parser'

describe('parseDocument', () => {
    describe('scene extraction', () => {
        it('extracts scenes from ## Scene N: Title pattern', () => {
            const text = `# Campaign

## Scene 1: The Crash Site — Wreckage Field

The party arrives at the crash site. Debris is scattered everywhere.

## Scene 2: First Contact — The Forest Edge

A mysterious figure emerges from the trees.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Scene 1: The Crash Site')
            expect(result.scenes[0]!.metadata['locationName']).toBe('Wreckage Field')
            expect(result.scenes[0]!.body).toContain('crash site')
            expect(result.scenes[1]!.title).toBe('Scene 2: First Contact')
            expect(result.scenes[1]!.metadata['locationName']).toBe('The Forest Edge')
        })

        it('extracts scenes from ### Scene N — Title pattern', () => {
            const text = `## Act 1

### Scene 1 — The Beginning

Some content here.

### Scene 2 — The Middle

More content.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Scene 1: The Beginning')
            expect(result.scenes[1]!.title).toBe('Scene 2: The Middle')
        })

        it('extracts scenes with bold-wrapped headings', () => {
            const text = `## **Scene 1 — Rusthollow**

A town of 340 souls.

## **Scene 2 — The Forest**

Dark and mysterious.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Scene 1: Rusthollow')
            expect(result.scenes[1]!.title).toBe('Scene 2: The Forest')
        })

        it('extracts read-aloud blocks (blockquote format)', () => {
            const text = `## Scene 1: The Cave

> **READ ALOUD**
> You enter a dark cave. Water drips from the ceiling.
> The air smells of sulfur.

The DM describes the trap.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(1)
            expect(result.scenes[0]!.metadata['readAloud']).toContain('dark cave')
        })
    })

    describe('NPC extraction — keyword synonyms', () => {
        it('extracts NPCs from **NPC — Name** block pattern', () => {
            const text = `## Scene 1 — Test

**NPC — Mira Ashveil**
Race: Human
Class: Artificer
Alignment: Neutral Good
She is a brilliant inventor.

**NPC — Dren Voss**
Race: Half-Orc
Class: Fighter
Alignment: Lawful Neutral
A stoic mercenary captain.
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(2)
            expect(result.npcs[0]!.title).toBe('Mira Ashveil')
            expect(result.npcs[0]!.metadata['race']).toBe('Human')
            expect(result.npcs[0]!.metadata['class']).toBe('Artificer')
            expect(result.npcs[0]!.metadata['alignment']).toBe('Neutral Good')
            expect(result.npcs[0]!.metadata['combatant']).toBe(false)
            expect(result.npcs[1]!.title).toBe('Dren Voss')
        })

        it('extracts Creature keyword as combatant NPC', () => {
            const text = `## Scene 1 — Test

**Creature — Stone Golem**
HP: 50
AC: 16
A hulking stone construct.
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(1)
            expect(result.npcs[0]!.title).toBe('Stone Golem')
            expect(result.npcs[0]!.metadata['autoTag']).toBe('creature')
            expect(result.npcs[0]!.metadata['combatant']).toBe(true)
        })

        it('extracts Monster, Beast, Boss, Enemy as combatants', () => {
            const text = `## Scene 1 — Test

**Monster — Dire Wolf**
HP: 30

**Beast — Giant Spider**
HP: 20

**Boss — The Lich King**
HP: 200

**Enemy — Bandit Captain**
HP: 40
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(4)
            expect(result.npcs[0]!.metadata['autoTag']).toBe('monster')
            expect(result.npcs[0]!.metadata['combatant']).toBe(true)
            expect(result.npcs[1]!.metadata['autoTag']).toBe('beast')
            expect(result.npcs[2]!.metadata['autoTag']).toBe('boss')
            expect(result.npcs[3]!.metadata['autoTag']).toBe('enemy')
        })

        it('extracts Ally, Patron, Villain, Character as non-combatants', () => {
            const text = `## Scene 1 — Test

**Ally — Healing Priest**
A gentle soul.

**Patron — The Merchant Prince**
A wealthy patron.

**Villain — Dark Mage**
Scheming in the shadows.

**Character — Town Guard**
Standing watch.
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(4)
            expect(result.npcs[0]!.metadata['autoTag']).toBe('ally')
            expect(result.npcs[0]!.metadata['combatant']).toBe(false)
            expect(result.npcs[1]!.metadata['autoTag']).toBe('patron')
            expect(result.npcs[2]!.metadata['autoTag']).toBe('villain')
            expect(result.npcs[3]!.metadata['autoTag']).toBeNull()
        })

        it('detects stat blocks and overrides combatant flag', () => {
            const text = `## Scene 1 — Test

**NPC — Angry Shopkeeper**
HP: 12
AC: 10
He reaches for a club under the counter.
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(1)
            // NPC keyword defaults to non-combatant, but stat block overrides
            expect(result.npcs[0]!.metadata['combatant']).toBe(true)
        })

        it('extracts faction reference from parenthetical', () => {
            const text = `## Scene 1 — Test

**NPC — Silas Rem** (Iron Compact)
A clever trader.
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(1)
            expect(result.npcs[0]!.metadata['factionRef']).toBe('Iron Compact')
        })

        it('handles plural keywords (Creatures, Monsters)', () => {
            const text = `## Scene 1 — Test

**Creatures — Ashfield Trackers**
Three mutant coyotes.
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(1)
            expect(result.npcs[0]!.title).toBe('Ashfield Trackers')
            expect(result.npcs[0]!.metadata['autoTag']).toBe('creature')
        })

        it('extracts NPCs from table format', () => {
            const text = `## NPC Table

| Name | Race | Class | Role | Alignment |
|------|------|-------|------|-----------|
| Elara | Elf | Wizard | Mentor | Chaotic Good |
| Krog | Orc | Barbarian | Enemy | Chaotic Evil |
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(2)
            expect(result.npcs[0]!.title).toBe('Elara')
            expect(result.npcs[0]!.metadata['race']).toBe('Elf')
            expect(result.npcs[0]!.metadata['class']).toBe('Wizard')
            expect(result.npcs[1]!.title).toBe('Krog')
        })

        it('does not match single-column tables as NPC table rows', () => {
            const text = `## Scene 1 — Test

| Elder Dara Voss — Quest Giver |
| :---- |
| **Description:** A wise old woman |
| **Role:** Primary quest-giver |

**NPC — Elder Dara Voss**
A wise elder.
`
            const result = parseDocument(text)
            // Should only find 1 NPC (from the block pattern), not false positives from single-column table
            expect(result.npcs).toHaveLength(1)
            expect(result.npcs[0]!.title).toBe('Elder Dara Voss')
        })

        it('does not duplicate NPCs found by multiple patterns', () => {
            const text = `**NPC — Mira Ashveil**
Race: Human

### NPC: Mira Ashveil
Already defined above.
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(1)
        })

        it('links NPCs to parent scenes', () => {
            const text = `## Scene 1 — Town

**NPC — Guard**
Stands watch.

## Scene 2 — Forest

**NPC — Druid**
Lives in the woods.
`
            const result = parseDocument(text)
            expect(result.npcs).toHaveLength(2)
            expect(result.npcs[0]!.metadata['parentScene']).toBe(result.scenes[0]!.key)
            expect(result.npcs[1]!.metadata['parentScene']).toBe(result.scenes[1]!.key)
        })
    })

    describe('item extraction — new format', () => {
        it('extracts items from ## Items section with indented lines', () => {
            const text = `## Scene 1 — Test

## Items
  Flame Tongue (rare, attunement, loot) — A flaming sword
  Healing Potion x5 (common, consumable, loot) — Restores 2d4+2 HP
`
            const result = parseDocument(text)
            expect(result.items).toHaveLength(2)
            expect(result.items[0]!.title).toBe('Flame Tongue')
            expect(result.items[0]!.metadata['rarity']).toBe('rare')
            expect(result.items[0]!.metadata['sceneState']).toBe('loot')
            expect(result.items[0]!.metadata['properties']).toEqual(['attunement'])
            expect(result.items[0]!.metadata['quantity']).toBe(1)
            expect(result.items[1]!.title).toBe('Healing Potion')
            expect(result.items[1]!.metadata['quantity']).toBe(5)
            expect(result.items[1]!.metadata['rarity']).toBe('common')
        })

        it('parses item sub-lines as body content', () => {
            const text = `## Scene 1 — Test

## Items
  The Data Chip (quest)
    Description: Black matte composite
    Notes: Key campaign item
  Sword (rare) — A sharp blade
`
            const result = parseDocument(text)
            expect(result.items).toHaveLength(2)
            expect(result.items[0]!.title).toBe('The Data Chip')
            expect(result.items[0]!.metadata['sceneState']).toBe('quest')
            expect(result.items[0]!.body).toContain('Black matte composite')
            expect(result.items[0]!.body).toContain('Key campaign item')
            expect(result.items[1]!.title).toBe('Sword')
        })

        it('handles items with no tags', () => {
            const text = `## Scene 1 — Test

## Items
  Simple Rope — 50 feet of hempen rope
`
            const result = parseDocument(text)
            expect(result.items).toHaveLength(1)
            expect(result.items[0]!.title).toBe('Simple Rope')
            expect(result.items[0]!.metadata['rarity']).toBeNull()
            expect(result.items[0]!.metadata['sceneState']).toBeNull()
        })

        it('preserves hyphens in item names', () => {
            const text = `## Scene 1 — Test

## Items
  Anti-Rad Pills x10 (common, consumable) — Tastes like chalk
  Pre-Fracture Road Atlas — A damaged map
  Salvageable Rad-Suit Filtration Canister — Still functional
`
            const result = parseDocument(text)
            expect(result.items).toHaveLength(3)
            expect(result.items[0]!.title).toBe('Anti-Rad Pills')
            expect(result.items[0]!.metadata['quantity']).toBe(10)
            expect(result.items[1]!.title).toBe('Pre-Fracture Road Atlas')
            expect(result.items[2]!.title).toBe('Salvageable Rad-Suit Filtration Canister')
        })

        it('treats ## Items outside scenes as global', () => {
            const text = `## Items
  Global Sword (rare) — Available everywhere

## Scene 1 — Test

## Items
  Scene Sword (common) — Only here
`
            const result = parseDocument(text)
            expect(result.items).toHaveLength(2)
            expect(result.items[0]!.metadata['parentScene']).toBeNull()
            expect(result.items[1]!.metadata['parentScene']).toBe(result.scenes[0]!.key)
        })
    })

    describe('item extraction — legacy format', () => {
        it('extracts items from Items in Scene section with bullets', () => {
            const text = `## Items in Scene 1

- Signal Beacon — A glowing device that emits a distress signal
- Healing Potion — Restores 2d4+2 hit points
`
            const result = parseDocument(text)
            expect(result.items).toHaveLength(2)
            expect(result.items[0]!.title).toBe('Signal Beacon')
        })

        it('extracts items from Appendix sections', () => {
            const text = `## Appendix A: Items

- Cloak of Shadows — A rare magical cloak that grants invisibility
- Ring of Protection — An uncommon ring that provides +1 AC
`
            const result = parseDocument(text)
            expect(result.items).toHaveLength(2)
            expect(result.items[0]!.metadata['rarity']).toBe('rare')
            expect(result.items[1]!.metadata['rarity']).toBe('uncommon')
        })

        it('extracts inline bold items', () => {
            const text = `The chest contains **Flame Tongue** (rare) — A sword that erupts in flame when drawn.
Also inside is **Bag of Holding** (uncommon) — A small bag with an extradimensional space.
`
            const result = parseDocument(text)
            expect(result.items).toHaveLength(2)
            expect(result.items[0]!.title).toBe('Flame Tongue')
            expect(result.items[0]!.metadata['rarity']).toBe('rare')
        })

        it('extracts items from bold paragraph item sections', () => {
            const text = `## **Scene 1 — Test**

**Items in Scene 1**

* **Rusthollow Market Goods:** Purified water and dried rations
* **Dara's Flask:** Pre-Fracture steel flask
`
            const result = parseDocument(text)
            expect(result.items.length).toBeGreaterThanOrEqual(2)
            const titles = result.items.map((i) => i.title)
            expect(titles).toContain('Rusthollow Market Goods')
            expect(titles).toContain("Dara's Flask")
        })
    })

    describe('location extraction', () => {
        it('extracts locations from ## Locations section', () => {
            const text = `## Scene 1 — Rusthollow

## Locations
  The Market — Bustling overpass market
  The East Gate — Settlement entrance
  The Overpass Hall — Council meeting room
`
            const result = parseDocument(text)
            expect(result.locations).toHaveLength(3)
            expect(result.locations[0]!.title).toBe('The Market')
            expect(result.locations[1]!.title).toBe('The East Gate')
            expect(result.locations[2]!.title).toBe('The Overpass Hall')
            // All linked to parent scene
            expect(result.locations[0]!.metadata['parentScene']).toBe(result.scenes[0]!.key)
        })

        it('extracts locations from scene metadata', () => {
            const text = `## Scene 1: The Crash Site — Wreckage Field

Content here.

## Scene 2: First Contact — The Forest Edge

More content.
`
            const result = parseDocument(text)
            expect(result.locations).toHaveLength(2)
            expect(result.locations[0]!.title).toBe('Wreckage Field')
            expect(result.locations[1]!.title).toBe('The Forest Edge')
            expect(result.locations[0]!.relationships).toContain(result.scenes[0]!.key)
        })

        it('extracts locations from Location: headings (legacy)', () => {
            const text = `## Location: The Dragon's Lair

A vast cavern filled with gold.

## Location: The Tavern

A cozy inn where adventurers gather.
`
            const result = parseDocument(text)
            expect(result.locations).toHaveLength(2)
            expect(result.locations[0]!.title).toBe("The Dragon's Lair")
        })
    })

    describe('faction extraction', () => {
        it('extracts factions from ## Factions section', () => {
            const text = `## Factions
  The Iron Compact — Techno-mercantilists controlling salvage routes
  The Hollow Earth — Survivalists living underground
  Covenant of the Restored God — Religious zealots
`
            const result = parseDocument(text)
            expect(result.factions).toHaveLength(3)
            expect(result.factions[0]!.title).toBe('The Iron Compact')
            expect(result.factions[1]!.title).toBe('The Hollow Earth')
            expect(result.factions[2]!.title).toBe('Covenant of the Restored God')
        })

        it('extracts factions from heading patterns (legacy)', () => {
            const text = `## Faction: The Iron Guard

A militaristic organization that controls the northern territories.

## Faction: The Shadow Court

A secret society of spies and assassins.
`
            const result = parseDocument(text)
            expect(result.factions).toHaveLength(2)
            expect(result.factions[0]!.title).toBe('The Iron Guard')
        })

        it('creates stub factions from NPC references', () => {
            const text = `## Scene 1 — Test

**NPC — Captain Renn** (The Iron Guard)
A decorated military captain.
`
            const result = parseDocument(text)
            expect(result.factions).toHaveLength(1)
            expect(result.factions[0]!.title).toBe('The Iron Guard')
            expect(result.factions[0]!.metadata['stub']).toBe(true)
        })

        it('extracts factions from NPC body metadata', () => {
            const text = `**NPC — Captain Renn**
Race: Human
Faction: The Iron Guard
A decorated military captain.
`
            const result = parseDocument(text)
            expect(result.factions).toHaveLength(1)
            expect(result.factions[0]!.title).toBe('The Iron Guard')
        })

        it('does not duplicate factions from multiple sources', () => {
            const text = `## Factions
  The Iron Guard — A military order

## Scene 1 — Test

**NPC — Captain Renn** (The Iron Guard)
A captain.
`
            const result = parseDocument(text)
            expect(result.factions).toHaveLength(1)
        })
    })

    describe('lore extraction', () => {
        it('extracts lore from ## Lore section', () => {
            const text = `## Lore
  The Fracture — Catastrophic event of 2041
  The Ashlands — Post-apocalyptic midwest
  AXIOM — A pre-war AI
`
            const result = parseDocument(text)
            expect(result.lore).toHaveLength(3)
            expect(result.lore[0]!.title).toBe('The Fracture')
            expect(result.lore[0]!.body).toContain('Catastrophic event')
            expect(result.lore[1]!.title).toBe('The Ashlands')
            expect(result.lore[2]!.title).toBe('AXIOM')
        })

        it('recognizes synonym headings: History, World, Setting, Backstory', () => {
            const texts = [
                '## History\n  Event A — Something happened\n',
                '## World\n  Place A — A location\n',
                '## Setting\n  Detail A — A detail\n',
                '## Backstory\n  Origin A — How it began\n',
            ]
            for (const text of texts) {
                const result = parseDocument(text)
                expect(result.lore).toHaveLength(1)
            }
        })

        it('parses lore sub-lines', () => {
            const text = `## Lore
  The Fracture — The catastrophic event of 2041
    Nuclear warheads, bioweapons, atmospheric poison deployed within six hours.
    By the next morning, civilization was over.
`
            const result = parseDocument(text)
            expect(result.lore).toHaveLength(1)
            expect(result.lore[0]!.body).toContain('Nuclear warheads')
            expect(result.lore[0]!.body).toContain('civilization was over')
        })
    })

    describe('cross-referencing', () => {
        it('builds relationships when entity names appear in other bodies', () => {
            const text = `## Scene 1: The Meeting — Town Square

The party meets Mira Ashveil in the town square.

**NPC — Mira Ashveil**
Race: Human
Class: Artificer
She carries a Signal Beacon at all times.

## Items in Scene 1

- Signal Beacon — A critical quest device
`
            const result = parseDocument(text)
            const scene = result.scenes[0]!
            const mira = result.npcs[0]!
            expect(scene.relationships).toContain(mira.key)
        })
    })

    describe('total count', () => {
        it('reports correct total including lore', () => {
            const text = `## Lore
  Event — Something

## Scene 1: Test — Location A

**NPC — Bob**
Race: Human

## Items
  Sword — A sharp blade
`
            const result = parseDocument(text)
            expect(result.total).toBe(
                result.scenes.length + result.npcs.length + result.items.length +
                result.locations.length + result.factions.length + result.lore.length,
            )
        })
    })

    describe('empty/no-match input', () => {
        it('returns empty arrays for plain text with no patterns', () => {
            const result = parseDocument('Just some regular text with no structured content.')
            expect(result.total).toBe(0)
            expect(result.scenes).toHaveLength(0)
            expect(result.npcs).toHaveLength(0)
            expect(result.items).toHaveLength(0)
            expect(result.lore).toHaveLength(0)
        })

        it('handles empty string', () => {
            const result = parseDocument('')
            expect(result.total).toBe(0)
        })
    })

    describe('edge cases — unusual markdown', () => {
        it('handles mixed heading levels (h2 and h4)', () => {
            const text = `## Scene 1: The Intro — Start Area

Some content.

#### Minor Note

More content.

## Scene 2: Finale — End Area

Final content.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Scene 1: The Intro')
            expect(result.scenes[1]!.title).toBe('Scene 2: Finale')
        })

        it('handles document with no headings at all', () => {
            const text = `Just a paragraph of text about various things.
Another paragraph mentioning some names and places.
No structured content here.`
            const result = parseDocument(text)
            expect(result.total).toBe(0)
        })

        it('handles empty section headings', () => {
            const text = `## Scene 1: Empty — Nowhere

## Scene 2: Also Empty — Void
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
        })
    })

    describe('complete document — integration test', () => {
        it('parses a full document with all entity types', () => {
            const text = `# The Last Signal

## Lore
  The Fracture — The catastrophic event of 2041
  The Ashlands — Post-apocalyptic midwest

## Factions
  The Iron Compact — Techno-mercantilists
  The Hollow Earth — Underground survivalists

## Scene 1 — Rusthollow

A town built into a collapsed overpass.

## Locations
  The Market — Bustling overpass market
  The East Gate — Settlement entrance

**NPC — Elder Dara Voss**
Description: A woman of sixty with sharp eyes.
Role: Primary quest-giver.

**Creature — Ashfield Trackers**
HP: 45
AC: 14
Three mutant coyotes the size of Great Danes.

**NPC — Silas Rem** (The Iron Compact)
Description: Forty, slim, carefully groomed.
Role: Act 1 antagonist.

## Items
  Rusthollow Market Goods x3 (common, consumable, loot) — Purified water and rations
  Dara's Flask (uncommon, placed) — Pre-Fracture steel flask
  The Data Chip (quest, loot)
    Description: Black matte composite
    Notes: Key campaign item

## Scene 2 — The Dying Man

A scavenger arrives bleeding.

## Items
  Cael's Journal (uncommon, loot) — Three weeks of handwriting
`
            const result = parseDocument(text)

            // Scenes
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Scene 1: Rusthollow')

            // NPCs
            expect(result.npcs).toHaveLength(3)
            expect(result.npcs[0]!.title).toBe('Elder Dara Voss')
            expect(result.npcs[0]!.metadata['combatant']).toBe(false)
            expect(result.npcs[1]!.title).toBe('Ashfield Trackers')
            expect(result.npcs[1]!.metadata['combatant']).toBe(true)
            expect(result.npcs[1]!.metadata['autoTag']).toBe('creature')
            expect(result.npcs[2]!.title).toBe('Silas Rem')
            expect(result.npcs[2]!.metadata['factionRef']).toBe('The Iron Compact')

            // Items
            expect(result.items).toHaveLength(4)
            expect(result.items[0]!.title).toBe('Rusthollow Market Goods')
            expect(result.items[0]!.metadata['quantity']).toBe(3)
            expect(result.items[0]!.metadata['sceneState']).toBe('loot')
            expect(result.items[1]!.title).toBe("Dara's Flask")
            expect(result.items[1]!.metadata['sceneState']).toBe('placed')
            expect(result.items[2]!.title).toBe('The Data Chip')
            expect(result.items[2]!.body).toContain('Black matte composite')

            // Locations
            expect(result.locations).toHaveLength(2)
            expect(result.locations[0]!.title).toBe('The Market')

            // Factions (2 defined + Iron Compact not duplicated from NPC ref)
            expect(result.factions).toHaveLength(2)

            // Lore
            expect(result.lore).toHaveLength(2)
            expect(result.lore[0]!.title).toBe('The Fracture')
        })
    })

    // ── Sprint 19: D&D adventure module patterns ─────────────────────────

    describe('Part/Act/Chapter scene extraction (Sprint 19)', () => {
        it('extracts scenes from Part N: Title pattern', () => {
            const text = `Part 1: The Coming of the Maimed Virulence

The characters witness the dragon attack on Valjevo Castle.

Part 2: The Search for Allies

The adventurers explore the town looking for help.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Part 1: The Coming of the Maimed Virulence')
            expect(result.scenes[0]!.metadata['structureType']).toBe('part')
            expect(result.scenes[0]!.metadata['sceneNumber']).toBe(1)
            expect(result.scenes[1]!.title).toBe('Part 2: The Search for Allies')
        })

        it('extracts scenes from Act N: Title pattern', () => {
            const text = `Act 1: Prologue

The players arrive at Camp Highmore.

Act 2: The Hunt Begins

The party ventures into the jungle.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Act 1: Prologue')
            expect(result.scenes[0]!.metadata['structureType']).toBe('act')
            expect(result.scenes[1]!.title).toBe('Act 2: The Hunt Begins')
        })

        it('extracts scenes from Chapter N: Title pattern', () => {
            const text = `Chapter 1: Into Stensia

The adventurers travel into the dark province.

Chapter 2: Shadowgrange

A bleak village surrounded by vampire estates.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Chapter 1: Into Stensia')
            expect(result.scenes[0]!.metadata['structureType']).toBe('chapter')
            expect(result.scenes[1]!.title).toBe('Chapter 2: Shadowgrange')
        })

        it('extracts scenes from ## Part N — Title with heading markers', () => {
            const text = `## Part 1 — The Dragon Arrives

Chaos erupts in the streets.

## Part 2 — Into the Sewers

The party flees underground.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Part 1: The Dragon Arrives')
            expect(result.scenes[1]!.title).toBe('Part 2: Into the Sewers')
        })

        it('does not duplicate scenes matched by both Scene and Part patterns', () => {
            const text = `## Scene 1: The Tavern

Some content.

Part 2: The Road

More content.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Scene 1: The Tavern')
            expect(result.scenes[1]!.title).toBe('Part 2: The Road')
        })
    })

    describe('Roleplaying NPC blocks (Sprint 19)', () => {
        it('extracts NPCs from Roleplaying [Name] pattern', () => {
            const text = `## Scene 1 — Test

Roleplaying Imizael
Imizael is attentive of her patrons needs. She responds to questions curtly.

Roleplaying Fat Mar (Markoth)
Fat Mar clearly dislikes his nickname, but it is well-earned. He is a rotund man who sweats profusely.
`
            const result = parseDocument(text)
            const roleplayNPCs = result.npcs.filter(n => n.title === 'Imizael' || n.title === 'Fat Mar')
            expect(roleplayNPCs).toHaveLength(2)

            const imizael = result.npcs.find(n => n.title === 'Imizael')
            expect(imizael).toBeDefined()
            expect(imizael!.body).toContain('attentive')

            const fatMar = result.npcs.find(n => n.title === 'Fat Mar')
            expect(fatMar).toBeDefined()
            expect(fatMar!.metadata['altName']).toBe('Markoth')
            expect(fatMar!.body).toContain('rotund')
        })

        it('extracts Ideal/Bond/Flaw fields from NPC bodies', () => {
            const text = `## Scene 1 — Test

Roleplaying Chief Shandra
Shandra is a beautiful young woman with political power.
Ideal: Dominance — Shandra wants to rule over everyone.
Bond: Shandra is dedicated to ruling Camp Highmore.
Flaw: It was Shandra who started the corruption.
`
            const result = parseDocument(text)
            const shandra = result.npcs.find(n => n.title === 'Chief Shandra')
            expect(shandra).toBeDefined()
            expect(shandra!.metadata['ideal']).toContain('Dominance')
            expect(shandra!.metadata['bond']).toContain('dedicated to ruling')
            expect(shandra!.metadata['flaw']).toContain('corruption')
        })

        it('does not duplicate NPCs found by both keyword and Roleplaying patterns', () => {
            const text = `## Scene 1 — Test

**NPC — Aleyd Burral**
A formidable warrior.

Roleplaying Aleyd Burral
She does not suffer fools.
`
            const result = parseDocument(text)
            const aleydNPCs = result.npcs.filter(n => n.title === 'Aleyd Burral')
            // The keyword pattern finds her first; Roleplaying pattern should skip (already seen)
            expect(aleydNPCs).toHaveLength(1)
        })
    })

    describe('read-aloud text from plain text (Sprint 19)', () => {
        it('extracts read-aloud from "read the following" marker', () => {
            const text = `## Scene 1: The Cave — Dark Entrance

As the adventure begins, read the following.

It's been a good day. A fresh five hundred gold pieces in your pocket after another successful adventure.

Allow the characters to roleplay their night.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(1)
            expect(result.scenes[0]!.metadata['readAloud']).toContain('five hundred gold')
        })

        it('extracts read-aloud from "read or paraphrase" marker', () => {
            const text = `## Scene 1: The Chapel — Ruins

If the PCs look inside, read or paraphrase:

Three figures geared in weathered leathers sit on the rotted wooden pews with their heads bowed in reverence.

The skeletons will attack if disturbed.
`
            const result = parseDocument(text)
            expect(result.scenes).toHaveLength(1)
            expect(result.scenes[0]!.metadata['readAloud']).toContain('weathered leathers')
        })
    })

    describe('mixed D&D PDF content integration (Sprint 19)', () => {
        it('parses a D&D adventure module with Parts, Roleplaying blocks, and read-aloud', () => {
            const text = `Part 1: The Dragon Attack

As the dragon approaches, read the following.

A vast winged serpent larger than the inn is perched on the side of the castle, rending great holes in its walls.

Give the players a chance to react.

Roleplaying Knight Aleyd Burral
Knight Aleyd Burral is a formidable warrior with a keen mind. She does not suffer fools.
Ideal: Duty — protecting Phlan is more important than advancement.
Bond: She is utterly faithful to the Lord Regent.
Flaw: Her soft heart has kept her from advancing further.

Part 2: The Sewers

The party must escape through the sewers.

## Items
  Potion of Healing x2 (common, consumable, loot) — Restores 2d4+2 HP
`
            const result = parseDocument(text)

            // Scenes from Part pattern
            expect(result.scenes).toHaveLength(2)
            expect(result.scenes[0]!.title).toBe('Part 1: The Dragon Attack')
            expect(result.scenes[0]!.metadata['readAloud']).toContain('vast winged serpent')

            // NPC from Roleplaying block
            const aleyd = result.npcs.find(n => n.title === 'Knight Aleyd Burral')
            expect(aleyd).toBeDefined()
            expect(aleyd!.metadata['ideal']).toContain('Duty')
            expect(aleyd!.metadata['bond']).toContain('faithful')
            expect(aleyd!.metadata['flaw']).toContain('soft heart')

            // Items
            expect(result.items).toHaveLength(1)
            expect(result.items[0]!.title).toBe('Potion of Healing')
            expect(result.items[0]!.metadata['quantity']).toBe(2)
        })
    })
})

describe('buildBodyWithWikilinks', () => {
    it('inserts wikilinks for related entities mentioned in body', () => {
        const entity = {
            key: 'scene-0-meeting',
            title: 'Scene 1: The Meeting',
            type: 'scene' as const,
            body: 'The party meets Mira Ashveil in the tavern.',
            metadata: {},
            sourceRange: [1, 5] as [number, number],
            relationships: ['npc-0-mira-ashveil'],
            checked: true,
        }
        const allEntities = [
            entity,
            {
                key: 'npc-0-mira-ashveil',
                title: 'Mira Ashveil',
                type: 'npc' as const,
                body: '',
                metadata: {},
                sourceRange: [6, 10] as [number, number],
                relationships: [],
                checked: true,
            },
        ]

        const result = buildBodyWithWikilinks(entity, allEntities)
        expect(result).toContain('[[Mira Ashveil]]')
    })
})
