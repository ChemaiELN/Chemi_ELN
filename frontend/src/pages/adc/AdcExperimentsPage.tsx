import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Grid, Input, Button, Modal, Form, Select, Tooltip, Spin, message } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'

const { useBreakpoint } = Grid
import { Search, Plus, Pencil } from 'lucide-react'
import dayjs from 'dayjs'
import { experimentApi, notebookApi, userApi, type ExperimentListItem, type Notebook } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { useCan } from '../../hooks/usePrivilege'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'blue', APPROVED: 'green',
  REJECTED: 'red', LOCKED: 'purple', VOID: 'orange',
}

function AssignedChemistCell({ experimentId }: { experimentId: string }) {
  const { data: chemAssigned = [] } = useQuery({
    queryKey: ['experiment-assigned-users', experimentId],
    queryFn:  () => experimentApi.getAssignedUsers(experimentId),
  })
  if (!chemAssigned.length) {
    return <span className="text-[13px] text-amber-500 italic">Not assigned</span>
  }
  const shown = chemAssigned.slice(0, 3)
  const extra = chemAssigned.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map(u => (
        <Tooltip key={u.user_id} title={u.username}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0 ring-2 ring-white cursor-default">
            <span className="text-white text-[11px] font-bold">
              {(u.username ?? '?').slice(0, 2).toUpperCase()}
            </span>
          </div>
        </Tooltip>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 ring-2 ring-white">
          <span className="text-slate-600 text-[10px] font-bold">+{extra}</span>
        </div>
      )}
    </div>
  )
}

