import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Select, Tag, message, Card, Popconfirm, Space, Checkbox, Form, Tooltip, Empty, Segmented, InputNumber, Upload, Modal,
} from 'antd'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Eye, Edit2, Save, ArrowLeft, CheckCircle, Send, AlertCircle, FileText, Copy,
  Layers, Grid, Sliders, Database, Table2, LayoutGrid, CheckSquare, Scale, TestTube, ShieldCheck, Cpu, Beaker,
  BarChart2, RotateCcw, GripVertical, Upload as UploadIcon, BookOpen, ChevronDown,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  ardApi, ardTemplateApi, ardSectionApi, ardDataItemApi, type ArdTemplateSectionAttachment, type ArdMasterSection,
  type TemplateStatus, type ArdTemplateDoc, type SectionType,
} from '../../api/ard'
import { ApiError } from '../../api/client'
import SpreadsheetFieldRuntime from '../admin/templateBuilder/SpreadsheetFieldRuntime'
import RichEditor, { RichDisplay } from '../../components/RichEditor'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

function statusTag(status: TemplateStatus) {
  const color =
    status === 'PUBLISHED'
      ? 'green'
      : status === 'PENDING_APPROVAL'
        ? 'gold'
        : status === 'REWORK'
          ? 'red'
          : status === 'SUPERSEDED'
            ? 'default'
            : 'default'
  return <Tag color={color}>{status ? status.replace(/_/g, ' ') : status}</Tag>
}

// A section attached to this template version, joined with its master
// ArdSection for display — local editable state until Save is clicked
// (rearchitecture prompt §1.6: attachment flags belong to the join row, not
// the section's own content).
interface Attachment extends ArdTemplateSectionAttachment {
  section: ArdMasterSection
}

// The other four attachment flags (includeInEmpower, updateSampleWeights,
// updateResultSample, includeReadWeighingExcel) are carried in the data model
// but have no consumer anywhere in the app (confirmed: no Empower export, no
// sample-weight/result-sample write-back, no weighing-spreadsheet read path
// exists yet) — hidden from the UI per product review 2026-08-25 rather than
// showing controls that don't do anything. Re-add here if those features land.
const ATTACH_FLAGS: { key: keyof ArdTemplateSectionAttachment; label: string; hint: string }[] = [
  { key: 'includeInCloning', label: 'Include when cloning', hint: 'Carried over when this template is cloned' },
]

// Block Palette catalog — restores the old builder's grouped, iconed picker.
// Types come from the backend's SECTION_TYPES catalog (ardTemplates.routes.ts
// /section-types); grouping/icons/hints are cosmetic and kept in sync by hand.
// `label` mirrors the backend's SECTION_TYPES catalog (ardSectionTypes.ts)
// exactly, so a newly created section's default name reads as a real name
// ("Weighing Details (5c9x)") instead of the raw snake_case type
// ("New weighing section 5c9x").
//
// Which types are "Fixed Sections" (Core vs Lab in the palette below) is
// NOT decided here anymore — it comes from the `fixed` flag on
// ardTemplateApi.sectionTypes() (backed by ardSectionTypes.ts's own SECTION_TYPES,
// see fixedTypeSet below), so the backend's real singleton-enforcement and
// this page's grouping can never drift apart the way the old locally-guessed
// `group` field could. icon/hint stay here — purely cosmetic, not something
// the backend has an opinion on.
const BLOCK_CATALOG: { type: SectionType; label: string; icon: any; hint: string }[] = [
  { type: 'richtext', label: 'Rich Text', icon: FileText, hint: 'Multi-line narrative block & instructions' },
  { type: 'params', label: 'Parameters', icon: Sliders, hint: 'Key-value result parameter entries' },
  { type: 'table', label: 'Data Table', icon: Table2, hint: 'Custom multi-row table with defined columns' },
  { type: 'combined', label: 'Combined', icon: Layers, hint: 'Param block + Data Table block together' },
  { type: 'preconfigured_excel', label: 'Preconfigured Spreadsheet', icon: Grid, hint: 'Embedded preconfigured spreadsheet' },
  { type: 'standard_preparation', label: 'Standard Preparation', icon: LayoutGrid, hint: 'Standard preparation narrative block' },
  { type: 'data_item', label: 'Data Item', icon: Database, hint: 'Dropdown select from Master Data items' },
  { type: 'autocomplete_data_item', label: 'Autocomplete Data Item', icon: Database, hint: 'Searchable autocomplete master data field' },
  { type: 'content_block', label: 'Content Block', icon: BookOpen, hint: 'Reusable rich-text / document from Content Library' },
  { type: 'weighing', label: 'Weighing Details', icon: Scale, hint: 'Substance, tare, gross, net weight & balance ID' },
  { type: 'ph', label: 'pH Details', icon: TestTube, hint: 'Solution, pH value, temp, buffer & meter ID' },
  { type: 'equipment', label: 'Equipment Details', icon: ShieldCheck, hint: 'Equipment ID, calibration date & operator' },
  { type: 'column', label: 'Column Details', icon: Cpu, hint: 'Column serial, injections, N, TF & pressure' },
  { type: 'chemical', label: 'Material / Chemical Details', icon: Beaker, hint: 'Reagents, lot/batch, supplier, exp date' },
  { type: 'sample_details', label: 'Sample Details', icon: TestTube, hint: 'Sample/batch identification columns' },
  { type: 'quantitative_result', label: 'Quantitative Results', icon: BarChart2, hint: 'Param code, specification, result & compliance' },
  { type: 'further_actions', label: 'Further Actions', icon: CheckSquare, hint: 'Follow-up actions, target date & status' },
]

// Fallback only, used for the single render before ardTemplateApi.sectionTypes()
// resolves — the real, authoritative classification is fetched fixedTypeSet.
const FIXED_TYPES_FALLBACK = new Set<SectionType>([
  'weighing', 'ph', 'equipment', 'column', 'chemical', 'sample_details', 'quantitative_result', 'further_actions',
])

const RICHTEXT_TYPES: SectionType[] = ['richtext', 'standard_preparation']
const DATATABLE_TYPES: SectionType[] = ['table', 'combined', 'weighing', 'ph', 'equipment', 'column', 'chemical', 'sample_details', 'quantitative_result', 'further_actions']
const SINGLE_DATA_ITEM_TYPES: SectionType[] = ['data_item', 'autocomplete_data_item']
const MULTI_DATA_ITEM_TYPES: SectionType[] = ['params', 'combined']
const EMBEDDED_FILE_TYPES: SectionType[] = ['preconfigured_excel']
const CONTENT_BLOCK_TYPES: SectionType[] = ['content_block']
// Old's fixed GxP lab blocks used free-text key/title columns, not a Master
// Data link — 'table'/'combined' stay on the governed dataItemId-mapped
// column editor (a genuinely configurable Data Table should point at real
// Master Data), matching the reconciliation the user asked for.
const LAB_FREE_TEXT_TYPES: SectionType[] = ['weighing', 'ph', 'equipment', 'column', 'chemical', 'sample_details', 'quantitative_result', 'further_actions']

