import { useEffect, useRef, useState } from 'react'
import { Modal, Button, Input, Select, Form, message, Popconfirm, Segmented } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Plus, Lock, Unlock, Trash2 } from 'lucide-react'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import type { IUniverSheetsCorePresetConfig } from '@univerjs/preset-sheets-core'
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
import type { FUniver } from '@univerjs/core/lib/facade'
import { glassModalProps, glassModalStyles } from '../../../utils/modalStyles'
import type { IWorkbookData } from '@univerjs/core'
// Univer does not publish this internal facade type in the installed package.
// Rules are only retained as opaque handles for the active editor session.
type FRangeProtectionRule = { remove: () => Promise<unknown> | void }
import type { CalcField, CalcFieldRole, CellRangeRef, ProtectedRangeMeta } from '../calcTemplates/types'
import type { TemplateField } from './types'
import { calcTemplateApi } from '../../../api/calcTemplates'
import SpreadsheetFieldRuntime from './SpreadsheetFieldRuntime'

// Two ways to configure a SPREADSHEET field's sheet:
//   'inline'   — same mechanics as CalcTemplateBuilderPage.tsx (mark a range
//     as a named input/output field, lock a range via the Permission Facade
//     API), authored right here — Save just writes back into the field
//     object, no backend call, no versioning.
//   'template' — pick an already-published Admin > Calc Templates template;
//     PINS its current version at pick time (see types.ts) rather than
//     tracking "latest", so publishing a newer version there later doesn't
//     change this field. No live Univer editor for this mode — just a
//     picker + a read-only preview (via the same runtime used everywhere
//     else) so the admin can confirm they picked the right one.
function rangeRefEqual(a: CellRangeRef, b: CellRangeRef) {
  return a.startRow === b.startRow && a.startColumn === b.startColumn && a.endRow === b.endRow && a.endColumn === b.endColumn
}

