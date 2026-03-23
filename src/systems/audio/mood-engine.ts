/**
 * Mood Engine — Tone.js Transport-driven 3-layer audio system with breathing.
 * Architecture Rule 1: Tone.js ONLY in AV Display renderer. Never imported in cockpit.
 * Architecture Rule 2: Completely independent of video audio. Never syncs to video timecode.
 * Architecture Rule 10: Stem crossfades always scheduled ON THE DOWNBEAT (measure boundary).
 *
 * Signal chain (3 layers):
 *   [Ambience player] ─→ AmbienceGain ─→ AmbienceVol ──────────┐
 *                                                                 │
 *   [Calm player]     ─→ CalmGain     ─┐                        │
 *   [Tense player]    ─→ TenseGain    ─┼─→ MusicGain ─→ MusicVol ─┼─→ Master ─→ Destination
 *   [Dramatic player] ─→ DramaticGain ─┘                        │
 *                                                                 │
 *   [Breathing Timer] ── ramps AmbienceGain / MusicGain ─────────┘
 *   [User Volume]     ── AmbienceVol + MusicVol (user faders, independent of breathing)
 *
 * Breathing behavior:
 *   Calm/Tense:  5 min cycle, 1 min fade. Alternates which layer is dominant.
 *   Dramatic:    Breathing paused. Music dominant (1.0), ambience tucked (0.2).
 */
import * as Tone from 'tone'
import type { EnvironmentAudioConfig } from './audio-config'

export type MoodZone = 'calm' | 'tense' | 'dramatic'

/** Classify a 0–1 mood value into a zone. Single source of truth for the 0.35/0.65 thresholds. */
export function getMoodZone(value: number): MoodZone {
    if (value < 0.35) return 'calm'
    if (value > 0.65) return 'dramatic'
    return 'tense'
}

const DEFAULT_BPM = 80
const MEASURES_PER_CROSSFADE = 2   // schedule crossfade at next 2-measure boundary
const CROSSFADE_DURATION_S = 2.0   // seconds to blend between mood zones

// Breathing timer constants
const DEFAULT_BREATHING_HOLD_S = 5 * 60    // 5 minutes at each dominant phase
const BREATHING_FADE_S = 60        // 1 minute crossfade between phases
const AMBIENCE_DOMINANT_GAIN = 0.9
const AMBIENCE_TUCKED_GAIN = 0.15
const MUSIC_DOMINANT_GAIN = 0.9
const MUSIC_TUCKED_GAIN = 0.15
const DRAMATIC_AMBIENCE_GAIN = 0.2
const DRAMATIC_MUSIC_GAIN = 1.0

// Placeholder frequencies (used when no environment stems are loaded)
const ZONE_FREQUENCIES: Record<MoodZone, { freqs: number[]; type: OscillatorType; volume: number }> = {
    calm: { freqs: [220, 277.18, 329.63], type: 'sine', volume: -20 },
    tense: { freqs: [233.08, 349.23], type: 'triangle', volume: -22 },
    dramatic: { freqs: [196, 261.63, 392], type: 'sawtooth', volume: -18 },
}

type OscillatorSet = {
    oscs: Tone.Oscillator[]
    gains: Tone.Gain[]
}

export class MoodEngine {
    private calmOscs: OscillatorSet | null = null
    private dramaticOscs: OscillatorSet | null = null
    private ambiencePlayer: Tone.Player | null = null
    private calmPlayer: Tone.Player | null = null
    private tensePlayer: Tone.Player | null = null
    private dramaticPlayer: Tone.Player | null = null
    private ambienceGain: Tone.Gain | null = null
    private ambienceVol: Tone.Gain | null = null  // user volume fader (independent of breathing)
    private musicVol: Tone.Gain | null = null    // user volume fader for music (independent of breathing)
    private musicGain: Tone.Gain | null = null
    private calmGain: Tone.Gain | null = null
    private tenseGain: Tone.Gain | null = null
    private dramaticGain: Tone.Gain | null = null
    private master: Tone.Volume | null = null
    private running = false
    private targetZone: MoodZone = 'calm'
    private usingPlayers = false
    private activeEnvironmentId: string | null = null

    // Breathing state
    private breathingTimer: ReturnType<typeof setInterval> | null = null
    private ambienceDominant = true // true = ambience on top, false = music on top
    private breathingHoldS = DEFAULT_BREATHING_HOLD_S

