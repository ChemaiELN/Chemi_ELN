import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Tabs, Input, Tag, Spin, Alert, Modal, Table, Select,
  Typography, Empty, Popconfirm, message, Form, DatePicker, Card, Tooltip, Space, Steps, Segmented
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeft, FolderOpen, Plus, Trash2, CheckCircle2,
  RotateCcw, Edit3, Lock, Unlock, BookOpen, Send, Users, ShieldCheck, Eye, Calendar, Filter, UserPlus, LayoutList, FileText
} from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import { ardProjectsApi, type Project, type ProjectStp, type ProjectAttribute, type ProjectTeamMember } from '../../api/ard-projects'
import { ardNotebooksApi, type Notebook, type AssignedUser } from '../../api/ard-notebooks'
import { ardApi, ardOpsApi } from '../../api/ard'
import { ApiError, apiGet } from '../../api/client'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import ArdAttachmentsPanel from '../../components/ard/ArdAttachmentsPanel'
import ProjectSpecificationsPanel from '../../components/ard/ProjectSpecificationsPanel'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { glassModalProps } from '../../utils/modalStyles'

const { TextArea } = Input
const { Text } = Typography

const STP_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', APPROVAL_REQUIRED: 'gold', ACTIVE: 'green',
  SUPERSEDED: 'purple', REWORK: 'orange',
}
const STP_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', APPROVAL_REQUIRED: 'Approval Required', ACTIVE: 'Active',
  SUPERSEDED: 'Superseded', REWORK: 'Rework',
}

function newStpId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function supersedePrevious(stps: ProjectStp[], documentNo: string, excludeId: string): ProjectStp[] {
  return stps.map(s =>
    s.documentNo === documentNo && s.id !== excludeId && s.status === 'ACTIVE'
      ? { ...s, status: 'SUPERSEDED' as const }
      : s
  )
}

