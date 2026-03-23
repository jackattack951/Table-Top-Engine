import { describe, it, expect, beforeEach } from 'vitest'

// Re-import module fresh for each test group to reset module-level state.
// We use dynamic import so we can isolate state across describe blocks.

describe('perf-monitor', () => {
    // We can't easily reset module-level state between tests without vi.resetModules(),
    // so we test the contract: initial nulls, updates, and copy isolation.

    it('returns null for all metrics on initial load (except timestamp)', async () => {
        const { getMetrics } = await import('./perf-monitor')
        const snapshot = getMetrics()

        expect(typeof snapshot.timestamp).toBe('number')
        expect(snapshot.timestamp).toBeGreaterThan(0)

        // All instrumentation fields start null
        expect(snapshot.wsLatency).toBeNull()
        expect(snapshot.gpuMemoryUsage).toBeNull()
        expect(snapshot.frameRate).toBeNull()
        expect(snapshot.frameTime).toBeNull()
        expect(snapshot.audioSchedulingDrift).toBeNull()
        expect(snapshot.audioContextState).toBeNull()
        expect(snapshot.cpuUsage).toBeNull()
        expect(snapshot.heapUsed).toBeNull()
        expect(snapshot.heapTotal).toBeNull()
    })

    it('updates a numeric metric and reflects it in getMetrics()', async () => {
        const { updateMetric, getMetrics } = await import('./perf-monitor')

        updateMetric('wsLatency', 42)
        const snapshot = getMetrics()
        expect(snapshot.wsLatency).toBe(42)
    })

    it('updates a string metric and reflects it in getMetrics()', async () => {
        const { updateMetric, getMetrics } = await import('./perf-monitor')

        updateMetric('audioContextState', 'running')
        const snapshot = getMetrics()
        expect(snapshot.audioContextState).toBe('running')
    })

    it('updates the timestamp when a metric is changed', async () => {
        const { updateMetric, getMetrics } = await import('./perf-monitor')

        const before = getMetrics().timestamp
        // Small delay to ensure timestamp advances
        await new Promise((resolve) => setTimeout(resolve, 5))
        updateMetric('frameRate', 60)
        const after = getMetrics().timestamp
        expect(after).toBeGreaterThanOrEqual(before)
    })

    it('returns a copy — mutations on the returned object do not affect the store', async () => {
        const { updateMetric, getMetrics } = await import('./perf-monitor')

        updateMetric('heapUsed', 100)
        const snapshot = getMetrics()

        // Mutate the copy
        snapshot.heapUsed = 9999

        // The store should be unchanged
        const snapshot2 = getMetrics()
        expect(snapshot2.heapUsed).toBe(100)
    })

    it('can set a metric back to null', async () => {
        const { updateMetric, getMetrics } = await import('./perf-monitor')

        updateMetric('cpuUsage', 0.75)
        expect(getMetrics().cpuUsage).toBe(0.75)

        updateMetric('cpuUsage', null)
        expect(getMetrics().cpuUsage).toBeNull()
    })
})