    async init(): Promise<void> {
        await Tone.start()

        Tone.getTransport().bpm.value = DEFAULT_BPM
        Tone.getTransport().timeSignature = 4

        this.master = new Tone.Volume(-6).toDestination()

        // User volume faders (0–1, independent of breathing automation)
        this.ambienceVol = new Tone.Gain(1).connect(this.master)
        this.musicVol = new Tone.Gain(1).connect(this.master)

        // Layer gains — ambience and music are independent volume buses
        // AmbienceGain (breathing-controlled) → AmbienceVol (user fader) → Master
        // MusicGain (breathing-controlled) → MusicVol (user fader) → Master
        this.ambienceGain = new Tone.Gain(AMBIENCE_DOMINANT_GAIN).connect(this.ambienceVol)
        this.musicGain = new Tone.Gain(MUSIC_TUCKED_GAIN).connect(this.musicVol)

        // 3 mood gain nodes — all route through musicGain
        this.calmGain = new Tone.Gain(1).connect(this.musicGain)
        this.tenseGain = new Tone.Gain(0).connect(this.musicGain)
        this.dramaticGain = new Tone.Gain(0).connect(this.musicGain)

        // Start with oscillator placeholders
        this.calmOscs = this.buildOscillators('calm', this.calmGain)
        this.dramaticOscs = this.buildOscillators('dramatic', this.dramaticGain)

        Tone.getTransport().start()
        this.startOscillators(this.calmOscs)
        this.startOscillators(this.dramaticOscs)

        this.running = true

        // Start breathing cycle (ambience dominant first)
        this.startBreathing()
    }

    /**
     * Load an environment's audio stems (ambience + 3 moods).
     * Disposes oscillator placeholders on first successful load.
     */
    async loadEnvironment(config: EnvironmentAudioConfig): Promise<boolean> {
        if (!this.running || !this.calmGain) return false
        if (this.activeEnvironmentId === config.id) return true

        Tone.getTransport().bpm.value = config.bpm

        this.activeEnvironmentId = null
        this.disposePlayers()

        try {
            const [ambiencePlayer, calmPlayer, tensePlayer, dramaticPlayer] = await Promise.all([
                this.createPlayer(config.stems.ambience),
                this.createPlayer(config.stems.calm),
                this.createPlayer(config.stems.tense),
                this.createPlayer(config.stems.dramatic),
            ])

            if (!calmPlayer || !dramaticPlayer) {
                console.warn('[mood-engine] Failed to load required stems, keeping current state')
                return false
            }

            // Wire ambience → ambienceGain
            if (ambiencePlayer && this.ambienceGain) {
                ambiencePlayer.connect(this.ambienceGain)
            }

            // Wire mood stems → their gain nodes → musicGain
            calmPlayer.connect(this.calmGain)
            if (tensePlayer && this.tenseGain) tensePlayer.connect(this.tenseGain)
            dramaticPlayer.connect(this.dramaticGain!)

            // Dispose oscillator placeholders (first environment load)
            if (!this.usingPlayers) {
                this.disposeOscillators()
                this.usingPlayers = true
            }

            this.ambiencePlayer = ambiencePlayer
            this.calmPlayer = calmPlayer
            this.tensePlayer = tensePlayer
            this.dramaticPlayer = dramaticPlayer
            this.activeEnvironmentId = config.id

            // Start all players looping
            if (ambiencePlayer) ambiencePlayer.start()
            calmPlayer.start()
            dramaticPlayer.start()
            if (tensePlayer) tensePlayer.start()

            return true
        } catch (err) {
            console.error('[mood-engine] loadEnvironment error:', err)
            return false
        }
    }

    private async createPlayer(url: string): Promise<Tone.Player | null> {
        try {
            const player = new Tone.Player({
                url,
                loop: true,
                autostart: false,
            })
            await Tone.loaded()
            return player
        } catch (err) {
            console.warn(`[mood-engine] failed to load stem: ${url}`, err)
            return null
        }
    }

    private buildOscillators(zone: MoodZone, destination: Tone.InputNode): OscillatorSet {
        const cfg = ZONE_FREQUENCIES[zone]
        const oscs: Tone.Oscillator[] = []
        const gains: Tone.Gain[] = []

        for (const freq of cfg.freqs) {
            const osc = new Tone.Oscillator({ frequency: freq, type: cfg.type, volume: cfg.volume })
            const gain = new Tone.Gain(0)
            osc.connect(gain)
            gain.connect(destination)
            oscs.push(osc)
            gains.push(gain)
        }
        return { oscs, gains }
    }

    private startOscillators(set: OscillatorSet): void {
        for (const osc of set.oscs) osc.start()
    }

    private disposeOscillators(): void {
        for (const set of [this.calmOscs, this.dramaticOscs]) {
            if (!set) continue
            for (const osc of set.oscs) { osc.stop(); osc.dispose() }
            for (const gain of set.gains) { gain.dispose() }
        }
        this.calmOscs = null
        this.dramaticOscs = null
    }

    private disposePlayers(): void {
        for (const player of [this.ambiencePlayer, this.calmPlayer, this.tensePlayer, this.dramaticPlayer]) {
            if (!player) continue
            try { player.stop() } catch { /* may not be started */ }
            player.dispose()
        }
        this.ambiencePlayer = null
        this.calmPlayer = null
        this.tensePlayer = null
        this.dramaticPlayer = null
    }

    // ── Mood control ──────────────────────────────────────────────────────────

