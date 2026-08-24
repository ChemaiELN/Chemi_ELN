import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Select, Switch, Upload,
  Dropdown, message, Grid,
} from 'antd'
import type { MenuProps } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import { withEmptyValue } from '../../components/ui/EmptyValue'
import type { ColumnsType } from 'antd/es/table'
import { UserPlus, Pencil, KeyRound, UserX, UserCheck, Search, UploadCloud, MoreVertical } from 'lucide-react'
import { adminApi, type UserOut } from '../../api/admin'
import { ApiError } from '../../api/client'
import { useAppSelector } from '../../store'
import { glassModalProps } from '../../utils/modalStyles'
import { selectUser } from '../../store/authSlice'
import { useServerTable } from '../../hooks/useServerTable'

const { useBreakpoint } = Grid

export default function UsersPage() {
  const qc = useQueryClient()
  const me = useAppSelector(selectUser)
  const screens = useBreakpoint()

  const [includeDeactivated, setIncludeDeactivated] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserOut | null>(null)
  const [resetTarget, setResetTarget] = useState<UserOut | null>(null)

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [resetForm] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => adminApi.listUsers(params),
    [],
  )
  const filters = useMemo(
    () => (!includeDeactivated ? { is_active: true } : {}),
    [includeDeactivated],
  )
  const { loading: isLoading, searchInput: search, setSearchInput: setSearch, setPage, tableProps, reload } =
    useServerTable<UserOut>(fetcher, { filters })

  const inv = () => { qc.invalidateQueries({ queryKey: ['users'] }); reload() }

  const onCreate = useMutation({
    mutationFn: (v: Record<string, unknown>) => {
      const jobDescFile = (v.job_description as { file?: File }[] | undefined)?.[0]?.file
      return adminApi.createUser({ ...v, job_description: jobDescFile } as Parameters<typeof adminApi.createUser>[0])
    },
    onSuccess: () => { inv(); setCreateOpen(false); createForm.resetFields(); msg.success('User created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to create user.'),
  })
  const onEdit = useMutation({
    mutationFn: ({ id, v }: { id: string; v: Record<string, unknown> }) =>
      adminApi.updateUser(id, v as Parameters<typeof adminApi.updateUser>[1]),
    onSuccess: () => { inv(); setEditTarget(null); msg.success('User updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update user.'),
  })
  const onToggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateUser(id, { is_active }),
    onSuccess: (_d, { is_active }) => { inv(); msg.success(is_active ? 'User activated.' : 'User deactivated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update user status.'),
  })
  const onReset = useMutation({
    mutationFn: ({ id, pw }: { id: string; pw: string }) => adminApi.resetPassword(id, pw),
    onSuccess: () => { setResetTarget(null); resetForm.resetFields(); msg.success('Password reset.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openEdit = (u: UserOut) => {
    setEditTarget(u)
    editForm.setFieldsValue(u)
  }

  const columns: ColumnsType<UserOut> = [
    {
      title: 'Username',
      dataIndex: 'username',
      ellipsis: true,
      sorter: true,
      render: (v, r) => (
        <span className="text-[13px] text-slate-800 truncate flex items-center gap-1.5 min-w-0">
          <span className="truncate">{v}</span>
          {r.must_reset_password && (
            <StatusTag color="warning" className="text-[11px] px-1 py-0 leading-tight m-0 shrink-0">pwd reset</StatusTag>
          )}
        </span>
      ),
    },
    {
      title: 'Display Name',
      dataIndex: 'display_name',
      ellipsis: true,
      sorter: true,
      render: (v) => withEmptyValue(v && <span className="text-[13px] text-slate-800 truncate">{v}</span>),
    },
    {
      title: 'First Name',
      dataIndex: 'first_name',
      ellipsis: true,
      responsive: ['md'],
      sorter: true,
      render: (v) => withEmptyValue(v && <span className="text-[13px] text-slate-800 truncate">{v}</span>),
    },
    {
      title: 'Last Name',
      dataIndex: 'last_name',
      ellipsis: true,
      responsive: ['md'],
      sorter: true,
      render: (v) => withEmptyValue(v && <span className="text-[13px] text-slate-800 truncate">{v}</span>),
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      ellipsis: true,
      responsive: ['lg'],
      sorter: true,
      render: (v) => withEmptyValue(v && <span className="text-[13px] text-slate-800 truncate">{v}</span>),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      ellipsis: true,
      sorter: true,
      render: (v) => withEmptyValue(v && <span className="text-[13px] text-slate-800 truncate">{v}</span>),
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
      align: 'center',
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'reset', label: <span className="text-[12px]">Reset Password</span>, icon: <KeyRound size={12} /> },
          ...(r.id !== me?.id && r.role_code !== 'SUPER_ADMIN'
            ? [{
                key: 'toggle',
                label: <span className="text-[12px]">{r.is_active ? 'Deactivate' : 'Activate'}</span>,
                icon: r.is_active ? <UserX size={12} /> : <UserCheck size={12} />,
                danger: r.is_active,
              }]
            : []),
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'reset') { setResetTarget(r); resetForm.resetFields() }
          else if (key === 'toggle') onToggle.mutate({ id: r.id, is_active: !r.is_active })
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
      {ctx}

      {/* Search + toggle + New button */}
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="rounded-md"
          style={{ width: 240 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<UserPlus size={14} />}
          onClick={() => { setCreateOpen(true); createForm.resetFields() }}
          className="rounded-md font-medium"
        >
          {screens.sm ? 'New User' : 'New'}
        </Button>
        <div className="flex items-center gap-2">
          <Switch
            size="small"
            checked={includeDeactivated}
            onChange={(checked) => { setIncludeDeactivated(checked); setPage(1) }}
          />
          <span className="text-[13px] text-slate-600">Show Deactivated Users also</span>
        </div>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          {...tableProps}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
        />
      </div>

      {/* Create */}
      <Modal
        open={createOpen}
        closable={false}
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
            <Form.Item
              name="username"
              label="Username (Laurus ID)"
              rules={[
                { required: true, message: 'Username is required.' },
                {
                  pattern: /^[A-Za-z0-9._-]+$/,
                  message: 'Only letters, numbers, dot, hyphen and underscore are allowed — no spaces.',
                },
              ]}
              extra="This doubles as the employee ID — no spaces."
            >
              <Input placeholder="jane.doe" />
            </Form.Item>
            <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required.' }]}>
              <Select
                placeholder="Select title"
                options={['Mr', 'Ms', 'Mrs', 'Dr', 'Prof'].map((t) => ({ value: t, label: t }))}
              />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="first_name" label="First Name" rules={[{ required: true, message: 'First name is required.' }]}>
              <Input placeholder="Jane" />
            </Form.Item>
            <Form.Item name="middle_initials" label="Middle Initials">
              <Input placeholder="Optional" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="last_name" label="Last Name" rules={[{ required: true, message: 'Last name is required.' }]}>
              <Input placeholder="Doe" />
            </Form.Item>
            <Form.Item name="display_name" label="Display Name" rules={[{ required: true, message: 'Display name is required.' }]}>
              <Input placeholder="Jane Doe" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="designation" label="Designation" rules={[{ required: true, message: 'Designation is required.' }]}>
              <Input placeholder="e.g. Research Associate" />
            </Form.Item>
            <Form.Item name="email" label="Email (optional)" rules={[{ type: 'email', message: 'Enter a valid email.' }]}>
              <Input placeholder="jane@laurus.com" />
            </Form.Item>
          </div>
          <Form.Item name="contact_no" label="Contact No. (optional)">
            <Input placeholder="e.g. +91 90000 00000" />
          </Form.Item>
          <Form.Item
            name="job_description"
            label="Job Description (optional)"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload beforeUpload={() => false} maxCount={1}>
              <Button icon={<UploadCloud size={14} />}>Upload Job Description</Button>
            </Upload>
          </Form.Item>
          <p className="text-xs text-slate-400 -mt-1 mb-1">
            Role, department and lab are assigned after the account is created, from Edit. Default password:{' '}
            <span className="text-slate-500">Password@123</span>
          </p>
        </Form>
      </Modal>

      {/* Edit */}
      <Modal
        open={editTarget !== null}
        closable={false}
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
            <Form.Item
              name="username"
              label="Username"
              rules={[
                { required: true, message: 'Username is required.' },
                { pattern: /^[A-Za-z0-9._-]+$/, message: 'Only letters, numbers, dot, hyphen and underscore are allowed — no spaces.' },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required.' }]}>
              <Select options={['Mr', 'Ms', 'Mrs', 'Dr', 'Prof'].map((t) => ({ value: t, label: t }))} />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="first_name" label="First Name" rules={[{ required: true, message: 'First name is required.' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="middle_initials" label="Middle Initials">
              <Input placeholder="Optional" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="last_name" label="Last Name" rules={[{ required: true, message: 'Last name is required.' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="display_name" label="Display Name" rules={[{ required: true, message: 'Display name is required.' }]}>
              <Input />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="designation" label="Designation" rules={[{ required: true, message: 'Designation is required.' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email (optional)" rules={[{ type: 'email', message: 'Enter a valid email.' }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="contact_no" label="Contact No. (optional)">
            <Input />
          </Form.Item>
          <Form.Item name="must_reset_password" label="Require password reset on next login" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password */}
      <Modal
        open={resetTarget !== null}
        closable={false}
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
          <Form.Item
            name="new_password"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter a password.' },
              { min: 8, message: 'At least 8 characters.' },
              {
                pattern: /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
                message: 'Include an uppercase letter, a number, and a special character.',
              },
            ]}
            extra="At least 8 characters, with one uppercase letter, one number, and one special character."
          >
            <Input.Password placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special" />
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
