import React, { useState, useEffect, useCallback } from 'react'
import {
  Button, Input, Select, Switch, Form, Tag, Checkbox,
  Popconfirm, message, Spin, Tooltip,
} from 'antd'
import {
  HomeOutlined, SaveOutlined, ArrowLeftOutlined,
  PlusOutlined, DeleteOutlined, HolderOutlined,
  LayoutOutlined, AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getWorkflowTemplate,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  type WorkflowTemplateResponse,
} from '@/utilities/chemiaApi'

// ─── Types ────────────────────────────────────────────────────

const FIELD_TYPES = ['text', 'number', 'textarea', 'select', 'date', 'checkbox'] as const
type FieldType = typeof FIELD_TYPES[number]

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text:     'Text',
  number:   'Number',
  textarea: 'Long Text',
  select:   'Dropdown',
  date:     'Date',
  checkbox: 'Checkbox',
}

interface FieldDef {
  key: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  options: string[]
}

interface ScreenDef {
  key: string
  title: string
  persona: string
  has_signature: boolean
  has_files: boolean
  fields: FieldDef[]
}

interface SectionDef {
  key: string
  title: string
  screens: ScreenDef[]
}

interface TemplateDef {
  sections: SectionDef[]
}

// ─── Helpers ──────────────────────────────────────────────────

const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const emptyField  = (): FieldDef   => ({ key: '', label: '', type: 'text', required: false, placeholder: '', options: [] })
const emptyScreen = (): ScreenDef  => ({ key: '', title: '', persona: 'scientist', has_signature: false, has_files: false, fields: [] })
const emptySection= (): SectionDef => ({ key: '', title: '', screens: [] })

const parseDef = (raw?: Record<string, unknown>): TemplateDef => ({
  sections: (raw?.sections as SectionDef[] | undefined) ?? [],
})

// ─── Field row ────────────────────────────────────────────────

interface FieldRowProps {
  field: FieldDef
  index: number
  onChange: (f: FieldDef) => void
  onDelete: () => void
}

const FieldRow: React.FC<FieldRowProps> = ({ field, index, onChange, onDelete }) => {
  const [optInput, setOptInput] = useState('')

  const addOption = () => {
    const v = optInput.trim()
    if (!v || field.options.includes(v)) return
    onChange({ ...field, options: [...field.options, v] })
    setOptInput('')
  }

  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldDragHandle}><HolderOutlined /></span>
      <span className={styles.fieldNum}>{index + 1}</span>

      <div className={styles.fieldMain}>
        <div className={styles.fieldTopRow}>
          <Input
            size="small"
            placeholder="Field label *"
            value={field.label}
            className={styles.fieldLabel}
            onChange={e => {
              const label = e.target.value
              onChange({ ...field, label, key: toSlug(label) })
            }}
          />
          <Input
            size="small"
            placeholder="key (auto)"
            value={field.key}
            className={styles.fieldKey}
            onChange={e => onChange({ ...field, key: e.target.value })}
          />
          <Select
            size="small"
            value={field.type}
            className={styles.fieldType}
            options={FIELD_TYPES.map(t => ({ value: t, label: FIELD_TYPE_LABELS[t] }))}
            onChange={type => onChange({ ...field, type })}
          />
          <Input
            size="small"
            placeholder="Placeholder text"
            value={field.placeholder}
            className={styles.fieldPlaceholder}
            onChange={e => onChange({ ...field, placeholder: e.target.value })}
          />
          <Checkbox
            checked={field.required}
            onChange={e => onChange({ ...field, required: e.target.checked })}
            className={styles.fieldRequired}
          >
            Required
          </Checkbox>
        </div>

        {field.type === 'select' && (
          <div className={styles.optionsRow}>
            <span className={styles.optionsLabel}>Options:</span>
            <div className={styles.optionsTags}>
              {field.options.map((opt, i) => (
                <Tag
                  key={i}
                  closable
                  onClose={() => onChange({ ...field, options: field.options.filter((_, idx) => idx !== i) })}
                  className={styles.optionTag}
                >
                  {opt}
                </Tag>
              ))}
              <Input
                size="small"
                placeholder="Add option + Enter"
                value={optInput}
                className={styles.optionInput}
                onChange={e => setOptInput(e.target.value)}
                onPressEnter={addOption}
                suffix={
                  <PlusOutlined
                    style={{ fontSize: 10, cursor: 'pointer', color: '#5aa3a1' }}
                    onClick={addOption}
                  />
                }
              />
            </div>
          </div>
        )}
      </div>

      <Popconfirm
        title="Remove this field?"
        onConfirm={onDelete}
        okText="Remove"
        okButtonProps={{ danger: true }}
      >
        <Button size="small" icon={<DeleteOutlined />} type="text" danger className={styles.fieldDeleteBtn} />
      </Popconfirm>
    </div>
  )
}

