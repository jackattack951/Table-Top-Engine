/**
 * GBPreviewColumn — Left column of the dashboard 3-column layout.
 *
 * Shows the Game Board preview area (placeholder until GB preview stream is wired
 * in a later sprint), Fog of War toggle + painting overlay, and enlarge button.
 * Sprint 10b (layout), Sprint 10h (fog painting).
 *
 * The FogOverlay component manages its own enlarged state — when enlarged,
 * it renders a fixed-position modal backdrop around the same canvas element,
 * preserving painted fog state across compact ↔ enlarged transitions.
 */
import React, { useCallback } from 'react'
import { useFogStore } from '../../stores/fog-store'
import { useSceneStore } from '../../stores/scene-store'
import { emitFogToggle } from '../../lib/sync'
import { getAssetFileUrl } from '../../hooks/use-assets'
import { FogOverlay, FOG_OPACITY, CANVAS_WIDTH, CANVAS_HEIGHT } from './fog-overlay'
import { FogControls } from './fog-controls'

export function GBPreviewColumn(): React.JSX.Element {
    const fogEnabled = useFogStore((s) => s.fogEnabled)
    const setFogEnabled = useFogStore((s) => s.setFogEnabled)
    const setEnlarged = useFogStore((s) => s.setEnlarged)

    const activeScene = useSceneStore((s) => s.activeScene)
    const sceneId = activeScene?.id ?? null

    const handleToggleFog = useCallback(() => {
        const next = !fogEnabled
        setFogEnabled(next)
        if (sceneId) {
            emitFogToggle({ sceneId, enabled: next })
        }
    }, [fogEnabled, setFogEnabled, sceneId])

    const handleReset = useCallback((mode: 'fog-all' | 'reveal-all') => {
        // Find the fog canvas via DOM query (the FogOverlay owns the canvas ref)
        const canvas = document.querySelector('.fog-overlay__canvas') as HTMLCanvasElement | null
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        if (mode === 'fog-all') {
            ctx.fillStyle = `rgba(0, 0, 0, ${FOG_OPACITY})`
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        }
    }, [])

    return (
        <div className="dashboard__column">
            <div className="section-label">Game Board Preview</div>

            {/* 16:9 preview area with fog overlay */}
            <div className="gb-preview__container">
                {activeScene?.gameboardAssetId ? (
                    <img
                        className="gb-preview__image"
                        src={getAssetFileUrl(activeScene.gameboardAssetId)}
                        alt={`Gameboard: ${activeScene.name}`}
                    />
                ) : (
                    <div className="dashboard-preview" role="img" aria-label="Game Board preview — no gameboard assigned">
                        <span>{sceneId ? 'No gameboard assigned' : 'Load a scene to preview'}</span>
                    </div>
                )}
                {fogEnabled && sceneId && <FogOverlay />}
            </div>

            {/* Fog of War controls */}
            <div className="gb-preview__fow">
                <div className="gb-preview__fow-header">
                    <span className="section-label">Fog of War</span>
                    <div className="gb-preview__fow-actions">
                        <button
                            className={`btn btn-ghost gb-preview__fow-toggle${fogEnabled ? ' active' : ''}`}
                            onClick={handleToggleFog}
                            disabled={!sceneId}
                            aria-pressed={fogEnabled}
                            aria-label={fogEnabled ? 'Disable fog of war' : 'Enable fog of war'}
                        >
                            {fogEnabled ? 'ON' : 'OFF'}
                        </button>
                        {fogEnabled && (
                            <button
                                className="btn btn-ghost gb-preview__enlarge-btn"
                                onClick={() => setEnlarged(true)}
                                aria-label="Enlarge fog painting view"
                            >
                                Enlarge
                            </button>
                        )}
                    </div>
                </div>

                {fogEnabled && sceneId && <FogControls onReset={handleReset} />}
            </div>
        </div>
    )
}
