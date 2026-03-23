# Ambient Audio Production Guide

> Working document for producing the 71 audio files needed for the Segmented Audio Engine.
> **Music tracks** generated via **Suno AI** — complete tracks, then manually segmented into Intro/Loop/Outro.
> **Ambience/foley tracks** sourced from **Freesound.org** and similar libraries.
> **SFX clips** sourced from **Freesound.org** and similar libraries.

---

## Audio Engine Architecture

### Segmented Track System

The mood engine uses a segmented playback approach with 3 independent layers:

```
[Ambience]  ──→ AmbienceGain ──────────────────────┐
                                                    │
[Intro/Loop/Outro] ──→ MusicGain ──────────────────┼──→ Master ──→ Destination
                                                    │
[SFX Soundboard]   ──→ SFX Bus (PannerNodes) ──────┘
```

**Layer 1 — Ambience** (always playing, loops endlessly)
The foley of the place. Birdsong, dripping water, crackling fire, crickets, waves. Tied to the **setting**, not the mood — it's the constant anchor that tells you WHERE you are. Changing mood does not change the ambience track. Changing setting does.

**Layer 2 — Music** (segmented playback, mood-reactive)
Each setting+mood combination has a complete musical track split into 3 files:

| Segment | Purpose | Playback |
|---|---|---|
| **Intro** | Musical entrance — establishes the mood | Plays once when this mood is selected |
| **Loop** | Core musical body — the sustained mood | Repeats indefinitely until mood changes |
| **Outro** | Musical exit — graceful resolution | Plays once when transitioning away from this mood |

**Layer 3 — SFX Soundboard** (independent, DM-triggered)
Short clips triggered in real-time. Every clip routes through a spatial PannerNode. Completely independent of the mood/ambience system.

### Playback Flow

```
DM selects [Setting: Forest] + [Mood: Tense]

  1. Forest ambience begins (or continues if already playing)
  2. forest-tense-intro.ogg plays once
  3. forest-tense-loop.ogg begins, repeats indefinitely

DM changes mood → [Mood: Dramatic]

  4. Current loop iteration finishes (or interrupted — see transition modes)
  5. forest-tense-outro.ogg begins playing
  6. 2 seconds before outro ends, forest-dramatic-intro.ogg begins (cross-dissolve)
  7. forest-dramatic-intro.ogg plays to completion
  8. forest-dramatic-loop.ogg begins, repeats indefinitely
```

### Transition Modes

| Mode | Behavior | Use Case |
|---|---|---|
| **Graceful** (default) | Finish current loop → Outro → 2s cross-dissolve → next Intro | Normal mood shifts during play |
| **Hard cut** | Immediate stop → next Intro (no outro, no dissolve) | DM override for dramatic moments (e.g., ambush trigger) |

### Setting Change vs. Mood Change

| Change | What happens |
|---|---|
| **Mood only** (e.g., Forest Calm → Forest Tense) | Ambience continues. Music transitions via Outro → cross-dissolve → new Intro → Loop. |
| **Setting only** (e.g., Forest Calm → Cave Calm) | Ambience crossfades to new setting's track. Music transitions via Outro → cross-dissolve → new setting's Intro → Loop. |
| **Both** (e.g., Forest Calm → Cave Dramatic) | Ambience crossfades. Music transitions via Outro → cross-dissolve → new Intro → Loop. |

### Cross-Dissolve Detail

The 2-second cross-dissolve overlaps the **tail** of the outgoing Outro with the **head** of the incoming Intro:

```
Outgoing:  [...loop...]  [────── Outro ──────]
                                        ╲╲╲╲╲╲  ← fade out (2s)
Incoming:                          [────── Intro ──────]  [── Loop ──→
                                   ╱╱╱╱╱╱  ← fade in (2s)
                                   ↑
                              cross-dissolve window
```

### Breathing Timer (Calm & Neutral only)

During Calm and Neutral moods, a breathing cycle slowly alternates which layer (ambience vs music) is dominant. Prevents listener fatigue during long sessions.

| Phase | Duration | AmbienceGain | MusicGain |
|---|---|---|---|
| Ambience dominant | ~5 min | 0.8 | 0.3 |
| Fade to music | ~1 min | 0.8 → 0.3 | 0.3 → 0.8 |
| Music dominant | ~5 min | 0.3 | 0.8 |
| Fade to ambience | ~1 min | 0.3 → 0.8 | 0.8 → 0.3 |
| *(repeat)* | | | |

| Mood | Breathing | AmbienceGain | MusicGain |
|---|---|---|---|
| **Calm** | Active | Alternates | Alternates |
| **Neutral** | Active | Alternates | Alternates |
| **Tense** | Paused | 0.5 | 0.8 |
| **Dramatic** | Paused | 0.2 | 1.0 |

When switching to Tense or Dramatic, breathing pauses immediately. Music takes and holds dominance. When mood returns to Calm or Neutral, breathing resumes from the ambience-dominant phase.

---

## 4 Moods — Design Intent

