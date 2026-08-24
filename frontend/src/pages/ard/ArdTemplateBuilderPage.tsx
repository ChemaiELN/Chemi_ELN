import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Select, Tag, message, Card, Popconfirm, Space, Checkbox, Form, Table, Tooltip, Empty, Segmented,
} from 'antd'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Eye, Edit2, Save, ArrowLeft, CheckCircle, Send, AlertCircle, FileText, Layers, Grid, Sliders, Database, Table2, LayoutGrid, CheckSquare, Scale, TestTube, ShieldCheck, Cpu, Beaker, BarChart2, RotateCcw, GripVertical, BookOpen,
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

import { ardApi, ardTemplateApi, type TemplateSection, type SectionType, type TemplateStatus, type ArdTemplateDoc } from '../../api/ard'
import { ApiError } from '../../api/client'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { UniverSheetField } from '../../components/ard/UniverSheetField'

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

const SECTION_TYPE_CATALOG: { type: SectionType; label: string; icon: any; hint: string; group: 'Core' | 'Lab' }[] = [
  // Core Blocks
  { type: 'richtext', label: 'Rich Text', icon: FileText, hint: 'Multi-line narrative block & instructions', group: 'Core' },
  { type: 'params', label: 'Parameters', icon: Sliders, hint: 'Key-value result parameter entries', group: 'Core' },
  { type: 'table', label: 'Data Table', icon: Table2, hint: 'Custom multi-row table with defined columns', group: 'Core' },
  { type: 'preconfigured_excel', label: 'Spreadsheet', icon: Grid, hint: 'Embedded preconfigured spreadsheet grid', group: 'Core' },
  { type: 'standard_preparation', label: 'Standard Prep', icon: LayoutGrid, hint: 'Fixed standard preparation calculation table', group: 'Core' },
  { type: 'data_item', label: 'Data Item', icon: Database, hint: 'Dropdown select from Master Data items', group: 'Core' },
  { type: 'autocomplete_data_item', label: 'Searchable Item', icon: Database, hint: 'Searchable autocomplete master data field', group: 'Core' },
  { type: 'content_block', label: 'Content Block', icon: BookOpen, hint: 'Dynamic rich-text / document from Content Library', group: 'Core' },
  { type: 'combined', label: 'Combined Block', icon: Layers, hint: 'Group multiple nested child sections', group: 'Core' },

  // Lab Components (Predefined GxP Lab Blocks)
  { type: 'weighing', label: 'Weighing Details', icon: Scale, hint: 'Substance, tare, gross, net weight & balance ID', group: 'Lab' },
  { type: 'ph', label: 'pH Details', icon: TestTube, hint: 'Solution, pH value, temp, buffer & meter ID', group: 'Lab' },
  { type: 'equipment', label: 'Equipment Details', icon: ShieldCheck, hint: 'Equipment ID, calibration date & operator', group: 'Lab' },
  { type: 'column', label: 'Column Details (HPLC)', icon: Cpu, hint: 'Column serial, injections, N, TF & pressure', group: 'Lab' },
  { type: 'chemical', label: 'Material / Chemical Details', icon: Beaker, hint: 'Reagents, lot/batch, supplier, exp date', group: 'Lab' },
  { type: 'sample_details', label: 'Sample Details', icon: TestTube, hint: 'Sample details & linked ATR entries with + Add ATR', group: 'Lab' },
  { type: 'quantitative_result', label: 'Quantitative Results', icon: BarChart2, hint: 'Param code, specification, result & compliance', group: 'Lab' },
  { type: 'further_actions', label: 'Further Actions', icon: CheckSquare, hint: 'Follow-up actions, target date & status', group: 'Lab' },
]

