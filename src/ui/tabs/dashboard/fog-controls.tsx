/**
 * FogControls — brush size picker, reveal/conceal toggle, and reset button.
 * Sprint 10h.
 *
 * Reads and writes fog tool state via useFogStore.
 * Reset confirms before executing and fills/clears the canvas.
 */
import React, { useState } from 'react'
import { useFogStore, type BrushSize, type BrushMode } from '../../stores/fog-store'
import { useSceneStore } from '../../stores/scene-store'
import { emitFogReset, getServerUrl } from '../../lib/sync'

const BRUSH_OPTIONS: { id: BrushSize; label: string }[] = [
    { id: 'small', label: 'S' },
    { id: 'medium', label: 'M' },
    { id: 'large', label: 'L' },
]

const MODE_OPTIONS: { id: BrushMode; label: string }[] = [
    { id: 'reveal', label: 'Reveal' },
    { id: 'conceal', label: 'Conceal' },
]

interface FogControlsProps {
    onReset: (mode: 'fog-all' | 'reveal-all') => void
}

export function FogControls({ onReset }: FogControlsProps): React.JSX.Element {
    const brushSize = useFogStore((s) => s.brushSize)
    const brushMode = useFogStore((s) => s.brushMode)
    const setBrushSize = useFogStore((s) => s.setBrushSize)
    const setBrushMode = useFogStore((s) => s.setBrushMode)

    const activeScene = useSceneStore((s) => s.activeScene)
    const sceneId = activeScene?.id ?? null

    const [confirmReset, setConfirmReset] = useState<'fog-all' | 'reveal-all' | null>(null)

    function handleResetClick(mode: 'fog-all' | 'reveal-all'): void {
        if (confirmReset === mode) {
            // Confirmed — execute reset
            onReset(mode)
            setConfirmReset(null)

            if (sceneId) {
                emitFogReset({ sceneId })

                // Save cleared/filled state to DB
                const fogData = mode === 'reveal-all' ? null : undefined
                fetch(`${getServerUrl()}/api/scenes/${sceneId}/fog`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fogData, fogEnabled: true }),
                }).catch((err: unknown) => {
                    console.warn('[fog-controls] reset save failed:', err)
                })
            }
        } else {
            // First click — show confirmation
            setConfirmReset(mode)
            // Auto-cancel confirmation after 3 seconds
            setTimeout(() => setConfirmReset(null), 3000)
        }
    }

    return (
        <div className="fog-controls">
            {/* Brush size selector */}
            <div className="fog-controls__group">
                <span className="fog-controls__label">Brush</span>
                <div className="fog-controls__btn-group">
                    {BRUSH_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            className={`btn btn-ghost fog-controls__size-btn${brushSize === opt.id ? ' active' : ''}`}
                            onClick={() => setBrushSize(opt.id)}
                            aria-pressed={brushSize === opt.id}
                            aria-label={`Brush size: ${opt.id}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mode toggle */}
            <div className="fog-controls__group">
                <span className="fog-controls__label">Mode</span>
                <div className="fog-controls__btn-group">
                    {MODE_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            className={`btn btn-ghost fog-controls__mode-btn${brushMode === opt.id ? ' active' : ''}`}
                            onClick={() => setBrushMode(opt.id)}
                            aria-pressed={brushMode === opt.id}
                            aria-label={`Brush mode: ${opt.id}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Reset buttons */}
            <div className="fog-controls__group fog-controls__group--reset">
                <button
                    className={`btn btn-ghost fog-controls__reset-btn${confirmReset === 'fog-all' ? ' fog-controls__reset-btn--confirm' : ''}`}
                    onClick={() => handleResetClick('fog-all')}
                    aria-label={confirmReset === 'fog-all' ? 'Confirm: cover entire map with fog' : 'Fog entire map'}
                >
                    {confirmReset === 'fog-all' ? 'Confirm Fog All?' : 'Fog All'}
                </button>
                <button
                    className={`btn btn-ghost fog-controls__reset-btn${confirmReset === 'reveal-all' ? ' fog-controls__reset-btn--confirm' : ''}`}
                    onClick={() => handleResetClick('reveal-all')}
                    aria-label={confirmReset === 'reveal-all' ? 'Confirm: reveal entire map' : 'Reveal entire map'}
                >
                    {confirmReset === 'reveal-all' ? 'Confirm Reveal All?' : 'Reveal All'}
                </button>
            </div>
        </div>
    )
}
