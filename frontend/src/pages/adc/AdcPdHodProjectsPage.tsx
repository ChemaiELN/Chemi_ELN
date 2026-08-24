import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, Form, Input, Select, DatePicker, Table, Tooltip, Grid, message } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Pencil, Search } from 'lucide-react'
import { projectApi, type Project } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { ApiError } from '../../api/client'
import { EmptyValue } from '../../components/ui/EmptyValue'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', Active: 'green',
  ON_HOLD: 'orange', 'On Hold': 'orange',
  COMPLETED: 'blue', Completed: 'blue',
  CANCELLED: 'red', Cancelled: 'red',
  ARCHIVED: 'default',
}

export default function AdcPdHodProjectsPage() {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const screens   = useBreakpoint()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearchTerm(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const [notebookFilter, setNotebookFilter] = useState<'all' | 'with_notebooks' | 'without_notebooks'>('all')

  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  useEffect(() => { setPage(1) }, [searchTerm, notebookFilter])

  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [editForm] = Form.useForm()

  // ── Data ──────────────────────────────────────────────────────────────────
  // department_code scopes this to "every ADC_PD project" (the HOD view),
  // not "projects I'm personally assigned to" — see projects.routes.ts.
  const { data, isLoading } = useQuery({
    queryKey: ['adc-hod-projects', page, pageSize, searchTerm, notebookFilter, sortBy, sortDir],
    queryFn:  () => projectApi.list({
      department_code: 'ADC_PD',
      page, limit: pageSize, search: searchTerm || undefined,
      has_notebooks: notebookFilter === 'all' ? undefined : notebookFilter === 'with_notebooks',
      sort_by: sortBy ?? undefined, sort_dir: sortDir,
    }),
  })
  const projects = data?.items ?? []
  const total = data?.total ?? 0

  // ── Mutations ─────────────────────────────────────────────────────────────
  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      projectApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-hod-projects'] })
      msg.success('Project updated.')
      setEditTarget(null)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update project'),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openEdit = (p: Project) => {
    setEditTarget(p)
    editForm.setFieldsValue({
      name:                p.name,
      product_name:        p.product_name,
      in_house_project_id: p.in_house_project_id,
      project_type:        p.project_type,
      market:              p.market,
      status:              p.status,
      start_date:          p.start_date  ? dayjs(p.start_date)  : null,
      target_date:         p.target_date ? dayjs(p.target_date) : null,
      description:         p.description,
      objective:           p.objective,
    })
  }

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnsType<Project> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 130,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Project Name', dataIndex: 'name', key: 'name', width: 200,
      sorter: true,
      render: (v: string, row) => (
        <button
          onClick={() => navigate(`/adc/projects/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Type', dataIndex: 'project_type', key: 'project_type', width: 130,
      sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130, align: 'center' as const,
      sorter: true,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Notebooks', dataIndex: 'notebook_count', key: 'notebook_count', width: 140, align: 'center' as const,
      render: (v: number | undefined) => !v
        ? <span className="text-[13px] text-amber-500 italic">Not created</span>
        : <span className="text-[12px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">{v} Notebook{v === 1 ? '' : 's'}</span>,
    },
    {
      title: 'Created By', dataIndex: 'created_by_name', key: 'created_by_name', width: 130,
      sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Start Date', dataIndex: 'start_date', key: 'start_date', width: 130,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>
        : <EmptyValue />,
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center' as const,
      render: (_: unknown, row: Project) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Edit project">
            <button
              onClick={() => openEdit(row)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      {ctx}

      {/* Filter bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap mb-3" style={{ backgroundColor: '#FEFEFA' }}>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search projects…"
          style={{ width: 240 }}
          allowClear
        />
        <Select
          value={notebookFilter}
          onChange={setNotebookFilter}
          style={{ width: 180 }}
          options={[
            { value: 'all',               label: 'All Notebook Status' },
            { value: 'with_notebooks',    label: 'Notebook Created' },
            { value: 'without_notebooks', label: 'Notebook Not Created' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          dataSource={projects}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} projects`,
            size: 'small',
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            const s = sorter as SorterResult<Project>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
          locale={{ emptyText: 'No ADC PD projects found.' }}
        />
      </div>

      {/* ── Edit project modal ───────────────────────────────────────────────── */}
      <Modal
        title={editTarget ? `Edit — ${editTarget.code}` : 'Edit Project'}
        open={!!editTarget}
        onCancel={() => { setEditTarget(null); editForm.resetFields() }}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={editMut.isPending}
        width={640}
        centered
        destroyOnHidden
        closable={false}
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => {
            if (!editTarget) return
            editMut.mutate({
              id: editTarget.id,
              body: {
                ...vals,
                start_date:  vals.start_date  ? dayjs(vals.start_date).format('YYYY-MM-DD')  : null,
                target_date: vals.target_date ? dayjs(vals.target_date).format('YYYY-MM-DD') : null,
              },
            })
          }}
        >
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              label="Project Name"
              name="name"
              className="col-span-2"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Input />
            </Form.Item>
          </div>

          <div className="grid grid-cols-3 gap-x-4">
            <Form.Item label="Product Name" name="product_name">
              <Input />
            </Form.Item>
            <Form.Item label="In House Project ID" name="in_house_project_id">
              <Input />
            </Form.Item>
            <Form.Item label="Type" name="project_type">
              <Select
                options={[
                  { value: 'External', label: 'External' },
                  { value: 'Internal', label: 'Internal' },
                ]}
                allowClear
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="Market / Customer" name="market">
              <Input />
            </Form.Item>
            <Form.Item label="Status" name="status">
              <Select
                options={[
                  { value: 'ACTIVE',    label: 'Active' },
                  { value: 'ON_HOLD',   label: 'On Hold' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="Start Date" name="start_date">
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item label="Target Date" name="target_date">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item label="Objective" name="objective">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
