/**
 * Haptic feedback helper for companion mobile UI.
 * Wraps navigator.vibrate with a safety guard for environments where it's unavailable.
 */
export function vibrate(pattern: VibratePattern): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern)
    }
}
