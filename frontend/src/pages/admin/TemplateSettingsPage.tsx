import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, Checkbox, Button, message, Table, Input, Modal, Form, Space, Tooltip, Switch } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LayoutTemplate, Plus, Pencil, Trash2 } from 'lucide-react'
import { templateSettingsApi, type CgtProcess, type TemplateWithEnabled } from '../../api/templateSettings'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

// ── ADC tab ─────────────────────────────────────────────────────────────────
function AdcTemplateSettings() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['template-settings-adc'],
    queryFn:  templateSettingsApi.listAdcTemplates,
  })

  const enabled = selected ?? new Set(templates.filter(t => t.enabled).map(t => t.id))

  const save = useMutation({
    mutationFn: () => templateSettingsApi.saveAdcTemplates([...enabled]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-settings-adc'] })
      qc.invalidateQueries({ queryKey: ['template-settings-adc-enabled'] })
      message.success('ADC template settings saved.')
    },
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to save.'),
  })

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(enabled)
    if (checked) next.add(id); else next.delete(id)
    setSelected(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-500">
        Choose which workflow templates appear in the ADC "Create Notebook" template dropdown.
      </p>
      <div className="glass-card rounded-lg divide-y divide-slate-100">
        {isLoading && <div className="p-4 text-[13px] text-slate-400">Loading…</div>}
        {!isLoading && templates.length === 0 && (
          <div className="p-4 text-[13px] text-slate-400">No workflow templates found for ADC.</div>
        )}
        {templates.map((t: TemplateWithEnabled) => (
          <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
            <Checkbox checked={enabled.has(t.id)} onChange={(e) => toggle(t.id, e.target.checked)} />
            <span className="text-[13px] text-slate-700">{t.name}</span>
            <span className="text-[11px] text-slate-400">v{t.version}</span>
            {t.category && <span className="text-[11px] text-slate-400 ml-auto">{t.category}</span>}
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="primary" loading={save.isPending} onClick={() => save.mutate()} className="rounded-md font-medium">
          Save
        </Button>
      </div>
    </div>
  )
}

// ── CGT tab ─────────────────────────────────────────────────────────────────
function CgtTemplateSettings() {
  const qc = useQueryClient()
  const [processModal, setProcessModal] = useState(false)
  const [editTarget, setEditTarget] = useState<CgtProcess | null>(null)
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const { data: processes = [], isLoading: processesLoading } = useQuery({
    queryKey: ['template-settings-cgt-processes'],
    queryFn:  () => templateSettingsApi.listCgtProcesses(),
  })

  const activeProcess = processes.find(p => p.id === activeProcessId) ?? null

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['template-settings-cgt-process-templates', activeProcessId],
    queryFn:  () => templateSettingsApi.listCgtProcessTemplates(activeProcessId as string),
    enabled:  !!activeProcessId,
  })

  const enabled = selected ?? new Set(templates.filter(t => t.enabled).map(t => t.id))

  const invalidateProcesses = () => qc.invalidateQueries({ queryKey: ['template-settings-cgt-processes'] })

  const createProcess = useMutation({
    mutationFn: (name: string) => templateSettingsApi.createCgtProcess(name),
    onSuccess: () => { invalidateProcesses(); setProcessModal(false); form.resetFields(); message.success('Process created.') },
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to create process.'),
  })
  const updateProcess = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; is_active?: boolean } }) => templateSettingsApi.updateCgtProcess(id, body),
    onSuccess: () => { invalidateProcesses(); setProcessModal(false); setEditTarget(null); form.resetFields(); message.success('Process updated.') },
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to update process.'),
  })
  const deleteProcess = useMutation({
    mutationFn: (id: string) => templateSettingsApi.deleteCgtProcess(id),
    onSuccess: () => { invalidateProcesses(); if (activeProcessId === editTarget?.id) setActiveProcessId(null); message.success('Process removed.') },
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to remove process.'),
  })
  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => templateSettingsApi.updateCgtProcess(id, { is_active }),
    onSuccess: () => invalidateProcesses(),
  })

  const saveTemplates = useMutation({
    mutationFn: () => templateSettingsApi.saveCgtProcessTemplates(activeProcessId as string, [...enabled]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-settings-cgt-process-templates', activeProcessId] })
      message.success('Process template settings saved.')
    },
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to save.'),
  })

  const toggleTemplate = (id: string, checked: boolean) => {
    const next = new Set(enabled)
    if (checked) next.add(id); else next.delete(id)
    setSelected(next)
  }

  const openCreate = () => { setEditTarget(null); form.resetFields(); setProcessModal(true) }
  const openEdit = (p: CgtProcess) => { setEditTarget(p); form.setFieldsValue({ name: p.name }); setProcessModal(true) }

  const columns: ColumnsType<CgtProcess> = [
    { title: 'Process', dataIndex: 'name', key: 'name', render: (v: string) => <span className="text-[13px] text-slate-700">{v}</span> },
    {
      title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (v: boolean, row) => <Switch size="small" checked={v} onChange={(checked) => toggleActive.mutate({ id: row.id, is_active: checked })} />,
    },
    {
      title: '', key: 'actions', width: 140,
      render: (_: unknown, row: CgtProcess) => (
        <Space>
          <Button size="small" type={activeProcessId === row.id ? 'primary' : 'default'} onClick={() => { setActiveProcessId(row.id); setSelected(null) }}>
            Templates
          </Button>
          <Tooltip title="Edit"><Button size="small" icon={<Pencil size={12} />} onClick={() => openEdit(row)} /></Tooltip>
          <Tooltip title="Remove">
            <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => deleteProcess.mutate(row.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-500">
        Manage the CGT "Process" options and, for each process, which workflow templates are offered when creating a notebook under it.
      </p>

      <div className="glass-card rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
          <span className="text-[13px] font-semibold text-slate-700">Processes</span>
          <Button size="small" type="primary" icon={<Plus size={13} />} onClick={openCreate} className="rounded-md font-medium">
            Add Process
          </Button>
        </div>
        <Table
          dataSource={processes}
          columns={columns}
          rowKey="id"
          loading={processesLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No processes configured.' }}
        />
      </div>

      {activeProcess && (
        <div className="glass-card rounded-lg divide-y divide-slate-100">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <span className="text-[13px] font-semibold text-slate-700">Templates for "{activeProcess.name}"</span>
          </div>
          {templatesLoading && <div className="p-4 text-[13px] text-slate-400">Loading…</div>}
          {!templatesLoading && templates.length === 0 && (
            <div className="p-4 text-[13px] text-slate-400">No CGT workflow templates found.</div>
          )}
          {templates.map((t: TemplateWithEnabled) => (
            <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <Checkbox checked={enabled.has(t.id)} onChange={(e) => toggleTemplate(t.id, e.target.checked)} />
              <span className="text-[13px] text-slate-700">{t.name}</span>
              <span className="text-[11px] text-slate-400">v{t.version}</span>
              {t.category && <span className="text-[11px] text-slate-400 ml-auto">{t.category}</span>}
            </label>
          ))}
          {templates.length > 0 && (
            <div className="flex justify-end px-4 py-2.5">
              <Button type="primary" loading={saveTemplates.isPending} onClick={() => saveTemplates.mutate()} className="rounded-md font-medium">
                Save
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        title={editTarget ? 'Edit Process' : 'Add Process'}
        open={processModal}
        onCancel={() => { setProcessModal(false); setEditTarget(null); form.resetFields() }}
        onOk={() => form.submit()}
        okText={editTarget ? 'Save' : 'Create'}
        confirmLoading={createProcess.isPending || updateProcess.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-3"
          onFinish={(vals) => {
            if (editTarget) updateProcess.mutate({ id: editTarget.id, body: { name: vals.name } })
            else createProcess.mutate(vals.name)
          }}
        >
          <Form.Item label="Process Name" name="name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Molecular Biology" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function TemplateSettingsPage() {
  return (
    <div className="p-6 space-y-3">
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3">
        <LayoutTemplate size={15} className="text-violet-500 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-700">Template Settings</span>
      </div>
      <div className="glass-card rounded-lg p-4">
        <Tabs
          defaultActiveKey="adc"
          items={[
            { key: 'adc', label: 'ADC Template Settings', children: <AdcTemplateSettings /> },
            { key: 'cgt', label: 'CGT Template Settings', children: <CgtTemplateSettings /> },
          ]}
        />
      </div>
    </div>
  )
}
