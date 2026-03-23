/**
 * VerticalFader — Professional vertical slider component.
 * Sprint 18e: Groove + fill track with Dark Accent Cap handle.
 *
 * Supports unipolar (0→max) and bipolar (-1→+1, center-zero) modes.
 * Three height variants: short (120px), default (160px), tall (200px).
 */
import React, { useCallback, useId, useMemo } from 'react'

export interface VerticalFaderProps {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
    label?: string
    disabled?: boolean
    size?: 'short' | 'default' | 'tall'
    /** Bipolar mode: fill grows from center, center-zero marker visible. */
    bipolar?: boolean
    /** Format the value display. Defaults to percentage for unipolar, ±value for bipolar. */
    formatValue?: (value: number) => string
}

function defaultFormat(value: number, bipolar: boolean): string {
    if (bipolar) {
        const rounded = Math.round(value * 100)
        if (rounded === 0) return '0'
        return rounded > 0 ? `+${rounded}` : `${rounded}`
    }
    return `${Math.round(value * 100)}%`
}

export function VerticalFader({
    value,
    onChange,
    min = 0,
    max = 1,
    step = 0.01,
    label,
    disabled = false,
    size = 'default',
    bipolar = false,
    formatValue,
}: VerticalFaderProps): React.JSX.Element {
    const id = useId()

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(parseFloat(e.target.value))
        },
        [onChange],
    )

    // Fill percentage (from bottom for unipolar, from center for bipolar)
    const fillStyle = useMemo(() => {
        const range = max - min
        const normalized = (value - min) / range // 0–1
        if (bipolar) {
            // Center is at 50%. Fill grows from center toward top or bottom.
            const center = 50
            const offset = (normalized - 0.5) * 100
            if (offset >= 0) {
                return { bottom: `${center}%`, height: `${offset}%` }
            }
            return { bottom: `${center + offset}%`, height: `${-offset}%` }
        }
        return { bottom: '0%', height: `${normalized * 100}%` }
    }, [value, min, max, bipolar])

    const display = formatValue ? formatValue(value) : defaultFormat(value, bipolar)

    const sizeClass = size !== 'default' ? ` vfader--${size}` : ''
    const bipolarClass = bipolar ? ' vfader--bipolar' : ''
    const disabledClass = disabled ? ' vfader--disabled' : ''

    return (
        <div className={`vfader${sizeClass}${bipolarClass}${disabledClass}`}>
            {label && (
                <label className="vfader__label" htmlFor={id}>
                    {label}
                </label>
            )}
            <div className="vfader__track-wrap">
                {/* Groove (recessed track background) */}
                <div className="vfader__groove" />
                {/* Fill indicator */}
                <div className="vfader__fill" style={fillStyle} />
                {/* Native range input — rotated via CSS */}
                <input
                    id={id}
                    type="range"
                    className="vfader__input"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    disabled={disabled}
                    aria-label={label ?? 'Fader'}
                    aria-orientation="vertical"
                />
            </div>
            <span className="vfader__value">{display}</span>
        </div>
    )
}
