import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        resolve: {
            alias: {
                '@shared': resolve('shared'),
                '@core': resolve('src/core'),
                '@api': resolve('src/api'),
            }
        },
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/main.ts')
                }
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/preload.ts')
                }
            }
        }
    },
    renderer: {
        // AV Display renderer — PixiJS, Tone.js, Web Audio SFX
        root: resolve(__dirname, 'src/systems/av'),
        resolve: {
            alias: {
                '@shared': resolve('shared'),
                '@systems': resolve('src/systems'),
                '@core': resolve('src/core'),
            }
        },
        plugins: [react()],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/systems/av/index.html'),
                }
            }
        }
    }
})
