import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message, Tag, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Trash2, Hash, MoreVertical } from 'lucide-react'
import { idSequenceApi, type IdSequenceConfig, type IdSequenceConfigCreate } from '../../api/admin'
import { ApiError } from '../../api/client'
import { AdminModal } from '../../components/ui/AdminModal'

// Preview e.g. "SAMPLE/26/00001" from the current form values, so the admin
// sees exactly what a generated ID will look like before saving.
function previewId(v: Partial<IdSequenceConfig>): string {
  const parts = [v.prefix || 'PREFIX']
  if (v.include_year ?? true) parts.push('YY'.padStart(v.year_digits ?? 2, 'Y').slice(0, v.year_digits ?? 2))
  parts.push('1'.padStart(v.sequence_digits ?? 5, '0'))
  return parts.join(v.separator || '/')
}

export default function IdSequencesPage() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdSequenceConfig | null>(null)
  const [form] = Form.useForm()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['id-sequences'],
    queryFn: () => idSequenceApi.list(),
  })

  const saveMut = useMutation({
    mutationFn: (body: IdSequenceConfigCreate) =>
      editing ? idSequenceApi.update(editing.id, body) : idSequenceApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['id-sequences'] })
      message.success(editing ? 'Updated' : 'Created')
      setModalOpen(false)
    },
    onError: (e: unknown) => message.error(e instanceof ApiError ? e.detail : 'Save failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => idSequenceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['id-sequences'] })
      message.success('Deleted')
    },
  })

  const openNew = () => {
    setEditing(null)
    form.setFieldsValue({
      separator: '/', include_year: true, year_digits: 2, sequence_digits: 5, reset_yearly: true, is_active: true,
    })
    setModalOpen(true)
  }
  const openEdit = (cfg: IdSequenceConfig) => {
    setEditing(cfg)
    form.setFieldsValue(cfg)
    setModalOpen(true)
  }

  const previewValues = Form.useWatch([], form) as Partial<IdSequenceConfig> | undefined

  const columns: ColumnsType<IdSequenceConfig> = [
    { title: 'Label', dataIndex: 'label', key: 'label' },
    { title: 'Code', dataIndex: 'code', key: 'code', render: (v: string) => <code className="text-xs">{v}</code> },
    { title: 'Format', key: 'format', render: (_, r) => <code className="text-xs">{previewId(r)}</code> },
    { title: 'Resets Yearly', dataIndex: 'reset_yearly', key: 'reset_yearly', render: (v: boolean) => v ? 'Yes' : 'No' },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: '', key: 'actions', width: 90,
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'delete') {
            Modal.confirm({
              title: 'Delete this ID format?',
              okText: 'Delete',
              okButtonProps: { danger: true },
              centered: true,
              onOk: () => deleteMut.mutate(r.id),
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
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash size={18} className="text-violet-500" />
          <h1 className="text-lg font-semibold text-slate-800">ID Numbering</h1>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={openNew}>New Format</Button>
      </div>
      <p className="text-xs text-slate-400 -mt-2">
        Configure the auto-generated ID format for each identifier used in CGT/ADC experiments (e.g. Sample ID, Batch Record ID,
        each Intermediate Output ID) — prefix, whether the year is included, and how many digits the running sequence uses.
      </p>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table rowKey="id" columns={columns} dataSource={configs} loading={isLoading} pagination={false} />
      </div>

      <AdminModal
        title={editing ? 'Edit ID Format' : 'New ID Format'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        destroyOnClose
        centered
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={v => saveMut.mutate(v)}>
          <Form.Item label="Label" name="label" rules={[{ required: true }]}>
            <Input placeholder="e.g. Sample ID" />
          </Form.Item>
          <Form.Item
            label="Code" name="code" rules={[{ required: true }]}
            tooltip="Stable machine key referenced by the CGT template's Generate button — cannot be changed after creation."
          >
            <Input placeholder="e.g. SAMPLE_ID" disabled={!!editing} />
          </Form.Item>
          <Form.Item label="Prefix" name="prefix" rules={[{ required: true }]}>
            <Input placeholder="e.g. SAMPLE" />
          </Form.Item>
          <Form.Item label="Separator" name="separator">
            <Input maxLength={5} />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Include Year" name="include_year" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="Year Digits" name="year_digits">
              <InputNumber min={2} max={4} className="w-full" />
            </Form.Item>
            <Form.Item label="Sequence Digits" name="sequence_digits">
              <InputNumber min={1} max={10} className="w-full" />
            </Form.Item>
            <Form.Item label="Reset Yearly" name="reset_yearly" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item label="Active" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="text-xs text-slate-400">
            Preview: <code className="text-slate-600">{previewId(previewValues ?? {})}</code>
          </div>
        </Form>
      </AdminModal>
    </div>
  )
}
