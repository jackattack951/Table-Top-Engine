/**
 * SFXPanel — SFX Soundboard section extracted from DashboardTab (Sprint 10b).
 * Updated Sprint 17c: uses SFX_CLIP_CONFIGS for real file paths.
 *
 * Self-contained: manages its own state internally, accesses no external props.
 * Uses Web Audio API via triggerSFX / stopSFX from sync.ts (Rule 11 — PannerNode).
 */
import React, { useState } from 'react'
import { triggerSFX, stopSFX } from '../../lib/sync'
import { SFX_CLIP_CONFIGS } from '@systems/audio/audio-config'
import type { SFXClip } from '@core/types'

type ClipMode = 'oneshot' | 'loop'

export function SFXPanel(): React.JSX.Element {
    const [modes, setModes] = useState<Record<string, ClipMode>>(
        Object.fromEntries(SFX_CLIP_CONFIGS.map((c) => [c.id, c.defaultMode])) as Record<string, ClipMode>
    )
    const [playing, setPlaying] = useState<Set<string>>(new Set())
    const [spatialX, setSpatialX] = useState(0.5)
    const [spatialY, setSpatialY] = useState(0.5)

    function stopClip(id: string) {
        stopSFX(id)
        setPlaying((prev) => {
            const s = new Set(prev)
            s.delete(id)
            return s
        })
    }

    function setMode(id: string, mode: ClipMode) {
        if (mode !== 'loop' && playing.has(id)) stopClip(id)
        setModes((prev) => ({ ...prev, [id]: mode }))
    }

    function handleTrigger(clipConfig: typeof SFX_CLIP_CONFIGS[number]) {
        const mode = modes[clipConfig.id]
        if (mode === 'loop' && playing.has(clipConfig.id)) {
            stopClip(clipConfig.id)
            return
        }
        const sfxClip: SFXClip = {
            id: clipConfig.id,
            label: clipConfig.label,
            filePath: clipConfig.filePath,
            loop: mode === 'loop',
            volume: clipConfig.volume,
            spatial: { x: spatialX, y: spatialY },
        }
        triggerSFX(sfxClip)
        if (mode === 'loop') setPlaying((prev) => new Set(prev).add(clipConfig.id))
    }

    return (
        <div className="sfx-panel">
            <div className="section-label">SFX Soundboard</div>

            {/* Spatial sliders */}
            <div className="sfx-panel__spatial">
                <div>
                    <label htmlFor="sfx-x" className="sfx-panel__slider-label">
                        Pan L {spatialX.toFixed(2)} R
                    </label>
                    <input
                        id="sfx-x"
                        type="range"
                        className="mood-slider"
                        min={0}
                        max={1}
                        step={0.01}
                        value={spatialX}
                        onChange={(e) => setSpatialX(parseFloat(e.target.value))}
                        aria-label="SFX pan"
                    />
                </div>
                <div>
                    <label htmlFor="sfx-y" className="sfx-panel__slider-label">
                        Depth F {spatialY.toFixed(2)} R
                    </label>
                    <input
                        id="sfx-y"
                        type="range"
                        className="mood-slider"
                        min={0}
                        max={1}
                        step={0.01}
                        value={spatialY}
                        onChange={(e) => setSpatialY(parseFloat(e.target.value))}
                        aria-label="SFX depth"
                    />
                </div>
            </div>

            {/* Clip trigger grid */}
            <div className="sfx-panel__grid">
                {SFX_CLIP_CONFIGS.map((clip) => {
                    const mode = modes[clip.id]
                    const isLoop = mode === 'loop'
                    const isPlaying = isLoop && playing.has(clip.id)
                    return (
                        <div key={clip.id} className="sfx-panel__clip">
                            <button
                                id={`sfx-${clip.id}`}
                                className={`particle-btn sfx-panel__trigger${isPlaying ? ' active' : ''}`}
                                onClick={() => handleTrigger(clip)}
                                aria-pressed={isPlaying}
                                aria-label={
                                    isLoop
                                        ? isPlaying
                                            ? `Stop ${clip.label}`
                                            : `Loop ${clip.label}`
                                        : `Play ${clip.label}`
                                }
                            >
                                <span>{clip.label}</span>
                                {isLoop && (
                                    <span className="sfx-panel__loop-hint">
                                        {isPlaying ? '◼ stop' : '↺ loop'}
                                    </span>
                                )}
                            </button>
                            <div className="sfx-panel__mode-toggle">
                                {(['oneshot', 'loop'] as ClipMode[]).map((m) => (
                                    <button
                                        key={m}
                                        className={`sfx-panel__mode-btn${mode === m ? ' active' : ''}`}
                                        onClick={() => setMode(clip.id, m)}
                                        aria-pressed={mode === m}
                                    >
                                        {m === 'oneshot' ? '1×' : '↺'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            <p className="sfx-panel__hint">
                <strong>1×</strong> plays once · <strong>↺</strong> toggles a loop · Spatial applies to next trigger
            </p>
        </div>
    )
}
