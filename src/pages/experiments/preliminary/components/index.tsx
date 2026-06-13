import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HomeOutlined } from '@ant-design/icons'
import { Spin, Tag, message, Button } from 'antd'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import ADCWorkflow from './ADCWorkflow'
import styles from './styles.module.less'
import {
  getExperiment,
  updateExperiment,
  type ExperimentResponse,
} from '@/utilities/chemiaApi'
import { resolveNotebookTemplate, type ResolvedNotebookTemplate } from '../lib/resolveTemplate'
import type { WorkflowDefinition } from '../lib/templateTypes'

const META_KEYS = new Set(['_workflow_screen', '_workflow_section'])

function resolveWorkflowScreen(exp: ExperimentResponse): string | undefined {
  const data = exp.data as Record<string, unknown> | null
  const fromData = typeof data?._workflow_screen === 'string' ? data._workflow_screen : undefined
  return fromData || exp.screen_key || undefined
}

function fieldDataFromExperiment(exp: ExperimentResponse): Record<string, unknown> {
  const data = (exp.data ?? {}) as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => !META_KEYS.has(k)),
  )
}

export default function PreliminaryExperimentPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [exp, setExp] = useState<ExperimentResponse | null>(null)
  const [template, setTemplate] = useState<ResolvedNotebookTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getExperiment(id)
      .then(async experiment => {
        setExp(experiment)
        const resolved = await resolveNotebookTemplate(experiment.notebook_id)
        setTemplate(resolved)
      })
      .catch(() => message.error('Failed to load experiment'))
      .finally(() => setLoading(false))
  }, [id])

  const persistData = useCallback((data: Record<string, unknown>) => {
    if (!id) return
    setSaving(true)
    updateExperiment(id, { data })
      .then(updated => setExp(updated))
      .catch(() => message.error('Failed to save'))
      .finally(() => setSaving(false))
  }, [id])

  const handleScreenChange = useCallback((screenKey: string, sectionKey: string) => {
    if (!exp) return
    const prev = (exp.data ?? {}) as Record<string, unknown>
    persistData({ ...prev, _workflow_screen: screenKey, _workflow_section: sectionKey })
  }, [exp, persistData])

  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    if (!exp) return
    const prev = (exp.data ?? {}) as Record<string, unknown>
    const next = { ...prev, [fieldKey]: value }
    setExp({ ...exp, data: next })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistData(next), 600)
  }, [exp, persistData])

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
              <span className={styles.breadcrumbLink} onClick={() => navigate(`/notebooks/${exp.notebook_id}/overview`)}>
                Notebook
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
              {saving && <span style={{ fontSize: 11, color: '#78716c' }}>Saving…</span>}
              <Button
                size="small"
                onClick={() => {
                  if (!exp.data) return
                  persistData(exp.data as Record<string, unknown>)
                  message.success('Saved')
                }}
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
                experimentCode={exp.full_code}
                experimentTitle={exp.title}
                fieldData={fieldDataFromExperiment(exp)}
                initialScreenId={resolveWorkflowScreen(exp)}
                readOnly={!['DRAFT', 'INPROGRESS', 'REJECTED', 'REWORK', 'UNLOCKED'].includes(exp.status)}
                onScreenChange={handleScreenChange}
                onFieldChange={handleFieldChange}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
