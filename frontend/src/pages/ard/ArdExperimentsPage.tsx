import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Button, Modal, Form, Input, Select, Radio, message, Tabs, Checkbox } from 'antd'
import { Plus, Search, FlaskConical, ClipboardList } from 'lucide-react'
import { ardTemplateApi, ardExperimentApi, type ExperimentStatus } from '../../api/ard'
import { ardNotebooksApi } from '../../api/ard-notebooks'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { adminApi } from '../../api/admin'

import { ardProjectsApi, type ProjectStp } from '../../api/ard-projects'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Ongoing',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  VERIFICATION_REQUESTED: 'Verification Requested',
  VERIFIED: 'Verified',
  REWORK: 'Rework',
  UNLOCK_REQUESTED: 'Unlock Requested',
  UNLOCKED: 'Unlocked',
  DEACTIVATED: 'Deactivated',
}

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: 'blue',
  SUBMITTED: 'purple',
  APPROVED: 'green',
  VERIFICATION_REQUESTED: 'gold',
  VERIFIED: 'cyan',
  REWORK: 'red',
  UNLOCK_REQUESTED: 'volcano',
  UNLOCKED: 'geekblue',
  DEACTIVATED: 'default',
}

function ageDays(createdAt?: string | null): number | null {
  if (!createdAt) return null
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
}

