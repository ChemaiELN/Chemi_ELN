import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Input, Select, Button, Checkbox, Tag, Upload, DatePicker, Tooltip, message } from 'antd'
import type { UploadFile, UploadProps } from 'antd/es/upload'
import { UploadOutlined, DeleteOutlined, PaperClipOutlined, CheckCircleFilled, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import RichTextEditor from '@/common/RichTextEditor'
import ESignatureModal from '@/common/ESignatureModal'
import KetcherEditor, { type KetcherEditorHandle } from '@/common/KetcherEditor'
import { uploadExperimentFile } from '@/utilities/chemiaApi'
import styles from './ADCWorkflow.module.less'
import {
  flattenScreens,
  sectionShortLabel,
  type WorkflowDefinition,
  type WorkflowFieldDef,
  type WorkflowScreenDef,
} from '../lib/templateTypes'

const SECTION_COLORS = ['#0f6e56', '#155a9c', '#534ab7', '#854f0b']
const SIDEBAR_WIDTH = 300
const SECTION_TITLE_MAX = 32
const SCREEN_TITLE_MAX = 40

function formatFieldLabel(label: string): string {
  return label.replace(/\s·\s/g, ' - ')
}

function TruncatedLabel({
  text,
  maxLen,
  className,
  style,
}: {
  text: string
  maxLen: number
  className?: string
  style?: CSSProperties
}) {
  const truncated = text.length > maxLen
  const display = truncated ? `${text.slice(0, maxLen - 1)}…` : text

  if (!truncated) {
    return <span className={className} style={style}>{text}</span>
  }

  return (
    <Tooltip title={text}>
      <span className={className} style={style}>{display}</span>
    </Tooltip>
  )
}

const C = {
  bgElevated: '#ffffff',
  border: '#e3e2dc',
  textPrimary: '#1c1c1a',
  textSecondary: '#5e5d57',
  textTertiary: '#8a8980',
  v: {
    info: { bg: '#eef4fb', fg: '#155a9c' },
    warning: { bg: '#fbf2e0', fg: '#7a4a08' },
    neutral: { bg: '#f3f3ee', fg: '#5e5d57' },
  },
}

export function screenFilesKey(screenKey: string): string {
  return `${screenKey}__files`
}

export interface ScreenFileRef {
  id: string
  filename: string
  url: string
}

export interface SignatureInfo {
  name: string
  signed_at: string
  user_id: string
}

export interface ADCWorkflowProps {
  definition: WorkflowDefinition
  templateName?: string | null
  experimentId?: string
  experimentCode?: string
  experimentTitle?: string
  fieldData?: Record<string, unknown>
  initialScreenId?: string
  readOnly?: boolean
  onScreenChange?: (screenKey: string, sectionKey: string) => void
  onFieldChange?: (fieldKey: string, value: unknown) => void
  onScreenSign?: (screenKey: string, role: 'done_by' | 'checked_by', password: string) => Promise<void>
}

function KetcherField({
  value,
  readOnly,
  onChange,
}: {
  value: unknown
  readOnly?: boolean
  onChange: (v: unknown) => void
}) {
  const ketcherRef       = useRef<KetcherEditorHandle>(null)
  const [saving,        setSaving]        = useState(false)
  const [smilesText,    setSmilesText]    = useState('')
  const [loadingSmiles, setLoadingSmiles] = useState(false)
  const [loadingImage,  setLoadingImage]  = useState(false)

  const handleSave = async () => {
    if (!ketcherRef.current) return
    setSaving(true)
    try {
      const mol = await ketcherRef.current.getMol()
      onChange(mol || null)
      message.success('Structure saved')
    } catch {
      message.error('Failed to capture structure')
    } finally {
      setSaving(false)
    }
  }

  const handleLoadSmiles = async () => {
    if (!smilesText.trim() || !ketcherRef.current) return
    setLoadingSmiles(true)
    try {
      await ketcherRef.current.loadMol(smilesText.trim())
      message.success('Structure loaded')
    } catch {
      message.error('Could not load structure — check the format')
    } finally {
      setLoadingSmiles(false)
    }
  }

  return (
    <div>
      <KetcherEditor ref={ketcherRef} initialMol={(value as string | null) ?? null} readOnly={readOnly} />

      {!readOnly && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
          {/* SMILES / InChI / MOL text input */}
          <div style={{ display: 'flex', gap: 6, flex: '1 1 360px', minWidth: 0 }}>
            <Input
              size="small"
              value={smilesText}
              onChange={e => setSmilesText(e.target.value)}
              onPressEnter={handleLoadSmiles}
              placeholder="SMILES, InChI, or MOL text…"
              style={{ flex: 1 }}
            />
            <Button
              size="small"
              loading={loadingSmiles}
              disabled={!smilesText.trim()}
              onClick={handleLoadSmiles}
            >
              Load Structure
            </Button>
          </div>

          {/* Image to structure */}
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={file => {
              setLoadingImage(true)
              ketcherRef.current?.recognizeImage(file)
                .then(() => message.success('Structure loaded from image'))
                .catch((err: Error) => message.error(err.message ?? 'Image recognition failed'))
                .finally(() => setLoadingImage(false))
              return false
            }}
          >
            <Button size="small" icon={<UploadOutlined />} loading={loadingImage}>
              Image to Structure
            </Button>
          </Upload>

          {/* Save to field data */}
          <Button type="primary" size="small" loading={saving} onClick={handleSave}>
            Save Structure
          </Button>
        </div>
      )}
    </div>
  )
}