// Ported verbatim from the old builder's getDefaultGxPColumns().
function getDefaultGxPColumns(type: SectionType): { columnKey: string; columnLabel: string }[] {
  if (type === 'sample_details') {
    return [
      { columnKey: 'atr_form_no', columnLabel: 'ATR Form No.' },
      { columnKey: 'project_code', columnLabel: 'Project Code' },
      { columnKey: 'sample_code', columnLabel: 'Sample Code' },
      { columnKey: 'sample_type', columnLabel: 'Sample Type' },
      { columnKey: 'test_subtype', columnLabel: 'Test Sub-type' },
      { columnKey: 'batch_no', columnLabel: 'Batch No.' },
      { columnKey: 'sample_condition', columnLabel: 'Sample Condition' },
      { columnKey: 'qty', columnLabel: 'Quantity / UOM' },
      { columnKey: 'ar_number', columnLabel: 'AR Number' },
      { columnKey: 'status', columnLabel: 'Status' },
    ]
  }
  if (type === 'weighing') {
    return [
      { columnKey: 'substance', columnLabel: 'Substance / Sample Name' },
      { columnKey: 'tare_wt', columnLabel: 'Tare Weight (g)' },
      { columnKey: 'gross_wt', columnLabel: 'Gross Weight (g)' },
      { columnKey: 'net_wt', columnLabel: 'Net Weight (g)' },
      { columnKey: 'balance_id', columnLabel: 'Balance ID' },
    ]
  }
  if (type === 'ph') {
    return [
      { columnKey: 'solution_name', columnLabel: 'Solution Name' },
      { columnKey: 'ph_val', columnLabel: 'Measured pH' },
      { columnKey: 'temperature', columnLabel: 'Temperature (°C)' },
      { columnKey: 'buffer_used', columnLabel: 'Buffer Standard' },
      { columnKey: 'meter_id', columnLabel: 'pH Meter ID' },
    ]
  }
  if (type === 'equipment') {
    return [
      { columnKey: 'equipment_name', columnLabel: 'Equipment Name' },
      { columnKey: 'equipment_id', columnLabel: 'Equipment ID' },
      { columnKey: 'cal_due_date', columnLabel: 'Calibration Due' },
      { columnKey: 'operator', columnLabel: 'Operator' },
    ]
  }
  if (type === 'column') {
    return [
      { columnKey: 'column_name', columnLabel: 'Column Name' },
      { columnKey: 'serial_no', columnLabel: 'Serial No.' },
      { columnKey: 'dimension', columnLabel: 'Dimensions (LxIDxP)' },
      { columnKey: 'inj_count', columnLabel: 'Injections' },
      { columnKey: 'theo_plates', columnLabel: 'Plates (N)' },
      { columnKey: 'tailing_factor', columnLabel: 'Tailing (TF)' },
    ]
  }
  if (type === 'chemical') {
    return [
      { columnKey: 'chemical_name', columnLabel: 'Reagent / Chemical' },
      { columnKey: 'grade', columnLabel: 'Grade' },
      { columnKey: 'batch_no', columnLabel: 'Batch / Lot No.' },
      { columnKey: 'exp_date', columnLabel: 'Expiry Date' },
      { columnKey: 'manufacturer', columnLabel: 'Manufacturer' },
    ]
  }
  if (type === 'quantitative_result') {
    return [
      { columnKey: 'param_code', columnLabel: 'Param Code' },
      { columnKey: 'param_name', columnLabel: 'Parameter Name' },
      { columnKey: 'specification', columnLabel: 'Specification Limit' },
      { columnKey: 'result', columnLabel: 'Observed Result' },
      { columnKey: 'uom', columnLabel: 'UOM' },
      { columnKey: 'compliance', columnLabel: 'Compliance' },
    ]
  }
  if (type === 'further_actions') {
    return [
      { columnKey: 'action_required', columnLabel: 'Action Required' },
      { columnKey: 'assigned_to', columnLabel: 'Assigned To' },
      { columnKey: 'target_date', columnLabel: 'Target Date' },
      { columnKey: 'status', columnLabel: 'Status' },
    ]
  }
  return []
}

