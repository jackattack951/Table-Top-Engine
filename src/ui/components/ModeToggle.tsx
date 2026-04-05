import React from 'react'
import { useAppStore } from '../stores/app-store'

export function ModeToggle(): React.JSX.Element {
    const appMode = useAppStore((s) => s.appMode)
    const setAppMode = useAppStore((s) => s.setAppMode)

    return (
        <div className="mode-toggle" role="group" aria-label="Application mode">
            <button
                id="mode-prep"
                className={`mode-toggle__btn${appMode === 'plan' ? ' active' : ''}`}
                onClick={() => setAppMode('plan')}
                aria-pressed={appMode === 'plan'}
            >
                Prep
                <span className="mode-toggle__desc">Full editing</span>
            </button>
            <button
                id="mode-play"
                className={`mode-toggle__btn${appMode === 'play' ? ' active' : ''}`}
                onClick={() => setAppMode('play')}
                aria-pressed={appMode === 'play'}
            >
                Play
                <span className="mode-toggle__desc">Session mode</span>
            </button>
        </div>
    )
}
