import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ColorGrade, ParticleType } from '@core/types'

interface AVState {
    particles: { type: ParticleType; intensity: number }
    colorGrade: ColorGrade
    gbColorGrade: ColorGrade
    setParticles: (type: ParticleType, intensity: number) => void
    setColorGrade: (grade: Partial<ColorGrade>) => void
    setGBColorGrade: (grade: Partial<ColorGrade>) => void
}

const defaultColorGrade: ColorGrade = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: '#ffffff',
}

export const useAVStore = create<AVState>()(
    subscribeWithSelector((set) => ({
        particles: { type: 'none', intensity: 0 },
        colorGrade: defaultColorGrade,
        gbColorGrade: { ...defaultColorGrade },
        setParticles: (type, intensity) => set({ particles: { type, intensity } }),
        setColorGrade: (grade) =>
            set((state) => ({ colorGrade: { ...state.colorGrade, ...grade } })),
        setGBColorGrade: (grade) =>
            set((state) => ({ gbColorGrade: { ...state.gbColorGrade, ...grade } })),
    }))
)