export default function ArdProjectWorkspacePage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msgApi, ctx] = message.useMessage()

  // Details edit state
  const [viewMode, setViewMode] = useState<'tabbed' | 'single'>('tabbed')
  const [description, setDescription] = useState('')
  const [customer, setCustomer] = useState('')
  const [projectType, setProjectType] = useState('')
  const [targetDate, setTargetDate] = useState<Dayjs | null>(null)
  const [ownerName, setOwnerName] = useState('')

  // Notebook reopen state
  const [reopenNotebookId, setReopenNotebookId] = useState<string | null>(null)
  const [reopenRemarks, setReopenRemarks] = useState('')

  // STP modal state
  const [stpModalOpen, setStpModalOpen] = useState(false)
  const [editingStp, setEditingStp] = useState<ProjectStp | null>(null)
  const [viewStp, setViewStp] = useState<ProjectStp | null>(null)
  const [esignStp, setEsignStp] = useState<ProjectStp | null>(null)
  const [stpForm] = Form.useForm()

  // Team Modal state
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([])
  const [selectedBatchUsers, setSelectedBatchUsers] = useState<string[]>([])
  const [addMode, setAddMode] = useState<'users' | 'team'>('users')
  const [addTeamSel, setAddTeamSel] = useState<string | null>(null)
  const [teamRoleFilter, setTeamRoleFilter] = useState<string | undefined>(undefined)
  const [myTeamOnly, setMyTeamOnly] = useState(false)
  const [notebookSyncIds, setNotebookSyncIds] = useState<string[]>([])

  // STP Submit modal state
  const [submitStpOpen, setSubmitStpOpen] = useState(false)
  const [submitStpItem, setSubmitStpItem] = useState<ProjectStp | null>(null)
  const [submitStpForm] = Form.useForm()

  // Project status E-Signature state
  const [esignProjectAction, setEsignProjectAction] = useState<'close' | 'deactivate' | 'reopen' | null>(null)

  // Audit trail filter state
  const [auditAction, setAuditAction] = useState<string | undefined>(undefined)
  const [auditUser, setAuditUser] = useState<string | undefined>(undefined)
  const [auditDateRange, setAuditDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  // Notebook modal state
  const [notebookModalOpen, setNotebookModalOpen] = useState(false)
  const [notebookName, setNotebookName] = useState('')
  const [notebookDescription, setNotebookDescription] = useState('')

  // Attributes state
  const [attributes, setAttributes] = useState<ProjectAttribute[]>([])

  const { data, isLoading, error } = useQuery<Project>({
    queryKey: ['ard-project', projectId],
    queryFn: () => ardProjectsApi.get(projectId),
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  })

  const { data: notebooksData, refetch: refetchNotebooks } = useQuery({
    queryKey: ['ard-project-notebooks', projectId],
    queryFn: () => ardNotebooksApi.list({ projectId, pageSize: 100 }),
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  })

  const { data: dbAuditData } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['ard-project-audit', projectId],
    queryFn: () => apiGet(`/api/ard/audit/entity/PROJECT/${projectId}`),
    enabled: !!projectId,
  })

  const { data: masterData } = useQuery({
    queryKey: ['ard-master-data'],
    queryFn: ardApi.getMasterData,
  })

  const { data: usersData } = useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      try {
        const res = await apiGet<any>('/api/users', { page_size: 500 })
        return Array.isArray(res) ? res : res?.items ?? []
      } catch {
        return []
      }
    },
  })

  const { data: teamDirData } = useQuery({
    queryKey: ['ard-team-directory'],
    queryFn: ardOpsApi.teamDirectory,
  })

  // ── Role helpers ─────────────────────────────────────────────────────────────
  const role = user?.role_code ?? ''

  const dbUsers = useMemo(() => {
    const raw = usersData ?? []
    return raw.filter((u: any) => (u.department_name || '').trim().toUpperCase() === 'AD')
  }, [usersData])

  const dbUserOptions = useMemo(() => {
    return dbUsers.map((u: any) => ({
      value: u.username || u.id,
      label: `${u.username || u.name || 'User'} (${u.role_code || u.role_name || u.role || 'User'})`,
      username: u.username || u.name,
      userId: u.id || u.emp_no || u.username,
      role: u.role_code || u.role || 'ANALYST',
    }))
  }, [dbUsers])

  const filteredDbUserOptions = useMemo(() => {
    let opts = dbUserOptions
    if (teamRoleFilter) {
      opts = opts.filter((o: any) => (o.role || '').toUpperCase() === teamRoleFilter.toUpperCase())
    }
    if (myTeamOnly && role === 'TL') {
      const myTeam = (teamDirData?.items ?? []).find((t: any) =>
        (t.tls ?? []).some((tl: any) => tl.id === user?.id || tl.name === user?.username)
      )
      if (myTeam) {
        const myTl = (myTeam.tls ?? []).find((tl: any) => tl.id === user?.id || tl.name === user?.username)
        const analystNames = new Set((myTl?.analysts ?? []).map((a: any) => a.username || a.name))
        opts = opts.filter((o: any) => analystNames.has(o.username))
      }
    }
    return opts
  }, [dbUserOptions, teamRoleFilter, myTeamOnly, teamDirData, role, user])

  const selectedStpTestType = Form.useWatch('testType', stpForm)

  const testTypeOptions = useMemo(() => {
    const types = Array.from(new Set((masterData?.testConfigs ?? []).map(tc => tc.testType).filter(Boolean)))
    return types.map(t => ({ value: t, label: t }))
  }, [masterData?.testConfigs])

  const testSubtypeOptions = useMemo(() => {
    const filteredConfigs = selectedStpTestType
      ? (masterData?.testConfigs ?? []).filter(tc => tc.testType === selectedStpTestType)
      : (masterData?.testConfigs ?? [])
    const subtypes = Array.from(new Set(filteredConfigs.map(tc => tc.testSubtype).filter(Boolean)))
    return (subtypes as string[]).map(st => ({ value: st, label: st }))
  }, [masterData?.testConfigs, selectedStpTestType])

  const createNotebook = useMutation({
    mutationFn: ({ name, description: desc }: { name: string; description?: string }) =>
      ardNotebooksApi.create({ name, description: desc || null, projectId }),
    onSuccess: (nb: Notebook) => { refetchNotebooks(); navigate(`/ard/notebooks/${nb.id}`) },
    onError: () => msgApi.error('Failed to create notebook'),
  })

  useEffect(() => {
    if (!data) return
    setDescription(data.description ?? '')
    setCustomer(data.customer ?? '')
    setProjectType(data.projectType ?? '')
    setTargetDate(data.targetDate ? dayjs(data.targetDate) : null)
    setOwnerName(data.ownerName ?? '')
    setAttributes(data.attributes ?? [])
    setTeamMembers(data.team ?? [])
  }, [data])

  // H-15: Prompt to add a default notebook when the project has none yet
  const notebookPromptShown = useRef(false)
  useEffect(() => {
    if (!data || !notebooksData || notebookPromptShown.current) return
    if ((notebooksData.items?.length ?? 0) === 0) {
      const userRole = user?.role_code ?? ''
      const isEditable = ['TL', 'HOD', 'SUPER_ADMIN'].includes(userRole) && data.status === 'OPEN'
      if (!isEditable) return
      notebookPromptShown.current = true
      Modal.confirm({
        title: 'Add Default Notebook?',
        content: 'Would you like to create a default notebook for this project now?',
        okText: 'Yes, Create Notebook',
        cancelText: 'Skip',
        onOk: async () => {
          try {
            await ardNotebooksApi.create({ name: 'Notebook 1', description: null, projectId: data.id })
            msgApi.success('Default notebook created.')
            refetchNotebooks()
            qc.invalidateQueries({ queryKey: ['ard-project-notebooks', projectId] })
          } catch {
            msgApi.error('Failed to create notebook.')
          }
        },
      })
    }
  }, [data, notebooksData]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ard-project', projectId] })
    qc.invalidateQueries({ queryKey: ['ard-project-audit', projectId] })
    qc.invalidateQueries({ queryKey: ['ard-project-notebooks', projectId] })
    qc.invalidateQueries({ queryKey: ['ard-attachments', 'project', projectId] })
    qc.invalidateQueries({ queryKey: ['ard-experiments'] })
  }

  const saveMut = useMutation({
    mutationFn: ({ body }: { body: Partial<Project>; successMsg?: string }) => ardProjectsApi.update(projectId, body),
    onSuccess: (_, variables) => {
      msgApi.success(variables.successMsg || 'Project details saved successfully.')
      invalidate()
    },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Save failed.'),
  })

  const closeMut = useMutation({
    mutationFn: (body?: Record<string, unknown>) => ardProjectsApi.close(data?.id || projectId, body),
    onSuccess: () => { msgApi.success('Project closed successfully.'); invalidate() },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Failed to close project.'),
  })

  const deactivateMut = useMutation({
    mutationFn: (body?: Record<string, unknown>) => ardProjectsApi.deactivate(data?.id || projectId, body),
    onSuccess: () => { msgApi.success('Project deactivated successfully.'); invalidate() },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Failed to deactivate project.'),
  })

  const reopenMut = useMutation({
    mutationFn: (body?: Record<string, unknown>) => ardProjectsApi.reopen(data?.id || projectId, body),
    onSuccess: () => { msgApi.success('Project reopened successfully.'); invalidate() },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Failed to reopen project.'),
  })

  const reopenNotebookMut = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      ardNotebooksApi.reopen(id, { remarks }),
    onSuccess: () => {
      msgApi.success('Notebook reopened successfully.')
      setReopenNotebookId(null)
      setReopenRemarks('')
      refetchNotebooks()
    },
    onError: () => msgApi.error('Failed to reopen notebook.'),
  })

  const stpSubmitMut = useMutation({
    mutationFn: ({ stpId, approverUsername, description: desc }: { stpId: string; approverUsername?: string; description?: string }) =>
      ardProjectsApi.submitStp(projectId, stpId, { approverUsername, description: desc }),
    onSuccess: () => { msgApi.success('STP submitted for approval.'); setSubmitStpOpen(false); setSubmitStpItem(null); invalidate() },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Submit failed.'),
  })

  const stpApproveMut = useMutation({
    mutationFn: ({ stpId, body }: { stpId: string; body?: { remarks?: string; password?: string } }) =>
      ardProjectsApi.approveStp(projectId, stpId, body),
    onSuccess: () => { msgApi.success('STP approved.'); setEsignStp(null); invalidate() },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Approve failed.'),
  })

  const stpReturnMut = useMutation({
    mutationFn: (stpId: string) => ardProjectsApi.returnStp(projectId, stpId),
    onSuccess: () => { msgApi.success('STP returned to author.'); invalidate() },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Return failed.'),
  })

  const canEdit = ['TL', 'HOD', 'SUPER_ADMIN'].includes(role) && data?.status === 'OPEN'
  const canApproveStp = ['HOD', 'SUPER_ADMIN'].includes(role)

  // ── STP save helper ──────────────────────────────────────────────────────────
  function saveStpList(newList: ProjectStp[], customMsg?: string) {
    saveMut.mutate({ body: { stpDocuments: newList }, successMsg: customMsg || 'STP documents updated successfully.' })
  }

  function openCreateStp() {
    setEditingStp(null)
    stpForm.resetFields()
    stpForm.setFieldsValue({ version: '1.0', status: 'DRAFT' })
    setStpModalOpen(true)
  }

  function openEditStp(stp: ProjectStp) {
    setEditingStp(stp)
    stpForm.setFieldsValue({ ...stp })
    setStpModalOpen(true)
  }

  function handleStpSubmit(values: Partial<ProjectStp>) {
    const current = data?.stpDocuments ?? []
    if (editingStp) {
      const updated = current.map(s => s.id === editingStp.id ? { ...s, ...values, updatedAt: new Date().toISOString() } : s)
      saveStpList(updated, 'STP document updated successfully.')
    } else {
      const newStp: ProjectStp = {
        id: newStpId(),
        documentNo: values.documentNo ?? '',
        title: values.title ?? '',
        version: values.version ?? '1.0',
        ...values,
        status: values.status || 'DRAFT',
        updatedAt: new Date().toISOString(),
      }
      saveStpList([...current, newStp], 'STP document added successfully.')
    }
    setStpModalOpen(false)
  }

  function handleSubmitForApprovalStp(stp: ProjectStp) {
    setSubmitStpItem(stp)
    submitStpForm.resetFields()
    setSubmitStpOpen(true)
  }

  function handleApproveStpWithEsign(stp: ProjectStp, reason?: string) {
    stpApproveMut.mutate({ stpId: stp.id, body: reason ? { remarks: reason } : {} })
  }

  function handleReturnStp(stp: ProjectStp) {
    stpReturnMut.mutate(stp.id)
  }

  function handleDeleteStp(id: string) {
    const current = data?.stpDocuments ?? []
    saveStpList(current.filter(s => s.id !== id), 'STP document deleted successfully.')
  }

  function handleReviseStp(stp: ProjectStp) {
    const current = data?.stpDocuments ?? []
    const nextVer = `${parseFloat(stp.version || '1.0') + 1.0}.0`
    const revised: ProjectStp = {
      id: newStpId(),
      documentNo: stp.documentNo,
      title: stp.title,
      version: nextVer,
      stpType: stp.stpType,
      stpGrade: stp.stpGrade,
      specificationNo: stp.specificationNo,
      weighingDetails: stp.weighingDetails,
      phDetails: stp.phDetails,
      columnDetails: stp.columnDetails,
      testType: stp.testType,
      testSubtype: stp.testSubtype,
      scope: stp.scope,
      description: stp.description,
      status: 'DRAFT',
      updatedAt: new Date().toISOString(),
    }
    saveStpList([...current, revised], `Created new revision v${nextVer} in Draft.`)
  }

  const [draftTeamMembers, setDraftTeamMembers] = useState<ProjectTeamMember[]>([])

  function openTeamModal() {
    setDraftTeamMembers([...teamMembers])
    setSelectedBatchUsers([])
    setAddMode('users')
    setAddTeamSel(null)
    setTeamRoleFilter(undefined)
    setMyTeamOnly(false)
    setNotebookSyncIds([])
    setTeamModalOpen(true)
  }

  async function handleSaveTeam() {
    setTeamMembers(draftTeamMembers)
    saveMut.mutate({
      body: { team: draftTeamMembers },
      successMsg: 'Project team members updated successfully.',
    })
    const targetNotebooks = notebookSyncIds.length > 0
      ? (notebooksData?.items ?? []).filter(nb => notebookSyncIds.includes(nb.id))
      : notebooksData?.items ?? []
    if (targetNotebooks.length > 0) {
      try {
        const assignedUsers: AssignedUser[] = draftTeamMembers.map(m => ({
          userId: m.userId || m.userName,
          userName: m.userName,
          role: m.role || 'ANALYST',
        }))
        // HOD always gets synced to all notebooks
        const hodMembers = draftTeamMembers.filter(m => m.role === 'HOD')
        for (const nb of targetNotebooks) {
          await ardNotebooksApi.patch(nb.id, { assignedUsers }).catch(() => {})
        }
        if (hodMembers.length > 0 && notebookSyncIds.length > 0) {
          const allNotebooks = notebooksData?.items ?? []
          const syncedIds = new Set(notebookSyncIds)
          for (const nb of allNotebooks.filter(n => !syncedIds.has(n.id))) {
            const hodUsers: AssignedUser[] = hodMembers.map(m => ({
              userId: m.userId || m.userName, userName: m.userName, role: 'HOD',
            }))
            await ardNotebooksApi.patch(nb.id, { assignedUsers: hodUsers }).catch(() => {})
          }
        }
        refetchNotebooks()
      } catch { /* ignore */ }
    }
    setTeamModalOpen(false)
    setSelectedBatchUsers([])
    setNotebookSyncIds([])
  }

  function handleBatchAddUsers() {
    if (!selectedBatchUsers.length) return
    const existingUserNames = new Set(draftTeamMembers.map(m => m.userName))
    const newMembers: ProjectTeamMember[] = []

    for (const val of selectedBatchUsers) {
      const opt = filteredDbUserOptions.find((o: any) => o.value === val)
      if (opt) {
        const uName = opt.username || val
        if (!existingUserNames.has(uName)) {
          newMembers.push({
            userName: uName,
            userId: opt.userId || val,
            role: opt.role || 'ANALYST',
          })
          existingUserNames.add(uName)
        }
      }
    }

    if (newMembers.length > 0) {
      setDraftTeamMembers([...draftTeamMembers, ...newMembers])
      msgApi.success(`Added ${newMembers.length} user(s) to draft team. Click Save to apply.`)
    } else {
      msgApi.info('Selected user(s) are already in the team list.')
    }
    setSelectedBatchUsers([])
  }

  // ── Attribute helpers ────────────────────────────────────────────────────────
  function saveAttributes(updated: ProjectAttribute[], isDelete = false) {
    setAttributes(updated)
    saveMut.mutate({
      body: { attributes: updated },
      successMsg: isDelete ? 'Project attribute removed successfully.' : 'Project attributes saved successfully.',
    })
  }

  // ── Audit trail filters ──────────────────────────────────────────────────────
  const combinedAuditTrail = useMemo(() => {
    const normalizeKey = (action: string, detail: string, createdAt: string) => {
      const act = (action || '').toUpperCase().trim()
      const det = (detail || '').trim().toLowerCase()
      let minuteEpoch = 0
      try {
        const d = new Date(createdAt)
        if (!isNaN(d.getTime())) minuteEpoch = Math.floor(d.getTime() / 60000)
      } catch {
        /* fallback */
      }
      return `${act}::${det}::${minuteEpoch}`
    }

    const fromDb = (dbAuditData?.items || []).map((item) => {
      let detailStr = item.eventDetails || item.detail || '—'
      if (data?.code && detailStr.startsWith(`${data.code} - `)) {
        detailStr = detailStr.slice(data.code.length + 3)
      } else if (data?.code && detailStr === data.code) {
        detailStr = 'Project created'
      }
      return {
        id: item.id || `db-${item.eventTime}`,
        createdAt: item.eventTime || item.at || new Date().toISOString(),
        action: item.eventType || item.action || 'UPDATED',
        actorName: item.user || item.actor || 'System',
        detail: detailStr,
      }
    })

    const fromJson = (data?.auditTrail || []).map((item) => {
      let detailStr = item.detail || '—'
      if (data?.code && detailStr.startsWith(`${data.code} - `)) {
        detailStr = detailStr.slice(data.code.length + 3)
      } else if (data?.code && detailStr === data.code) {
        detailStr = 'Project created'
      }
      return {
        id: item.id || `json-${item.createdAt}`,
        createdAt: item.createdAt || new Date().toISOString(),
        action: item.action || 'UPDATED',
        actorName: item.actorName || 'System',
        detail: detailStr,
      }
    })

    const list: typeof fromDb = []
    const seen = new Set<string>()

    for (const item of fromDb) {
      if (item.detail.includes('Fields: description, customer, projectType, targetDate, ownerName')) {
        continue
      }
      const key = normalizeKey(item.action, item.detail, item.createdAt)
      if (seen.has(key)) continue
      seen.add(key)
      list.push(item)
    }

    for (const item of fromJson) {
      if (item.detail.includes('Fields: description, customer, projectType, targetDate, ownerName')) {
        continue
      }
      const key = normalizeKey(item.action, item.detail, item.createdAt)
      if (!seen.has(key)) {
        seen.add(key)
        list.push(item)
      }
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return list
  }, [dbAuditData?.items, data?.auditTrail, data?.code])

  const auditActionOptions = useMemo(
    () => Array.from(new Set(combinedAuditTrail.map((e) => e.action).filter(Boolean))).map((a) => ({ value: a, label: a })),
    [combinedAuditTrail],
  )
  const auditUserOptions = useMemo(
    () => Array.from(new Set(combinedAuditTrail.map((e) => e.actorName).filter(Boolean))).map((u) => ({ value: u, label: u })),
    [combinedAuditTrail],
  )

  const filteredAuditTrail = useMemo(() => {
    return [...combinedAuditTrail]
      .filter((e) => (auditAction ? e.action === auditAction : true))
      .filter((e) => (auditUser ? e.actorName === auditUser : true))
      .filter((e) => {
        if (!auditDateRange || (!auditDateRange[0] && !auditDateRange[1])) return true
        const at = dayjs(e.createdAt)
        if (auditDateRange[0] && at.isBefore(auditDateRange[0], 'day')) return false
        if (auditDateRange[1] && at.isAfter(auditDateRange[1], 'day')) return false
        return true
      })
  }, [combinedAuditTrail, auditAction, auditUser, auditDateRange])

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (isLoading) return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  if (error || !data) return (
    <div className="p-4 md:p-6">
      <Alert type="error" message="Failed to load project" showIcon
        action={<Button size="small" onClick={() => navigate('/ard/projects')}>Back to Projects</Button>} />
    </div>
  )

  const anyBusy = saveMut.isPending || closeMut.isPending || reopenMut.isPending

  // ── STP table columns ────────────────────────────────────────────────────────
  const stpCols: ColumnsType<ProjectStp> = [
    {
      title: 'Document No.',
      dataIndex: 'documentNo',
      width: 150,
      render: v => <span className="font-mono text-slate-700 font-semibold">{v}</span>,
    },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Version', dataIndex: 'version', width: 80, render: v => <span className="font-mono text-xs font-bold">{v}</span> },
    { title: 'Test Type', dataIndex: 'testType', width: 140, render: v => v || '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (v: string) => <Tag color={STP_STATUS_COLOR[v] ?? 'default'} className="font-semibold">{STP_STATUS_LABEL[v] ?? v ?? 'DRAFT'}</Tag>,
    },
    { title: 'Submitted By', dataIndex: 'submittedBy', width: 120, render: v => v ? <span className="text-slate-600 text-xs">{v}</span> : '—' },
    { title: 'Approved By', dataIndex: 'approvedBy', width: 130, render: v => v ? <span className="text-slate-700 font-medium">{v}</span> : '—' },
    {
      title: 'Actions',
      width: 220,
      render: (_, row) => (
        <div className="flex items-center gap-1 flex-wrap">
          {/* Draft or Rework status: Editable & Submittable by TL/HOD */}
          {canEdit && ['DRAFT', 'REWORK'].includes(row.status || 'DRAFT') && (
            <>
              <Button size="small" icon={<Edit3 size={12} />} onClick={() => openEditStp(row)}>Edit</Button>
              <Button size="small" type="primary" icon={<Send size={12} />}
                onClick={() => handleSubmitForApprovalStp(row)}
                style={{ background: '#d97706', borderColor: '#d97706' }}>Submit</Button>
              <Popconfirm title="Delete this STP?" onConfirm={() => handleDeleteStp(row.id)}>
                <Button size="small" danger icon={<Trash2 size={12} />} />
              </Popconfirm>
            </>
          )}

          {/* Approval Required status: Locked for HOD approval or return decision */}
          {row.status === 'APPROVAL_REQUIRED' && (
            <>
              <Button size="small" icon={<Eye size={12} />} onClick={() => setViewStp(row)}>View</Button>
              {canApproveStp && (
                <>
                  <Tooltip title={row.submittedBy === user?.username ? 'You cannot approve your own submission' : undefined}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<ShieldCheck size={12} />}
                      onClick={() => setEsignStp(row)}
                      disabled={row.submittedBy === user?.username}
                      loading={stpApproveMut.isPending}
                      style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                    >
                      Approve
                    </Button>
                  </Tooltip>
                  <Popconfirm title="Return this STP to the author?" onConfirm={() => handleReturnStp(row)}>
                    <Button size="small" icon={<RotateCcw size={12} />} loading={stpReturnMut.isPending}>Return</Button>
                  </Popconfirm>
                </>
              )}
            </>
          )}

          {/* Active or Superseded status: Read-only View & Revise */}
          {['ACTIVE', 'SUPERSEDED'].includes(row.status) && (
            <>
              <Button size="small" icon={<Eye size={12} />} onClick={() => setViewStp(row)}>View</Button>
              {canEdit && row.status === 'ACTIVE' && (
                <Popconfirm title="Create new draft revision of this STP?" onConfirm={() => handleReviseStp(row)}>
                  <Button size="small" icon={<Plus size={12} />}>Revise</Button>
                </Popconfirm>
              )}
            </>
          )}
        </div>
      ),
    },
  ]

  const tabItems = [

          // ── Details ──────────────────────────────────────────────────────────
          {
            key: 'details',
            label: 'Details',
            children: (
              <div className="pb-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Customer / Sponsor</p>
                    <Input value={customer} onChange={e => setCustomer(e.target.value)}
                      disabled={!canEdit} placeholder="Customer / Sponsor" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Project Type</p>
                    <Select value={projectType || undefined} onChange={v => setProjectType(v)} disabled={!canEdit}
                      allowClear placeholder="Select type" className="w-full"
                      options={['ANALYSIS', 'DEVELOPMENT', 'STABILITY', 'QC'].map(v => ({ value: v, label: v }))} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Target Date</p>
                    <DatePicker value={targetDate} onChange={v => setTargetDate(v)} disabled={!canEdit}
                      className="w-full" format="YYYY-MM-DD" allowClear />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Description</p>
                  <TextArea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                    disabled={!canEdit} placeholder="Project scope, objectives..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Created By</p>
                    <Input value={data.createdBy || 'superadmin'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Created At</p>
                    <Input value={data.createdAt ? dayjs(data.createdAt).format('DD MMM YYYY') : '—'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                  </div>
                </div>
                {canEdit && (
                  <div className="flex justify-end pt-2">
                    <Button
                      type="primary"
                      size="middle"
                      loading={saveMut.isPending}
                      onClick={() => saveMut.mutate({
                        body: { description, customer, projectType, targetDate: targetDate?.format('YYYY-MM-DD') ?? '', ownerName },
                        successMsg: 'Project details saved successfully.',
                      })}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-medium border-none px-5"
                    >
                      Save Details
                    </Button>
                  </div>
                )}
              </div>
            ),
          },

          // ── Team ──────────────────────────────────────────────────────────────
          {
            key: 'team',
            label: `Team (${teamMembers.length})`,
            children: (
              <div className="pb-5 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                      <Users size={16} className="text-indigo-600" /> Project Team & Role Assignments
                    </h3>
                    <p className="text-xs text-slate-400">Assigned Group Leaders, Team Leads, and Analysts</p>
                  </div>
                  {canEdit && (
                    <Button icon={<UserPlus size={13} />} onClick={openTeamModal}>
                      Assign Team Members
                    </Button>
                  )}
                </div>

                {teamMembers.length === 0 ? (
                  <Empty description="No team members assigned to this project yet." className="py-8" />
                ) : (
                  <Table
                    rowKey={(r) => r.userId || r.userName}
                    dataSource={teamMembers}
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'User Name', dataIndex: 'userName', render: (v) => <span className="font-semibold text-slate-700">{v}</span> },
                      { title: 'Role', dataIndex: 'role', render: (v) => (
                        <Tag color={v === 'HOD' ? 'gold' : v === 'GL' ? 'purple' : v === 'TL' ? 'blue' : 'geekblue'}>{v}</Tag>
                      )},
                      ...(canEdit ? [{
                        title: '',
                        dataIndex: 'userName',
                        key: 'remove',
                        width: 40,
                        render: (_: any, row: any) => (
                          <Popconfirm
                            title={`Remove ${row.userName} from the project team?`}
                            onConfirm={() => {
                              const updated = teamMembers.filter(m => m.userName !== row.userName)
                              setTeamMembers(updated)
                              saveMut.mutate({ body: { team: updated }, successMsg: `${row.userName} removed from team.` })
                            }}
                          >
                            <Button type="text" danger size="small" icon={<Trash2 size={13} />} />
                          </Popconfirm>
                        ),
                      }] : []),
                    ]}
                  />
                )}
              </div>
            ),
          },

          // ── STP ──────────────────────────────────────────────────────────────
          {
            key: 'stp',
            label: `STP (${data.stpDocuments?.length ?? 0})`,
            children: (
              <div className="pb-5">
                {(data.stpDocuments?.length ?? 0) === 0 ? (
                  <Empty description="No STP documents yet" className="py-8" />
                ) : (
                  <Table dataSource={data.stpDocuments} columns={stpCols}
                    rowKey="id" pagination={false} size="small" className="mb-3" scroll={{ x: 'max-content' }} />
                )}
                {canEdit && (
                  <Button type="dashed" icon={<Plus size={13} />} onClick={openCreateStp}>
                    Add STP document
                  </Button>
                )}
              </div>
            ),
          },

          // ── Notebooks ────────────────────────────────────────────────────────
          {
            key: 'notebooks',
            label: `Notebooks (${notebooksData?.items?.length ?? 0})`,
            children: (
              <div className="pb-5 space-y-3">
                {!['ANALYST', 'CHEMIST', 'CHEM'].includes((user?.role_code || '').toUpperCase()) && (
                  <div className="flex justify-end">
                    <Button icon={<Plus size={13} />} onClick={() => { setNotebookName(''); setNotebookDescription(''); setNotebookModalOpen(true) }} loading={createNotebook.isPending}>
                      New Notebook
                    </Button>
                  </div>
                )}
                {(notebooksData?.items?.length ?? 0) === 0 ? (
                  <Empty description="No notebooks in this project" className="py-8" />
                ) : (
                  <Table
                    rowKey="id"
                    dataSource={notebooksData?.items ?? []}
                    onRow={r => ({ onClick: () => navigate(`/ard/notebooks/${r.id}`), className: 'cursor-pointer' })}
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'Code', dataIndex: 'code', width: 160, render: v => <span className="font-mono text-xs">{v}</span> },
                      { title: 'Name', dataIndex: 'name', render: (v) => (
                        <span className="flex items-center gap-2 font-medium text-slate-700"><BookOpen size={14} className="text-violet-500" />{v}</span>
                      )},
                      { title: 'Type', dataIndex: 'notebookType', width: 160, render: v => v?.replace(/_/g, ' ') ?? '—' },
                      { title: 'Status', dataIndex: 'status', width: 100, render: (v: string) => (
                        <Tag color={v === 'OPEN' ? 'green' : 'default'}>{v}</Tag>
                      )},
                      { title: 'Created', dataIndex: 'createdAt', width: 130, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
                      {
                        title: '',
                        width: 90,
                        render: (_: unknown, r: Notebook) => r.status !== 'OPEN' && canEdit ? (
                          <Button
                            size="small"
                            icon={<Unlock size={12} />}
                            onClick={e => { e.stopPropagation(); setReopenNotebookId(r.id); setReopenRemarks('') }}
                            loading={reopenNotebookMut.isPending && reopenNotebookId === r.id}
                          >
                            Reopen
                          </Button>
                        ) : null,
                      },
                    ]}
                  />
                )}
              </div>
            ),
          },

          // ── Attributes ───────────────────────────────────────────────────────
          {
            key: 'attributes',
            label: `Attributes (${attributes.length})`,
            children: (
              <div className="pb-5 space-y-3">
                {attributes.length === 0 ? (
                  <Empty description="No custom attributes" className="py-8" />
                ) : (
                  <Table
                    dataSource={attributes}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    className="mb-3"
                    columns={[
                      { title: 'Attribute Name', dataIndex: 'key', render: (v, _, i) => (
                        <Input size="small" value={v} disabled={!canEdit}
                          onChange={e => { const u = [...attributes]; u[i] = { ...u[i], key: e.target.value, updatedBy: user?.username, updatedAt: new Date().toISOString() }; setAttributes(u) }} />
                      )},
                      { title: 'Type', dataIndex: 'type', width: 130, render: (v, _, i) => (
                        <Select size="small" value={v || undefined} disabled={!canEdit} allowClear placeholder="Select type"
                          style={{ width: '100%' }}
                          onChange={val => { const u = [...attributes]; u[i] = { ...u[i], type: val, updatedBy: user?.username, updatedAt: new Date().toISOString() }; setAttributes(u) }}
                          options={['Text', 'Number', 'Date', 'Boolean', 'URL'].map(t => ({ value: t, label: t }))} />
                      )},
                      { title: 'Value', dataIndex: 'value', render: (v, _, i) => (
                        <Input size="small" value={v} disabled={!canEdit}
                          onChange={e => { const u = [...attributes]; u[i] = { ...u[i], value: e.target.value, updatedBy: user?.username, updatedAt: new Date().toISOString() }; setAttributes(u) }} />
                      )},
                      { title: 'Created By / On', key: 'createdBy', width: 140, render: (_: unknown, row: any) => (
                        <div className="text-xs text-slate-500">
                          <div>{row.createdBy || '—'}</div>
                          {row.createdAt && <div className="text-[11px]">{dayjs(row.createdAt).format('DD-MMM-YY HH:mm')}</div>}
                        </div>
                      )},
                      { title: 'Updated By / On', key: 'updatedBy', width: 140, render: (_: unknown, row: any) => (
                        <div className="text-xs text-slate-500">
                          <div>{row.updatedBy || '—'}</div>
                          {row.updatedAt && <div className="text-[11px]">{dayjs(row.updatedAt).format('DD-MMM-YY HH:mm')}</div>}
                        </div>
                      )},
                      ...(canEdit ? [{
                        title: '', width: 40, render: (_: unknown, __: unknown, i: number) => (
                          <Popconfirm title="Remove this attribute?" onConfirm={() => saveAttributes(attributes.filter((_, j) => j !== i), true)}>
                            <Button type="text" danger size="small" icon={<Trash2 size={13} />} />
                          </Popconfirm>
                        ),
                      }] : []),
                    ]}
                  />
                )}
                {canEdit && (
                  <div className="flex gap-2">
                    <Button type="dashed" size="small" icon={<Plus size={13} />}
                      onClick={() => setAttributes([...attributes, { id: newStpId(), key: '', type: '', value: '', createdBy: user?.username || '', createdAt: new Date().toISOString() }])}>
                      Add attribute
                    </Button>
                    {attributes.length > 0 && (
                      <Button size="small" onClick={() => saveAttributes(attributes)}
                        loading={saveMut.isPending}>
                        Save Attributes
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ),
          },

          // ── Specifications ───────────────────────────────────────────────────
          {
            key: 'specifications',
            label: 'Specifications',
            children: (
              <div className="pb-4">
                <ProjectSpecificationsPanel projectId={data.id} readOnly={!canEdit} />
              </div>
            ),
          },

          // ── Attachments ──────────────────────────────────────────────────────
          {
            key: 'attachments',
            label: 'Attachments',
            children: (
              <div className="pb-4">
                <ArdAttachmentsPanel entityType="project" entityId={data.id} readOnly={!canEdit} />
              </div>
            ),
          },

          // ── Project Events ───────────────────────────────────────────────────
          {
            key: 'audit',
            label: 'Project Events',
            children: (
              <div className="pb-5 space-y-4">

                {/* Filter Controls Bar */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-1 font-semibold text-slate-700">
                    <Filter size={13} className="text-slate-500" /> Filter Log:
                  </div>
                  <Select
                    allowClear
                    placeholder="Event Action"
                    style={{ width: 170 }}
                    size="small"
                    options={auditActionOptions}
                    value={auditAction}
                    onChange={setAuditAction}
                  />
                  <Select
                    allowClear
                    placeholder="User / Actor"
                    style={{ width: 170 }}
                    size="small"
                    options={auditUserOptions}
                    value={auditUser}
                    onChange={setAuditUser}
                  />
                  <DatePicker.RangePicker
                    size="small"
                    allowEmpty={[true, true]}
                    value={auditDateRange}
                    onChange={(range) => setAuditDateRange(range as [Dayjs | null, Dayjs | null] | null)}
                  />
                  <Button size="small" type="primary" style={{ background: '#7c3aed' }}>
                    Show Events
                  </Button>
                  {(auditAction || auditUser || auditDateRange) && (
                    <Button
                      size="small"
                      onClick={() => {
                        setAuditAction(undefined)
                        setAuditUser(undefined)
                        setAuditDateRange(null)
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>

                {filteredAuditTrail.length === 0 ? (
                  <Empty description="No audit log entries found matching criteria." className="py-8" />
                ) : (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={filteredAuditTrail}
                    columns={[
                      {
                        title: 'Timestamp',
                        dataIndex: 'createdAt',
                        width: 170,
                        render: (v) => <span className="font-mono text-slate-500 text-xs">{dayjs(v).format('DD-MMM-YYYY HH:mm:ss')}</span>,
                      },
                      {
                        title: 'Action',
                        dataIndex: 'action',
                        width: 180,
                        render: (v: string) => {
                          const act = (v || '').toUpperCase()
                          let color = 'blue'
                          if (act.includes('CREATE')) color = 'green'
                          else if (act.includes('APPROV') || act.includes('SIGN')) color = 'emerald'
                          else if (act.includes('CLOSE')) color = 'volcano'
                          else if (act.includes('DEACTIVAT') || act.includes('DELETE')) color = 'red'
                          else if (act.includes('REOPEN') || act.includes('REWORK')) color = 'purple'
                          return <Tag color={color} className="font-semibold text-xs">{v}</Tag>
                        },
                      },
                      {
                        title: 'Actor / User',
                        dataIndex: 'actorName',
                        width: 140,
                        render: (v) => <span className="font-semibold text-slate-700">{v || 'System'}</span>,
                      },
                      {
                        title: 'Details',
                        dataIndex: 'detail',
                        render: (v) => v ? <span className="text-slate-600">{v}</span> : <span className="text-slate-400">—</span>,
                      },
                    ]}
                  />
                )}
              </div>
            ),
          },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      {ctx}

      {/* Top Header */}
      <div className="glass-card p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('/ard/projects')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-600 mb-1 transition-colors">
            <ArrowLeft size={13} /> Back to Projects
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <FolderOpen size={22} className="text-violet-600 shrink-0" />
            <h1 className="text-xl font-bold text-slate-800 font-mono tracking-tight">{data.code}</h1>
            <span className="text-slate-400">•</span>
            <span className="text-base font-semibold text-slate-700">{data.productName}</span>
            <Tag color={data.status === 'OPEN' ? 'green' : 'default'} className="font-semibold">
              {data.status}
            </Tag>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            size="middle"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'tabbed' | 'single')}
            options={[
              { label: 'Tabbed View', value: 'tabbed', icon: <LayoutList size={14} className="inline mr-1" /> },
              { label: 'Single Page View', value: 'single', icon: <FileText size={14} className="inline mr-1" /> },
            ]}
          />
          {data.status === 'OPEN' && (
            <>
              <Button icon={<Lock size={14} />} onClick={() => setEsignProjectAction('close')} loading={closeMut.isPending}>Close Project</Button>
              <Button danger icon={<Trash2 size={14} />} onClick={() => setEsignProjectAction('deactivate')} loading={deactivateMut.isPending}>Deactivate Project</Button>
            </>
          )}
          {data.status !== 'OPEN' && (
            <Button icon={<Unlock size={14} />} onClick={() => setEsignProjectAction('reopen')} loading={reopenMut.isPending}>
              Reopen Project
            </Button>
          )}
          {!['ANALYST', 'CHEMIST', 'CHEM'].includes((user?.role_code || '').toUpperCase()) && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setNotebookName(''); setNotebookDescription(''); setNotebookModalOpen(true) }}>
              New Notebook
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'tabbed' ? (
        <div className="glass-card rounded-lg overflow-hidden">
          <Tabs className="px-4 pt-2" destroyInactiveTabPane={false} items={tabItems} />
        </div>
      ) : (
        <div className="space-y-6">
          {tabItems.map((tab) => (
            <Card
              key={tab.key}
              title={<span className="font-bold text-slate-800 text-base">{tab.label}</span>}
              className="rounded-lg overflow-hidden"
            >
              {tab.children}
            </Card>
          ))}
        </div>
      )}

      {/* Team Edit Modal */}
      <Modal
        {...glassModalProps}
        title="Assign Team Members"
        open={teamModalOpen}
        okText="Save Team Assignments"
        cancelText="Cancel"
        onCancel={() => {
          setTeamModalOpen(false)
          setSelectedBatchUsers([])
          setAddMode('users')
          setAddTeamSel(null)
          setTeamRoleFilter(undefined)
          setMyTeamOnly(false)
          setNotebookSyncIds([])
        }}
        onOk={handleSaveTeam}
        confirmLoading={saveMut.isPending}
        width={620}
      >
        <div className="space-y-4 pt-2">
          {/* Add mode toggle */}
          <div className="space-y-2">
            <Segmented
              block
              value={addMode}
              onChange={(v) => {
                setAddMode(v as 'users' | 'team')
                setSelectedBatchUsers([])
                setAddTeamSel(null)
              }}
              options={[
                { label: <span className="flex items-center justify-center gap-1.5"><UserPlus size={13} />Add Users</span>, value: 'users' },
                { label: <span className="flex items-center justify-center gap-1.5"><Users size={13} />Add Team</span>, value: 'team' },
              ]}
            />

            {addMode === 'users' ? (
              <div className="bg-indigo-50/70 p-3 rounded-lg border border-indigo-100 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Select
                    allowClear
                    placeholder="Select User Role"
                    style={{ width: 160 }}
                    value={teamRoleFilter}
                    onChange={v => { setTeamRoleFilter(v); setSelectedBatchUsers([]) }}
                    options={['ANALYST', 'CHEMIST', 'TL', 'HOD', 'GL', 'QA', 'SUPER_ADMIN'].map(r => ({ value: r, label: r }))}
                  />
                  {role === 'TL' && teamRoleFilter === 'ANALYST' && (
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input type="checkbox" checked={myTeamOnly} onChange={e => setMyTeamOnly(e.target.checked)} className="rounded" />
                      My Team only
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <Select
                    mode="multiple"
                    showSearch
                    optionFilterProp="label"
                    className="flex-1 text-xs"
                    placeholder={teamRoleFilter ? `Search ${teamRoleFilter} users...` : 'Search & select users...'}
                    value={selectedBatchUsers}
                    options={filteredDbUserOptions}
                    onChange={setSelectedBatchUsers}
                    maxTagCount="responsive"
                  />
                  <Button
                    type="primary"
                    icon={<UserPlus size={14} />}
                    disabled={!selectedBatchUsers.length}
                    onClick={handleBatchAddUsers}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-none shrink-0"
                  >
                    Add Selected
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-violet-50/70 p-3 rounded-lg border border-violet-100 space-y-2">
                <div className="flex gap-2">
                  <Select
                    showSearch
                    allowClear
                    optionFilterProp="label"
                    className="flex-1 text-xs"
                    placeholder="Select a team to add all members..."
                    value={addTeamSel}
                    onChange={setAddTeamSel}
                    options={(teamDirData?.items ?? [])
                      .filter((t: any) => t.active !== false)
                      .map((t: any) => ({ value: t.id, label: t.teamName }))}
                  />
                  <Button
                    type="primary"
                    icon={<Users size={14} />}
                    disabled={!addTeamSel}
                    onClick={() => {
                      const team = (teamDirData?.items ?? []).find((t: any) => t.id === addTeamSel)
                      if (!team) return
                      const existingIds = new Set(draftTeamMembers.map(m => m.userId).filter(Boolean))
                      const existingNames = new Set(draftTeamMembers.map(m => m.userName).filter(Boolean))
                      const isDup = (id: string, name: string) => existingIds.has(id) || existingNames.has(name)
                      const newMembers: ProjectTeamMember[] = []

                      if (team.hodName && team.hodName !== '—') {
                        const hodId = team.hodId || team.hodName
                        if (!isDup(hodId, team.hodName)) {
                          newMembers.push({ userName: team.hodName, userId: hodId, role: 'HOD' })
                          existingIds.add(hodId)
                          existingNames.add(team.hodName)
                        }
                      }

                      for (const tl of (team.tls ?? [])) {
                        const tlName = tl.name || tl.id
                        if (!isDup(tl.id, tlName)) {
                          newMembers.push({ userName: tlName, userId: tl.id, role: 'TL' })
                          existingIds.add(tl.id)
                          existingNames.add(tlName)
                        }
                        for (const analyst of (tl.analysts ?? [])) {
                          const uname = analyst.username || analyst.name || analyst.id
                          if (!isDup(analyst.id, uname)) {
                            newMembers.push({ userName: uname, userId: analyst.id, role: 'ANALYST' })
                            existingIds.add(analyst.id)
                            existingNames.add(uname)
                          }
                        }
                      }
                      if (newMembers.length > 0) {
                        setDraftTeamMembers([...draftTeamMembers, ...newMembers])
                        msgApi.success(`Added ${newMembers.length} member(s) from "${team.teamName}". Click Save to apply.`)
                      } else {
                        msgApi.info('All team members are already in the list.')
                      }
                      setAddTeamSel(null)
                    }}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-medium border-none shrink-0"
                  >
                    Add Team
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start justify-between pt-1 gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Team Members ({draftTeamMembers.length})
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-600 font-medium">Grant notebook access:</span>
              <Select
                mode="multiple"
                allowClear
                maxTagCount={2}
                size="small"
                placeholder="All notebooks (default)"
                style={{ minWidth: 220 }}
                value={notebookSyncIds}
                onChange={setNotebookSyncIds}
                options={(notebooksData?.items ?? []).map(nb => ({ value: nb.id, label: nb.name }))}
              />
            </div>
          </div>

          {draftTeamMembers.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No team members assigned. Use the options above to add users or a team.
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {draftTeamMembers.map((member, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="col-span-8 flex items-center gap-2">
                    <span className="font-semibold text-slate-800 text-xs">{member.userName}</span>
                    {member.userId && <span className="text-[11px] text-slate-400">({member.userId})</span>}
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <Tag color={member.role === 'HOD' ? 'gold' : member.role === 'GL' ? 'purple' : member.role === 'TL' ? 'blue' : 'geekblue'} className="font-medium">
                      {member.role || 'ANALYST'}
                    </Tag>
                  </div>
                  <Button
                    type="text"
                    danger
                    size="small"
                    className="col-span-1 p-0 flex items-center justify-center"
                    icon={<Trash2 size={13} />}
                    onClick={() => setDraftTeamMembers(draftTeamMembers.filter((_, i) => i !== idx))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* STP View Modal */}
      <Modal
        {...glassModalProps}
        title={`STP Document Details — ${viewStp?.documentNo}`}
        open={!!viewStp}
        onCancel={() => setViewStp(null)}
        footer={[
          <Button key="close" onClick={() => setViewStp(null)}>Close</Button>
        ]}
        width={550}
      >
        {viewStp && (
          <div className="space-y-3 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Document No.</span>
                <span className="font-mono font-bold text-slate-800 text-sm">{viewStp.documentNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Version</span>
                <span className="font-mono font-bold text-slate-800 text-sm">v{viewStp.version}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Status</span>
                <Tag color={STP_STATUS_COLOR[viewStp.status]}>{viewStp.status}</Tag>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Submitted By</span>
                <span className="text-slate-700">{viewStp.submittedBy || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Approved By</span>
                <span className="font-semibold text-slate-700">{viewStp.approvedBy || '—'}</span>
              </div>
            </div>
            {viewStp.returnReason && (
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px] mb-1">Return Reason</span>
                <div className="p-2 bg-orange-50 rounded border border-orange-200 text-orange-800 text-sm">{viewStp.returnReason}</div>
              </div>
            )}
            <div>
              <span className="text-slate-400 block font-semibold uppercase text-[10px] mb-1">Title</span>
              <div className="p-2 bg-white rounded border border-slate-200 font-semibold text-slate-800">{viewStp.title}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">STP Type</span>
                <span>{viewStp.stpType || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">STP Grade</span>
                <span>{viewStp.stpGrade || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Specification No.</span>
                <span>{viewStp.specificationNo || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Test Type</span>
                <span>{viewStp.testType || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Test Subtype</span>
                <span>{viewStp.testSubtype || '—'}</span>
              </div>
            </div>
            {(viewStp.weighingDetails || viewStp.phDetails || viewStp.columnDetails) && (
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px] mb-1">Details Included</span>
                <div className="flex gap-2 flex-wrap">
                  {viewStp.weighingDetails && <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] px-2 py-0.5 rounded font-medium">Weighing</span>}
                  {viewStp.phDetails && <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] px-2 py-0.5 rounded font-medium">pH</span>}
                  {viewStp.columnDetails && <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] px-2 py-0.5 rounded font-medium">Column</span>}
                </div>
              </div>
            )}
            {viewStp.description && (
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px] mb-1">Description</span>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">{viewStp.description}</div>
              </div>
            )}
            {viewStp.scope && (
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px] mb-1">Scope</span>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">{viewStp.scope}</div>
              </div>
            )}
            {viewStp.remarks && (
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px] mb-1">Remarks / Signature Log</span>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-600">{viewStp.remarks}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* STP E-Signature Approval Modal */}
      {esignStp && (
        <ESignatureModal
          open={!!esignStp}
          title={`STP Approval — ${esignStp.documentNo}`}
          description={`Re-enter password credentials to digitally sign and approve ${esignStp.documentNo} (v${esignStp.version}).`}
          userName={user?.username || 'superadmin'}
          requireReason
          reasonLabel="Reason for Approval"
          onCancel={() => setEsignStp(null)}
          onConfirm={(payload) => handleApproveStpWithEsign(esignStp, payload.reason)}
        />
      )}

      {/* STP create/edit modal */}
      <Modal
        {...glassModalProps}
        title={editingStp ? `Edit STP — ${editingStp.documentNo}` : 'Add STP Document'}
        open={stpModalOpen}
        onCancel={() => { setStpModalOpen(false); stpForm.resetFields() }}
        onOk={() => stpForm.validateFields().then(handleStpSubmit)}
        confirmLoading={saveMut.isPending}
        width={600}
      >
        <Form form={stpForm} layout="vertical" className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="documentNo" label="Document No." rules={[{ required: true }]} className="col-span-1">
              <Input placeholder="e.g. STP-ARD-001" />
            </Form.Item>
            <Form.Item name="version" label="Version" initialValue="1.0" className="col-span-1">
              <Input placeholder="1.0" />
            </Form.Item>
            <Form.Item name="title" label="STP Name" rules={[{ required: true }]} className="col-span-1 sm:col-span-2">
              <Input placeholder="Standard Test Procedure title" />
            </Form.Item>
            <Form.Item name="stpType" label="STP Type" className="col-span-1">
              <Select allowClear placeholder="Select STP Type"
                options={['Compendial', 'Non-Compendial', 'In-House', 'Pharmacopoeial'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="stpGrade" label="STP Grade" className="col-span-1">
              <Select allowClear placeholder="Select Grade"
                options={['Pharmaceutical', 'Analytical', 'Research', 'Industrial'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="specificationNo" label="Specification No." className="col-span-1">
              <Input placeholder="e.g. SPEC-ARD-001" />
            </Form.Item>
            <Form.Item name="testType" label="Test Type" className="col-span-1">
              <Select showSearch optionFilterProp="label" allowClear placeholder="Select Test Type" options={testTypeOptions} />
            </Form.Item>
            <Form.Item name="testSubtype" label="Test Subtype" className="col-span-1">
              <Select showSearch optionFilterProp="label" allowClear placeholder="Select Test Subtype" options={testSubtypeOptions} />
            </Form.Item>
            <Form.Item name="effectiveDate" label="Effective Date" className="col-span-1">
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="description" label="Description" className="col-span-1 sm:col-span-2">
              <TextArea rows={2} placeholder="Brief description of this STP..." />
            </Form.Item>
            <Form.Item name="scope" label="Scope" className="col-span-1 sm:col-span-2">
              <TextArea rows={2} placeholder="Describe scope of this STP..." />
            </Form.Item>
          </div>
          <div className="grid grid-cols-3 gap-x-4 mb-2">
            <Form.Item name="weighingDetails" label=" " valuePropName="checked" className="col-span-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-sm text-slate-700">Weighing Details</span>
              </label>
            </Form.Item>
            <Form.Item name="phDetails" label=" " valuePropName="checked" className="col-span-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-sm text-slate-700">pH Details</span>
              </label>
            </Form.Item>
            <Form.Item name="columnDetails" label=" " valuePropName="checked" className="col-span-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-sm text-slate-700">Column Details</span>
              </label>
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            <Form.Item name="sampleMappingFile" label="Sample Mapping (ref.)" className="col-span-1">
              <Input placeholder="Document reference or file name" />
            </Form.Item>
            <Form.Item name="stpProcedureFile" label="STP Procedure (ref.)" className="col-span-1">
              <Input placeholder="Document reference or file name" />
            </Form.Item>
            <Form.Item name="stpCalculationFile" label="STP Calculation (ref.)" className="col-span-1">
              <Input placeholder="Document reference or file name" />
            </Form.Item>
          </div>
          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={2} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Notebook creation modal */}
      <Modal
        {...glassModalProps}
        title={<span className="font-bold text-slate-800 text-base">Create New Notebook</span>}
        open={notebookModalOpen}
        onCancel={() => setNotebookModalOpen(false)}
        onOk={() => {
          if (notebookName.trim()) {
            createNotebook.mutate({ name: notebookName.trim(), description: notebookDescription.trim() || undefined })
            setNotebookModalOpen(false)
            setNotebookDescription('')
          }
        }}
        confirmLoading={createNotebook.isPending}
        okText="Create Notebook"
        cancelText="Cancel"
        okButtonProps={{ className: 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-none' }}
        width={520}
      >
        <div className="pt-4 pb-2 space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Notebook Name <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="e.g. Method Validation Notebook"
            value={notebookName}
            onChange={(e) => setNotebookName(e.target.value)}
            className="py-2 text-sm rounded-lg"
            onPressEnter={() => {
              if (notebookName.trim()) {
                createNotebook.mutate({ name: notebookName.trim(), description: notebookDescription.trim() || undefined })
                setNotebookModalOpen(false)
                setNotebookDescription('')
              }
            }}
          />
          <label className="block text-xs font-semibold text-slate-700 mt-3">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <Input.TextArea
            placeholder="Brief description of this notebook's purpose..."
            rows={2}
            value={notebookDescription}
            onChange={e => setNotebookDescription(e.target.value)}
            className="mt-1 text-sm rounded-lg"
          />
          <p className="text-xs text-slate-400 mt-2">
            This notebook will be linked to the current project and assigned to the project team.
          </p>
        </div>
      </Modal>

      {/* Notebook Reopen Modal */}
      <Modal
        {...glassModalProps}
        title="Reopen Notebook"
        open={!!reopenNotebookId}
        onCancel={() => { setReopenNotebookId(null); setReopenRemarks('') }}
        onOk={() => {
          if (reopenNotebookId && reopenRemarks.trim()) {
            reopenNotebookMut.mutate({ id: reopenNotebookId, remarks: reopenRemarks.trim() })
          }
        }}
        okText="Reopen Notebook"
        confirmLoading={reopenNotebookMut.isPending}
        okButtonProps={{ disabled: !reopenRemarks.trim() }}
        width={480}
      >
        <div className="pt-3 pb-2 space-y-3">
          <p className="text-sm text-slate-600">Please provide a reason for reopening this notebook.</p>
          <Input.TextArea
            rows={3}
            placeholder="Reason for reopening..."
            value={reopenRemarks}
            onChange={e => setReopenRemarks(e.target.value)}
          />
        </div>
      </Modal>

      {/* STP Submit for Approval Modal */}
      <Modal
        {...glassModalProps}
        title={`Submit STP for Approval — ${submitStpItem?.documentNo}`}
        open={submitStpOpen}
        onCancel={() => { setSubmitStpOpen(false); setSubmitStpItem(null); submitStpForm.resetFields() }}
        onOk={() => submitStpForm.validateFields().then(vals => {
          if (!submitStpItem) return
          stpSubmitMut.mutate({ stpId: submitStpItem.id, approverUsername: vals.approverUsername, description: vals.submitDescription })
        })}
        confirmLoading={stpSubmitMut.isPending}
        okText="Submit for Approval"
        width={500}
      >
        <Form form={submitStpForm} layout="vertical" className="pt-2">
          <Form.Item name="approverUsername" label="Select Approver" rules={[{ required: true, message: 'Please select an approver' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select approver (HOD / QA)"
              options={dbUserOptions.filter((o: any) => ['HOD', 'QA', 'QC_MANAGER', 'SUPER_ADMIN'].includes(o.role?.toUpperCase() || ''))}
            />
          </Form.Item>
          <Form.Item name="submitDescription" label="Description / Remarks">
            <TextArea rows={3} placeholder="Reason for submission or additional notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Project Status E-Signature Modal */}
      {esignProjectAction && (
        <ESignatureModal
          open={!!esignProjectAction}
          title={`${esignProjectAction === 'close' ? 'Close Project' : esignProjectAction === 'deactivate' ? 'Deactivate Project' : 'Reopen Project'} (E-Signature Confirmation)`}
          description="Electronic signature & mandatory business justification are required to change project status."
          userName={user?.username || 'user'}
          requireReason={true}
          reasonLabel="Mandatory Business Justification Remarks"
          loading={closeMut.isPending || deactivateMut.isPending || reopenMut.isPending}
          onCancel={() => setEsignProjectAction(null)}
          onConfirm={async (payload) => {
            const body = { password: payload.password, reason: payload.reason, remarks: payload.reason }
            if (esignProjectAction === 'close') {
              await closeMut.mutateAsync(body)
            } else if (esignProjectAction === 'deactivate') {
              await deactivateMut.mutateAsync(body)
            } else if (esignProjectAction === 'reopen') {
              await reopenMut.mutateAsync(body)
            }
            setEsignProjectAction(null)
          }}
        />
      )}
    </div>
  )
}
