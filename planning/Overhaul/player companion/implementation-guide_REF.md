# DM App — Player Ecosystem Implementation Guide

## Overview for Developer

This document outlines the implementation requirements for adding the player companion ecosystem to the existing DM app. The base app (Electron, Node.js, Socket.io) remains unchanged. This feature adds a local web server, a browser-based companion app, and a new Players layer to the DM cockpit.

---

## Architecture Summary

The DM's machine acts as both the Electron app host and a local web server. When a session goes live, the server becomes accessible to all devices on the same local network. Player devices connect via browser — no installation required.

**New components:**
- Local Express web server (served from within the existing Node.js backend)
- Companion web app (character creator + player dashboard)
- Session management layer (token generation, player identity, lobby state)
- Players panel UI in the DM cockpit

**Existing components leveraged:**
- Socket.io — already handles real-time sync, extended to player sockets
- Campaign data — game system selection already stored at campaign level

---

## Session Identity & Player Tokens

MAC address identification is not available in browsers. Player identity is managed as follows:

1. On session creation the server generates a unique **session code**
2. The QR code encodes a local URL: `http://<local-ip>:<port>/join?session=<code>`
3. When a player scans and connects, the server assigns them a **unique session token** stored in their browser (localStorage)
4. That token is submitted with their completed character data
5. The server maps `token → character → player name` and this binding is locked once the DM approves them in the lobby
6. All subsequent Socket.io events targeting that player use their socket ID, resolved from the token

---

## QR Code & Session Launch

- On Play Mode launch, the server generates the session code and starts listening
- The QR code is rendered in the opening cinematic/splash UI using the local IP and session code
- Local IP is detected automatically by the Node backend at launch
- The QR code should display alongside the opening film/image as an overlay element

---

## Companion App — Routing

The companion app is a single responsive web app served by the local Express server. Routes:

| Route | Purpose |
|---|---|
| `/join?session=<code>` | Entry point, validates session code, sets token, routes to creator |
| `/create` | Character creator (basic or advanced mode) |
| `/lobby` | Waiting screen post-submission, shows approval state |
| `/dashboard` | Live player dashboard, active during session |

---

## Character Creator

### Mode Selection
On arrival at `/create` the player selects **Basic** or **Advanced** mode. This is a UI routing decision only — both modes write to the same character data model.

### Game System Configuration
The companion app requests the campaign's game system config from the server on load. This config drives:
- Which stat blocks to render
- Class and race/ancestry lists
- Skill lists
- HP calculation method
- Any system-specific fields (e.g. Sanity for Call of Cthulhu)

### Basic Mode
- Linear stepped flow, one screen per decision
- Steps: Race → Class → Ability Scores → Skills → Background → Equipment → Review
- Includes tooltips and brief explanations per field
- Back/Next navigation with progress indicator

### Advanced Mode
- Tabbed or single-page layout
- All fields accessible simultaneously
- No explanations or guidance UI
- Faster completion path for experienced players

### Character Data Model (D&D 5e reference)

```
{
  meta: {
    token: string,
    sessionId: string,
    system: string,
    mode: "basic" | "advanced"
  },
  identity: {
    playerName: string,
    characterName: string,
    race: string,
    class: string,
    subclass: string,
    background: string,
    alignment: string,
    level: number
  },
  attributes: {
    STR: number,
    DEX: number,
    CON: number,
    INT: number,
    WIS: number,
    CHA: number
  },
  derived: {
    maxHP: number,
    currentHP: number,
    AC: number,
    speed: number,
    initiative: number,
    proficiencyBonus: number
    // All auto-calculated from attributes where possible
  },
  skills: {
    // Key: skill name, Value: proficient boolean
  },
  savingThrows: {
    // Key: attribute, Value: proficient boolean
  },
  inventory: [
    { id: string, name: string, quantity: number, description: string }
  ],
  currency: {
    gold: number, silver: number, copper: number
  },
  conditions: [
    { id: string, name: string, appliedAt: timestamp }
  ],
  background: {
    traits: string,
    ideals: string,
    bonds: string,
    flaws: string,
    backstory: string
  },
  notes: string
}
```

