# DM App — Player Ecosystem Overview

## What This Is

An expansion of the existing DM cockpit app that transforms it from a solo tool into a full session ecosystem. The DM remains in full control, but every player at the table gets their own live personal dashboard — accessible from their phone via a QR code scan. No app downloads, no accounts, just scan and play.

---

## The Session Flow

### 1. Campaign Launch
The DM opens a saved campaign and enters **Play Mode**. The system displays an opening cinematic or image (uploaded by the DM at campaign creation) on the main screen. Embedded in this opening screen is a **QR code** that players scan to enter the session.

### 2. Player Onboarding
Scanning the QR code opens a **browser-based companion app** hosted on the DM's local machine. Each player lands on the **Character Creator**, which is already configured for the correct game system — set by the DM at campaign creation.

### 3. Character Creation
Players choose their experience level:
- **Basic Mode** — a guided, step-by-step flow ideal for new players
- **Advanced Mode** — a full character sheet layout for experienced players

Both modes produce the same character data and feed into the same system. Basic mode includes tooltips and explanations. Advanced mode has no hand-holding.

### 4. The Lobby
Once a player completes their character and hits **Ready**, they enter a waiting state. Their character appears in the **DM's lobby panel** showing:
- Player name and character name
- Class, race, and level
- Key stats for a quick sanity check (HP, AC, core attributes)

The DM reviews each character and either **Approves** or **Kicks** them. Once all players are approved, the DM triggers a **Ready Check** — all players confirm on their devices. When all confirm, the **Go Live** button unlocks.

### 5. Session Begins
Go Live triggers the session start simultaneously across all player devices. The opening atmosphere (music, imagery) pushes to all screens at once. From this point the DM cockpit has full control over every player dashboard.

---

## The Player Dashboard (v1)

Each player's phone becomes their personal session dashboard for the duration of play. In v1, the dashboard is a **receiver** — all content is pushed from the DM. Players do not interact with the game world through it yet (planned for v2).

**What players see:**
- Current HP and Max HP with a visual health bar
- Active conditions and effects (poisoned, stunned, slowed etc.) with prominent visual indicators
- Inventory — items found or given by the DM
- Gold and currency
- Whisper messages — private notes from the DM, revealed via a sealed envelope interaction
- Their character sheet in read-only view
- A built-in **dice roller** (d4, d6, d8, d10, d12, d20, d100)

---

## The DM Cockpit — Players Layer

A new **Players panel** is added to the existing DM cockpit. This is the only meaningful addition to the cockpit for this feature set. All existing mechanics remain unchanged.

**Per-player actions:**
- Adjust HP (increase or decrease)
- Apply or remove conditions and effects
- Send items to a player's inventory
- Whisper to one player or a selected group

**Broadcast actions:**
- Send items, messages, or atmosphere changes to all players simultaneously
- Trigger map reveals or announcements across all screens

---

## Game System Support

The companion app is **system-aware**. The DM selects the ruleset at campaign creation and the character creator dynamically serves the correct fields, class lists, stat structures, and mechanics.

**Shipping with:**
- Dungeons & Dragons 5e
- Pathfinder 2e
- Call of Cthulhu
- Shadowrun

**Planned later:**
- Custom / Freeform system builder

---

## Technical Foundation

- The companion app is **browser-based** — no installation required for players
- Hosted on the **DM's local machine**, designed for local network play
- Built on the **existing Socket.io** real-time infrastructure already in the app
- Player identity is managed via a **session token** generated at join time and stored in the browser
- **iOS and Android native app** wrapping planned as a future release

---

## What Makes This Different

No existing tool combines these elements in this way. The asymmetric information model — where the DM controls what each player sees, can whisper privately, and can apply effects that only the target player experiences — replicates how tabletop actually works at its best. Combined with zero-friction QR onboarding and a cinematic session launch, this turns the DM app into a complete table experience platform.
