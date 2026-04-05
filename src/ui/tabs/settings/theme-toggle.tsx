import React from 'react'
import { applyTheme, getSavedTheme } from '../../lib/appearance'
import { AppearanceToggle } from './appearance-toggle'

const THEME_OPTIONS = [
    { value: 'dark' as const, label: 'Dark' },
    { value: 'light' as const, label: 'Light' },
]

export function ThemeToggle(): React.JSX.Element {
    return (
        <AppearanceToggle
            options={THEME_OPTIONS}
            getCurrent={getSavedTheme}
            onSelect={applyTheme}
            ariaLabel="Theme"
        />
    )
}
