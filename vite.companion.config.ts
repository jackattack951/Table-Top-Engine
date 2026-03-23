import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Companion (Player) UI Vite config — mobile-first companion app.
//
// Dev server (`npm run dev:companion`): standalone browser dev at localhost:5181
//   with companion-ws-stub for simulated Socket.io responses.
//
// Build (`npm run build:companion`): produces out/companion/ served by Express
//   at /companion/*. __COMPANION_BROWSER_DEV__ is false so the built app uses real Socket.io.

export default defineConfig(({ command }) => ({
    root: resolve(__dirname, 'src/companion'),
    // CRITICAL: base must be '/companion/' so built asset URLs resolve correctly
    // when served from Express at /companion/*
    base: '/companion/',
    plugins: [react()],
    define: {
        __COMPANION_BROWSER_DEV__: command === 'serve' ? 'true' : 'false',
        __COMPANION_SERVER_URL__: command === 'serve'
            ? JSON.stringify('http://localhost:8080')
            : JSON.stringify(''),
    },
    resolve: {
        alias: {
            '@shared': resolve(__dirname, 'shared'),
            '@core': resolve(__dirname, 'src/core'),
        }
    },
    server: {
        port: 5181,
        strictPort: true,  // Fail loudly if port 5181 is taken
        host: true,         // Expose to LAN for phone testing
    },
    build: {
        outDir: resolve(__dirname, 'out/companion'),
        emptyOutDir: true,
    }
}))
