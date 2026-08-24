import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Input, Select, Modal, Form, message, Dropdown, Tag } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Pencil, Search, Eye, MoreVertical, ToggleLeft, ToggleRight } from 'lucide-react'
import { checklistApi, type Checklist, type ChecklistDetail, type ChecklistItem } from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { EmptyValue, withEmptyValue } from '../../components/ui/EmptyValue'

const DATA_TYPE_COLOR: Record<string, string> = {
  TEXT: 'blue', NUMBER: 'purple', OPTIONS: 'orange', BOOLEAN: 'green', DATE: 'cyan',
  INPUT: 'purple', OBSERVATION: 'gold', SINGLE_SELECTION: 'orange', MULTIPLE_SELECTION: 'orange',
}
const INSTRUCTION_TYPE_COLOR: Record<string, string> = {
  CHECKPOINT: 'volcano', INSTRUCTION: 'geekblue', OBSERVATION: 'gold', HEADING: 'default',
}

export const CHECKLIST_TYPES = ['MAINTENANCE', 'EQUIPMENT_CLEANING', 'EQUIPMENT_CUSTOM', 'SCHEDULER', 'CALIBRATION']

export const CHECKLIST_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_VERIFICATION: 'Pending for Manager Review',
  PENDING_APPROVAL: 'Pending for QA Review',
  APPROVED: 'Approved',
}
export const CHECKLIST_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', PENDING_VERIFICATION: 'gold', PENDING_APPROVAL: 'blue', APPROVED: 'green',
}

const label = (s: string) => s.replace(/_/g, ' ')

