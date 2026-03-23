import { app, BrowserWindow, screen, ipcMain, globalShortcut, safeStorage, dialog } from 'electron'
import { join } from 'path'
import { createServer as createNetServer } from 'net'
import { createServer } from '../src/api/server'
import { IPC } from '../shared/ipc-channels'
import type { AppConfig } from '../src/core/types'
import { initDB, closeDB, createDBInterface } from '../src/core/db/db'
import { checkLicense, validateOnline } from '../src/core/auth/auth'
import { getLANInfo } from '../src/core/network/lan-info'

// ── Window tracking ──────────────────────────────────────────────────────────

let cockpitWindow: BrowserWindow | null = null

/**
 * Sprint 9b: Output windows tracked by role.
 * Rule 13: Never auto-created — only via explicit DM action.
 * Rule 14: One display, one role — BG or GB, never both simultaneously.
 */
type OutputRole = 'BG' | 'GB'
let outputWindows: { BG: BrowserWindow | null; GB: BrowserWindow | null } = { BG: null, GB: null }

// ── Utilities ────────────────────────────────────────────────────────────────

/** Resolves true if the given port is free to bind on 127.0.0.1. */
function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const tester = createNetServer()
        tester.once('error', () => resolve(false))
        tester.once('listening', () => tester.close(() => resolve(true)))
        tester.listen(port, '127.0.0.1')
    })
}

const IS_DEV = !app.isPackaged

const appConfig: AppConfig = {
    appMode: 'play',
    networkMode: 'local',
    serverPort: 8080,
    avDisplayIndex: 1,
}

// ── Display detection (Sprint 9b) ────────────────────────────────────────────

interface DisplayInfo {
    id: number
    label: string
    width: number
    height: number
    bounds: { x: number; y: number; width: number; height: number }
    internal: boolean
}

function getAvailableDisplays(): DisplayInfo[] {
    return screen.getAllDisplays().map((d, i) => ({
        id: d.id,
        label: `Display ${i + 1} (${d.size.width}×${d.size.height})`,
        width: d.size.width,
        height: d.size.height,
        bounds: d.bounds,
        internal: d.internal ?? (i === 0),
    }))
}

// ── Output window management (Sprint 9b) ─────────────────────────────────────

function createOutputWindow(displayId: number | 'windowed', role: OutputRole): void {
    // Destroy existing window for this role first
    if (outputWindows[role]) {
        outputWindows[role]!.destroy()
        outputWindows[role] = null
    }

    let windowOptions: Electron.BrowserWindowConstructorOptions

    if (displayId === 'windowed') {
        windowOptions = {
            width: 1280,
            height: 720,
            title: `AV Output — ${role}`,
            fullscreen: false,
            frame: true,
            backgroundColor: '#000000',
        }
    } else {
        const display = screen.getAllDisplays().find((d) => d.id === displayId)
        if (!display) {
            console.warn(`[main] Display ${displayId} not found — cannot create ${role} output`)
            return
        }
        windowOptions = {
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height,
            fullscreen: !IS_DEV,
            frame: IS_DEV,
            title: `AV Output — ${role}`,
            backgroundColor: '#000000',
        }
    }

    const win = new BrowserWindow({
        ...windowOptions,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    })

    // Pass role via URL query parameter so the AV renderer knows what to initialize
    const baseUrl = process.env['ELECTRON_RENDERER_URL'] ?? `file://${join(__dirname, '../renderer/index.html')}`
    const separator = baseUrl.includes('?') ? '&' : '?'
    void win.webContents.loadURL(`${baseUrl}${separator}role=${role}`)

    // F11 toggles fullscreen on this output window
    win.webContents.on('before-input-event', (_event, input) => {
        if (input.key === 'F11' && input.type === 'keyDown') {
            toggleOutputFullscreen(role)
        }
    })

    win.on('closed', () => {
        outputWindows[role] = null
        // Notify cockpit that the output was closed
        cockpitWindow?.webContents.send(IPC.OUTPUT_DISPLAYS_CHANGED, getAvailableDisplays())
    })

    outputWindows[role] = win
}

function destroyOutputWindow(role: OutputRole): void {
    if (outputWindows[role]) {
        outputWindows[role]!.destroy()
        // 'closed' listener sets outputWindows[role] = null
    }
}

function toggleOutputFullscreen(role: OutputRole): void {
    const win = outputWindows[role]
    if (!win) return
    const isFullscreen = win.isFullScreen()
    win.setFullScreen(!isFullscreen)
    win.setMenuBarVisibility(isFullscreen)
}

// ── Cockpit window ───────────────────────────────────────────────────────────

