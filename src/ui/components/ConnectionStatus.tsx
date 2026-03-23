import React from 'react'
import { useAppStore } from '../stores/app-store'

export function ConnectionStatus(): React.JSX.Element {
    const isConnected = useAppStore((s) => s.isConnected)

    return (
        <div
            className="connection-status"
            role="status"
            aria-label={isConnected ? 'Connected to server' : 'Not connected'}
            aria-live="polite"
        >
            <span className={`connection-status__dot${isConnected ? ' connected' : ''}`} />
            <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
    )
}
