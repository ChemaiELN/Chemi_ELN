import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Form, Input, Select, Dropdown, message, Switch, Tooltip, Modal } from 'antd'
import { AdminModal } from '../../components/ui/AdminModal'
import type { MenuProps } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import { withEmptyValue } from '../../components/ui/EmptyValue'
import type { ColumnsType } from 'antd/es/table'
import { Pencil, Trash2, ShieldCheck, Search, MoreVertical } from 'lucide-react'
import { adminApi, type Role } from '../../api/admin'
import { ApiError } from '../../api/client'
import { glassModalStyles } from '../../utils/modalStyles'
import { useServerTable } from '../../hooks/useServerTable'

export default function RolesPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Role | null>(null)
  const [filterActive, setFilterActive] = useState<string | undefined>()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  // Department scoping is locked (backend-enforced) while active users hold
  // the role — SUPER_ADMIN is separately always locked regardless of users.
  const deptScopeLocked = editTarget?.code === 'SUPER_ADMIN' || (editTarget?.user_count ?? 0) > 0

  const { data: depts = [] } = useQuery({ queryKey: ['departments'], queryFn: () => adminApi.listDepts() })
  const { data: deptRoleMap = [] } = useQuery({ queryKey: ['dept-role-mapping'], queryFn: () => adminApi.listDeptRoleMapping() })

  const deptNamesByRole = new Map<string, string[]>()
  const deptIdsByRole = new Map<string, string[]>()
  for (const row of deptRoleMap) {
    const deptName = depts.find((d) => d.id === row.department_id)?.name
    for (const roleId of row.role_ids) {
      deptIdsByRole.set(roleId, [...(deptIdsByRole.get(roleId) ?? []), row.department_id])
      if (deptName) deptNamesByRole.set(roleId, [...(deptNamesByRole.get(roleId) ?? []), deptName])
    }
  }

  const fetcher = useCallback(
    (params: Record<string, unknown>) => adminApi.listRolesPaged({ include_inactive: true, ...params }),
    [],
  )
  const filters = useMemo(
    () => (filterActive !== undefined ? { is_active: filterActive } : {}),
    [filterActive],
  )
  const { loading: isLoading, searchInput: search, setSearchInput: setSearch, tableProps, reload } =
    useServerTable<Role>(fetcher, { filters })

  const inv = () => { qc.invalidateQueries({ queryKey: ['roles'] }); reload() }

  const onCreate = useMutation({
    mutationFn: adminApi.createRole,
    onSuccess: () => { inv(); setCreateOpen(false); createForm.resetFields(); msg.success('Role created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const onEdit = useMutation({
    mutationFn: ({ id, v }: { id: string; v: { name?: string; description?: string; department_ids?: string[] } }) =>
      adminApi.updateRole(id, v),
    onSuccess: () => { inv(); setEditTarget(null); msg.success('Role updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const onToggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminApi.updateRole(id, { is_active }),
    onSuccess: () => inv(),
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Cannot change status.'),
  })

  const onDelete = useMutation({
    mutationFn: adminApi.deleteRole,
    onSuccess: () => { inv(); msg.success('Role deactivated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openEdit = (r: Role) => {
    setEditTarget(r)
    editForm.setFieldsValue({ name: r.name, description: r.description, department_ids: deptIdsByRole.get(r.id) ?? [] })
  }

  const confirmDelete = (r: Role) => {
    Modal.confirm({
      title: `Deactivate "${r.name}"?`,
      content: r.user_count > 0
        ? `This role has ${r.user_count} active user(s). Reassign them first.`
        : 'This will deactivate the role.',
      okText: 'Deactivate',
      okButtonProps: { danger: true },
      centered: true,
      styles: glassModalStyles,
      onOk: () => onDelete.mutate(r.id),
    })
  }

  const columns: ColumnsType<Role> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: '20%',
      sorter: true,
      render: (v) => (
        <span className="text-[13px] text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      width: '20%',
      sorter: true,
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Department',
      key: 'department',
      width: '20%',
      render: (_, r) => {
        const names = deptNamesByRole.get(r.id)
        return withEmptyValue(names?.length ? <span className="text-[13px] text-slate-800">{names.join(', ')}</span> : null)
      },
    },
    {
      title: 'Users',
      dataIndex: 'user_count',
      width: '20%',
      align: 'center',
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: '20%',
      align: 'center',
      render: (v, record) => (
        <Tooltip title={v && record.user_count > 0 ? `Cannot deactivate — ${record.user_count} active user(s) hold this role.` : undefined}>
          <Switch
            size="small"
            checked={v}
            disabled={record.code === 'SUPER_ADMIN' || (v && record.user_count > 0)}
            onChange={(checked) => onToggle.mutate({ id: record.id, is_active: checked })}
          />
        </Tooltip>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: '20%',
      align: 'center',
      render: (_, record) => {
        const canDeactivate = record.is_active && record.code !== 'SUPER_ADMIN' && record.user_count === 0
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          {
            key: 'deactivate',
            label: <span className="text-[12px]">Deactivate</span>,
            icon: <Trash2 size={12} />,
            danger: true,
            disabled: !canDeactivate,
          },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(record)
          else if (key === 'deactivate') confirmDelete(record)
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
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles…"
          className="rounded-md"
          style={{ width: 200 }}
          allowClear
        />
        <Select
          value={filterActive}
          onChange={(v) => setFilterActive(v)}
          placeholder="All Status"
          allowClear
          style={{ minWidth: 130 }}
          options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
        />
        <Button
          type="primary"
          icon={<ShieldCheck size={14} />}
          onClick={() => { setCreateOpen(true); createForm.resetFields() }}
          className="rounded-md font-medium"
        >
          New Role
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          {...tableProps}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 700 }}
        />
      </div>

      {/* Create */}
      <AdminModal
        open={createOpen}
        closable={false}
        title="New Role"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Create"
        confirmLoading={onCreate.isPending}
        width={440}
        centered
        destroyOnHidden
        >
        <Form form={createForm} layout="vertical" onFinish={(v) => onCreate.mutate(v)}>
          <Form.Item name="code" label="Code" rules={[{ required: true, max: 20 }]}>
            <Input placeholder="e.g. ANALYST" className="uppercase  " />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Analyst" />
          </Form.Item>
          <Form.Item name="department_ids" label="Department" rules={[{ required: true, message: 'At least one department is required.' }]}>
            <Select
              mode="multiple"
              placeholder="Select department(s)"
              options={depts.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </AdminModal>

      {/* Edit */}
      <AdminModal
        open={editTarget !== null}
        closable={false}
        title={`Edit — ${editTarget?.name}`}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={onEdit.isPending}
        width={440}
        centered
        destroyOnHidden
        >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => {
            if (!editTarget) return
            // Department scoping is locked while the role has active users —
            // the field stays visible (read-only) but must not be resubmitted,
            // otherwise the backend's active-user guard would reject even a
            // no-op name/description-only save.
            const payload = deptScopeLocked ? { name: v.name, description: v.description } : v
            onEdit.mutate({ id: editTarget.id, v: payload })
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="department_ids"
            label="Department"
            rules={deptScopeLocked ? [] : [{ required: true, message: 'At least one department is required.' }]}
            extra={editTarget && editTarget.user_count > 0 && editTarget.code !== 'SUPER_ADMIN'
              ? `Locked — ${editTarget.user_count} active user(s) hold this role. Reassign them first to change department scoping.`
              : undefined}
          >
            <Select
              mode="multiple"
              placeholder={editTarget?.code === 'SUPER_ADMIN' ? 'N/A for Super Admin' : 'Select department(s)'}
              options={depts.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))}
              showSearch
              optionFilterProp="label"
              disabled={deptScopeLocked}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </AdminModal>
    </div>
  )
}
