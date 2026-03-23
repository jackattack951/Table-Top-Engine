import React, { useEffect, useState } from 'react'
import { getClientPerfSnapshot } from '../lib/perf-client'

/**
 * Lightweight developer HUD that overlays WebSocket latency and heap memory usage
 * in the bottom-left corner of the cockpit.
 *
 * Toggle visibility with Ctrl+Shift+P.
 * Hidden by default — zero visual impact during normal sessions.
 * aria-hidden so screen readers skip it entirely.
 */
export function PerfOverlay(): React.JSX.Element | null {
    const [visible, setVisible] = useState(false)
    const [metrics, setMetrics] = useState(getClientPerfSnapshot())

    useEffect(() => {
        if (!visible) return
        const interval = setInterval(() => {
            setMetrics(getClientPerfSnapshot())
        }, 2000)
        return () => clearInterval(interval)
    }, [visible])

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault()
                setVisible(v => !v)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    if (!visible) return null

    return (
        <div className="perf-overlay" aria-hidden="true">
            <div>WS: {metrics.wsLatency !== null ? `${metrics.wsLatency}ms` : '--'}</div>
            <div>Heap: {metrics.heapUsed !== null ? `${metrics.heapUsed}MB` : '--'}</div>
        </div>
    )
}
