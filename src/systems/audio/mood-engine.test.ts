/**
 * MoodEngine tests.
 *
 * Tone.js requires a Web Audio context and cannot run in Node/Vitest.
 * We mock the entire 'tone' module so the engine's zone logic, early-return
 * guard, loadEnvironment lifecycle, and breathing timer are testable without real audio.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Tone.js mock ──────────────────────────────────────────────────────────────

const mockTransport = {
    bpm: { value: 0 },
    timeSignature: 4,
    start: vi.fn(),
    stop: vi.fn(),
    scheduleOnce: vi.fn(),
}

const mockVolume = {
    volume: { rampTo: vi.fn() },
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
}

const mockOscillator = {
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
}

/** Factory that creates distinct Gain mock instances, each with its own gain.rampTo spy */
function createMockGain() {
    return {
        gain: { rampTo: vi.fn() },
        connect: vi.fn().mockReturnThis(),
        dispose: vi.fn(),
    }
}

/** Track all created gain instances for assertion */
let gainInstances: ReturnType<typeof createMockGain>[] = []

const mockPlayer = {
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
}

vi.mock('tone', () => ({
    start: vi.fn().mockResolvedValue(undefined),
    getTransport: vi.fn(() => mockTransport),
    Volume: vi.fn(() => mockVolume),
    Oscillator: vi.fn(() => mockOscillator),
    Gain: vi.fn(() => {
        const g = createMockGain()
        gainInstances.push(g)
        return g
    }),
    Player: vi.fn(() => ({ ...mockPlayer })),
    loaded: vi.fn().mockResolvedValue(undefined),
    context: { rawContext: { decodeAudioData: vi.fn() } },
}))

// Import after mock is registered
const { MoodEngine } = await import('./mood-engine')

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeRunningEngine(): Promise<InstanceType<typeof MoodEngine>> {
    const engine = new MoodEngine()
    await engine.init()
    return engine
}

/** Standard test config with all 4 stems */
const forestConfig = {
    id: 'forest',
    label: 'Forest',
    bpm: 80,
    stems: {
        ambience: '/audio/stems/forest/forest-ambience.wav',
        calm: '/audio/stems/forest/forest-calm.wav',
        tense: '/audio/stems/forest/forest-tense.wav',
        dramatic: '/audio/stems/forest/forest-dramatic.wav',
    },
}

const caveConfig = {
    id: 'cave',
    label: 'Cave',
    bpm: 70,
    stems: {
        ambience: '/audio/stems/cave/cave-ambience.ogg',
        calm: '/audio/stems/cave/cave-calm.ogg',
        tense: '/audio/stems/cave/cave-tense.ogg',
        dramatic: '/audio/stems/cave/cave-dramatic.ogg',
    },
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MoodEngine.setMood — zone boundaries', () => {
    beforeEach(() => {
        gainInstances = []
        mockTransport.scheduleOnce.mockClear()
    })

    it('value 0.0 → zone calm', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(1.0) // → dramatic (prime away from calm)
        mockTransport.scheduleOnce.mockClear()

        engine.setMood(0.0)
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)
    })

    it('value 0.34 → zone calm (below 0.35 threshold)', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(1.0) // prime to dramatic
        mockTransport.scheduleOnce.mockClear()

        engine.setMood(0.34)
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)
    })

    it('value 0.35 → zone tense (at lower boundary)', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(0.0) // prime to calm so tense is a new zone
        mockTransport.scheduleOnce.mockClear()

        engine.setMood(0.35)
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)
    })

    it('value 0.65 → zone tense (at upper boundary)', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(0.0) // prime to calm
        mockTransport.scheduleOnce.mockClear()

        engine.setMood(0.65)
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)
    })

    it('value 0.66 → zone dramatic (above 0.65 threshold)', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(0.0) // prime to calm (not dramatic)
        mockTransport.scheduleOnce.mockClear()

        engine.setMood(0.66)
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)
    })

    it('value 1.0 → zone dramatic', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(0.0) // prime to calm
        mockTransport.scheduleOnce.mockClear()

        engine.setMood(1.0)
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)
    })
})

describe('MoodEngine.setMood — early-return guard', () => {
    beforeEach(() => {
        gainInstances = []
        mockTransport.scheduleOnce.mockClear()
    })

    it('calling setMood with the same value twice does NOT re-schedule', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(1.0) // changes zone from initial 'calm' to 'dramatic'
        const callsAfterFirst = mockTransport.scheduleOnce.mock.calls.length

        engine.setMood(1.0) // same zone 'dramatic' — guard should return early
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(callsAfterFirst)
    })

    it('calling setMood with different same-zone value does NOT re-schedule', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(0.0) // → calm
        const callsAfterPrime = mockTransport.scheduleOnce.mock.calls.length

        engine.setMood(0.1) // → still calm
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(callsAfterPrime)
    })
})