function FieldInput({
  field,
  value,
  readOnly,
  experimentId,
  onChange,
}: {
  field: WorkflowFieldDef
  value: unknown
  readOnly?: boolean
  experimentId?: string
  onChange: (v: unknown) => void
}) {
  const common = { size: 'small' as const, disabled: readOnly, style: { width: '100%' } }

  if (field.type === 'ketcher') {
    return <KetcherField value={value} readOnly={readOnly} onChange={onChange} />
  }

  if (field.type === 'textarea') {
    return (
      <div className={styles.quillWrap}>
        <RichTextEditor
          value={(value as string) ?? ''}
          onChange={readOnly ? undefined : v => onChange(v)}
          readOnly={readOnly}
          placeholder={field.placeholder || `Enter ${formatFieldLabel(field.label).toLowerCase()}…`}
          minHeight={120}
        />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <Select
        {...common}
        className={styles.fieldWrap}
        value={(value as string) ?? undefined}
        placeholder={field.placeholder || 'Select…'}
        allowClear
        options={field.options.map(o => ({ value: o, label: o }))}
        onChange={v => onChange(v)}
      />
    )
  }

  if (field.type === 'checkbox') {
    return (
      <Checkbox
        checked={!!value}
        disabled={readOnly}
        onChange={e => onChange(e.target.checked)}
      >
        {field.placeholder || field.label}
      </Checkbox>
    )
  }

  if (field.type === 'number') {
    return (
      <Input
        {...common}
        className={styles.fieldWrap}
        type="number"
        value={(value as string) ?? ''}
        placeholder={field.placeholder || ''}
        onChange={e => onChange(e.target.value)}
      />
    )
  }

  if (field.type === 'date') {
    const parsed = value ? dayjs(value as string) : null
    return (
      <DatePicker
        {...common}
        className={styles.fieldWrap}
        format="DD-MMM-YYYY"
        value={parsed?.isValid() ? parsed : null}
        onChange={(d: Dayjs | null) => onChange(d ? d.format('YYYY-MM-DD') : '')}
      />
    )
  }

  if (field.type === 'file') {
    const fileRef = value as { id: string; filename: string } | undefined
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {fileRef?.filename && (
          <span style={{ fontSize: 12, color: '#5e5d57', display: 'flex', alignItems: 'center', gap: 4 }}>
            <PaperClipOutlined />
            {fileRef.filename}
          </span>
        )}
        {!readOnly && (
          <Upload
            maxCount={1}
            showUploadList={false}
            customRequest={async ({ file, onSuccess, onError }) => {
              if (!experimentId) {
                message.warning('Save the experiment first before uploading files')
                onError?.(new Error('No experiment ID'))
                return
              }
              try {
                const uploaded = await uploadExperimentFile(experimentId, file as File, {
                  section_key: field.key,
                })
                onChange({ id: uploaded.id, filename: uploaded.filename })
                onSuccess?.({})
              } catch (e) {
                message.error('File upload failed')
                onError?.(e as Error)
              }
            }}
          >
            <Button size="small" icon={<UploadOutlined />}>
              {fileRef?.filename ? 'Replace' : 'Upload File'}
            </Button>
          </Upload>
        )}
      </div>
    )
  }

  return (
    <Input
      {...common}
      className={styles.fieldWrap}
      value={(value as string) ?? ''}
      placeholder={field.placeholder || ''}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function ScreenFields({
  screen,
  fieldData,
  readOnly,
  experimentId,
  onFieldChange,
}: {
  screen: WorkflowScreenDef
  fieldData: Record<string, unknown>
  readOnly?: boolean
  experimentId?: string
  onFieldChange?: (key: string, value: unknown) => void
}) {
  if (screen.fields.length === 0) {
    return <p style={{ color: C.textTertiary, fontSize: 13, margin: 0 }}>No fields configured for this screen.</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px 20px' }}>
      {screen.fields.map(field => (
        <div
          key={field.key}
          style={field.type === 'textarea' || field.type === 'file' || field.type === 'ketcher' ? { gridColumn: '1 / -1' } : undefined}
        >
          <label className={styles.fieldLabel}>
            {formatFieldLabel(field.label)}
            {field.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
          </label>
          <FieldInput
            field={field}
            value={fieldData[field.key]}
            readOnly={readOnly}
            experimentId={experimentId}
            onChange={v => onFieldChange?.(field.key, v)}
          />
        </div>
      ))}
    </div>
  )
}

function ScreenAttachments({
  screenKey,
  experimentId,
  files,
  readOnly,
  onFilesChange,
}: {
  screenKey: string
  experimentId?: string
  files: ScreenFileRef[]
  readOnly?: boolean
  onFilesChange?: (files: ScreenFileRef[]) => void
}) {
  const [uploading, setUploading] = useState(false)

  const uploadProps: UploadProps = {
    multiple: true,
    disabled: readOnly || !experimentId || uploading,
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      if (!experimentId) {
        onError?.(new Error('Experiment not loaded'))
        return
      }
      setUploading(true)
      try {
        const uploaded = await uploadExperimentFile(experimentId, file as File, {
          section_key: screenKey,
        })
        const ref: ScreenFileRef = {
          id: uploaded.id,
          filename: uploaded.filename,
          url: uploaded.url ?? `/api/experiments/${experimentId}/files/${uploaded.id}`,
        }
        onFilesChange?.([...files, ref])
        onSuccess?.(uploaded)
        message.success(`${uploaded.filename} uploaded`)
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Upload failed')
        onError?.(err as Error)
      } finally {
        setUploading(false)
      }
    },
  }

  const fileList: UploadFile[] = files.map(f => ({
    uid: f.id,
    name: f.filename,
    status: 'done',
    url: f.url,
  }))

  return (
    <div style={{ marginTop: 20, padding: '12px 14px', border: `1px dashed ${C.border}`, borderRadius: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Attachments</div>
      {files.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <li
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: C.textSecondary,
              }}
            >
              <PaperClipOutlined style={{ color: C.textTertiary }} />
              <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0 }}>
                {f.filename}
              </a>
              {!readOnly && (
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onFilesChange?.(files.filter(x => x.id !== f.id))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <Upload {...uploadProps} fileList={fileList}>
        <Button size="small" icon={<UploadOutlined />} loading={uploading} disabled={readOnly || !experimentId}>
          Upload file
        </Button>
      </Upload>
    </div>
  )
}

function SignedBadge({ label, info }: { label: string; info: SignatureInfo }) {
  const dt = new Date(info.signed_at)
  const formatted = isNaN(dt.getTime())
    ? info.signed_at
    : dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{
      padding: '8px 12px', border: '1px solid #16a34a', borderRadius: 6,
      background: '#f0fdf4', display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 180,
    }}>
      <CheckCircleFilled style={{ color: '#16a34a', marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{info.name}</div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>{formatted}</div>
      </div>
    </div>
  )
}

function ScreenSignatures({
  screenKey,
  fieldData,
  readOnly,
  onSign,
}: {
  screenKey: string
  fieldData: Record<string, unknown>
  readOnly?: boolean
  onSign?: (screenKey: string, role: 'done_by' | 'checked_by', password: string) => Promise<void>
}) {
  const [modalRole, setModalRole] = useState<'done_by' | 'checked_by' | null>(null)

  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('chemia_user') ?? '{}') } catch { return {} }
  })()
  const userRole: string = (storedUser?.role ?? '').toUpperCase()
  const isTL = userRole === 'TL' || userRole === 'ARD_TL'

  const doneBy    = fieldData[`${screenKey}__done_by`]    as SignatureInfo | undefined
  const checkedBy = fieldData[`${screenKey}__checked_by`] as SignatureInfo | undefined

  const showDoneByBtn    = !readOnly && !isTL && !doneBy
  const showCheckedByBtn = !readOnly && isTL && !!doneBy && !checkedBy

  return (
    <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        E-Signatures
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {doneBy ? (
          <SignedBadge label="Done By" info={doneBy} />
        ) : showDoneByBtn ? (
          <Button type="primary" onClick={() => setModalRole('done_by')}>
            Done By
          </Button>
        ) : (
          <div style={{ padding: '8px 12px', border: `1px dashed ${C.border}`, borderRadius: 6, color: C.textTertiary, fontSize: 12, minWidth: 120 }}>
            Done By — pending
          </div>
        )}

        {checkedBy ? (
          <SignedBadge label="Checked By" info={checkedBy} />
        ) : showCheckedByBtn ? (
          <Button onClick={() => setModalRole('checked_by')}>
            Checked By
          </Button>
        ) : (
          <div style={{
            padding: '8px 12px', border: `1px dashed ${C.border}`, borderRadius: 6,
            color: doneBy ? C.textTertiary : '#d1d5db', fontSize: 12, minWidth: 120,
          }}>
            Checked By — {doneBy ? 'pending' : 'awaiting Done By'}
          </div>
        )}
      </div>

      <ESignatureModal
        open={modalRole !== null}
        actionLabel={modalRole === 'done_by' ? 'Done By' : 'Checked By'}
        onConfirm={async (pw) => {
          await onSign?.(screenKey, modalRole!, pw)
          setModalRole(null)
        }}
        onCancel={() => setModalRole(null)}
      />
    </div>
  )
}