    /**
     * Update mood from value (0.0 = calm → 1.0 = dramatic).
     * Crossfade is scheduled on the next measure downbeat (Rule 10).
     */
    setMood(value: number): void {
        if (!this.running || !this.calmGain) return

        const zone = getMoodZone(value)
        if (zone === this.targetZone) return
        this.targetZone = zone

        const transport = Tone.getTransport()
        const nextBeat = `+${MEASURES_PER_CROSSFADE}m`

        transport.scheduleOnce((time: number) => {
            this.applyZone(zone, time)
        }, nextBeat)
    }

    private applyZone(zone: MoodZone, time: number): void {
        const d = CROSSFADE_DURATION_S
        const targets: Record<MoodZone, { calm: number; tense: number; dramatic: number }> = {
            calm:     { calm: 1, tense: 0, dramatic: 0 },
            tense:    { calm: 0, tense: 1, dramatic: 0 },
            dramatic: { calm: 0, tense: 0, dramatic: 1 },
        }
        const t = targets[zone]
        this.calmGain?.gain.rampTo(t.calm, d, time)
        this.tenseGain?.gain.rampTo(t.tense, d, time)
        this.dramaticGain?.gain.rampTo(t.dramatic, d, time)

        // Dramatic: pause breathing, snap to music dominant
        if (zone === 'dramatic') {
            this.stopBreathing()
            this.ambienceGain?.gain.rampTo(DRAMATIC_AMBIENCE_GAIN, d, time)
            this.musicGain?.gain.rampTo(DRAMATIC_MUSIC_GAIN, d, time)
        } else {
            // Returning from dramatic: resume breathing from ambience-dominant phase
            if (!this.breathingTimer) {
                this.ambienceDominant = true
                this.ambienceGain?.gain.rampTo(AMBIENCE_DOMINANT_GAIN, d, time)
                this.musicGain?.gain.rampTo(MUSIC_TUCKED_GAIN, d, time)
                this.startBreathing()
            }
        }
    }

    // ── Breathing timer ───────────────────────────────────────────────────────

    private startBreathing(): void {
        this.stopBreathing()
        this.ambienceDominant = true

        this.breathingTimer = setInterval(() => {
            this.breathe()
        }, (this.breathingHoldS + BREATHING_FADE_S) * 1000)
    }

    private stopBreathing(): void {
        if (this.breathingTimer) {
            clearInterval(this.breathingTimer)
            this.breathingTimer = null
        }
    }

    private breathe(): void {
        // Flip dominance
        this.ambienceDominant = !this.ambienceDominant

        if (this.ambienceDominant) {
            this.ambienceGain?.gain.rampTo(AMBIENCE_DOMINANT_GAIN, BREATHING_FADE_S)
            this.musicGain?.gain.rampTo(MUSIC_TUCKED_GAIN, BREATHING_FADE_S)
        } else {
            this.ambienceGain?.gain.rampTo(AMBIENCE_TUCKED_GAIN, BREATHING_FADE_S)
            this.musicGain?.gain.rampTo(MUSIC_DOMINANT_GAIN, BREATHING_FADE_S)
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    getActiveEnvironmentId(): string | null {
        return this.activeEnvironmentId
    }

    isUsingPlayers(): boolean {
        return this.usingPlayers
    }

    /** Set master volume (0–1). Converts to dB internally. */
    setMasterVolume(vol: number): void {
        const db = vol <= 0 ? -Infinity : 20 * Math.log10(vol) - 6
        this.master?.volume.rampTo(db, 0.2)
    }

    /** Set user ambience volume (0–1). Independent of breathing automation. */
    setAmbienceVolume(vol: number): void {
        this.ambienceVol?.gain.rampTo(vol, 0.1)
    }

    /** Set user music volume (0–1). Independent of breathing automation. */
    setMusicVolume(vol: number): void {
        this.musicVol?.gain.rampTo(vol, 0.1)
    }

    /** Update breathing hold duration (seconds). Restarts the timer preserving current phase. */
    setBreathingHold(seconds: number): void {
        if (seconds < 1) seconds = 1
        this.breathingHoldS = seconds
        // Restart the interval with the new duration, but keep current phase
        if (this.breathingTimer) {
            this.stopBreathing()
            this.breathingTimer = setInterval(() => {
                this.breathe()
            }, (this.breathingHoldS + BREATHING_FADE_S) * 1000)
        }
    }

    destroy(): void {
        if (!this.running) return
        this.running = false
        this.stopBreathing()
        Tone.getTransport().stop()

        this.disposeOscillators()
        this.disposePlayers()
        this.calmGain?.dispose()
        this.tenseGain?.dispose()
        this.dramaticGain?.dispose()
        this.ambienceGain?.dispose()
        this.ambienceVol?.dispose()
        this.musicVol?.dispose()
        this.musicGain?.dispose()
        this.master?.dispose()
        this.usingPlayers = false
    }
}
