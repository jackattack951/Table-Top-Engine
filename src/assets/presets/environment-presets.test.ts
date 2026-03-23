/**
 * Tests for Environment Presets — atmosphere bundle validation and retrieval.
 */
import { describe, it, expect } from 'vitest'
import {
    ENVIRONMENT_PRESETS,
    getEnvironments,
    getPresetsForEnvironment,
    type EnvironmentPreset,
} from './environment-presets'

describe('Environment Presets', () => {
    it('all preset IDs are unique', () => {
        const ids = ENVIRONMENT_PRESETS.map((p) => p.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
    })

    it('all presets have audioMood between 0.0 and 1.0', () => {
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(preset.audioMood).toBeGreaterThanOrEqual(0.0)
            expect(preset.audioMood).toBeLessThanOrEqual(1.0)
        }
    })

    it('all presets have brightness between -1 and 1', () => {
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(preset.colorGrade.brightness).toBeGreaterThanOrEqual(-1)
            expect(preset.colorGrade.brightness).toBeLessThanOrEqual(1)
        }
    })

    it('all presets have saturation between -1 and 1', () => {
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(preset.colorGrade.saturation).toBeGreaterThanOrEqual(-1)
            expect(preset.colorGrade.saturation).toBeLessThanOrEqual(1)
        }
    })

    it('all presets have particles intensity between 0 and 1', () => {
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(preset.particles.intensity).toBeGreaterThanOrEqual(0)
            expect(preset.particles.intensity).toBeLessThanOrEqual(1)
        }
    })

    it('contains at least one preset for each core environment', () => {
        const requiredEnvironments = [
            'tavern',
            'dungeon',
            'forest',
            'city',
            'castle',
            'underdark',
            'coast',
            'mountains',
        ]

        for (const env of requiredEnvironments) {
            const presets = getPresetsForEnvironment(env)
            expect(presets.length).toBeGreaterThan(0)
        }
    })

    it('getPresetsForEnvironment returns only requested environment presets', () => {
        const tavernPresets = getPresetsForEnvironment('tavern')
        expect(tavernPresets.length).toBeGreaterThan(0)
        for (const preset of tavernPresets) {
            expect(preset.environment).toBe('tavern')
        }
    })

    it('getPresetsForEnvironment returns empty array for nonexistent environment', () => {
        const results = getPresetsForEnvironment('nonexistent-environment-xyz')
        expect(results).toEqual([])
    })

    it('getEnvironments returns at least 8 unique environments', () => {
        const environments = getEnvironments()
        expect(environments.length).toBeGreaterThanOrEqual(8)
    })

    it('getEnvironments returns environments without duplicates', () => {
        const environments = getEnvironments()
        const unique = new Set(environments)
        expect(unique.size).toBe(environments.length)
    })

    it('getEnvironments includes all core environments', () => {
        const environments = getEnvironments()
        const requiredEnvironments = [
            'tavern',
            'dungeon',
            'forest',
            'city',
            'castle',
            'underdark',
            'coast',
            'mountains',
        ]
        for (const env of requiredEnvironments) {
            expect(environments).toContain(env)
        }
    })

    it('all presets have required string fields', () => {
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(typeof preset.id).toBe('string')
            expect(preset.id.length).toBeGreaterThan(0)
            expect(typeof preset.label).toBe('string')
            expect(preset.label.length).toBeGreaterThan(0)
            expect(typeof preset.environment).toBe('string')
            expect(preset.environment.length).toBeGreaterThan(0)
            expect(typeof preset.variant).toBe('string')
            expect(typeof preset.description).toBe('string')
            expect(preset.description.length).toBeGreaterThan(0)
        }
    })

    it('all presets have valid particles type', () => {
        const validTypes = ['none', 'rain', 'snow', 'dust', 'ash', 'fog', 'embers']
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(validTypes).toContain(preset.particles.type)
        }
    })

    it('all presets have valid colorGrade structure', () => {
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(preset.colorGrade).toHaveProperty('brightness')
            expect(preset.colorGrade).toHaveProperty('contrast')
            expect(preset.colorGrade).toHaveProperty('saturation')
            expect(preset.colorGrade).toHaveProperty('temperature')
            expect(preset.colorGrade).toHaveProperty('tint')
        }
    })

    it('contrast values are within reasonable range', () => {
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(preset.colorGrade.contrast).toBeGreaterThanOrEqual(-1)
            expect(preset.colorGrade.contrast).toBeLessThanOrEqual(1)
        }
    })

    it('temperature values are within reasonable range', () => {
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(preset.colorGrade.temperature).toBeGreaterThanOrEqual(-1)
            expect(preset.colorGrade.temperature).toBeLessThanOrEqual(1)
        }
    })

    it('tint is a valid hex color or empty', () => {
        const hexColorRegex = /^#[0-9A-Fa-f]{6}$|^$/
        for (const preset of ENVIRONMENT_PRESETS) {
            expect(preset.colorGrade.tint).toMatch(hexColorRegex)
        }
    })

    it('tavern has multiple variants', () => {
        const tavernPresets = getPresetsForEnvironment('tavern')
        expect(tavernPresets.length).toBeGreaterThanOrEqual(2)
    })

    it('dungeon has multiple variants', () => {
        const dungeonPresets = getPresetsForEnvironment('dungeon')
        expect(dungeonPresets.length).toBeGreaterThanOrEqual(2)
    })

    it('forest has multiple variants', () => {
        const forestPresets = getPresetsForEnvironment('forest')
        expect(forestPresets.length).toBeGreaterThanOrEqual(2)
    })
})
