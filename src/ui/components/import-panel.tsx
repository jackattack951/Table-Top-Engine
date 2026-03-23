/**
 * ImportPanel — Sprint 8e.
 * Provides single file import, vault folder import, and auto-create scenes toggle.
 * Communicates with Electron main process via IPC preload bridge.
 * Degrades gracefully in browser dev mode (shows disabled state).
 */
import React, { useState, useCallback } from 'react'
import type { ImportResult } from '@core/types'

interface ElectronAPI {
    openFileDialog: () => Promise<string | null>
    openFolderDialog: () => Promise<string | null>
    importSingleFile: (filePath: string, campaignId: string, options?: { autoCreateScenes?: boolean }) => Promise<ImportResult>
    importObsidianVault: (vaultPath: string, campaignId: string, options?: { autoCreateScenes?: boolean }) => Promise<ImportResult>
}

/**
 * Module-level cached result of the Electron API check.
 * window.electronAPI does not change after page load,
 * so we resolve it once and reuse the result.
 */
const cachedElectronAPI: ElectronAPI | null = (() => {
    const api = (window as Record<string, unknown>)['electronAPI'] as ElectronAPI | undefined
    if (!api) return null
    if (typeof api.openFileDialog !== 'function') return null
    if (typeof api.openFolderDialog !== 'function') return null
    if (typeof api.importSingleFile !== 'function') return null
    if (typeof api.importObsidianVault !== 'function') return null
    return api
})()

interface ImportPanelProps {
    campaignId: string
    /** Called after a successful import so the parent can refresh notes. */
    onImportComplete?: (result: ImportResult) => void
}

export function ImportPanel({ campaignId, onImportComplete }: ImportPanelProps): React.JSX.Element {
    const [autoCreateScenes, setAutoCreateScenes] = useState(true)
    const [importing, setImporting] = useState(false)
    const [lastResult, setLastResult] = useState<ImportResult | null>(null)

    const electronAPI = cachedElectronAPI
    const isElectron = electronAPI !== null

    const handleSingleFileImport = useCallback(async () => {
        if (!electronAPI) return
        setImporting(true)
        setLastResult(null)
        try {
            const filePath = await electronAPI.openFileDialog()
            if (!filePath) {
                setImporting(false)
                return
            }
            const result = await electronAPI.importSingleFile(filePath, campaignId, { autoCreateScenes })
            setLastResult(result)
            onImportComplete?.(result)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setLastResult({ imported: 0, skipped: 0, errors: [msg] })
        } finally {
            setImporting(false)
        }
    }, [electronAPI, campaignId, autoCreateScenes, onImportComplete])

    const handleVaultImport = useCallback(async () => {
        if (!electronAPI) return
        setImporting(true)
        setLastResult(null)
        try {
            const vaultPath = await electronAPI.openFolderDialog()
            if (!vaultPath) {
                setImporting(false)
                return
            }
            const result = await electronAPI.importObsidianVault(vaultPath, campaignId, { autoCreateScenes })
            setLastResult(result)
            onImportComplete?.(result)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setLastResult({ imported: 0, skipped: 0, errors: [msg] })
        } finally {
            setImporting(false)
        }
    }, [electronAPI, campaignId, autoCreateScenes, onImportComplete])

    return (
        <div className="import-panel">
            <p className="label-caps">Import</p>

            {/* Auto-create scenes toggle */}
            <label className="import-panel__toggle">
                <input
                    type="checkbox"
                    checked={autoCreateScenes}
                    onChange={(e) => setAutoCreateScenes(e.target.checked)}
                    disabled={!isElectron}
                />
                Auto-create scenes
            </label>

            {/* Import buttons */}
            <div className="import-panel__actions">
                <button
                    className="btn btn-ghost import-panel__btn"
                    onClick={() => void handleSingleFileImport()}
                    disabled={!isElectron || importing}
                    title={isElectron ? 'Import a single .md file' : 'Import requires Electron (not available in browser dev mode)'}
                >
                    {importing ? 'Importing...' : 'File'}
                </button>
                <button
                    className="btn btn-ghost import-panel__btn"
                    onClick={() => void handleVaultImport()}
                    disabled={!isElectron || importing}
                    title={isElectron ? 'Import an entire Obsidian vault folder' : 'Import requires Electron (not available in browser dev mode)'}
                >
                    {importing ? 'Importing...' : 'Vault'}
                </button>
            </div>

            {/* Browser dev mode notice */}
            {!isElectron && (
                <p className="import-panel__notice">Import requires Electron runtime.</p>
            )}

            {/* Import result feedback */}
            {lastResult && (
                <div className={`import-panel__result${lastResult.errors.length > 0 ? ' import-panel__result--error' : ''}`}>
                    {lastResult.imported > 0 && (
                        <p>Imported: {lastResult.imported}</p>
                    )}
                    {lastResult.errors.length > 0 && lastResult.errors.map((err, i) => (
                        <p key={i}>{err}</p>
                    ))}
                    {lastResult.imported === 0 && lastResult.errors.length === 0 && (
                        <p>No files imported.</p>
                    )}
                </div>
            )}
        </div>
    )
}
