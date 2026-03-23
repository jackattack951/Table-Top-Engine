import { useEffect } from 'react'
import { initSync } from './sync'

let syncInitialized = false

/**
 * Initialize Socket.io sync once, but only after the DM has passed the launch screen.
 * The `enabled` flag is false while the LaunchScreen is shown so no connection attempt
 * fires before the DM has confirmed their mode + network selection.
 *
 * In browser dev mode (npm run dev:cockpit), ws-stub is used automatically.
 * In Electron / LAN, connects to the real Socket.io server.
 */
export function useSocketConnection(serverUrl: string, enabled = true): void {
    useEffect(() => {
        if (!enabled) return
        if (syncInitialized) return
        syncInitialized = true
        initSync(serverUrl)
    }, [serverUrl, enabled])
}
