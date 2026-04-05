import React, { useState } from 'react'
import { applyTheme, getSavedTheme } from '../../lib/appearance'
import type { Theme } from '../../lib/appearance'

export function ThemeToggle(): React.JSX.Element {
    const [theme, setTheme] = useState<Theme>(getSavedTheme)

    function handleSelect(next: Theme): void {
        applyTheme(next)
        setTheme(next)
    }

    return (
        <div className="appearance-toggle" role="group" aria-label="Theme">
            <button
                className={`btn btn-ghost appearance-toggle__btn${theme === 'dark' ? ' appearance-toggle__btn--active' : ''}`}
                onClick={() => handleSelect('dark')}
                aria-pressed={theme === 'dark'}
            >
                Dark
            </button>
            <button
                className={`btn btn-ghost appearance-toggle__btn${theme === 'light' ? ' appearance-toggle__btn--active' : ''}`}
                onClick={() => handleSelect('light')}
                aria-pressed={theme === 'light'}
            >
                Light
            </button>
        </div>
    )
}
