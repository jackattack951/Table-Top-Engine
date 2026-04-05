import React, { useState } from 'react'
import { applyDensity, getSavedDensity } from '../../lib/appearance'
import type { Density } from '../../lib/appearance'

export function DensityToggle(): React.JSX.Element {
    const [density, setDensity] = useState<Density>(getSavedDensity)

    function handleSelect(next: Density): void {
        applyDensity(next)
        setDensity(next)
    }

    return (
        <div className="appearance-toggle" role="group" aria-label="Density">
            <button
                className={`btn btn-ghost appearance-toggle__btn${density === 'comfortable' ? ' appearance-toggle__btn--active' : ''}`}
                onClick={() => handleSelect('comfortable')}
                aria-pressed={density === 'comfortable'}
            >
                Comfortable
            </button>
            <button
                className={`btn btn-ghost appearance-toggle__btn${density === 'compact' ? ' appearance-toggle__btn--active' : ''}`}
                onClick={() => handleSelect('compact')}
                aria-pressed={density === 'compact'}
            >
                Compact
            </button>
        </div>
    )
}
