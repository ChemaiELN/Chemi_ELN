import { useEffect, useMemo, useState } from 'react'
import { Input, Select, Button, Checkbox, Tag, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import styles from './ADCWorkflow.module.less'
import {
  flattenScreens,
  sectionShortLabel,
  type WorkflowDefinition,
  type WorkflowFieldDef,
  type WorkflowScreenDef,
} from '../lib/templateTypes'

const SECTION_COLORS = ['#0f6e56', '#155a9c', '#534ab7', '#854f0b']

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

export interface ADCWorkflowProps {
  definition: WorkflowDefinition
  templateName?: string | null
  experimentCode?: string
  experimentTitle?: string
  fieldData?: Record<string, unknown>
  initialScreenId?: string
  readOnly?: boolean
  onScreenChange?: (screenKey: string, sectionKey: string) => void
  onFieldChange?: (fieldKey: string, value: unknown) => void
}

function FieldInput({
  field,
  value,
  readOnly,
  onChange,
}: {
  field: WorkflowFieldDef
  value: unknown
  readOnly?: boolean
  onChange: (v: unknown) => void
}) {
  const common = { size: 'small' as const, disabled: readOnly, style: { width: '100%' } }

  if (field.type === 'textarea') {
    return (
      <Input.TextArea
        {...common}
        rows={3}
        value={(value as string) ?? ''}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}…`}
        onChange={e => onChange(e.target.value)}
      />
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
    return (
      <Input
        {...common}
        className={styles.fieldWrap}
        type="date"
        value={(value as string) ?? ''}
        onChange={e => onChange(e.target.value)}
      />
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
  onFieldChange,
}: {
  screen: WorkflowScreenDef
  fieldData: Record<string, unknown>
  readOnly?: boolean
  onFieldChange?: (key: string, value: unknown) => void
}) {
  if (screen.fields.length === 0) {
    return <p style={{ color: C.textTertiary, fontSize: 13, margin: 0 }}>No fields configured for this screen.</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px 20px' }}>
      {screen.fields.map(field => (
        <div key={field.key}>
          <label className={styles.fieldLabel}>
            {field.label}
            {field.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
          </label>
          <FieldInput
            field={field}
            value={fieldData[field.key]}
            readOnly={readOnly}
            onChange={v => onFieldChange?.(field.key, v)}
          />
        </div>
      ))}
    </div>
  )
}

export default function ADCWorkflow({
  definition,
  templateName,
  experimentCode,
  experimentTitle,
  fieldData = {},
  initialScreenId,
  readOnly = false,
  onScreenChange,
  onFieldChange,
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
    <div style={{ display: 'grid', gridTemplateColumns: '272px 1fr', flex: 1, minHeight: 0, fontSize: 13, lineHeight: 1.5, color: C.textPrimary }}>
      <aside style={{
        background: C.bgElevated,
        borderRight: `1px solid ${C.border}`,
        padding: '18px 14px',
        overflowY: 'auto',
        minHeight: 0,
      }}>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary, marginBottom: 3, paddingLeft: 2 }}>
                {section.title}
              </div>
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
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: expanded ? color : C.textPrimary }}>
                    {section.title.length > 28 ? section.title.slice(0, 26) + '…' : section.title}
                  </div>
                  <div style={{ fontSize: 10, color: C.textTertiary }}>{section.screens.length}</div>
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
                        flex: 1, fontSize: 11, lineHeight: 1.4,
                        color: active ? C.v.info.fg : C.textSecondary,
                        fontWeight: active ? 500 : 400,
                      }}>
                        {sc.title.length > 36 ? sc.title.slice(0, 34) + '…' : sc.title}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </aside>

      <main style={{ overflowY: 'auto', minHeight: 0 }}>
        <div style={{ padding: '24px 32px 100px', maxWidth: 1060 }}>
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
                  <Tag color="gold" style={{ fontSize: 11, margin: 0 }}>E-Signature</Tag>
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
            onFieldChange={onFieldChange}
          />

          {screen.has_files && (
            <div style={{ marginTop: 20, padding: '12px 14px', border: `1px dashed ${C.border}`, borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Attachments</div>
              <Upload disabled={readOnly} multiple>
                <Button size="small" icon={<UploadOutlined />} disabled={readOnly}>Upload file</Button>
              </Upload>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 20, marginTop: 16, borderTop: `1px solid ${C.border}` }}>
            <Button size="small" disabled={currentIdx <= 0} onClick={() => goAdjacent(-1)}>
              Previous step
            </Button>
            <Button
              size="small"
              type="primary"
              disabled={currentIdx >= flatScreens.length - 1}
              onClick={() => goAdjacent(1)}
              style={{ background: C.v.info.fg, borderColor: C.v.info.fg }}
            >
              Next step
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
