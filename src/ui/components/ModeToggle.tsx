import React from 'react'
import { useAppStore } from '../stores/app-store'
import type { AppMode } from '@core/types'

export function ModeToggle(): React.JSX.Element {
    const { appMode, setAppMode } = useAppStore((s) => ({
        appMode: s.appMode,
        setAppMode: s.setAppMode,
    }))

    function handleToggle(mode: AppMode) {
        // Intentionally requires a deliberate click — no accidental mode switches
        setAppMode(mode)
    }

    return (
        <div className="mode-toggle" role="group" aria-label="Application mode">
            <button
                id="mode-prep"
                className={`mode-toggle__btn${appMode === 'plan' ? ' active' : ''}`}
                onClick={() => handleToggle('plan')}
                aria-pressed={appMode === 'plan'}
            >
                Prep
            </button>
            <button
                id="mode-play"
                className={`mode-toggle__btn${appMode === 'play' ? ' active' : ''}`}
                onClick={() => handleToggle('play')}
                aria-pressed={appMode === 'play'}
            >
                Play
            </button>
        </div>
    )
}
