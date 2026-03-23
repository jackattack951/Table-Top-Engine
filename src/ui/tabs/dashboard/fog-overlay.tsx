/**
 * FogOverlay — HTML5 Canvas fog-painting overlay for the dashboard left column.
 * Sprint 10h.
 *
 * Renders semi-transparent black fog on a canvas that sits over the GB preview.
 * DM can paint (reveal/conceal) with configurable brush sizes.
 * Strokes are relayed via FOG_BRUSH for real-time AV Display updates.
 * Full bitmap is debounce-saved as base64 PNG via REST on stroke end.
 *
 * The canvas is always a single DOM element. When enlarged, it gets a CSS class
 * that makes it fill a fixed-position modal. This preserves canvas bitmap state
 * across compact ↔ enlarged transitions without remounting.
 *
 * Architecture Rule 1: HTML5 Canvas only — no PixiJS in the cockpit.
 */
import React, { useRef, useEffect, useCallback } from 'react'
import { useFogStore } from '../../stores/fog-store'
import { useSceneStore } from '../../stores/scene-store'
import { emitFogBrush, emitFogUpdate, getServerUrl } from '../../lib/sync'
import { getAssetFileUrl } from '../../hooks/use-assets'

// Brush radius in canvas pixels (at native resolution)
export const BRUSH_RADIUS: Record<'small' | 'medium' | 'large', number> = {
    small: 10,
    medium: 25,
    large: 50,
}

// Canvas native resolution — matches standard game board aspect ratio.
export const CANVAS_WIDTH = 1920
export const CANVAS_HEIGHT = 1080

// DM sees fog at 50% opacity for visibility
export const FOG_OPACITY = 0.5

