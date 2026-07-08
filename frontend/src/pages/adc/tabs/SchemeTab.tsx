import { useRef, useState, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, message } from 'antd'
import { Save, FlaskConical, ArrowRight } from 'lucide-react'
import { projectApi, type Project } from '../../../api/adc'
import 'ketcher-react/dist/index.css'

interface Props { project: Project; projectId: string }

interface KetcherInstance {
  getSmiles:   () => Promise<string>
  getMolfile:  () => Promise<string>
  setMolecule: (data: string) => Promise<void>
  editor?: { subscribe: (event: string, cb: () => void) => unknown }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = React.ComponentType<any>
type AnyClass = new () => unknown

export default function SchemeTab({ project, projectId }: Props) {
  const qc         = useQueryClient()
  const ketcherRef = useRef<KetcherInstance | null>(null)
  const svcRef     = useRef<unknown>(null)

  const savedData  = (project as unknown as Record<string, string>).scheme_data ?? ''

  const [smilesInput,  setSmilesInput]  = useState('')
  const [dirty,        setDirty]        = useState(false)
  const [ketcherReady, setKetcherReady] = useState(false)
  const [EditorComp,   setEditorComp]   = useState<AnyComp | null>(null)
  const [SvcProvider,  setSvcProvider]  = useState<AnyClass | null>(null)

  // Load Ketcher eagerly on mount — WASM init is expensive, do it once
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

  // Once Ketcher is ready, load the saved structure
  useEffect(() => {
    if (ketcherReady && ketcherRef.current && savedData) {
      ketcherRef.current.setMolecule(savedData).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ketcherReady])

  // When project data refreshes (e.g. after save), reload into Ketcher
  useEffect(() => {
    if (ketcherReady && ketcherRef.current) {
      ketcherRef.current.setMolecule(savedData).catch(() => {})
      setDirty(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedData])

  async function loadStructure() {
    const val = smilesInput.trim()
    if (!val || !ketcherRef.current) return
    try {
      await ketcherRef.current.setMolecule(val)
      setDirty(true)
      setSmilesInput('')
    } catch {
      message.error('Could not parse structure — check your SMILES notation')
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!ketcherRef.current) throw new Error('Editor not ready')
      // Prefer molfile for round-trip fidelity; fall back to SMILES
      let val: string
      try {
        val = await ketcherRef.current.getMolfile()
      } catch {
        val = await ketcherRef.current.getSmiles()
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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700">ADC Scheme</h2>
          </div>
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

        {/* SMILES / name input → load into Ketcher */}
        <div className="flex gap-2 mb-4">
          <Input
            value={smilesInput}
            onChange={e => setSmilesInput(e.target.value)}
            onPressEnter={loadStructure}
            placeholder="Enter SMILES notation and press Enter… e.g. CC(=O)Nc1ccc(O)cc1"
            className="font-mono text-sm"
            allowClear
          />
          <Button
            icon={<ArrowRight size={14} />}
            onClick={loadStructure}
            disabled={!smilesInput.trim() || !ketcherReady}
          >
            Load
          </Button>
        </div>

        {/* Ketcher visual editor */}
        <div style={{ height: 540 }}>
          {EditorComp && svcInstance ? (
            <EditorComp
              staticResourcesUrl="/ketcher/"
              structServiceProvider={svcInstance}
              onInit={(k: KetcherInstance) => {
                ketcherRef.current = k
                setKetcherReady(true)
                try {
                  k.editor?.subscribe('change', () => setDirty(true))
                } catch { /* older Ketcher API */ }
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
      </div>
    </div>
  )
}
