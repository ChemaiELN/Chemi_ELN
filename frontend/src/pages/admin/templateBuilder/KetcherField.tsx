import { useRef, useState, useEffect, useMemo } from 'react'
import { Button, Input, message } from 'antd'
import { ArrowRight, FlaskConical } from 'lucide-react'
import 'ketcher-react/dist/index.css'

// Standalone value/onChange wrapper around the Ketcher chemical structure
// editor — same package/loading pattern as pages/adc/tabs/SchemeTab.tsx, but
// decoupled from that page's own save-mutation/SMILES-input UI so it can be
// dropped into any form as a plain controlled field. `value` is a molfile
// (preferred) or SMILES string; `onChange` fires with the current molfile
// whenever the user edits the structure.
interface KetcherInstance {
  getSmiles:   () => Promise<string>
  getMolfile:  () => Promise<string>
  setMolecule: (data: string) => Promise<void>
  editor?: { subscribe: (event: string, cb: () => void) => unknown }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = React.ComponentType<any>
type AnyClass = new () => unknown

// A V2000 molfile's 4th line is the counts line — its first 3 chars are the
// atom count. Used to tell a real structure from an "empty canvas" molfile,
// which is a non-empty string and so can't be detected by truthiness alone.
function molfileAtomCount(mol?: string): number {
  if (!mol) return 0
  const lines = mol.split('\n')
  if (lines.length < 4) return 0
  const n = parseInt(lines[3].slice(0, 3).trim(), 10)
  return Number.isFinite(n) ? n : 0
}

export default function KetcherField({ value, onChange, disabled }: {
  value?: string
  onChange?: (molfile: string) => void
  disabled?: boolean
}) {
  const ketcherRef = useRef<KetcherInstance | null>(null)
  const svcRef = useRef<unknown>(null)

  // The editor's 'change' subscription below is wired up once, at onInit, so
  // it would otherwise capture the first render's `onChange` forever. Keep
  // the latest one in a ref so commits always reach the current handler.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const [ketcherReady, setKetcherReady] = useState(false)
  const [EditorComp, setEditorComp] = useState<AnyComp | null>(null)
  const [SvcProvider, setSvcProvider] = useState<AnyClass | null>(null)
  const [smilesInput, setSmilesInput] = useState('')
  // Guards the initial value->editor load to fire exactly once per mount,
  // whichever of {ketcherReady, value} arrives later — `value` can still be
  // undefined the moment Ketcher finishes initializing if the owning
  // experiment's data is still in flight, and a `[ketcherReady]`-only effect
  // would never retry once it did arrive, silently showing a blank canvas
  // for an already-saved structure.
  const loadedInitialValueRef = useRef(false)
  // Ketcher fires 'change' as soon as it initialises, while the canvas is
  // still EMPTY. Committing that would overwrite an already-saved structure
  // with an empty molfile the instant the user navigates back to this
  // screen. Stay closed until the saved value has been loaded back in.
  const initialSettledRef = useRef(false)

  // Load Ketcher eagerly on mount — WASM init is expensive, do it once.
  useEffect(() => {
    Promise.all([
      import('ketcher-react').then(m => m.Editor),
      import('ketcher-standalone').then(m => m.StandaloneStructServiceProvider),
    ]).then(([Ed, Svc]) => {
      if (!svcRef.current) svcRef.current = new (Svc as AnyClass)()
      setEditorComp(() => Ed as AnyComp)
      setSvcProvider(() => Svc as AnyClass)
    }).catch(() => {})
  }, [])

  // Once both the editor is ready AND a value is available, load it — once.
  // `onInit` fires before Ketcher's internal structure service is reliably
  // able to accept setMolecule(), so a single attempt can silently no-op and
  // leave a blank canvas. Retry until the structure actually reads back.
  useEffect(() => {
    // Once either ref is set this mount's initial load is decided — never
    // re-push `value` back into the canvas afterwards, or the user's own
    // in-progress drawing would get reloaded out from under them on every
    // change they make.
    if (loadedInitialValueRef.current || initialSettledRef.current) return
    if (!ketcherReady || !ketcherRef.current) return
    if (molfileAtomCount(value) === 0) {
      // Nothing meaningful saved — open the gate so the user's own edits commit.
      initialSettledRef.current = true
      return
    }
    loadedInitialValueRef.current = true
    let cancelled = false
    void (async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        try {
          await ketcherRef.current!.setMolecule(value!)
          await new Promise(r => setTimeout(r, 150))
          const readBack = await ketcherRef.current!.getMolfile()
          if (molfileAtomCount(readBack) > 0) break
        } catch { /* editor not ready yet — retry below */ }
        await new Promise(r => setTimeout(r, 250))
      }
      if (!cancelled) initialSettledRef.current = true
    })()
    return () => { cancelled = true }
  }, [ketcherReady, value])

  const commitChange = async () => {
    const cb = onChangeRef.current
    if (!ketcherRef.current || !cb) return
    // See initialSettledRef — never let the initial empty canvas overwrite
    // an already-saved structure.
    if (!initialSettledRef.current) return
    try {
      const molfile = await ketcherRef.current.getMolfile()
      cb(molfile)
    } catch {
      // Editor not ready / nothing drawn yet — leave value as-is.
    }
  }

  // Same "type SMILES → Load" pattern as pages/adc/tabs/SchemeTab.tsx —
  // Ketcher's setMolecule() parses SMILES directly, no separate conversion
  // step needed.
  //
  // setMolecule()'s promise resolves before Ketcher's internal editor state
  // has actually finished committing the new structure — calling
  // getMolfile() immediately afterward can read back stale/empty data even
  // though the canvas visibly shows the loaded structure right away. A short
  // delay before reading it back avoids silently saving an empty value.
  const loadFromSmiles = async () => {
    const val = smilesInput.trim()
    if (!val || !ketcherRef.current) return
    try {
      await ketcherRef.current.setMolecule(val)
      setSmilesInput('')
      // Explicit user action — the canvas is authoritative from here on, so
      // stop suppressing commits even if the initial load never settled.
      loadedInitialValueRef.current = true
      initialSettledRef.current = true
      await new Promise(resolve => setTimeout(resolve, 150))
      await commitChange()
    } catch {
      message.error('Could not parse structure — check your SMILES notation')
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const svcInstance = useMemo(() => svcRef.current, [SvcProvider])

  return (
    <div>
      {!disabled && (
        <div className="flex gap-2 mb-2">
          <Input
            value={smilesInput}
            onChange={e => setSmilesInput(e.target.value)}
            onPressEnter={loadFromSmiles}
            placeholder="Enter SMILES notation and press Enter… e.g. CC(=O)Nc1ccc(O)cc1"
            className="text-sm"
            allowClear
          />
          <Button icon={<ArrowRight size={14} />} onClick={loadFromSmiles} disabled={!smilesInput.trim() || !ketcherReady}>
            Load
          </Button>
        </div>
      )}
      <div style={{ height: 420 }} className="rounded-lg border border-slate-200 overflow-hidden">
      {EditorComp && svcInstance ? (
        <EditorComp
          staticResourcesUrl="/ketcher/"
          structServiceProvider={svcInstance}
          onInit={(k: KetcherInstance) => {
            ketcherRef.current = k
            setKetcherReady(true)
            if (!disabled) {
              try {
                k.editor?.subscribe('change', () => { void commitChange() })
              } catch { /* older Ketcher API */ }
            }
          }}
          errorHandler={(msg: string) => message.error(`Ketcher: ${msg}`)}
        />
      ) : (
        <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
          <FlaskConical size={32} className="mb-2 text-slate-200" />
          <p className="text-xs font-medium">Loading chemical editor…</p>
        </div>
      )}
      </div>
    </div>
  )
}