export default function ADCWorkflow({
  definition,
  templateName,
  experimentId,
  experimentCode,
  experimentTitle,
  fieldData = {},
  initialScreenId,
  readOnly = false,
  onScreenChange,
  onFieldChange,
  onScreenSign,
}: ADCWorkflowProps) {
  const flatScreens = useMemo(() => flattenScreens(definition), [definition])

  const resolveInitial = () => {
    if (initialScreenId && flatScreens.some(s => s.screen.key === initialScreenId)) {
      return initialScreenId
    }
    return flatScreens[0]?.screen.key
  }

  const [currentScreenKey, setCurrentScreenKey] = useState<string | undefined>(resolveInitial)
  const [expandedSection, setExpandedSection] = useState<string | undefined>(
    () => flatScreens.find(s => s.screen.key === resolveInitial())?.sectionKey ?? definition.sections[0]?.key,
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const key = resolveInitial()
    if (!key) return
    setCurrentScreenKey(key)
    const match = flatScreens.find(s => s.screen.key === key)
    if (match) setExpandedSection(match.sectionKey)
  }, [initialScreenId, definition])

  const current = flatScreens.find(s => s.screen.key === currentScreenKey)
  const currentIdx = flatScreens.findIndex(s => s.screen.key === currentScreenKey)

  const goTo = (screenKey: string, sectionKey: string) => {
    setCurrentScreenKey(screenKey)
    setExpandedSection(sectionKey)
    onScreenChange?.(screenKey, sectionKey)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goAdjacent = (dir: -1 | 1) => {
    const next = flatScreens[currentIdx + dir]
    if (next) goTo(next.screen.key, next.sectionKey)
  }

  if (flatScreens.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textSecondary }}>
        This template has no workflow screens configured.
      </div>
    )
  }

  if (!current) return null

  const { screen, sectionTitle } = current

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${sidebarCollapsed ? 40 : SIDEBAR_WIDTH}px 1fr`, flex: 1, minHeight: 0, fontSize: 13, lineHeight: 1.5, color: C.textPrimary, transition: 'grid-template-columns 0.2s ease' }}>
      <aside style={{
        background: C.bgElevated,
        borderRight: `1px solid ${C.border}`,
        padding: sidebarCollapsed ? '14px 0' : '14px 14px 18px',
        overflowY: 'auto',
        minHeight: 0,
        overflowX: 'hidden',
        position: 'relative',
        transition: 'padding 0.2s ease',
      }}>
        {/* Collapse / expand toggle */}
        <div style={{ display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-end', marginBottom: sidebarCollapsed ? 0 : 10 }}>
          <Tooltip title={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'} placement="right">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(c => !c)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                color: C.textTertiary, borderRadius: 4, lineHeight: 1,
                fontSize: 15,
              }}
            >
              {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
          </Tooltip>
        </div>

        {!sidebarCollapsed && (
          <>
            {templateName && (
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {templateName}
              </div>
            )}

            {definition.sections.map((section, sIdx) => {
              const color = SECTION_COLORS[sIdx % SECTION_COLORS.length]
              const expanded = expandedSection === section.key
              const short = sectionShortLabel(section.title, sIdx)

              return (
                <div key={section.key} style={{ marginBottom: 10 }}>
                  <div style={{ marginBottom: 6 }}>
                    <div
                      onClick={() => setExpandedSection(expanded ? undefined : section.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', marginLeft: -8,
                        borderRadius: 5, cursor: 'pointer',
                        background: expanded ? color + '12' : 'transparent',
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 3, background: color, color: 'white',
                        display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0,
                      }}>
                        {short}
                      </div>
                      <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: expanded ? color : C.textPrimary, minWidth: 0 }}>
                        <TruncatedLabel text={section.title} maxLen={SECTION_TITLE_MAX} />
                      </div>
                      <Tooltip title={`${section.screens.length} form step${section.screens.length !== 1 ? 's' : ''} in this section`}>
                        <span className={styles.sectionCount}>{section.screens.length}</span>
                      </Tooltip>
                    </div>

                    {expanded && section.screens.map(sc => {
                      const active = sc.key === currentScreenKey
                      return (
                        <div
                          key={sc.key}
                          onClick={() => goTo(sc.key, section.key)}
                          style={{
                            display: 'flex', padding: '4px 8px 4px 34px', marginLeft: -8, borderRadius: 4,
                            cursor: 'pointer', background: active ? C.v.info.bg : 'transparent',
                          }}
                        >
                          <div style={{
                            flex: 1, fontSize: 11, lineHeight: 1.4, minWidth: 0,
                            color: active ? C.v.info.fg : C.textSecondary,
                            fontWeight: active ? 500 : 400,
                          }}>
                            <TruncatedLabel text={sc.title} maxLen={SCREEN_TITLE_MAX} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </aside>

      <main style={{ overflowY: 'auto', minHeight: 0 }}>
        <div style={{ padding: '24px 32px 100px', maxWidth: 1060 }}>
          <div className={styles.stepProgress}>
            <span className={styles.stepLabel}>
              Step {currentIdx + 1} of {flatScreens.length}
            </span>
            <div className={styles.stepDots} role="list" aria-label="Form steps">
              {flatScreens.map((item, idx) => (
                <Tooltip key={item.screen.key} title={item.screen.title}>
                  <button
                    type="button"
                    role="listitem"
                    className={`${styles.stepDot} ${idx === currentIdx ? styles.stepDotActive : ''} ${idx < currentIdx ? styles.stepDotDone : ''}`}
                    aria-label={`Step ${idx + 1}: ${item.screen.title}`}
                    aria-current={idx === currentIdx ? 'step' : undefined}
                    onClick={() => goTo(item.screen.key, item.sectionKey)}
                  />
                </Tooltip>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.textTertiary }}>
                {experimentCode || screen.key}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {screen.persona && (
                  <Tag style={{ fontSize: 11, margin: 0 }}>{screen.persona}</Tag>
                )}
                {screen.has_signature && (
                  <Tag color="gold" style={{ fontSize: 11, margin: 0 }}>E-Signature Required</Tag>
                )}
                {screen.has_files && (
                  <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>Files</Tag>
                )}
              </div>
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, margin: 0, color: C.textPrimary }}>
              {screen.title}
            </h1>
            {experimentTitle && (
              <p style={{ color: C.textSecondary, fontSize: 12, margin: '6px 0 0' }}>{experimentTitle}</p>
            )}
            <p style={{ color: C.textTertiary, fontSize: 11, margin: '4px 0 0' }}>{sectionTitle}</p>
          </div>

          <ScreenFields
            screen={screen}
            fieldData={fieldData}
            readOnly={readOnly}
            experimentId={experimentId}
            onFieldChange={onFieldChange}
          />

          {screen.has_files && (
            <ScreenAttachments
              screenKey={screen.key}
              experimentId={experimentId}
              files={(fieldData[screenFilesKey(screen.key)] as ScreenFileRef[] | undefined) ?? []}
              readOnly={readOnly}
              onFilesChange={next => onFieldChange?.(screenFilesKey(screen.key), next)}
            />
          )}

          {screen.has_signature && (
            <ScreenSignatures
              screenKey={screen.key}
              fieldData={fieldData}
              readOnly={readOnly}
              onSign={onScreenSign}
            />
          )}

          <div className={styles.stepActions}>
            {currentIdx > 0 && (
              <Button size="small" className={styles.secondaryBtn} onClick={() => goAdjacent(-1)}>
                Previous step
              </Button>
            )}
            <Button
              size="small"
              type="primary"
              className={styles.primaryBtn}
              disabled={currentIdx >= flatScreens.length - 1}
              onClick={() => goAdjacent(1)}
            >
              Next step
            </Button>
          </div>
        </div>
      </main>

    </div>
  )
}