function getDefaultGxPColumns(type: SectionType): { key: string; label: string; title?: string }[] {
  if (type === 'sample_details' || type === 'sample') {
    return [
      { key: 'atr_form_no', label: 'ATR Form No.', title: 'ATR Form No.' },
      { key: 'project_code', label: 'Project Code', title: 'Project Code' },
      { key: 'sample_code', label: 'Sample Code', title: 'Sample Code' },
      { key: 'sample_type', label: 'Sample Type', title: 'Sample Type' },
      { key: 'test_subtype', label: 'Test Sub-type', title: 'Test Sub-type' },
      { key: 'batch_no', label: 'Batch No.', title: 'Batch No.' },
      { key: 'sample_condition', label: 'Sample Condition', title: 'Sample Condition' },
      { key: 'qty', label: 'Quantity / UOM', title: 'Quantity / UOM' },
      { key: 'ar_number', label: 'AR Number', title: 'AR Number' },
      { key: 'status', label: 'Status', title: 'Status' },
    ]
  }
  if (type === 'table') {
    return [
      { key: 'param_name', label: 'Parameter Name', title: 'Parameter Name' },
      { key: 'specification', label: 'Specification', title: 'Specification' },
      { key: 'observed_value', label: 'Observed Value', title: 'Observed Value' },
      { key: 'status', label: 'Status', title: 'Status' },
    ]
  }
  if (type === 'weighing') {
    return [
      { key: 'substance', label: 'Substance / Sample Name', title: 'Substance / Sample Name' },
      { key: 'tare_wt', label: 'Tare Weight (g)', title: 'Tare Weight (g)' },
      { key: 'gross_wt', label: 'Gross Weight (g)', title: 'Gross Weight (g)' },
      { key: 'net_wt', label: 'Net Weight (g)', title: 'Net Weight (g)' },
      { key: 'balance_id', label: 'Balance ID', title: 'Balance ID' },
    ]
  }
  if (type === 'ph') {
    return [
      { key: 'solution_name', label: 'Solution Name', title: 'Solution Name' },
      { key: 'ph_val', label: 'Measured pH', title: 'Measured pH' },
      { key: 'temperature', label: 'Temperature (°C)', title: 'Temperature (°C)' },
      { key: 'buffer_used', label: 'Buffer Standard', title: 'Buffer Standard' },
      { key: 'meter_id', label: 'pH Meter ID', title: 'pH Meter ID' },
    ]
  }
  if (type === 'equipment') {
    return [
      { key: 'equipment_name', label: 'Equipment Name', title: 'Equipment Name' },
      { key: 'equipment_id', label: 'Equipment ID', title: 'Equipment ID' },
      { key: 'cal_due_date', label: 'Calibration Due', title: 'Calibration Due' },
      { key: 'operator', label: 'Operator', title: 'Operator' },
    ]
  }
  if (type === 'column') {
    return [
      { key: 'column_name', label: 'Column Name', title: 'Column Name' },
      { key: 'serial_no', label: 'Serial No.', title: 'Serial No.' },
      { key: 'dimension', label: 'Dimensions (LxIDxP)', title: 'Dimensions (LxIDxP)' },
      { key: 'inj_count', label: 'Injections', title: 'Injections' },
      { key: 'theo_plates', label: 'Plates (N)', title: 'Plates (N)' },
      { key: 'tailing_factor', label: 'Tailing (TF)', title: 'Tailing (TF)' },
    ]
  }
  if (type === 'chemical') {
    return [
      { key: 'chemical_name', label: 'Reagent / Chemical', title: 'Reagent / Chemical' },
      { key: 'grade', label: 'Grade', title: 'Grade' },
      { key: 'batch_no', label: 'Batch / Lot No.', title: 'Batch / Lot No.' },
      { key: 'exp_date', label: 'Expiry Date', title: 'Expiry Date' },
      { key: 'manufacturer', label: 'Manufacturer', title: 'Manufacturer' },
    ]
  }
  if (type === 'quantitative_result') {
    return [
      { key: 'param_code', label: 'Param Code', title: 'Param Code' },
      { key: 'param_name', label: 'Parameter Name', title: 'Parameter Name' },
      { key: 'specification', label: 'Specification Limit', title: 'Specification Limit' },
      { key: 'result', label: 'Observed Result', title: 'Observed Result' },
      { key: 'uom', label: 'UOM', title: 'UOM' },
      { key: 'compliance', label: 'Compliance', title: 'Compliance' },
    ]
  }
  if (type === 'further_actions') {
    return [
      { key: 'action_required', label: 'Action Required', title: 'Action Required' },
      { key: 'assigned_to', label: 'Assigned To', title: 'Assigned To' },
      { key: 'target_date', label: 'Target Date', title: 'Target Date' },
      { key: 'status', label: 'Status', title: 'Status' },
    ]
  }
  return []
}

