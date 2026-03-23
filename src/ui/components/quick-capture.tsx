/**
 * QuickCapture — global floating modal for rapid note creation.
 * Triggered by Ctrl+Shift+N from any tab.
 * Creates a general-type note with minimal fields and returns the DM to their workflow.
 * Sprint 15d.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import { useNotesStore } from '../stores/notes-store'
import { postNote } from '../hooks/use-notes'
import { emitNoteCreate } from '../lib/sync'

export function QuickCapture(): React.JSX.Element | null {
    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [saving, setSaving] = useState(false)
    const titleRef = useRef<HTMLInputElement>(null)
    const activeCampaignId = useAppStore((s) => s.activeCampaignId)
    const hasLaunched = useAppStore((s) => s.hasLaunched)

    // Global keyboard shortcut: Ctrl+Shift+N
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault()
                setIsOpen((prev) => !prev)
            }
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault()
                handleClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-focus title when opened
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure DOM is ready after render
            const timer = setTimeout(() => titleRef.current?.focus(), 50)
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    const handleClose = useCallback(() => {
        setIsOpen(false)
        setTitle('')
        setBody('')
        setSaving(false)
    }, [])

    const handleSave = useCallback(async () => {
        if (!activeCampaignId || !title.trim()) return
        setSaving(true)
        try {
            const note = await postNote(activeCampaignId, {
                title: title.trim(),
                type: 'general',
                body: body.trim(),
            })
            useNotesStore.getState().addNote(note)
            emitNoteCreate(note)
            handleClose()
        } catch (err) {
            console.error('[QuickCapture] save error:', err)
            setSaving(false)
        }
    }, [activeCampaignId, title, body, handleClose])

    // Don't render if not launched or no campaign
    if (!hasLaunched || !activeCampaignId) return null
    if (!isOpen) return null

    return (
        <div className="quick-capture__backdrop" onClick={handleClose}>
            <div
                className="quick-capture"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Quick note capture"
                aria-modal="true"
            >
                <div className="quick-capture__header">
                    <span className="quick-capture__title">Quick Note</span>
                    <button
                        className="quick-capture__close"
                        onClick={handleClose}
                        aria-label="Close"
                        type="button"
                    >
                        ×
                    </button>
                </div>

                <input
                    ref={titleRef}
                    className="form-input quick-capture__input"
                    placeholder="Note title…"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void handleSave()
                        }
                    }}
                    disabled={saving}
                />

                <textarea
                    className="form-input quick-capture__body"
                    placeholder="Optional body (markdown supported)…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    disabled={saving}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault()
                            void handleSave()
                        }
                    }}
                />

                <div className="quick-capture__footer">
                    <span className="quick-capture__hint">
                        Enter to save &middot; Ctrl+Enter from body &middot; Esc to cancel
                    </span>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => void handleSave()}
                        disabled={saving || !title.trim()}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}