describe('MoodEngine — zone boundary values (exact threshold verification)', () => {
    beforeEach(() => {
        gainInstances = []
        mockTransport.scheduleOnce.mockClear()
    })

    it('0.34 is below the 0.35 threshold and maps to calm, not tense', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(1.0) // start at dramatic
        mockTransport.scheduleOnce.mockClear()

        engine.setMood(0.34) // should transition → calm
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)

        // Calling 0.34 again stays calm — no extra schedule
        engine.setMood(0.34)
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)
    })

    it('0.35 is at the tense boundary and does not map to calm', async () => {
        const engine = await makeRunningEngine()
        engine.setMood(0.0)
        mockTransport.scheduleOnce.mockClear()

        engine.setMood(0.35) // → tense
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(1)

        // Calling 0.34 now should move to calm (different zone from tense)
        engine.setMood(0.34)
        expect(mockTransport.scheduleOnce).toHaveBeenCalledTimes(2)
    })
})

describe('MoodEngine — init and lifecycle', () => {
    beforeEach(() => {
        gainInstances = []
    })

    it('init starts oscillator placeholders by default', async () => {
        const engine = await makeRunningEngine()
        expect(engine.isUsingPlayers()).toBe(false)
        expect(engine.getActiveEnvironmentId()).toBeNull()
    })

    it('init creates 7 gain nodes (ambienceVol, musicVol, ambience, music, calm, tense, dramatic)', async () => {
        gainInstances = []
        await makeRunningEngine()
        // 7 layer gains + oscillator internal gains
        // First 7 Gain() calls: ambienceVol, musicVol, ambienceGain, musicGain, calmGain, tenseGain, dramaticGain
        expect(gainInstances.length).toBeGreaterThanOrEqual(7)
        // Each should be connected
        for (let i = 0; i < 7; i++) {
            expect(gainInstances[i].connect).toHaveBeenCalled()
        }
    })

    it('destroy cleans up without error', async () => {
        const engine = await makeRunningEngine()
        engine.destroy()
        // setMood after destroy is a no-op
        engine.setMood(1.0)
    })

    it('setMasterVolume ramps the master node (0–1 → dB)', async () => {
        const engine = await makeRunningEngine()
        engine.setMasterVolume(0.5)
        // 20 * log10(0.5) - 6 ≈ -12.02
        const call = mockVolume.volume.rampTo.mock.calls[0]
        expect(call[0]).toBeCloseTo(-12.02, 1)
        expect(call[1]).toBe(0.2)
    })
})

describe('MoodEngine — loadEnvironment', () => {
    beforeEach(() => {
        gainInstances = []
    })

    it('returns false before init', async () => {
        const engine = new MoodEngine()
        const result = await engine.loadEnvironment(forestConfig)
        expect(result).toBe(false)
    })

    it('loads environment and switches to player mode', async () => {
        const engine = await makeRunningEngine()
        const result = await engine.loadEnvironment(forestConfig)
        expect(result).toBe(true)
        expect(engine.isUsingPlayers()).toBe(true)
        expect(engine.getActiveEnvironmentId()).toBe('forest')
    })

    it('returns true without reloading same environment', async () => {
        const engine = await makeRunningEngine()
        await engine.loadEnvironment(caveConfig)
        const result = await engine.loadEnvironment(caveConfig) // same id
        expect(result).toBe(true)
    })

    it('updates transport BPM to match environment', async () => {
        const engine = await makeRunningEngine()
        await engine.loadEnvironment(caveConfig)
        expect(mockTransport.bpm.value).toBe(70)
    })
})

