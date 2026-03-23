import { useEffect, useRef, useState } from 'react'

/**
 * Manages a popout/dropdown — open state, ref for container, outside-click dismissal.
 */
export function useClickOutside() {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    return { open, setOpen, ref }
}
