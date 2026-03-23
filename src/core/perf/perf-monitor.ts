/**
 * Performance instrumentation — Sprint 7.
 * Collects metrics from different subsystems. Exposed via REST /api/perf.
 */

export interface PerfMetrics {
    timestamp: number
    wsLatency: number | null
    gpuMemoryUsage: number | null
    frameRate: number | null
    frameTime: number | null
    audioSchedulingDrift: number | null
    audioContextState: string | null
    cpuUsage: number | null
    heapUsed: number | null
    heapTotal: number | null
}

const metrics: PerfMetrics = {
    timestamp: Date.now(),
    wsLatency: null,
    gpuMemoryUsage: null,
    frameRate: null,
    frameTime: null,
    audioSchedulingDrift: null,
    audioContextState: null,
    cpuUsage: null,
    heapUsed: null,
    heapTotal: null,
}

/**
 * Update a single metric value. Also bumps the timestamp.
 * @param key - The metric field to update.
 * @param value - The new value for the field.
 */
export function updateMetric<K extends keyof PerfMetrics>(key: K, value: PerfMetrics[K]): void {
    metrics[key] = value
    metrics.timestamp = Date.now()
}

/**
 * Return a shallow copy of the current metrics snapshot.
 * Callers receive a copy — mutations do not affect the internal store.
 */
export function getMetrics(): PerfMetrics {
    return { ...metrics }
}

/**
 * Reset all metrics to their default null values.
 * Called on mode changes, session end, or in tests.
 */
export function resetMetrics(): void {
    metrics.timestamp = Date.now()
    metrics.wsLatency = null
    metrics.gpuMemoryUsage = null
    metrics.frameRate = null
    metrics.frameTime = null
    metrics.audioSchedulingDrift = null
    metrics.audioContextState = null
    metrics.cpuUsage = null
    metrics.heapUsed = null
    metrics.heapTotal = null
}
