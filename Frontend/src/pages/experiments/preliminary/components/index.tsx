import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HomeOutlined, SaveOutlined, CheckOutlined } from '@ant-design/icons'
import { Spin, Tag, message, Button } from 'antd'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import ADCWorkflow, { screenFilesKey } from './ADCWorkflow'
import styles from './styles.module.less'
import sharedStyles from '@/pages/projects/shared/styles.module.less'
import {
  getExperiment,
  updateExperiment,
  getNotebook,
  screenSignExperiment,
  markPreliminaryComplete,
  getProjectPreliminaryData,
  type ExperimentResponse,
  type NotebookResponse,
} from '@/utilities/chemiaApi'
import { resolveNotebookTemplate, type ResolvedNotebookTemplate } from '../lib/resolveTemplate'
import type { WorkflowDefinition } from '../lib/templateTypes'

const META_KEYS = new Set(['_workflow_screen', '_workflow_section', '_prefill_done'])

function resolveWorkflowScreen(exp: ExperimentResponse): string | undefined {
  const data = exp.data as Record<string, unknown> | null
  const fromData = typeof data?._workflow_screen === 'string' ? data._workflow_screen : undefined
  return fromData || exp.screen_key || undefined
}

function fieldDataFromExperiment(exp: ExperimentResponse): Record<string, unknown> {
  const data = (exp.data ?? {}) as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => !META_KEYS.has(k) && !k.endsWith('__files')),
  )
}

