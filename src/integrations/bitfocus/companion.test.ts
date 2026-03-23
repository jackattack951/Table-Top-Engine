/**
 * Companion module unit tests.
 * Mocks socket.io-client so no real network connection is needed.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mock socket.io-client ────────────────────────────────────────────────────
// Must be defined before importing CompanionModule so the mock is in place.

const mockSocketEmit = vi.fn()
const mockSocketDisconnect = vi.fn()
const mockSocketOn = vi.fn()

const mockSocket = {
  emit: mockSocketEmit,
  disconnect: mockSocketDisconnect,
  on: mockSocketOn,
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

// Import after mock is registered
import { io } from 'socket.io-client'
import { CompanionModule } from './index'
import type { ModuleState } from './types'
import { EVENTS } from '@shared/socket-events'
import { ENVIRONMENT_PRESETS } from '@assets/presets/environment-presets'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate an inbound socket event by calling the handler registered with socket.on(). */
function simulateSocketEvent(eventName: string, data: unknown): void {
  const calls = (mockSocketOn as Mock).mock.calls
  for (const [registeredEvent, handler] of calls) {
    if (registeredEvent === eventName) {
      (handler as (d: unknown) => void)(data)
      return
    }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CompanionModule', () => {
  let module: CompanionModule

  beforeEach(() => {
    vi.clearAllMocks()
    module = new CompanionModule()
  })

  // 1. connect() calls io() with correct URL
  it('connect() calls io() with http://127.0.0.1:3000 by default', () => {
    module.connect()
    expect(io).toHaveBeenCalledWith('http://127.0.0.1:3000', expect.objectContaining({
      autoConnect: true,
      reconnection: true,
    }))
  })

  // 2. connect() with custom config uses that host/port
  it('connect() with custom config uses provided host and port', () => {
    module.connect({ host: '192.168.1.50', port: 4000 })
    expect(io).toHaveBeenCalledWith('http://192.168.1.50:4000', expect.any(Object))
  })

  // 3. disconnect() calls socket.disconnect()
  it('disconnect() calls socket.disconnect()', () => {
    module.connect()
    module.disconnect()
    expect(mockSocketDisconnect).toHaveBeenCalledOnce()
  })

  // 4. scene_load emits EVENTS.SCENE_LOAD with correct sceneId
  it('actions.scene_load.callback emits SCENE_LOAD with sceneId', () => {
    module.connect()
    module.actions['scene_load']!.callback({ options: { scene_id: 'abc' } })
    expect(mockSocketEmit).toHaveBeenCalledWith(EVENTS.SCENE_LOAD, { sceneId: 'abc' })
  })

  // 5. mood_set emits MOOD_UPDATE with value scaled to 0–1
  it('actions.mood_set.callback emits MOOD_UPDATE with value: 0.75 when input is 75', () => {
    module.connect()
    module.actions['mood_set']!.callback({ options: { value: 75 } })
    expect(mockSocketEmit).toHaveBeenCalledWith(EVENTS.MOOD_UPDATE, { value: 0.75 })
  })

  // 6. mood_set clamps at 0.0 for negative input
  it('actions.mood_set.callback clamps to 0.0 when value is -10', () => {
    module.connect()
    module.actions['mood_set']!.callback({ options: { value: -10 } })
    expect(mockSocketEmit).toHaveBeenCalledWith(EVENTS.MOOD_UPDATE, { value: 0.0 })
  })

  // 7. mood_set clamps at 1.0 for input above 100
  it('actions.mood_set.callback clamps to 1.0 when value is 110', () => {
    module.connect()
    module.actions['mood_set']!.callback({ options: { value: 110 } })
    expect(mockSocketEmit).toHaveBeenCalledWith(EVENTS.MOOD_UPDATE, { value: 1.0 })
  })

  // 8. mood_increment increases moodValue by the step
  it('actions.mood_increment.callback increases moodValue by 0.10 when step is 10', () => {
    module.connect()
    // Set baseline mood to 0.3 via mood_set
    module.actions['mood_set']!.callback({ options: { value: 30 } })
    vi.clearAllMocks()

    module.actions['mood_increment']!.callback({ options: { step: 10 } })

    expect(mockSocketEmit).toHaveBeenCalledWith(EVENTS.MOOD_UPDATE, {
      value: expect.closeTo(0.4, 5),
    })
    expect(module.getState().moodValue).toBeCloseTo(0.4, 5)
  })

  // 9. mood_increment clamps at 1.0 when already near max
  it('actions.mood_increment.callback clamps at 1.0 when moodValue is 0.95 and step is 10', () => {
    module.connect()
    module.actions['mood_set']!.callback({ options: { value: 95 } })
    vi.clearAllMocks()

    module.actions['mood_increment']!.callback({ options: { step: 10 } })

    expect(mockSocketEmit).toHaveBeenCalledWith(EVENTS.MOOD_UPDATE, { value: 1.0 })
    expect(module.getState().moodValue).toBe(1.0)
  })

  // 10. sfx_trigger maps spatial_x=0 → x=0.0, spatial_x=100 → x=1.0
  it('actions.sfx_trigger.callback maps spatial_x=0 to x=0.0', () => {
    module.connect()
    module.actions['sfx_trigger']!.callback({
      options: { clip_id: 'thunder', label: 'Thunder', volume: 80, loop: false, spatial_x: 0, spatial_y: 50 },
    })
    const emitted = mockSocketEmit.mock.calls.find(([event]) => event === EVENTS.SFX_TRIGGER)
    expect(emitted).toBeDefined()
    expect(emitted![1].spatial.x).toBe(0.0)
  })

  it('actions.sfx_trigger.callback maps spatial_x=100 to x=1.0', () => {
    module.connect()
    module.actions['sfx_trigger']!.callback({
      options: { clip_id: 'thunder', label: 'Thunder', volume: 80, loop: false, spatial_x: 100, spatial_y: 50 },
    })
    const emitted = mockSocketEmit.mock.calls.find(([event]) => event === EVENTS.SFX_TRIGGER)
    expect(emitted![1].spatial.x).toBe(1.0)
  })

  // 11. sfx_trigger maps spatial_y=50 → y=0.5
  it('actions.sfx_trigger.callback maps spatial_y=50 to y=0.5', () => {
    module.connect()
    module.actions['sfx_trigger']!.callback({
      options: { clip_id: 'thunder', label: 'Thunder', volume: 80, loop: false, spatial_x: 50, spatial_y: 50 },
    })
    const emitted = mockSocketEmit.mock.calls.find(([event]) => event === EVENTS.SFX_TRIGGER)
    expect(emitted![1].spatial.y).toBeCloseTo(0.5, 5)
  })

  // 12. preset_apply emits AV_PARTICLES, AV_COLORGRADE, and MOOD_UPDATE
  it('actions.preset_apply.callback emits AV_PARTICLES, AV_COLORGRADE, and MOOD_UPDATE', () => {
    module.connect()
    const firstPreset = ENVIRONMENT_PRESETS[0]!
    module.actions['preset_apply']!.callback({ options: { preset_id: firstPreset.id } })

    const emittedEvents = mockSocketEmit.mock.calls.map(([event]) => event)
    expect(emittedEvents).toContain(EVENTS.AV_PARTICLES)
    expect(emittedEvents).toContain(EVENTS.AV_COLORGRADE)
    expect(emittedEvents).toContain(EVENTS.MOOD_UPDATE)
  })

  // 13. getVariableValues returns correct mood_percent for moodValue=0.75
  it('getVariableValues() returns mood_percent "75" when moodValue is 0.75', () => {
    module.connect()
    module.actions['mood_set']!.callback({ options: { value: 75 } })
    const vars = module.getVariableValues()
    expect(vars['mood_percent']).toBe('75')
  })

  // 14. feedbacks.connection_status returns green bgcolor when connected
  it('feedbacks.connection_status.callback returns green bgcolor when connected', () => {
    const connectedState: ModuleState = {
      connected: true,
      moodValue: 0.3,
      activeSceneId: null,
      combatRound: 1,
      activeCombatantName: null,
      appMode: 'play',
    }
    const result = module.feedbacks['connection_status']!.callback(
      { options: {} },
      connectedState,
    )
    expect(result.bgcolor).toBe(0x00aa00)
    expect(result.text).toBe('LIVE')
  })

  // 15. Simulating incoming STATE_SYNC event updates moodValue in state
  it('incoming STATE_SYNC event updates moodValue in module state', () => {
    module.connect()

    simulateSocketEvent(EVENTS.STATE_SYNC, { moodValue: 0.8, activeSceneId: 'scene-1', appMode: 'play' })

    expect(module.getState().moodValue).toBeCloseTo(0.8, 5)
    expect(module.getState().activeSceneId).toBe('scene-1')
  })

  // 16. connect() emits CLIENT_JOIN with { room: 'cockpit' } on socket connect event
  it('connect() emits CLIENT_JOIN with { room: "cockpit" } when socket connects', () => {
    module.connect()

    // Simulate the socket 'connect' event firing
    simulateSocketEvent('connect', undefined)

    expect(mockSocketEmit).toHaveBeenCalledWith(EVENTS.CLIENT_JOIN, { room: 'cockpit' })
  })

  // 17. sfx_trigger emits SFX_TRIGGER with the file_path option as filePath
  it('actions.sfx_trigger.callback sends file_path option as filePath', () => {
    module.connect()
    module.actions['sfx_trigger']!.callback({
      options: {
        clip_id: 'thunder',
        file_path: '/assets/sfx/thunder.ogg',
        label: 'Thunder',
        volume: 90,
        loop: false,
        spatial_x: 50,
        spatial_y: 50,
      },
    })
    const emitted = mockSocketEmit.mock.calls.find(([event]) => event === EVENTS.SFX_TRIGGER)
    expect(emitted).toBeDefined()
    expect(emitted![1].filePath).toBe('/assets/sfx/thunder.ogg')
  })
})
