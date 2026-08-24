import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Grid, Input, Tooltip, Button, Modal, Form, Select, message } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'

const { useBreakpoint } = Grid
import { FlaskConical, Search, Eye, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { cgtExperimentApi, cgtNotebookApi, type CgtExperimentListItem } from '../../api/cgt'
import { userApi } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { EmptyValue, withEmptyValue } from '../../components/ui/EmptyValue'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

// Only the CGT TL gets a "New Experiment" action here — the notebook dropdown
// is scoped to notebooks the HOD has assigned to them (CgtNotebookPermission),
// a concept that doesn't apply the same way to any other role on this page.
const CAN_CREATE_HERE = ['TL']

// Mirrors the table design used in CgtHodDashboard's "Project Received" table —
// glass-card filter bar (icon + label + count badge + search) and a
// glass-card-wrapped sortable table with StatusTag status pills.
export default function CgtExperimentsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const screens = useBreakpoint()
  const user = useAppSelector(selectUser)
  const canCreate = CAN_CREATE_HERE.includes(user?.role_code ?? '') && user?.department_code === 'CGT'

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<string | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | undefined>(undefined)

  useEffect(() => { setPage(1) }, [search, sortField, sortOrder])

  const [expModal, setExpModal] = useState(false)
  const [expForm] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['cgt-experiments-all', page, pageSize, search, sortField, sortOrder],
    queryFn:  () => cgtExperimentApi.listAll({
      search: search || undefined,
      page,
      limit: pageSize,
      sortBy: sortField,
      sortDir: sortOrder === 'ascend' ? 'asc' : sortOrder === 'descend' ? 'desc' : undefined,
    }),
    placeholderData: (prev) => prev,
  })

  const experiments = data?.items ?? []
  const total = data?.total ?? 0

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<CgtExperimentListItem> | SorterResult<CgtExperimentListItem>[],
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortField(s?.field ? String(s.field) : undefined)
    setSortOrder(s?.order ?? undefined)
  }

  // Notebooks assigned to this TL (server already scopes listAll to
  // CgtNotebookPermission for a TL, regardless of the assigned_to_me param).
  const { data: myNotebooksData } = useQuery({
    queryKey: ['cgt-notebooks-assigned-to-me'],
    queryFn:  () => cgtNotebookApi.listAll({ limit: 200 }),
    enabled:  canCreate,
  })
  const myNotebooks = myNotebooksData?.items ?? []

  // Chemists for the "Assign Chemist" picker (CGT department)
  const { data: cgtChemUsers = [] } = useQuery({
    queryKey: ['users-cgt-chem'],
    queryFn:  () => userApi.list({ role_code: 'CHEM', dept_code: 'CGT' }).then(r => r.items),
    enabled:  canCreate,
    staleTime: 5 * 60 * 1000,
  })

  const openCreate = () => {
    expForm.resetFields()
    setExpModal(true)
  }

  const createExp = useMutation({
    mutationFn: async (vals: Record<string, unknown>) => {
      const { notebook_id, title, chemist_ids } = vals as { notebook_id: string; title: string; chemist_ids?: string[] }
      const exp = await cgtExperimentApi.createForNotebook(notebook_id, { title })
      const ids = chemist_ids ?? []
      await Promise.all(ids.map(uid => cgtExperimentApi.assignUser(exp.id, uid)))
      return exp
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-experiments-all'] })
      setExpModal(false)
      expForm.resetFields()
      message.success('Experiment created.')
    },
    onError: () => message.error('Failed to create experiment'),
  })

  const goToExperiment = (row: CgtExperimentListItem) =>
    navigate(`/cgt/projects/${row.cgt_project_id}/notebooks/${row.cgt_notebook_id}/experiments/${row.id}`)

  const columns: ColumnsType<CgtExperimentListItem> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'full_code', width: 150,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Experiment Title', dataIndex: 'title', key: 'title', width: 200,
      sorter: true,
      render: (v: string, row: CgtExperimentListItem) => (
        <button
          onClick={() => goToExperiment(row)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Notebook', dataIndex: 'notebook_code', key: 'notebook_code', width: 150,
      render: (v: string, row: CgtExperimentListItem) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.cgt_project_id}/notebooks/${row.cgt_notebook_id}`)}
          className="text-[13px] text-teal-600 hover:underline"
        >
          {withEmptyValue(v)}
        </button>
      ),
    },
    {
      title: 'Project', dataIndex: 'project_code', key: 'project_code', width: 130,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      sorter: true,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Created By', dataIndex: 'created_by_name', key: 'created_by_name', width: 130,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Actions', key: 'action', width: 80, align: 'center',
      render: (_: unknown, row: CgtExperimentListItem) => (
        <Tooltip title="View experiment">
          <button
            onClick={() => goToExperiment(row)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
          >
            <Eye size={14} />
          </button>
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-3">
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <FlaskConical size={15} className="text-violet-500 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-700 shrink-0">Experiments</span>
        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
          {total}
        </span>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search experiments…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        {canCreate && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={openCreate}
            className="rounded-md font-medium"
          >
            New Experiment
          </Button>
        )}
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={experiments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          onChange={handleTableChange}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} experiments`,
            size: 'small',
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          locale={{ emptyText: 'No experiments found.' }}
        />
      </div>

      {/* Create Experiment Modal */}
      <Modal
        title="Create Experiment"
        open={expModal}
        closable={false}
        onCancel={() => { setExpModal(false); expForm.resetFields() }}
        onOk={() => expForm.submit()}
        okText="Create"
        confirmLoading={createExp.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={expForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => createExp.mutate(vals)}
        >
          <Form.Item
            label="Notebook"
            name="notebook_id"
            rules={[{ required: true, message: 'Please select a notebook' }]}
          >
            <Select
              placeholder="Select one of your assigned notebooks"
              showSearch
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={myNotebooks.map(nb => ({ value: nb.id, label: `${nb.code} — ${nb.title}` }))}
              notFoundContent="No notebooks assigned to you yet"
            />
          </Form.Item>
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Seed Media Preparation" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select CGT Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) => String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
              options={cgtChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
          <p className="text-xs text-slate-400 -mt-2">
            An experiment code will be generated automatically (e.g. CGT-EXP-001-01).
          </p>
        </Form>
      </Modal>
    </div>
  )
}
