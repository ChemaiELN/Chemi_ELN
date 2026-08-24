import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBreadcrumbLabel } from '../../components/layout/ArdShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Tabs, Input, InputNumber, Tag, Spin, Alert, Modal, Table, Select,
  Typography, Empty, Popconfirm, message, Form, DatePicker, Card, Tooltip, Space, Steps, Segmented, Upload
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import {
  ArrowLeft, FolderOpen, Plus, Trash2, CheckCircle2,
  RotateCcw, Edit3, Lock, Unlock, BookOpen, Send, Users, ShieldCheck, Eye, Calendar, Filter, UserPlus, LayoutList, FileText, Paperclip
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

const NOTEBOOK_TYPE_OPTIONS = [
  { value: 'STP_TEMPLATE', label: 'STP Worksheets' },
  { value: 'ANALYTICAL', label: 'Method Development' },
  { value: 'METHOD_VALIDATION', label: 'Method Validation' },
  { value: 'ROUTINE_ANALYSIS', label: 'Routine Analysis' },
  { value: 'CALIBRATION', label: 'Calibration' },
  { value: 'OTHER', label: 'Others' },
]

function newStpId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function supersedePrevious(stps: ProjectStp[], documentNo: string, excludeId: string): ProjectStp[] {
  return stps.map(s =>
    s.documentNo === documentNo && s.id !== excludeId && s.status === 'APPROVED'
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
  const [projectCode, setProjectCode] = useState('')
  const [productName, setProductName] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
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
  const [stpSearch, setStpSearch] = useState('')

  // Team Modal state
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([])
  const [selectedBatchUsers, setSelectedBatchUsers] = useState<string[]>([])
  const [addMode, setAddMode] = useState<'users' | 'team'>('users')
  const [addTeamSel, setAddTeamSel] = useState<string | null>(null)
  const [teamRoleFilter, setTeamRoleFilter] = useState<string | undefined>(undefined)
  const [myTeamOnly, setMyTeamOnly] = useState(false)
  const [draftTeamMembers, setDraftTeamMembers] = useState<ProjectTeamMember[]>([])
  const [notebookAccessOpen, setNotebookAccessOpen] = useState(false)
  const [matrixDraft, setMatrixDraft] = useState<Record<string, string[]>>({})
  const [accessSelectedNbId, setAccessSelectedNbId] = useState<string | null>(null)
  const [nbSearch, setNbSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')

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
  const [notebookTypeSel, setNotebookTypeSel] = useState<string | undefined>(undefined)
  const [notebookTypeOther, setNotebookTypeOther] = useState('')

  // Attributes state
  const [attributes, setAttributes] = useState<ProjectAttribute[]>([])

  const { data, isLoading, error } = useQuery<Project>({
    queryKey: ['ard-project', projectId],
    queryFn: () => ardProjectsApi.get(projectId),
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  })

  useBreadcrumbLabel(projectId, data?.productName || data?.code)

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
    opts = opts.filter((o: any) => !draftTeamMembers.some((m) => m.userId === o.userId || m.userName === o.username))
    return opts
  }, [dbUserOptions, teamRoleFilter, myTeamOnly, teamDirData, role, user, draftTeamMembers])

  const selectedStpTestType = Form.useWatch('testType', stpForm)

  const testTypeOptions = useMemo(() => {
    const types = Array.from(new Set((masterData?.testConfigs ?? []).filter(tc => tc.active).map(tc => tc.testType).filter(Boolean)))
    return types.map(t => ({ value: t, label: t }))
  }, [masterData?.testConfigs])

  const testSubtypeOptions = useMemo(() => {
    const filteredConfigs = selectedStpTestType
      ? (masterData?.testConfigs ?? []).filter(tc => tc.active && tc.testType === selectedStpTestType)
      : (masterData?.testConfigs ?? []).filter(tc => tc.active)
    const subtypes = Array.from(new Set(filteredConfigs.map(tc => tc.testSubtype).filter(Boolean)))
    return (subtypes as string[]).map(st => ({ value: st, label: st }))
  }, [masterData?.testConfigs, selectedStpTestType])

  const createNotebook = useMutation({
    mutationFn: ({ name, description: desc, notebookType }: { name: string; description?: string; notebookType?: string }) =>
      ardNotebooksApi.create({ name, description: desc || null, projectId, notebookType: notebookType || null }),
    onSuccess: (nb: Notebook) => { refetchNotebooks(); navigate(`/ard/notebooks/${nb.id}`) },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Failed to create notebook'),
  })

  function submitNotebookCreate() {
    if (!notebookName.trim() || !notebookTypeSel) return
    const resolvedType = notebookTypeSel === 'OTHER' ? notebookTypeOther.trim() : notebookTypeSel
    if (notebookTypeSel === 'OTHER' && !resolvedType) return
    createNotebook.mutate({ name: notebookName.trim(), description: notebookDescription.trim() || undefined, notebookType: resolvedType })
    setNotebookModalOpen(false)
    setNotebookDescription('')
  }

  useEffect(() => {
    if (!data) return
    setDescription(data.description ?? '')
    setCustomer(data.customer ?? '')
    setProjectType(data.projectType ?? '')
    setProjectCode(data.code ?? '')
    setProductName(data.productName ?? '')
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

  const stpFileFields = ['sampleMappingFile', 'stpProcedureFile', 'stpCalculationFile'] as const

  function fileNameToList(name?: string): UploadFile[] {
    return name ? [{ uid: '-1', name, status: 'done' }] : []
  }

  function openEditStp(stp: ProjectStp) {
    setEditingStp(stp)
    stpForm.setFieldsValue({
      ...stp,
      sampleMappingFile: fileNameToList(stp.sampleMappingFile),
      stpProcedureFile: fileNameToList(stp.stpProcedureFile),
      stpCalculationFile: fileNameToList(stp.stpCalculationFile),
    })
    setStpModalOpen(true)
  }

  function handleStpSubmit(values: Partial<ProjectStp> & Record<string, any>) {
    const normalized: Partial<ProjectStp> = { ...values }
    for (const f of stpFileFields) {
      const list = (values as any)[f] as UploadFile[] | undefined
      normalized[f] = list?.[0]?.name || undefined
    }
    const current = data?.stpDocuments ?? []
    if (editingStp) {
      const updated = current.map(s => s.id === editingStp.id ? { ...s, ...normalized, updatedAt: new Date().toISOString() } : s)
      saveStpList(updated, 'STP document updated successfully.')
    } else {
      const newStp: ProjectStp = {
        id: newStpId(),
        documentNo: normalized.documentNo ?? '',
        title: normalized.title ?? '',
        version: normalized.version ?? '1.0',
        ...normalized,
        status: normalized.status || 'DRAFT',
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

  function openTeamModal() {
    setDraftTeamMembers([...teamMembers])
    setSelectedBatchUsers([])
    setAddMode('users')
    setAddTeamSel(null)
    setTeamRoleFilter(undefined)
    setMyTeamOnly(false)
    setTeamModalOpen(true)
  }

  // Reconciles each notebook's assignedUsers against the project team's intended
  // per-notebook membership, without ever touching non-team assignees or
  // clobbering other notebooks' slices. HOD always gets every notebook; every
  // other member gets NO notebooks by default — access must be explicitly
  // granted via "Notebook Access" (HOD/TL decide who sees what).
  async function syncNotebookAccess(members: ProjectTeamMember[]) {
    const allNotebooks = notebooksData?.items ?? []
    if (allNotebooks.length === 0) return
    try {
      const resolvedIds = (m: ProjectTeamMember) =>
        m.role === 'HOD' ? allNotebooks.map(nb => nb.id) : (m.notebookIds ?? [])
      const projectTeamIds = new Set(members.map(m => m.userId || m.userName))

      for (const nb of allNotebooks) {
        const intended = members.filter(m => resolvedIds(m).includes(nb.id))
        const intendedUsers: AssignedUser[] = intended.map(m => ({
          userId: m.userId || m.userName,
          userName: m.userName,
          role: m.role || 'ANALYST',
        }))
        const keptNonTeamUsers = (nb.assignedUsers ?? []).filter(au => !projectTeamIds.has(au.userId))
        const nextAssigned = [...keptNonTeamUsers, ...intendedUsers]

        const currentIds = new Set((nb.assignedUsers ?? []).map(au => au.userId))
        const nextIds = new Set(nextAssigned.map(au => au.userId))
        const unchanged = currentIds.size === nextIds.size && [...currentIds].every(id => nextIds.has(id))
        if (unchanged) continue

        await ardNotebooksApi.patch(nb.id, { assignedUsers: nextAssigned }).catch(() => {})
      }
      refetchNotebooks()
    } catch { /* ignore */ }
  }

  async function handleSaveTeam() {
    setTeamMembers(draftTeamMembers)
    saveMut.mutate({
      body: { team: draftTeamMembers },
      successMsg: 'Project team members updated successfully.',
    })
    await syncNotebookAccess(draftTeamMembers)
    setTeamModalOpen(false)
    setSelectedBatchUsers([])
  }

  // ── Notebook Access matrix ───────────────────────────────────────────────
  function memberKey(m: ProjectTeamMember) { return m.userId || m.userName }

  function openNotebookAccess() {
    const allNotebooks = notebooksData?.items ?? []
    const allNbIds = allNotebooks.map(nb => nb.id)
    const draft: Record<string, string[]> = {}
    teamMembers.forEach(m => {
      // HOD always shows as fully checked (always has access). Everyone else
      // starts from whichever notebooks actually list them in assignedUsers —
      // the real, backend-enforced grant — rather than project.team[].notebookIds,
      // which is only a UI-side mirror of that and can drift out of sync with it.
      if (m.role === 'HOD') {
        draft[memberKey(m)] = allNbIds
      } else {
        const key = memberKey(m)
        draft[key] = allNotebooks
          .filter(nb => (nb.assignedUsers ?? []).some(au => au.userId === m.userId || au.userName === m.userName))
          .map(nb => nb.id)
      }
    })
    setMatrixDraft(draft)
    setAccessSelectedNbId(notebooksData?.items?.[0]?.id ?? null)
    setNbSearch('')
    setMemberSearch('')
    setNotebookAccessOpen(true)
  }

  function toggleMatrixCell(key: string, nbId: string, checked: boolean) {
    setMatrixDraft(prev => {
      const current = new Set(prev[key] ?? [])
      if (checked) current.add(nbId); else current.delete(nbId)
      return { ...prev, [key]: [...current] }
    })
  }

  function toggleMatrixColumn(nbId: string, checked: boolean) {
    setMatrixDraft(prev => {
      const next = { ...prev }
      teamMembers.filter(m => m.role !== 'HOD').forEach(m => {
        const key = memberKey(m)
        const current = new Set(next[key] ?? [])
        if (checked) current.add(nbId); else current.delete(nbId)
        next[key] = [...current]
      })
      return next
    })
  }

  async function handleSaveNotebookAccess() {
    const updatedMembers = teamMembers.map(m => {
      if (m.role === 'HOD') return m
      // Store exactly what was checked — undefined/empty now means NO access,
      // so a fully-checked member must be stored explicitly, not collapsed.
      return { ...m, notebookIds: matrixDraft[memberKey(m)] ?? [] }
    })
    setTeamMembers(updatedMembers)
    await saveMut.mutateAsync({ body: { team: updatedMembers }, successMsg: 'Notebook access updated successfully.' }).catch(() => {})
    await syncNotebookAccess(updatedMembers)
    setNotebookAccessOpen(false)
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
    if (!isDelete) {
      const invalid = updated.find((a) => !a.key.trim() || !String(a.value ?? '').trim())
      if (invalid) {
        msgApi.warning('Every attribute needs both a name and a value before saving.')
        return
      }
    }
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
          {row.status === 'SUBMITTED' && (
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
          {['APPROVED', 'SUPERSEDED'].includes(row.status) && (
            <>
              <Button size="small" icon={<Eye size={12} />} onClick={() => setViewStp(row)}>View</Button>
              {canEdit && row.status === 'APPROVED' && (
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
                    <p className="text-xs text-slate-500 font-medium mb-1">Project Code</p>
                    <Input value={projectCode} onChange={e => setProjectCode(e.target.value)}
                      disabled={!canEdit} placeholder="Project Code" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Product Name</p>
                    <Input value={productName} onChange={e => setProductName(e.target.value)}
                      disabled={!canEdit} placeholder="Product Name" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Customer / Sponsor</p>
                    <Input value={customer} onChange={e => setCustomer(e.target.value)}
                      disabled={!canEdit} placeholder="Customer / Sponsor" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Project Type</p>
                    <Select value={projectType || undefined} onChange={v => setProjectType(v)} disabled={!canEdit}
                      allowClear placeholder="Select type" className="w-full"
                      options={['ANALYSIS', 'DEVELOPMENT', 'STABILITY', 'QC', 'OTHERS'].map(v => ({ value: v, label: v }))} />
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
                    <p className="text-xs text-slate-500 font-medium mb-1">Created on</p>
                    <Input value={data.createdAt ? dayjs(data.createdAt).format('DD MMM YYYY HH:mm') : '—'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                  </div>
                </div>
                {canEdit && (
                  <div className="flex justify-end pt-2">
                    <Button
                      type="primary"
                      size="middle"
                      loading={saveMut.isPending}
                      onClick={() => saveMut.mutate({
                        body: { description, customer, projectType, targetDate: targetDate?.format('YYYY-MM-DD') ?? '', ownerName, code: projectCode, productName },
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
                    <Space>
                      {teamMembers.length > 0 && (
                        <Button icon={<BookOpen size={13} />} onClick={openNotebookAccess}>
                          Notebook Access
                        </Button>
                      )}
                      <Button icon={<UserPlus size={13} />} onClick={openTeamModal}>
                        Assign Team Members
                      </Button>
                    </Space>
                  )}
                </div>

                {teamMembers.length === 0 ? (
                  <Empty description="No team members assigned to this project yet." className="py-8" />
                ) : (
                  <>
                    <Input.Search
                      placeholder="Search by name or role..."
                      allowClear
                      style={{ width: 280 }}
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      className="mb-2"
                    />
                    <Table
                      rowKey={(r) => r.userId || r.userName}
                      dataSource={teamMembers.filter((m) => {
                        const q = teamSearch.trim().toLowerCase()
                        if (!q) return true
                        return m.userName.toLowerCase().includes(q) || (m.role ?? '').toLowerCase().includes(q)
                      })}
                      pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'] }}
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
                          render: (_: any, row: any) => {
                            const isSelf = row.userId === user?.id || row.userName === user?.username
                            if (isSelf) {
                              return (
                                <Tooltip title="You cannot remove yourself from the project team.">
                                  <Button type="text" size="small" icon={<Trash2 size={13} />} disabled />
                                </Tooltip>
                              )
                            }
                            return (
                              <Popconfirm
                                title={`Remove ${row.userName} from the project team?`}
                                onConfirm={async () => {
                                  const updated = teamMembers.filter(m => m.userName !== row.userName)
                                  setTeamMembers(updated)
                                  saveMut.mutate({ body: { team: updated }, successMsg: `${row.userName} removed from team.` })
                                  // Cascade: also remove from every project notebook's assigned users.
                                  const nbs = notebooksData?.items ?? []
                                  for (const nb of nbs) {
                                    const nextAssigned = (nb.assignedUsers ?? []).filter(
                                      (u: AssignedUser) => u.userId !== row.userId && u.userName !== row.userName,
                                    )
                                    if (nextAssigned.length !== (nb.assignedUsers ?? []).length) {
                                      await ardNotebooksApi.patch(nb.id, { assignedUsers: nextAssigned }).catch(() => {})
                                    }
                                  }
                                  refetchNotebooks()
                                }}
                              >
                                <Button type="text" danger size="small" icon={<Trash2 size={13} />} />
                              </Popconfirm>
                            )
                          },
                        }] : []),
                      ]}
                    />
                  </>
                )}
              </div>
            ),
          },

          // ── STP ──────────────────────────────────────────────────────────────
          {
            key: 'stp',
            label: `STP (${data.stpDocuments?.length ?? 0})`,
            children: (
              <div className="pb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                      <FileText size={16} className="text-indigo-600" /> Standard Test Procedures
                    </h3>
                    <p className="text-xs text-slate-400">Test procedures, versions and approval status for this project</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input.Search
                      placeholder="Search by title, doc no. or test type..."
                      allowClear
                      style={{ width: 260 }}
                      value={stpSearch}
                      onChange={(e) => setStpSearch(e.target.value)}
                    />
                    {canEdit && (
                      <Button
                        type="primary"
                        icon={<Plus size={14} />}
                        onClick={openCreateStp}
                        className="bg-violet-600 hover:bg-violet-700 border-none font-medium"
                      >
                        Add STP
                      </Button>
                    )}
                  </div>
                </div>

                {(data.stpDocuments?.length ?? 0) === 0 ? (
                  <Empty description="No STP documents yet" className="py-8" />
                ) : (
                  <Table
                    dataSource={(data.stpDocuments ?? []).filter((s) => {
                      const q = stpSearch.trim().toLowerCase()
                      if (!q) return true
                      return [s.documentNo, s.title, s.testType].some((v) => (v ?? '').toLowerCase().includes(q))
                    })}
                    columns={stpCols}
                    rowKey="id"
                    pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'] }}
                    size="small"
                    className="rounded-lg overflow-hidden border border-slate-200"
                    scroll={{ x: 'max-content' }}
                  />
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
                {!['ANALYST', 'CHEMIST', 'CHEM'].includes((user?.role_code || '').toUpperCase()) && data.status === 'OPEN' && (
                  <div className="flex justify-end">
                    <Button icon={<Plus size={13} />} onClick={() => { setNotebookName(''); setNotebookDescription(''); setNotebookTypeSel(undefined); setNotebookTypeOther(''); setNotebookModalOpen(true) }} loading={createNotebook.isPending}>
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
                      { title: 'Value', dataIndex: 'value', render: (v, row: any, i) => {
                        const commit = (val: unknown) => {
                          const u = [...attributes]
                          u[i] = { ...u[i], value: String(val ?? ''), updatedBy: user?.username, updatedAt: new Date().toISOString() }
                          setAttributes(u)
                        }
                        if (row.type === 'Number') {
                          return <InputNumber size="small" className="w-full" value={v === '' ? undefined : Number(v)} disabled={!canEdit} onChange={commit} />
                        }
                        if (row.type === 'Date') {
                          return <DatePicker size="small" className="w-full" value={v ? dayjs(v) : null} disabled={!canEdit}
                            onChange={(d) => commit(d ? d.format('YYYY-MM-DD') : '')} />
                        }
                        if (row.type === 'Boolean') {
                          return <Select size="small" className="w-full" value={v || undefined} disabled={!canEdit} allowClear
                            options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]} onChange={commit} />
                        }
                        return <Input size="small" value={v} disabled={!canEdit} onChange={e => commit(e.target.value)} />
                      }},
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
                <ArdAttachmentsPanel entityType="project" entityId={data.id} readOnly={!canEdit} folderLinkEnabled />
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
            <Tag icon={<BookOpen size={12} />} color="blue">
              {notebooksData?.items?.length ?? 0} Notebook{(notebooksData?.items?.length ?? 0) === 1 ? '' : 's'}
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
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setNotebookName(''); setNotebookDescription(''); setNotebookTypeSel(undefined); setNotebookTypeOther(''); setNotebookModalOpen(true) }}>
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
                      // A person listed under a TL's "analysts" bucket (workload
                      // assignment within the ARD team) isn't necessarily an
                      // ANALYST by system role — e.g. a TL can be assigned there
                      // too. Always resolve the real role from the user directory
                      // instead of assuming the bucket name is the role.
                      const roleById = new Map<string, string>(dbUserOptions.map((o: any) => [o.userId, o.role]))

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
                            newMembers.push({ userName: uname, userId: analyst.id, role: roleById.get(analyst.id) || 'ANALYST' })
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
            <span className="text-[11px] text-slate-400">
              New members get no notebook access by default. Use "Notebook Access" (on the Team tab) to grant it.
            </span>
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

      {/* Notebook Access — pick a notebook, then check off its members. Scales
          to any number of notebooks since it's a searchable list, not a grid. */}
      <Modal
        {...glassModalProps}
        title="Notebook Access"
        open={notebookAccessOpen}
        okText="Save Access"
        cancelText="Cancel"
        onCancel={() => setNotebookAccessOpen(false)}
        onOk={handleSaveNotebookAccess}
        confirmLoading={saveMut.isPending}
        width={760}
      >
        {(notebooksData?.items ?? []).length === 0 ? (
          <Empty description="No notebooks in this project yet." className="py-8" />
        ) : (() => {
          const allNotebooks = notebooksData?.items ?? []
          const filteredNotebooks = allNotebooks.filter(nb =>
            nb.name.toLowerCase().includes(nbSearch.trim().toLowerCase())
          )
          const selectedNb = allNotebooks.find(nb => nb.id === accessSelectedNbId) ?? null
          const eligibleMembers = teamMembers.filter(m => m.role !== 'HOD')
          const filteredMembers = eligibleMembers.filter(m =>
            m.userName.toLowerCase().includes(memberSearch.trim().toLowerCase())
          )
          const memberCountFor = (nbId: string) =>
            eligibleMembers.filter(m => (matrixDraft[memberKey(m)] ?? []).includes(nbId)).length

          return (
            <div className="flex gap-3 pt-2" style={{ height: 440 }}>
              {/* Left: notebook list */}
              <div className="w-64 shrink-0 flex flex-col border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-2 border-b border-slate-200 bg-slate-50">
                  <Input.Search
                    size="small"
                    placeholder="Search notebooks..."
                    value={nbSearch}
                    onChange={(e) => setNbSearch(e.target.value)}
                    allowClear
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredNotebooks.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No matches.</p>
                  ) : filteredNotebooks.map(nb => (
                    <button
                      key={nb.id}
                      type="button"
                      onClick={() => setAccessSelectedNbId(nb.id)}
                      className={`w-full text-left px-3 py-2 text-xs border-b border-slate-100 last:border-0 flex items-center justify-between gap-2 ${
                        nb.id === accessSelectedNbId ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate" title={nb.name}>{nb.name}</span>
                      <Tag className="m-0 shrink-0 text-[10px] leading-none py-0">{memberCountFor(nb.id)}</Tag>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: member checklist for the selected notebook */}
              <div className="flex-1 flex flex-col border border-slate-200 rounded-lg overflow-hidden">
                {!selectedNb ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                    Select a notebook on the left.
                  </div>
                ) : (
                  <>
                    <div className="p-2.5 border-b border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 truncate" title={selectedNb.name}>
                          {selectedNb.name}
                        </span>
                        <Space size={4}>
                          <Button size="small" onClick={() => toggleMatrixColumn(selectedNb.id, true)}>Select all</Button>
                          <Button size="small" onClick={() => toggleMatrixColumn(selectedNb.id, false)}>Clear</Button>
                        </Space>
                      </div>
                      <Input.Search
                        size="small"
                        placeholder="Search members..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        allowClear
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400 italic">
                        HOD — always has access to every notebook
                      </div>
                      {filteredMembers.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No matches.</p>
                      ) : filteredMembers.map(m => {
                        const key = memberKey(m)
                        const checked = (matrixDraft[key] ?? []).includes(selectedNb.id)
                        return (
                          <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleMatrixCell(key, selectedNb.id, e.target.checked)}
                            />
                            <span className="font-medium text-slate-800">{m.userName}</span>
                            <Tag color={m.role === 'TL' ? 'blue' : 'geekblue'} className="text-[10px] leading-none py-0 m-0">
                              {m.role || 'ANALYST'}
                            </Tag>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })()}
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
        title={
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-indigo-500" />
            <span>{editingStp ? `Edit STP — ${editingStp.documentNo}` : 'Add STP Document'}</span>
          </div>
        }
        open={stpModalOpen}
        onCancel={() => { setStpModalOpen(false); stpForm.resetFields() }}
        onOk={() => stpForm.validateFields().then(handleStpSubmit)}
        confirmLoading={saveMut.isPending}
        okText={editingStp ? 'Save Changes' : 'Create STP'}
        width={980}
      >
        <Form form={stpForm} layout="vertical" className="pt-2">
          {/* Version is tracked internally for revisions but not shown in this form. */}
          <Form.Item name="version" initialValue="1.0" className="hidden">
            <Input />
          </Form.Item>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5">
            {/* Left column */}
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">STP Details</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 mb-4">
                <Form.Item name="title" label="STP Name" rules={[{ required: true, message: 'Required' }]} className="mb-3">
                  <Input placeholder="Standard Test Procedure title" />
                </Form.Item>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <Form.Item name="testType" label="Test Type" rules={[{ required: true, message: 'Required' }]} className="col-span-1 mb-3">
                    <Select showSearch optionFilterProp="label" allowClear placeholder="Select Test Type" options={testTypeOptions} />
                  </Form.Item>
                  <Form.Item name="testSubtype" label="Sub Type" rules={[{ required: true, message: 'Required' }]} className="col-span-1 mb-3">
                    <Select showSearch optionFilterProp="label" allowClear placeholder="Select Sub Type" options={testSubtypeOptions} />
                  </Form.Item>
                  <Form.Item name="stpType" label="STP Type" rules={[{ required: true, message: 'Required' }]} className="col-span-1 mb-3">
                    <Select allowClear placeholder="Select STP Type"
                      options={['Compendial', 'Non-Compendial', 'In-House', 'Pharmacopoeial'].map(v => ({ value: v, label: v }))} />
                  </Form.Item>
                  <Form.Item name="documentNo" label="STP Code" rules={[{ required: true, message: 'Required' }]} className="col-span-1 mb-3">
                    <Input placeholder="e.g. STP-ARD-001" />
                  </Form.Item>
                  <Form.Item name="stpGrade" label="STP Grade" className="col-span-1 mb-0">
                    <Input placeholder="e.g. Pharmaceutical" />
                  </Form.Item>
                  <Form.Item name="specificationNo" label="Specification/Protocol No" className="col-span-1 mb-0">
                    <Input placeholder="e.g. SPEC-ARD-001" />
                  </Form.Item>
                </div>
              </div>

              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Select Section to be Included</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 flex flex-wrap gap-4">
                <Form.Item name="weighingDetails" valuePropName="checked" className="mb-0">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" className="rounded accent-violet-600" />
                    Weighing Details
                  </label>
                </Form.Item>
                <Form.Item name="phDetails" valuePropName="checked" className="mb-0">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" className="rounded accent-violet-600" />
                    pH Details
                  </label>
                </Form.Item>
                <Form.Item name="columnDetails" valuePropName="checked" className="mb-0">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" className="rounded accent-violet-600" />
                    Column Details
                  </label>
                </Form.Item>
              </div>
            </div>

            {/* Right column */}
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Attachments</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 mb-4 space-y-3">
                <Form.Item
                  name="sampleMappingFile"
                  label="Sample Mapping Details"
                  valuePropName="fileList"
                  getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
                  className="mb-0"
                >
                  <Upload beforeUpload={() => false} maxCount={1}>
                    <Button icon={<Paperclip size={13} />}>Choose File</Button>
                  </Upload>
                </Form.Item>
                <Form.Item
                  name="stpProcedureFile"
                  label="STP Procedure"
                  valuePropName="fileList"
                  getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
                  rules={[{ required: true, message: 'STP Procedure attachment is required' }]}
                  className="mb-0"
                >
                  <Upload beforeUpload={() => false} maxCount={1}>
                    <Button icon={<Paperclip size={13} />}>Choose File</Button>
                  </Upload>
                </Form.Item>
                <Form.Item
                  name="stpCalculationFile"
                  label="STP Calculation"
                  valuePropName="fileList"
                  getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
                  className="mb-0"
                >
                  <Upload beforeUpload={() => false} maxCount={1}>
                    <Button icon={<Paperclip size={13} />}>Choose File</Button>
                  </Upload>
                </Form.Item>
                <Form.Item name="chromatogramReport" valuePropName="checked" className="mb-0">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" className="rounded accent-violet-600" />
                    Include Chromatogram Report
                  </label>
                </Form.Item>
              </div>

              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Description</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <Form.Item name="description" rules={[{ required: true, message: 'Required' }]} className="mb-0">
                  <TextArea rows={8} placeholder="Describe this STP..." />
                </Form.Item>
              </div>
            </div>
          </div>
        </Form>
      </Modal>

      {/* Notebook creation modal */}
      <Modal
        {...glassModalProps}
        title={<span className="font-bold text-slate-800 text-base">Create New Notebook</span>}
        open={notebookModalOpen}
        onCancel={() => setNotebookModalOpen(false)}
        onOk={submitNotebookCreate}
        confirmLoading={createNotebook.isPending}
        okText="Create Notebook"
        cancelText="Cancel"
        okButtonProps={{
          className: 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-none',
          disabled: !notebookName.trim() || !notebookTypeSel || (notebookTypeSel === 'OTHER' && !notebookTypeOther.trim()),
        }}
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
            onPressEnter={submitNotebookCreate}
          />
          <label className="block text-xs font-semibold text-slate-700 mt-3">
            Notebook Type <span className="text-red-500">*</span>
          </label>
          {notebookTypeSel === 'OTHER' ? (
            <Input
              placeholder="Enter notebook type"
              value={notebookTypeOther}
              onChange={(e) => setNotebookTypeOther(e.target.value)}
              className="py-2 text-sm rounded-lg"
              autoFocus
              suffix={
                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                  onClick={() => { setNotebookTypeSel(undefined); setNotebookTypeOther('') }}
                >
                  Choose from list
                </button>
              }
            />
          ) : (
            <Select
              placeholder="Select notebook type"
              value={notebookTypeSel}
              onChange={(v) => setNotebookTypeSel(v)}
              options={NOTEBOOK_TYPE_OPTIONS}
              className="w-full"
            />
          )}
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