// A non-developer author only ever needs to name a column ("Observed PH")
// — the internal storage key (observed_ph) is dev-flavored and meaningless
// to them, so it's derived automatically and hidden by default (see
// secColumnsAdvanced below). Only exposed for the rare case someone needs
// to match an existing key exactly.
function slugifyColumnKey(label: string): string {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return base || 'field'
}
function uniqueColumnKey(label: string, existing: { columnKey?: string | null }[], skipIndex: number): string {
  const base = slugifyColumnKey(label)
  const taken = new Set(existing.filter((_, i) => i !== skipIndex).map((c) => c.columnKey))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

// Summarizes what's actually inside a section, so a canvas row shows more
// than a bare type badge — matches what Section Properties would show
// without requiring a click to find out.
function sectionContentPreview(section: ArdMasterSection): string | null {
  const cols = section.datatable?.columns
  if (cols && cols.length) {
    const labels = cols.map((c) => c.columnLabel || c.dataItemName || c.columnKey).filter(Boolean) as string[]
    const shown = labels.slice(0, 3).join(', ')
    const more = labels.length > 3 ? ` +${labels.length - 3} more` : ''
    return `${cols.length} column${cols.length === 1 ? '' : 's'} · ${shown}${more}`
  }
  if (section.embeddedFile?.fileName) return section.embeddedFile.fileName
  if (section.contentBlock?.name) return `Linked: ${section.contentBlock.name}`
  if (section.dataItemLinks && section.dataItemLinks.length) {
    return `${section.dataItemLinks.length} field${section.dataItemLinks.length === 1 ? '' : 's'} linked`
  }
  if (section.richtext?.defaultContent) return 'Rich text content configured'
  return null
}

function SortableAttachmentItem({
  att, idx, isSelected, isLabComp, editable, isFirst, isLast, onSelect, onMoveUp, onMoveDown, onRemove,
}: {
  att: Attachment
  idx: number
  isSelected: boolean
  isLabComp: boolean
  editable: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: att.sectionId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`p-3 rounded-lg border transition-all cursor-pointer space-y-2 ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/30'
          : isLabComp
            ? 'border-indigo-200 bg-indigo-50/10 hover:border-indigo-300'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editable && (
            <span
              {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
              className="text-slate-400 hover:text-indigo-600 cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-slate-100 shrink-0"
              title="Drag to reorder section"
            >
              <GripVertical size={16} />
            </span>
          )}
          <span className={`w-6 h-6 rounded-full font-mono text-xs font-bold flex items-center justify-center shrink-0 ${isLabComp ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800 truncate">{att.section.name}</span>
              {att.isMandatory && <Tag color="red" className="text-[9px] px-1 py-0">Required</Tag>}
              {isLabComp && <Tag color="blue" className="text-[9px] px-1 py-0">Fixed Section</Tag>}
              {!att.section.active && <Tag color="red" className="text-[9px] px-1 py-0">Inactive</Tag>}
            </div>
          </div>
        </div>

        {editable && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button type="text" size="small" disabled={isFirst} icon={<ArrowUp size={13} />} onClick={onMoveUp} />
            <Button type="text" size="small" disabled={isLast} icon={<ArrowDown size={13} />} onClick={onMoveDown} />
            <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={onRemove} />
          </div>
        )}
      </div>
      {(() => {
        const preview = sectionContentPreview(att.section)
        return preview ? (
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
            <Table2 size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{preview}</span>
          </div>
        ) : null
      })()}
    </div>
  )
}

export default function ArdTemplateBuilderPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msg, ctx] = message.useMessage()

  const [draft, setDraft] = useState<ArdTemplateDoc | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [attachSel, setAttachSel] = useState<string | undefined>()
  const [attaching, setAttaching] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [activeMobileTab, setActiveMobileTab] = useState<'palette' | 'canvas' | 'properties'>('canvas')
  // Collapsed by default — attaching an existing section (above) is the
  // recommended path; creating a new one is a secondary, opt-in action.
  const [coreBlocksOpen, setCoreBlocksOpen] = useState(false)
  const [esignPending, setEsignPending] = useState<'PUBLISHED' | 'REWORK' | null>(null)

  // Inline Section Properties Inspector state — mirrors the old builder's
  // Properties panel, but edits the master ArdSection (persisted separately
  // via ardSectionApi.save) rather than in-memory JSON on the template draft.
  const [secName, setSecName] = useState('')
  const [secDefaultContent, setSecDefaultContent] = useState('')
  // Width is always 100 (full-width) — shown as a fixed field for parity with
  // the old builder, not editable. Height is the only real control: it sets
  // how tall the rich-text box renders wherever this section is used, so the
  // author can size it to how much content they expect (a one-line note vs.
  // a long narrative), rather than every richtext section getting the same
  // fixed height regardless of purpose.
  const [secEditorHeight, setSecEditorHeight] = useState<number | null>(null)
  const [secColumns, setSecColumns] = useState<{ dataItemId?: string | null; columnKey?: string | null; columnLabel?: string | null; relativeWidth: number; isMandatory: boolean }[]>([])
  // Key column hidden by default (auto-derived from Label as the author
  // types) — "Advanced" reveals it for manual editing.
  const [secColumnsAdvanced, setSecColumnsAdvanced] = useState(false)
  const [secDataItemLinks, setSecDataItemLinks] = useState<{ dataItemId: string; isMandatory: boolean }[]>([])
  const [secSingleDataItemId, setSecSingleDataItemId] = useState<string | undefined>()
  const [secContentBlockId, setSecContentBlockId] = useState<string | undefined>()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data: template, isLoading } = useQuery({
    queryKey: ['ard-template', templateId],
    queryFn: () => ardTemplateApi.get(templateId!),
    enabled: !!templateId,
  })

  const { data: templateSections } = useQuery({
    queryKey: ['ard-template-sections', templateId],
    queryFn: () => ardTemplateApi.sections(templateId!),
    enabled: !!templateId,
  })

  const { data: sectionTypesData } = useQuery({ queryKey: ['ard-section-types'], queryFn: ardTemplateApi.sectionTypes })
  const fixedTypeSet = sectionTypesData
    ? new Set(sectionTypesData.filter((t) => t.fixed).map((t) => t.type))
    : FIXED_TYPES_FALLBACK

  const { data: sectionsList } = useQuery({
    queryKey: ['ard-sections', 'all-active'],
    queryFn: () => ardSectionApi.list({ is_active: 'true', pageSize: 500 }),
  })

  const { data: dataItems } = useQuery({
    queryKey: ['ard-data-items-active'],
    queryFn: () => ardDataItemApi.list({ is_active: 'true', pageSize: 500 }),
  })

  const { data: contentBlocksData } = useQuery({
    queryKey: ['ard-content-blocks'],
    queryFn: () => ardApi.listContentBlocks(),
  })

  const { data: preview } = useQuery({
    queryKey: ['ard-template-preview', templateId],
    queryFn: () => ardTemplateApi.preview(templateId!),
    enabled: !!templateId && previewMode,
  })

  useEffect(() => {
    if (template) setDraft(template)
  }, [template?.id])

  useEffect(() => {
    if (templateSections) {
      const rows: Attachment[] = templateSections.items
        .filter((r) => r.section)
        .map((r) => ({
          sectionId: r.sectionId,
          includeInCloning: r.includeInCloning,
          includeInEmpower: r.includeInEmpower,
          updateSampleWeights: r.updateSampleWeights,
          updateResultSample: r.updateResultSample,
          includeReadWeighingExcel: r.includeReadWeighingExcel,
          isMandatory: r.isMandatory,
          section: r.section as unknown as ArdMasterSection,
        }))
      setAttachments(rows)
      if (rows.length) setSelectedSectionId(rows[0].sectionId)
    }
  }, [templateSections])

  const editable = draft ? ['DRAFT', 'REWORK'].includes(draft.status) : false
  const selectedAttachment = attachments.find((a) => a.sectionId === selectedSectionId)

  // Sync the Properties Inspector's local edit buffer whenever the selected
  // attachment changes (matches old's behavior of the inspector always
  // reflecting whichever canvas block is currently selected).
  useEffect(() => {
    const section = selectedAttachment?.section
    if (!section) return
    setSecName(section.name)
    setSecDefaultContent(section.richtext?.defaultContent ?? '')
    setSecEditorHeight(section.richtext?.editorHeight ?? null)
    setSecColumns((section.datatable?.columns ?? []).map((c) => ({ dataItemId: c.dataItemId, columnKey: c.columnKey, columnLabel: c.columnLabel, relativeWidth: c.relativeWidth, isMandatory: c.isMandatory })))
    setSecDataItemLinks((section.dataItemLinks ?? []).map((l) => ({ dataItemId: l.dataItemId, isMandatory: l.isMandatory })))
    setSecSingleDataItemId(section.dataItemLinks?.[0]?.dataItemId)
    setSecContentBlockId(section.contentBlockId ?? undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId])

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('No draft to save')
      const sections: ArdTemplateSectionAttachment[] = attachments.map((a) => ({
        sectionId: a.sectionId,
        includeInCloning: a.includeInCloning,
        includeInEmpower: a.includeInEmpower,
        updateSampleWeights: a.updateSampleWeights,
        updateResultSample: a.updateResultSample,
        includeReadWeighingExcel: a.includeReadWeighingExcel,
        isMandatory: a.isMandatory,
      }))
      // Template Details (description/remarks/activationDate) and Fixed
      // Section Inclusions used to be editable here, but nothing in the app
      // ever read those fields back — the Block Palette/Canvas attachments
      // are the only thing that actually controls an experiment's sections.
      // Removed the dead UI; no longer sending them on save either.
      return ardTemplateApi.save(draft.id, { sections })
    },
    onSuccess: (updated) => {
      setDraft(updated)
      qc.invalidateQueries({ queryKey: ['ard-template', templateId] })
      qc.invalidateQueries({ queryKey: ['ard-template-sections', templateId] })
      msg.success('Template draft saved successfully.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save template.'),
  })

  const transition = useMutation({
    mutationFn: ({ to, password, remarks }: { to: string; password?: string; remarks?: string }) =>
      ardTemplateApi.transition(templateId!, { to, ...(password ? { password } : {}), ...(remarks ? { remarks } : {}) }),
    onSuccess: (updated, { to }) => {
      setDraft(updated)
      setEsignPending(null)
      qc.invalidateQueries({ queryKey: ['ard-template', templateId] })
      msg.success(`Template status updated to ${to.replace(/_/g, ' ')}.`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? (typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)) : 'Status update failed.'),
  })

  // Cloning stays available once the template is no longer editable (post-Submit) —
  // same flow as the Templates list page: clone, then rename before continuing,
  // to avoid silent "(Copy)" name collisions.
  const [cloneEditing, setCloneEditing] = useState<ArdTemplateDoc | null>(null)
  const [cloneForm] = Form.useForm()
  const { data: masterData } = useQuery({ queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData })
  const templateTypeOptions = useMemo(() => {
    const fromLookup = (masterData?.lookups ?? [])
      .filter((l) => l.category === 'Template Type' && l.active)
      .map((l) => ({ value: l.code, label: l.label }))
    return fromLookup.length > 0
      ? fromLookup
      : [
          { value: 'EXPERIMENT', label: 'Experiment' },
          { value: 'ANALYTICAL', label: 'Analytical' },
          { value: 'STP', label: 'STP Document' },
          { value: 'STABILITY', label: 'Stability Study' },
        ]
  }, [masterData?.lookups])

  const clone = useMutation({
    mutationFn: () => ardTemplateApi.clone(templateId!),
    onSuccess: (copy) => {
      setCloneEditing(copy)
      cloneForm.setFieldsValue({ name: copy.name, templateType: copy.templateType })
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to clone template.'),
  })
  const saveCloneDetails = useMutation({
    mutationFn: (v: { name: string; templateType?: string }) => ardTemplateApi.save(cloneEditing!.id, v),
    onSuccess: () => {
      msg.success('Template cloned successfully.')
      const id = cloneEditing!.id
      setCloneEditing(null)
      navigate(`/ard/templates/${id}`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save cloned template.'),
  })

  // Creates a brand-new master Section of the clicked block type and attaches
  // it to the canvas immediately — matches old's "click a palette block, it
  // appears in the canvas" flow. The section starts with a generic name the
  // author renames inline via the Properties Inspector below.
  const createFromPalette = useMutation({
    mutationFn: async (type: SectionType) => {
      // Section names must be unique across the whole library, and creating
      // a second, independently-configured section of the SAME type is
      // legitimate and expected here (e.g. a Weighing Details variant with
      // different columns for a different template) — not a mistake to
      // prevent. Try the clean label first (the common case: first use of
      // this block type ever) and only append a short disambiguator if the
      // backend actually rejects it as a duplicate name, instead of
      // uglifying every section name up front for a collision that usually
      // never happens. `renamed` tells onSuccess whether this happened, so
      // it can point the author at the rename field instead of leaving the
      // generated name to go unnoticed.
      const label = BLOCK_CATALOG.find((b) => b.type === type)?.label ?? type
      const gxpColumns = getDefaultGxPColumns(type)
      const body: Parameters<typeof ardSectionApi.create>[0] = { name: label, sectionType: type, active: true }
      // Fixed/Lab Component blocks ship with their standard GxP column set
      // pre-filled — the author edits/adds from there instead of starting blank.
      if (gxpColumns.length) {
        body.datatable = {
          name: null, description: null, typicalRowCount: 3,
          columns: gxpColumns.map((c, i) => ({ dataItemId: null, columnKey: c.columnKey, columnLabel: c.columnLabel, sequenceNumber: i, relativeWidth: 20, isMandatory: false })),
        }
      }
      try {
        const section = await ardSectionApi.create(body)
        return { section, renamed: false, label }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const suffix = Date.now().toString(36).slice(-4)
          const section = await ardSectionApi.create({ ...body, name: `${label} (${suffix})` })
          return { section, renamed: true, label }
        }
        throw err
      }
    },
    onSuccess: ({ section: created, renamed, label }) => {
      setAttachments((prev) => [...prev, {
        sectionId: created.id, section: created,
        includeInCloning: true, includeInEmpower: false, updateSampleWeights: false, updateResultSample: false, includeReadWeighingExcel: false, isMandatory: false,
      }])
      setSelectedSectionId(created.id)
      setActiveMobileTab('canvas')
      qc.invalidateQueries({ queryKey: ['ard-sections', 'all-active'] })
      if (renamed) {
        msg.info(`A "${label}" section already exists, so this one was named "${created.name}" — give it a more specific name in Section Name below.`, 6)
      }
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to create section.'),
  })

  // One-step "pick a Content Library block, it lands on the canvas already
  // linked" — skips the create-blank-then-open-properties-then-pick-then-save
  // round trip that the generic palette flow needs for other types.
  const createFromContentBlock = useMutation({
    mutationFn: (block: { id: string; name: string }) =>
      ardSectionApi.create({ name: block.name, sectionType: 'content_block', contentBlockId: block.id, active: true }),
    onSuccess: (created) => {
      setAttachments((prev) => [...prev, {
        sectionId: created.id, section: created,
        includeInCloning: true, includeInEmpower: false, updateSampleWeights: false, updateResultSample: false, includeReadWeighingExcel: false, isMandatory: false,
      }])
      setSelectedSectionId(created.id)
      setActiveMobileTab('canvas')
      qc.invalidateQueries({ queryKey: ['ard-sections', 'all-active'] })
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to add content block.'),
  })

  const saveSectionContent = useMutation({
    mutationFn: () => {
      const section = selectedAttachment!.section
      // description/uniqueIdentifier have no editable UI here anymore (dead
      // fields — never displayed or searched anywhere), but the backend's
      // save always OVERWRITES them with whatever's in this payload rather
      // than leaving omitted fields untouched — so they're still round-
      // tripped unchanged from the section's current value, to avoid
      // silently wiping out a value someone set via Configuration → Sections.
      const body: Record<string, unknown> = {
        name: secName, description: section.description ?? null, uniqueIdentifier: section.uniqueIdentifier ?? null,
        sectionType: section.sectionType, active: section.active,
      }
      if (RICHTEXT_TYPES.includes(section.sectionType)) body.richtext = { defaultContent: secDefaultContent || null, editorHeight: secEditorHeight, editorWidth: 100 }
      if (DATATABLE_TYPES.includes(section.sectionType)) body.datatable = { typicalRowCount: 3, columns: secColumns.map((c, i) => ({ ...c, sequenceNumber: i })) }
      if (SINGLE_DATA_ITEM_TYPES.includes(section.sectionType)) {
        if (!secSingleDataItemId) throw new Error('Select a linked data item.')
        body.dataItemLink = { dataItemId: secSingleDataItemId, isMandatory: true }
      }
      if (MULTI_DATA_ITEM_TYPES.includes(section.sectionType)) body.dataItemLinks = secDataItemLinks.map((l, i) => ({ ...l, sequenceNumber: i }))
      if (CONTENT_BLOCK_TYPES.includes(section.sectionType)) {
        if (!secContentBlockId) throw new Error('Select a content block.')
        body.contentBlockId = secContentBlockId
      }
      return ardSectionApi.save(section.id, body)
    },
    onSuccess: (saved) => {
      setAttachments((prev) => prev.map((a) => (a.sectionId === saved.id ? { ...a, section: saved } : a)))
      qc.invalidateQueries({ queryKey: ['ard-sections', 'all-active'] })
      msg.success('Section content saved.')
    },
    onError: (e) => msg.error(e instanceof Error ? e.message : 'Failed to save section content.'),
  })

  if (isLoading || !draft) {
    return <div className="p-8 text-center text-slate-500">Loading template builder...</div>
  }

  const availableSections = (sectionsList?.items ?? []).filter((s) => !attachments.some((a) => a.sectionId === s.id))

  // The library list (sectionsList, used to populate both the "attach
  // existing" dropdown and the Fixed Section reuse lookup below) comes from
  // GET /sections, which returns lightweight summaries with no
  // datatable/columns — only GET /sections/:id returns full detail. Using
  // the summary object directly as the attachment left Section Properties'
  // "Table Columns" empty until something else (e.g. Save Template)
  // happened to trigger a full refetch. Fetching full detail here means the
  // columns are there immediately, the instant the section is attached —
  // no save-then-see-it round trip required.
  const attachSectionById = async (id: string) => {
    setAttaching(true)
    try {
      const full = await ardSectionApi.get(id)
      setAttachments((prev) => [...prev, {
        sectionId: full.id, section: full,
        includeInCloning: true, includeInEmpower: false, updateSampleWeights: false, updateResultSample: false, includeReadWeighingExcel: false, isMandatory: false,
      }])
      setSelectedSectionId(full.id)
      setActiveMobileTab('canvas')
    } catch (e) {
      msg.error(e instanceof ApiError ? e.detail : 'Failed to attach section.')
    } finally {
      setAttaching(false)
    }
  }

  const attachSection = () => {
    if (!attachSel || !editable) return
    const id = attachSel
    setAttachSel(undefined)
    void attachSectionById(id)
  }

  // Fixed Section tiles are a shortcut for the common case: "give me the
  // standard Weighing Details" — if a section with that exact canonical
  // name already exists, reuse it (this is what "reusable" actually means:
  // attach the same section, don't manufacture a same-purpose duplicate
  // every time the tile is clicked). Matched by exact name, not just
  // sectionType, since multiple differently-configured variants of a fixed
  // type are legitimate and may already exist — grabbing an arbitrary one
  // of those would silently attach the wrong columns to this template. A
  // deliberately different variant is still created via Configuration →
  // Sections with its own distinguishing name, not through this tile.
  const attachOrCreateFixedSection = (type: SectionType, label: string) => {
    const existing = (sectionsList?.items ?? []).find((s) => s.sectionType === type && s.name === label)
    if (existing) {
      void attachSectionById(existing.id)
      return
    }
    createFromPalette.mutate(type)
  }

  const removeAttachment = (sectionId: string) => {
    if (!editable) return
    const next = attachments.filter((a) => a.sectionId !== sectionId)
    setAttachments(next)
    if (selectedSectionId === sectionId) setSelectedSectionId(next[0]?.sectionId ?? null)
  }

  const moveAttachment = (sectionId: string, dir: -1 | 1) => {
    if (!editable) return
    const idx = attachments.findIndex((a) => a.sectionId === sectionId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= attachments.length) return
    const reordered = [...attachments]
    const [item] = reordered.splice(idx, 1)
    reordered.splice(target, 0, item)
    setAttachments(reordered)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id && editable) {
      const oldIndex = attachments.findIndex((a) => a.sectionId === active.id)
      const newIndex = attachments.findIndex((a) => a.sectionId === over.id)
      if (oldIndex >= 0 && newIndex >= 0) setAttachments(arrayMove(attachments, oldIndex, newIndex))
    }
  }

  const updateSelectedFlag = (key: keyof ArdTemplateSectionAttachment, value: boolean) => {
    if (!selectedSectionId || !editable) return
    setAttachments(attachments.map((a) => (a.sectionId === selectedSectionId ? { ...a, [key]: value } : a)))
  }

  const dataItemOptions = (dataItems?.items ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.dataType})` }))
  const coreBlocks = BLOCK_CATALOG.filter((c) => !fixedTypeSet.has(c.type))
  const labBlocks = BLOCK_CATALOG.filter((c) => fixedTypeSet.has(c.type))
  const isLabComp = (type: SectionType) => fixedTypeSet.has(type)

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      {ctx}

      {/* Top Header Bar */}
      <div className="glass-card rounded-lg p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/ard/templates')}>
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight truncate">{draft.name}</h1>
              {statusTag(draft.status)}
              <span className="font-mono text-xs font-semibold text-slate-500">v{draft.version}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
              Type: <span className="font-semibold text-slate-700">{draft.templateType || 'General'}</span>
              {' · Code: '}
              {draft.code
                ? <span className="font-mono text-indigo-600">{draft.code}</span>
                : <span className="italic text-slate-400">not set</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <Button icon={previewMode ? <Edit2 size={14} /> : <Eye size={14} />} onClick={() => setPreviewMode(!previewMode)}>
            {previewMode ? 'Edit Mode' : 'Preview Mode'}
          </Button>

          {/* Once submitted, the template is locked (no Edit/Save) — Clone is
              the only way forward: start a new draft from this content. */}
          {!editable && (
            <Button icon={<Copy size={14} />} loading={clone.isPending} onClick={() => clone.mutate()}>
              Clone
            </Button>
          )}

          {editable && (
            <Button type="primary" icon={<Save size={14} />} loading={save.isPending} onClick={() => save.mutate()}>
              Save Template
            </Button>
          )}

          {(draft.status === 'DRAFT' || draft.status === 'REWORK') && (
            <Popconfirm title="Submit template for approval?" onConfirm={() => transition.mutate({ to: 'PENDING_APPROVAL' })}>
              <Button type="primary" className="bg-amber-600 hover:bg-amber-700" icon={<Send size={14} />} loading={transition.isPending}>
                Submit
              </Button>
            </Popconfirm>
          )}

          {draft.status === 'PENDING_APPROVAL' && (() => {
            const isSelfCreated = draft.createdById && user?.id && draft.createdById === user.id
            return (
              <>
                <Tooltip title={isSelfCreated ? 'You cannot approve a template you created' : undefined}>
                  <Button type="primary" icon={<CheckCircle size={14} />} loading={transition.isPending}
                    disabled={!!isSelfCreated}
                    onClick={() => setEsignPending('PUBLISHED')}>
                    Publish
                  </Button>
                </Tooltip>
                <Tooltip title={isSelfCreated ? 'You cannot rework a template you submitted yourself' : undefined}>
                  <Button danger icon={<AlertCircle size={14} />} loading={transition.isPending}
                    disabled={!!isSelfCreated}
                    onClick={() => setEsignPending('REWORK')}>
                    Rework
                  </Button>
                </Tooltip>
              </>
            )
          })()}
        </div>
      </div>

      {!editable && !previewMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-600 shrink-0" />
          <span>This template is currently <strong>{draft.status}</strong> and is read-only. Create a new version from the templates page to make edits.</span>
        </div>
      )}

      {/* Mobile Segmented Tab Selector */}
      {!previewMode && (
        <div className="block lg:hidden">
          <Segmented
            block
            value={activeMobileTab}
            onChange={(v: any) => setActiveMobileTab(v)}
            options={[
              { label: 'Palette', value: 'palette' },
              { label: `Canvas (${attachments.length})`, value: 'canvas' },
              { label: 'Properties', value: 'properties' },
            ]}
          />
        </div>
      )}

      {previewMode ? (
        /* Preview Mode — rendered from the SNAPSHOT tables (§3.4), same
           read-path an experiment created from this template will use. */
        <Card title="Live Template Preview (from saved snapshot)" className="glass-card rounded-lg overflow-hidden">
          <div className="space-y-6">
            {/* Aim/Objective, Attachments and Conclusion are fixed blocks every
                experiment always has (ArdExperimentWorkspacePage.tsx), regardless
                of the template's authored sections — shown here so the preview
                matches what the real experiment page looks like. */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-800 text-sm">Aim / Objective</span>
                <Tag color="purple">fixed block</Tag>
              </div>
              <p className="text-xs italic text-slate-400">Rich-text field — analyst states the aim when running the experiment.</p>
            </div>

            {(!preview || preview.sections.length === 0) ? (
              <Empty description="No sections attached to this template, or nothing saved yet." />
            ) : (
              preview.sections.map((sec, idx) => (
                <div key={sec.sectionId} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold text-slate-800 text-sm">{idx + 1}. {sec.name} {sec.isMandatory && <span className="text-red-500">*</span>}</span>
                    <Tag color="geekblue">{sec.sectionType}</Tag>
                  </div>
                  {sec.richtext && (
                    <div
                      className="p-3 bg-white rounded border border-slate-200 text-xs text-slate-600 overflow-y-auto"
                      style={{ minHeight: sec.richtext.editorHeight ?? 60, maxHeight: sec.richtext.editorHeight ?? undefined }}
                    >
                      {sec.richtext.defaultContent
                        ? <RichDisplay html={sec.richtext.defaultContent} />
                        : <span className="italic text-slate-400">(no default content set)</span>}
                    </div>
                  )}
                  {sec.datatable && (
                    sec.datatable.columns.length === 0 ? (
                      <p className="text-xs italic text-slate-400">(no columns configured)</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr>
                              {sec.datatable.columns.map((c, ci) => (
                                <th key={c.dataItemId ?? c.columnKey ?? ci} className="border border-slate-200 bg-slate-100 px-2 py-1 text-left" style={{ width: `${c.relativeWidth}%` }}>
                                  {c.columnLabel ?? `Col ${c.sequenceNumber + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>{sec.datatable.columns.map((c, ci) => <td key={c.dataItemId ?? c.columnKey ?? ci} className="border border-slate-200 px-2 py-1 text-slate-400 italic">—</td>)}</tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                  {sec.contentBlock && (
                    sec.contentBlock.contentType === 'richtext' && sec.contentBlock.body ? (
                      <div className="prose prose-sm max-w-none bg-white p-3 rounded border border-slate-200 min-h-[60px]" dangerouslySetInnerHTML={{ __html: sec.contentBlock.body }} />
                    ) : (
                      <div className="bg-white p-3 rounded border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap min-h-[60px]">
                        {sec.contentBlock.body || '(empty)'}
                      </div>
                    )
                  )}
                  {sec.embeddedFile && (
                    sec.embeddedFile.workbookData ? (
                      <div className="rounded border border-slate-200 overflow-hidden">
                        <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-1 border-b border-slate-200 font-mono">
                          {sec.embeddedFile.fileName}
                        </div>
                        <SpreadsheetFieldRuntime
                          spreadsheet={{ mode: 'inline', workbookData: sec.embeddedFile.workbookData as Record<string, unknown>, fields: [], protectedRanges: [] }}
                          value={{}}
                          onChange={() => {}}
                          disabled
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200">
                        Spreadsheet: <span className="font-mono">{sec.embeddedFile.fileName ?? 'none uploaded'}</span>
                        {sec.embeddedFile.fileName && <span className="block text-[10px] text-slate-400 mt-1">(uploaded before spreadsheet preview support — re-upload to enable a live preview)</span>}
                      </div>
                    )
                  )}
                  {sec.dataItemLinks && sec.dataItemLinks.length > 0 && (
                    <div className="space-y-1">
                      {sec.dataItemLinks.map((l) => (
                        <div key={l.dataItemId} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
                          <span>{l.name} <span className="text-slate-400">({l.dataType})</span></span>
                          {l.isMandatory && <Tag color="red" className="text-[9px] px-1 py-0">Mandatory</Tag>}
                        </div>
                      ))}
                    </div>
                  )}
                  {!sec.richtext && !sec.datatable && !sec.contentBlock && !sec.embeddedFile && (!sec.dataItemLinks || sec.dataItemLinks.length === 0) && (
                    <p className="text-xs italic text-slate-400">
                      (not yet configured — select this section on the canvas and use "Save Section Content")
                    </p>
                  )}
                </div>
              ))
            )}

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-800 text-sm">Attachments</span>
                <Tag color="purple">fixed block</Tag>
              </div>
              <p className="text-xs italic text-slate-400">File upload panel — attach supporting documents when running the experiment.</p>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-800 text-sm">Conclusion</span>
                <Tag color="purple">fixed block</Tag>
              </div>
              <p className="text-xs italic text-slate-400">Rich-text field — analyst summarizes the outcome when running the experiment.</p>
            </div>
          </div>
        </Card>
      ) : (
        /* Edit Mode: Block Palette (top) | Canvas 60% + Properties 40% (below) */
        <div className="space-y-4">
          {/* Block Palette — kept to a single compact strip so
              Canvas/Properties below get the bulk of the screen. */}
          <div className={`glass-card rounded-lg p-2.5 ${activeMobileTab === 'palette' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-slate-800 text-xs flex items-center gap-1 shrink-0">
                <LayoutGrid size={14} className="text-indigo-600" /> Block Palette
              </h2>
              <Select
                size="small"
                className="w-[220px]"
                showSearch
                optionFilterProp="label"
                placeholder="Attach existing..."
                disabled={!editable}
                value={attachSel}
                onChange={setAttachSel}
                options={availableSections.map((s) => ({ value: s.id, label: `${s.name} (${s.sectionType})` }))}
              />
              <Button size="small" type="primary" icon={<Plus size={12} />} loading={attaching} disabled={!editable || !attachSel} onClick={attachSection}>
                Attach
              </Button>
              <button
                type="button"
                onClick={() => setCoreBlocksOpen((v) => !v)}
                className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-0.5 shrink-0 cursor-pointer"
              >
                New Section <ChevronDown size={12} className={`transition-transform ${coreBlocksOpen ? '' : '-rotate-90'}`} />
              </button>
            </div>

            {coreBlocksOpen && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100">
                {coreBlocks.map((cat) => {
                  const Icon = cat.icon
                  // Content Library blocks skip the create-blank-then-open-
                  // properties-then-pick-then-save round trip other types need
                  // — picking one here creates the section already linked and
                  // named after the block, straight on the canvas.
                  if (CONTENT_BLOCK_TYPES.includes(cat.type)) {
                    return (
                      <div key={cat.type} className="flex items-center gap-1.5 p-1.5 rounded-md border border-slate-200 bg-white">
                        <Icon size={13} className="text-slate-500 shrink-0" />
                        <Select
                          size="small" className="w-[170px]" showSearch optionFilterProp="label"
                          placeholder={cat.label} disabled={!editable || createFromContentBlock.isPending}
                          value={null}
                          onChange={(id: string) => {
                            const block = (contentBlocksData?.items ?? []).find((b) => b.id === id)
                            if (block) createFromContentBlock.mutate({ id: block.id, name: block.name })
                          }}
                          options={(contentBlocksData?.items ?? []).filter((b) => b.active).map((b) => ({ value: b.id, label: `${b.name} (${b.contentType})` }))}
                        />
                      </div>
                    )
                  }
                  return (
                    <button
                      key={cat.type}
                      disabled={!editable || createFromPalette.isPending}
                      title={cat.hint}
                      onClick={() => createFromPalette.mutate(cat.type)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                    >
                      <Icon size={13} className="text-slate-500 group-hover:text-indigo-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700 whitespace-nowrap">{cat.label}</span>
                      <Plus size={12} className="text-slate-300 group-hover:text-indigo-600 shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Fixed Sections kept in a single wrapping line, name only — a
                lab user just needs to recognize and click the block; column
                names are what "Section Properties" shows once attached. */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold tracking-wider text-indigo-500 uppercase flex items-center gap-1 shrink-0">
                <Beaker size={12} /> Fixed:
              </span>
              {labBlocks.map((cat) => {
                const Icon = cat.icon
                // Fixed sections are one-per-template — once a type is on the
                // canvas, its palette entry is spent (grayed out, not clickable again).
                const alreadyAdded = attachments.some((a) => a.section.sectionType === cat.type)
                return (
                  <button
                    key={cat.type}
                    disabled={!editable || createFromPalette.isPending || attaching || alreadyAdded}
                    onClick={() => attachOrCreateFixedSection(cat.type, cat.label)}
                    title={alreadyAdded ? 'Already added to this template' : cat.hint}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md border border-indigo-100 bg-indigo-50/20 hover:border-indigo-500 hover:bg-indigo-50/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                  >
                    <Icon size={12} className="text-indigo-600 group-hover:text-indigo-700 shrink-0" />
                    <span className="text-[11px] font-semibold text-indigo-950 group-hover:text-indigo-700 whitespace-nowrap">{cat.label}</span>
                    {alreadyAdded ? <CheckCircle size={11} className="text-indigo-400 shrink-0" /> : <Plus size={11} className="text-indigo-300 group-hover:text-indigo-600 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Canvas (60%) + Section Properties (40%) side-by-side */}
          <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className={`w-full lg:w-[60%] glass-card rounded-lg p-4 space-y-3 min-h-[650px] ${activeMobileTab === 'canvas' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Template Canvas</h2>
                <p className="text-[11px] text-slate-400">{attachments.length} section block(s) configured (drag handle to reorder)</p>
              </div>
            </div>

            {attachments.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">No sections in template canvas</p>
                <p className="text-[11px] text-slate-400 mt-1">Select a block from Core or Fixed Sections To Be Displayed on the left to add it here.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={attachments.map((a) => a.sectionId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                    {attachments.map((att, idx) => (
                      <SortableAttachmentItem
                        key={att.sectionId}
                        att={att}
                        idx={idx}
                        isSelected={att.sectionId === selectedSectionId}
                        isLabComp={isLabComp(att.section.sectionType)}
                        editable={editable}
                        isFirst={idx === 0}
                        isLast={idx === attachments.length - 1}
                        onSelect={() => {
                          setSelectedSectionId(att.sectionId)
                          if (window.innerWidth < 1024) setActiveMobileTab('properties')
                        }}
                        onMoveUp={() => moveAttachment(att.sectionId, -1)}
                        onMoveDown={() => moveAttachment(att.sectionId, 1)}
                        onRemove={() => removeAttachment(att.sectionId)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Section Properties Inspector */}
          <div className={`w-full lg:w-[40%] glass-card rounded-lg p-4 space-y-4 min-h-[650px] ${activeMobileTab === 'properties' ? 'block' : 'hidden lg:block'}`}>
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">
                  {selectedAttachment ? 'Section Properties' : 'No Section Selected'}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {selectedAttachment ? 'Configure selected section content & template behavior' : 'Select a section on the canvas to configure it'}
                </p>
              </div>
              {selectedAttachment && (
                <Button size="small" type="text" onClick={() => setSelectedSectionId(null)} className="text-xs text-slate-500">
                  ✕ Deselect
                </Button>
              )}
            </div>

            {!selectedAttachment ? (
              <div className="pt-8 text-center text-slate-400 text-[11px]">
                Select a section block in the canvas to inspect its properties.
              </div>
            ) : (() => {
              const section = selectedAttachment.section
              const stype = section.sectionType
              const columnWidthSum = secColumns.reduce((acc, c) => acc + (c.relativeWidth || 0), 0)
              return (
                <div className="space-y-4">
                  {/* Identity: name is the primary field; type is fixed metadata,
                      shown as a compact inline badge rather than a full-width
                      disabled input. */}
                  <div className="flex items-start gap-2">
                    <Form.Item label="Section Name" className="mb-0 flex-1">
                      <Input disabled={!editable} value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="e.g. Weighing Details" />
                    </Form.Item>
                    <div className="pt-6 shrink-0">
                      <Tooltip title="Section type cannot be changed after creation.">
                        <Tag className="font-mono text-[11px]">{stype}</Tag>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Behavior toggles — how this section behaves, kept together
                      and near the top since they're settings, not content. */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2.5">
                    <Checkbox
                      disabled={!editable}
                      checked={!!selectedAttachment.isMandatory}
                      onChange={(e) => updateSelectedFlag('isMandatory', e.target.checked)}
                    >
                      <span className="text-xs font-medium text-slate-700">Mandatory for submission</span>
                    </Checkbox>
                    {ATTACH_FLAGS.map((f) => (
                      <Tooltip key={f.key} title={f.hint}>
                        <Checkbox disabled={!editable} checked={!!selectedAttachment[f.key]} onChange={(e) => updateSelectedFlag(f.key, e.target.checked)}>
                          <span className="text-xs font-medium text-slate-700">{f.label}</span>
                        </Checkbox>
                      </Tooltip>
                    ))}
                  </div>

                  <Form layout="vertical">
                    {stype === 'combined' && (
                      <p className="text-[11px] text-slate-500 bg-indigo-50/60 border border-indigo-100 rounded px-2.5 py-1.5 mb-3">
                        Combined sections carry both a Param block and a Data Table block — fill in the ones you need below.
                      </p>
                    )}

                    {RICHTEXT_TYPES.includes(stype) && (
                      <>
                        <div className="grid grid-cols-2 gap-x-4">
                          <Form.Item label="Width" className="mb-3">
                            <Input disabled value={100} suffix="%" />
                          </Form.Item>
                          <Form.Item label="Height" className="mb-3" extra="How tall this rich-text box renders wherever the section is used.">
                            <InputNumber
                              disabled={!editable}
                              min={60}
                              step={20}
                              className="w-full"
                              value={secEditorHeight ?? undefined}
                              onChange={(v) => setSecEditorHeight(v ?? null)}
                              placeholder="e.g. 200"
                              addonAfter="px"
                            />
                          </Form.Item>
                        </div>
                        <Form.Item label="Default Content" className="mb-3">
                          {/* defaultContent is real HTML authored via the Sections library's
                              rich editor (Configuration → Sections) — editing it here through
                              a plain textarea would show/save raw HTML tags as literal text,
                              silently corrupting the formatting on next save. */}
                          <RichEditor value={secDefaultContent} onChange={setSecDefaultContent} readOnly={!editable} height={secEditorHeight || 200} />
                        </Form.Item>
                      </>
                    )}

                    {SINGLE_DATA_ITEM_TYPES.includes(stype) && (
                      <Form.Item label="Linked Master Data Item" className="mb-3">
                        <Select disabled={!editable} showSearch optionFilterProp="label" placeholder="Select linked data item..." value={secSingleDataItemId} onChange={setSecSingleDataItemId} options={dataItemOptions} />
                      </Form.Item>
                    )}

                    {CONTENT_BLOCK_TYPES.includes(stype) && (
                      <Form.Item label="Content Library Block" className="mb-3" extra="Manage blocks in ARD Configuration → Content Library. Not snapshotted — edits to the block appear here immediately.">
                        <Select
                          disabled={!editable} showSearch optionFilterProp="label" placeholder="Select a content block..."
                          value={secContentBlockId} onChange={setSecContentBlockId}
                          options={(contentBlocksData?.items ?? []).filter((b) => b.active).map((b) => ({ value: b.id, label: `${b.name} (${b.contentType})` }))}
                        />
                      </Form.Item>
                    )}

                    {MULTI_DATA_ITEM_TYPES.includes(stype) && (
                      <div className="space-y-2 border-t border-slate-100 pt-3 mb-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold tracking-wide text-slate-700 uppercase">Param</label>
                          <Select
                            size="small" showSearch optionFilterProp="label" placeholder="Add a data item..." style={{ width: 200 }}
                            disabled={!editable} value={null}
                            onChange={(v: string) => { if (!secDataItemLinks.some((l) => l.dataItemId === v)) setSecDataItemLinks([...secDataItemLinks, { dataItemId: v, isMandatory: false }]) }}
                            options={dataItemOptions.filter((o) => !secDataItemLinks.some((l) => l.dataItemId === o.value))}
                          />
                        </div>
                        {secDataItemLinks.map((l, i) => {
                          const item = (dataItems?.items ?? []).find((d) => d.id === l.dataItemId)
                          return (
                            <div key={l.dataItemId} className="flex items-center gap-2 bg-slate-50/70 p-2 rounded border border-slate-200">
                              <span className="text-xs flex-1 truncate">{item?.name ?? l.dataItemId}</span>
                              <Checkbox disabled={!editable} checked={l.isMandatory} onChange={(e) => setSecDataItemLinks(secDataItemLinks.map((x, xi) => xi === i ? { ...x, isMandatory: e.target.checked } : x))}>
                                <span className="text-xs">Mandatory</span>
                              </Checkbox>
                              {editable && <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={() => setSecDataItemLinks(secDataItemLinks.filter((_, xi) => xi !== i))} />}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {DATATABLE_TYPES.includes(stype) && LAB_FREE_TEXT_TYPES.includes(stype) && (
                      <div className="space-y-2 border-t border-slate-100 pt-3 mb-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700 block">Table Columns</label>
                          <div className="flex items-center gap-1">
                            <Button size="small" type="text" className="text-slate-500 hover:text-slate-700 text-xs px-1 h-6"
                              onClick={() => setSecColumnsAdvanced((v) => !v)}>
                              {secColumnsAdvanced ? 'Hide key' : 'Advanced'}
                            </Button>
                            {editable && (
                              <Button size="small" type="text" className="text-indigo-600 hover:text-indigo-700 text-xs px-1 h-6 flex items-center gap-1"
                                icon={<RotateCcw size={12} />}
                                onClick={() => { setSecColumns(getDefaultGxPColumns(stype).map((c) => ({ ...c, relativeWidth: 20, isMandatory: false }))); msg.info('Reset columns to standard GxP schema.') }}>
                                Reset to GxP schema
                              </Button>
                            )}
                            {editable && (
                              <Button size="small" type="primary" className="bg-amber-600 hover:!bg-amber-700 border-amber-600 text-xs px-2 h-6 flex items-center gap-1"
                                icon={<Save size={12} />} loading={saveSectionContent.isPending} onClick={() => saveSectionContent.mutate()}
                                title="Shared master data — saving updates every template using this section.">
                                Save
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                          {secColumns.map((c, i) => (
                            <div key={`${c.columnKey}-${i}`} className="grid gap-1.5 items-center px-2.5 py-1.5" style={{ gridTemplateColumns: secColumnsAdvanced ? '5fr 6fr 1fr' : '11fr 1fr' }}>
                              {secColumnsAdvanced && (
                                <Input
                                  className="text-xs font-mono"
                                  placeholder="Key" disabled={!editable} value={c.columnKey ?? ''}
                                  onChange={(e) => setSecColumns(secColumns.map((x, xi) => xi === i ? { ...x, columnKey: e.target.value } : x))}
                                />
                              )}
                              <Input
                                className="text-xs"
                                placeholder="Column name" disabled={!editable} value={c.columnLabel ?? ''}
                                onChange={(e) => {
                                  const label = e.target.value
                                  setSecColumns(secColumns.map((x, xi) => xi === i
                                    ? { ...x, columnLabel: label, ...(secColumnsAdvanced ? {} : { columnKey: uniqueColumnKey(label, secColumns, i) }) }
                                    : x))
                                }}
                              />
                              {editable && (
                                <Button type="text" danger size="small" className="p-0 flex items-center justify-center"
                                  icon={<Trash2 size={13} />} onClick={() => setSecColumns(secColumns.filter((_, xi) => xi !== i))} />
                              )}
                            </div>
                          ))}
                        </div>
                        {editable && (
                          <Button block type="dashed" size="small" icon={<Plus size={13} />}
                            onClick={() => {
                              const label = `New Column ${secColumns.length + 1}`
                              setSecColumns([...secColumns, { columnKey: uniqueColumnKey(label, secColumns, -1), columnLabel: label, relativeWidth: 20, isMandatory: false }])
                            }}>
                            Add Column
                          </Button>
                        )}
                      </div>
                    )}

                    {DATATABLE_TYPES.includes(stype) && !LAB_FREE_TEXT_TYPES.includes(stype) && (
                      <div className="space-y-2 border-t border-slate-100 pt-3 mb-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700">Table Columns</label>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] ${columnWidthSum > 100 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>Width: {columnWidthSum}/100</span>
                            {editable && secColumns.length > 0 && (
                              <Button size="small" type="text" danger className="text-xs px-1 h-6 flex items-center gap-1"
                                icon={<RotateCcw size={12} />}
                                onClick={() => { setSecColumns([]); msg.info('Columns cleared.') }}>
                                Clear all
                              </Button>
                            )}
                          </div>
                        </div>
                        {secColumns.length > 0 && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                              <span className="flex-1">Field</span>
                              <span style={{ width: 64 }}>Width</span>
                              <span>Required</span>
                              <span style={{ width: 24 }}></span>
                            </div>
                            {secColumns.map((c, i) => {
                              const item = (dataItems?.items ?? []).find((d) => d.id === c.dataItemId)
                              return (
                                <div key={`${c.dataItemId}-${i}`} className={`flex items-center gap-2 px-2.5 py-1.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                                  <span className="text-xs flex-1 truncate">{item?.name ?? c.dataItemId ?? '(unmapped)'}</span>
                                  <InputNumber disabled={!editable} size="small" min={1} max={100} value={c.relativeWidth} onChange={(v) => setSecColumns(secColumns.map((x, xi) => xi === i ? { ...x, relativeWidth: Number(v) || 0 } : x))} style={{ width: 64 }} />
                                  <Checkbox disabled={!editable} checked={c.isMandatory} onChange={(e) => setSecColumns(secColumns.map((x, xi) => xi === i ? { ...x, isMandatory: e.target.checked } : x))} />
                                  {editable && <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={() => setSecColumns(secColumns.filter((_, xi) => xi !== i))} />}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {editable && (
                          <Select
                            size="small" showSearch optionFilterProp="label" placeholder="Add a column (data item)..." style={{ width: '100%' }}
                            value={null}
                            onChange={(v: string) => { if (!secColumns.some((c) => c.dataItemId === v)) setSecColumns([...secColumns, { dataItemId: v, relativeWidth: 20, isMandatory: false }]) }}
                            options={dataItemOptions.filter((o) => !secColumns.some((c) => c.dataItemId === o.value))}
                          />
                        )}
                        <p className="text-[11px] text-slate-400">At most 10 columns; widths must sum to 100 or less.</p>
                      </div>
                    )}

                    {EMBEDDED_FILE_TYPES.includes(stype) && (
                      <div className="space-y-2 border-t border-slate-100 pt-3 mb-3">
                        <label className="text-xs font-semibold text-slate-700">Preconfigured Spreadsheet (.xlsx / .xls)</label>
                        <p className="text-[11px] text-slate-500">Current file: <span className="font-mono">{section.embeddedFile?.fileName ?? 'none uploaded'}</span></p>
                        {editable && (
                          <Upload beforeUpload={(f) => {
                            ardSectionApi.uploadEmbeddedFile(section.id, f).then(
                              () => { qc.invalidateQueries({ queryKey: ['ard-sections', 'all-active'] }); msg.success('Spreadsheet uploaded.') },
                              (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to upload spreadsheet.'),
                            )
                            return false
                          }}>
                            <Button icon={<UploadIcon size={14} />} size="small">Upload / Replace</Button>
                          </Upload>
                        )}
                      </div>
                    )}

                    {editable && !LAB_FREE_TEXT_TYPES.includes(stype) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 mt-2">
                        <p className="text-[11px] text-amber-800 flex items-start gap-1.5">
                          <AlertCircle size={13} className="shrink-0 mt-0.5" />
                          <span>Shared master data — saving updates every template using this section.</span>
                        </p>
                        <Button block type="primary" size="small" className="bg-amber-600 hover:!bg-amber-700 border-amber-600"
                          icon={<Save size={13} />} loading={saveSectionContent.isPending} onClick={() => saveSectionContent.mutate()}>
                          Save Section Content
                        </Button>
                      </div>
                    )}
                  </Form>
                </div>
              )
            })()}
          </div>
          </div>
        </div>
      )}

      <ESignatureModal
        open={esignPending !== null}
        userName={user?.username ?? ''}
        title={esignPending === 'PUBLISHED' ? 'Electronic Signature — Publish Template' : 'Electronic Signature — Return for Rework'}
        description={esignPending === 'PUBLISHED'
          ? 'Publishing makes this template available for new ATRs. Re-enter your password to confirm.'
          : 'Returning for rework reverts the template to draft state. Re-enter your password to confirm.'}
        requireReason={esignPending === 'PUBLISHED'}
        loading={transition.isPending}
        onCancel={() => setEsignPending(null)}
        onConfirm={async ({ password, reason }) => {
          if (esignPending) await transition.mutateAsync({ to: esignPending, password, ...(reason ? { remarks: reason } : {}) })
        }}
      />

      {/* Clone: edit name/type before continuing (avoids silent "(Copy)" name collisions) */}
      <Modal
        {...glassModalProps}
        destroyOnClose
        title="Cloned Template — Update Details"
        open={!!cloneEditing}
        onCancel={() => { const id = cloneEditing?.id; setCloneEditing(null); if (id) navigate(`/ard/templates/${id}`) }}
        onOk={() => cloneForm.validateFields().then((v) => saveCloneDetails.mutate(v))}
        confirmLoading={saveCloneDetails.isPending}
        okText="Save & Open"
      >
        <Form form={cloneForm} layout="vertical">
          <Form.Item name="name" label="Template Name" rules={[{ required: true, message: 'Template name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="templateType" label="Template Type">
            <Select allowClear placeholder="Select template type" options={templateTypeOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
