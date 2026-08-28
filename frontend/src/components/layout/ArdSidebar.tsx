import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  LayoutDashboard,
  Inbox,
  FileSpreadsheet,
  CheckSquare,
  FileCheck,
  FolderKanban,
  BookOpen,
  FlaskConical,
  FileText,
  Search,
  BarChart3,
  History,
  Users,
  Settings2,
  ShieldCheck,
  GitCompareArrows,
  Bell,
  KeyRound,
} from 'lucide-react'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { apiGet } from '../../api/client'
import logo from '../../assets/logo.svg'
import smallLogo from '../../assets/small-logo.png'

const CONFIG_MANAGE_ROLES = ['HOD', 'SUPER_ADMIN', 'ADMIN', 'TL', 'TEAM_LEAD']

// Hoisted so it's available to both makeArdItems and the API helpers below.
type MenuItem = Required<MenuProps>['items'][number]

// ── API-driven menu support (GAP-028) ───────────────────────────────────────

/** Lookup map: icon name string (from API) → lucide-react component. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  Inbox,
  FileSpreadsheet,
  CheckSquare,
  FileCheck,
  FolderKanban,
  BookOpen,
  FlaskConical,
  FileText,
  Search,
  BarChart3,
  History,
  Users,
  Settings2,
  ShieldCheck,
  GitCompareArrows,
  Bell,
  KeyRound,
}

interface ApiMenuItem {
  key: string
  label: string
  href: string
  group: string | null
  icon: string
}

interface ApiMenuResponse {
  items: ApiMenuItem[]
}

/** Group metadata (label + icon) matching the hardcoded makeArdItems groups. */
const GROUP_META: Record<string, { label: string; icon: string }> = {
  work:          { label: 'Work',          icon: 'FlaskConical' },
  notebook:      { label: 'ELN',           icon: 'BookOpen'     },
  ad_experiments: { label: 'AD Experiments', icon: 'FlaskConical' },
  insights:      { label: 'Insights',      icon: 'BarChart3'    },
  admin:         { label: 'Admin',         icon: 'Settings2'    },
}
const GROUP_ORDER = ['work', 'notebook', 'ad_experiments', 'insights', 'admin']

function iconEl(name: string) {
  const Comp = ICON_MAP[name]
  return Comp ? <Comp size={15} /> : null
}

/** Convert the flat API item list into nested Ant Design MenuItem tree. */
function apiItemsToMenuItems(items: ApiMenuItem[]): MenuItem[] {
  const result: MenuItem[] = []
  const groups: Record<string, MenuItem[]> = {}

  for (const item of items) {
    const node: MenuItem = { key: item.href, icon: iconEl(item.icon), label: item.label }
    if (!item.group) {
      result.push(node)
    } else {
      if (!groups[item.group]) groups[item.group] = []
      groups[item.group].push(node)
    }
  }

  for (const g of GROUP_ORDER) {
    if (groups[g]?.length) {
      const meta = GROUP_META[g]
      result.push({ key: g, icon: iconEl(meta.icon), label: meta.label, children: groups[g] })
    }
  }

  return result
}

// ────────────────────────────────────────────────────────────────────────────