export default function AdcExperimentsPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const screens  = useBreakpoint()
  const canCreateExperiment = useCan('adc.experiment.create')

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  useEffect(() => { setPage(1) }, [searchTerm])

  const [expModal, setExpModal] = useState(false)
  const [expForm]  = Form.useForm()

  const [editTarget, setEditTarget] = useState<ExperimentListItem | null>(null)
  const [editForm]   = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['experiments-all', page, pageSize, searchTerm, sortBy, sortDir],
    queryFn:  () => experimentApi.listAll({
      page, limit: pageSize, search: searchTerm || undefined,
      sort_by: sortBy ?? undefined, sort_dir: sortDir,
    }),
  })

  // Notebooks received by this TL — the "Notebook" picker in the New Experiment
  // modal searches server-side as the user types, instead of loading a flat
  // capped page of notebooks up front.
  const [notebookSearchInput, setNotebookSearchInput] = useState('')
  const [notebookSearch, setNotebookSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setNotebookSearch(notebookSearchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [notebookSearchInput])

  const { data: myNotebooksData, isFetching: notebooksSearching } = useQuery({
    queryKey: ['notebooks-assigned-to-me', notebookSearch],
    queryFn:  () => notebookApi.listAll({ assigned_to_me: true, search: notebookSearch || undefined, limit: 50 }),
    enabled:  expModal,
  })
  const myNotebooks = myNotebooksData?.items ?? []

  // Chemists for the "Assign Chemist" picker
  const { data: adcPdChemUsers = [] } = useQuery({
    queryKey: ['users-adc-pd-chem'],
    queryFn: () => userApi.list({ role_code: 'CHEM', dept_code: 'ADC_PD' }).then(r => r.items),
    staleTime: 5 * 60 * 1000,
  })

  // Chemists currently assigned to the experiment being edited
  const { data: editAssignedUsers = [] } = useQuery({
    queryKey: ['experiment-assigned-users', editTarget?.id],
    queryFn:  () => experimentApi.getAssignedUsers(editTarget!.id),
    enabled:  !!editTarget,
  })
  const editAssignedChemIds = editAssignedUsers.map(u => u.user_id)

  const createExpMut = useMutation({
    mutationFn: async ({ notebookId, title, chemistIds }: { notebookId: string; title: string; chemistIds: string[] }) => {
      const exp = await experimentApi.createForNotebook(notebookId, { title })
      await Promise.all(chemistIds.map(uid => experimentApi.assignUser(exp.id, uid)))
      return exp
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiments-all'] })
      message.success('Experiment created.')
      setExpModal(false)
      expForm.resetFields()
    },
    onError: () => message.error('Failed to create experiment'),
  })

  const openEdit = (row: ExperimentListItem) => {
    setEditTarget(row)
  }

  useEffect(() => {
    if (editTarget) {
      editForm.setFieldsValue({ title: editTarget.title, chemist_ids: editAssignedChemIds })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget, editAssignedUsers])

  const editExpMut = useMutation({
    mutationFn: async ({ title, chemistIds }: { title: string; chemistIds: string[] }) => {
      if (!editTarget) return
      await experimentApi.update(editTarget.id, { title })
      const toAdd    = chemistIds.filter(uid => !editAssignedChemIds.includes(uid))
      const toRemove = editAssignedChemIds.filter(uid => !chemistIds.includes(uid))
      await Promise.all([
        ...toAdd.map(uid => experimentApi.assignUser(editTarget.id, uid)),
        ...toRemove.map(uid => experimentApi.unassignUser(editTarget.id, uid)),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiments-all'] })
      qc.invalidateQueries({ queryKey: ['experiment-assigned-users', editTarget?.id] })
      message.success('Experiment updated.')
      setEditTarget(null)
      editForm.resetFields()
    },
    onError: () => message.error('Failed to update experiment'),
  })

  const experiments = data?.items ?? []
  const total = data?.total ?? 0

  const columns: ColumnsType<ExperimentListItem> = [
    {
      title: 'Code',
      dataIndex: 'full_code',
      key: 'full_code',
      width: 130,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Experiment Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      sorter: true,
      render: (v: string, row: ExperimentListItem) => (
        <button
          onClick={() => navigate(`/notebooks/${row.notebook_id}/experiments/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Notebook',
      dataIndex: 'notebook_code',
      key: 'notebook_code',
      width: 130,
      render: (v: string, row: ExperimentListItem) => (
        <button
          onClick={() => navigate(`/notebooks/${row.notebook_id}/overview`)}
          className="text-[13px] text-teal-600 hover:text-teal-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project_code',
      key: 'project_code',
      width: 130,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center',
      sorter: true,
      render: (v: string) => (
        <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>
      ),
    },
    {
      title: 'Assigned Chemist',
      key: 'chemist',
      width: 160,
      render: (_: unknown, row: ExperimentListItem) => (
        <AssignedChemistCell experimentId={row.id} />
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: 130,
      align: 'center',
      render: (_: unknown, row: ExperimentListItem) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Edit experiment">
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
      {/* Filter bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap mb-3" style={{ backgroundColor: '#FEFEFA' }}>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search…"
          style={{ width: 240 }}
          allowClear
        />
        {canCreateExperiment && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setExpModal(true)}
            className="rounded-md font-medium"
          >
            New Experiment
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          dataSource={experiments}
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
            showTotal: (t) => `${t} experiments`,
            size: 'small',
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            const s = sorter as SorterResult<ExperimentListItem>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
          locale={{ emptyText: 'No experiments found.' }}
        />
      </div>

      {/* New Experiment — pick the notebook you received, then create + assign chemist(s) */}
      <Modal
        title="New Experiment"
        open={expModal}
        closable={false}
        onCancel={() => { setExpModal(false); expForm.resetFields(); setNotebookSearchInput('') }}
        onOk={() => expForm.submit()}
        okText="Create"
        confirmLoading={createExpMut.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={expForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => createExpMut.mutate({
            notebookId: vals.notebook_id,
            title: vals.title,
            chemistIds: vals.chemist_ids ?? [],
          })}
        >
          <Form.Item label="Notebook" name="notebook_id" rules={[{ required: true, message: 'Select a notebook' }]}>
            <Select
              placeholder="Search a notebook you received…"
              showSearch
              filterOption={false}
              onSearch={setNotebookSearchInput}
              loading={notebooksSearching}
              notFoundContent={notebooksSearching ? <Spin size="small" /> : null}
              options={myNotebooks.map((nb: Notebook) => ({
                value: nb.id,
                label: `${nb.code} — ${nb.title}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. ADC Conjugation Run 1" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select ADC PD Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={adcPdChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Experiment — rename the experiment and change chemist assignment */}
      <Modal
        title={editTarget ? `Edit — ${editTarget.full_code}` : 'Edit Experiment'}
        open={!!editTarget}
        closable={false}
        onCancel={() => { setEditTarget(null); editForm.resetFields() }}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={editExpMut.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => editExpMut.mutate({ title: vals.title, chemistIds: vals.chemist_ids ?? [] })}
        >
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. ADC Conjugation Run 1" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select ADC PD Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={adcPdChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