| Mood | Energy | Musical Character | When to Use |
|---|---|---|---|
| **Calm** | Lowest | Atmospheric, ambient, no rhythm. Spacious and meditative. | Downtime, long rests, peaceful exploration, campfire RP |
| **Neutral** | Low-mid | Light musical presence, gentle rhythm. The "default" score. | General exploration, travel, town wandering, NPC conversations |
| **Tense** | Mid-high | Dark pulse, unease, building pressure. Something is wrong. | Dungeon crawl, stealth, approaching danger, negotiations going south |
| **Dramatic** | Maximum | Full intensity, driving percussion, urgent. Combat energy. | Battle, chase, boss fight, catastrophic events |

**Why Neutral?** The old 3-mood system had a gap between "ambient pad" (Calm) and "something is wrong" (Tense). Neutral fills the middle — music that has presence and rhythm but no tension. It's the score for 80% of a session where nothing is calm enough for ambient pads but nothing is wrong enough for tension.

---

## Technical Requirements

### Music Tracks (Suno AI → Manual Segmentation)

| Property | Requirement | Why |
|---|---|---|
| **Format** | OGG Vorbis (.ogg) after segmentation | Native Chromium decode, gapless playback |
| **Generation format** | Highest quality Suno offers (WAV preferred) | Clean source for editing/segmentation |
| **Track length** | 3–5 minutes total (longer = more loop material) | Intro ~15-30s, Loop body ~2-3 min, Outro ~15-30s |
| **Structure** | Must have clear intro → sustained body → natural ending | Enables clean segmentation into 3 files |
| **BPM lock** | All 4 moods per setting share exact BPM | Cross-dissolve overlap sounds musical |
| **Key compatibility** | All 4 moods per setting in same or relative key | Avoids dissonance during cross-dissolve overlap |
| **Content** | Music ONLY — no nature sounds, no foley | Nature sounds are in the ambience layer |
| **No vocals** | Instrumental only | Voices distract from DM narration |

### Segmentation Process (Post-Suno, in DAW)

After generating a complete track in Suno:

1. **Import** the full track into Audacity/DAW
2. **Identify segments:**
   - **Intro:** From the start to where the main body begins looping. Usually 15–30 seconds. Ends at a clean musical boundary.
   - **Loop:** The core repeatable section. Must be seamless — the end flows back into the start. Usually 2–3 minutes. This is the bulk of the track.
   - **Outro:** From where the loop would end to the track's natural conclusion. Usually 15–30 seconds. Should resolve or wind down.
3. **Cut** at zero-crossings to avoid clicks
4. **Loop-point edit the Loop segment** — crossfade the last ~2s into the first ~2s for seamless repeat
5. **Add ~2s tail to Outro** — the cross-dissolve window. The Outro's last 2 seconds will overlap with the next Intro's first 2 seconds, so ensure the Outro fades naturally in its final 2 seconds.
6. **Normalize** each segment to -14 LUFS
7. **Export** each as OGG Vorbis (quality 6, ~160kbps)
8. **Verify Loop segment** — play on repeat 10+ minutes, listen for clicks/jumps at boundary

### Ambience Tracks (Freesound.org / Sound Libraries)

| Property | Requirement | Why |
|---|---|---|
| **Format** | OGG Vorbis (.ogg) | Consistent with music files |
| **Length** | 3–5 minutes (longer = better) | Longer loops are harder to notice repeating |
| **Looping** | Seamless — no obvious repeat point | Plays endlessly under everything |
| **Content** | Pure foley/nature — NO musical content | Must work under any mood without clashing |
| **License** | CC0 or CC-BY (attribution in credits) | Royalty-free for distribution |

### SFX Clips (Freesound.org / Sound Libraries)

| Property | Requirement | Why |
|---|---|---|
| **Format** | OGG Vorbis (.ogg) | Consistent format |
| **Length** | 1–10 sec (varies by clip) | Short, punchy, instant playback |
| **Loop clips** | Must loop seamlessly | Footsteps, campfire play continuously |
| **License** | CC0 or CC-BY | Royalty-free for distribution |

---

## File Structure (71 files total)

