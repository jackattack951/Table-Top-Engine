import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Scene } from '@core/types'

interface SceneState {
    activeScene: Scene | null
    cuedScene: Scene | null
    /** Cockpit-only preview — DM clicking around timeline. No AV impact. */
    previewScene: Scene | null
    setActiveScene: (scene: Scene | null) => void
    setCuedScene: (scene: Scene | null) => void
    /** Set the preview scene (DM browsing). Cockpit-only, no AV preload. */
    setPreviewScene: (scene: Scene | null) => void
    /**
     * Move cuedScene → activeScene, clear cuedScene + previewScene, then auto-cue next.
     * Pass the full scene list so autoCue can find the next scene by sortOrder.
     * No-op if cuedScene is null.
     */
    takeScene: (scenes: Scene[]) => void
    /** Auto-cue the next scene by sortOrder. Skips if active scene has branches. */
    autoCue: (scenes: Scene[]) => void
}

/** Find the next scene after `activeScene` by sortOrder. Returns null if last or has branches. */
function findNextCue(activeScene: Scene | null, scenes: Scene[]): Scene | null {
    if (!activeScene) return null
    if (activeScene.branches.length > 0) return null
    const sorted = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((s) => s.id === activeScene.id)
    return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null
}

export const useSceneStore = create<SceneState>()(
    subscribeWithSelector((set, get) => ({
        activeScene: null,
        cuedScene: null,
        previewScene: null,
        setActiveScene: (scene) => set({
            activeScene: scene,
            cuedScene: scene === null ? null : get().cuedScene,
            previewScene: scene === null ? null : get().previewScene,
        }),
        setCuedScene: (scene) => set({ cuedScene: scene }),
        setPreviewScene: (scene) => set({ previewScene: scene }),
        takeScene: (scenes) => {
            const { cuedScene } = get()
            if (!cuedScene) return
            // Clear preview + cue, promote cued → active
            set({ activeScene: cuedScene, cuedScene: null, previewScene: null })
            // Auto-cue after take — new active is the former cuedScene
            const next = findNextCue(cuedScene, scenes)
            if (next) set({ cuedScene: next })
        },
        autoCue: (scenes) => {
            const next = findNextCue(get().activeScene, scenes)
            set({ cuedScene: next })
        },
    }))
)
