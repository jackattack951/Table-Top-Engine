/**
 * TransportBar — Centered control strip above the scene timeline.
 *
 * Combines master volume popout, scene state indicators, and CUE/TAKE buttons
 * into a single compact bar. Replaces the old MasterFader strip and moves
 * CUE/TAKE out of the scrollable timeline where they were hard to find.
 *
 * Layout: [Master Vol] ─── [Preview: Scene Name | CUE] ─── [Cued: Scene Name | TAKE]
 */
import React, { useCallback } from 'react'
import { useMoodStore } from '../../stores/mood-store'
import { useOutputStore } from '../../stores/output-store'
import { useSceneStore } from '../../stores/scene-store'
import { loadScene } from '../../lib/sync'
import { useClickOutside } from '../../hooks/use-click-outside'
import { VerticalFader } from '../../components/vertical-fader'
import type { Scene } from '@core/types'

interface TransportBarProps {
    scenes: Scene[]
}

export function TransportBar({ scenes }: TransportBarProps): React.JSX.Element | null {
    const masterVolume = useMoodStore((s) => s.masterVolume)
    const setMasterVolume = useMoodStore((s) => s.setMasterVolume)
    const hasBGOutput = useOutputStore((s) => s.outputs.BG !== null)

    const activeScene = useSceneStore((s) => s.activeScene)
    const cuedScene = useSceneStore((s) => s.cuedScene)
    const previewScene = useSceneStore((s) => s.previewScene)
    const setCuedScene = useSceneStore((s) => s.setCuedScene)
    const setPreviewScene = useSceneStore((s) => s.setPreviewScene)
    const takeScene = useSceneStore((s) => s.takeScene)

    const { open: volOpen, setOpen: setVolOpen, ref: volRef } = useClickOutside()

    const handleVolChange = useCallback((vol: number) => setMasterVolume(vol), [setMasterVolume])

    const handleCue = useCallback(() => {
        if (!previewScene) return
        setCuedScene(previewScene)
        setPreviewScene(null)
    }, [previewScene, setCuedScene, setPreviewScene])

    const handleTake = useCallback(() => {
        const cued = cuedScene
        if (!cued) return
        takeScene(scenes)
        loadScene(cued.id)
    }, [cuedScene, takeScene, scenes])

    // Don't show if no active scene and no cued/preview
    if (!activeScene && !cuedScene && !previewScene && !hasBGOutput) return null

    const pct = Math.round(masterVolume * 100)
    const volIcon = masterVolume <= 0 ? '\u{1F507}' : '\u{1F50A}'
    const showCue = previewScene && previewScene.id !== cuedScene?.id
    const showTake = !!cuedScene

    return (
        <div className="transport-bar">
            {/* Left: Master volume */}
            {hasBGOutput && (
                <div className="transport-bar__vol" ref={volRef}>
                    <button
                        className="transport-bar__vol-trigger"
                        onClick={() => setVolOpen(!volOpen)}
                        aria-expanded={volOpen}
                        aria-label={`Master volume ${pct}%`}
                    >
                        <span aria-hidden="true">{volIcon}</span>
                        <span>Master {pct}%</span>
                    </button>
                    {volOpen && (
                        <div className="transport-bar__vol-dropdown">
                            <VerticalFader
                                value={masterVolume}
                                onChange={handleVolChange}
                                size="short"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Center: Scene state + transport controls */}
            <div className="transport-bar__center">
                {/* Preview indicator + CUE button */}
                {showCue && (
                    <div className="transport-bar__state transport-bar__state--preview">
                        <span className="transport-bar__state-label">Preview:</span>
                        <span className="transport-bar__state-name">{previewScene.name}</span>
                        <button
                            className="cue-btn transport-bar__cue-btn"
                            onClick={handleCue}
                            aria-label={`Cue: preload ${previewScene.name}`}
                        >
                            CUE
                        </button>
                    </div>
                )}

                {/* Cued indicator + TAKE button */}
                {showTake && (
                    <div className="transport-bar__state transport-bar__state--cued">
                        <span className="transport-bar__state-label">Cued:</span>
                        <span className="transport-bar__state-name">{cuedScene.name}</span>
                        <button
                            className="take-btn transport-bar__take-btn"
                            onClick={handleTake}
                            aria-label={`Take: load ${cuedScene.name}`}
                        >
                            TAKE
                        </button>
                    </div>
                )}

                {/* Empty state — nothing previewed or cued */}
                {!showCue && !showTake && activeScene && (
                    <span className="transport-bar__hint">Click a scene to preview</span>
                )}
            </div>
        </div>
    )
}