```
src/systems/audio/
├── stems/
│   ├── forest/
│   │   ├── forest-ambience.ogg          ← Freesound (foley: birds, wind, leaves)
│   │   ├── forest-calm-intro.ogg        ← Suno (segmented)
│   │   ├── forest-calm-loop.ogg         ← Suno (segmented)
│   │   ├── forest-calm-outro.ogg        ← Suno (segmented)
│   │   ├── forest-neutral-intro.ogg     ← Suno (segmented)
│   │   ├── forest-neutral-loop.ogg      ← Suno (segmented)
│   │   ├── forest-neutral-outro.ogg     ← Suno (segmented)
│   │   ├── forest-tense-intro.ogg       ← Suno (segmented)
│   │   ├── forest-tense-loop.ogg        ← Suno (segmented)
│   │   ├── forest-tense-outro.ogg       ← Suno (segmented)
│   │   ├── forest-dramatic-intro.ogg    ← Suno (segmented)
│   │   ├── forest-dramatic-loop.ogg     ← Suno (segmented)
│   │   └── forest-dramatic-outro.ogg    ← Suno (segmented)
│   ├── cave/
│   │   ├── cave-ambience.ogg
│   │   ├── cave-calm-intro.ogg
│   │   ├── cave-calm-loop.ogg
│   │   ├── cave-calm-outro.ogg
│   │   ├── cave-neutral-intro.ogg
│   │   ├── cave-neutral-loop.ogg
│   │   ├── cave-neutral-outro.ogg
│   │   ├── cave-tense-intro.ogg
│   │   ├── cave-tense-loop.ogg
│   │   ├── cave-tense-outro.ogg
│   │   ├── cave-dramatic-intro.ogg
│   │   ├── cave-dramatic-loop.ogg
│   │   └── cave-dramatic-outro.ogg
│   ├── tavern/
│   │   ├── tavern-ambience.ogg
│   │   ├── tavern-calm-intro.ogg
│   │   ├── tavern-calm-loop.ogg
│   │   ├── tavern-calm-outro.ogg
│   │   ├── tavern-neutral-intro.ogg
│   │   ├── tavern-neutral-loop.ogg
│   │   ├── tavern-neutral-outro.ogg
│   │   ├── tavern-tense-intro.ogg
│   │   ├── tavern-tense-loop.ogg
│   │   ├── tavern-tense-outro.ogg
│   │   ├── tavern-dramatic-intro.ogg
│   │   ├── tavern-dramatic-loop.ogg
│   │   └── tavern-dramatic-outro.ogg
│   ├── night/
│   │   ├── night-ambience.ogg
│   │   ├── night-calm-intro.ogg
│   │   ├── night-calm-loop.ogg
│   │   ├── night-calm-outro.ogg
│   │   ├── night-neutral-intro.ogg
│   │   ├── night-neutral-loop.ogg
│   │   ├── night-neutral-outro.ogg
│   │   ├── night-tense-intro.ogg
│   │   ├── night-tense-loop.ogg
│   │   ├── night-tense-outro.ogg
│   │   ├── night-dramatic-intro.ogg
│   │   ├── night-dramatic-loop.ogg
│   │   └── night-dramatic-outro.ogg
│   └── ocean/
│       ├── ocean-ambience.ogg
│       ├── ocean-calm-intro.ogg
│       ├── ocean-calm-loop.ogg
│       ├── ocean-calm-outro.ogg
│       ├── ocean-neutral-intro.ogg
│       ├── ocean-neutral-loop.ogg
│       ├── ocean-neutral-outro.ogg
│       ├── ocean-tense-intro.ogg
│       ├── ocean-tense-loop.ogg
│       ├── ocean-tense-outro.ogg
│       ├── ocean-dramatic-intro.ogg
│       ├── ocean-dramatic-loop.ogg
│       └── ocean-dramatic-outro.ogg
└── sfx/
    ├── thunder.ogg
    ├── door-creak.ogg
    ├── sword-clash.ogg
    ├── magic-burst.ogg
    ├── footsteps.ogg
    └── campfire.ogg
```

**Totals:** 5 ambience (Freesound) + 60 music segments (Suno, 5 settings × 4 moods × 3 segments) + 6 SFX (Freesound) = **71 OGG files**

---

## Environment Details & Music Track Prompts

### Design Philosophy

Each environment has **1 ambience file + 4 complete music tracks** (one per mood). Each music track is generated as a single cohesive piece in Suno, then manually segmented into Intro/Loop/Outro in a DAW.

**Critical:** Prompts should encourage tracks with clear musical structure — a distinct opening, a sustained body that can be cut into a repeatable loop, and a natural resolution/ending. Avoid prompts that produce flat, unchanging drones (except Calm) — the track needs enough structure to segment cleanly.

**Critical:** Music tracks must contain NO nature sounds or foley. The ambience layer provides that. If Suno produces birds in a forest track or waves in an ocean track, regenerate.

### Suno Prompt Strategy for Segmentable Tracks

Each mood prompt explicitly requests a track structure that supports segmentation:

- **"Clear intro passage"** — gives you a clean Intro segment
- **"Sustained, repeatable main section"** — gives you Loop material
- **"Natural resolution/ending"** — gives you an Outro segment

The Reference Track Workflow (generate a Theme first, use as audio reference for mood variants) still applies — all 4 moods per setting should share sonic DNA so cross-dissolves between them sound cohesive.

---

### 1. Forest (80 BPM, D minor)

**Setting:** Ancient woodland. Towering trees, dappled light, undergrowth. Could be enchanted, could be dangerous.

#### Ambience — `forest-ambience.ogg` (Freesound)

**Search terms:** forest ambience, woodland atmosphere, bird song forest, wind through trees

**Target sound:** Layered bed of birdsong (multiple species, not just one loop), gentle intermittent wind through leaves, occasional distant woodpecker or crow. No water unless very faint. Organic, alive, spacious. Should feel like standing still in an old-growth forest at midday.

**Avoid:** Rain, thunder, music, drones, human sounds, highway noise in background.

#### Music Tracks (Suno — Reference Track Workflow)

**Step 1 — Generate the Forest Theme** (reference track, not used in app)
```
Instrumental fantasy forest theme, 80 BPM, key of D minor. Organic
orchestral arrangement — flutes, low strings, harp arpeggios, soft
hand percussion. Deep and mysterious ancient woodland. Enchanted but
with an edge of danger. Celtic and fantasy influences. No nature
sounds, no vocals. Cinematic tabletop RPG music.
```
> Pick the best take. This becomes your **audio reference input** for all 4 mood tracks below.

