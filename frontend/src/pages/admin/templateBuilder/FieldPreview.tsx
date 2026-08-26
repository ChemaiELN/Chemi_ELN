import { Input, InputNumber, DatePicker, Select, Checkbox, Radio, Switch, Upload, Button } from 'antd'
import { Paperclip, Image as ImageIcon, Lock, PenLine, FileSearch, Play, Square } from 'lucide-react'
import dayjs from 'dayjs'
import type { TemplateField, TemplateScreen } from './types'
import InventorySelect from './InventorySelect'
import SpreadsheetFieldRuntime from './SpreadsheetFieldRuntime'
import KetcherField from './KetcherField'
import RichEditor, { RichDisplay } from '../../../components/RichEditor'
import AtrRequestField from '../../cgt/components/AtrRequestField'
import TimerField, { type TimerFieldValue } from '../../cgt/components/TimerField'

const _isRgTable = (s: TemplateScreen) => /\((?:entry\s+|expandable\s+(?:[A-Z]\s+)?)?table\)\s*$/i.test(s.title.trim())
const _rgCleanTitle = (t: string) => t.replace(/\s*\((?:entry\s+|expandable\s+(?:[A-Z]\s+)?)?table\)\s*$/i, '').trim()

// Renders a single field exactly as an end user would see it — used by both
// the design canvas (non-interactive, for layout preview) and the real
// Preview modal (interactive, respects required/readOnly/hidden).
// `value`/`onChange` are optional — pass them (Preview modal) to get a
// controlled field whose edits actually stick and can drive autofill, same
// as the real CGT runtime form; omit them (design canvas) for the old
// uncontrolled/defaultValue-only rendering.
export default function FieldPreview({ field, interactive = false, bare = false, value, onChange, filterValue, excludeValues, onTotalCount }: {
  field: TemplateField
  interactive?: boolean
  bare?: boolean
  value?: unknown
  onChange?: (value: unknown) => void
  filterValue?: unknown   // sibling material value, for cascading batch dropdowns
  excludeValues?: unknown[]              // values already picked by other rows of this column
  onTotalCount?: (n: number | undefined) => void  // reports total option count up to the table
}) {
  if (field.hidden && !interactive) {
    return <div className="text-xs text-slate-400 italic border border-dashed border-slate-200 rounded px-2 py-1.5">Hidden field: {field.label}</div>
  }
  if (field.hidden && interactive) return null

  const controlled = interactive && onChange !== undefined
  const commonProps = { placeholder: field.placeholder, disabled: field.readOnly || !interactive }

  const control = (() => {
    switch (field.type) {
      case 'SECTION_HEADING':
        return <div className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-1.5">{field.label}</div>
      case 'SPACER':
        return <div className="h-6" />
      case 'LOCK_TOGGLE':
        return (
          <Button icon={<Lock size={12} />} disabled className="!text-slate-400">
            {field.label || 'Lock Fields Above'}
          </Button>
        )
      case 'SINGLE_LINE_TEXT':
        return controlled
          ? <Input {...commonProps} value={(value as string) ?? ''} maxLength={field.maxLength} onChange={e => onChange!(e.target.value)} />
          : <Input {...commonProps} defaultValue={field.defaultValue} maxLength={field.maxLength} />
      case 'MULTI_LINE_TEXT':
        return controlled
          ? <Input.TextArea {...commonProps} rows={3} value={(value as string) ?? ''} maxLength={field.maxLength} onChange={e => onChange!(e.target.value)} />
          : <Input.TextArea {...commonProps} rows={3} defaultValue={field.defaultValue} maxLength={field.maxLength} />
      case 'RICH_TEXT':
        if (field.readOnly || !interactive) return <RichDisplay html={controlled ? (value as string) : field.defaultValue} />
        return controlled
          ? <RichEditor value={(value as string) ?? ''} onChange={onChange} placeholder={field.placeholder} />
          : <RichEditor value={field.defaultValue} placeholder={field.placeholder} />
      case 'NUMBER':
        return controlled
          ? <InputNumber {...commonProps} className="w-full" value={value as number | null | undefined} min={field.minValue} max={field.maxValue} addonAfter={field.unit || undefined} onChange={v => onChange!(v)} />
          : <InputNumber {...commonProps} className="w-full" defaultValue={field.defaultValue ? Number(field.defaultValue) : undefined} min={field.minValue} max={field.maxValue} addonAfter={field.unit || undefined} />
      case 'DATE':
        return controlled
          ? <DatePicker className="w-full" disabled={field.readOnly || !interactive} format="DD/MM/YYYY" value={value ? dayjs(value as string) : null} onChange={d => onChange!(d ? d.format('YYYY-MM-DD') : null)} />
          : <DatePicker className="w-full" disabled={field.readOnly || !interactive} format="DD/MM/YYYY" />
      case 'DATE_TIME':
        return controlled
          ? <DatePicker showTime className="w-full" disabled={field.readOnly || !interactive} format="DD/MM/YYYY HH:mm" value={value ? dayjs(value as string) : null} onChange={d => onChange!(d ? d.toISOString() : null)} />
          : <DatePicker showTime className="w-full" disabled={field.readOnly || !interactive} format="DD/MM/YYYY HH:mm" />
      case 'YES_NO':
        return controlled
          ? <Switch disabled={field.readOnly || !interactive} checked={value === true || value === 'true'} onChange={c => onChange!(c)} />
          : <Switch disabled={field.readOnly || !interactive} defaultChecked={field.defaultValue === 'true'} />
      case 'DROPDOWN':
        // 'screenRows' options come from another screen's entered rows —
        // this preview only simulates one section in isolation, so it can't
        // resolve them; show a disabled placeholder instead of a real list.
        if (field.optionsMode === 'screenRows') {
          return <Select className="w-full" disabled placeholder="(reads entered rows in the running experiment)" />
        }
        return field.optionsMode === 'inventory' && field.inventorySource ? (
          <InventorySelect field={field} value={controlled ? value : undefined} onChange={controlled ? onChange! : () => {}} disabled={field.readOnly || !interactive} allowClear filterValue={filterValue} excludeValues={excludeValues} onTotalCount={onTotalCount} />
        ) : controlled ? (
          <Select
            className="w-full"
            placeholder={field.placeholder ?? 'Select…'}
            disabled={field.readOnly || !interactive}
            showSearch
            optionFilterProp="label"
            value={value as string | undefined}
            onChange={v => onChange!(v)}
            allowClear
            options={(field.options ?? []).map(o => ({ value: o, label: o }))}
          />
        ) : (
          <Select
            className="w-full"
            placeholder={field.placeholder ?? 'Select…'}
            disabled={field.readOnly || !interactive}
            showSearch
            optionFilterProp="label"
            options={(field.options ?? []).map(o => ({ value: o, label: o }))}
          />
        )
      case 'CHECKBOX':
        return controlled
          ? <Checkbox disabled={field.readOnly || !interactive} checked={value === true || value === 'true'} onChange={e => onChange!(e.target.checked)}>{field.placeholder || 'Yes'}</Checkbox>
          : <Checkbox disabled={field.readOnly || !interactive} defaultChecked={field.defaultValue === 'true'}>{field.placeholder || 'Yes'}</Checkbox>
      case 'CHECKLIST':
        return controlled ? (
          <Checkbox.Group
            disabled={field.readOnly || !interactive}
            options={(field.options ?? []).map(o => ({ value: o, label: o }))}
            value={(value as string[]) ?? []}
            onChange={v => onChange!(v)}
            className="flex flex-col gap-1"
          />
        ) : (
          <Checkbox.Group
            disabled={field.readOnly || !interactive}
            options={(field.options ?? []).map(o => ({ value: o, label: o }))}
            className="flex flex-col gap-1"
          />
        )
      case 'RADIO':
        return (
          <Radio.Group
            disabled={field.readOnly || !interactive}
            {...(controlled ? { value, onChange: (e: any) => onChange!(e.target.value) } : {})}
          >
            <div className="flex flex-col gap-1">
              {(field.options ?? []).map(o => <Radio key={o} value={o}>{o}</Radio>)}
            </div>
          </Radio.Group>
        )
      case 'ATTACHMENT':
        return (
          <Upload disabled={field.readOnly || !interactive} beforeUpload={() => false}>
            <button type="button" className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50">
              <Paperclip size={12} /> Attach file
            </button>
          </Upload>
        )
      case 'IMAGE':
        return (
          <Upload disabled={field.readOnly || !interactive} listType="picture-card" beforeUpload={() => false} showUploadList={false}>
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <ImageIcon size={16} />
              <span className="text-[11px]">Upload</span>
            </div>
          </Upload>
        )
      case 'REPEATING_GROUP': {
        const rc = field.repeatConfig
        const rgScreens = rc?.screens ?? []
        const rgItemLabel = rc?.itemLabel ?? 'Item'
        const rgAddLabel = rc?.addButtonLabel ?? `Add ${rgItemLabel}`
        return (
          <div className="border border-violet-200 rounded-xl overflow-hidden">
            {/* Item header */}
            <div className="flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-200">
              <span className="text-xs font-semibold text-violet-700">{rgItemLabel} 1</span>
              <span className="text-[11px] text-slate-400 italic">repeating — &quot;{rgAddLabel}&quot; at runtime</span>
            </div>
            {/* Sub-screen fields (design-canvas preview) */}
            <div className="p-3 space-y-4">
              {rgScreens.map(subScreen => (
                <div key={subScreen.id}>
                  {_isRgTable(subScreen) ? (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                        {_rgCleanTitle(subScreen.title)}
                      </p>
                      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
                        {subScreen.fields.filter(f => f.type !== 'SECTION_HEADING' && f.type !== 'SPACER').map(f => f.label).join(' · ')}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: subScreen.columns === 2 ? '1fr 1fr' : '1fr',
                        gap: '10px 16px',
                      }}
                    >
                      {subScreen.fields.map(subField => {
                        const fw = subField.type === 'SECTION_HEADING' || subField.type === 'SPACER' ||
                          subField.type === 'MULTI_LINE_TEXT' || subField.type === 'RICH_TEXT' ||
                          subField.type === 'SPREADSHEET' || subField.colSpan === 2
                        return (
                          <div key={subField.id} style={{ gridColumn: fw ? 'span 2' : undefined }}>
                            <FieldPreview field={subField} interactive={false} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'SPREADSHEET':
        // Live only in the interactive Preview modal (controlled) — the
        // design canvas doesn't mount a Univer instance per field just to
        // show layout.
        if (controlled) {
          return (
            <SpreadsheetFieldRuntime
              spreadsheet={field.spreadsheet}
              value={value as Record<string, unknown> | undefined}
              onChange={onChange!}
              disabled={field.readOnly || !interactive}
            />
          )
        }
        return (
          <div className="text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-lg px-3 py-4 text-center">
            {field.spreadsheet?.mode === 'template' && field.spreadsheet.calcTemplateId
              ? `Spreadsheet field (references "${field.spreadsheet.calcTemplateName ?? field.spreadsheet.calcTemplateId}", v${field.spreadsheet.calcTemplateVersion})`
              : `Spreadsheet field${field.spreadsheet?.fields?.length ? ` (${field.spreadsheet.fields.length} marked field(s))` : ' (not yet authored)'}`}
          </div>
        )
      case 'SIGNATURE':
        // Static in both the design canvas and the interactive Preview modal
        // — real signing needs a password-verified backend call scoped to a
        // genuine experiment/section, which this builder preview has neither.
        return (
          <div className="flex items-center gap-2 border border-dashed border-slate-200 rounded-lg px-3 py-3">
            <Button size="small" disabled icon={<PenLine size={12} />}>Done By</Button>
            <Button size="small" disabled icon={<PenLine size={12} />}>Checked By</Button>
            <span className="text-[11px] text-slate-400 italic ml-1">Section sign-off — live at runtime only</span>
          </div>
        )
      case 'ATR_REQUEST':
        // Interactive Preview modal: mount the REAL AtrRequestField (Form Type
        // picker + full ATR Form) in `previewMode` — master-data GETs stay
        // live so authors see real dropdown options, but every write
        // (create/save/submit/deactivate/upload) is simulated client-side
        // inside AtrRequestField, never touching a real ard_atr_forms row.
        // The design canvas (non-interactive) keeps the old static placeholder.
        if (controlled) {
          return (
            <AtrRequestField
              label={field.label}
              helpText={field.helpText}
              value={value as { atrId?: string } | undefined}
              onChange={onChange!}
              disabled={field.readOnly || !interactive}
              previewMode
              originModule="CGT"
              originProjectId="preview"
              originProjectCode="PREVIEW"
              originProjectName="Preview Project"
              originNotebookId="preview"
              originNotebookCode="PREVIEW"
              originExperimentId="preview"
              originExperimentCode="PREVIEW"
              sectionId="preview"
              sectionTitle="Preview Section"
              experimentId="preview"
              showFormAttributes={field.atrRequestConfig?.showFormAttributes}
              showSampleDetails={field.atrRequestConfig?.showSampleDetails}
              showTestDetails={field.atrRequestConfig?.showTestDetails}
              showSupportingDocs={field.atrRequestConfig?.showSupportingDocs}
              showQaCertification={field.atrRequestConfig?.showQaCertification}
              lockedFormTypeId={field.atrRequestConfig?.lockedFormTypeId}
            />
          )
        }
        return (
          <div className="border border-dashed border-slate-200 rounded-lg px-3 py-3">
            <Button size="small" disabled icon={<FileSearch size={12} />}>ATR Request</Button>
            <span className="text-[11px] text-slate-400 italic ml-2">Opens Form Type picker &amp; ATR Form — live at runtime only</span>
          </div>
        )
      case 'USAGE_LOG_START_STOP':
        // Static in both the design canvas and Preview modal — real Start/End
        // needs a real catalogue id resolved from a sibling column at CGT/ADC
        // experiment runtime, which this builder preview doesn't have.
        return (
          <div className="flex items-center gap-2 border border-dashed border-slate-200 rounded-lg px-3 py-2.5">
            <Button size="small" disabled icon={<Play size={12} />} className="!text-slate-400">Start</Button>
            <Button size="small" disabled icon={<Square size={12} />} className="!text-slate-400">End</Button>
            <span className="text-[11px] text-slate-400 italic ml-1">Equipment/Instrument usage log — live at runtime only</span>
          </div>
        )
      case 'TIMER':
        // Purely local (no backend/inventory calls needed), so unlike
        // USAGE_LOG_START_STOP above this can be genuinely live in the
        // interactive Preview modal — only the design canvas gets the static
        // placeholder, same reasoning as KETCHER below.
        if (controlled) {
          return (
            <TimerField
              value={value as TimerFieldValue | undefined}
              onChange={onChange!}
              disabled={field.readOnly || !interactive}
              durationUnit={field.timerConfig?.durationUnit ?? 'minutes'}
            />
          )
        }
        return (
          <div className="flex items-center gap-2 border border-dashed border-slate-200 rounded-lg px-3 py-2.5">
            <Button size="small" disabled icon={<Play size={12} />} className="!text-slate-400">Start</Button>
            <Button size="small" disabled icon={<Square size={12} />} className="!text-slate-400">End</Button>
            <span className="text-[11px] text-slate-400 italic ml-1">Duration — live at runtime only</span>
          </div>
        )
      case 'KETCHER':
        // Live only in the interactive Preview modal (controlled) — the
        // design canvas doesn't mount the WASM chemical editor just to show
        // layout, same reasoning as SPREADSHEET above.
        if (controlled) {
          return (
            <KetcherField
              value={value as string | undefined}
              onChange={onChange!}
              disabled={field.readOnly || !interactive}
            />
          )
        }
        return (
          <div className="text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-lg px-3 py-4 text-center">
            Chemical structure field (Ketcher)
          </div>
        )
      default:
        return null
    }
  })()

  if (field.type === 'SECTION_HEADING' || field.type === 'SPACER' || field.type === 'LOCK_TOGGLE' || field.type === 'REPEATING_GROUP' || field.type === 'SIGNATURE' || field.type === 'ATR_REQUEST' || field.type === 'USAGE_LOG_START_STOP' || field.type === 'TIMER') return control

  // Bare mode: just the control (used inside table cells, where the column
  // header already carries the label).
  if (bare) return control

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium text-slate-600">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>
      {control}
      {field.helpText && <p className="text-[11px] text-slate-400 mt-1">{field.helpText}</p>}
    </div>
  )
}