function createCockpitWindow(): void {
    cockpitWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'TTRPG Stage Manager — Cockpit',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    })

    // Load cockpit from the Express server (same process, always ready).
    // Built cockpit files are served via express.static on the server port.
    cockpitWindow.webContents.loadURL(
        process.env['COCKPIT_DEV_URL'] ?? `http://localhost:${appConfig.serverPort}`
    )

    cockpitWindow.on('closed', () => { cockpitWindow = null })
}

// ── Mode management ──────────────────────────────────────────────────────────

/**
 * Apply a new app mode. Sprint 9b: only manages the cockpit window.
 * AV output windows are managed independently via IPC (Rule 13).
 */
function applyMode(newMode: AppConfig['appMode']): void {
    appConfig.appMode = newMode

    const needsCockpit = newMode === 'play' || newMode === 'plan'

    if (needsCockpit && !cockpitWindow) {
        createCockpitWindow()
    } else if (!needsCockpit && cockpitWindow) {
        cockpitWindow.destroy()
    }
    // AV outputs are user-enabled, never auto-created (Rule 13)
}

// ── App startup ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    // ── Initialize SQLite database ─────────────────────────────────────────────
    initDB()
    const dbInterface = createDBInterface()

    // ── Initialize license state ───────────────────────────────────────────────
    const licenseState = checkLicense()
    if (licenseState === 'unlicensed') {
        console.warn('[main] No license found — running in unlicensed mode (full access, paywall deferred to Sprint 5)')
    }

    validateOnline().catch((err: unknown) => {
        console.warn('[main] online license validation failed (non-fatal):', err)
    })

    // ── Port availability check ────────────────────────────────────────────────
    const portFree = await isPortAvailable(appConfig.serverPort)
    if (!portFree) {
        await dialog.showMessageBox({
            type: 'error',
            title: 'Port Conflict — Stage Manager Cannot Start',
            message: `Port ${appConfig.serverPort} is already in use.`,
            detail:
                'Another application is using this port. ' +
                'Close the conflicting application and restart Stage Manager.',
            buttons: ['Quit'],
        })
        app.quit()
        return
    }

    // ── Start Express + Socket.io server ───────────────────────────────────────
    const cockpitDistPath = IS_DEV
        ? join(__dirname, '../../out/cockpit')
        : join(__dirname, '../cockpit')
    const companionDistPath = IS_DEV
        ? join(__dirname, '../../out/companion')
        : join(__dirname, '../companion')

    createServer(appConfig, applyMode, dbInterface, {
        cockpitDistPath,
        companionDistPath,
        isDev: IS_DEV,
        onOutputEnable: (displayId: number | 'windowed', role: string) => {
            createOutputWindow(displayId, role as OutputRole)
        },
        onOutputDisable: (role: string) => {
            destroyOutputWindow(role as OutputRole)
        },
        onGetDisplays: () => getAvailableDisplays(),
    })

    // Sprint 9b: No AV windows on startup (Rule 13).
    // Only create the cockpit window based on mode.
    if (appConfig.appMode === 'play' || appConfig.appMode === 'plan') {
        createCockpitWindow()
    }

    // ── Display change listeners (hot-plug) ────────────────────────────────────
    screen.on('display-added', () => {
        const displays = getAvailableDisplays()
        cockpitWindow?.webContents.send(IPC.OUTPUT_DISPLAYS_CHANGED, displays)
    })

    screen.on('display-removed', () => {
        const displays = getAvailableDisplays()
        cockpitWindow?.webContents.send(IPC.OUTPUT_DISPLAYS_CHANGED, displays)
    })

    // ── IPC: Output management (Sprint 9b) ─────────────────────────────────────
    ipcMain.handle(IPC.OUTPUT_LIST_DISPLAYS, () => {
        return getAvailableDisplays()
    })

    ipcMain.handle(IPC.OUTPUT_ENABLE, (_event, displayId: number | 'windowed', role: string) => {
        createOutputWindow(displayId, role as OutputRole)
    })

    ipcMain.handle(IPC.OUTPUT_DISABLE, (_event, role: string) => {
        destroyOutputWindow(role as OutputRole)
    })

    ipcMain.on(IPC.OUTPUT_TOGGLE_FULLSCREEN, (_event, role: string) => {
        toggleOutputFullscreen(role as OutputRole)
    })

    // ── IPC: Legacy fullscreen toggle (updated for output windows) ─────────────
    ipcMain.on(IPC.MAIN_AV_FULLSCREEN, () => {
        // Legacy: toggle BG output fullscreen (backward compat)
        toggleOutputFullscreen('BG')
    })

    // IPC: mode switching
    ipcMain.on(IPC.MAIN_MODE_SET, (_event, newMode: AppConfig['appMode']) => {
        applyMode(newMode)
    })

    // IPC: campaign list + detail
    ipcMain.handle(IPC.MAIN_CAMPAIGN_LIST, () => {
        return dbInterface.getCampaigns()
    })

    ipcMain.handle(IPC.MAIN_CAMPAIGN_GET, (_event, id: string) => {
        return dbInterface.getCampaign(id)
    })

    // IPC: license state
    ipcMain.handle(IPC.GET_LICENSE_STATE, () => {
        return checkLicense()
    })

    // IPC: Obsidian vault import
    ipcMain.handle(IPC.IMPORT_OBSIDIAN_VAULT, async (_event, vaultPath: string, campaignId: string, options?: { autoCreateScenes?: boolean }) => {
        const { importVault, startWatching } = await import('../src/systems/import/obsidian-importer')
        const result = await importVault(vaultPath, campaignId, dbInterface, options)
        startWatching(vaultPath, campaignId, dbInterface, options)
        return result
    })

    ipcMain.handle(IPC.IMPORT_STOP_WATCHING, async () => {
        const { stopWatching } = await import('../src/systems/import/obsidian-importer')
        stopWatching()
    })

    // IPC: single file import (Sprint 8e)
    ipcMain.handle(IPC.IMPORT_SINGLE_FILE, async (_event, filePath: string, campaignId: string, options?: { autoCreateScenes?: boolean }) => {
        const { importSingleFile } = await import('../src/systems/import/obsidian-importer')
        return importSingleFile(filePath, campaignId, dbInterface, options)
    })

    // IPC: open folder dialog
    ipcMain.handle(IPC.OPEN_FOLDER_DIALOG, async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Obsidian Vault Folder',
        })
        return result.canceled ? null : (result.filePaths[0] ?? null)
    })

    // IPC: open file dialog (Sprint 8e)
    ipcMain.handle(IPC.OPEN_FILE_DIALOG, async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            title: 'Select Markdown File to Import',
            filters: [{ name: 'Markdown', extensions: ['md'] }],
        })
        return result.canceled ? null : (result.filePaths[0] ?? null)
    })

    // IPC: Media Library — multi-file import dialog
    ipcMain.handle(IPC.OPEN_MEDIA_DIALOG, async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            title: 'Import Media Files',
            filters: [
                { name: 'All Media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'wav', 'mp3', 'ogg'] },
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
                { name: 'Video', extensions: ['mp4', 'webm'] },
                { name: 'Audio', extensions: ['wav', 'mp3', 'ogg'] },
            ],
        })
        return result.canceled ? [] : result.filePaths
    })

    // IPC: Media Library — get file metadata (size, dimensions for images)
    ipcMain.handle(IPC.GET_MEDIA_METADATA, async (_event, filePath: string) => {
        const fs = await import('fs')
        const path = await import('path')
        const { nativeImage } = await import('electron')

        try {
            const stats = fs.statSync(filePath)
            const ext = path.extname(filePath).toLowerCase().slice(1)

            // Determine media type from extension
            const imageExts = ['png', 'jpg', 'jpeg', 'webp']
            const videoExts = ['mp4', 'webm']
            const audioExts = ['wav', 'mp3', 'ogg']
            let mediaType: 'image' | 'video' | 'audio' = 'image'
            if (videoExts.includes(ext)) mediaType = 'video'
            else if (audioExts.includes(ext)) mediaType = 'audio'

            const meta: {
                filePath: string
                fileName: string
                mediaType: string
                fileSize: number
                width: number | null
                height: number | null
            } = {
                filePath,
                fileName: path.basename(filePath),
                mediaType,
                fileSize: stats.size,
                width: null,
                height: null,
            }

            // For images, get dimensions via nativeImage
            if (imageExts.includes(ext)) {
                const img = nativeImage.createFromPath(filePath)
                if (!img.isEmpty()) {
                    const size = img.getSize()
                    meta.width = size.width
                    meta.height = size.height
                }
            }

            return meta
        } catch (err) {
            console.error('[main] GET_MEDIA_METADATA error:', err)
            return null
        }
    })

    // IPC: LAN info for QR code display
    ipcMain.handle(IPC.GET_LAN_INFO, () => {
        return getLANInfo(appConfig.serverPort)
    })

    // Dev convenience: Ctrl+Shift+F toggles BG output fullscreen
    if (IS_DEV) {
        globalShortcut.register('CommandOrControl+Shift+F', () => {
            toggleOutputFullscreen('BG')
        })
    }

})

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll()
    closeDB()
    if (process.platform !== 'darwin') app.quit()
})
