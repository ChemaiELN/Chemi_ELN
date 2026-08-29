import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Modal, Select, Tag, message, Popconfirm, Form, Alert, Checkbox } from 'antd'
import { AdminModal } from '../../../components/ui/AdminModal'
import { ArrowLeft, FileSpreadsheet, Lock, Plus, Save, Send, Trash2, Unlock } from 'lucide-react'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import type { IUniverSheetsCorePresetConfig } from '@univerjs/preset-sheets-core'
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
import type { FUniver } from '@univerjs/core/lib/facade'
import type { IWorkbookData } from '@univerjs/core'
// Univer does not publish this internal facade type in the installed package.
// Rules are only retained as opaque handles for the active editor session.
type FRangeProtectionRule = { remove: () => Promise<unknown> | void }
import { calcTemplateApi } from '../../../api/calcTemplates'
import type { CalcTemplateImportResult } from '../../../api/calcTemplates'
import type { CalcField, CalcFieldRole, CellRangeRef, ProtectedRangeMeta } from './types'

// Admin-facing spreadsheet template builder — the whole sheet (formulas,
// formatting, layout) is authored LIVE in the embedded Univer canvas; nothing
// about its content is hardcoded here. This page only lets the admin (1)
// label ranges as named input/output fields and (2) lock ranges via Univer's
// own Permission Facade API. Both are captured as metadata alongside the
// IWorkbookData snapshot Univer produces on Publish — see types.ts.
//
// "Import Excel" seeds a NEW template from an .xlsx the admin already
// maintains, instead of re-authoring the sheet by hand. The conversion runs on
// the backend (openpyxl -> IWorkbookData, see xlsx_import.py) and returns a
// snapshot we load exactly like any other, so nothing about the flow below is
// special-cased for imports. It is deliberately non-destructive: nothing is
// persisted until the admin reviews and hits Save/Publish.
//
// No custom IAuthzIoService is wired here: during AUTHORING the admin can
// freely edit everything (gated by the route + backend create/publish
// privilege check, not per-cell Univer permissions). The protect() calls
// below just RECORD which ranges become locked once published; enforcing
// that lock for regular end-users — including a backend-authorized
// IAuthzIoService and independent server-side re-validation on submit — is
// Phase 3 (Fill Template view), not this page.

function rangeRefEqual(a: CellRangeRef, b: CellRangeRef) {
  return a.startRow === b.startRow && a.startColumn === b.startColumn && a.endRow === b.endRow && a.endColumn === b.endColumn
}

interface CalcTemplateBuilderPageProps {
  scope: 'ADC' | 'CGT'
}

