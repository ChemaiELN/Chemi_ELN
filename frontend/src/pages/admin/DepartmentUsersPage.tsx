import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Select, Checkbox,
  Tooltip, message, Dropdown,
} from 'antd'
import type { MenuProps } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import { withEmptyValue } from '../../components/ui/EmptyValue'
import type { ColumnsType } from 'antd/es/table'
import { UserPlus, Pencil, Trash2, Search, MoreVertical } from 'lucide-react'
import { adminApi, type UserOut } from '../../api/admin'
import { ApiError } from '../../api/client'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { useServerTable } from '../../hooks/useServerTable'

export default function DepartmentUsersPage() {
  const qc = useQueryClient()
  const [deptId, setDeptId] = useState<string | undefined>()
  const [roleId, setRoleId] = useState<string | undefined>()
  const [addOpen, setAddOpen] = useState(false)
  const [addUserSearch, setAddUserSearch] = useState('')
  const [editTarget, setEditTarget] = useState<UserOut | null>(null)
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const { data: depts = [] } = useQuery({ queryKey: ['departments'], queryFn: () => adminApi.listDepts() })
  const { data: allRoles = [] } = useQuery({ queryKey: ['roles', true], queryFn: () => adminApi.listRoles(true) })
  const { data: deptRoleMap = [] } = useQuery({ queryKey: ['dept-role-mapping'], queryFn: () => adminApi.listDeptRoleMapping() })
  const { data: deptLabs = [] } = useQuery({
    queryKey: ['labs-lookup', deptId],
    queryFn: () => adminApi.listLabsLookup(deptId),
    enabled: addOpen && !!deptId,
  })

  const rolesByDept = new Map<string, Set<string>>()
  for (const row of deptRoleMap) rolesByDept.set(row.department_id, new Set(row.role_ids))
  const superAdminRole = allRoles.find((r) => r.code === 'SUPER_ADMIN')
  const rolesForDept = (id: string | undefined) => {
    const base = id && rolesByDept.has(id) ? allRoles.filter((r) => rolesByDept.get(id)!.has(r.id)) : allRoles
    if (superAdminRole && !base.find((r) => r.id === superAdminRole.id)) return [...base, superAdminRole]
    return base
  }

  const editDeptIdWatch = Form.useWatch('department_id', editForm)
  const { data: editLabs = [] } = useQuery({
    queryKey: ['labs-lookup', editDeptIdWatch],
    queryFn: () => adminApi.listLabsLookup(editDeptIdWatch),
    enabled: editTarget !== null && !!editDeptIdWatch,
  })

  const fetcher = useCallback(
    (params: Record<string, unknown>) => adminApi.listUsers(params),
    [],
  )
  const filters = useMemo(
    () => ({ is_active: true, ...(deptId && { dept_id: deptId }), ...(roleId && { role_id: roleId }) }),
    [deptId, roleId],
  )
  const { loading: isLoading, searchInput: search, setSearchInput: setSearch, tableProps, reload } =
    useServerTable<UserOut>(fetcher, { filters })

  // Everyone not already assigned to this department — candidates for the Add modal.
  const { data: allUsersData } = useQuery({
    queryKey: ['users', 'all-for-assign'],
    queryFn: () => adminApi.listUsers({ page: 1, pageSize: 500, is_active: true }),
    enabled: addOpen,
  })
  const assignableUsers = (allUsersData?.items ?? []).filter((u) => u.department_id !== deptId)
  const filteredAssignable = assignableUsers.filter((u) => {
    const term = addUserSearch.trim().toLowerCase()
    if (!term) return true
    return [u.username, u.display_name, u.email].some((v) => v != null && String(v).toLowerCase().includes(term))
  })

  const inv = () => { qc.invalidateQueries({ queryKey: ['users'] }); reload() }

  const onAdd = useMutation({
    mutationFn: async (v: { role_id: string; lab_ids?: string[]; user_ids: string[] }) => {
      await Promise.all(v.user_ids.map((id) => adminApi.updateUser(id, {
        department_id: deptId,
        role_id: v.role_id,
        lab_ids: v.lab_ids,
      })))
    },
    onSuccess: () => { inv(); setAddOpen(false); addForm.resetFields(); setAddUserSearch(''); msg.success('User(s) added to department.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to add users.'),
  })

  const onEdit = useMutation({
    mutationFn: ({ id, v }: { id: string; v: { role_id?: string; department_id?: string | null; lab_ids?: string[] } }) =>
      adminApi.updateUser(id, v),
    onSuccess: () => { inv(); setEditTarget(null); msg.success('Updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update.'),
  })

  const onRemove = useMutation({
    mutationFn: (id: string) => adminApi.updateUser(id, { department_id: null }),
    onSuccess: () => { inv(); msg.success('Removed from department.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to remove.'),
  })

  const openEdit = (u: UserOut) => {
    setEditTarget(u)
    editForm.setFieldsValue({ role_id: u.role_id ?? undefined, department_id: u.department_id ?? undefined, lab_ids: u.lab_ids ?? [] })
  }

  const columns: ColumnsType<UserOut> = [
    {
      title: 'Username',
      dataIndex: 'username',
      ellipsis: true,
      sorter: true,
      render: (v) => <span className="text-[13px] text-slate-800 truncate">{v}</span>,
    },
    {
      title: 'Display Name',
      dataIndex: 'display_name',
      ellipsis: true,
      sorter: true,
      render: (v) => withEmptyValue(v && <span className="text-[13px] text-slate-800 truncate">{v}</span>),
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      ellipsis: true,
      render: (v) => withEmptyValue(v && <span className="text-[13px] text-slate-800 truncate">{v}</span>),
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, r) => <span className="text-[13px] text-slate-800">{withEmptyValue(r.role_name ?? r.role_code)}</span>,
    },
    {
      title: 'Lab',
      key: 'labs',
      ellipsis: true,
      render: (_, r) => {
        const names = (r.labs ?? []).map((l) => l.name).join(', ')
        return withEmptyValue(names && <span className="text-[13px] text-slate-800 truncate">{names}</span>)
      },
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      ellipsis: true,
      responsive: ['md'],
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
      width: 90,
      align: 'center',
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'remove', label: <span className="text-[12px]">Remove from department</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'remove') {
            Modal.confirm({
              title: `Remove ${r.display_name ?? r.username} from this department?`,
              content: 'The user will no longer be listed under this department. Their account stays active.',
              okText: 'Remove',
              okButtonProps: { danger: true },
              centered: true,
              styles: glassModalStyles,
              onOk: () => onRemove.mutate(r.id),
            })
          }
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

      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Select
          value={deptId}
          onChange={(v) => setDeptId(v)}
          placeholder="Select Department"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 220 }}
          options={depts.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))}
        />
        <Select
          value={roleId}
          onChange={(v) => setRoleId(v)}
          placeholder="All Roles"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 200 }}
          options={rolesForDept(deptId).map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
        />
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="rounded-md"
          style={{ width: 220 }}
          allowClear
        />
        <Tooltip title={deptId ? undefined : 'Select a department first'}>
          <Button
            type="primary"
            icon={<UserPlus size={14} />}
            disabled={!deptId}
            onClick={() => { setAddOpen(true); addForm.resetFields() }}
            className="rounded-md font-medium"
          >
            Add
          </Button>
        </Tooltip>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          {...tableProps}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      </div>

      {/* Add */}
      <Modal
        open={addOpen}
        closable={false}
        title="Add User to Department"
        onCancel={() => { setAddOpen(false); setAddUserSearch('') }}
        onOk={() => addForm.submit()}
        okText="Save"
        confirmLoading={onAdd.isPending}
        width={520}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={addForm} layout="vertical" onFinish={(v) => onAdd.mutate(v)}>
          <Form.Item label="Department Name">
            <Input value={depts.find((d) => d.id === deptId)?.name ?? ''} disabled />
          </Form.Item>
          <Form.Item name="role_id" label="Role Name" rules={[{ required: true, message: 'Role is required.' }]}>
            <Select
              placeholder="Select role"
              options={rolesForDept(deptId).map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="lab_ids" label="Lab (optional)">
            <Select
              mode="multiple"
              placeholder="Select lab(s)"
              allowClear
              showSearch
              optionFilterProp="label"
              options={deptLabs.map((l) => ({ value: l.id, label: l.name }))}
            />
          </Form.Item>
          <Form.Item name="user_ids" label="User" rules={[{ required: true, message: 'Select at least one user.' }]}>
            <Checkbox.Group style={{ width: '100%' }}>
              <div className="border border-slate-200 rounded-md p-2">
                <Input
                  prefix={<Search size={13} className="text-slate-400" />}
                  value={addUserSearch}
                  onChange={(e) => setAddUserSearch(e.target.value)}
                  placeholder="Search users…"
                  size="small"
                  className="mb-2"
                  allowClear
                />
                <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-x-2 gap-y-1">
                  {filteredAssignable.map((u) => (
                    <Checkbox key={u.id} value={u.id} className="text-[13px]">
                      {u.display_name || u.username}
                    </Checkbox>
                  ))}
                  {filteredAssignable.length === 0 && (
                    <span className="text-[13px] text-slate-400 col-span-2 py-2 text-center">No users found.</span>
                  )}
                </div>
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit */}
      <Modal
        open={editTarget !== null}
        closable={false}
        title={`Edit — ${editTarget?.display_name || editTarget?.username}`}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={onEdit.isPending}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => editTarget && onEdit.mutate({ id: editTarget.id, v })}
        >
          <Form.Item name="department_id" label="Department" rules={[{ required: true, message: 'Department is required.' }]}>
            <Select
              placeholder="Select department"
              options={depts.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))}
              showSearch
              optionFilterProp="label"
              onChange={() => editForm.setFieldValue('role_id', undefined)}
            />
          </Form.Item>
          <Form.Item name="role_id" label="Role Name" rules={[{ required: true, message: 'Role is required.' }]}>
            <Select
              options={rolesForDept(editDeptIdWatch).map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="lab_ids" label="Lab (optional)">
            <Select
              mode="multiple"
              placeholder="Select lab(s)"
              allowClear
              showSearch
              optionFilterProp="label"
              options={editLabs.map((l) => ({ value: l.id, label: l.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