export default function SpreadsheetFieldEditorModal({ open, spreadsheet, onSave, onClose }: {
  open: boolean
  spreadsheet: TemplateField['spreadsheet']
  onSave: (spreadsheet: NonNullable<TemplateField['spreadsheet']>) => void
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const univerRef = useRef<{ univer: import('@univerjs/core').Univer; univerAPI: FUniver } | null>(null)
  const protectionRulesRef = useRef<Map<string, FRangeProtectionRule>>(new Map())

  const [mode, setMode] = useState<'inline' | 'template'>(spreadsheet?.mode ?? 'inline')
  const [ready, setReady] = useState(false)
  const [fields, setFields] = useState<CalcField[]>(spreadsheet?.fields ?? [])
  const [protectedRanges, setProtectedRanges] = useState<ProtectedRangeMeta[]>(spreadsheet?.protectedRanges ?? [])
  const [fieldModalOpen, setFieldModalOpen] = useState(false)
  const [fieldForm] = Form.useForm<{ key: string; label: string; role: CalcFieldRole }>()

  const [templateId, setTemplateId] = useState<string | undefined>(spreadsheet?.calcTemplateId)
  const [templateVersion, setTemplateVersion] = useState<number | undefined>(spreadsheet?.calcTemplateVersion)
  const [templateName, setTemplateName] = useState<string | undefined>(spreadsheet?.calcTemplateName)

  useEffect(() => {
    if (!open) return
    setMode(spreadsheet?.mode ?? 'inline')
    setTemplateId(spreadsheet?.calcTemplateId)
    setTemplateVersion(spreadsheet?.calcTemplateVersion)
    setTemplateName(spreadsheet?.calcTemplateName)
  }, [open, spreadsheet])

  const { data: publishedTemplates = [] } = useQuery({
    queryKey: ['calc-templates', 'published'],
    queryFn: () => calcTemplateApi.list({ is_active: true, limit: 200 }),
    enabled: open && mode === 'template',
  })

  const pickTemplate = async (id: string) => {
    const detail = await calcTemplateApi.get(id)
    setTemplateId(detail.id)
    setTemplateVersion(detail.version)
    setTemplateName(detail.name)
  }

  // ── Inline mode: mount a live Univer editor ──────────────────────────────
  useEffect(() => {
    if (!open || mode !== 'inline') return

    // antd's Modal (with destroyOnHidden) doesn't guarantee its body content
    // is attached to the DOM in the SAME commit `open` flips true — a bare
    // `if (!containerRef.current) return` here silently no-ops forever once
    // that race is lost (found by testing: the container div existed but
    // stayed empty, ready never became true). Poll a couple of animation
    // frames instead of assuming synchronous availability.
    let cancelled = false
    let rafId: number | null = null
    let univer: import('@univerjs/core').Univer | undefined
    let mountEl: HTMLDivElement | undefined

    const tryMount = () => {
      if (cancelled) return
      if (!containerRef.current) {
        rafId = requestAnimationFrame(tryMount)
        return
      }
      mountEl = document.createElement('div')
      mountEl.id = `spreadsheet-field-univer-${Math.random().toString(36).slice(2)}`
      mountEl.style.position = 'absolute'
      mountEl.style.inset = '0'
      containerRef.current.appendChild(mountEl)

      const created = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: mergeLocales(sheetsCoreEnUS) },
        presets: [UniverSheetsCorePreset({ container: mountEl.id } as Partial<IUniverSheetsCorePresetConfig>)],
      })
      univer = created.univer
      univerRef.current = created
      created.univerAPI.createWorkbook((spreadsheet?.workbookData as Partial<IWorkbookData> | null) ?? {})
      setFields(spreadsheet?.fields ?? [])
      setProtectedRanges(spreadsheet?.protectedRanges ?? [])
      protectionRulesRef.current = new Map()
      setReady(true)
    }
    tryMount()

    return () => {
      cancelled = true
      if (rafId != null) cancelAnimationFrame(rafId)
      univer?.dispose()
      mountEl?.remove()
      univerRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  const getActiveRange = () => {
    const univerAPI = univerRef.current?.univerAPI
    const workbook = univerAPI?.getActiveWorkbook()
    const range = workbook?.getActiveRange()
    if (!workbook || !range) return null
    const sheet = workbook.getActiveSheet()
    return { range, sheetId: sheet.getSheetId(), rangeRef: range.getRange() as CellRangeRef, display: range.getA1Notation() }
  }

  const openMarkFieldModal = () => {
    if (!getActiveRange()) {
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
      const rule = await active.range.getRangePermission().protect({ name: `Locked ${active.display}`, allowViewByOthers: true })
      protectionRulesRef.current.set(rule.id, rule)
      setProtectedRanges(prev => [...prev, {
        ruleId: rule.id, permissionId: rule.permissionId,
        sheetId: active.sheetId, range: active.rangeRef, display: active.display,
      }])
    } catch (err) {
      message.error('Failed to lock range — see console.')
      console.error(err)
    }
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

  const handleSave = () => {
    if (mode === 'template') {
      if (!templateId || templateVersion == null) {
        message.warning('Pick a Calc Template first.')
        return
      }
      onSave({ mode: 'template', workbookData: null, fields: [], protectedRanges: [], calcTemplateId: templateId, calcTemplateVersion: templateVersion, calcTemplateName: templateName })
      return
    }
    const workbook = univerRef.current?.univerAPI.getActiveWorkbook()
    if (!workbook) return
    onSave({ mode: 'inline', workbookData: workbook.save() as unknown as Record<string, unknown>, fields, protectedRanges })
  }

  return (
    <Modal
      title="Edit Spreadsheet"
      open={open}
      onCancel={onClose}
      width="90vw"
      centered
      styles={{ ...glassModalStyles, body: { ...glassModalStyles.body, minHeight: '70vh', padding: 16 } }}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="save" type="primary" onClick={handleSave}>Save</Button>,
      ]}
    >
      <Segmented
        className="mb-3"
        value={mode}
        onChange={v => setMode(v as 'inline' | 'template')}
        options={[
          { label: 'Author inline', value: 'inline' },
          { label: 'Use existing Calc Template', value: 'template' },
        ]}
      />

      {mode === 'template' ? (
        <div className="space-y-3">
          <Select
            className="w-full max-w-md"
            placeholder="Select a published Calc Template"
            value={templateId}
            onChange={pickTemplate}
            options={publishedTemplates.map(t => ({ value: t.id, label: `${t.name} (v${t.version})` }))}
            showSearch
            optionFilterProp="label"
          />
          {templateId && templateVersion != null && (
            <>
              <p className="text-[11px] text-slate-400">
                Pinned to <b>{templateName}</b>, version {templateVersion}. Publishing a newer version of this
                template later will NOT change this field — re-pick it here to upgrade.
              </p>
              <SpreadsheetFieldRuntime
                spreadsheet={{ mode: 'template', workbookData: null, fields: [], protectedRanges: [], calcTemplateId: templateId, calcTemplateVersion: templateVersion }}
                value={{}}
                onChange={() => {}}
                disabled
              />
            </>
          )}
        </div>
      ) : (
        <div className="flex" style={{ height: '65vh' }}>
          <div className="flex-1 min-w-0 relative">
            <div ref={containerRef} className="absolute inset-0" />
          </div>
          <div className="w-72 shrink-0 border-l border-slate-200 bg-white/60 overflow-y-auto p-3 space-y-4">
            <div className="flex gap-2">
              <Button size="small" icon={<Plus size={12} />} onClick={openMarkFieldModal} disabled={!ready}>Mark Field</Button>
              <Button size="small" icon={<Lock size={12} />} onClick={lockSelectedRange} disabled={!ready}>Lock Range</Button>
            </div>

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
                {fields.length === 0 && <p className="text-xs text-slate-300">Select a cell/range and click "Mark Field".</p>}
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
                {protectedRanges.length === 0 && <p className="text-xs text-slate-300">Select a range and click "Lock Range".</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        title="Mark Selected Range as a Field"
        open={fieldModalOpen}
        onOk={confirmMarkField}
        onCancel={() => setFieldModalOpen(false)}
        okText="Add Field"
        destroyOnHidden
        centered
        {...glassModalProps}
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
      </Modal>
    </Modal>
  )
}