**Step 2a — Forest Calm** (80 BPM, D minor) — *use Forest Theme as reference audio*
```
Stripped back, ambient version. Keep the same instruments and harmonic
palette but remove all percussion and rhythm. Begin with a clear intro
passage — a single instrument emerging gently. Settle into a sustained,
repeatable ambient section of gentle pads, distant flute-like melody,
soft harp texture. End with a natural resolution that winds down
gracefully. Peaceful and spacious. Like the theme heard from far away
through the trees. No percussion, no nature sounds, no vocals.
```

**Step 2b — Forest Neutral** (80 BPM, D minor) — *use Forest Theme as reference audio*
```
Gentle, present version. Same instruments and harmonic palette with
light rhythm — soft hand percussion, unhurried pace. Begin with a
clear intro that introduces the melody. Settle into a sustained main
section with a flowing, repeatable groove — melodic but not intense.
End with a natural wind-down. The everyday sound of the forest — not
peaceful enough to be ambient, not dark enough to be tense. Warm
and grounded. No nature sounds, no vocals.
```

**Step 2c — Forest Tense** (80 BPM, D minor) — *use Forest Theme as reference audio*
```
Dark, unsettling version. Same harmonic DNA but shifted darker. Begin
with a clear intro — tension building from silence. Settle into a
sustained, repeatable section of low pulsing bass drone, eerie bowed
strings, subtle ticking rhythm. End with a passage that releases the
tension downward. The theme twisted into something watchful and uneasy.
Creeping dread. No nature sounds, no vocals.
```

**Step 2d — Forest Dramatic** (80 BPM, D minor) — *use Forest Theme as reference audio*
```
Full intensity battle version. Same melodic and harmonic identity
driven to maximum energy. Begin with a powerful intro — the theme
erupting into action. Settle into a sustained, repeatable main section
of tribal war drums, organic percussion — wood and skin not metal.
Aggressive low strings, primal urgent rhythm. End with a decisive
resolution passage. The theme unleashed. No nature sounds, no vocals.
```

---

### 2. Cave (70 BPM, E minor)

**Setting:** Underground. Natural cavern, mine, or dungeon entrance. Echoing, dark, claustrophobic.

#### Ambience — `cave-ambience.ogg` (Freesound)

**Search terms:** cave ambience, underground dripping, cavern atmosphere, dungeon sounds

**Target sound:** Irregular water drips with natural reverb (different distances, different pitches), subtle distant echoing, occasional stone settling/shifting sound. Very sparse — the silence between sounds matters. Deep, hollow acoustic space. Should feel like standing in a vast dark cavern with a torch.

**Avoid:** Music, bats (too cliche unless subtle), rushing water (too loud/active), mechanical sounds.

#### Music Tracks (Suno — Reference Track Workflow)

**Step 1 — Generate the Cave Theme** (reference track, not used in app)
```
Instrumental dark fantasy dungeon theme, 70 BPM, key of E minor.
Cavernous reverb on everything. Deep drones, hollow metallic textures,
distant percussive echoes. E Phrygian darkness. Feels massive and
underground. Gothic, ominous, ancient. No water sounds, no nature
sounds, no vocals. Cinematic dark fantasy tabletop RPG music.
```
> Pick the best take. This becomes your **audio reference input** for all 4 mood tracks below.

**Step 2a — Cave Calm** (70 BPM, E minor) — *use Cave Theme as reference audio*
```
Stripped back, cavernous ambient version. Keep the same hollow reverb
and harmonic palette but remove all rhythm. Begin with a clear intro —
a deep tone emerging from silence. Settle into a sustained, repeatable
section of deep low drone, distant reverberant tones, ethereal pads.
End with a passage that dissolves into the void. Vast empty space.
Meditative darkness. Like the theme echoing from deep below. No
percussion, no water sounds, no nature sounds, no vocals.
```

**Step 2b — Cave Neutral** (70 BPM, E minor) — *use Cave Theme as reference audio*
```
Present but restrained version. Same cavernous reverb and sonic palette
with light rhythmic texture — distant percussive echoes, subtle pulse.
Begin with a clear intro passage. Settle into a sustained, repeatable
main section — atmospheric with gentle forward motion. End with a
natural resolution. Underground exploration — cautious but not afraid.
The default sound of the deep. No water sounds, no nature sounds,
no vocals.
```

**Step 2c — Cave Tense** (70 BPM, E Phrygian) — *use Cave Theme as reference audio*
```
Oppressive, claustrophobic version. Same sonic palette pushed darker.
Begin with a clear intro — dread building from the dark. Settle into
a sustained, repeatable section of low rumbling bass tremor, echoing
metallic pulse, dissonant undertones. End with a passage that sinks
into oppressive silence. Something approaching in the dark. The theme
warped into dread. No water sounds, no nature sounds, no vocals.
```

