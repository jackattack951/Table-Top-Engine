/**
 * CodeMirror 6 markdown editor wrapper — Sprint 8d / 15e.
 * Self-contained; not coupled to Notes domain.
 * Accepts a value string and onChange callback.
 * Optional wikilink support via wikilinkConfig prop.
 */
import React, { useRef, useEffect } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder, ViewPlugin, Decoration, type ViewUpdate, type DecorationSet } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Range } from '@codemirror/state'
import { wikilinkExtension, type WikilinkExtensionOptions } from '../lib/cm-wikilink'

/** Imperative handle exposed via editorRef */
export interface MarkdownEditorHandle {
    /** Get the currently selected text (empty string if no selection) */
    getSelection: () => string
    /** Replace the current selection with new text */
    replaceSelection: (text: string) => void
}

interface MarkdownEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    /** Initial read-only state. Not reactive — changing after mount has no effect. */
    readOnly?: boolean
    /** Optional wikilink config — enables [[autocomplete]] and link decoration */
    wikilinkConfig?: WikilinkExtensionOptions
    /** Ref for imperative access (getSelection, replaceSelection) */
    editorRef?: React.MutableRefObject<MarkdownEditorHandle | null>
    /** Called when a non-empty text selection is made (for extract toolbar) */
    onSelectionChange?: (selectedText: string, coords: { top: number; left: number } | null) => void
}

// ── Trigger syntax decoration ────────────────────────────────────────────────

const triggerDeco = Decoration.mark({ class: 'cm-trigger-highlight' })

const triggerPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet
        constructor(view: EditorView) {
            this.decorations = buildTriggerDecorations(view)
        }
        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = buildTriggerDecorations(update.view)
            }
        }
    },
    { decorations: (v) => v.decorations },
)

function buildTriggerDecorations(view: EditorView): DecorationSet {
    const widgets: Range<Decoration>[] = []
    const doc = view.state.doc.toString()
    const pattern = /\[Trigger:\s*[^\]]+\]/g
    let match
    while ((match = pattern.exec(doc)) !== null) {
        widgets.push(triggerDeco.range(match.index, match.index + match[0].length))
    }
    return Decoration.set(widgets)
}

// ── Custom theme overrides to match app CSS vars ─────────────────────────────

const appTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: 'var(--text-base)',
        backgroundColor: 'var(--color-surface-2)',
    },
    '.cm-scroller': {
        fontFamily: 'var(--font-base)',
        lineHeight: '1.7',
    },
    '.cm-content': {
        padding: 'var(--space-3)',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-gutters': {
        backgroundColor: 'var(--color-surface-2)',
        borderRight: '1px solid var(--color-border-2)',
    },
})

// ── Component ────────────────────────────────────────────────────────────────

export function MarkdownEditor({
    value,
    onChange,
    placeholder,
    readOnly = false,
    wikilinkConfig,
    editorRef,
    onSelectionChange,
}: MarkdownEditorProps): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const isExternalUpdate = useRef(false)
    // Store the latest onChange in a ref to avoid recreating the EditorView
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    // Store wikilink config in a ref so the extension reads latest values
    const wikilinkConfigRef = useRef(wikilinkConfig)
    wikilinkConfigRef.current = wikilinkConfig

    // Store selection callback in ref
    const onSelectionChangeRef = useRef(onSelectionChange)
    onSelectionChangeRef.current = onSelectionChange

    useEffect(() => {
        if (!containerRef.current) return

        // Build wikilink extensions if config is provided
        const wikilinkExts = wikilinkConfigRef.current
            ? wikilinkExtension({
                getNotes: () => wikilinkConfigRef.current?.getNotes() ?? [],
                onNavigate: (title) => wikilinkConfigRef.current?.onNavigate(title),
            })
            : []

        const state = EditorState.create({
            doc: value,
            extensions: [
                keymap.of(defaultKeymap),
                markdown(),
                oneDark,
                appTheme,
                triggerPlugin,
                ...wikilinkExts,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !isExternalUpdate.current) {
                        onChangeRef.current(update.state.doc.toString())
                    }
                    // Notify parent about selection changes
                    if (update.selectionSet || update.docChanged) {
                        const sel = update.state.selection.main
                        if (sel.from !== sel.to) {
                            const text = update.state.doc.sliceString(sel.from, sel.to)
                            const coords = update.view.coordsAtPos(sel.from)
                            onSelectionChangeRef.current?.(text, coords ? { top: coords.top, left: coords.left } : null)
                        } else {
                            onSelectionChangeRef.current?.('', null)
                        }
                    }
                }),
                EditorState.readOnly.of(readOnly),
                ...(placeholder ? [cmPlaceholder(placeholder)] : []),
            ],
        })

        const view = new EditorView({ state, parent: containerRef.current })
        viewRef.current = view

        // Expose imperative handle
        if (editorRef) {
            editorRef.current = {
                getSelection: () => {
                    const sel = view.state.selection.main
                    return sel.from !== sel.to
                        ? view.state.doc.sliceString(sel.from, sel.to)
                        : ''
                },
                replaceSelection: (text: string) => {
                    const sel = view.state.selection.main
                    if (sel.from !== sel.to) {
                        view.dispatch({
                            changes: { from: sel.from, to: sel.to, insert: text },
                        })
                    }
                },
            }
        }

        return () => {
            view.destroy()
            viewRef.current = null
            if (editorRef) editorRef.current = null
        }
        // Only create EditorView once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync external value changes (e.g. switching notes)
    useEffect(() => {
        const view = viewRef.current
        if (!view) return
        const currentDoc = view.state.doc.toString()
        if (currentDoc === value) return

        isExternalUpdate.current = true
        view.dispatch({
            changes: { from: 0, to: currentDoc.length, insert: value },
        })
        isExternalUpdate.current = false
    }, [value])

    return (
        <div
            ref={containerRef}
            className="markdown-editor"
        />
    )
}
