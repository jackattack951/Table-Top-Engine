import type { Socket } from 'socket.io-client'
import { EVENTS } from '@shared/socket-events'

let latencyInterval: ReturnType<typeof setInterval> | null = null
let currentLatency: number | null = null
let activeSocket: Socket | null = null

function handlePong(data: unknown): void {
    const { t } = data as { t: number }
    currentLatency = Math.round(performance.now() - t)
}

/**
 * Start measuring WebSocket round-trip latency.
 * Emits a PERF_PING every 5 seconds and records the RTT when PERF_PONG is received.
 * Uses the echoed timestamp to correctly correlate pings with pongs.
 * Safe to call multiple times — cleans up previous measurement first.
 *
 * @param socket - The connected Socket.io client instance.
 */
export function startLatencyMeasurement(socket: Socket): void {
    // Clean up any previous measurement (e.g. after reconnect)
    stopLatencyMeasurement()

    activeSocket = socket
    latencyInterval = setInterval(() => {
        socket.emit(EVENTS.PERF_PING, { t: performance.now() })
    }, 5000)
    socket.on(EVENTS.PERF_PONG, handlePong)
}

/**
 * Stop measuring WebSocket latency, clear interval, and remove the PONG listener.
 */
export function stopLatencyMeasurement(): void {
    if (latencyInterval) {
        clearInterval(latencyInterval)
        latencyInterval = null
    }
    if (activeSocket) {
        activeSocket.off(EVENTS.PERF_PONG, handlePong)
        activeSocket = null
    }
}

/**
 * Return a performance snapshot for the current client context.
 * Includes WebSocket latency and JS heap memory (Chromium-only; null elsewhere).
 */
export function getClientPerfSnapshot(): {
    wsLatency: number | null
    heapUsed: number | null
    heapTotal: number | null
} {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
    return {
        wsLatency: currentLatency,
        heapUsed: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null,
        heapTotal: mem ? Math.round(mem.totalJSHeapSize / 1024 / 1024) : null,
    }
}
