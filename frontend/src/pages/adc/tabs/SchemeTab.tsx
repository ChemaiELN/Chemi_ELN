import { useRef, useState, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, message, Tabs } from 'antd'
import { Save, FlaskConical } from 'lucide-react'
import { projectApi, type Project } from '../../../api/adc'
import 'ketcher-react/dist/index.css'

interface Props { project: Project; projectId: string }

interface KetcherInstance {
  getSmiles: () => Promise<string>
  setMolecule: (smiles: string) => Promise<void>
  editor?: { subscribe: (event: string, cb: () => void) => unknown }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = React.ComponentType<any>
type AnyClass = new () => unknown

export default function SchemeTab({ project, projectId }: Props) {
  const qc          = useQueryClient()
  const ketcherRef  = useRef<KetcherInstance | null>(null)
  const [mode,      setMode]  = useState<'visual' | 'smiles'>('visual')
  const [smiles,    setSmiles] = useState((project as unknown as Record<string, string>).scheme_data ?? '')
  const [dirty,     setDirty] = useState(false)
  const [ketcherReady, setKetcherReady] = useState(false)

  const [EditorComp,  setEditorComp]  = useState<AnyComp | null>(null)
  const [SvcProvider, setSvcProvider] = useState<AnyClass | null>(null)
  // Load Ketcher eagerly when component mounts; cache instance in a ref so it
  // is never re-created on re-renders (WASM init is expensive).
  const svcRef = useRef<unknown>(null)

  useEffect(() => {
    Promise.all([
      import('ketcher-react').then(m => m.Editor),
      import('ketcher-standalone').then(m => m.StandaloneStructServiceProvider),
    ]).then(([Ed, Svc]) => {
      if (!svcRef.current) svcRef.current = new (Svc as AnyClass)()
      setEditorComp(() => Ed as AnyComp)
      setSvcProvider(() => Svc as AnyClass)
    }).catch(() => setMode('smiles'))
  }, [])

  useEffect(() => {
    const d = (project as unknown as Record<string, string>).scheme_data ?? ''
    setSmiles(d)
    setDirty(false)
  }, [project])

  useEffect(() => {
    if (ketcherReady && ketcherRef.current && smiles) {
      ketcherRef.current.setMolecule(smiles).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ketcherReady])

  const saveMut = useMutation({
    mutationFn: async () => {
      let val = smiles
      if (mode === 'visual' && ketcherRef.current) {
        val = await ketcherRef.current.getSmiles()
        setSmiles(val)
      }
      return projectApi.update(projectId, { scheme_data: val })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project', projectId] })
      setDirty(false)
      message.success('Scheme saved')
    },
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const svcInstance = useMemo(() => svcRef.current, [SvcProvider])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700">ADC Scheme</h2>
          </div>
          <div className="flex items-center gap-3">
            <Tabs
              activeKey={mode}
              onChange={v => setMode(v as 'visual' | 'smiles')}
              size="small"
              style={{ marginBottom: 0 }}
              items={[
                { key: 'visual', label: 'Visual Editor' },
                { key: 'smiles', label: 'SMILES' },
              ]}
            />
            <Button
              type="primary"
              icon={<Save size={14} />}
              loading={saveMut.isPending}
              disabled={!dirty}
              onClick={() => saveMut.mutate()}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Visual Ketcher editor */}
        {mode === 'visual' && (
          <div style={{ height: 540 }}>
            {EditorComp && svcInstance ? (
              <EditorComp
                staticResourcesUrl="/ketcher/"
                structServiceProvider={svcInstance}
                onInit={(k: KetcherInstance) => {
                  ketcherRef.current = k
                  setKetcherReady(true)
                  // Ketcher draws on a canvas/SVG — React onChange never fires for it.
                  // Subscribe to Ketcher's own change event so Save enables on any edit.
                  try {
                    k.editor?.subscribe('change', () => setDirty(true))
                  } catch { /* older Ketcher API — ignore */ }
                }}
                errorHandler={(msg: string) => message.error(`Ketcher: ${msg}`)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 text-slate-400">
                <FlaskConical size={40} className="mb-2 text-slate-200" />
                <p className="text-sm font-medium">Loading chemical editor…</p>
              </div>
            )}
          </div>
        )}

        {/* SMILES text mode */}
        {mode === 'smiles' && (
          <div>
            <textarea
              value={smiles}
              onChange={e => { setSmiles(e.target.value); setDirty(true) }}
              rows={6}
              placeholder="Paste or type SMILES notation… e.g. CC(=O)Nc1ccc(O)cc1"
              className="w-full font-mono text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
            />
            {smiles && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Saved SMILES</p>
                <p className="font-mono text-xs text-slate-600 break-all">{smiles}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