export default function ArdExperimentsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msg, ctx] = message.useMessage()
  const { textColor: healthTextColor } = useHealthIndicator()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [listTab, setListTab] = useState<'active' | 'inactive' | 'delayed' | 'review_comments'>('active')
  const [includeAllUsersReview, setIncludeAllUsersReview] = useState(false)
  const [reviewCommentsModalRows, setReviewCommentsModalRows] = useState<unknown[] | null>(null)
  const [form] = Form.useForm()
  const [creationMode, setCreationMode] = useState<'template' | 'stp'>('template')
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()

  const isUnscopedAdmin = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'QA', 'QC_MANAGER', 'TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
  const isScopedUser = !isUnscopedAdmin

  const { data, isLoading } = useQuery({ queryKey: ['ard-experiments'], queryFn: () => ardExperimentApi.list({ pageSize: 100 }) })
  const { data: published } = useQuery({ queryKey: ['ard-templates-published'], queryFn: ardTemplateApi.published })
  const { data: allTemplates } = useQuery({ queryKey: ['ard-templates-all'], queryFn: () => ardTemplateApi.list({ pageSize: 100 }) })
  const { data: notebooksData } = useQuery({ queryKey: ['ard-notebooks-list'], queryFn: () => ardNotebooksApi.list({ pageSize: 100 }) })
  const { data: projectsData } = useQuery({ queryKey: ['ard-projects-list-exp'], queryFn: () => ardProjectsApi.list({ pageSize: 100 }) })
  // B-79: fetch IncludeSTP setting
  const { data: settingsMap } = useQuery<Record<string, any>>({ queryKey: ['ard-settings-map'], queryFn: () => import('../../api/ard').then(m => m.ardApi.settingsMap()) })
  const stpEnabled = useMemo(() => {
    const raw = (settingsMap as any)?.['IncludeSTP']
    const val = typeof raw === 'object' && raw !== null && 'value' in raw ? raw.value : raw
    if (val === undefined || val === null) return true
    if (typeof val === 'boolean') return val
    return String(val).toLowerCase() !== 'false'
  }, [settingsMap])
  // B-82: delayed experiments for analyst
  const isAnalystRole = ['ANALYST', 'CHEMIST', 'CHEM'].includes(user?.role_code ?? '')
  const { data: delayedData } = useQuery({
    queryKey: ['ard-experiments-delayed'],
    queryFn: () => ardExperimentApi.list({ pageSize: 100, view: 'delayed' } as any),
    enabled: isAnalystRole,
  })
  const { data: selectedProjectDetail } = useQuery({
    queryKey: ['ard-project-detail-exp', selectedProjectId],
    queryFn: () => ardProjectsApi.get(selectedProjectId!),
    enabled: creationMode === 'stp' && !!selectedProjectId,
  })

  const accessibleProjects = useMemo(() => {
    const raw = projectsData?.items ?? []
    if (!isScopedUser || !user) return raw
    return raw.filter(p => {
      const isOwner = p.ownerName === user.username || p.ownerId === user.id || p.createdById === user.id
      const isTl = (p as any).assignedTl === user.username || (p as any).assignedTl === user.id
      const isMember = ((p as any).team ?? p.teamMembers ?? []).some((m: any) =>
        m.userName === user.username || m.username === user.username || m.userId === user.id || m.id === user.id
      )
      return isOwner || isTl || isMember
    })
  }, [projectsData?.items, isScopedUser, user])

  const accessibleProjectIds = useMemo(() => new Set(accessibleProjects.map(p => p.id)), [accessibleProjects])

  const scopedNotebooks = useMemo(() => {
    const raw = notebooksData?.items ?? []
    if (!isScopedUser || !user) return raw
    return raw.filter(nb => {
      const isCreator = nb.createdBy === user.username || nb.createdById === user.id
      const isAssigned = ((nb as any).assignedUsers ?? []).some((u: any) =>
        u.userId === user.id || u.userName === user.username
      )
      const isProjectAssigned = nb.projectId ? accessibleProjectIds.has(nb.projectId) : false
      return isCreator || isAssigned || isProjectAssigned
    })
  }, [notebooksData?.items, accessibleProjectIds, isScopedUser, user])

  const scopedNotebookIds = useMemo(() => new Set(scopedNotebooks.map(nb => nb.id)), [scopedNotebooks])

  const scopedExperiments = useMemo(() => {
    const raw = data?.items ?? []
    if (!isScopedUser || !user) return raw
    return raw.filter(exp => {
      const isCreator = (exp as any).createdBy === user.username || exp.createdById === user.id
      const isAssigned = (exp as any).assignedToId === user.id || (exp as any).assignedToName === user.username
      const isNotebookAssigned = exp.notebookId ? scopedNotebookIds.has(exp.notebookId) : false
      return isCreator || isAssigned || isNotebookAssigned
    })
  }, [data?.items, scopedNotebookIds, isScopedUser, user])

  const activeExperiments = useMemo(() => scopedExperiments.filter(e => e.status !== 'DEACTIVATED'), [scopedExperiments])
  const inactiveExperiments = useMemo(() => scopedExperiments.filter(e => e.status === 'DEACTIVATED'), [scopedExperiments])

  // ── Review Comments tab (Analyst) — experiments a reviewer left feedback
  // on (exp.clarifications, the same thread QA Comments posts to on the
  // experiment workspace page). "Include All Users" lifts the usual
  // mine-only narrowing to the whole team, same idea as the Tests screen's
  // In Progress tab.
  const { data: allUsersData } = useQuery({
    queryKey: ['ard-all-users-exp'],
    queryFn: () => adminApi.listUsers({ page_size: 200 }),
    enabled: isAnalystRole,
  })
  const usersById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of allUsersData?.items ?? []) map.set(u.id, u.username)
    return map
  }, [allUsersData])

  const reviewCommentExperiments = useMemo(() => {
    const withComments = (data?.items ?? []).filter(e => Array.isArray((e as any).clarifications) && (e as any).clarifications.length > 0)
    if (!isScopedUser || includeAllUsersReview) return withComments
    return withComments.filter(exp => {
      const isCreator = (exp as any).createdBy === user?.username || exp.createdById === user?.id
      const isAssigned = (exp as any).assignedToId === user?.id || (exp as any).assignedToName === user?.username
      const isNotebookAssigned = exp.notebookId ? scopedNotebookIds.has(exp.notebookId) : false
      return isCreator || isAssigned || isNotebookAssigned
    })
  }, [data?.items, isScopedUser, includeAllUsersReview, user, scopedNotebookIds])

  const filteredExperiments = useMemo(() => {
    const base = listTab === 'inactive' ? inactiveExperiments
      : listTab === 'delayed' ? (delayedData?.items ?? [])
      : listTab === 'review_comments' ? reviewCommentExperiments
      : activeExperiments
    const term = q.trim().toLowerCase()
    if (!term) return base
    return base.filter(exp =>
      exp.code?.toLowerCase().includes(term) ||
      exp.templateName?.toLowerCase().includes(term) ||
      exp.status?.toLowerCase().includes(term)
    )
  }, [activeExperiments, inactiveExperiments, delayedData, reviewCommentExperiments, listTab, q])

  const templateOptions = useMemo(() => {
    const pub = published?.items ?? []
    const list = pub.length > 0 ? pub : (allTemplates?.items ?? [])
    return list.map((t) => ({
      value: t.id,
      label: `${t.name} (v${t.version}${t.status ? ` - ${t.status}` : ''})`,
      name: t.name,
    }))
  }, [published, allTemplates])

  const notebookOptions = useMemo(() => {
    // B-69: when STP mode, only show notebooks with type STP_WORKSHEET / STP
    const filtered = creationMode === 'stp'
      ? scopedNotebooks.filter(nb => nb.notebookType && ['STP_WORKSHEET', 'STP'].includes(nb.notebookType.toUpperCase()))
      : scopedNotebooks
    return filtered.map((nb) => ({
      value: nb.id,
      label: `${nb.name} (${nb.code})`,
    }))
  }, [scopedNotebooks, creationMode])

  const projectOptions = useMemo(() =>
    (projectsData?.items ?? []).filter(p => p.status === 'OPEN').map(p => ({
      value: p.id,
      label: `${p.code} — ${p.productName}`,
    }))
  , [projectsData])

  const stpOptions = useMemo<{ value: string; label: string; stp: ProjectStp }[]>(() => {
    const docs = selectedProjectDetail?.stpDocuments ?? []
    return docs
      .filter(s => s.status === 'APPROVED')
      .map(s => ({
        // Must be the STP's id, not its documentNo — the backend looks up
        // the STP on the project by `s.id === projectStpId` (see POST
        // /api/ard/experiments), so sending documentNo here always 404s
        // with "STP document not found on this project".
        value: s.id,
        label: `${s.documentNo} v${s.version} — ${s.title}${s.testType ? ` (${s.testType})` : ''}`,
        stp: s,
      }))
  }, [selectedProjectDetail])

  const create = useMutation({
    mutationFn: ardExperimentApi.create,
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ['ard-experiments'] })
      msg.success('Experiment created successfully!')
      setOpen(false)
      form.resetFields()
      setCreationMode('template')
      navigate(`/ard/experiments/${e.id}`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to create experiment.'),
  })

  return (
    <div className="p-4 md:p-6">
      {ctx}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical size={20} className="text-violet-600" />
          <h1 className="text-lg font-bold text-slate-800">Experiments</h1>
          <span className="text-sm text-slate-400 ml-1">({filteredExperiments.length})</span>
        </div>
        {!['ANALYST', 'CHEMIST', 'CHEM'].includes(user?.role_code ?? '') && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { form.resetFields(); setCreationMode('template'); setSelectedProjectId(undefined); setOpen(true) }}>
            ADD
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <Input
          prefix={<Search size={16} className="text-slate-400" />}
          placeholder="Search experiment code / template"
          allowClear
          style={{ width: 280 }}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <Tabs
        activeKey={listTab}
        onChange={k => setListTab(k as 'active' | 'inactive' | 'delayed' | 'review_comments')}
        className="mb-2"
        items={[
          { key: 'active', label: `Active (${activeExperiments.length})` },
          { key: 'inactive', label: `Inactive / Deactivated (${inactiveExperiments.length})` },
          ...(isAnalystRole ? [{ key: 'delayed', label: `Delayed (${delayedData?.items?.length ?? 0})` }] : []),
          ...(isAnalystRole ? [{ key: 'review_comments', label: `Review Comments (${reviewCommentExperiments.length})` }] : []),
        ]}
      />

      {listTab === 'review_comments' && (
        <div className="flex justify-end mb-2">
          <Checkbox checked={includeAllUsersReview} onChange={(e) => setIncludeAllUsersReview(e.target.checked)}>
            Include All Users
          </Checkbox>
        </div>
      )}

      <div className="glass-card rounded-lg overflow-hidden">
      {listTab === 'review_comments' ? (
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={filteredExperiments}
          size="small"
          onRow={(row) => ({ onClick: () => navigate(`/ard/experiments/${row.id}`) })}
          rowClassName={() => 'cursor-pointer'}
          columns={[
            {
              title: 'Product', width: 160,
              render: (_: unknown, row: any) => {
                const nb = (notebooksData?.items ?? []).find(n => n.id === row.notebookId)
                const pid = row.projectId || nb?.projectId
                const proj = (projectsData?.items ?? []).find(p => p.id === pid)
                return proj ? ((proj as any).productName || proj.name || proj.code) : '—'
              },
            },
            { title: 'Experiment Code', dataIndex: 'code', render: (v) => <span className="font-mono text-indigo-700 font-semibold">{v}</span> },
            {
              title: 'Test Number(s)',
              render: (_: unknown, row: any) => (Array.isArray(row.linkedAtrIds) && row.linkedAtrIds.length > 0 ? row.linkedAtrIds.join(', ') : '—'),
            },
            {
              title: 'Notebook Type', width: 140,
              render: (_: unknown, row: any) => {
                const nb = (notebooksData?.items ?? []).find(n => n.id === row.notebookId)
                return nb?.notebookType || '—'
              },
            },
            { title: 'Template Name', dataIndex: 'templateName', render: (v) => v || '—' },
            { title: 'Experiment Aim', dataIndex: 'aim', render: (v) => v ? <span className="line-clamp-2">{v}</span> : '—' },
            {
              title: 'Improvement Suggested', width: 100, align: 'center',
              render: (_: unknown, row: any) => (
                <Button
                  type="text" shape="circle" icon={<ClipboardList size={16} className="text-indigo-600" />}
                  onClick={(e) => { e.stopPropagation(); setReviewCommentsModalRows(row.clarifications ?? []) }}
                />
              ),
            },
            {
              title: 'Started By (On)', width: 170,
              render: (_: unknown, row: any) => (
                <div className="text-xs">
                  <p className="font-medium text-slate-700">{usersById.get(row.createdById) || '—'}</p>
                  <p className="text-[11px] text-slate-400">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</p>
                </div>
              ),
            },
            {
              title: 'Age', dataIndex: 'createdAt',
              render: (v) => {
                const d = ageDays(v)
                return <span className={`text-xs font-mono ${healthTextColor(d)}`}>{d !== null ? d : '—'}</span>
              },
            },
          ]}
        />
      ) : (
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={filteredExperiments}
        size="small"
        onRow={(row) => ({ onClick: () => navigate(`/ard/experiments/${row.id}`) })}
        rowClassName={() => 'cursor-pointer'}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 150, render: (v) => <span className="font-mono text-slate-700 font-semibold">{v}</span> },
          { title: 'Name / Title', dataIndex: 'templateName', render: (v) => <span className="font-medium text-slate-800">{v || '—'}</span> },
          {
            title: 'Project', dataIndex: 'projectId', key: 'projectId', width: 200,
            render: (_: unknown, row: any) => {
              const nb = (notebooksData?.items ?? []).find(n => n.id === row.notebookId)
              const pid = row.projectId || nb?.projectId
              const proj = (projectsData?.items ?? []).find(p => p.id === pid)
              return proj ? (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-800 text-xs leading-tight">{(proj as any).productName || proj.name || proj.code}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{proj.code}</span>
                </div>
              ) : '—'
            },
          },
          {
            title: 'Notebook', dataIndex: 'notebookId', key: 'notebookId', width: 180,
            render: (nbId: string) => {
              const nb = (notebooksData?.items ?? []).find(n => n.id === nbId)
              return nb ? (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-800 text-xs leading-tight">{nb.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{nb.code}</span>
                </div>
              ) : '—'
            },
          },
          { title: 'Status', dataIndex: 'status', width: 130, render: (v: ExperimentStatus) => <Tag color={STATUS_COLOR[v] ?? 'blue'}>{STATUS_LABEL[v] ?? v}</Tag> },
          { title: 'Version', dataIndex: 'version', width: 80, render: (v) => <span className="font-mono text-xs">{v}</span> },
          {
            title: <span className="whitespace-nowrap">Age (days)</span>,
            dataIndex: 'createdAt',
            render: (v) => {
              const d = ageDays(v)
              return <span className={`text-xs font-mono ${healthTextColor(d)}`}>{d !== null ? d : '—'}</span>
            },
          },
        ]}
      />
      )}
      </div>

      {/* Improvement Suggested — the review comments thread for one experiment */}
      <Modal
        {...glassModalProps}
        title="Improvement Suggested"
        open={!!reviewCommentsModalRows}
        onCancel={() => setReviewCommentsModalRows(null)}
        footer={null}
      >
        <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto">
          {(reviewCommentsModalRows ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No comments.</p>
          ) : (
            (reviewCommentsModalRows as { id?: string; message?: string; byName?: string; at?: string }[]).map((c, i) => (
              <div key={c.id ?? i} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-semibold text-slate-700">{c.byName || 'Reviewer'}</span>
                  <span className="text-slate-400">{c.at ? new Date(c.at).toLocaleString() : ''}</span>
                </div>
                <p className="text-slate-700">{c.message}</p>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        {...glassModalProps}
        title="Create New Experiment"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => {
          const payload: Record<string, any> = { ...v }
          if (creationMode === 'stp' && selectedProjectId && v.projectStpId) {
            payload.projectId = selectedProjectId
          }
          create.mutate(payload)
        })}
        confirmLoading={create.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="pt-2">
          <Form.Item label="Creation Mode" style={{ marginBottom: 16 }}>
            <Radio.Group
              value={creationMode}
              onChange={e => { setCreationMode(e.target.value); form.resetFields(['templateId', 'projectStpId']) }}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: 'Via Template', value: 'template' },
                ...(stpEnabled ? [{ label: 'Via Project STP', value: 'stp' }] : []),
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label="Experiment Name" rules={[{ required: true, message: 'Please enter an experiment name' }]}>
            <Input placeholder="e.g. Assay & Related Substances Test for Batch 001" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="testType" label="Test Type">
              <Select placeholder="Select test type" allowClear options={[
                { value: 'ASSAY', label: 'Assay' },
                { value: 'RELATED_SUBSTANCES', label: 'Related Substances' },
                { value: 'DISSOLUTION', label: 'Dissolution' },
                { value: 'WATER_CONTENT', label: 'Water Content' },
                { value: 'RESIDUE_ON_IGNITION', label: 'Residue on Ignition' },
                { value: 'IDENTIFICATION', label: 'Identification' },
                { value: 'PHYSICOCHEMICAL', label: 'Physicochemical' },
                { value: 'MICROBIOLOGY', label: 'Microbiology' },
                { value: 'OTHER', label: 'Other' },
              ]} />
            </Form.Item>
            <Form.Item name="testSubType" label="Test Sub Type">
              <Input placeholder="e.g. HPLC, GC, UV" />
            </Form.Item>
          </div>
          <Form.Item name="aimObjective" label="Aim / Objective">
            <Input.TextArea rows={2} placeholder="Describe the aim or objective of this experiment..." />
          </Form.Item>
          <Form.Item name="notebookId" label="Notebook" rules={[{ required: true, message: 'Please select a notebook' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select notebook..."
              options={notebookOptions}
            />
          </Form.Item>
          {creationMode === 'stp' && (
            <>
              <Form.Item label="Project" style={{ marginBottom: 12 }}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select project..."
                  options={projectOptions}
                  value={selectedProjectId}
                  onChange={v => { setSelectedProjectId(v); form.resetFields(['projectStpId']) }}
                  allowClear
                />
              </Form.Item>
              <Form.Item
                name="projectStpId"
                label="Project STP Worksheet"
                rules={[{ required: true, message: 'Please select an approved STP' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={stpOptions.length === 0 ? 'No approved STPs for this project' : 'Select STP...'}
                  options={stpOptions}
                  disabled={!selectedProjectId || stpOptions.length === 0}
                  onChange={(val) => {
                    const found = stpOptions.find(o => o.value === val)
                    if (found?.stp?.title && !form.getFieldValue('name')) {
                      form.setFieldsValue({ name: found.stp.title })
                    }
                  }}
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="templateId" label="Template (section structure)" rules={[{ required: true, message: 'Please select a template' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select template..."
              options={templateOptions}
              onChange={(val, opt: any) => {
                if (opt?.name && !form.getFieldValue('name')) {
                  form.setFieldsValue({ name: opt.name })
                }
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