**Step 2d — Cave Dramatic** (70 BPM, E minor) — *use Cave Theme as reference audio*
```
Full intensity underground battle version. Same cavernous reverb and
harmonic identity at maximum power. Begin with a powerful intro —
the cavern erupting. Settle into a sustained, repeatable main section
of massive war drums echoing through stone, aggressive bass, crashing
percussive impacts. End with a decisive resolution passage. The theme
erupting. Thundering and relentless. No water sounds, no nature sounds,
no vocals.
```

---

### 3. Tavern (90 BPM, G major)

**Setting:** Warm interior. Fireplace, wooden beams, crowded common room. Ale flowing. Could turn rowdy.

#### Ambience — `tavern-ambience.ogg` (Freesound)

**Search terms:** tavern ambience, pub atmosphere, medieval inn, fireplace crowd murmur

**Target sound:** Crackling fireplace (prominent), low crowd murmur/chatter (indistinct, no clear words), occasional clink of glass/ceramic, creak of wooden chairs. Warm, enclosed acoustic space. Should feel like sitting in the corner of a busy but not rowdy inn.

**Avoid:** Modern sounds (ice in glasses, espresso machines), identifiable music, laughing tracks that sound canned.

#### Music Tracks (Suno — Reference Track Workflow)

**Step 1 — Generate the Tavern Theme** (reference track, not used in app)
```
Instrumental medieval Celtic folk theme, 90 BPM, key of G major. Lute,
mandolin, fiddle, bodhrán. Warm and inviting with a mischievous edge.
Like a skilled bard's signature tune in a busy inn. Rich acoustic
arrangement, folk dance energy. No fire sounds, no crowd noise, no
vocals. Fantasy tavern music, tabletop RPG.
```
> Pick the best take. This becomes your **audio reference input** for all 4 mood tracks below.

**Step 2a — Tavern Calm** (90 BPM, G major) — *use Tavern Theme as reference audio*
```
Gentle, intimate version. Same instruments and melody but stripped
to just lute and soft mandolin arpeggios. Warm pad underneath. Begin
with a clear intro — a single lute emerging. Settle into a sustained,
repeatable section of gentle fingerpicking and soft melody. End with
a natural, unhurried resolution. Like the bard playing quietly after
hours, almost to himself. Cozy and unhurried. No fire sounds, no
crowd noise, no vocals.
```

**Step 2b — Tavern Neutral** (90 BPM, G major) — *use Tavern Theme as reference audio*
```
Cheerful, full arrangement version. Same instruments at comfortable
energy — lute, mandolin, light bodhrán. Begin with a clear intro that
brings the instruments in. Settle into a sustained, repeatable main
section — a warm, rolling folk groove. The default tavern sound. End
with a natural resolution. Convivial, social energy without intensity.
No fire sounds, no crowd noise, no vocals.
```

**Step 2c — Tavern Tense** (90 BPM, G minor) — *use Tavern Theme as reference audio*
```
Dark, suspicious version. Same folk instruments but shifted to minor
key. Begin with a clear intro — the mood turning. Settle into a
sustained, repeatable section of muted hand percussion, pizzicato
plucking, dark undertone. End with a passage that fades into uneasy
silence. The theme turned conspiratorial. Back-room deals, whispered
threats. The warmth has cooled. No fire sounds, no crowd noise,
no vocals.
```

**Step 2d — Tavern Dramatic** (90 BPM, G major) — *use Tavern Theme as reference audio*
```
Full intensity bar-fight version. Same melody and instruments at
maximum rowdy energy. Begin with a powerful intro — instruments
exploding into action. Settle into a sustained, repeatable main
section of aggressive fiddle, driving bodhrán, stomping beat. End
with a decisive conclusion. The theme exploded into chaos — the band
playing through a brawl. Celtic folk at full tilt. No crowd sounds,
no vocals.
```

---

### 4. Night (65 BPM, A minor)

**Setting:** Outdoor, after dark. Open sky, moonlight, camp on the road. The world is sleeping but not everything rests.

#### Ambience — `night-ambience.ogg` (Freesound)

**Search terms:** night ambience, crickets night, nighttime outdoors, owl distant, campsite night

**Target sound:** Steady cricket/insect chorus (layered, not a single loop), occasional distant owl hoot, very soft wind. Open acoustic space — you can hear far. Peaceful but with the vulnerability of being exposed at night. Should feel like sitting around a dying campfire at midnight.

**Avoid:** Traffic, dogs barking, rain, music, water (unless very distant stream).

#### Music Tracks (Suno — Reference Track Workflow)

**Step 1 — Generate the Night Theme** (reference track, not used in app)
```
Instrumental dark fantasy night theme, 65 BPM, key of A minor.
Shimmering celestial pads, slow haunting melody, distant horn-like
tones. Beautiful but vulnerable — the calm before something terrible.
Vast open sky feeling. Cinematic and contemplative with an undertow
of tension. No nature sounds, no insect sounds, no vocals. Dark
ambient fantasy, tabletop RPG music.
```
> Pick the best take. This becomes your **audio reference input** for all 4 mood tracks below.

**Step 2a — Night Calm** (65 BPM, C major) — *use Night Theme as reference audio*
```
Peaceful, stargazing version. Same shimmering pads and harmonic palette
but warmed to major key. Begin with a clear intro — gentle tones
emerging from stillness. Settle into a sustained, repeatable section
of spacious, meditative texture. End with a passage that fades into
quiet. Campfire dying, stars overhead. The slowest, most open
arrangement. No percussion, no nature sounds, no vocals.
```

