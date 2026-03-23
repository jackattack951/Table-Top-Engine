import React, { useCallback, useEffect, useRef, useState } from 'react'
import { startPreview, stopPreview, onPreviewFrame } from '../lib/sync'
import type { PreviewFrameData } from '../lib/sync'

/**
 * AV Preview panel — displays real-time compressed frames from the AV Display.
 * Rendered inside the AV Tab. Demand-driven: only captures when the DM clicks Start.
 */
export function PreviewPanel(): React.JSX.Element {
    const [active, setActive] = useState(false)
    const [frameUrl, setFrameUrl] = useState<string | null>(null)
    const [fps, setFps] = useState(10)
    const [quality, setQuality] = useState(0.5)
    const prevUrlRef = useRef<string | null>(null)

    const handleFrame = useCallback((data: PreviewFrameData) => {
        // Revoke previous object URL to prevent memory leak
        if (prevUrlRef.current) {
            URL.revokeObjectURL(prevUrlRef.current)
        }
        const blob = new Blob([data.frame], { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        prevUrlRef.current = url
        setFrameUrl(url)
    }, [])

    useEffect(() => {
        if (active) {
            onPreviewFrame(handleFrame)
        } else {
            onPreviewFrame(null)
        }

        return () => {
            onPreviewFrame(null)
            if (prevUrlRef.current) {
                URL.revokeObjectURL(prevUrlRef.current)
                prevUrlRef.current = null
            }
        }
    }, [active, handleFrame])

    function handleStart() {
        setActive(true)
        startPreview({ fps, quality })
    }

    function handleStop() {
        setActive(false)
        stopPreview()
        setFrameUrl(null)
        if (prevUrlRef.current) {
            URL.revokeObjectURL(prevUrlRef.current)
            prevUrlRef.current = null
        }
    }

    return (
        <div className="av-section">
            <div className="av-section__label">AV Preview</div>

            <div className="preview-panel__frame">
                {frameUrl ? (
                    <img
                        src={frameUrl}
                        alt="AV Display preview"
                        draggable={false}
                    />
                ) : (
                    <span className="preview-panel__placeholder">
                        {active ? 'Waiting for frames…' : 'Click Start to preview AV output'}
                    </span>
                )}
            </div>

            <div className="preview-panel__controls">
                <div className="preview-panel__slider-group">
                    <span className="preview-panel__slider-label">FPS: {fps}</span>
                    <input
                        type="range"
                        className="range-slider"
                        min={5}
                        max={30}
                        step={1}
                        value={fps}
                        onChange={(e) => setFps(parseInt(e.target.value))}
                        disabled={active}
                        aria-label="Preview frames per second"
                    />
                </div>
                <div className="preview-panel__slider-group">
                    <span className="preview-panel__slider-label">Quality: {quality.toFixed(1)}</span>
                    <input
                        type="range"
                        className="range-slider"
                        min={0.1}
                        max={1}
                        step={0.1}
                        value={quality}
                        onChange={(e) => setQuality(parseFloat(e.target.value))}
                        disabled={active}
                        aria-label="Preview JPEG quality"
                    />
                </div>
            </div>

            <div className="preview-panel__actions">
                {!active ? (
                    <button
                        className="btn btn-ghost"
                        onClick={handleStart}
                        aria-label="Start AV preview"
                    >
                        Start Preview
                    </button>
                ) : (
                    <button
                        className="btn btn-ghost preview-panel__stop"
                        onClick={handleStop}
                        aria-label="Stop AV preview"
                    >
                        <span className="preview-panel__live-dot" />
                        Stop Preview
                    </button>
                )}
            </div>
        </div>
    )
}
