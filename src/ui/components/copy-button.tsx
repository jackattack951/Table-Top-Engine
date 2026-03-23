/**
 * CopyButton — reusable clipboard copy button with "Copied!" feedback.
 * Properly cleans up timer on unmount (CLAUDE.md Pitfall #2).
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'

interface CopyButtonProps {
    text: string
    className?: string
    label?: string
}

export function CopyButton({ text, className = 'btn btn-ghost', label = 'Copy' }: CopyButtonProps): React.JSX.Element {
    const [copied, setCopied] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => setCopied(false), 1500)
        }).catch(() => {
            // Clipboard API not available — ignore silently
        })
    }, [text])

    return (
        <button
            className={className}
            onClick={handleCopy}
            title={label}
            aria-label={label}
        >
            {copied ? 'Copied!' : 'Copy'}
        </button>
    )
}