function makeArdItems(roleCode?: string): MenuItem[] {
  if (roleCode === 'SE') {
    return [
      { key: '/ard/se-dashboard', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
      {
        key: 'insights',
        icon: <BarChart3 size={15} />,
        label: 'Insights',
        children: [
          { key: '/ard/reports', icon: <BarChart3 size={15} />, label: 'Reports' },
          { key: '/ard/search', icon: <Search size={15} />, label: 'Search' },
          { key: '/ard/notifications', icon: <Bell size={15} />, label: 'Notifications' },
        ],
      },
    ]
  }

  const isLabRole = !['ADMIN'].includes(roleCode ?? '')
  const isAdminOrHod = CONFIG_MANAGE_ROLES.includes(roleCode ?? '')
  // Analysts get Master Data too (Sections + Data Items only — the page
  // itself filters which tabs render) but not Audit Trail.
  const isAnalystRole = ['ANALYST', 'CHEMIST', 'CHEM'].includes(roleCode ?? '')

  const items: MenuItem[] = [
    { key: '/ard', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
  ]

  if (isLabRole) {
    items.push({
      key: '/ard/my-queue',
      icon: <Inbox size={15} />,
      label: 'My Queue',
    })
  }

  items.push(
    {
      key: 'work',
      icon: <FlaskConical size={15} />,
      label: 'Work',
      children: [
        { key: '/ard/atrs', icon: <FileSpreadsheet size={15} />, label: 'ATRs' },
        { key: '/ard/tests', icon: <CheckSquare size={15} />, label: 'Tests' },
        { key: '/ard/qc-trf', icon: <FileCheck size={15} />, label: 'TRF Forms' },
      ],
    },
    {
      key: 'notebook',
      icon: <BookOpen size={15} />,
      label: 'ELN',
      children: [
        { key: '/ard/projects', icon: <FolderKanban size={15} />, label: 'Projects' },
        { key: '/ard/notebooks', icon: <BookOpen size={15} />, label: 'Notebooks' },
        { key: '/ard/experiments', icon: <FlaskConical size={15} />, label: 'Experiments' },
        { key: '/ard/experiments/pending-review', icon: <FlaskConical size={15} />, label: 'Pending Review' },
        { key: '/ard/templates', icon: <FileText size={15} />, label: 'Templates' },
      ],
    },
    {
      // Placeholder — a new section coming right after ELN; the real screens
      // land later, this just reserves its spot in the sidebar for now.
      key: 'ad_experiments',
      icon: <FlaskConical size={15} />,
      label: 'AD Experiments',
      children: [
        { key: '/ard/ad-experiments', icon: <FlaskConical size={15} />, label: 'AD Experiments' },
      ],
    },
    {
      key: 'insights',
      icon: <BarChart3 size={15} />,
      label: 'Insights',
      children: [
        { key: '/ard/experiments/compare', icon: <GitCompareArrows size={15} />, label: 'Compare Exps' },
        { key: '/ard/reports', icon: <BarChart3 size={15} />, label: 'Reports' },
        { key: '/ard/notifications', icon: <Bell size={15} />, label: 'Notifications' },
        { key: '/ard/search', icon: <Search size={15} />, label: 'Search' },
        { key: '/ard/team', icon: <Users size={15} />, label: 'Team Directory' },
      ],
    }
  )

  if (isAdminOrHod) {
    items.push({
      key: 'admin',
      icon: <Settings2 size={15} />,
      label: 'Admin',
      children: [
        { key: '/ard/audit', icon: <History size={15} />, label: 'Audit Trail' },
        { key: '/ard/configuration', icon: <Settings2 size={15} />, label: 'Master Data' },
      ],
    })
  } else if (isAnalystRole) {
    items.push({
      key: 'admin',
      icon: <Settings2 size={15} />,
      label: 'Admin',
      children: [
        { key: '/ard/configuration', icon: <Settings2 size={15} />, label: 'Master Data' },
      ],
    })
  }

  return items
}

interface ArdSidebarProps {
  collapsed: boolean
  onItemClick?: () => void
}

export default function ArdSidebar({ collapsed, onItemClick }: ArdSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAppSelector(selectUser)
  const [openKeys, setOpenKeys] = useState<string[]>(['work', 'notebook', 'ad_experiments', 'insights', 'admin'])

  // Fetch role-filtered menu from the backend (GAP-028).
  // Falls back to the static makeArdItems() on loading or error.
  const { data: menuData } = useQuery<ApiMenuResponse>({
    queryKey: ['ard-menu', user?.role_code],
    queryFn: () => apiGet<ApiMenuResponse>('/api/ard/menu'),
    staleTime: 5 * 60 * 1000, // 5 min — menu rarely changes mid-session
  })

  const navItems: MenuItem[] = menuData
    ? apiItemsToMenuItems(menuData.items)
    : makeArdItems(user?.role_code)

  const handleSelect: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    onItemClick?.()
  }

  const path = location.pathname
  const prefixes = [
    '/ard/my-queue', '/ard/configuration', '/ard/projects', '/ard/notebooks', '/ard/atrs',
    '/ard/tests', '/ard/templates', '/ard/experiments/pending-review', '/ard/experiments/compare', '/ard/experiments',
    '/ard/ad-experiments',
    '/ard/qc-trf', '/ard/qualification-matrix', '/ard/search', '/ard/team',
    '/ard/audit', '/ard/notifications', '/ard/reports'
  ]
  const selectedKey = prefixes.find((p) => path.startsWith(p)) ?? '/ard'

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
          alt="Laurus ARD Logo"
          className={collapsed ? 'h-8 w-8 object-contain' : 'h-9 w-auto object-contain'}
        />
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {!collapsed && (
          <p className="text-violet-500/80 text-[10px] font-bold uppercase tracking-widest px-5 mb-1 mt-3">ARD</p>
        )}
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={(keys) => { if (!collapsed) setOpenKeys(keys) }}
          items={navItems}
          onClick={handleSelect}
          style={{ background: 'transparent', border: 'none', fontSize: 13, width: '100%' }}
          inlineIndent={12}
        />
      </div>

      {/* Change Password footer */}
      <div
        className={`flex items-center gap-2 px-5 py-3 text-xs text-slate-500 hover:text-violet-600 cursor-pointer transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
        onClick={() => { navigate('/change-password'); onItemClick?.() }}
        title="Change Password"
      >
        <KeyRound size={14} className="shrink-0" />
        {!collapsed && <span>Change Password</span>}
      </div>
    </aside>
  )
}