export function FogOverlay(): React.JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isPainting = useRef(false)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const strokeBatchRef = useRef<Array<{ x: number; y: number; radius: number; reveal: boolean }>>([])

    const brushSize = useFogStore((s) => s.brushSize)
    const brushMode = useFogStore((s) => s.brushMode)
    const fogEnabled = useFogStore((s) => s.fogEnabled)
    const isEnlarged = useFogStore((s) => s.isEnlarged)
    const setEnlarged = useFogStore((s) => s.setEnlarged)
    const setFogEnabled = useFogStore((s) => s.setFogEnabled)
    const activeScene = useSceneStore((s) => s.activeScene)
    const sceneId = activeScene?.id ?? null

    // Load fog data from scene when scene changes or component mounts.
    // Syncs the fog store's fogEnabled toggle with the scene's persisted value.
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Sync fog store toggle with the new scene's persisted fog state
        if (activeScene) {
            setFogEnabled(activeScene.fogEnabled)
        }

        if (activeScene?.fogData) {
            const img = new Image()
            img.onload = () => {
                ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
                ctx.globalAlpha = FOG_OPACITY
                ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
                ctx.globalAlpha = 1.0
            }
            img.src = activeScene.fogData
        } else {
            // No fog data — start fully fogged (black)
            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            ctx.fillStyle = `rgba(0, 0, 0, ${FOG_OPACITY})`
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        }
    // Only reload when scene ID changes, not on every fogData update from our own saves
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeScene?.id])

    const toCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        const scaleX = CANVAS_WIDTH / rect.width
        const scaleY = CANVAS_HEIGHT / rect.height
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        }
    }, [])

    const paintAt = useCallback((x: number, y: number) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const radius = BRUSH_RADIUS[brushSize]
        const isReveal = brushMode === 'reveal'

        ctx.save()
        if (isReveal) {
            ctx.globalCompositeOperation = 'destination-out'
            ctx.globalAlpha = 1.0
        } else {
            ctx.globalCompositeOperation = 'source-over'
            ctx.globalAlpha = FOG_OPACITY
        }

        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = 'black'
        ctx.fill()
        ctx.restore()

        strokeBatchRef.current.push({
            x: x / CANVAS_WIDTH,
            y: y / CANVAS_HEIGHT,
            radius: radius / CANVAS_WIDTH,
            reveal: isReveal,
        })
    }, [brushSize, brushMode])

    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
            const canvas = canvasRef.current
            if (!canvas || !sceneId) return

            const offscreen = document.createElement('canvas')
            offscreen.width = CANVAS_WIDTH
            offscreen.height = CANVAS_HEIGHT
            const offCtx = offscreen.getContext('2d')
            if (!offCtx) return

            const srcCtx = canvas.getContext('2d')
            if (!srcCtx) return
            const imageData = srcCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            const data = imageData.data

            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0) {
                    data[i] = 0
                    data[i + 1] = 0
                    data[i + 2] = 0
                    data[i + 3] = 255
                } else {
                    data[i + 3] = 0
                }
            }

            offCtx.putImageData(imageData, 0, 0)
            const fogData = offscreen.toDataURL('image/png')

            fetch(`${getServerUrl()}/api/scenes/${sceneId}/fog`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fogData, fogEnabled }),
            }).catch((err: unknown) => {
                console.warn('[fog-overlay] save failed:', err)
            })

            emitFogUpdate({ sceneId, fogData })
        }, 500)
    }, [sceneId, fogEnabled])

    const flushStrokes = useCallback(() => {
        if (strokeBatchRef.current.length === 0 || !sceneId) return
        emitFogBrush({ sceneId, strokes: strokeBatchRef.current })
        strokeBatchRef.current = []
    }, [sceneId])

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        isPainting.current = true
        const { x, y } = toCanvasCoords(e)
        paintAt(x, y)
        canvasRef.current?.setPointerCapture(e.pointerId)
    }, [toCanvasCoords, paintAt])

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isPainting.current) return
        const { x, y } = toCanvasCoords(e)
        paintAt(x, y)
        flushStrokes()
    }, [toCanvasCoords, paintAt, flushStrokes])

    const handlePointerUp = useCallback(() => {
        isPainting.current = false
        flushStrokes()
        scheduleSave()
    }, [flushStrokes, scheduleSave])

    // Cleanup save timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        }
    }, [])

    // Close enlarged view on Escape key
    useEffect(() => {
        if (!isEnlarged) return
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setEnlarged(false)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isEnlarged, setEnlarged])

    if (!sceneId) {
        return (
            <div className="fog-overlay fog-overlay--empty">
                <p>Select a scene to paint fog</p>
            </div>
        )
    }

    return (
        <>
            {/* Backdrop shown only in enlarged mode */}
            {isEnlarged && (
                <div
                    className="fog-modal__backdrop"
                    onClick={() => setEnlarged(false)}
                    aria-hidden="true"
                />
            )}

            <div
                className={`fog-overlay${isEnlarged ? ' fog-overlay--enlarged' : ''}`}
                role={isEnlarged ? 'dialog' : undefined}
                aria-label={isEnlarged ? 'Enlarged fog painting view' : undefined}
                aria-modal={isEnlarged ? true : undefined}
            >
                {isEnlarged && (
                    <div className="fog-overlay__enlarged-header">
                        <span className="section-label">Fog of War — Enlarged</span>
                        <button
                            className="btn btn-ghost fog-overlay__close-btn"
                            onClick={() => setEnlarged(false)}
                            aria-label="Close enlarged view"
                        >
                            Close (Esc)
                        </button>
                    </div>
                )}
                <div className="fog-overlay__canvas-wrap">
                    {activeScene?.gameboardAssetId && (
                        <img
                            className="fog-overlay__gameboard-bg"
                            src={getAssetFileUrl(activeScene.gameboardAssetId)}
                            alt=""
                            aria-hidden="true"
                        />
                    )}
                    <canvas
                        ref={canvasRef}
                        className="fog-overlay__canvas"
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        aria-label="Fog of War painting canvas"
                    />
                </div>
            </div>
        </>
    )
}
