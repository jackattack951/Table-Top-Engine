import React from 'react'
import { applyDensity, getSavedDensity } from '../../lib/appearance'
import { AppearanceToggle } from './appearance-toggle'

const DENSITY_OPTIONS = [
    { value: 'comfortable' as const, label: 'Comfortable' },
    { value: 'compact' as const, label: 'Compact' },
]

export function DensityToggle(): React.JSX.Element {
    return (
        <AppearanceToggle
            options={DENSITY_OPTIONS}
            getCurrent={getSavedDensity}
            onSelect={applyDensity}
            ariaLabel="Density"
        />
    )
}
