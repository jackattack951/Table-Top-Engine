import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * Vitest configuration.
 * Mirrors the path aliases used in electron.vite.config.ts and vite.cockpit.config.ts
 * so test imports resolve the same way as production imports.
 */
export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        // Exclude node_modules and built output
        exclude: ['**/node_modules/**', '**/out/**', '**/dist/**'],
    },
    resolve: {
        alias: {
            '@core': resolve(__dirname, 'src/core'),
            '@shared': resolve(__dirname, 'shared'),
            '@systems': resolve(__dirname, 'src/systems'),
            '@ui': resolve(__dirname, 'src/ui'),
            '@api': resolve(__dirname, 'src/api'),
            '@reference': resolve(__dirname, 'src/reference'),
            '@assets': resolve(__dirname, 'src/assets'),
        },
    },
})
