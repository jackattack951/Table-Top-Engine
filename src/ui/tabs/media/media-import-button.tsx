/**
 * Media import button — triggers IPC file dialog, creates asset records.
 * Disabled gracefully in browser dev mode (no IPC available).
 */
import React, { useState } from 'react'
import { postAsset } from '../../hooks/use-assets'
import type { CreateAssetInput } from '@shared/asset-types'

const HAS_ELECTRON = typeof window !== 'undefined' && 'electronAPI' in window

interface MediaImportButtonProps {
    onImportComplete: () => Promise<void>
}

export function MediaImportButton({ onImportComplete }: MediaImportButtonProps): React.JSX.Element {
    const [importing, setImporting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleImport(): Promise<void> {
        if (!HAS_ELECTRON) return
        setImporting(true)
        setError(null)
        try {
            const api = (window as Record<string, unknown>)['electronAPI'] as {
                openMediaDialog: () => Promise<string[] | null>
                getMediaMetadata: (filePath: string) => Promise<{
                    filePath: string; fileName: string; mediaType: 'image' | 'video' | 'audio';
                    fileSize: number; width: number | null; height: number | null;
                } | null>
            }
            const filePaths = await api.openMediaDialog()
            if (!filePaths || filePaths.length === 0) {
                setImporting(false)
                return
            }

            // For each file: get metadata then create asset record
            for (const filePath of filePaths) {
                const meta = await api.getMediaMetadata(filePath)
                if (!meta) continue

                const input: CreateAssetInput = {
                    filePath: meta.filePath,
                    fileName: meta.fileName,
                    mediaType: meta.mediaType,
                    fileSize: meta.fileSize,
                    width: meta.width,
                    height: meta.height,
                }

                await postAsset(input)
            }

            await onImportComplete()
        } catch (err) {
            console.error('[MediaImportButton] import error:', err)
            setError(err instanceof Error ? err.message : 'Import failed')
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="media-import">
            <button
                className="btn btn-primary"
                onClick={() => void handleImport()}
                disabled={importing || !HAS_ELECTRON}
                title={HAS_ELECTRON ? 'Import media files' : 'Import requires Electron (not available in browser dev)'}
            >
                {importing ? 'Importing...' : 'Import'}
            </button>
            {error && <span className="media-import__error">{error}</span>}
        </div>
    )
}
