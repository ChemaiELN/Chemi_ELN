import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, ConfigProvider } from 'antd'
import type { MenuProps } from 'antd'
import { FolderOpen, BookOpen, FlaskConical, FileText, LayoutDashboard, TestTubes, GitBranch, Sheet } from 'lucide-react'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import logo from '../../assets/logo.svg'
import smallLogo from '../../assets/small-logo.png'
import { useCan } from '../../hooks/usePrivilege'

// Chemists/Analysts only work within notebooks assigned to them — mirrors
// AdcSidebar's ASSIGNMENT_RESTRICTED_ROLES gate.
const ASSIGNMENT_RESTRICTED_ROLES = ['CHEM', 'ANALYST']

type MenuItem = Required<MenuProps>['items'][number]

function makeCgtItems(
  roleCode?: string | null,
  departmentCode?: string | null,
  manageWorkflowTemplates?: boolean,
  manageCalcTemplates?: boolean,
): MenuItem[] {
  const isAssignmentRestricted = ASSIGNMENT_RESTRICTED_ROLES.includes(roleCode ?? '')
  const isCgtHod = roleCode === 'HOD' && departmentCode === 'CGT'
  const isCgtTl  = roleCode === 'TL'  && departmentCode === 'CGT'
  const isCgtDashboard = isCgtHod || isCgtTl
  if (isAssignmentRestricted) {
    return [
      { key: '/cgt/my-notebooks', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
      { key: '/cgt/atr',          icon: <TestTubes size={15} />,       label: 'Test Requests' },
    ]
  }
  const items: MenuItem[] = [
    {
      key:   '/cgt/projects',
      icon:  isCgtDashboard ? <LayoutDashboard size={15} /> : <FolderOpen size={15} />,
      label: isCgtDashboard ? 'Dashboard' : 'Projects',
    },
    { key: '/cgt/notebooks',   icon: <BookOpen size={15} />,     label: 'Notebooks' },
    { key: '/cgt/experiments', icon: <FlaskConical size={15} />, label: 'Experiments' },
    { key: '/cgt/atr',         icon: <TestTubes size={15} />,    label: 'Test Requests' },
    { key: '/cgt/reports',     icon: <FileText size={15} />,     label: 'Reports' },
  ]
  if (manageWorkflowTemplates) {
    items.push({ key: '/cgt/workflow-templates', icon: <GitBranch size={15} />, label: 'Workflow Templates' })
  }
  if (manageCalcTemplates) {
    items.push({ key: '/cgt/calc-templates', icon: <Sheet size={15} />, label: 'Calc Templates' })
  }
  return items
}

interface CgtSidebarProps {
  collapsed: boolean
  onItemClick?: () => void
}

export default function CgtSidebar({ collapsed, onItemClick }: CgtSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const user     = useAppSelector(selectUser)
  const manageWorkflowTemplates = useCan('cgt.workflow_templates.manage')
  const manageCalcTemplates = useCan('cgt.calc_templates.manage')

  const handleSelect: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    onItemClick?.()
  }

  // Highlight active nav item based on current path
  const selectedKey = location.pathname.startsWith('/cgt/my-notebooks')
    ? '/cgt/my-notebooks'
    : location.pathname.startsWith('/cgt/workflow-templates')
    ? '/cgt/workflow-templates'
    : location.pathname.startsWith('/cgt/calc-templates')
    ? '/cgt/calc-templates'
    : location.pathname.startsWith('/cgt/atr')
    ? '/cgt/atr'
    : location.pathname.startsWith('/cgt/reports')
      ? '/cgt/reports'
      : location.pathname.startsWith('/cgt/experiments')
        ? '/cgt/experiments'
        : location.pathname.startsWith('/cgt/notebooks')
          ? '/cgt/notebooks'
          : location.pathname.startsWith('/cgt/projects')
            ? '/cgt/projects'
            : '/cgt'

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
          <p className="text-violet-500/80 text-[10px] font-bold uppercase tracking-widest px-5 mb-1 mt-3">CGT</p>
        )}
        <ConfigProvider theme={{ components: { Menu: {
          itemSelectedBg: '#d8b4fe4d',
          itemSelectedColor: '#7e22ce',
          itemHoverBg: 'rgba(255,255,255,0.55)',
          itemHoverColor: '#9333ea',
        }}}}>
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[selectedKey]}
            items={makeCgtItems(user?.role_code, user?.department_code, manageWorkflowTemplates, manageCalcTemplates)}
            onClick={handleSelect}
            style={{ background: 'transparent', border: 'none', fontSize: 13, width: '100%' }}
            inlineIndent={12}
          />
        </ConfigProvider>
      </div>
    </aside>
  )
}