**Step 2b — Night Neutral** (65 BPM, A minor) — *use Night Theme as reference audio*
```
Contemplative, present version. Same harmonic palette with light
rhythmic undertone — subtle pulse, gentle melodic movement. Begin
with a clear intro. Settle into a sustained, repeatable main section
— atmospheric but with a sense of journey. End with a natural wind-
down. Night travel, watch duty, campfire conversation. Present but
not tense. No nature sounds, no vocals.
```

**Step 2c — Night Tense** (65 BPM, A minor) — *use Night Theme as reference audio*
```
Paranoid, watchful version. Same melodic DNA but darker and more
unsettled. Begin with a clear intro — unease creeping in. Settle into
a sustained, repeatable section of low throbbing bass pulse, unsettling
harmonic shifts, distant eerie horn tone. End with a passage that
sinks into dread. The theme twisted — something watching from beyond
the firelight. No nature sounds, no vocals.
```

**Step 2d — Night Dramatic** (65 BPM, A minor) — *use Night Theme as reference audio*
```
Full intensity night ambush version. Same harmonic identity driven to
desperate, chaotic energy. Begin with a powerful intro — violence
erupting from the dark. Settle into a sustained, repeatable main
section of aggressive percussion, urgent string lines, storm-like
intensity. End with a decisive resolution. The theme shattered into
combat. The slowest battle music but the most oppressive and
suffocating. No nature sounds, no vocals.
```

---

### 5. Ocean (75 BPM, B minor)

**Setting:** Coastal or open water. Ship deck, rocky shore, sea cave mouth. Salt air, endless horizon.

#### Ambience — `ocean-ambience.ogg` (Freesound)

**Search terms:** ocean waves ambience, sea shore atmosphere, coastal waves, beach waves gentle

**Target sound:** Rolling waves with natural rhythm — not crashing surf, more like a moderate swell arriving and retreating on a pebble or sand beach. Occasional distant seagull. Wind present but not dominant. Deep, open acoustic space. Should feel like standing on a cliff overlooking the sea.

**Avoid:** Harbor sounds, boats, people, music, excessively loud surf that would dominate the mix.

#### Music Tracks (Suno — Reference Track Workflow)

**Step 1 — Generate the Ocean Theme** (reference track, not used in app)
```
Instrumental epic ocean fantasy theme, 75 BPM, key of B minor. Sweeping
orchestral arrangement with a heaving, tidal quality. Brass, strings,
and deep percussion. Majestic but dangerous — the sea as a living
force. Pirate adventure meets ancient leviathan. No wave sounds, no
nature sounds, no vocals. Cinematic fantasy, tabletop RPG music.
```
> Pick the best take. This becomes your **audio reference input** for all 4 mood tracks below.

**Step 2a — Ocean Calm** (75 BPM, D major) — *use Ocean Theme as reference audio*
```
Serene, horizon version. Same orchestral palette but stripped to airy
pads and shimmering texture. Warmed to major key. Begin with a clear
intro — a gentle swell of sound. Settle into a sustained, repeatable
section of gentle flowing melody with a swell-and-retreat quality.
End with a passage that recedes peacefully. The theme at peace — calm
seas, endless sky. No wave sounds, no nature sounds, no percussion,
no vocals.
```

**Step 2b — Ocean Neutral** (75 BPM, B minor) — *use Ocean Theme as reference audio*
```
Sailing, adventurous version. Same orchestral palette with moderate
energy — strings, light brass, gentle percussion. Begin with a clear
intro. Settle into a sustained, repeatable main section — a rolling,
seafaring groove with forward motion. End with a natural resolution.
Open water, fair wind, the journey itself. Present and warm without
urgency. No wave sounds, no nature sounds, no vocals.
```

**Step 2c — Ocean Tense** (75 BPM, B minor) — *use Ocean Theme as reference audio*
```
Ominous, deep water version. Same harmonic identity but darker and
heavier. Begin with a clear intro — darkness rising from below.
Settle into a sustained, repeatable section of deep underwater rumble,
dark brass drone, swelling tension that builds and recedes. End with
a passage that sinks into the depths. The ocean is vast and
indifferent. No wave sounds, no nature sounds, no vocals.
```

**Step 2d — Ocean Dramatic** (75 BPM, B minor) — *use Ocean Theme as reference audio*
```
Full intensity naval battle version. Same melodic and orchestral DNA
at maximum epic power. Begin with a powerful intro — the storm
breaking. Settle into a sustained, repeatable main section of massive
percussion, driving rhythm with a heaving quality. End with a decisive
resolution. The theme unleashed as a storm. Overwhelming, relentless,
awe-inspiring. No wave sounds, no nature sounds, no vocals.
```

---

## SFX Clips (6 files) — All sourced from Freesound.org

SFX are short, triggered by the DM in real-time. They layer ON TOP of both ambience and music. Each routes through a spatial PannerNode so the DM can position the sound in the room.

