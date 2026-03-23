# Player Companion — MVP Overview

## What This Is

A lightweight player companion system that connects players at the table to the DM's session via QR code. Players scan, enter their name and stats, and receive a live dashboard on their phone. The DM pushes HP changes, conditions, items, and whispers in real time. No app download, no accounts — scan and play.

This is the **MVP slice** — focused on proving the real-time push pipeline before layering on advanced features like a full character creator or game system presets.

---

## Session Flow

### 1. DM Launches Session
The DM opens a campaign in **Play Mode** and starts the session. A QR code is displayed on the opening screen (already exists in the launch screen UI). Players scan it to join.

### 2. Player Joins
Scanning the QR code opens a browser-based companion app hosted on the DM's local machine (port 8080, same Express server). The player lands on a **join form** and enters:

- Player name (required)
- Character name (required)
- Class (freetext)
- Level (number)
- HP / Max HP (number)
- AC (number)
- Ability scores: STR, DEX, CON, INT, WIS, CHA (6 numbers)

Total: ~12 fields. Fits on one phone screen.

### 3. Lobby
After submitting, the player enters a waiting state. The DM sees each player in a **Lobby Panel** with their submitted stats and can **Approve** or **Kick** them.

Once all players are approved, the DM triggers a **Ready Check** — all players confirm on their devices. When all confirm, the **Go Live** button unlocks.

### 4. Session Begins
Go Live pushes all player devices from lobby to dashboard simultaneously. From this point the DM has full control over each player's dashboard.

### 5. Live Session
The DM pushes updates to individual players or broadcasts to all:
- Adjust HP (increase/decrease)
- Apply/remove conditions
- Send items to inventory
- Send private whisper messages

Players see updates in real time on their phone dashboards.

---

## Player Dashboard (v1)

Each player's phone becomes their personal session dashboard. In v1, the dashboard is a **receiver** — all content is pushed from the DM.

**What players see:**
- Current HP / Max HP with visual health bar
- AC display
- Ability scores with auto-calculated modifiers
- Active conditions with visual indicators (poisoned, stunned, etc.)
- Inventory — items sent by the DM
- Gold/silver/copper currency
- Whisper messages — private notes from the DM, revealed via sealed envelope interaction
- Built-in **dice roller** (d4, d6, d8, d10, d12, d20, d100) — purely client-side

---

## DM Cockpit — Players Panel

A new **Players panel** added to the existing cockpit. Active only during a live session with connected players.

**Per-player card:**
- Character name and player name
- HP bar (live, updates in real time)
- AC badge
- Ability scores summary
- Active conditions as icon badges
- Quick action buttons: HP +/-, Add Condition, Send Item, Whisper

**Whisper flow:**
- DM clicks Whisper on a player card
- Text input appears
- DM can target one player or multi-select
- Message emits to targeted socket(s) only

**Broadcast actions:**
- Send items, messages, or currency to all players simultaneously

---

## Technical Decisions

### Separate Vite Build
The companion app is a **separate Vite build** — not part of the cockpit bundle. Rationale:
- Mobile-first design without fighting cockpit CSS
- Tiny bundle — only ships what players need
- Clear boundary — companion never imports cockpit code
- Easier to wrap in Capacitor later (future native app)
- Follows existing pattern (cockpit already has its own Vite build separate from AV display)

Built output served by Express on port 8080, same as the cockpit.

### Linked Stores (not unified)
Player state lives in a new `usePlayerStore`. When combat is active, a sync layer keeps HP consistent between `usePlayerStore` and the existing `useCombatStore`. No rework of the combat tracker required.

### Session Identity
- Server generates a unique **session code** on Play Mode launch
- QR code encodes: `http://<local-ip>:8080/companion/join?session=<code>`
- Player receives a **session token** stored in localStorage
- Token maps to player identity — survives phone sleep/wake reconnection
- All targeted Socket.io events resolve player by token

### System-Agnostic
No game system presets in v1. Class is freetext. Ability scores are always the 6 standard D&D-style attributes (STR/DEX/CON/INT/WIS/CHA) which cover most systems. Game-system-specific character creation is a future layer.

### New Socket.io Room
A `player` room joins the existing `av-display` and `cockpit` rooms. Player-targeted events use direct socket emission (not room broadcast) for private data like whispers.

---

## Player Data Model

```typescript
interface PlayerCharacter {
  // Identity
  token: string           // session token (server-assigned)
  socketId: string        // current socket connection
  playerName: string
  characterName: string

  // Basic stats
  class: string           // freetext
  level: number
  hpCurrent: number
  hpMax: number
  ac: number

  // Ability scores
  abilities: {
    STR: number
    DEX: number
    CON: number
    INT: number
    WIS: number
    CHA: number
  }

  // Session state (DM-managed)
  conditions: string[]
  inventory: Array<{ id: string; name: string; quantity: number; description: string }>
  currency: { gold: number; silver: number; copper: number }
  whispers: Array<{ id: string; message: string; timestamp: number; read: boolean }>

  // Lobby state
  status: 'pending' | 'approved' | 'kicked' | 'ready' | 'live'
}
```

---

## What's NOT in MVP

| Feature | Status |
|---|---|
| Full character creator (basic/advanced modes) | Future — v2 |
| Game system presets (D&D 5e, PF2e, CoC, Shadowrun) | Future — v2 |
| Two-way player interaction (open containers, react) | Future — v2 |
| Native iOS/Android app wrapper | Future — v2 |
| Custom game system builder | Future — v2 |
| Broadcast atmosphere events to player screens | Future — v2 |
| Auto-derived stats (proficiency, save bonuses) | Future — v2 |

---

## Reference Documents

- [overview_REF.md](overview_REF.md) — Original full vision document
- [implementation-guide_REF.md](implementation-guide_REF.md) — Original full implementation guide
