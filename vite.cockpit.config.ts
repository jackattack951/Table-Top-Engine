import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Read version from package.json at build time
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string }

// Cockpit UI Vite config — used for both dev server and production build.
//
// Dev server (`npm run dev:cockpit`): standalone browser dev at localhost:5180
//   with ws-stub for simulated Socket.io responses.
//
// Build (`npm run build:cockpit`): produces out/cockpit/ served by Express.
//   __COCKPIT_BROWSER_DEV__ is false so the built cockpit uses real Socket.io.

export default defineConfig(({ command }) => ({
    root: resolve(__dirname, 'src/ui'),
    plugins: [react()],
    // __COCKPIT_BROWSER_DEV__: true only in dev server mode (standalone browser).
    // When built and served by Express inside Electron, it's false → real Socket.io.
    define: {
        __COCKPIT_BROWSER_DEV__: command === 'serve' ? 'true' : 'false',
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
        alias: {
            '@shared': resolve(__dirname, 'shared'),
            '@core': resolve(__dirname, 'src/core'),
            '@systems': resolve(__dirname, 'src/systems'),
            '@ui': resolve(__dirname, 'src/ui'),
            '@reference': resolve(__dirname, 'src/reference'),
            '@assets': resolve(__dirname, 'src/assets'),
        }
    },
    server: {
        port: 5180,
        strictPort: true,  // Fail loudly instead of silently auto-incrementing
    },
    build: {
        outDir: resolve(__dirname, 'out/cockpit'),
        emptyOutDir: true,
    }
}))
