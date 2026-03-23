/**
 * Shared color grade presets used by both BG and GB settings zones.
 */
export const COLOR_GRADE_PRESETS = [
    { label: 'Night', values: { brightness: -0.3, contrast: 0.1, saturation: -0.4, temperature: -0.5, tint: '#3344aa' } },
    { label: 'Firelight', values: { brightness: 0.05, contrast: 0.15, saturation: 0.1, temperature: 0.4, tint: '#ff8844' } },
    { label: 'Desaturated', values: { brightness: 0, contrast: 0, saturation: -0.8, temperature: 0, tint: '#ffffff' } },
    { label: 'High Contrast', values: { brightness: 0, contrast: 0.6, saturation: 0.1, temperature: 0, tint: '#ffffff' } },
] as const

export const COLOR_GRADE_DEFAULT = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: '#ffffff' } as const

export const COLOR_GRADE_SLIDERS = [
    { key: 'brightness', label: 'Bright', min: -1, max: 1 },
    { key: 'contrast', label: 'Contrast', min: -1, max: 1 },
    { key: 'saturation', label: 'Sat', min: -1, max: 1 },
    { key: 'temperature', label: 'Temp', min: -1, max: 1 },
] as const
