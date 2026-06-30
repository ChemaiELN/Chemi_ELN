import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Select, Switch,
  Space, Tooltip, message, Grid,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { UserPlus, Pencil, KeyRound, UserX, UserCheck, Search } from 'lucide-react'
import { adminApi, type UserOut } from '../../api/admin'
import { ApiError } from '../../api/client'
import { useAppSelector } from '../../store'
import { glassModalProps } from '../../utils/modalStyles'
import { selectUser } from '../../store/authSlice'

const { useBreakpoint } = Grid

function UA({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shrink-0">
      <span className="text-white text-xs font-bold">{name.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}

export default function UsersPage() {
  const qc = useQueryClient()
  const me = useAppSelector(selectUser)
  const screens = useBreakpoint()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string | undefined>()
  const [filterDept, setFilterDept] = useState<string | undefined>()
  const [filterActive, setFilterActive] = useState<string | undefined>()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserOut | null>(null)
  const [resetTarget, setResetTarget] = useState<UserOut | null>(null)

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [resetForm] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => adminApi.listRoles() })
  const { data: allRoles = [] } = useQuery({ queryKey: ['roles', true], queryFn: () => adminApi.listRoles(true) })
  const { data: depts = [] } = useQuery({ queryKey: ['departments'], queryFn: () => adminApi.listDepts() })
  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, filterRole, filterDept, filterActive],
    queryFn: () => adminApi.listUsers({
      page, page_size: 20,
      ...(search && { search }),
      ...(filterRole && { role_id: filterRole }),
      ...(filterDept && { dept_id: filterDept }),
      ...(filterActive !== undefined && { is_active: filterActive }),
    }),
    placeholderData: (prev) => prev,
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['users'] })

  const onCreate = useMutation({
    mutationFn: (v: Record<string, unknown>) =>
      adminApi.createUser({ ...v, department_id: v.department_id || null } as Parameters<typeof adminApi.createUser>[0]),
    onSuccess: () => { inv(); setCreateOpen(false); createForm.resetFields(); msg.success('User created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to create user.'),
  })
  const onEdit = useMutation({
    mutationFn: ({ id, v }: { id: string; v: Record<string, unknown> }) =>
      adminApi.updateUser(id, { ...v, department_id: (v.department_id as string) || null } as Parameters<typeof adminApi.updateUser>[1]),
    onSuccess: () => { inv(); setEditTarget(null); msg.success('User updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update user.'),
  })
  const onToggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateUser(id, { is_active }),
    onSuccess: () => inv(),
  })
  const onReset = useMutation({
    mutationFn: ({ id, pw }: { id: string; pw: string }) => adminApi.resetPassword(id, pw),
    onSuccess: () => { setResetTarget(null); resetForm.resetFields(); msg.success('Password reset.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openEdit = (u: UserOut) => {
    setEditTarget(u)
    editForm.setFieldsValue({ ...u, department_id: u.department_id ?? undefined })
  }

  const columns: ColumnsType<UserOut> = [
    {
      title: 'Emp #',
      dataIndex: 'emp_no',
      width: 110,
      render: (v) => <span className="font-mono text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'User',
      key: 'user',
      render: (_, r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <UA name={r.username} />
          <div className="min-w-0">
            <p className="text-[13px] text-slate-800 truncate flex items-center gap-1.5">
              {r.username}
              {r.must_reset_password && (
                <StatusTag color="warning" className="text-[11px] px-1 py-0 leading-tight m-0">pwd reset</StatusTag>
              )}
            </p>
            <p className="text-[13px] text-slate-400 truncate">{r.email}</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, r) => <span className="text-[13px] text-slate-700">{r.role_name ?? r.role_code}</span>,
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      responsive: ['md'],
      render: (v) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      responsive: ['sm'],
      render: (v) => <StatusTag color={v ? 'success' : 'default'} className="text-[13px]">{v ? 'Active' : 'Inactive'}</StatusTag>,
    },
    {
      title: '',
      key: 'actions',
      width: screens.md ? 110 : 80,
      align: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Reset Password">
            <Button type="text" size="small" icon={<KeyRound size={13} />} onClick={() => { setResetTarget(r); resetForm.resetFields() }} />
          </Tooltip>
          {r.id !== me?.id && (
            <Tooltip title={r.is_active ? 'Deactivate' : 'Activate'}>
              <Button
                type="text"
                size="small"
                danger={r.is_active}
                icon={r.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                onClick={() => onToggle.mutate({ id: r.id, is_active: !r.is_active })}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      {ctx}

      {/* Filters + New button */}
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search users…"
          className="rounded-md"
          style={{ width: 180 }}
          allowClear
        />
        <Select
          value={filterRole}
          onChange={(v) => { setFilterRole(v); setPage(1) }}
          placeholder="All Roles"
          allowClear
          style={{ minWidth: 140 }}
          options={roles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
        />
        <Select
          value={filterDept}
          onChange={(v) => { setFilterDept(v); setPage(1) }}
          placeholder="All Depts"
          allowClear
          style={{ minWidth: 140 }}
          options={depts.map((d) => ({ value: d.id, label: d.name }))}
        />
        <Select
          value={filterActive}
          onChange={(v) => { setFilterActive(v); setPage(1) }}
          placeholder="All Status"
          allowClear
          style={{ minWidth: 120 }}
          options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
        />
        <Button
          type="primary"
          icon={<UserPlus size={14} />}
          onClick={() => { setCreateOpen(true); createForm.resetFields() }}
          className="rounded-md font-medium"
        >
          {screens.sm ? 'New User' : 'New'}
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            total: data?.total,
            pageSize: 20,
            onChange: (p) => setPage(p),
            showTotal: (t) => `${t} users`,
            showSizeChanger: false,
            size: 'small',
          }}
        />
      </div>

      {/* Create */}
      <Modal
        open={createOpen}
        title="New User"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Create User"
        confirmLoading={onCreate.isPending}
        width={screens.md ? 560 : '95vw'}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => onCreate.mutate(v)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
              <Input placeholder="jane.doe" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="jane@laurus.com" />
            </Form.Item>
          </div>
          <p className="text-xs text-slate-400 -mt-2 mb-3">Employee # is auto-assigned. Default password: <span className="font-mono text-slate-500">password@123</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="role_id" label="Role" rules={[{ required: true }]}>
              <Select placeholder="Select role" options={allRoles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))} />
            </Form.Item>
            <Form.Item name="department_id" label="Department">
              <Select
                placeholder="None"
                allowClear
                options={depts.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          </div>
          <Form.Item name="site" label="Site (optional)">
            <Input placeholder="e.g. HYD-1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit */}
      <Modal
        open={editTarget !== null}
        title={`Edit — ${editTarget?.username}`}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={onEdit.isPending}
        width={screens.md ? 560 : '95vw'}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => editTarget && onEdit.mutate({ id: editTarget.id, v })}
         
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="emp_no" label="Employee #" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="role_id" label="Role" rules={[{ required: true }]}>
              <Select options={allRoles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))} />
            </Form.Item>
            <Form.Item name="department_id" label="Department">
              <Select
                placeholder="None"
                allowClear
                options={depts.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          </div>
          <Form.Item name="site" label="Site">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="must_reset_password" label="Require password reset on next login" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password */}
      <Modal
        open={resetTarget !== null}
        title={`Reset Password — ${resetTarget?.username}`}
        onCancel={() => setResetTarget(null)}
        onOk={() => resetForm.submit()}
        okText="Reset"
        okButtonProps={{ danger: true }}
        confirmLoading={onReset.isPending}
        width={screens.md ? 400 : '95vw'}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={resetForm}
          layout="vertical"
          onFinish={(v) => resetTarget && onReset.mutate({ id: resetTarget.id, pw: v.new_password })}
         
        >
          <Form.Item name="new_password" label="New Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="Min 6 characters" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm Password"
            dependencies={['new_password']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, v) {
                  if (!v || getFieldValue('new_password') === v) return Promise.resolve()
                  return Promise.reject(new Error('Passwords do not match.'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Repeat password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
