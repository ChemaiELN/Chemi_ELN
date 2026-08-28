import { useEffect, useRef } from 'react'
import Quill from 'quill'
import QuillTableBetter from 'quill-table-better'
import 'quill/dist/quill.snow.css'
import 'quill-table-better/dist/quill-table-better.css'

// Registers the table-* blots globally so pasted/loaded <table> markup (e.g. from
// Word/Excel) round-trips through Quill's HTML parser instead of being flattened.
Quill.register({ 'modules/table-better': QuillTableBetter }, true)

// Line-height isn't a built-in Quill format — registered as a block style
// attributor so it shows up as a normal toolbar dropdown (like Header/Font).
const Parchment = Quill.import('parchment') as any
const LineHeightStyle = new Parchment.StyleAttributor('lineheight', 'line-height', {
  scope: Parchment.Scope.BLOCK,
  whitelist: ['1', '1.15', '1.5', '2', '2.5', '3'],
})
Quill.register(LineHeightStyle, true)

// Quill's built-in Font/Size formats are whitelist-only (a handful of named
// presets) — pasting from Word/another doc with an arbitrary font-family or
// exact px size (verified live: Georgia 18px, Courier New 22px) got silently
// stripped down to the editor's own default font/size, not replicated.
// Registered without a whitelist (unlike line-height above, which only ever
// needs a few discrete steps) so ANY pasted value survives, matching what
// was actually asked: paste should keep the source's exact formatting.
const FontFamilyStyle = new Parchment.StyleAttributor('font', 'font-family', { scope: Parchment.Scope.INLINE })
const FontSizeStyle = new Parchment.StyleAttributor('size', 'font-size', { scope: Parchment.Scope.INLINE })
const LetterSpacingStyle = new Parchment.StyleAttributor('letterspacing', 'letter-spacing', { scope: Parchment.Scope.INLINE })
Quill.register(FontFamilyStyle, true)
Quill.register(FontSizeStyle, true)
Quill.register(LetterSpacingStyle, true)

// undo/redo/fullscreen/special-char have no built-in Quill icon — provide our own.
const icons = Quill.import('ui/icons') as Record<string, string>
icons['undo'] = '<svg viewBox="0 0 18 18"><polyline class="ql-stroke" points="4 9 9 4 14 9"/><path class="ql-stroke" d="M9,4V12a4,4,0,0,1-4,4H4"/></svg>'
icons['redo'] = '<svg viewBox="0 0 18 18"><polyline class="ql-stroke" points="14 9 9 4 4 9"/><path class="ql-stroke" d="M9,4V12a4,4,0,0,1,4,4h1"/></svg>'
icons['fullscreen'] = '<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M3,7V3H7 M15,7V3H11 M3,11v4H7 M15,11v4H11"/></svg>'
icons['special-char'] = '<svg viewBox="0 0 18 18"><text x="2" y="14" style="font-size:13px;font-family:serif;fill:none;stroke:currentColor;stroke-width:0.6">&#937;</text></svg>'

const SPECIAL_CHARS = ['°', '±', '×', '÷', '≤', '≥', '≈', '≠', '→', 'µ', 'α', 'β', 'γ', 'Δ', 'Ω', 'π', '²', '³', '½', '™', '®']

interface Props {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  minHeight?: number
  height?: number
  readOnly?: boolean
}