export default function CalcTemplateBuilderPage({ scope }: CalcTemplateBuilderPageProps) {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const basePath = scope === 'ADC' ? '/adc/calc-templates' : '/cgt/calc-templates'

  const containerRef = useRef<HTMLDivElement>(null)
  const univerRef = useRef<{ univer: import('@univerjs/core').Univer; univerAPI: FUniver } | null>(null)
  const protectionRulesRef = useRef<Map<string, FRangeProtectionRule>>(new Map())

  const [name, setName] = useState(isNew ? 'New Calc Template' : '')
  const [ready, setReady] = useState(false)
  const [fields, setFields] = useState<CalcField[]>([])
  const [protectedRanges, setProtectedRanges] = useState<ProtectedRangeMeta[]>([])
  const [fieldModalOpen, setFieldModalOpen] = useState(false)
  const [fieldForm] = Form.useForm<{ key: string; label: string; role: CalcFieldRole }>()

  // ── Excel import ──
  const fileInputRef = useRef<HTMLInputElement>(null)
  // The converted snapshot, held in state so the mount effect below can
  // rebuild Univer around it. `importNonce` forces that remount even when the
  // admin imports a second file — rebuilding is far safer than trying to swap
  // a workbook in place under a live Univer instance.
  const [imported, setImported] = useState<CalcTemplateImportResult | null>(null)
  const [importNonce, setImportNonce] = useState(0)
  const [importSummary, setImportSummary] = useState<CalcTemplateImportResult['stats'] | null>(null)
  const [lockOutputsOnImport, setLockOutputsOnImport] = useState(true)

  const { data: existing, isLoading } = useQuery({
    queryKey: ['calc-template', isNew ? 'new' : id],
    queryFn: () => calcTemplateApi.get(id!),
    enabled: !isNew,
  })

  // Mount Univer once; tear it down on unmount. Loads the existing snapshot
  // when editing, otherwise starts from a blank workbook.
  //
  // Univer mounts its own internal React root into the given container id.
  // React 19 StrictMode double-invokes this effect in dev (mount -> cleanup
  // -> mount) while the wrapper <div ref={containerRef}> itself stays in the
  // DOM the whole time — reusing that SAME element/id for both invokes let
  // the second Univer instance start mounting into a container the first
  // instance's (even synchronous) disposal was still tearing down, corrupting
  // both. Giving each invoke its OWN freshly-created child element/id avoids
  // any overlap, so disposal can stay synchronous and ordinary.
  useEffect(() => {
    if (!containerRef.current) return
    if (!isNew && isLoading) return // wait for the snapshot to arrive first

    const mountEl = document.createElement('div')
    mountEl.id = `calc-template-univer-${Math.random().toString(36).slice(2)}`
    mountEl.style.position = 'absolute'
    mountEl.style.inset = '0'
    containerRef.current.appendChild(mountEl)

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(sheetsCoreEnUS) },
      presets: [UniverSheetsCorePreset({ container: mountEl.id } as Partial<IUniverSheetsCorePresetConfig>)],
    })
    univerRef.current = { univer, univerAPI }

    // An import supersedes whatever was loaded from the server for this
    // template — the admin explicitly chose to replace the sheet.
    const snapshot = (imported?.workbook_data ?? existing?.workbook_data ?? {}) as Partial<IWorkbookData>
    // createWorkbook can throw or silently produce an empty sheet if the
    // snapshot is malformed (e.g. a cell entry with neither v/t nor a valid
    // f — see xlsxImport.ts's shared-formula handling). Previously this
    // failure was invisible: the "Excel imported" summary modal is populated
    // by the unrelated onFilePicked handler the moment the HTTP call
    // succeeds, so it always looked like the import worked even when the
    // grid ended up blank. Surface it instead of failing silently.
    try {
      univerAPI.createWorkbook(snapshot)
    } catch (err) {
      console.error('Failed to load workbook into Univer:', err)
      message.error('The imported sheet failed to load into the editor — see console for details.')
    }

    if (imported) {
      setFields(imported.metadata.fields ?? [])
      // Protection rules are runtime Univer objects, so an import can never
      // arrive with any — they are (re)created below against the new workbook.
      protectionRulesRef.current.clear()
      setProtectedRanges([])
      if (lockOutputsOnImport) void lockRangesForFields(univerAPI, imported.metadata.fields ?? [])
    } else if (existing?.metadata) {
      setFields(existing.metadata.fields ?? [])
      setProtectedRanges(existing.metadata.protectedRanges ?? [])
    }
    setReady(true)

    return () => {
      univer.dispose()
      mountEl.remove()
      univerRef.current = null
      setReady(false)
    }
    // `existing?.version` matters as much as the id: React Query hands back a
    // cached entry synchronously (so isLoading is already false) and only then
    // refetches. Keying solely on the id meant the grid was built once from
    // whatever snapshot was cached and the fresher data that arrived moments
    // later was never painted — reopening a template you had just edited could
    // still show the pre-edit sheet. The server bumps version on every
    // workbook/metadata write, so this re-mounts Univer exactly when the
    // authoritative snapshot actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, isLoading, existing?.id, existing?.version, importNonce])

  useEffect(() => {
    if (existing?.name) setName(existing.name)
  }, [existing?.name])

  const getActiveRange = () => {
    const univerAPI = univerRef.current?.univerAPI
    const workbook = univerAPI?.getActiveWorkbook()
    const range = workbook?.getActiveRange()
    if (!workbook || !range) return null
    const sheet = workbook.getActiveSheet()
    return { workbook, sheet, range, sheetId: sheet.getSheetId(), rangeRef: range.getRange() as CellRangeRef, display: range.getA1Notation() }
  }

  const openMarkFieldModal = () => {
    const active = getActiveRange()
    if (!active) {
      message.warning('Select a cell or range on the sheet first.')
      return
    }
    fieldForm.setFieldsValue({ key: '', label: '', role: 'input' })
    setFieldModalOpen(true)
  }

  const confirmMarkField = async () => {
    const vals = await fieldForm.validateFields()
    const active = getActiveRange()
    if (!active) { setFieldModalOpen(false); return }
    if (fields.some(f => f.key === vals.key)) {
      message.error(`Field key "${vals.key}" is already used — pick a unique key.`)
      return
    }
    setFields(prev => [...prev, {
      key: vals.key, label: vals.label, role: vals.role,
      sheetId: active.sheetId, range: active.rangeRef, display: active.display,
    }])
    setFieldModalOpen(false)
  }

  const removeField = (key: string) => setFields(prev => prev.filter(f => f.key !== key))

  const lockSelectedRange = async () => {
    const active = getActiveRange()
    if (!active) {
      message.warning('Select a cell or range on the sheet first.')
      return
    }
    if (protectedRanges.some(p => p.sheetId === active.sheetId && rangeRefEqual(p.range, active.rangeRef))) {
      message.info('This exact range is already locked.')
      return
    }
    try {
      const rule = await active.range.getRangePermission().protect({
        name: `Locked ${active.display}`,
        allowViewByOthers: true,
      })
      protectionRulesRef.current.set(rule.id, rule)
      setProtectedRanges(prev => [...prev, {
        ruleId: rule.id, permissionId: rule.permissionId,
        sheetId: active.sheetId, range: active.rangeRef, display: active.display,
      }])
      message.success(`${active.display} locked.`)
    } catch (err) {
      message.error('Failed to lock range — see console.')
      console.error(err)
    }
  }

  // Locks every `output` field in one pass. Imported formula cells are
  // computed by definition, so leaving them editable would let a filler
  // overwrite the calculation the template exists to perform.
  //
  // Runs against the univerAPI passed in rather than univerRef, because it is
  // called from inside the mount effect before that ref settles.
  async function lockRangesForFields(univerAPI: FUniver, toLock: CalcField[]) {
    const workbook = univerAPI.getActiveWorkbook()
    if (!workbook) return
    const created: ProtectedRangeMeta[] = []

    for (const field of toLock) {
      if (field.role !== 'output') continue
      try {
        const sheet = workbook.getSheetBySheetId(field.sheetId)
        if (!sheet) continue
        const r = field.range
        const range = sheet.getRange(
          r.startRow, r.startColumn,
          r.endRow - r.startRow + 1, r.endColumn - r.startColumn + 1,
        )
        const rule = await range.getRangePermission().protect({
          name: `Locked ${field.display}`,
          allowViewByOthers: true,
        })
        protectionRulesRef.current.set(rule.id, rule)
        created.push({
          ruleId: rule.id, permissionId: rule.permissionId,
          sheetId: field.sheetId, range: r, display: field.display,
        })
      } catch (err) {
        // One bad range shouldn't abandon the rest of the import.
        console.error(`Failed to lock ${field.display}`, err)
      }
    }
    if (created.length) setProtectedRanges(prev => [...prev, ...created])
  }

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked after a failure
    if (!file) return

    const hide = message.loading(`Converting ${file.name}…`, 0)
    try {
      const result = await calcTemplateApi.importXlsx(file)
      setImported(result)
      setImportNonce(n => n + 1) // triggers the remount that loads it
      setImportSummary(result.stats)
      if (isNew && name === 'New Calc Template') {
        setName(file.name.replace(/\.(xlsx|xlsm)$/i, ''))
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Import failed — see console.')
      console.error(err)
    } finally {
      hide()
    }
  }

  const confirmImport = () => {
    if (!existing?.workbook_data) { fileInputRef.current?.click(); return }
    Modal.confirm({
      title: 'Replace this sheet with an Excel file?',
      content: 'The current sheet, its named fields and its locked ranges will be replaced by the imported workbook. '
        + 'Nothing is saved until you click Save Draft or Publish, so you can still leave without keeping this.',
      okText: 'Choose file',
      onOk: () => fileInputRef.current?.click(),
    })
  }

  const unlockRange = async (meta: ProtectedRangeMeta) => {
    const rule = protectionRulesRef.current.get(meta.ruleId)
    try {
      if (rule) await rule.remove()
      protectionRulesRef.current.delete(meta.ruleId)
      setProtectedRanges(prev => prev.filter(p => p.ruleId !== meta.ruleId))
    } catch (err) {
      message.error('Failed to unlock range — see console.')
      console.error(err)
    }
  }

  const persist = useMutation({
    mutationFn: async (opts: { publish: boolean }) => {
      const workbook = univerRef.current?.univerAPI.getActiveWorkbook()
      if (!workbook) throw new Error('Workbook not ready')
      const workbook_data = workbook.save() as unknown as Record<string, unknown>
      const body = {
        name, slug: existing?.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        // New templates are tagged per module so each module's list only ever
        // shows its own templates; editing an existing one keeps its category.
        category: existing?.category ?? (scope === 'ADC' ? 'CALC_ADC' : 'CALC_CGT'),
        workbook_data, metadata: { fields, protectedRanges }, is_active: opts.publish,
      }
      return isNew ? calcTemplateApi.create(body) : calcTemplateApi.update(id!, body)
    },
    onSuccess: saved => {
      message.success('Saved.')
      // Without this, reopening the template could still be served the
      // pre-edit response from the query cache (30s default staleTime) —
      // the save genuinely succeeded, but a stale read made it look like
      // the edit had vanished.
      qc.invalidateQueries({ queryKey: ['calc-template', isNew ? 'new' : id] })
      qc.invalidateQueries({ queryKey: ['calc-templates'] })
      if (isNew) navigate(`${basePath}/${saved.id}`, { replace: true })
    },
    onError: (err: unknown) => {
      message.error(
        'Save failed — the /api/calc-templates backend hasn\'t been built yet (Phase 2). '
        + 'The sheet itself (formulas, marked fields, locked ranges) is fully working in this builder.',
      )
      console.error(err)
    },
  })

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(basePath)} className="text-slate-400 hover:text-violet-600">
            <ArrowLeft size={16} />
          </button>
          <Input value={name} onChange={e => setName(e.target.value)} className="w-64" placeholder="Template name" />
          {existing && <Tag color={existing.is_active ? 'green' : 'default'}>{existing.is_active ? 'Published' : 'Draft'}</Tag>}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={onFilePicked}
          />
          <Button icon={<FileSpreadsheet size={13} />} onClick={confirmImport}>Import Excel</Button>
          <Button icon={<Plus size={13} />} onClick={openMarkFieldModal} disabled={!ready}>Mark as Field</Button>
          <Button icon={<Lock size={13} />} onClick={lockSelectedRange} disabled={!ready}>Lock Selected Range</Button>
          <Button icon={<Save size={13} />} loading={persist.isPending} onClick={() => persist.mutate({ publish: existing?.is_active ?? false })}>
            Save Draft
          </Button>
          <Button type="primary" icon={<Send size={13} />} loading={persist.isPending} onClick={() => persist.mutate({ publish: true })}>
            Publish
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 relative">
          <div ref={containerRef} className="absolute inset-0" />
        </div>

        <div className="w-80 shrink-0 border-l border-slate-200 bg-white/60 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Named Fields ({fields.length})</p>
            <div className="space-y-1.5">
              {fields.map(f => (
                <div key={f.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-700 truncate">{f.label}</div>
                    <div className="text-slate-400 truncate">{f.key} · {f.display} · {f.role}</div>
                  </div>
                  <button onClick={() => removeField(f.key)} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                </div>
              ))}
              {fields.length === 0 && <p className="text-xs text-slate-300">Select a cell/range and click "Mark as Field".</p>}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Locked Ranges ({protectedRanges.length})</p>
            <div className="space-y-1.5">
              {protectedRanges.map(p => (
                <div key={p.ruleId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <Lock size={11} className="text-amber-500 shrink-0" />
                    <span className="truncate">{p.display}</span>
                  </div>
                  <Popconfirm title="Unlock this range?" onConfirm={() => unlockRange(p)}>
                    <button className="text-slate-300 hover:text-amber-500 shrink-0"><Unlock size={13} /></button>
                  </Popconfirm>
                </div>
              ))}
              {protectedRanges.length === 0 && <p className="text-xs text-slate-300">Select a range and click "Lock Selected Range".</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Post-import review — an import is lossy by design, so what did and
          did NOT come across is stated plainly before anything gets published. */}
      <AdminModal
        title="Excel imported"
        open={!!importSummary}
        onCancel={() => setImportSummary(null)}
        onOk={() => setImportSummary(null)}
        okText="Review the sheet"
        cancelButtonProps={{ style: { display: 'none' } }}
        destroyOnHidden
        // Univer paints the grid onto its own stacking context, which showed
        // straight through this dialog's default (token-driven) surface — the
        // summary text ended up unreadable over the cells behind it. Pin the
        // surface to an explicit opaque colour instead of inheriting it.
        styles={{ body: { background: '#ffffff' } }}
      >
        {importSummary && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              Carried over <b>{importSummary.sheets}</b> sheet{importSummary.sheets === 1 ? '' : 's'} with{' '}
              <b>{importSummary.formulas}</b> formula{importSummary.formulas === 1 ? '' : 's'} and{' '}
              <b>{importSummary.styles}</b> cell style{importSummary.styles === 1 ? '' : 's'}.
            </p>
            <p className="text-slate-600">
              Suggested <b>{importSummary.suggested_fields}</b> named field
              {importSummary.suggested_fields === 1 ? '' : 's'} from the workbook's defined names and formula cells
              {lockOutputsOnImport && ', and locked the computed ones'}. These are guesses — review them in the
              right-hand panel before publishing.
            </p>

            <Checkbox
              checked={lockOutputsOnImport}
              onChange={e => setLockOutputsOnImport(e.target.checked)}
            >
              <span className="text-xs">Lock computed (formula) cells on import — applies to the next import</span>
            </Checkbox>

            {importSummary.fields_truncated && (
              <Alert
                type="info"
                showIcon
                message="Too many formula cells to list them all"
                description="Only the first 200 were turned into named fields. The remaining formulas still calculate correctly — mark any you need as fields by hand."
              />
            )}

            {importSummary.dropped.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="Not carried over"
                description={
                  <>
                    <span>{importSummary.dropped.join(', ')}.</span>
                    <br />
                    <span className="text-xs text-slate-500">
                      Univer's core sheet has no equivalent for these — rebuild them here if the template needs them.
                    </span>
                  </>
                }
              />
            )}

            <p className="text-xs text-slate-400">
              Nothing has been saved yet. Click Save Draft or Publish to keep this.
            </p>
          </div>
        )}
      </AdminModal>

      <AdminModal
        title="Mark Selected Range as a Field"
        open={fieldModalOpen}
        onOk={confirmMarkField}
        onCancel={() => setFieldModalOpen(false)}
        okText="Add Field"
        destroyOnHidden
      >
        <Form form={fieldForm} layout="vertical">
          <Form.Item label="Field Key (internal, unique)" name="key" rules={[
            { required: true, message: 'Required' },
            { pattern: /^[a-z][a-z0-9_]*$/, message: 'lowercase letters, numbers, underscores only' },
          ]}>
            <Input placeholder="e.g. dose_input" />
          </Form.Item>
          <Form.Item label="Label (shown to the user)" name="label" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Dose (mg)" />
          </Form.Item>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select options={[
              { value: 'input', label: 'Input — user fills this in' },
              { value: 'output', label: 'Output — computed by formula' },
            ]} />
          </Form.Item>
        </Form>
      </AdminModal>
    </div>
  )
}
