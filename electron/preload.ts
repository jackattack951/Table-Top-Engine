import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { LicenseState } from '../src/core/auth/auth'
import type { ImportResult } from '../src/core/types'

/**
 * Preload script — exposes only specific, typed IPC methods to renderer processes.
 * Never expose raw ipcRenderer. Only expose what each renderer actually needs.
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // Cockpit → Main
    setAppMode: (mode: string) => ipcRenderer.send(IPC.MAIN_MODE_SET, mode),
    switchScene: (sceneId: string) => ipcRenderer.send(IPC.MAIN_SCENE_SWITCH, sceneId),
    getCampaignList: () => ipcRenderer.invoke(IPC.MAIN_CAMPAIGN_LIST),
    getCampaign: (id: string) => ipcRenderer.invoke(IPC.MAIN_CAMPAIGN_GET, id),
    toggleAVFullscreen: () => ipcRenderer.send(IPC.MAIN_AV_FULLSCREEN),

    // Sprint 4: License
    getLicenseState: (): Promise<LicenseState> => ipcRenderer.invoke(IPC.GET_LICENSE_STATE),

    // Sprint 4: Obsidian import
    importObsidianVault: (vaultPath: string, campaignId: string, options?: { autoCreateScenes?: boolean }): Promise<ImportResult> =>
        ipcRenderer.invoke(IPC.IMPORT_OBSIDIAN_VAULT, vaultPath, campaignId, options),
    stopWatchingVault: (): Promise<void> => ipcRenderer.invoke(IPC.IMPORT_STOP_WATCHING),

    // Sprint 8e: Single file import
    importSingleFile: (filePath: string, campaignId: string, options?: { autoCreateScenes?: boolean }): Promise<ImportResult> =>
        ipcRenderer.invoke(IPC.IMPORT_SINGLE_FILE, filePath, campaignId, options),

    // Sprint 4: File dialogs
    openFolderDialog: (): Promise<string | null> => ipcRenderer.invoke(IPC.OPEN_FOLDER_DIALOG),

    // Sprint 8e: Single file dialog
    openFileDialog: (): Promise<string | null> => ipcRenderer.invoke(IPC.OPEN_FILE_DIALOG),

    // Sprint 7: LAN info for QR code
    getLANInfo: (): Promise<{ ip: string; port: number; url: string }> =>
        ipcRenderer.invoke(IPC.GET_LAN_INFO),

    // Media Library: file dialog + metadata
    openMediaDialog: (): Promise<string[] | null> =>
        ipcRenderer.invoke(IPC.OPEN_MEDIA_DIALOG),
    getMediaMetadata: (filePath: string): Promise<{
        filePath: string; fileName: string; mediaType: 'image' | 'video' | 'audio';
        fileSize: number; width: number | null; height: number | null;
    } | null> =>
        ipcRenderer.invoke(IPC.GET_MEDIA_METADATA, filePath),

    // Main → Renderer (listeners)
    onStateSync: (callback: (state: unknown) => void) =>
        ipcRenderer.on(IPC.COCKPIT_STATE_SYNC, (_event, state) => callback(state)),
    onModeChange: (callback: (mode: unknown) => void) =>
        ipcRenderer.on(IPC.COCKPIT_MODE_CHANGE, (_event, mode) => callback(mode)),

    // Cleanup — only known IPC channels may be cleared
    removeAllListeners: (channel: typeof IPC[keyof typeof IPC]) =>
        ipcRenderer.removeAllListeners(channel),
})