export default function PreliminaryExperimentPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [exp, setExp] = useState<ExperimentResponse | null>(null)
  const [notebook, setNotebook] = useState<NotebookResponse | null>(null)
  const [template, setTemplate] = useState<ResolvedNotebookTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const markSaved = useCallback(() => {
    setIsDirty(false)
    setSavedFlash(true)
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2000)
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getExperiment(id)
      .then(async experiment => {
        const resolved = await resolveNotebookTemplate(experiment.notebook_id)
        setTemplate(resolved)

        // Auto-populate ADC Synthesis fields from the project's ADC Preliminary (only once)
        let finalExp = experiment
        if (
          resolved?.templateSlug === 'adc-synthesis' &&
          !((experiment.data as Record<string, unknown> | null)?._prefill_done)
        ) {
          try {
            const { data: prelimData } = await getProjectPreliminaryData(id)
            if (prelimData && Object.keys(prelimData).length > 0) {
              // Collect all field keys defined in the synthesis template
              const synthKeys = new Set<string>()
              for (const section of resolved.definition.sections) {
                for (const screen of section.screens) {
                  for (const field of screen.fields) {
                    synthKeys.add(field.key)
                  }
                }
              }
              // Skip signature, disposition, and meta keys
              const skipKeys = new Set(['disposition', 'lp_disposition', '_prefill_done'])
              const expData = (experiment.data ?? {}) as Record<string, unknown>
              const updates: Record<string, unknown> = {}
              for (const key of synthKeys) {
                if (skipKeys.has(key) || key.includes('__')) continue
                const prelimVal = prelimData[key]
                const synthVal  = expData[key]
                if (
                  prelimVal !== undefined && prelimVal !== null && prelimVal !== '' &&
                  (synthVal === undefined || synthVal === null || synthVal === '')
                ) {
                  updates[key] = prelimVal
                }
              }
              if (Object.keys(updates).length > 0) {
                const merged = { ...expData, ...updates, _prefill_done: true }
                const saved = await updateExperiment(id, { data: merged })
                finalExp = saved
              } else {
                // Mark done even if no fields matched, to avoid repeated API calls
                const merged = { ...(experiment.data ?? {}) as Record<string, unknown>, _prefill_done: true }
                const saved = await updateExperiment(id, { data: merged })
                finalExp = saved
              }
            }
          } catch {
            // Non-critical — proceed with original experiment data
          }
        }

        setExp(finalExp)
        setIsDirty(false)
        getNotebook(experiment.notebook_id)
          .then(setNotebook)
          .catch(() => setNotebook(null))
      })
      .catch(() => message.error('Failed to load experiment'))
      .finally(() => setLoading(false))
  }, [id])

  const persistData = useCallback((data: Record<string, unknown>) => {
    if (!id) return
    setSaving(true)
    updateExperiment(id, { data })
      .then(updated => {
        setExp(updated)
        markSaved()
      })
      .catch(() => message.error('Failed to save'))
      .finally(() => setSaving(false))
  }, [id, markSaved])

  const handleScreenChange = useCallback((screenKey: string, sectionKey: string) => {
    if (!exp) return
    const prev = (exp.data ?? {}) as Record<string, unknown>
    persistData({ ...prev, _workflow_screen: screenKey, _workflow_section: sectionKey })
  }, [exp, persistData])

  const markingRef = useRef(false)

  const checkAndMarkComplete = useCallback((expId: string, data: Record<string, unknown> | null) => {
    if (markingRef.current || notebook?.preliminary_complete) return
    const d = data ?? {}
    const abDone = !!(d['wf1_review_esig__done_by'] && d['wf1_review_esig__checked_by'] && d['disposition'] === 'Release for conjugation')
    const lpDone = !!(d['wf1_lp_review_esig__done_by'] && d['wf1_lp_review_esig__checked_by'] && d['lp_disposition'] === 'Release for conjugation')
    if (!abDone && !lpDone) return
    markingRef.current = true
    markPreliminaryComplete(expId)
      .then(() => {
        setNotebook(prev => prev ? { ...prev, preliminary_complete: true } : prev)
        message.success('ADC Preliminary section marked as complete')
      })
      .catch(() => { /* non-critical */ })
      .finally(() => { markingRef.current = false })
  }, [notebook?.preliminary_complete])

  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    if (!exp) return
    const prev = (exp.data ?? {}) as Record<string, unknown>
    const next = { ...prev, [fieldKey]: value }
    setExp({ ...exp, data: next })
    setIsDirty(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistData(next), 600)
    if (fieldKey === 'disposition' || fieldKey === 'lp_disposition') {
      checkAndMarkComplete(id!, next)
    }
  }, [exp, persistData, id, checkAndMarkComplete])

  const handleManualSave = useCallback(() => {
    if (!exp?.data) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    persistData(exp.data as Record<string, unknown>)
  }, [exp, persistData])

  const handleScreenSign = useCallback(async (
    screenKey: string,
    role: 'done_by' | 'checked_by',
    password: string,
  ) => {
    if (!id) return
    const updated = await screenSignExperiment(id, { screen_key: screenKey, sign_role: role, password })
    setExp(updated)
    message.success(role === 'done_by' ? 'Done By signature recorded' : 'Checked By signature recorded')
    if (role === 'checked_by') {
      checkAndMarkComplete(id, updated.data as Record<string, unknown> | null)
    }
  }, [id, checkAndMarkComplete])

  if (!id) {
    return (
      <div className={styles.page}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#78716c' }}>No experiment selected.</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      </div>
    )
  }

  if (!exp) return null

  const definition: WorkflowDefinition | null = template?.definition ?? null

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="experiments" />
        <main className={styles.main}>
          <div className={styles.topRow}>
            <div className={styles.breadcrumb}>
              <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}>
                <HomeOutlined /> Home
              </span>
              {' / '}
              <span className={styles.breadcrumbLink} onClick={() => navigate('/experiments')}>
                Experiments
              </span>
              {' / '}
              <span
                className={styles.breadcrumbLink}
                onClick={() => navigate(`/notebooks/${exp.notebook_id}/overview`)}
              >
                {notebook?.code ?? notebook?.title ?? 'Notebook'}
              </span>
              {' / '}
              <span>{exp.full_code}</span>
            </div>
            <div className={styles.meta}>
              <StatusTag status={exp.status} />
              {template?.templateName && (
                <Tag color="blue" style={{ fontSize: 11 }}>{template.templateName}</Tag>
              )}
              <span className={styles.metaTitle}>{exp.title}</span>
              {isDirty && !saving && (
                <span className={styles.unsavedHint}>Unsaved changes</span>
              )}
              {saving && <span className={styles.saveStatus}>Saving…</span>}
              {savedFlash && !saving && (
                <span className={styles.savedFlash}>
                  <CheckOutlined /> Saved
                </span>
              )}
              <Button
                size="small"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleManualSave}
                className={sharedStyles.primaryActionBtn}
              >
                Save
              </Button>
            </div>
          </div>
          <div className={styles.contentWrapper}>
            {!definition || definition.sections.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <div style={{ textAlign: 'center', color: '#78716c' }}>
                  <p style={{ fontWeight: 600, marginBottom: 8 }}>No workflow template linked</p>
                  <p style={{ fontSize: 13 }}>This notebook has no template definition. Link a template when creating the notebook.</p>
                </div>
              </div>
            ) : (
              <ADCWorkflow
                definition={definition}
                templateName={template?.templateName}
                experimentId={id}
                experimentCode={exp.full_code}
                experimentTitle={exp.title}
                fieldData={fieldDataFromExperiment(exp)}
                initialScreenId={resolveWorkflowScreen(exp)}
                readOnly={!['DRAFT', 'INPROGRESS', 'REJECTED', 'REWORK', 'UNLOCKED'].includes(exp.status)}
                onScreenChange={handleScreenChange}
                onFieldChange={handleFieldChange}
                onScreenSign={handleScreenSign}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