// ─── Screen card ──────────────────────────────────────────────

interface ScreenCardProps {
  screen: ScreenDef
  _sectionIdx: number
  screenIdx: number
  onChange: (s: ScreenDef) => void
  onDelete: () => void
}

const ScreenCard: React.FC<ScreenCardProps> = ({ screen, _sectionIdx: _si, screenIdx, onChange, onDelete }) => {
  void _si
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={styles.screenCard}>
      {/* Screen header */}
      <div className={styles.screenCardHeader}>
        <AppstoreOutlined className={styles.screenIcon} />
        <div className={styles.screenTitleGroup}>
          <Input
            size="small"
            placeholder={`Screen ${screenIdx + 1} title *`}
            value={screen.title}
            className={styles.screenTitleInput}
            onChange={e => {
              const title = e.target.value
              onChange({ ...screen, title, key: toSlug(title) })
            }}
          />
          <Input
            size="small"
            placeholder="key (auto)"
            value={screen.key}
            className={styles.screenKeyInput}
            onChange={e => onChange({ ...screen, key: e.target.value })}
          />
        </div>

        <div className={styles.screenMeta}>
          <Select
            size="small"
            value={screen.persona}
            className={styles.screenPersona}
            options={[
              { value: 'scientist', label: 'Scientist' },
              { value: 'qa',        label: 'QA' },
              { value: 'tl',        label: 'Team Lead' },
              { value: 'any',       label: 'Any' },
            ]}
            onChange={persona => onChange({ ...screen, persona })}
          />
          <Tooltip title="Requires e-signature">
            <label className={styles.screenToggle}>
              <Switch
                size="small"
                checked={screen.has_signature}
                onChange={v => onChange({ ...screen, has_signature: v })}
              />
              <span>Sign</span>
            </label>
          </Tooltip>
          <Tooltip title="Allow file uploads">
            <label className={styles.screenToggle}>
              <Switch
                size="small"
                checked={screen.has_files}
                onChange={v => onChange({ ...screen, has_files: v })}
              />
              <span>Files</span>
            </label>
          </Tooltip>
        </div>

        <div className={styles.screenActions}>
          <span className={styles.fieldCount}>
            {screen.fields.length} field{screen.fields.length !== 1 ? 's' : ''}
          </span>
          <Button
            size="small"
            type="text"
            className={styles.collapseBtn}
            onClick={() => setCollapsed(c => !c)}
          >
            {collapsed ? 'Show' : 'Hide'}
          </Button>
          <Popconfirm
            title="Remove this screen and all its fields?"
            onConfirm={onDelete}
            okText="Remove"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" icon={<DeleteOutlined />} type="text" danger />
          </Popconfirm>
        </div>
      </div>

      {/* Fields */}
      {!collapsed && (
        <div className={styles.screenCardBody}>
          {screen.fields.length === 0 ? (
            <div className={styles.emptyFields}>
              No fields yet — click "Add Field" to define what scientists will fill in on this screen.
            </div>
          ) : (
            <div className={styles.fieldsList}>
              <div className={styles.fieldsHeader}>
                <span className={styles.fieldsHeaderLabel} />
                <span className={styles.fieldsHeaderLabel}>#</span>
                <span className={styles.fieldsHeaderLabel}>Label</span>
                <span className={styles.fieldsHeaderLabel}>Key</span>
                <span className={styles.fieldsHeaderLabel}>Type</span>
                <span className={styles.fieldsHeaderLabel}>Placeholder</span>
                <span className={styles.fieldsHeaderLabel}>Req.</span>
              </div>
              {screen.fields.map((f, fIdx) => (
                <FieldRow
                  key={fIdx}
                  field={f}
                  index={fIdx}
                  onChange={updated => {
                    const fields = [...screen.fields]
                    fields[fIdx] = updated
                    onChange({ ...screen, fields })
                  }}
                  onDelete={() => {
                    onChange({ ...screen, fields: screen.fields.filter((_, i) => i !== fIdx) })
                  }}
                />
              ))}
            </div>
          )}
          <Button
            size="small"
            icon={<PlusOutlined />}
            type="dashed"
            className={styles.addFieldBtn}
            onClick={() => onChange({ ...screen, fields: [...screen.fields, emptyField()] })}
          >
            Add Field
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Section block ────────────────────────────────────────────

interface SectionBlockProps {
  section: SectionDef
  index: number
  onChange: (s: SectionDef) => void
  onDelete: () => void
}

const SectionBlock: React.FC<SectionBlockProps> = ({ section, index, onChange, onDelete }) => {
  const addScreen = () => onChange({ ...section, screens: [...section.screens, emptyScreen()] })

  const updateScreen = (scIdx: number, sc: ScreenDef) => {
    const screens = [...section.screens]
    screens[scIdx] = sc
    onChange({ ...section, screens })
  }

  const removeScreen = (scIdx: number) => {
    onChange({ ...section, screens: section.screens.filter((_, i) => i !== scIdx) })
  }

  return (
    <div className={styles.sectionBlock}>
      {/* Section header bar */}
      <div className={styles.sectionHeader}>
        <LayoutOutlined className={styles.sectionIcon} />
        <span className={styles.sectionNum}>Section {index + 1}</span>
        <Input
          size="small"
          placeholder="Section title *"
          value={section.title}
          className={styles.sectionTitleInput}
          onChange={e => {
            const title = e.target.value
            onChange({ ...section, title, key: toSlug(title) })
          }}
        />
        <Input
          size="small"
          placeholder="key (auto)"
          value={section.key}
          className={styles.sectionKeyInput}
          onChange={e => onChange({ ...section, key: e.target.value })}
        />
        <span className={styles.sectionStats}>
          {section.screens.length} screen{section.screens.length !== 1 ? 's' : ''} ·{' '}
          {section.screens.reduce((a, sc) => a + sc.fields.length, 0)} fields
        </span>
        <Popconfirm
          title="Remove this section and all its screens?"
          onConfirm={onDelete}
          okText="Remove"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" icon={<DeleteOutlined />} type="text" danger />
        </Popconfirm>
      </div>

      {/* Screens */}
      <div className={styles.screensArea}>
        {section.screens.length === 0 && (
          <div className={styles.emptyScreens}>
            No screens yet — add a screen to start defining fields.
          </div>
        )}
        {section.screens.map((sc, scIdx) => (
          <ScreenCard
            key={scIdx}
            screen={sc}
            _sectionIdx={index}
            screenIdx={scIdx}
            onChange={updated => updateScreen(scIdx, updated)}
            onDelete={() => removeScreen(scIdx)}
          />
        ))}
        <Button
          size="small"
          icon={<PlusOutlined />}
          type="dashed"
          className={styles.addScreenBtn}
          onClick={addScreen}
        >
          Add Screen to this Section
        </Button>
      </div>
    </div>
  )
}

// ─── Editor page ──────────────────────────────────────────────

const WorkflowTemplateConfigurePage: React.FC = () => {
  const navigate  = useNavigate()
  const { id }    = useParams<{ id: string }>()
  const isNew     = !id || id === 'new'

  const [template, setTemplate] = useState<WorkflowTemplateResponse | null>(null)
  const [loading,  setLoading]  = useState(!isNew)
  const [saving,   setSaving]   = useState(false)
  const [def,      setDef]      = useState<TemplateDef>({ sections: [] })

  const [metaForm] = Form.useForm()

  // Load existing template
  useEffect(() => {
    if (isNew) {
      metaForm.setFieldsValue({ is_active: true })
      return
    }
    setLoading(true)
    getWorkflowTemplate(id!)
      .then(t => {
        setTemplate(t)
        setDef(parseDef(t.definition))
        metaForm.setFieldsValue({
          name:        t.name,
          slug:        t.slug,
          category:    t.category ?? '',
          description: t.description ?? '',
          is_active:   t.is_active,
        })
      })
      .catch(() => message.error('Failed to load template'))
      .finally(() => setLoading(false))
  }, [id, isNew, metaForm])

  // ── Definition helpers ────────────────────────────────────────
  const addSection = () => setDef(d => ({ sections: [...d.sections, emptySection()] }))

  const updateSection = useCallback((i: number, sec: SectionDef) =>
    setDef(d => { const s = [...d.sections]; s[i] = sec; return { sections: s } }), [])

  const removeSection = (i: number) =>
    setDef(d => ({ sections: d.sections.filter((_, idx) => idx !== i) }))

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    let values: { name: string; slug: string; category?: string; description?: string; is_active: boolean }
    try { values = await metaForm.validateFields() } catch { return }

    for (const sec of def.sections) {
      if (!sec.title.trim()) { message.warning('All sections must have a title'); return }
      for (const sc of sec.screens) {
        if (!sc.title.trim()) { message.warning('All screens must have a title'); return }
        for (const f of sc.fields) {
          if (!f.label.trim()) { message.warning('All fields must have a label'); return }
          if (!f.key.trim())   { message.warning(`Field "${f.label}" has no key`); return }
        }
      }
    }

    setSaving(true)
    try {
      const defPayload = def as unknown as Record<string, unknown>
      if (isNew) {
        await createWorkflowTemplate({
          name:        values.name,
          slug:        values.slug,
          description: values.description,
          category:    values.category,
          definition:  defPayload,
        })
        message.success('Template created')
      } else {
        await updateWorkflowTemplate(id!, {
          name:        values.name,
          description: values.description,
          category:    values.category,
          is_active:   values.is_active,
          definition:  defPayload,
        })
        message.success('Template saved')
      }
      navigate('/admin/workflow-templates')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const totalScreens = def.sections.reduce((a, s) => a + s.screens.length, 0)
  const totalFields  = def.sections.reduce((a, s) => a + s.screens.reduce((b, sc) => b + sc.fields.length, 0), 0)

  const breadcrumbName = isNew ? 'New Template' : (template?.name ?? '…')

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="workflow-templates" />

        <main className={styles.main}>
          {/* ── Top bar ── */}
          <div className={styles.topBar}>
            <nav className={styles.breadcrumb}>
              <span className={styles.breadLink} onClick={() => navigate('/admin')}>
                <HomeOutlined /> Admin
              </span>
              <span className={styles.breadSep}>/</span>
              <span className={styles.breadLink} onClick={() => navigate('/admin/workflow-templates')}>
                Experiment Templates
              </span>
              <span className={styles.breadSep}>/</span>
              <span className={styles.breadCurrent}>{breadcrumbName}</span>
            </nav>
            <div className={styles.topActions}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/admin/workflow-templates')}
              >
                Back
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                className={styles.saveBtn}
                onClick={handleSave}
              >
                {isNew ? 'Create Template' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState}><Spin size="large" /></div>
          ) : (
            <div className={styles.editorLayout}>

              {/* ── Left: metadata panel ── */}
              <div className={styles.metaPanel}>
                <div className={styles.panelTitle}>Template Info</div>
                <Form form={metaForm} layout="vertical" requiredMark={false} className={styles.metaForm}>
                  <Form.Item
                    name="name"
                    label="Template Name"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <Input
                      placeholder="e.g. ADC Stability Study"
                      onChange={e => {
                        if (isNew) metaForm.setFieldValue('slug', toSlug(e.target.value))
                      }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="slug"
                    label="Slug"
                    rules={[{ required: true, message: 'Required' }]}
                    extra={isNew ? 'Auto-generated from name. Cannot be changed later.' : undefined}
                  >
                    <Input placeholder="e.g. adc_stability" disabled={!isNew} />
                  </Form.Item>
                  <Form.Item name="category" label="Category">
                    <Input placeholder="e.g. ADC, Formulation, Stability" />
                  </Form.Item>
                  <Form.Item name="description" label="Description">
                    <Input.TextArea
                      rows={3}
                      placeholder="Brief description of when this template is used"
                    />
                  </Form.Item>
                  {!isNew && (
                    <Form.Item name="is_active" label="Active" valuePropName="checked">
                      <Switch size="small" />
                    </Form.Item>
                  )}
                </Form>

                {/* Stats */}
                <div className={styles.statsBlock}>
                  <div className={styles.statRow}>
                    <LayoutOutlined />
                    <span>{def.sections.length} section{def.sections.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.statRow}>
                    <AppstoreOutlined />
                    <span>{totalScreens} screen{totalScreens !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.statRow}>
                    <UnorderedListOutlined />
                    <span>{totalFields} field{totalFields !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {!isNew && template && (
                  <div className={styles.versionBadge}>
                    Version {template.version} · Last updated {template.updated_at?.slice(0, 10)}
                  </div>
                )}
              </div>

              {/* ── Right: field builder ── */}
              <div className={styles.builderPanel}>
                <div className={styles.builderHeader}>
                  <div className={styles.builderTitle}>Field Configuration</div>
                  <div className={styles.builderHint}>
                    Sections group related screens. Screens map to a step in the experiment workflow.
                    Fields are what scientists fill in on each screen.
                  </div>
                </div>

                {def.sections.length === 0 ? (
                  <div className={styles.emptyBuilder}>
                    <LayoutOutlined className={styles.emptyBuilderIcon} />
                    <div className={styles.emptyBuilderText}>No sections yet</div>
                    <div className={styles.emptyBuilderSub}>
                      Add a section to start building your experiment template
                    </div>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={addSection}
                      className={styles.saveBtn}
                    >
                      Add First Section
                    </Button>
                  </div>
                ) : (
                  <div className={styles.sectionsList}>
                    {def.sections.map((sec, sIdx) => (
                      <SectionBlock
                        key={sIdx}
                        section={sec}
                        index={sIdx}
                        onChange={updated => updateSection(sIdx, updated)}
                        onDelete={() => removeSection(sIdx)}
                      />
                    ))}
                    <Button
                      icon={<PlusOutlined />}
                      type="dashed"
                      className={styles.addSectionBtn}
                      onClick={addSection}
                    >
                      Add Section
                    </Button>
                  </div>
                )}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default WorkflowTemplateConfigurePage
