import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import { FolderOpen, BookOpen, FlaskConical, FileText, LayoutDashboard, List, TestTubes, GitBranch, Sheet } from 'lucide-react'
import logo from '../../assets/logo.svg'
import smallLogo from '../../assets/small-logo.png'
import { useCan } from '../../hooks/usePrivilege'
import { useIsAdcAssignedOnly } from '../../hooks/useAdcLanding'

type MenuItem = Required<MenuProps>['items'][number]

interface AdcNavPrivileges {
  assignedOnly: boolean
  hodDashboard: boolean
  tlDashboard: boolean
  viewNotebooks: boolean
  viewExperiments: boolean
  manageWorkflowTemplates: boolean
  manageCalcTemplates: boolean
}

/**
 * Menu is derived entirely from department-role privileges (configured in
 * Admin → Department/Role → Role Privileges) rather than hardcoded role codes.
 * Users whose home is the assigned-only notebooks view get the restricted menu.
 */
function makeAdcItems(p: AdcNavPrivileges): MenuItem[] {
  const items: MenuItem[] = []

  if (p.assignedOnly) {
    items.push(
      { key: '/adc/my-notebooks', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
      { key: '/adc/atr',          icon: <TestTubes size={15} />,       label: 'ATR' },
    )
    return items
  }

  const isDashboard = p.hodDashboard || p.tlDashboard
  items.push({
    key:   '/adc/projects',
    icon:  isDashboard ? <LayoutDashboard size={15} /> : <FolderOpen size={15} />,
    label: isDashboard ? 'Dashboard' : 'Projects',
  })
  if (p.hodDashboard) {
    items.push({ key: '/adc/hod-projects', icon: <List size={15} />, label: 'All Projects' })
  }
  if (p.viewNotebooks) {
    items.push({ key: '/notebooks', icon: <BookOpen size={15} />, label: 'Notebooks' })
  }
  if (p.viewExperiments) {
    items.push({ key: '/adc/experiments', icon: <FlaskConical size={15} />, label: 'Experiments' })
  }
  items.push(
    { key: '/adc/atr',     icon: <TestTubes size={15} />, label: 'ATR' },
    { key: '/adc/reports', icon: <FileText size={15} />,  label: 'Reports' },
  )
  if (p.manageWorkflowTemplates) {
    items.push({ key: '/adc/workflow-templates', icon: <GitBranch size={15} />, label: 'Workflow Templates' })
  }
  if (p.manageCalcTemplates) {
    items.push({ key: '/adc/calc-templates', icon: <Sheet size={15} />, label: 'Calc Templates' })
  }
  return items
}

interface AdcSidebarProps {
  collapsed: boolean
  onItemClick?: () => void
}

export default function AdcSidebar({ collapsed, onItemClick }: AdcSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const navPrivileges: AdcNavPrivileges = {
    assignedOnly:    useIsAdcAssignedOnly(),
    hodDashboard:    useCan('adc.dashboard.hod'),
    tlDashboard:     useCan('adc.dashboard.tl'),
    viewNotebooks:   useCan('adc.notebook.view'),
    viewExperiments: useCan('adc.experiment.view'),
    manageWorkflowTemplates: useCan('adc.workflow_templates.manage'),
    manageCalcTemplates:     useCan('adc.calc_templates.manage'),
  }

  const handleSelect: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    onItemClick?.()
  }

  // Highlight active nav item based on current path
  const selectedKey = location.pathname.startsWith('/adc/my-notebooks')
    ? '/adc/my-notebooks'
    : location.pathname.startsWith('/adc/workflow-templates')
    ? '/adc/workflow-templates'
    : location.pathname.startsWith('/adc/calc-templates')
    ? '/adc/calc-templates'
    : location.pathname.startsWith('/adc/atr')
    ? '/adc/atr'
    : location.pathname.startsWith('/adc/hod-projects')
      ? '/adc/hod-projects'
      : location.pathname.startsWith('/notebooks')
        ? '/notebooks'
        : location.pathname.startsWith('/adc/reports')
          ? '/adc/reports'
          : location.pathname.startsWith('/adc/experiments')
            ? '/adc/experiments'
            : location.pathname.startsWith('/adc/projects')
              ? '/adc/projects'
              : '/adc'

  const sidebarW = collapsed ? 'w-[64px]' : 'w-56'

  return (
    <aside
      className={`glass-sidebar flex flex-col ${sidebarW} min-h-screen shrink-0 transition-all duration-200 overflow-hidden`}
      style={{ position: 'relative' }}
    >
      {/* Brand */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} border-b border-white/40 shrink-0`}
        style={{ height: 52, backgroundColor: '#FEFEFA' }}
      >
        <img
          src={collapsed ? smallLogo : logo}
          alt="Logo"
          className={collapsed ? 'h-8 w-8 object-contain' : 'h-9 w-auto object-contain'}
        />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {!collapsed && (
          <p className="text-violet-500/80 text-[10px] font-bold uppercase tracking-widest px-5 mb-1 mt-3">ADC</p>
        )}
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          items={makeAdcItems(navPrivileges)}
          onClick={handleSelect}
          style={{ background: 'transparent', border: 'none', fontSize: 13, width: '100%' }}
          inlineIndent={12}
        />
      </div>
    </aside>
  )
}
