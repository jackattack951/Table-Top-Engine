import React from 'react'
import { useMoodStore } from '../stores/mood-store'
import { useAppStore } from '../stores/app-store'
import { EVENTS } from '@shared/socket-events'
import { getSocket } from './sync'

/**
 * DevTestPanel — visible ONLY in development mode.
 * Provides buttons to verify the full Socket.io round-trip:
 *   cockpit → sync.ts → Socket.io → AV Display logs receipt
 *
 * Sprint 1 acceptance criterion: "Send Mood 0.8" appears in Electron console
 * as: [av-display] mood:update { value: 0.8 }
 */
export function DevTestPanel(): React.JSX.Element | null {
    if (!import.meta.env.DEV) return null

    const setMood = useMoodStore((s) => s.setValue)
    const isConnected = useAppStore((s) => s.isConnected)

    function sendMood() {
        setMood(0.8)
        console.log('[dev-test] setMood(0.8) fired — check AV Display console')
    }

    function sendSFXTest() {
        const socket = getSocket()
        socket?.emit(EVENTS.SFX_TRIGGER, { clipId: 'dev-test', spatial: { x: 0.5, y: 0.5 } })
        console.log('[dev-test] sfx:trigger fired — check AV Display console')
    }

    function sendSceneLoad() {
        const socket = getSocket()
        socket?.emit(EVENTS.SCENE_LOAD, { sceneId: 'dev-scene-001' })
        console.log('[dev-test] scene:load fired — check AV Display console')
    }

    return (
        <div className="dev-test-panel" role="region" aria-label="Developer test panel">
            <div className="dev-test-panel__title">⚡ Dev Test</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginBottom: '4px' }}>
                Socket: {isConnected ? '🟢 connected' : '🔴 offline (ws-stub)'}
            </div>
            <button id="dev-send-mood" className="dev-btn" onClick={sendMood}>
                Send Mood 0.8 →
            </button>
            <button id="dev-send-sfx" className="dev-btn" onClick={sendSFXTest}>
                SFX Trigger (centre) →
            </button>
            <button id="dev-send-scene" className="dev-btn" onClick={sendSceneLoad}>
                Scene Load (001) →
            </button>
        </div>
    )
}