| # | File | Duration | Mode | Volume | Description | Freesound Search Terms |
|---|---|---|---|---|---|---|
| 1 | `thunder.ogg` | 2–4 sec | Oneshot | 0.9 | Deep rolling thunder. Builds, cracks, rolls away. Cinematic. | `thunder crack roll`, `thunder rumble cinematic` |
| 2 | `door-creak.ogg` | 1–2 sec | Oneshot | 0.7 | Heavy wooden door opening. Horror-quality creak. Drawn-out. | `door creak wood`, `old door opening horror` |
| 3 | `sword-clash.ogg` | 1–2 sec | Oneshot | 0.8 | Metal-on-metal impact. Single decisive clash, short ring-out. | `sword clash metal`, `sword impact ring` |
| 4 | `magic-burst.ogg` | 2–3 sec | Oneshot | 0.8 | Arcane energy release. Sparkle → whoosh → dissipation. Fantasy. | `magic spell burst`, `arcane energy whoosh fantasy` |
| 5 | `footsteps.ogg` | 3–5 sec | Loop | 0.5 | Boots on stone. Steady walking pace. Seamless loop. | `footsteps stone dungeon`, `boots walking stone loop` |
| 6 | `campfire.ogg` | 5–10 sec | Loop | 0.4 | Fire crackling. Pops, crackles, soft roar. Seamless loop. | `campfire crackling loop`, `fire crackle outdoor` |

---

## Suno AI Workflow & Tips

### Reference Track Method (How to Use This Doc)

Each environment follows a **2-step workflow**:

1. **Generate a Theme Track** — This establishes the sonic identity: instruments, harmonic palette, melodic character. Generate 3–5 takes, pick the one that best captures the environment. This track is NOT used in the app — it's your creative seed.

2. **Generate 4 Mood Tracks using the Theme as reference audio input** — In Suno, upload the Theme track as the audio reference/inspiration input. Then use the mood-specific prompt (2a, 2b, 2c, 2d) to steer the output. Suno will inherit the tonal DNA from the reference while reshaping it to match the mood prompt.

**Why this works:** All 4 mood tracks share the same instrumental palette, melodic motifs, and harmonic language because they're derived from the same parent track. Cross-dissolving between calm → neutral → tense → dramatic will sound like the same world shifting energy, not 4 different songs.

### General Settings
- Select **Instrumental** mode (no vocals)
- Extend to maximum duration when possible (longer = more loop material to work with)
- Generate 3–5 takes per prompt, pick the best one
- If Suno adds vocals despite the prompt, regenerate — don't try to edit them out

### Using Reference Audio Input
- Upload your chosen Theme track as the audio reference before entering the mood prompt
- The mood prompt should describe the **difference** from the theme, not repeat the full theme description
- Use phrases like "same instruments", "same harmonic palette", "same melodic DNA" to reinforce the connection
- If the output drifts too far from the theme, try a shorter/simpler mood prompt — let the reference do more work

### Prompting for Segmentable Structure
- Include phrases like "clear intro passage", "sustained main section", "natural resolution/ending"
- Avoid "suitable for seamless looping" (that was the old approach) — you WANT musical structure now
- The **Loop segment** seamlessness is achieved in post-processing, not in the Suno prompt
- Encourage words like "builds", "settles into", "resolves" to get tracks with arc

### Prompting for No Nature Sounds
- Explicitly say "no nature sounds, no [specific sound]" in every prompt
- Suno WILL add birdsong to forest prompts and waves to ocean prompts if you don't block it
- The ambience layer (Freesound) handles all foley — music tracks must be purely musical

### Key/BPM Consistency
- Always specify BPM and key in both the Theme and mood prompts
- Generate all tracks for one environment in the same session if possible
- If a track comes back in the wrong key, regenerate rather than pitch-shifting (introduces artifacts)

---

## Production Checklist

### Ambience Tracks (Freesound)
```
[ ] Forest ambience — birds, wind, leaves (3-5 min seamless loop)
[ ] Cave ambience — drips, echoes, stone (3-5 min seamless loop)
[ ] Tavern ambience — fireplace, crowd murmur, clinking (3-5 min seamless loop)
[ ] Night ambience — crickets, owl, soft wind (3-5 min seamless loop)
[ ] Ocean ambience — waves, distant gulls, wind (3-5 min seamless loop)
```

