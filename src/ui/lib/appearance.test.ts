/**
 * Appearance helper tests — no DOM rendering (node env).
 * Stubs localStorage and document.documentElement to test
 * read/write logic without a real browser.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Stubs ─────────────────────────────────────────────────────────────────────

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value },
    removeItem: (key: string) => { delete storage[key] },
    clear: () => { Object.keys(storage).forEach((k) => delete storage[k]) },
})

const setAttribute = vi.fn()
vi.stubGlobal('document', {
    documentElement: { setAttribute },
})

import { getSavedTheme, getSavedDensity, applyTheme, applyDensity } from './appearance'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getSavedTheme', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    it('returns dark when nothing is saved', () => {
        expect(getSavedTheme()).toBe('dark')
    })

    it('returns light when light is saved', () => {
        localStorage.setItem('stage-manager-theme', 'light')
        expect(getSavedTheme()).toBe('light')
    })

    it('returns dark for unrecognised saved value', () => {
        localStorage.setItem('stage-manager-theme', 'sepia')
        expect(getSavedTheme()).toBe('dark')
    })
})

describe('getSavedDensity', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    it('returns comfortable when nothing is saved', () => {
        expect(getSavedDensity()).toBe('comfortable')
    })

    it('returns compact when compact is saved', () => {
        localStorage.setItem('stage-manager-density', 'compact')
        expect(getSavedDensity()).toBe('compact')
    })

    it('returns comfortable for unrecognised saved value', () => {
        localStorage.setItem('stage-manager-density', 'large')
        expect(getSavedDensity()).toBe('comfortable')
    })
})

describe('applyTheme', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    it('sets data-theme attribute on documentElement', () => {
        applyTheme('light')
        expect(setAttribute).toHaveBeenCalledWith('data-theme', 'light')
    })

    it('writes to localStorage', () => {
        applyTheme('light')
        expect(localStorage.getItem('stage-manager-theme')).toBe('light')
    })

    it('round-trips: apply then read back', () => {
        applyTheme('dark')
        expect(getSavedTheme()).toBe('dark')
        applyTheme('light')
        expect(getSavedTheme()).toBe('light')
    })
})

describe('applyDensity', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    it('sets data-density attribute on documentElement', () => {
        applyDensity('compact')
        expect(setAttribute).toHaveBeenCalledWith('data-density', 'compact')
    })

    it('writes to localStorage', () => {
        applyDensity('compact')
        expect(localStorage.getItem('stage-manager-density')).toBe('compact')
    })

    it('round-trips: apply then read back', () => {
        applyDensity('comfortable')
        expect(getSavedDensity()).toBe('comfortable')
        applyDensity('compact')
        expect(getSavedDensity()).toBe('compact')
    })
})
