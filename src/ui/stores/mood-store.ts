import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v))
}

interface MoodState {
    value: number                     // 0.0–1.0 mood slider
    environmentId: string | null      // active audio environment (Sprint 17c)
    masterVolume: number              // 0.0–1.0 master output volume
    ambienceVolume: number            // 0.0–1.0 ambience master volume
    musicVolume: number               // 0.0–1.0 music (mood stems) volume
    sfxVolume: number                 // 0.0–1.0 SFX master volume
    bgVideoVolume: number             // 0.0–1.0 background video volume
    gbVideoVolume: number             // 0.0–1.0 gameboard video volume
    breathingHoldS: number            // breathing hold duration in seconds
    setValue: (value: number) => void
    setEnvironmentId: (id: string | null) => void
    setMasterVolume: (vol: number) => void
    setAmbienceVolume: (vol: number) => void
    setMusicVolume: (vol: number) => void
    setSfxVolume: (vol: number) => void
    setBgVideoVolume: (vol: number) => void
    setGbVideoVolume: (vol: number) => void
    setBreathingHoldS: (seconds: number) => void
}

export const useMoodStore = create<MoodState>()(
    subscribeWithSelector((set) => ({
        value: 0.3,
        environmentId: null,
        masterVolume: 0.8,
        ambienceVolume: 0.7,
        musicVolume: 0.7,
        sfxVolume: 0.7,
        bgVideoVolume: 0.5,
        gbVideoVolume: 0.5,
        breathingHoldS: 300,
        setValue: (value) => set({ value: clamp01(value) }),
        setEnvironmentId: (environmentId) => set({ environmentId }),
        setMasterVolume: (masterVolume) => set({ masterVolume: clamp01(masterVolume) }),
        setAmbienceVolume: (ambienceVolume) => set({ ambienceVolume: clamp01(ambienceVolume) }),
        setMusicVolume: (musicVolume) => set({ musicVolume: clamp01(musicVolume) }),
        setSfxVolume: (sfxVolume) => set({ sfxVolume: clamp01(sfxVolume) }),
        setBgVideoVolume: (bgVideoVolume) => set({ bgVideoVolume: clamp01(bgVideoVolume) }),
        setGbVideoVolume: (gbVideoVolume) => set({ gbVideoVolume: clamp01(gbVideoVolume) }),
        setBreathingHoldS: (breathingHoldS) => set({ breathingHoldS }),
    }))
)
