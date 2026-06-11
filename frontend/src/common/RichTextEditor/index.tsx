/**
 * RichTextEditor — ReactQuill wrapper styled for the Chemia ELN.
 * - Edit mode  : full Quill Snow toolbar
 * - Read-only  : renders HTML content in a styled preview div (no toolbar)
 */
import React, { useMemo } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import './styles.css'

interface RichTextEditorProps {
  value: string
  onChange?: (html: string) => void
  readOnly?: boolean
  placeholder?: string
  minHeight?: number   // px, default 120
}

// Standard lab-notebook toolbar
const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  ['blockquote', 'code-block'],
  ['clean'],
]

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  placeholder = 'Enter text…',
  minHeight = 120,
}) => {
  const modules = useMemo(() => ({
    toolbar: readOnly ? false : TOOLBAR,
  }), [readOnly])

  // Read-only: plain HTML preview without any Quill chrome
  if (readOnly) {
    return (
      <div
        className="chemia-ql-preview ql-editor"
        style={{ minHeight, padding: '2px 0' }}
        dangerouslySetInnerHTML={{
          __html: value && value !== '<p><br></p>'
            ? value
            : `<p style="color:#a8a29e;margin:0">${placeholder}</p>`,
        }}
      />
    )
  }

  return (
    <div className="chemia-ql-wrap" style={{ '--ql-min-height': `${minHeight}px` } as React.CSSProperties}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
      />
    </div>
  )
}

export default RichTextEditor
