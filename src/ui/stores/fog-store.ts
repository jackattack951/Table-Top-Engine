/**
 * Fog of War Zustand store — Sprint 10g.
 * Tracks cockpit-side fog UI state (tool settings, enabled flag).
 * The actual fog bitmap lives in the Scene record (fogData) and is
 * managed by the AV Display renderer; this store tracks DM tool state only.
 */
import { create } from 'zustand'

export type BrushSize = 'small' | 'medium' | 'large'
export type BrushMode = 'reveal' | 'conceal'

interface FogStore {
    fogEnabled: boolean
    brushSize: BrushSize
    brushMode: BrushMode
    isEnlarged: boolean
    setFogEnabled: (enabled: boolean) => void
    setBrushSize: (size: BrushSize) => void
    setBrushMode: (mode: BrushMode) => void
    setEnlarged: (enlarged: boolean) => void
}

export const useFogStore = create<FogStore>()((set) => ({
    fogEnabled: false,
    brushSize: 'medium',
    brushMode: 'reveal',
    isEnlarged: false,
    setFogEnabled: (enabled) => set({ fogEnabled: enabled }),
    setBrushSize: (size) => set({ brushSize: size }),
    setBrushMode: (mode) => set({ brushMode: mode }),
    setEnlarged: (enlarged) => set({ isEnlarged: enlarged }),
}))
