import React, { useState } from 'react'

interface AppearanceToggleOption<T extends string> {
    value: T
    label: string
}

interface AppearanceToggleProps<T extends string> {
    options: AppearanceToggleOption<T>[]
    getCurrent: () => T
    onSelect: (value: T) => void
    ariaLabel: string
}

export function AppearanceToggle<T extends string>({
    options,
    getCurrent,
    onSelect,
    ariaLabel,
}: AppearanceToggleProps<T>): React.JSX.Element {
    const [current, setCurrent] = useState<T>(getCurrent)

    function handleSelect(next: T): void {
        onSelect(next)
        setCurrent(next)
    }

    return (
        <div className="appearance-toggle" role="group" aria-label={ariaLabel}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    className={`btn btn-ghost appearance-toggle__btn${current === opt.value ? ' appearance-toggle__btn--active' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                    aria-pressed={current === opt.value}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}
