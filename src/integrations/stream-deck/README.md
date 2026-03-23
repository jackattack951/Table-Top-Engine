# Stream Deck Integration — TTRPG Stage Manager

## Supported Devices

- Stream Deck Mini (2x3)
- Stream Deck Standard (3x5) — Recommended
- Stream Deck XL (4x8)
- Stream Deck Plus (4x2 buttons + 4 dials)

## Requirements

1. TTRPG Stage Manager running in Play or Headless mode with Host on LAN enabled
2. Bitfocus Companion v3.0+ installed on your PC/Mac
3. Stream Deck hardware connected to the Companion machine

## Setup Steps

### 1. Install Bitfocus Companion

Download from https://bitfocus.io/companion
Install and launch. Open Companion's web interface (usually http://localhost:8000).

### 2. Add the Stage Manager Module

In Companion, go to Connections → Add Connection, search for "TTRPG Stage Manager".
Configure the connection:

- **Host**: The IP address of the machine running Stage Manager (e.g. 192.168.1.50)
- **Port**: 3000 (default)

### 3. Test the Connection

The module's connection indicator should turn green.
You can verify by checking the `$(stage-manager:connected)` variable — it should read "connected".

### 4. Import a Preset Layout

In Companion, go to Buttons → Import, and load one of the included preset layouts:

- `combat-control` — For combat encounters (mood ladder, environments, SFX, Next Turn)
- `scene-atmosphere` — For scene transitions and atmosphere control

Or build your own layout using the available actions below.

## Available Actions

| Action | Description | Options |
|--------|-------------|---------|
| **Load Scene** | Load a scene by ID | scene_id |
| **Set Mood** | Set mood slider 0–100 | value |
| **Mood Up** | Increase mood by step | step (1–25) |
| **Mood Down** | Decrease mood by step | step (1–25) |
| **Trigger SFX** | Play a sound clip | clip_id, volume, loop, spatial_x, spatial_y |
| **Stop SFX** | Stop a looping clip | clip_id |
| **Next Combat Turn** | Advance initiative order | — |
| **Apply Preset** | Apply environment preset | preset_id (dropdown) |
| **Play FX Overlay** | Start a WebM FX loop | clip_id, url, loop_offset |
| **Stop FX Overlay** | Stop an FX loop | clip_id |

## Available Feedbacks (Button Visual States)

| Feedback | Effect |
|----------|--------|
| **Connection Status** | Green = connected, Red = disconnected |
| **Mood Level** | Button color shifts blue (calm) to red (dramatic) with current value |
| **Active Combatant** | Shows current combatant name and round number |

## Available Variables (for button labels)

| Variable | Value |
|----------|-------|
| `$(stage-manager:connected)` | connected / disconnected |
| `$(stage-manager:mood_value)` | 0.00 – 1.00 |
| `$(stage-manager:mood_percent)` | 0 – 100 |
| `$(stage-manager:active_scene_id)` | Scene UUID or blank |
| `$(stage-manager:combat_round)` | Round number |
| `$(stage-manager:active_combatant)` | Combatant name or blank |
| `$(stage-manager:app_mode)` | play / plan / headless |

## Latency Expectations

- Button press to AV display response: **< 100ms** on local network
- Measured over WiFi (same subnet): typically 15–40ms
- Over powerline Ethernet: typically 5–15ms

## Troubleshooting

**Module shows "Disconnected":**

- Confirm Stage Manager is running with "Host on LAN" enabled
- Check the host IP — use the machine's LAN IP, not localhost (127.0.0.1)
- Ensure port 3000 is not blocked by your firewall or router

**Actions not firing:**

- Check the Companion log for socket errors
- Verify the scene_id / clip_id values match what is configured in Stage Manager
- Confirm the Stage Manager server shows the connection in its log

**High latency (> 200ms):**

- Avoid WiFi if possible — use wired Ethernet for the Companion machine
- Check for network congestion on the same subnet
- Restart the Companion service if latency has drifted upward over time

## Hardware Test Checklist

- [ ] Connection feedback turns green on connect
- [ ] Set Mood to 100 — dramatic music activates on the AV display
- [ ] Load Scene fires — background video changes on the AV display
- [ ] Trigger SFX — audio plays through the AV display machine's speakers
- [ ] Next Turn — combat overlay advances to the next combatant
- [ ] Apply Preset — particles and color grade update on the AV display
- [ ] Companion variable `$(stage-manager:mood_percent)` updates in real time as mood changes
- [ ] Play FX Overlay — WebM loop appears on the AV display
- [ ] Stop FX Overlay — WebM loop stops cleanly
- [ ] Disconnect Stage Manager — connection feedback turns red without crashing Companion
- [ ] Reconnect Stage Manager — connection feedback turns green, variables restore
