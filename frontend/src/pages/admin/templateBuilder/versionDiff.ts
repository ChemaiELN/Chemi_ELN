// Structural diff between two workflow template definitions (section →
// screen → field), matched by `id` at each level. Independent of any other
// module's diffing/version-history code — written fresh for the Template
// Builder's version comparison feature.
import type { TemplateDefinition, TemplateSection, TemplateScreen, TemplateField } from './types'

export type DiffKind = 'added' | 'removed' | 'modified'

export interface DiffEntry {
  kind: DiffKind
  level: 'section' | 'screen' | 'field'
  path: string          // human-readable breadcrumb, e.g. "Buffer Prep > Screen 1"
  label: string         // the section/screen/field's own title/label
  changes?: string[]    // for 'modified': list of "prop changed from X to Y"
}

const FIELD_COMPARE_PROPS: Array<[keyof TemplateField, string]> = [
  ['label', 'Label'],
  ['type', 'Type'],
  ['required', 'Required'],
  ['readOnly', 'Read-only'],
  ['hidden', 'Hidden'],
  ['helpText', 'Help text'],
  ['placeholder', 'Placeholder'],
  ['defaultValue', 'Default value'],
  ['options', 'Options'],
  ['minValue', 'Min value'],
  ['maxValue', 'Max value'],
  ['minLength', 'Min length'],
  ['maxLength', 'Max length'],
  ['regex', 'Regex'],
]

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === '') return 'empty'
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'empty'
  return String(v)
}

function diffFields(oldFields: TemplateField[], newFields: TemplateField[], pathPrefix: string): DiffEntry[] {
  const out: DiffEntry[] = []
  const oldById = new Map(oldFields.map((f) => [f.id, f]))
  const newById = new Map(newFields.map((f) => [f.id, f]))

  for (const f of newFields) {
    if (!oldById.has(f.id)) {
      out.push({ kind: 'added', level: 'field', path: pathPrefix, label: f.label || f.name })
    }
  }
  for (const f of oldFields) {
    if (!newById.has(f.id)) {
      out.push({ kind: 'removed', level: 'field', path: pathPrefix, label: f.label || f.name })
    }
  }
  for (const f of newFields) {
    const before = oldById.get(f.id)
    if (!before) continue
    const changes: string[] = []
    for (const [prop, propLabel] of FIELD_COMPARE_PROPS) {
      const a = before[prop]
      const b = f[prop]
      if (JSON.stringify(a) === JSON.stringify(b)) continue
      changes.push(`${propLabel} changed from ${fmt(a)} to ${fmt(b)}`)
    }
    if (changes.length) {
      out.push({ kind: 'modified', level: 'field', path: pathPrefix, label: f.label || f.name, changes })
    }
  }
  return out
}

function diffScreens(oldScreens: TemplateScreen[], newScreens: TemplateScreen[], pathPrefix: string): DiffEntry[] {
  const out: DiffEntry[] = []
  const oldById = new Map(oldScreens.map((s) => [s.id, s]))
  const newById = new Map(newScreens.map((s) => [s.id, s]))

  for (const s of newScreens) {
    if (!oldById.has(s.id)) out.push({ kind: 'added', level: 'screen', path: pathPrefix, label: s.title })
  }
  for (const s of oldScreens) {
    if (!newById.has(s.id)) out.push({ kind: 'removed', level: 'screen', path: pathPrefix, label: s.title })
  }
  for (const s of newScreens) {
    const before = oldById.get(s.id)
    if (!before) continue
    const screenPath = `${pathPrefix} > ${s.title}`
    if (before.title !== s.title || before.columns !== s.columns) {
      out.push({
        kind: 'modified', level: 'screen', path: pathPrefix, label: s.title,
        changes: [
          ...(before.title !== s.title ? [`Title changed from ${before.title} to ${s.title}`] : []),
          ...(before.columns !== s.columns ? [`Columns changed from ${before.columns} to ${s.columns}`] : []),
        ],
      })
    }
    out.push(...diffFields(before.fields, s.fields, screenPath))
  }
  return out
}

export function diffTemplateDefinitions(oldDef: TemplateDefinition | null | undefined, newDef: TemplateDefinition | null | undefined): DiffEntry[] {
  const oldSections = oldDef?.sections ?? []
  const newSections = newDef?.sections ?? []
  const out: DiffEntry[] = []
  const oldById = new Map(oldSections.map((s) => [s.id, s]))
  const newById = new Map(newSections.map((s) => [s.id, s]))

  for (const s of newSections) {
    if (!oldById.has(s.id)) out.push({ kind: 'added', level: 'section', path: s.title, label: s.title })
  }
  for (const s of oldSections) {
    if (!newById.has(s.id)) out.push({ kind: 'removed', level: 'section', path: s.title, label: s.title })
  }
  for (const s of newSections) {
    const before = oldById.get(s.id)
    if (!before) continue
    if (before.title !== s.title) {
      out.push({ kind: 'modified', level: 'section', path: s.title, label: s.title, changes: [`Title changed from ${before.title} to ${s.title}`] })
    }
    out.push(...diffScreens(before.screens, s.screens, s.title))
  }
  return out
}