export default function ChecklistsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Checklist | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const [viewOpen, setViewOpen] = useState(false)
  const [viewDetail, setViewDetail] = useState<ChecklistDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (typeFilter) params.checklist_type = typeFilter
      if (statusFilter) params.status = statusFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await checklistApi.listPaged(params)
      setItems(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, typeFilter, statusFilter, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, typeFilter, statusFilter])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: Checklist) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) {
        await checklistApi.update(editing.id, values)
        message.success('Checklist updated')
      } else {
        const created = await checklistApi.create(values)
        message.success('Checklist created')
        setModalOpen(false); form.resetFields()
        navigate(`/inventory/checklists/${created.id}`)
        return
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const toggle = async (r: Checklist) => {
    try { await checklistApi.toggle(r.id); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  const openView = async (r: Checklist) => {
    setViewDetail(null)
    setViewOpen(true)
    setViewLoading(true)
    try {
      const detail = await checklistApi.get(r.id)
      setViewDetail(detail)
    } catch { message.error('Failed to load checklist details') }
    finally { setViewLoading(false) }
  }

  const itemColumns: ColumnsType<ChecklistItem> = [
    {
      title: '#', dataIndex: 'seq_no', width: 44, align: 'center',
      render: (v) => <span className="text-[12px] font-semibold text-slate-500">{v}</span>,
    },
    {
      title: 'Type', dataIndex: 'instruction_type', width: 130,
      render: (v: string) => (
        <Tag color={INSTRUCTION_TYPE_COLOR[v] ?? 'default'} style={{ whiteSpace: 'normal', fontSize: 11 }}>
          {v?.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Details / Instruction', dataIndex: 'details', width: 280,
      render: (v: string | null) => (
        <span className="text-[13px] text-slate-800" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {withEmptyValue(v)}
        </span>
      ),
    },
    {
      title: 'Data Type', dataIndex: 'data_type', width: 140,
      render: (v: string | null) => v
        ? <Tag color={DATA_TYPE_COLOR[v] ?? 'default'} style={{ whiteSpace: 'normal', fontSize: 11 }}>{v}</Tag>
        : <EmptyValue />,
    },
    {
      title: 'Options / Range', key: 'range', width: 200,
      render: (_, r: ChecklistItem) => {
        if (r.options?.length) return <span className="text-[12px] text-slate-600" style={{ wordBreak: 'break-word' }}>{r.options.join(' | ')}</span>
        if (r.lower_limit != null || r.upper_limit != null) return (
          <span className="text-[12px] text-slate-600">
            {withEmptyValue(r.lower_limit)} – {withEmptyValue(r.upper_limit)}
            {r.precision != null ? <span className="text-slate-400"> (±{r.precision})</span> : null}
          </span>
        )
        return <EmptyValue />
      },
    },
    {
      title: 'Frequency', dataIndex: 'frequencies', width: 160,
      render: (v: string[] | null) => v?.length
        ? <div className="flex flex-wrap gap-1">{v.map(f => <Tag key={f} color="default" style={{ fontSize: 10, margin: 0 }}>{f}</Tag>)}</div>
        : <EmptyValue />,
    },
  ]

  const columns: ColumnsType<Checklist> = [
    { title: 'Sl No', ellipsis: true, key: 'sl', width: 140, render: (_, __, i) => <span className="text-[13px] text-slate-800">{(page - 1) * pageSize + i + 1}</span> },
    { title: 'Checklist Name', ellipsis: true, dataIndex: 'name', width: 140, sorter: true, render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800 font-medium" onClick={() => navigate(`/inventory/checklists/${r.id}`)}>{v}</a> },
    { title: 'Version', ellipsis: true, dataIndex: 'version', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Checklist Type', ellipsis: true, dataIndex: 'checklist_type', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{label(v)}</span> },
    { title: 'Log Type', ellipsis: true, dataIndex: 'log_type', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{label(v)}</span> },
    { title: 'Target', ellipsis: true, dataIndex: 'target_kind', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{label(v)}</span> },
    { title: 'Usage Type', ellipsis: true, dataIndex: 'usage_type', width: 140, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 140, sorter: true, render: v => <StatusTag color={CHECKLIST_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{CHECKLIST_STATUS_LABEL[v] ?? v}</StatusTag> },
    {
      title: 'Actions', key: 'actions', width: 90, align: 'center', render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'view', label: <span className="text-[12px]">View Checklist</span>, icon: <Eye size={12} /> },
          { key: 'edit', label: <span className="text-[12px]">{r.status === 'DRAFT' ? 'Edit' : 'Only DRAFT can be edited'}</span>, icon: <Pencil size={12} />, disabled: r.status !== 'DRAFT' },
          {
            key: 'toggle',
            label: <span className="text-[12px]">{r.is_active ? 'Deactivate' : 'Activate'}</span>,
            icon: r.is_active ? <ToggleLeft size={12} /> : <ToggleRight size={12} />,
            danger: r.is_active,
          },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'view') openView(r)
          else if (key === 'edit') { if (r.status === 'DRAFT') openEdit(r) }
          else if (key === 'toggle') toggle(r)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search name…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Types" allowClear style={{ minWidth: 170 }} value={typeFilter} onChange={setTypeFilter} options={CHECKLIST_TYPES.map(s => ({ value: s, label: label(s) }))} />
        <Select placeholder="All Status" allowClear style={{ minWidth: 200 }} value={statusFilter} onChange={setStatusFilter} options={Object.keys(CHECKLIST_STATUS_LABEL).map(s => ({ value: s, label: CHECKLIST_STATUS_LABEL[s] }))} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">Add Checklist</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} checklists`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<Checklist>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
        />
      </div>

      {/* Checklist Viewer Modal */}
      <Modal
        title={
          viewDetail
            ? <span className="text-slate-800 font-semibold">
                {viewDetail.name}
                <span className="ml-2 text-[12px] font-normal text-violet-600 bg-violet-50 border border-violet-200 rounded px-2 py-0.5">
                  v{viewDetail.version}
                </span>
                <span className="ml-2 text-[12px] font-normal text-slate-400">{viewDetail.checklist_type?.replace(/_/g, ' ')}</span>
              </span>
            : 'Checklist Details'
        }
        open={viewOpen}
        closable={false}
        onCancel={() => setViewOpen(false)}
        footer={<Button onClick={() => setViewOpen(false)}>Close</Button>}
        width={940}
        centered
        destroyOnHidden
        {...glassModalProps}
        styles={{ ...glassModalStyles, body: { ...glassModalStyles.body, padding: '12px 22px 4px' } }}
      >
        {viewLoading ? (
          <div className="flex items-center justify-center py-12"><BrandSpinner fullScreen={false} label="Loading checklist details…" /></div>
        ) : viewDetail?.items?.length ? (
          <Table
            dataSource={[...viewDetail.items].sort((a, b) => a.seq_no - b.seq_no)}
            columns={itemColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content', y: 440 }}
          />
        ) : (
          <p className="text-center text-slate-400 text-[13px] py-8">No items in this checklist.</p>
        )}
      </Modal>

      <Modal title={editing ? 'Edit Checklist' : 'Add Checklist'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={520} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Checklist Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="checklist_type" label="Checklist Type">
            <Select allowClear options={CHECKLIST_TYPES.map(s => ({ value: s, label: label(s) }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
