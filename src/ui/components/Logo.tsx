/**
 * Logo — inline SVG component for the Stage Manager logo.
 *
 * Theater spotlight beam with a D20 silhouette.
 * Uses currentColor so it inherits the parent's text color.
 *
 * NOTE: This is placeholder/temp branding. Replace with professional
 * branding assets when ready — the SVG and this component should be
 * swapped out together.
 */
import React from 'react'

interface LogoProps {
    size?: number
    className?: string
}

export function Logo({ size = 48, className }: LogoProps): React.JSX.Element {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            fill="none"
            width={size}
            height={size}
            className={className}
            aria-hidden="true"
        >
            {/* Spotlight housing */}
            <path d="M24 8h16l4 10H20L24 8z" fill="currentColor" opacity="0.9" />
            {/* Spotlight beam */}
            <path d="M22 18L10 56h44L42 18H22z" fill="currentColor" opacity="0.08" />
            <path d="M22 18L10 56h44L42 18" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
            {/* D20 face */}
            <polygon
                points="32,26 42,44 22,44"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                fill="currentColor"
                fillOpacity="0.15"
            />
            {/* D20 inner lines */}
            <line x1="32" y1="26" x2="27" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <line x1="32" y1="26" x2="37" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <line x1="22" y1="44" x2="37" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <line x1="42" y1="44" x2="27" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            {/* "20" label */}
            <text
                x="32"
                y="42"
                textAnchor="middle"
                fontFamily="system-ui"
                fontSize="8"
                fontWeight="700"
                fill="currentColor"
                opacity="0.7"
            >
                20
            </text>
            {/* Mounting bracket */}
            <rect x="28" y="4" width="8" height="5" rx="1" fill="currentColor" opacity="0.6" />
        </svg>
    )
}