describe('MoodEngine — applyZone gain ramps', () => {
    beforeEach(() => {
        gainInstances = []
        mockTransport.scheduleOnce.mockClear()
        // Execute the scheduled callback immediately so we can inspect gain ramps
        mockTransport.scheduleOnce.mockImplementation((cb: unknown, _time: unknown) => {
            (cb as (time: number) => void)(0)
        })
    })

    it('switching to dramatic ramps dramatic gain to 1 and others to 0', async () => {
        const engine = await makeRunningEngine()
        // gainInstances: [0]=ambienceVol, [1]=musicVol, [2]=ambienceGain, [3]=musicGain, [4]=calmGain, [5]=tenseGain, [6]=dramaticGain
        const calmG = gainInstances[4]
        const tenseG = gainInstances[5]
        const dramaticG = gainInstances[6]

        engine.setMood(1.0) // → dramatic

        expect(calmG.gain.rampTo).toHaveBeenCalledWith(0, 2, 0)
        expect(tenseG.gain.rampTo).toHaveBeenCalledWith(0, 2, 0)
        expect(dramaticG.gain.rampTo).toHaveBeenCalledWith(1, 2, 0)
    })

    it('switching to tense ramps tense gain to 1 and others to 0', async () => {
        const engine = await makeRunningEngine()
        const calmG = gainInstances[4]
        const tenseG = gainInstances[5]
        const dramaticG = gainInstances[6]

        engine.setMood(0.5) // → tense

        expect(calmG.gain.rampTo).toHaveBeenCalledWith(0, 2, 0)
        expect(tenseG.gain.rampTo).toHaveBeenCalledWith(1, 2, 0)
        expect(dramaticG.gain.rampTo).toHaveBeenCalledWith(0, 2, 0)
    })

    it('switching to calm ramps calm gain to 1 and others to 0', async () => {
        const engine = await makeRunningEngine()
        const calmG = gainInstances[4]
        const tenseG = gainInstances[5]
        const dramaticG = gainInstances[6]

        // First move away from calm (initial zone)
        engine.setMood(1.0) // → dramatic
        // Clear rampTo calls from the dramatic transition
        calmG.gain.rampTo.mockClear()
        tenseG.gain.rampTo.mockClear()
        dramaticG.gain.rampTo.mockClear()

        engine.setMood(0.0) // → calm

        expect(calmG.gain.rampTo).toHaveBeenCalledWith(1, 2, 0)
        expect(tenseG.gain.rampTo).toHaveBeenCalledWith(0, 2, 0)
        expect(dramaticG.gain.rampTo).toHaveBeenCalledWith(0, 2, 0)
    })

    it('dramatic mode snaps ambience to 0.2 and music to 1.0', async () => {
        const engine = await makeRunningEngine()
        const ambienceG = gainInstances[2]
        const musicG = gainInstances[3]

        engine.setMood(1.0) // → dramatic

        expect(ambienceG.gain.rampTo).toHaveBeenCalledWith(0.2, 2, 0)
        expect(musicG.gain.rampTo).toHaveBeenCalledWith(1.0, 2, 0)
    })

    it('returning from dramatic resumes breathing with ambience dominant', async () => {
        const engine = await makeRunningEngine()
        const ambienceG = gainInstances[2]
        const musicG = gainInstances[3]

        // Go dramatic (stops breathing)
        engine.setMood(1.0)
        ambienceG.gain.rampTo.mockClear()
        musicG.gain.rampTo.mockClear()

        // Return to calm (resumes breathing, ambience dominant)
        engine.setMood(0.0)

        expect(ambienceG.gain.rampTo).toHaveBeenCalledWith(0.9, 2, 0) // AMBIENCE_DOMINANT_GAIN
        expect(musicG.gain.rampTo).toHaveBeenCalledWith(0.15, 2, 0)  // MUSIC_TUCKED_GAIN
    })
})

describe('MoodEngine — breathing timer', () => {
    beforeEach(() => {
        gainInstances = []
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('breathing timer flips dominance after hold + fade interval', async () => {
        const engine = await makeRunningEngine()
        const ambienceG = gainInstances[2]
        const musicG = gainInstances[3]

        // After init, ambience is dominant. Clear init ramps.
        ambienceG.gain.rampTo.mockClear()
        musicG.gain.rampTo.mockClear()

        // Advance past one breathing cycle (5 min hold + 1 min fade = 360s)
        vi.advanceTimersByTime(360 * 1000)

        // Should have flipped: music now dominant, ambience tucked
        expect(ambienceG.gain.rampTo).toHaveBeenCalledWith(0.15, 60) // AMBIENCE_TUCKED_GAIN
        expect(musicG.gain.rampTo).toHaveBeenCalledWith(0.9, 60)   // MUSIC_DOMINANT_GAIN
    })

    it('breathing timer flips back on second cycle', async () => {
        const engine = await makeRunningEngine()
        const ambienceG = gainInstances[2]
        const musicG = gainInstances[3]

        // Advance past two breathing cycles
        vi.advanceTimersByTime(360 * 1000 * 2)

        ambienceG.gain.rampTo.mockClear()
        musicG.gain.rampTo.mockClear()

        // Third cycle tick
        vi.advanceTimersByTime(360 * 1000)

        // Should be back to music dominant (odd cycle)
        expect(ambienceG.gain.rampTo).toHaveBeenCalledWith(0.15, 60) // AMBIENCE_TUCKED_GAIN
        expect(musicG.gain.rampTo).toHaveBeenCalledWith(0.9, 60)   // MUSIC_DOMINANT_GAIN
    })

    it('destroy stops the breathing timer', async () => {
        const engine = await makeRunningEngine()
        const ambienceG = gainInstances[2]

        engine.destroy()
        ambienceG.gain.rampTo.mockClear()

        // Advance past a breathing cycle — should NOT trigger ramps
        vi.advanceTimersByTime(360 * 1000)
        expect(ambienceG.gain.rampTo).not.toHaveBeenCalled()
    })
})
