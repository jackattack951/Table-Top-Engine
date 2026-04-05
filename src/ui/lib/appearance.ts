/**
 * Appearance helpers — theme and density read/write.
 *
 * Theme and density are stored in localStorage and applied as data-attributes
 * on document.documentElement. They are separate from the Zustand settings
 * store so they can be applied before React hydrates (preventing FOCT).
 */

export type Theme = 'dark' | 'light'
export type Density = 'comfortable' | 'compact'

const THEME_KEY = 'stage-manager-theme'
const DENSITY_KEY = 'stage-manager-density'

export function getSavedTheme(): Theme {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' ? 'light' : 'dark'
}

export function getSavedDensity(): Density {
    const saved = localStorage.getItem(DENSITY_KEY)
    return saved === 'compact' ? 'compact' : 'comfortable'
}

export function applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
}

export function applyDensity(density: Density): void {
    document.documentElement.setAttribute('data-density', density)
    localStorage.setItem(DENSITY_KEY, density)
}
