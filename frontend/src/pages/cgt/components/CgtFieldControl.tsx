import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, InputNumber, DatePicker, Select, Checkbox, Radio, Button, Tooltip, Popconfirm, message } from 'antd'
import { Paperclip, Clock3, Upload as UploadIcon, Trash2, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import type { TemplateField } from '../../admin/templateBuilder/types'
import InventorySelect from '../../admin/templateBuilder/InventorySelect'
import SpreadsheetFieldRuntime from '../../admin/templateBuilder/SpreadsheetFieldRuntime'
import KetcherField from '../../admin/templateBuilder/KetcherField'
import RichEditor, { RichDisplay } from '../../../components/RichEditor'
import { experimentApi } from '../../../api/adc'
import { idSequenceApi } from '../../../api/admin'
import { ApiError } from '../../../api/client'
import AtrRequestField from './AtrRequestField'
import UsageLogStartStopField from './UsageLogStartStopField'

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ATTACHMENT/IMAGE: real upload against the current experiment, scoped via
// `section_key` (repurposed as an opaque per-slot key the backend just
// stores and echoes back). Defaults to `field.id` — stable for the lifetime
// of an experiment since template_snapshot freezes at creation — but a
// table/repeating-group caller must pass an explicit `slotKey` combining the
// column's field.id with its row index, since field.id alone is shared by
// every row of that column and would otherwise mix all rows' files together.
function AttachmentControl({ slotKey, experimentId, disabled }: { slotKey: string; experimentId: string; disabled?: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const queryKey = ['experiment-files', experimentId] as const

  const { data: allFiles = [] } = useQuery({
    queryKey,
    queryFn: () => experimentApi.listFiles(experimentId),
  })
  const files = allFiles.filter(f => f.section_key === slotKey)

  const deleteMut = useMutation({
    mutationFn: (fileId: string) => experimentApi.deleteFile(experimentId, fileId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await experimentApi.uploadFile(experimentId, file, slotKey)
      await qc.invalidateQueries({ queryKey })
    } catch {
      message.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        size="small"
        icon={<UploadIcon size={12} />}
        loading={uploading}
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
      >
        Attach file
      </Button>
      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} disabled={disabled} />
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
              <FileText size={12} className="text-violet-400 shrink-0" />
              <span className="flex-1 min-w-0 truncate text-slate-600">{f.filename}</span>
              <span className="text-slate-400 shrink-0">{fileSize(f.file_size)}</span>
              {!disabled && (
                <Popconfirm title="Delete this file?" onConfirm={() => deleteMut.mutate(f.id)} okText="Delete" okButtonProps={{ danger: true }}>
                  <button className="text-slate-300 hover:text-red-500 transition-colors shrink-0"><Trash2 size={12} /></button>
                </Popconfirm>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// SINGLE_LINE_TEXT with `idSequence` set: a "Generate" button next to the
// (otherwise empty, read-only) input calls the admin-configured ID Numbering
// sequence and fills in the result — one-shot, like Batch Record ID/
// Intermediate Output ID elsewhere in this template; once generated the
// value is locked (no un-generate).
function IdGenerateControl({ value, onChange, code, disabled }: {
  value: unknown; onChange: (v: unknown) => void; code: string; disabled?: boolean
}) {
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await idSequenceApi.generate(code)
      onChange(res.value)
    } catch (e) {
      // 404 really does mean "no active sequence configured for this code" —
      // any other error (network, 401, 500) is unrelated to ID Numbering
      // setup and showing that hint for it just sends people down the wrong
      // path, so only show it for the specific case it actually describes.
      if (e instanceof ApiError && e.status === 404) {
        message.error('Could not generate ID — check that this ID type is configured under Admin > ID Numbering.')
      } else {
        message.error(e instanceof ApiError ? e.detail : 'Could not generate ID. Please try again.')
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex gap-1.5">
      <Input value={(value as string) ?? ''} disabled className="flex-1" placeholder="Not yet generated" />
      {!value && (
        <Button size="middle" loading={generating} disabled={disabled} onClick={handleGenerate}>Generate</Button>
      )}
    </div>
  )
}

// Renders ONE runtime control for a TemplateField (the same JSON shape the
// CGT Template Builder produces — section -> screen -> field, with `id`/`name`
// rather than ADC's legacy `key` schema, so ADC's FieldRenderer doesn't apply
// here). Fully controlled (value + onChange) for real data capture, unlike
// FieldPreview.tsx (templateBuilder) which only demos fields with defaultValue.
export default function CgtFieldControl({
  field, value, onChange, disabled, filterValue, excludeValues, onTotalCount, onBlur, rowOptions, experimentId, slotKey,
  atrOrigin, sectionBatchSku, sectionBatchId, row,
}: {
  field: TemplateField
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  // USAGE_LOG_START_STOP only: the full current row's data (a table/
  // repeating-group caller's row object) — needed to read a SIBLING
  // column's value (field.usageLogConfig.idFieldName), which this field
  // alone doesn't get via `value`/`onChange`. Omit outside table rows.
  row?: Record<string, unknown>
  filterValue?: unknown   // sibling material code, for cascading batch dropdowns
  excludeValues?: unknown[]              // values already picked by other rows of this column
  onTotalCount?: (n: number | undefined) => void  // reports total option count up to the table
  onBlur?: () => void      // NUMBER only — fires field.computation (add/subtract into another field)
  rowOptions?: { value: string; label: string }[]  // DROPDOWN with optionsMode 'screenRows' — resolved by the caller (needs whole-run data)
  experimentId?: string    // ATTACHMENT/IMAGE/ATR_REQUEST only — real upload/ATR needs the owning experiment
  slotKey?: string         // ATTACHMENT/IMAGE only — overrides the default field.id upload scope; REQUIRED from a table/repeating-group row (see AttachmentControl)
  // ATR_REQUEST only — provenance recorded onto the created ArdAtrForm's
  // origin_* columns (see AtrRequestField.tsx). Omit outside CGT/ADC experiment
  // screens (falls back to a disabled placeholder there is no valid case for today).
  atrOrigin?: {
    originModule: 'ADC' | 'CGT'
    originProjectId?: string | null
    originProjectCode?: string | null
    originProjectName?: string | null
    originNotebookId?: string | null
    originNotebookCode?: string | null
    originExperimentCode?: string | null
    sectionId?: string | null
    sectionTitle?: string | null
  }
  // ATR_REQUEST only — the section's own "Batch Information (table)" screen's
  // already-selected batch (SKU/Pack ID text + real InvBatch.id), read by
  // AtrRequestField's Sample Details "Batch No." column instead of offering
  // a separate cross-inventory picker. See CgtSectionPage.tsx for how these
  // are derived.
  sectionBatchSku?: string
  sectionBatchId?: number
}) {
  // Auto-filled fields are read-only unless explicitly marked editable — their
  // value is derived from the driver dropdown's selected record.
  const locked = !!field.autoFill && !field.autoFill.editable
  const dis = disabled || locked
  const commonProps = { placeholder: field.placeholder, disabled: dis }

  switch (field.type) {
    case 'SECTION_HEADING':
      return <div className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-1.5">{field.label}</div>
    case 'SPACER':
      return <div className="h-6" />
    case 'SINGLE_LINE_TEXT':
      if (field.idSequence) {
        return <IdGenerateControl value={value} onChange={onChange} code={field.idSequence} disabled={dis} />
      }
      return <Input {...commonProps} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} maxLength={field.maxLength} />
    case 'MULTI_LINE_TEXT':
      return <Input.TextArea {...commonProps} rows={3} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} maxLength={field.maxLength} />
    case 'RICH_TEXT':
      return dis
        ? <RichDisplay html={value as string} />
        : <RichEditor value={(value as string) ?? ''} onChange={onChange} placeholder={field.placeholder} />
    case 'NUMBER':
      return (
        <InputNumber
          {...commonProps} className="w-full"
          value={value === '' || value == null ? undefined : Number(value)}
          onChange={v => onChange(v)}
          onBlur={onBlur}
          min={field.minValue} max={field.maxValue}
          addonAfter={field.unit || undefined}
        />
      )
    case 'DATE':
      return (
        <DatePicker
          className="w-full" disabled={dis} format="DD/MM/YYYY"
          value={value ? dayjs(value as string) : null}
          onChange={d => onChange(d ? d.format('YYYY-MM-DD') : null)}
        />
      )
    case 'DATE_TIME':
      return (
        <div className="flex items-center gap-1.5">
          <DatePicker
            showTime className="w-full" disabled={dis} format="DD/MM/YYYY HH:mm"
            value={value ? dayjs(value as string) : null}
            onChange={d => onChange(d ? d.toISOString() : null)}
          />
          {field.quickStamp && (
            <Tooltip title="Stamp current time">
              <Button size="small" icon={<Clock3 size={12} />} disabled={dis} onClick={() => onChange(new Date().toISOString())}>
                Now
              </Button>
            </Tooltip>
          )}
        </div>
      )
    case 'DROPDOWN':
      if (field.optionsMode === 'inventory' && field.inventorySource) {
        return <InventorySelect field={field} value={value} onChange={onChange} disabled={dis} allowClear filterValue={filterValue} excludeValues={excludeValues} onTotalCount={onTotalCount} />
      }
      if (field.optionsMode === 'screenRows') {
        return (
          <Select
            className="w-full"
            placeholder={field.placeholder ?? 'Select…'}
            disabled={dis}
            value={(value as string) || undefined}
            onChange={v => onChange(v)}
            options={rowOptions ?? []}
            showSearch
            optionFilterProp="label"
            allowClear
            notFoundContent={(rowOptions ?? []).length === 0 ? 'No rows entered yet — fill in the source screen first' : undefined}
          />
        )
      }
      return (
        <Select
          className="w-full" placeholder={field.placeholder ?? 'Select…'} disabled={dis}
          value={(value as string) || undefined}
          onChange={v => onChange(v)}
          options={(field.options ?? []).map(o => ({ value: o, label: o }))}
          showSearch
          optionFilterProp="label"
          allowClear
        />
      )
    case 'CHECKBOX':
      return <Checkbox disabled={dis} checked={!!value} onChange={e => onChange(e.target.checked)}>{field.placeholder || 'Yes'}</Checkbox>
    case 'CHECKLIST':
      return (
        <Checkbox.Group
          disabled={dis}
          value={(value as string[]) ?? []}
          onChange={v => onChange(v)}
          options={(field.options ?? []).map(o => ({ value: o, label: o }))}
          className="flex flex-col gap-1"
        />
      )
    case 'RADIO':
      return (
        <Radio.Group disabled={dis} value={(value as string) ?? undefined} onChange={e => onChange(e.target.value)}>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(field.options ?? []).map(o => <Radio key={o} value={o}>{o}</Radio>)}
          </div>
        </Radio.Group>
      )
    case 'ATTACHMENT':
    case 'IMAGE':
      return experimentId
        ? <AttachmentControl slotKey={slotKey ?? field.id} experimentId={experimentId} disabled={dis} />
        : (
          <button type="button" disabled className="flex items-center gap-1.5 text-xs text-slate-400 border border-dashed border-slate-200 rounded-md px-3 py-1.5 cursor-not-allowed">
            <Paperclip size={12} /> File upload not yet available
          </button>
        )
    case 'SPREADSHEET':
      return (
        <SpreadsheetFieldRuntime
          spreadsheet={field.spreadsheet}
          value={value as Record<string, unknown> | undefined}
          onChange={onChange}
          disabled={dis}
        />
      )
    case 'KETCHER':
      return (
        <KetcherField
          value={value as string | undefined}
          onChange={onChange}
          disabled={dis}
        />
      )
    case 'ATR_REQUEST':
      return atrOrigin
        ? (
          <AtrRequestField
            label={field.label}
            helpText={field.helpText}
            value={value as { atrId?: string } | undefined}
            onChange={onChange}
            disabled={dis}
            experimentId={experimentId}
            originModule={atrOrigin.originModule}
            originProjectId={atrOrigin.originProjectId}
            originProjectCode={atrOrigin.originProjectCode}
            originProjectName={atrOrigin.originProjectName}
            originNotebookId={atrOrigin.originNotebookId}
            originNotebookCode={atrOrigin.originNotebookCode}
            originExperimentId={experimentId}
            originExperimentCode={atrOrigin.originExperimentCode}
            sectionId={atrOrigin.sectionId}
            sectionTitle={atrOrigin.sectionTitle}
            sectionBatchSku={sectionBatchSku}
            sectionBatchId={sectionBatchId}
            showFormAttributes={field.atrRequestConfig?.showFormAttributes}
            showSampleDetails={field.atrRequestConfig?.showSampleDetails}
            showTestDetails={field.atrRequestConfig?.showTestDetails}
            showSupportingDocs={field.atrRequestConfig?.showSupportingDocs}
            showQaCertification={field.atrRequestConfig?.showQaCertification}
            lockedFormTypeId={field.atrRequestConfig?.lockedFormTypeId}
          />
        )
        : (
          <button type="button" disabled className="flex items-center gap-1.5 text-xs text-slate-400 border border-dashed border-slate-200 rounded-md px-3 py-1.5 cursor-not-allowed">
            <Paperclip size={12} /> ATR Request not available here
          </button>
        )
    case 'USAGE_LOG_START_STOP': {
      const idFieldName = field.usageLogConfig?.idFieldName
      const rawId = idFieldName ? row?.[idFieldName] : undefined
      const catalogueId = rawId != null && rawId !== '' ? Number(rawId) : undefined
      return (
        <UsageLogStartStopField
          value={value as { usageLogId?: string; status?: 'RUNNING' | 'ENDED' } | undefined}
          onChange={onChange}
          disabled={dis}
          targetKind={field.usageLogConfig?.targetKind ?? 'EQUIPMENT'}
          catalogueId={Number.isFinite(catalogueId) ? catalogueId : undefined}
          experimentId={experimentId}
        />
      )
    }
    default:
      return null
  }
}