### Music Tracks (Suno → Segment in DAW)
```
Forest (80 BPM, D minor):
  [ ] Generate Forest Theme (reference track — pick best of 3-5 takes)
  [ ] Forest Calm — generate full track, segment into intro/loop/outro
  [ ] Forest Neutral — generate full track, segment into intro/loop/outro
  [ ] Forest Tense — generate full track, segment into intro/loop/outro
  [ ] Forest Dramatic — generate full track, segment into intro/loop/outro

Cave (70 BPM, E minor):
  [ ] Generate Cave Theme (reference track — pick best of 3-5 takes)
  [ ] Cave Calm — generate full track, segment into intro/loop/outro
  [ ] Cave Neutral — generate full track, segment into intro/loop/outro
  [ ] Cave Tense — generate full track, segment into intro/loop/outro
  [ ] Cave Dramatic — generate full track, segment into intro/loop/outro

Tavern (90 BPM, G major):
  [ ] Generate Tavern Theme (reference track — pick best of 3-5 takes)
  [ ] Tavern Calm — generate full track, segment into intro/loop/outro
  [ ] Tavern Neutral — generate full track, segment into intro/loop/outro
  [ ] Tavern Tense — generate full track, segment into intro/loop/outro
  [ ] Tavern Dramatic — generate full track, segment into intro/loop/outro

Night (65 BPM, A minor):
  [ ] Generate Night Theme (reference track — pick best of 3-5 takes)
  [ ] Night Calm — generate full track, segment into intro/loop/outro
  [ ] Night Neutral — generate full track, segment into intro/loop/outro
  [ ] Night Tense — generate full track, segment into intro/loop/outro
  [ ] Night Dramatic — generate full track, segment into intro/loop/outro

Ocean (75 BPM, B minor):
  [ ] Generate Ocean Theme (reference track — pick best of 3-5 takes)
  [ ] Ocean Calm — generate full track, segment into intro/loop/outro
  [ ] Ocean Neutral — generate full track, segment into intro/loop/outro
  [ ] Ocean Tense — generate full track, segment into intro/loop/outro
  [ ] Ocean Dramatic — generate full track, segment into intro/loop/outro
```

### SFX Clips (Freesound)
```
[ ] Thunder (2-4 sec oneshot)
[ ] Door Creak (1-2 sec oneshot)
[ ] Sword Clash (1-2 sec oneshot)
[ ] Magic Burst (2-3 sec oneshot)
[ ] Footsteps (3-5 sec seamless loop)
[ ] Campfire (5-10 sec seamless loop)
```

### Post-Processing — Segmentation
```
For each of the 20 music tracks:
  [ ] Import full Suno track into DAW
  [ ] Identify intro/body/outro boundaries
  [ ] Cut intro segment (typically 15-30 sec)
  [ ] Cut loop segment (typically 2-3 min) — crossfade loop point for seamless repeat
  [ ] Cut outro segment (typically 15-30 sec) — ensure last 2s fade naturally for cross-dissolve
  [ ] Normalize each segment to -14 LUFS
  [ ] Export each as OGG Vorbis (quality 6)
  [ ] Verify loop segment (10+ min continuous playback, no clicks at boundary)
```

### Post-Processing — Ambience & SFX
```
[ ] All 5 ambience files trimmed and loop-point edited
[ ] All 6 SFX files trimmed to tight duration
[ ] All 11 files normalized to -14 LUFS
[ ] All files converted to OGG Vorbis (quality 6)
[ ] All loop files verified (10+ min continuous playback)
```

### Final Verification
```
[ ] BPM verified consistent within each environment (4 music tracks match)
[ ] Key verified compatible within each environment
[ ] Cross-dissolve test: play Outro → Intro transitions for each mood pair within a setting
[ ] Breathing timer test: Calm/Neutral tracks sound natural when volume-ducked
[ ] Files placed in correct directory structure
[ ] Total: 5 ambience + 60 music segments + 6 SFX = 71 OGG files
```

### Code Changes Required
```
[ ] Update audio-config.ts — segmented track paths (intro/loop/outro per mood)
[ ] Add Neutral mood to mood types and UI
[ ] Rewrite MoodEngine — segmented playback (intro → loop → outro → cross-dissolve)
[ ] Implement cross-dissolve logic (2s overlap between outro tail and intro head)
[ ] Implement graceful vs hard-cut transition modes
[ ] Breathing timer — active for Calm/Neutral, paused for Tense/Dramatic
[ ] Atmosphere control card UI — setting buttons + 4 mood buttons
[ ] Volume sliders for ambience + music
[ ] Express static route for /audio/ directory
[ ] Update mood-engine tests for segmented architecture
[ ] Verify cross-dissolve between moods with real segments
[ ] Verify breathing timer behavior across mood changes
[ ] Run full test suite
```

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Track structure | Intro/Loop/Outro segments | Musical transitions instead of abrupt crossfades between loops |
| Segment source | Single complete Suno track, manually segmented | Preserves musicality — AI generates cohesive piece, human cuts it |
| 4 moods | Calm, Neutral, Tense, Dramatic | Neutral fills the gap between ambient pads (Calm) and suspense (Tense) |
| Cross-dissolve | 2-second overlap between Outro tail and next Intro head | Musical transition; adjustable later if needed |
| Transition modes | Graceful (default) + Hard cut (DM override) | Graceful for narrative flow, hard cut for sudden dramatic moments |
| Ambience layer | Separate, tied to setting not mood | Gives DM a constant sense of place; music can transition independently |
| Breathing timer | Calm/Neutral only, paused for Tense/Dramatic | Prevents loop fatigue during low-energy moods; combat must not duck |
| Music source | Suno AI (post-processed and segmented) | Fast generation, good quality, human controls the segmentation |
| Ambience source | Freesound.org / sound libraries | Pure foley — Suno is not suited for sound design |
| SFX source | Freesound.org / sound libraries | Short clips, better sourced than generated |
| Music content | NO nature sounds in music tracks | Ambience layer handles foley; doubling causes issues |
| Suno workflow | Reference track method — theme first, moods derived from it | All 4 moods share sonic DNA; cross-dissolves sound cohesive |