const TOOLBAR = [
  ['undo', 'redo'],
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ script: 'sub' }, { script: 'super' }],
  [{ align: [] }],
  [{ lineheight: ['1', '1.15', '1.5', '2', '2.5', '3'] }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote'],
  ['table-better'],
  ['link', 'image'],
  ['special-char'],
  ['clean'],
  ['fullscreen'],
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

  // Sets height/min-height as inline styles on this instance's own DOM nodes
  // rather than through the shared `.rich-editor-wrap .ql-container` class
  // selector (see the comment at the call site below for why that mattered).
  function applyHeight() {
    const quill = quillRef.current
    if (!quill) return
    const containerEl = quill.container as HTMLElement
    const editorEl = quill.root as HTMLElement
    if (height) {
      containerEl.style.height = `${height}px`
      containerEl.style.overflowY = 'auto'
      containerEl.style.minHeight = ''
      editorEl.style.minHeight = `${height}px`
    } else {
      containerEl.style.height = ''
      containerEl.style.overflowY = ''
      containerEl.style.minHeight = `${minHeight}px`
      editorEl.style.minHeight = `${minHeight}px`
    }
  }

  // Section Properties' Height field edits this live (secEditorHeight state
  // feeds straight back into this prop) — re-apply whenever it changes rather
  // than only once at mount.
  useEffect(() => { applyHeight() }, [height, minHeight])

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
      modules: {
        table: false,
        toolbar: readOnly ? false : {
          container: TOOLBAR,
          handlers: {
            undo: function (this: { quill: Quill }) { this.quill.history.undo() },
            redo: function (this: { quill: Quill }) { this.quill.history.redo() },
            fullscreen: function (this: { quill: Quill }) {
              wrapRef.current?.classList.toggle('rich-editor-fullscreen')
            },
            'special-char': function (this: { quill: Quill }) {
              togglePicker(this.quill)
            },
          },
        },
        ...(readOnly ? {} : {
          'table-better': {
            language: 'en_US',
            menus: ['column', 'row', 'merge', 'table', 'cell', 'wrap', 'delete'],
            toolbarTable: true,
          },
          keyboard: { bindings: QuillTableBetter.keyboardBindings },
        }),
      },
    })

    quillRef.current = quill

    if (value) quill.root.innerHTML = value

    // Height is per-instance and was previously set via a global, unscoped
    // `.rich-editor-wrap .ql-container` CSS rule injected by every RichEditor
    // on the page — since that selector matches ANY instance, not just this
    // one, whichever instance mounted last silently won the cascade for every
    // other editor's height too (confirmed: a 400px "Test Procedure" section
    // was overriding a 220px Aim/Objective box elsewhere on the same page).
    // Applied as inline styles instead, which only ever affect this instance.
    applyHeight()

    quill.on('text-change', (_delta, _oldDelta, source) => {
      if (source !== 'user') return
      const html = quill.root.innerHTML
      onChangeRef.current?.(html === '<p><br></p>' ? '' : html)
    })

    // Lightweight special-character picker — plain DOM (this toolbar lives
    // outside React's tree), toggled by the Ω button, inserts at the cursor.
    let picker: HTMLDivElement | null = null
    function togglePicker(quill: Quill) {
      if (picker) { picker.remove(); picker = null; return }
      const btn = wrapRef.current?.querySelector('.ql-special-char') as HTMLElement | null
      if (!btn) return
      picker = document.createElement('div')
      picker.className = 'rich-editor-char-picker'
      for (const ch of SPECIAL_CHARS) {
        const span = document.createElement('span')
        span.textContent = ch
        span.onclick = () => {
          const sel = quill.getSelection(true)
          quill.insertText(sel.index, ch, 'user')
          quill.setSelection(sel.index + ch.length, 0)
          picker?.remove()
          picker = null
        }
        picker.appendChild(span)
      }
      btn.appendChild(picker)
    }

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
        }
        .rich-editor-wrap .ql-toolbar {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          background: #fafafa;
        }
        .rich-editor-wrap .ql-editor.ql-blank::before {
          color: #bfbfbf;
          font-style: normal;
        }
        .rich-editor-wrap .ql-editor table {
          border-collapse: collapse;
        }
        .rich-editor-wrap .ql-editor td,
        .rich-editor-wrap .ql-editor th {
          border: 1px solid #d1d5db;
          padding: 4px 8px;
        }
        .rich-editor-wrap .ql-special-char {
          position: relative;
        }
        .rich-editor-char-picker {
          position: absolute;
          top: 100%;
          left: 0;
          z-index: 20;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          background: #fff;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          padding: 6px;
          width: 210px;
        }
        .rich-editor-char-picker span {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          font-size: 14px;
          border-radius: 4px;
          cursor: pointer;
        }
        .rich-editor-char-picker span:hover {
          background: #f0f0f0;
        }
        .rich-editor-wrap.rich-editor-fullscreen {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: #fff;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }
        .rich-editor-wrap.rich-editor-fullscreen .ql-container {
          flex: 1;
          height: auto !important;
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
      className="prose prose-sm max-w-none text-slate-700 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-1.5 [&_th]:border [&_th]:border-slate-300 [&_th]:p-1.5 [&_th]:bg-slate-50"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