function createDefaultSection(type: SectionType, sequence: number): TemplateSection {
  const id = `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const labelObj = SECTION_TYPE_CATALOG.find((c) => c.type === type)
  const title = labelObj ? labelObj.label : 'Untitled Section'

  const base: TemplateSection = { id, title, type, sequence, required: false }
  const defaultCols = getDefaultGxPColumns(type)
  if (defaultCols.length > 0) {
    base.columns = defaultCols
  }
  if (type === 'combined') {
    base.children = []
  }
  return base
}

function SortableCanvasItem({
  sec,
  idx,
  isSelected,
  isLabComp,
  editable,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  sec: TemplateSection
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sec.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="text-slate-400 hover:text-indigo-600 cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-slate-100 shrink-0"
              title="Drag to reorder section"
            >
              <GripVertical size={16} />
            </span>
          )}
          <span
            className={`w-6 h-6 rounded-full font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
              isLabComp ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800 truncate">{sec.title}</span>
              {sec.required && <Tag color="red" className="text-[9px] px-1 py-0">Required</Tag>}
              {isLabComp && <Tag color="blue" className="text-[9px] px-1 py-0">Lab Component</Tag>}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Type: {sec.type}</div>
          </div>
        </div>

        {editable && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              type="text"
              size="small"
              disabled={isFirst}
              icon={<ArrowUp size={13} />}
              onClick={onMoveUp}
            />
            <Button
              type="text"
              size="small"
              disabled={isLast}
              icon={<ArrowDown size={13} />}
              onClick={onMoveDown}
            />
            <Button
              type="text"
              danger
              size="small"
              icon={<Trash2 size={13} />}
              onClick={onRemove}
            />
          </div>
        )}
      </div>

      {sec.type === 'preconfigured_excel' && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <UniverSheetField readOnly={!editable} height={280} headers={(sec as any).sheetHeaders} />
        </div>
      )}
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [activeMobileTab, setActiveMobileTab] = useState<'palette' | 'canvas' | 'properties'>('canvas')
  const [esignPending, setEsignPending] = useState<'PUBLISHED' | 'REWORK' | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data: template, isLoading } = useQuery({
    queryKey: ['ard-template', templateId],
    queryFn: () => ardTemplateApi.get(templateId!),
    enabled: !!templateId,
  })

  const { data: masterData } = useQuery({
    queryKey: ['ard-master-data'],
    queryFn: ardApi.getMasterData,
  })

  useEffect(() => {
    if (template) {
      setDraft(template)
      if (template.sections && template.sections.length > 0) {
        setSelectedId(template.sections[0].id)
      }
    }
  }, [template?.id])

  const editable = draft ? ['DRAFT', 'REWORK'].includes(draft.status) : false

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('No draft to save')
      return ardTemplateApi.save(draft.id, {
        sections: draft.sections,
        description: draft.description,
        remarks: (draft as any).remarks,
        activationDate: (draft as any).activationDate,
        includeWeighing: !!(draft as any).includeWeighing,
        includePh: !!(draft as any).includePh,
        includeChemicals: !!(draft as any).includeChemicals,
        includeSampleDetails: !!(draft as any).includeSampleDetails,
        includeEquipment: !!(draft as any).includeEquipment,
        includeColumn: !!(draft as any).includeColumn,
        includeAttachments: !!(draft as any).includeAttachments,
        includeResults: !!(draft as any).includeResults,
        includeConclusion: !!(draft as any).includeConclusion,
        includeCdsReport: !!(draft as any).includeCdsReport,
      })
    },
    onSuccess: (updated) => {
      setDraft(updated)
      qc.invalidateQueries({ queryKey: ['ard-template', templateId] })
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

  if (isLoading || !draft || !masterData) {
    return <div className="p-8 text-center text-slate-500">Loading template builder...</div>
  }

  const selectedSection = draft.sections.find((s) => s.id === selectedId)

  const addSection = (type: SectionType) => {
    if (!editable) return
    const nextSeq = draft.sections.length + 1
    const sec = createDefaultSection(type, nextSeq)
    const updated = { ...draft, sections: [...draft.sections, sec] }
    setDraft(updated)
    setSelectedId(sec.id)
    setActiveMobileTab('canvas')
  }

  const removeSection = (id: string) => {
    if (!editable) return
    const next = draft.sections.filter((s) => s.id !== id).map((s, idx) => ({ ...s, sequence: idx + 1 }))
    setDraft({ ...draft, sections: next })
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null)
    }
  }

  const moveSection = (id: string, dir: -1 | 1) => {
    if (!editable) return
    const idx = draft.sections.findIndex((s) => s.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= draft.sections.length) return
    const reordered = [...draft.sections]
    const [item] = reordered.splice(idx, 1)
    reordered.splice(target, 0, item)
    const updated = reordered.map((s, i) => ({ ...s, sequence: i + 1 }))
    setDraft({ ...draft, sections: updated })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id && draft && editable) {
      const oldIndex = draft.sections.findIndex((s) => s.id === active.id)
      const newIndex = draft.sections.findIndex((s) => s.id === over.id)
      if (oldIndex >= 0 && newIndex >= 0) {
        const reordered = arrayMove(draft.sections, oldIndex, newIndex).map((s, i) => ({ ...s, sequence: i + 1 }))
        setDraft({ ...draft, sections: reordered })
      }
    }
  }

  const updateSelectedSection = (patch: Partial<TemplateSection>) => {
    if (!selectedId || !editable) return
    const updated = draft.sections.map((s) => (s.id === selectedId ? { ...s, ...patch } : s))
    setDraft({ ...draft, sections: updated })
  }

  const coreBlocks = SECTION_TYPE_CATALOG.filter((c) => c.group === 'Core')
  const labBlocks = SECTION_TYPE_CATALOG.filter((c) => c.group === 'Lab')

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
              Type: <span className="font-semibold text-slate-700">{draft.templateType || 'General'}</span> · Code: <span className="font-mono text-indigo-600">TPL-{draft.id.slice(0, 8).toUpperCase()}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <Button
            icon={previewMode ? <Edit2 size={14} /> : <Eye size={14} />}
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? 'Edit Mode' : 'Preview Mode'}
          </Button>

          {editable && (
            <Button
              type="primary"
              icon={<Save size={14} />}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save Template
            </Button>
          )}

          {draft.status === 'DRAFT' && (
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
                <Button danger icon={<AlertCircle size={14} />} loading={transition.isPending}
                  onClick={() => setEsignPending('REWORK')}>
                  Rework
                </Button>
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
              { label: `Canvas (${draft.sections.length})`, value: 'canvas' },
              { label: 'Properties', value: 'properties' },
            ]}
          />
        </div>
      )}

      {/* Main Builder Grid */}
      {previewMode ? (
        /* Preview Mode View */
        <Card title="Live Template Preview" className="glass-card rounded-lg overflow-hidden">
          {draft.sections.length === 0 ? (
            <Empty description="No sections added to this template." />
          ) : (
            <div className="space-y-6">
              {draft.sections.map((sec, idx) => (
                <div key={sec.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold text-slate-800 text-sm">
                      {idx + 1}. {sec.title} {sec.required && <span className="text-red-500">*</span>}
                    </span>
                    <Tag color="geekblue">{sec.type}</Tag>
                  </div>
                  {sec.type === 'richtext' && (
                    <div className="p-3 bg-white rounded border border-slate-200 text-xs text-slate-600 min-h-[60px]">
                      Rich text content / instruction placeholder...
                    </div>
                  )}
                  {['table', 'weighing', 'ph', 'equipment', 'column', 'chemical', 'quantitative_result', 'further_actions', 'sample', 'sample_details'].includes(sec.type) && (
                    <div className="overflow-x-auto">
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={[{ key: 1 }]}
                        columns={(sec.columns ?? []).map((c) => ({
                          title: c.label || c.title || c.key,
                          dataIndex: c.key,
                          render: () => <Input size="small" placeholder={`Enter ${c.label || c.title || c.key}...`} readOnly />,
                        }))}
                      />
                    </div>
                  )}
                  {sec.type === 'data_item' && (
                    <Select
                      className="w-full"
                      placeholder="Select master data item..."
                      disabled
                      options={masterData.dataItems.map((d) => ({ value: d.id, label: d.name }))}
                      value={sec.dataItemId}
                    />
                  )}
                  {sec.type === 'params' && (
                    <div className="text-xs text-slate-400 bg-white p-3 rounded border border-slate-200">
                      Result parameters key-value entries block
                    </div>
                  )}
                  {sec.type === 'preconfigured_excel' && (
                    <UniverSheetField height={320} headers={(sec as any).sheetHeaders} />
                  )}
                  {sec.type === 'content_block' && (() => {
                    const block = masterData.contentBlocks?.find(b => b.id === (sec as any).contentBlockId)
                    if (!block) return (
                      <div className="text-xs text-slate-400 italic bg-white p-3 rounded border border-slate-200 min-h-[60px]">
                        No content block linked. Select one in Properties.
                      </div>
                    )
                    if (block.contentType === 'richtext' && block.body) {
                      return (
                        <div
                          className="prose prose-sm max-w-none bg-white p-3 rounded border border-slate-200 min-h-[60px]"
                          dangerouslySetInnerHTML={{ __html: block.body }}
                        />
                      )
                    }
                    return (
                      <div className="bg-white p-3 rounded border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap min-h-[60px]">
                        {block.body || '(empty)'}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        /* Edit Mode Responsive Grid: Palette | Canvas | Properties Inspector */
        <div className="grid grid-cols-12 gap-4 items-start">
          {/* Column 1: Block Palette */}
          <div className={`col-span-12 lg:col-span-3 glass-card rounded-lg p-4 space-y-4 ${activeMobileTab === 'palette' ? 'block' : 'hidden lg:block'}`}>
            <div className="border-b border-slate-100 pb-2">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <LayoutGrid size={16} className="text-indigo-600" /> Block Palette
              </h2>
              <p className="text-[11px] text-slate-400">Click to add section blocks to canvas</p>
            </div>

            <div className="space-y-4 max-h-[650px] overflow-y-auto pr-1">
              {/* Core Blocks */}
              <div>
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">Core Blocks</div>
                <div className="space-y-1.5">
                  {coreBlocks.map((cat) => {
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.type}
                        disabled={!editable}
                        onClick={() => addSection(cat.type)}
                        className="w-full text-left p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-slate-100 group-hover:bg-indigo-100 text-slate-600 group-hover:text-indigo-600 transition-colors">
                            <Icon size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700">{cat.label}</div>
                            <div className="text-[10px] text-slate-400 truncate">{cat.hint}</div>
                          </div>
                          <Plus size={13} className="text-slate-300 group-hover:text-indigo-600" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Lab Components */}
              <div>
                <div className="text-[11px] font-bold tracking-wider text-indigo-500 uppercase mb-2 flex items-center gap-1">
                  <Beaker size={12} /> Lab Components
                </div>
                <div className="space-y-1.5">
                  {labBlocks.map((cat) => {
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.type}
                        disabled={!editable}
                        onClick={() => addSection(cat.type)}
                        className="w-full text-left p-2 rounded-lg border border-indigo-100 bg-indigo-50/20 hover:border-indigo-500 hover:bg-indigo-50/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Icon size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-indigo-950 group-hover:text-indigo-700">{cat.label}</div>
                            <div className="text-[10px] text-slate-500 truncate">{cat.hint}</div>
                          </div>
                          <Plus size={13} className="text-indigo-300 group-hover:text-indigo-600" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Center Canvas */}
          <div className={`col-span-12 lg:col-span-5 glass-card rounded-lg p-4 space-y-3 min-h-[650px] ${activeMobileTab === 'canvas' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Template Canvas</h2>
                <p className="text-[11px] text-slate-400">{draft.sections.length} section block(s) configured (drag handle to reorder)</p>
              </div>
            </div>

            {draft.sections.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">No sections in template canvas</p>
                <p className="text-[11px] text-slate-400 mt-1">Select a block from Core or Lab Components on the left to add it here.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={draft.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                    {draft.sections.map((sec, idx) => {
                      const isSelected = sec.id === selectedId
                      const isLabComp = labBlocks.some((l) => l.type === sec.type)
                      return (
                        <SortableCanvasItem
                          key={sec.id}
                          sec={sec}
                          idx={idx}
                          isSelected={isSelected}
                          isLabComp={isLabComp}
                          editable={editable}
                          isFirst={idx === 0}
                          isLast={idx === draft.sections.length - 1}
                          onSelect={() => {
                            setSelectedId(sec.id)
                            if (window.innerWidth < 1024) setActiveMobileTab('properties')
                          }}
                          onMoveUp={() => moveSection(sec.id, -1)}
                          onMoveDown={() => moveSection(sec.id, 1)}
                          onRemove={() => removeSection(sec.id)}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Column 3: Section Properties Inspector */}
          <div className={`col-span-12 lg:col-span-4 glass-card rounded-lg p-4 space-y-4 min-h-[650px] ${activeMobileTab === 'properties' ? 'block' : 'hidden lg:block'}`}>
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">
                  {selectedSection ? 'Section Properties' : 'Template Settings'}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {selectedSection ? 'Configure selected section settings' : 'Template metadata & fixed section flags'}
                </p>
              </div>
              {selectedSection && (
                <Button size="small" type="text" onClick={() => setSelectedId(null)} className="text-xs text-slate-500">
                  ← Template Settings
                </Button>
              )}
            </div>

            {!selectedSection ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">Template Details</h3>
                  <Form layout="vertical" size="small">
                    <Form.Item label="Description" className="mb-3">
                      <Input.TextArea
                        disabled={!editable}
                        rows={2}
                        value={draft.description ?? ''}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder="Template purpose description..."
                      />
                    </Form.Item>
                    <Form.Item label="Remarks" className="mb-3">
                      <Input.TextArea
                        disabled={!editable}
                        rows={2}
                        value={(draft as any).remarks ?? ''}
                        onChange={(e) => setDraft({ ...draft, remarks: e.target.value } as any)}
                        placeholder="Internal remarks..."
                      />
                    </Form.Item>
                    <Form.Item label="Activation Date" className="mb-3">
                      <Input
                        disabled={!editable}
                        placeholder="YYYY-MM-DD"
                        value={(draft as any).activationDate ?? ''}
                        onChange={(e) => setDraft({ ...draft, activationDate: e.target.value } as any)}
                      />
                    </Form.Item>
                  </Form>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-1">Fixed Section Inclusions</h3>
                  <p className="text-[11px] text-slate-400 mb-2">Control which fixed sections this template includes in experiments.</p>
                  <div className="space-y-1.5">
                    {([
                      ['includeWeighing', 'Weighing'],
                      ['includePh', 'pH Measurement'],
                      ['includeChemicals', 'Chemicals / Reagents'],
                      ['includeSampleDetails', 'Sample Details'],
                      ['includeEquipment', 'Equipment / Instruments'],
                      ['includeColumn', 'Chromatography Column'],
                      ['includeAttachments', 'Attachments / Spectra'],
                      ['includeResults', 'Results Summary'],
                      ['includeConclusion', 'Conclusion'],
                      ['includeCdsReport', 'CDS Report'],
                    ] as [string, string][]).map(([key, label]) => (
                      <Checkbox
                        key={key}
                        disabled={!editable}
                        checked={!!((draft as any)[key])}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.checked } as any)}
                      >
                        <span className="text-xs text-slate-700">{label}</span>
                      </Checkbox>
                    ))}
                  </div>
                </div>
                <div className="pt-2 text-center text-slate-400 text-[11px]">
                  Select a section block in the canvas to inspect its properties.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Form layout="vertical">
                  <Form.Item label="Section Title" className="mb-3">
                    <Input
                      disabled={!editable}
                      value={selectedSection.title}
                      onChange={(e) => updateSelectedSection({ title: e.target.value })}
                      placeholder="e.g. Weighing Details"
                    />
                  </Form.Item>

                  <Form.Item label="Unique Identifier" className="mb-3">
                    <Input
                      disabled={!editable}
                      value={(selectedSection as any).uid ?? ''}
                      onChange={(e) => updateSelectedSection({ uid: e.target.value } as any)}
                      placeholder="e.g. weighing_details_1"
                      className="font-mono text-xs"
                    />
                  </Form.Item>

                  <Form.Item label="Description" className="mb-3">
                    <Input.TextArea
                      disabled={!editable}
                      rows={2}
                      value={(selectedSection as any).description ?? ''}
                      onChange={(e) => updateSelectedSection({ description: e.target.value } as any)}
                      placeholder="Describe the purpose of this section..."
                    />
                  </Form.Item>

                  <Form.Item label="Section Type" className="mb-3">
                    <Select
                      disabled={!editable}
                      value={selectedSection.type}
                      onChange={(v: SectionType) => {
                        const defaultCols = getDefaultGxPColumns(v)
                        updateSelectedSection({ type: v, columns: defaultCols.length ? defaultCols : undefined })
                      }}
                      options={SECTION_TYPE_CATALOG.map((c) => ({ value: c.type, label: `${c.label} (${c.group})` }))}
                    />
                  </Form.Item>

                  <Form.Item className="mb-3">
                    <Checkbox
                      disabled={!editable}
                      checked={selectedSection.required ?? false}
                      onChange={(e) => updateSelectedSection({ required: e.target.checked })}
                    >
                      <span className="text-xs font-medium text-slate-700">Mandatory section for submission</span>
                    </Checkbox>
                  </Form.Item>

                  {(selectedSection.type === 'data_item' || selectedSection.type === 'autocomplete_data_item') && (
                    <Form.Item label="Linked Master Data Item" className="mb-3">
                      <Select
                        disabled={!editable}
                        placeholder="Select linked data item..."
                        allowClear
                        value={selectedSection.dataItemId}
                        onChange={(v) => updateSelectedSection({ dataItemId: v })}
                        options={masterData.dataItems.map((d) => ({ value: d.id, label: `${d.name} (${d.dataType})` }))}
                      />
                    </Form.Item>
                  )}

                  {selectedSection.type === 'content_block' && (
                    <>
                      <Form.Item label="Content Library Block" className="mb-3">
                        <Select
                          disabled={!editable}
                          placeholder="Select a content block from library..."
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          value={(selectedSection as any).contentBlockId}
                          onChange={(v) => updateSelectedSection({ contentBlockId: v } as any)}
                          options={(masterData.contentBlocks ?? []).filter(b => b.active).map((b) => ({
                            value: b.id,
                            label: `${b.name} (${b.contentType})`,
                          }))}
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Manage blocks in ARD Configuration → Content Library
                        </p>
                      </Form.Item>
                      <Form.Item className="mb-3">
                        <Checkbox
                          disabled={!editable}
                          checked={(selectedSection as any).allowEdit ?? true}
                          onChange={(e) => updateSelectedSection({ allowEdit: e.target.checked } as any)}
                        >
                          <span className="text-xs font-medium text-slate-700">Allow analyst to edit content in experiment</span>
                        </Checkbox>
                      </Form.Item>
                    </>
                  )}

                  {selectedSection.type === 'preconfigured_excel' && (
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <label className="text-xs font-semibold text-slate-700 block">Column Headers</label>
                      <p className="text-[11px] text-slate-400 -mt-2">Define header names for the spreadsheet columns.</p>
                      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                        {((selectedSection as any).sheetHeaders ?? ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5']).map((h: string, hIdx: number) => (
                          <div key={hIdx} className="flex gap-1.5 items-center">
                            <span className="text-[10px] text-slate-400 w-4 text-right shrink-0">{hIdx + 1}</span>
                            <Input
                              className="text-xs flex-1"
                              placeholder={`Column ${hIdx + 1}`}
                              disabled={!editable}
                              value={h}
                              onChange={(e) => {
                                const headers = [...((selectedSection as any).sheetHeaders ?? ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5'])]
                                headers[hIdx] = e.target.value
                                updateSelectedSection({ sheetHeaders: headers } as any)
                              }}
                            />
                            {editable && (
                              <Button
                                type="text" danger size="small"
                                className="p-0 flex items-center justify-center"
                                icon={<Trash2 size={13} />}
                                onClick={() => {
                                  const headers = ((selectedSection as any).sheetHeaders ?? []).filter((_: string, i: number) => i !== hIdx)
                                  updateSelectedSection({ sheetHeaders: headers } as any)
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      {editable && (
                        <Button
                          block type="dashed" size="small"
                          icon={<Plus size={13} />}
                          onClick={() => {
                            const headers = (selectedSection as any).sheetHeaders ?? ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5']
                            updateSelectedSection({ sheetHeaders: [...headers, `Column ${headers.length + 1}`] } as any)
                          }}
                        >
                          Add Column
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Laurus-ARD Dynamic Column Manager with Key, Title, Delete, Add Column, and Reset GxP Schema */}
                  {['table', 'weighing', 'ph', 'equipment', 'column', 'chemical', 'quantitative_result', 'further_actions', 'sample', 'sample_details'].includes(selectedSection.type) && (
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 block">Table Columns</label>
                        {selectedSection.type !== 'table' && editable && (
                          <Button
                            size="small"
                            type="text"
                            className="text-indigo-600 hover:text-indigo-700 text-xs px-1 h-6 flex items-center gap-1"
                            icon={<RotateCcw size={12} />}
                            onClick={() => {
                              const resetCols = getDefaultGxPColumns(selectedSection.type)
                              updateSelectedSection({ columns: resetCols })
                              msg.info('Reset columns to standard GxP schema.')
                            }}
                          >
                            Reset to GxP schema
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {(selectedSection.columns ?? []).map((col, cIdx) => (
                          <div key={`${col.key}-${cIdx}`} className="grid grid-cols-12 gap-1.5 items-center bg-slate-50/70 p-2 rounded-lg border border-slate-200">
                            <Input
                              className="col-span-5 text-xs font-mono"
                              placeholder="Key"
                              disabled={!editable}
                              value={col.key}
                              onChange={(e) => {
                                const cols = [...(selectedSection.columns ?? [])]
                                cols[cIdx] = { ...cols[cIdx], key: e.target.value }
                                updateSelectedSection({ columns: cols })
                              }}
                            />
                            <Input
                              className="col-span-6 text-xs"
                              placeholder="Title / Header"
                              disabled={!editable}
                              value={col.label || col.title || ''}
                              onChange={(e) => {
                                const cols = [...(selectedSection.columns ?? [])]
                                cols[cIdx] = { ...cols[cIdx], label: e.target.value, title: e.target.value }
                                updateSelectedSection({ columns: cols })
                              }}
                            />
                            {editable && (
                              <Button
                                type="text"
                                danger
                                size="small"
                                className="col-span-1 p-0 flex items-center justify-center"
                                icon={<Trash2 size={13} />}
                                onClick={() => {
                                  const cols = (selectedSection.columns ?? []).filter((_, idx) => idx !== cIdx)
                                  updateSelectedSection({ columns: cols })
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {editable && (
                        <Button
                          block
                          type="dashed"
                          size="small"
                          icon={<Plus size={13} />}
                          onClick={() => {
                            const cols = selectedSection.columns ?? []
                            const newCol = { key: `col_${cols.length + 1}`, label: `New Column ${cols.length + 1}`, title: `New Column ${cols.length + 1}` }
                            updateSelectedSection({ columns: [...cols, newCol] })
                          }}
                        >
                          Add Column
                        </Button>
                      )}
                    </div>
                  )}

                  {selectedSection.type === 'combined' && (
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Child Sections</span>
                        {editable && (
                          <Button
                            size="small"
                            type="dashed"
                            icon={<Plus size={12} />}
                            onClick={() => {
                              const children = selectedSection.children ?? []
                              const newChild = createDefaultSection('richtext', children.length + 1)
                              updateSelectedSection({ children: [...children, newChild] })
                            }}
                          >
                            Add Child
                          </Button>
                        )}
                      </div>

                      {(selectedSection.children ?? []).map((child, cIdx) => (
                        <div key={child.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Input
                              size="small"
                              disabled={!editable}
                              value={child.title}
                              onChange={(e) => {
                                const children = [...(selectedSection.children ?? [])]
                                children[cIdx] = { ...children[cIdx], title: e.target.value }
                                updateSelectedSection({ children })
                              }}
                            />
                            {editable && (
                              <Button
                                size="small"
                                type="text"
                                danger
                                icon={<Trash2 size={12} />}
                                onClick={() => {
                                  const children = (selectedSection.children ?? []).filter((_, idx) => idx !== cIdx)
                                  updateSelectedSection({ children })
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Form>
              </div>
            )}
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
    </div>
  )
}
