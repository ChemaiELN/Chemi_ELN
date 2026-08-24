import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Select, Checkbox, Button, Empty, Input, message, Tooltip } from 'antd'
import { Save, ChevronDown, Check, Search } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { ApiError } from '../../api/client'
import BrandSpinner from '../../components/ui/BrandSpinner'

type Catalog = { groups: { group: string; privileges: { key: string; name: string; description: string }[] }[] } | undefined
type Module = 'ADC' | 'CGT'

/**
 * Department + Role → operation privilege matrix.
 *
 * Nothing is granted by default: an unticked box means denied, enforced both
 * here in the UI and on the API. The catalog itself comes from the backend
 * (shared/privilegeCatalog.ts), so adding privileges or whole modules later
 * needs no change to this page.
 */
export default function DepartmentRolePrivilegesPage() {
  const qc = useQueryClient()
  const [deptId, setDeptId] = useState<string | undefined>()
  const [roleId, setRoleId] = useState<string | undefined>()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeModule, setActiveModule] = useState<Module>('ADC')
  const [activeGroupKey, setActiveGroupKey] = useState<string | undefined>()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [msg, ctx] = message.useMessage()

  const { data: depts = [] } = useQuery({ queryKey: ['departments'], queryFn: () => adminApi.listDepts() })
  const { data: allRoles = [] } = useQuery({ queryKey: ['roles', true], queryFn: () => adminApi.listRoles(true) })
  const { data: deptRoleMap = [] } = useQuery({ queryKey: ['dept-role-mapping'], queryFn: () => adminApi.listDeptRoleMapping() })
  const { data: adcCatalog, isLoading: adcCatalogLoading } = useQuery({
    queryKey: ['privilege-catalog', 'ADC'],
    queryFn: () => adminApi.getPrivilegeCatalog('ADC'),
  })
  const { data: cgtCatalog, isLoading: cgtCatalogLoading } = useQuery({
    queryKey: ['privilege-catalog', 'CGT'],
    queryFn: () => adminApi.getPrivilegeCatalog('CGT'),
  })
  const catalogLoading = adcCatalogLoading || cgtCatalogLoading

  // Roles offered for the chosen department, mirroring the dept-role mapping
  // used by the Users and Department Users screens.
  const rolesForDept = useMemo(() => {
    if (!deptId) return allRoles
    const allowed = deptRoleMap.find((m) => m.department_id === deptId)?.role_ids
    if (!allowed) return allRoles
    const base = allRoles.filter((r) => allowed.includes(r.id))
    const superAdmin = allRoles.find((r) => r.code === 'SUPER_ADMIN')
    return superAdmin && !base.some((r) => r.id === superAdmin.id) ? [...base, superAdmin] : base
  }, [deptId, allRoles, deptRoleMap])

  const bothChosen = !!deptId && !!roleId

  const { data: grants, isLoading: grantsLoading, isFetching: grantsFetching } = useQuery({
    queryKey: ['dept-role-privileges', deptId, roleId],
    queryFn: () => adminApi.getDeptRolePrivileges(deptId!, roleId!),
    enabled: bothChosen,
  })

  // Reset local edits whenever a different pair is loaded.
  useEffect(() => {
    setSelected(new Set(grants?.granted ?? []))
  }, [grants])

  const activeCatalog: Catalog = activeModule === 'ADC' ? adcCatalog : cgtCatalog
  const activeGroups = activeCatalog?.groups ?? []

  // Default to every group expanded and the first group active whenever the
  // visible module's catalog (re)loads or the tab changes.
  useEffect(() => {
    setExpandedGroups(new Set(activeGroups.map((g) => g.group)))
    setActiveGroupKey(activeGroups[0]?.group)
    setSearch('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule, activeCatalog])

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return activeGroups
    return activeGroups
      .map((g) => ({
        ...g,
        privileges: g.privileges.filter((p) =>
          p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term) || g.group.toLowerCase().includes(term)),
      }))
      .filter((g) => g.privileges.length > 0)
  }, [activeGroups, search])

  const scrollToGroup = (group: string) => {
    setActiveGroupKey(group)
    groupRefs.current[group]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleGroupExpanded = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const allKeys = useMemo(
    () => [...(adcCatalog?.groups ?? []), ...(cgtCatalog?.groups ?? [])].flatMap((g) => g.privileges.map((p) => p.key)),
    [adcCatalog, cgtCatalog],
  )

  const savedSet = useMemo(() => new Set(grants?.granted ?? []), [grants])
  const dirty = useMemo(() => {
    if (!bothChosen) return false
    if (selected.size !== savedSet.size) return true
    for (const k of selected) if (!savedSet.has(k)) return true
    return false
  }, [selected, savedSet, bothChosen])

  // How many of the currently-visible module's keys differ from what's saved
  // — drives the bottom "N unsaved changes in <module> privileges" bar.
  const activeModuleChangedCount = useMemo(() => {
    const keys = activeGroups.flatMap((g) => g.privileges.map((p) => p.key))
    return keys.filter((k) => selected.has(k) !== savedSet.has(k)).length
  }, [activeGroups, selected, savedSet])

  const onSave = useMutation({
    mutationFn: () => adminApi.saveDeptRolePrivileges({
      department_id: deptId!,
      role_id: roleId!,
      // Send every catalog key so unticking persists as an explicit deny.
      grants: allKeys.map((key) => ({ privilege_key: key, is_granted: selected.has(key) })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dept-role-privileges', deptId, roleId] })
      msg.success('Privileges saved.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save privileges.'),
  })

  const toggle = (key: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleGroup = (keys: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)))
      return next
    })
  }

  return (
    <div className="p-4 md:p-6">
      {ctx}

      {/* Selectors */}
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-slate-600">Department<span className="text-red-500 ml-0.5">*</span></span>
          <Select
            value={deptId}
            onChange={(v) => { setDeptId(v); setRoleId(undefined) }}
            placeholder="Select Department"
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            options={depts.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-slate-600">Role<span className="text-red-500 ml-0.5">*</span></span>
          <Select
            value={roleId}
            onChange={(v) => setRoleId(v)}
            placeholder={deptId ? 'Select Role' : 'Select a department first'}
            disabled={!deptId}
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            options={rolesForDept.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
          />
        </div>
        <div className="flex-1" />
        {dirty && <span className="text-[12px] text-amber-600">Unsaved changes</span>}
        <Tooltip title={bothChosen ? undefined : 'Select a department and role first'}>
          <Button
            type="primary"
            icon={<Save size={14} />}
            disabled={!bothChosen || !dirty}
            loading={onSave.isPending}
            onClick={() => onSave.mutate()}
            className="rounded-md font-medium"
          >
            Save
          </Button>
        </Tooltip>
      </div>

      {/* Matrix */}
      {!bothChosen ? (
        <div className="glass-card rounded-lg overflow-hidden py-16">
          <Empty description="Select a department and role to configure privileges" />
        </div>
      ) : catalogLoading || grantsLoading ? (
        <div className="glass-card rounded-lg overflow-hidden py-16"><BrandSpinner fullScreen={false} label="Loading privileges…" /></div>
      ) : (
        <div className={grantsFetching ? 'opacity-60 transition-opacity' : ''}>
          {/* Module tabs — each with a granted/total count and a mini progress bar */}
          <div className="flex gap-8 border-b border-slate-100 mb-4">
            {(['ADC', 'CGT'] as Module[]).map((m) => {
              const groups = (m === 'ADC' ? adcCatalog : cgtCatalog)?.groups ?? []
              const keys = groups.flatMap((g) => g.privileges.map((p) => p.key))
              const granted = keys.filter((k) => selected.has(k)).length
              const pct = keys.length ? Math.round((granted / keys.length) * 100) : 0
              const isActive = activeModule === m
              return (
                <button
                  key={m}
                  onClick={() => setActiveModule(m)}
                  className={`pb-2 text-left ${isActive ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold uppercase tracking-wide">{m}</span>
                    <span className="text-[11px] font-medium">{granted}/{keys.length}</span>
                  </span>
                  <span className="block h-[3px] w-24 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                    <span
                      className={`block h-full rounded-full transition-all ${isActive ? 'bg-violet-500' : 'bg-slate-300'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </button>
              )
            })}
          </div>

          <Input
            prefix={<Search size={13} className="text-slate-400" />}
            placeholder={`Search ${activeModule} privileges…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            className="rounded-md mb-4"
            style={{ maxWidth: 360 }}
          />

          <div className="flex gap-4 items-start">
            {/* Groups nav — click to jump to a section; counts always reflect the unfiltered catalog */}
            <div className="w-48 shrink-0 hidden md:block">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">Groups</p>
              <div className="flex flex-col gap-0.5">
                {activeGroups.map((g) => {
                  const keys = g.privileges.map((p) => p.key)
                  const granted = keys.filter((k) => selected.has(k)).length
                  const isActive = activeGroupKey === g.group
                  return (
                    <button
                      key={g.group}
                      onClick={() => scrollToGroup(g.group)}
                      className={`text-left px-3 py-2 rounded-md text-[13px] flex items-center justify-between transition-colors ${
                        isActive
                          ? 'bg-violet-50 text-violet-700 font-medium border-l-2 border-violet-500'
                          : 'text-slate-600 hover:bg-slate-50 border-l-2 border-transparent'
                      }`}
                    >
                      <span className="truncate">{g.group}</span>
                      <span className="text-[11px] text-slate-400 ml-1 shrink-0">{granted}/{keys.length}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Privilege list */}
            <div className="glass-card rounded-lg overflow-hidden flex-1 min-w-0 max-h-[65vh] overflow-y-auto">
              {filteredGroups.length === 0 ? (
                <Empty className="py-12" description="No privileges match your search" />
              ) : filteredGroups.map((g) => {
                const keys = g.privileges.map((p) => p.key)
                const grantedCount = keys.filter((k) => selected.has(k)).length
                const isExpanded = expandedGroups.has(g.group)
                const pct = keys.length ? Math.round((grantedCount / keys.length) * 100) : 0
                return (
                  <div key={g.group} ref={(el) => { groupRefs.current[g.group] = el }} className="border-b border-slate-50 last:border-b-0">
                    <div className="px-4 py-3 flex items-center gap-2 bg-slate-50/60">
                      <button onClick={() => toggleGroupExpanded(g.group)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isExpanded ? '' : '-rotate-90'}`} />
                        <span className="text-[13px] font-semibold text-slate-800 truncate">{g.group}</span>
                        <span className="text-[12px] text-slate-400 shrink-0">{grantedCount}/{keys.length}</span>
                        <span className="hidden lg:block h-1 w-28 rounded-full bg-slate-200 overflow-hidden shrink-0">
                          <span className="block h-full rounded-full bg-violet-400" style={{ width: `${pct}%` }} />
                        </span>
                      </button>
                      <button
                        onClick={() => toggleGroup(keys, grantedCount !== keys.length)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600 flex items-center gap-1 shrink-0"
                      >
                        <Check size={11} /> All
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="divide-y divide-slate-50">
                        {g.privileges.map((p) => {
                          const checked = selected.has(p.key)
                          const changed = checked !== savedSet.has(p.key)
                          return (
                            <div
                              key={p.key}
                              className={`flex items-start gap-3 py-3 px-4 ${changed ? 'border-l-2 border-violet-500 bg-violet-50/40' : 'border-l-2 border-transparent'}`}
                            >
                              <Checkbox checked={checked} onChange={(e) => toggle(p.key, e.target.checked)} className="mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-slate-800">{p.name}</p>
                                <p className="text-[12px] text-slate-500 mt-0.5">{p.description}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sticky save/discard bar — only for the module currently being edited */}
          {activeModuleChangedCount > 0 && (
            <div className="sticky bottom-0 mt-4 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] flex items-center justify-between z-10">
              <span className="text-[13px] text-red-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {activeModuleChangedCount} unsaved change{activeModuleChangedCount === 1 ? '' : 's'} in {activeModule} privileges
              </span>
              <div className="flex gap-2">
                <Button onClick={() => setSelected(new Set(savedSet))} className="rounded-md">Discard</Button>
                <Button
                  type="primary"
                  icon={<Save size={14} />}
                  loading={onSave.isPending}
                  onClick={() => onSave.mutate()}
                  className="rounded-md font-medium"
                >
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
