import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

interface Props {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  minHeight?: number
  height?: number
  readOnly?: boolean
}

const TOOLBAR = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote'],
  ['clean'],
]

export default function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  height,
  readOnly = false,
}: Props) {
  const wrapRef       = useRef<HTMLDivElement>(null)
  const quillRef      = useRef<Quill | null>(null)
  const onChangeRef   = useRef(onChange)
  // Persists across React Strict Mode's artificial unmount/remount — prevents double-init
  const initializedRef = useRef(false)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    // Guard: refs survive Strict Mode cycles, so this only runs once per true mount
    if (initializedRef.current || !wrapRef.current) return
    initializedRef.current = true

    // Give Quill its own container div that React never touches
    const container = document.createElement('div')
    wrapRef.current.prepend(container)

    const quill = new Quill(container, {
      theme: 'snow',
      placeholder,
      readOnly,
      modules: { toolbar: readOnly ? false : TOOLBAR },
    })

    quillRef.current = quill

    if (value) quill.root.innerHTML = value

    quill.on('text-change', (_delta, _oldDelta, source) => {
      if (source !== 'user') return
      const html = quill.root.innerHTML
      onChangeRef.current?.(html === '<p><br></p>' ? '' : html)
    })

    // No DOM cleanup needed: when the component truly unmounts,
    // the entire wrapRef subtree is removed from the DOM by React.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync value driven from outside (e.g. form.setFieldsValue)
  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return
    // Do not overwrite innerHTML while the user is actively typing in this editor to prevent cursor jump/jumbling
    if (quill.hasFocus()) return

    const incoming = value ?? ''
    if (quill.root.innerHTML !== incoming) {
      const selection = quill.getSelection()
      quill.root.innerHTML = incoming
      if (selection) {
        try { quill.setSelection(selection) } catch { /* ignore */ }
      }
    }
  }, [value])

  return (
    <div ref={wrapRef} className="rich-editor-wrap">
      {/* Quill prepends its toolbar + container here; React only owns the style tag */}
      <style>{`
        .rich-editor-wrap .ql-container {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
          font-size: 14px;
          ${height ? `height: ${height}px; overflow-y: auto;` : `min-height: ${minHeight}px;`}
        }
        .rich-editor-wrap .ql-toolbar {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          background: #fafafa;
        }
        .rich-editor-wrap .ql-editor {
          ${height ? `min-height: ${height}px;` : `min-height: ${minHeight}px;`}
        }
        .rich-editor-wrap .ql-editor.ql-blank::before {
          color: #bfbfbf;
          font-style: normal;
        }
      `}</style>
    </div>
  )
}

// Read-only HTML display for view mode
export function RichDisplay({ html }: { html: string | null | undefined }) {
  if (!html || html === '<p><br></p>' || html === '<p></p>') {
    return <span className="text-slate-300 text-sm">—</span>
  }
  return (
    <div
      className="prose prose-sm max-w-none text-slate-700 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
