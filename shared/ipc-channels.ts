/**
 * IPC channel name constants — shared between Electron main process and renderer processes.
 * Convention:
 *   av:category:action   → main to AV Display
 *   cockpit:category:action → main to Cockpit renderer
 *   main:category:action → renderer to main (via invoke)
 */
export const IPC = {
    // Main → AV Display
    AV_SCENE_LOAD: 'av:scene:load',
    AV_MOOD_UPDATE: 'av:mood:update',
    AV_PARTICLES: 'av:particles',
    AV_COLORGRADE: 'av:colorgrade',
    AV_FOG_ERASE: 'av:fog:erase',
    AV_PING: 'av:ping',
    AV_SFX_TRIGGER: 'av:sfx:trigger',

    // Main → Cockpit renderer
    COCKPIT_STATE_SYNC: 'cockpit:state:sync',
    COCKPIT_MODE_CHANGE: 'cockpit:modeChange',

    // Cockpit renderer → Main (invoke pattern)
    MAIN_SCENE_SWITCH: 'main:scene:switch',
    MAIN_MODE_SET: 'main:mode:set',
    MAIN_CAMPAIGN_GET: 'main:campaign:get',
    MAIN_CAMPAIGN_LIST: 'main:campaign:list',
    MAIN_AV_FULLSCREEN: 'main:av:fullscreen',   // toggle AV Display fullscreen

    // Sprint 4: License
    GET_LICENSE_STATE: 'main:license:state',

    // Sprint 4: Obsidian import
    IMPORT_OBSIDIAN_VAULT: 'main:import:obsidian',
    IMPORT_STOP_WATCHING: 'main:import:stopWatching',

    // Sprint 8e: Single file import
    IMPORT_SINGLE_FILE: 'main:import:singleFile',

    // Sprint 4: File dialogs
    OPEN_FOLDER_DIALOG: 'main:dialog:openFolder',

    // Sprint 8e: Single file dialog
    OPEN_FILE_DIALOG: 'main:dialog:openFile',

    // Sprint 7: LAN info / QR code
    GET_LAN_INFO: 'main:network:lanInfo',

    // Sprint 9b: Output management
    OUTPUT_LIST_DISPLAYS: 'main:output:listDisplays',
    OUTPUT_ENABLE: 'main:output:enable',
    OUTPUT_DISABLE: 'main:output:disable',
    OUTPUT_TOGGLE_FULLSCREEN: 'main:output:fullscreen',
    OUTPUT_DISPLAYS_CHANGED: 'output:displaysChanged',

    // Media Library: File dialogs + metadata
    OPEN_MEDIA_DIALOG: 'main:dialog:openMedia',
    GET_MEDIA_METADATA: 'main:media:metadata',
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]
