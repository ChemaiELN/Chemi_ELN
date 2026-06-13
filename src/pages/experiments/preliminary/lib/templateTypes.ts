export interface WorkflowFieldDef {
  key: string
  label: string
  type: string
  required: boolean
  placeholder?: string
  options: string[]
}

export interface WorkflowScreenDef {
  key: string
  title: string
  persona: string
  has_signature: boolean
  has_files: boolean
  fields: WorkflowFieldDef[]
}

export interface WorkflowSectionDef {
  key: string
  title: string
  screens: WorkflowScreenDef[]
}

export interface WorkflowDefinition {
  sections: WorkflowSectionDef[]
}

export interface FlatScreen {
  sectionKey: string
  sectionTitle: string
  screen: WorkflowScreenDef
}

export function parseWorkflowDefinition(raw?: Record<string, unknown> | null): WorkflowDefinition {
  const sections = (raw?.sections as WorkflowSectionDef[] | undefined) ?? []
  return {
    sections: sections.map(sec => ({
      key: sec.key ?? '',
      title: sec.title ?? '',
      screens: (sec.screens ?? []).map(sc => ({
        key: sc.key ?? '',
        title: sc.title ?? '',
        persona: sc.persona ?? '',
        has_signature: !!sc.has_signature,
        has_files: !!sc.has_files,
        fields: (sc.fields ?? []).map(f => ({
          key: f.key ?? '',
          label: f.label ?? '',
          type: f.type ?? 'text',
          required: !!f.required,
          placeholder: f.placeholder ?? '',
          options: f.options ?? [],
        })),
      })),
    })),
  }
}

export function flattenScreens(def: WorkflowDefinition): FlatScreen[] {
  const items: FlatScreen[] = []
  for (const section of def.sections) {
    for (const screen of section.screens) {
      items.push({ sectionKey: section.key, sectionTitle: section.title, screen })
    }
  }
  return items
}

export function firstWorkflowScreen(def: WorkflowDefinition): { sectionKey: string; screenKey: string } | null {
  const flat = flattenScreens(def)
  if (!flat.length) return null
  return { sectionKey: flat[0].sectionKey, screenKey: flat[0].screen.key }
}

export function sectionShortLabel(title: string, index: number): string {
  const match = title.match(/^[\d.]+/)
  return match ? match[0] : String(index + 1)
}