Other game systems follow the same model structure with system-appropriate fields substituted in.

---

## Lobby System

### Player Side
- After submitting character data, player is routed to `/lobby`
- Lobby screen shows a waiting state with campaign atmosphere (music/image from campaign assets)
- Socket listens for `lobby:approved` or `lobby:kicked` events
- On approved → redirect to `/dashboard`
- On kicked → show a polite rejection message with option to rebuild

### DM Cockpit Side
A **Lobby Panel** is added to the cockpit, visible during the pre-session phase only.

For each connected player it displays:
- Player name and character name
- Race, class, level
- Core stats summary
- **Approve** and **Kick** buttons

Once all players are approved:
- DM sends a **Ready Check** — all player screens receive `lobby:readyCheck` event and display a confirm button
- As players confirm, the DM lobby updates in real time
- When all players confirm, the **Go Live** button unlocks on the DM cockpit

### Go Live Event
`session:goLive` broadcasts to all player sockets simultaneously. All player devices transition from lobby to `/dashboard` at the same moment.

---

## Player Dashboard

The dashboard connects via Socket.io on load and listens for the following events pushed from the DM:

| Event | Payload | Action |
|---|---|---|
| `player:hpUpdate` | `{ current, max }` | Update HP display and health bar |
| `player:conditionAdd` | `{ id, name }` | Add condition indicator |
| `player:conditionRemove` | `{ id }` | Remove condition indicator |
| `player:itemAdd` | `{ item object }` | Add item to inventory list |
| `player:itemRemove` | `{ id }` | Remove item from inventory |
| `player:currencyUpdate` | `{ gold, silver, copper }` | Update currency display |
| `player:whisper` | `{ message, from }` | Deliver sealed whisper notification |
| `session:broadcast` | `{ type, content }` | Global message or atmosphere push |

### Dice Roller
Built into the dashboard UI. Purely client-side, no server involvement required.
Dice available: d4, d6, d8, d10, d12, d20, d100.
Display the result with a brief animation. Roll history for the session is a nice optional addition.

### Whisper UI
- Incoming whisper triggers a subtle notification (icon + vibration if on mobile)
- Player taps a sealed envelope icon to reveal the message
- Message is displayed privately, never visible to other players
- Whisper history is visible only to the recipient

---

## DM Cockpit — Players Panel

Added as a new panel/tab to the existing cockpit. Active only during a live session.

Displays a card per connected player showing:
- Character name and player name
- HP bar (live, updates in real time)
- Active conditions as icon badges
- Quick action buttons: **HP +/-**, **Add Condition**, **Send Item**, **Whisper**

**Whisper flow:**
- DM clicks Whisper on a player card
- A text input appears (or a small modal)
- DM can target one player or multi-select
- Message emits to targeted socket(s) only

**Broadcast panel:**
- Separate from individual player cards
- Send a message or item to all players simultaneously
- Trigger atmosphere events to all screens

---

## Game System Presets — File Structure

Each system preset is a JSON config file loaded by the server. Structure:

```
/presets
  /dnd5e.json
  /pathfinder2e.json
  /callofcthulhu.json
  /shadowrun.json
```

Each config defines the field schema the character creator renders, class lists, race lists, skill lists, and any system-specific logic flags. The companion app requests the relevant config on load based on the campaign's system setting.

---

## Phased Rollout Notes

**v1 (this build):**
- One-directional data flow: DM pushes, players receive
- Full character creator (basic + advanced, 4 system presets)
- Lobby with approval and ready check
- Player dashboard with dice roller
- Whisper system

**v2 (planned):**
- Two-way interaction: players can interact with found items, open containers, react to discoveries
- Native iOS and Android app wrapper (Capacitor recommended given existing web app base)
- Custom game system builder for DMs
