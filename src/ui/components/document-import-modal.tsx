/**
 * DocumentImportModal — Sprint 15h, updated Sprint 16.
 * Full-screen modal: paste/upload document → parse → preview → import.
 * Entry point for the Smart Import Parser feature.
 *
 * Uses the server-side import pipeline (POST /api/campaigns/:id/import)
 * to create real Scene records, NPC records, Item records, Notes, and
 * junction table links in a single operation.
 */
import React, { useState, useCallback, useRef } from 'react'
import { parseDocument } from '@systems/import/document-parser'
import type { ExtractionResult } from '@systems/import/document-parser'
import { extractTextFromPDF } from '@systems/import/pdf-extractor'
import { ExtractionPreview } from './extraction-preview'
import { getServerUrl } from '../lib/sync'
import type { ImportResult } from '@systems/import/import-pipeline'

interface DocumentImportModalProps {
    campaignId: string
    onClose: () => void
    onImportComplete: () => void
}

type Phase = 'input' | 'preview'

export function DocumentImportModal({
    campaignId,
    onClose,
    onImportComplete,
}: DocumentImportModalProps): React.JSX.Element {
    const [phase, setPhase] = useState<Phase>('input')
    const [rawText, setRawText] = useState('')
    const [result, setResult] = useState<ExtractionResult | null>(null)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)
    const [extracting, setExtracting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleParse = useCallback(() => {
        if (!rawText.trim()) return
        const parsed = parseDocument(rawText)
        setResult(parsed)
        setPhase('preview')
    }, [rawText])

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'

        if (isPDF) {
            setExtracting(true)
            const reader = new FileReader()
            reader.onload = async (ev) => {
                try {
                    const buffer = ev.target?.result as ArrayBuffer
                    const text = await extractTextFromPDF(new Uint8Array(buffer))
                    setRawText(text)
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    setImportResult({ created: 0, errors: [`PDF extraction failed: ${msg}`] })
                } finally {
                    setExtracting(false)
                }
            }
            reader.onerror = () => {
                setImportResult({ created: 0, errors: ['Failed to read PDF file'] })
                setExtracting(false)
            }
            reader.readAsArrayBuffer(file)
        } else {
            const reader = new FileReader()
            reader.onload = (ev) => {
                const text = ev.target?.result as string
                setRawText(text)
            }
            reader.onerror = () => {
                setImportResult({ created: 0, errors: ['Failed to read file'] })
            }
            reader.readAsText(file)
        }

        // Reset file input so same file can be re-selected
        e.target.value = ''
    }, [])

    const handleImport = useCallback(async (_entities: unknown[], updatedExtraction: ExtractionResult) => {
        setImporting(true)

        try {
            // Send the extraction result (with user's checked/unchecked states) to the server.
            // The server runs runImportPipeline() which creates real Scene records,
            // NPC records, Item records, Notes, and junction links.
            const r = await fetch(`${getServerUrl()}/api/campaigns/${campaignId}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extraction: updatedExtraction }),
            })

            if (!r.ok) {
                const errBody = await r.json().catch(() => ({ error: `HTTP ${r.status}` })) as { error?: string }
                setImportResult({ created: 0, errors: [errBody.error ?? `HTTP ${r.status}`] })
                setImporting(false)
                return
            }

            const pipelineResult = await r.json() as ImportResult
            const totalCreated = pipelineResult.scenesCreated + pipelineResult.npcsCreated
                + pipelineResult.itemsCreated + pipelineResult.notesCreated

            setImportResult({
                created: totalCreated,
                errors: pipelineResult.errors,
            })
            setImporting(false)

            if (pipelineResult.errors.length === 0) {
                onImportComplete()
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setImportResult({ created: 0, errors: [msg] })
            setImporting(false)
        }
    }, [campaignId, onImportComplete])

    const handleBack = useCallback(() => {
        setPhase('input')
        setResult(null)
        setImportResult(null)
    }, [])

    return (
        <div className="doc-import__backdrop" onClick={onClose}>
            <div className="doc-import" onClick={(e) => e.stopPropagation()}>
                <div className="doc-import__header">
                    <h2 className="doc-import__title">Import Campaign Document</h2>
                    <button className="doc-import__close" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>

                {importResult ? (
                    <div className="doc-import__result">
                        <div className="doc-import__result-summary">
                            <p className="doc-import__result-count">
                                Successfully imported {importResult.created} entities
                            </p>
                            {importResult.errors.length > 0 && (
                                <div className="doc-import__result-errors">
                                    <p className="doc-import__result-errors-title">Errors:</p>
                                    {importResult.errors.map((err, i) => (
                                        <p key={i} className="doc-import__result-error">{err}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="doc-import__result-actions">
                            <button className="btn btn-ghost" onClick={handleBack}>
                                Import Another
                            </button>
                            <button className="btn btn-primary" onClick={onClose}>
                                Done
                            </button>
                        </div>
                    </div>
                ) : phase === 'input' ? (
                    <div className="doc-import__input-phase">
                        <p className="doc-import__instructions">
                            Paste your campaign document below, or upload a file (.md, .txt, .pdf).
                            The parser will detect scenes, NPCs, items, locations, and factions.
                        </p>

                        <textarea
                            className="form-input doc-import__textarea"
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Paste your campaign document here…"
                            rows={16}
                        />

                        <div className="doc-import__input-actions">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".md,.txt,.markdown,.pdf"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                            <button
                                className="btn btn-ghost"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={extracting}
                            >
                                {extracting ? 'Extracting PDF…' : 'Upload File'}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleParse}
                                disabled={!rawText.trim() || extracting}
                            >
                                Parse Document
                            </button>
                        </div>

                        {rawText.length > 0 && (
                            <p className="doc-import__char-count">
                                {rawText.length.toLocaleString()} characters
                            </p>
                        )}
                    </div>
                ) : result ? (
                    <ExtractionPreview
                        result={result}
                        onImport={(entities, updatedExtraction) => void handleImport(entities, updatedExtraction)}
                        onCancel={handleBack}
                        importing={importing}
                    />
                ) : null}
            </div>
        </div>
    )
}
