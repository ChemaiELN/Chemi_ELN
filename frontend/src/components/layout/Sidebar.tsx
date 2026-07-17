import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  LayoutDashboard,
  FlaskConical,
  Package2,
  ClipboardList,
  Factory,
  Cpu,
  Link2,
  FileBarChart2,
  History,
  ListChecks,
  CalendarClock,
  CalendarCheck2,
  ClipboardCheck,
  Wrench,
  Clock,
  Boxes,
} from 'lucide-react'
import logo from '../../assets/logo.svg'
import smallLogo from '../../assets/small-logo.png'

type MenuItem = Required<MenuProps>['items'][number]

const INVENTORY_GROUP_KEYS = [
  'group-stock',
  'group-maintenance',
  'group-reporting',
]

function makeInventoryItems(): MenuItem[] {
  return [
    {
      key: '/inventory',
      icon: <LayoutDashboard size={15} />,
      label: 'Dashboard',
    },
    {
      key: 'group-stock',
      icon: <Boxes size={15} />,
      label: 'Stock & Materials',
      children: [
        {
          key: '/inventory/materials',
          icon: <FlaskConical size={15} />,
          label: 'Materials Master',
        },
        {
          key: '/inventory/batches',
          icon: <Package2 size={15} />,
          label: 'Stock on Hand',
        },
        {
          key: '/inventory/stock-requests',
          icon: <ClipboardList size={15} />,
          label: 'Stock Indent',
        },
        {
          key: '/inventory/manufacturers',
          icon: <Factory size={15} />,
          label: 'Manufacturers / Vendor',
        },
        {
          key: '/inventory/mappings',
          icon: <Link2 size={15} />,
          label: 'Material vs Mfr Mappings',
        },
      ],
    },
    {
      key: 'group-maintenance',
      icon: <Wrench size={15} />,
      label: 'Maintenance & Calibration',
      children: [
        {
          key: '/inventory/equipment',
          icon: <Cpu size={15} />,
          label: 'Equipment / Instruments',
        },
        {
          key: '/inventory/checklists',
          icon: <ListChecks size={15} />,
          label: 'Checklists',
        },
        {
          key: '/inventory/maintenance-planner',
          icon: <CalendarClock size={15} />,
          label: 'Maintenance Planner',
        },
        {
          key: '/inventory/calibration-planner',
          icon: <CalendarCheck2 size={15} />,
          label: 'Calibration Planner',
        },
        {
          key: '/inventory/maintenance-requests',
          icon: <ClipboardCheck size={15} />,
          label: 'Maintenance Requests',
        },
        {
          key: '/inventory/calibration-requests',
          icon: <ClipboardCheck size={15} />,
          label: 'Calibration Requests',
        },
        {
          key: '/inventory/work-orders',
          icon: <Wrench size={15} />,
          label: 'Work Orders',
        },
        {
          key: '/inventory/equipment-usage-logs',
          icon: <Clock size={15} />,
          label: 'Equipment Usage Logs',
        },
        {
          key: '/inventory/instrument-usage-logs',
          icon: <Clock size={15} />,
          label: 'Instrument Usage Logs',
        },
      ],
    },
    {
      key: 'group-reporting',
      icon: <FileBarChart2 size={15} />,
      label: 'Reporting',
      children: [
        {
          key: '/inventory/reports',
          icon: <FileBarChart2 size={15} />,
          label: 'Reports',
        },
        {
          key: '/inventory/audit-trail',
          icon: <History size={15} />,
          label: 'Audit Trail',
        },
      ],
    },
  ]
}

interface SidebarProps {
  collapsed: boolean
  onItemClick?: () => void
}

export default function Sidebar({
  collapsed,
  onItemClick,
}: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Only one group open at a time
  const [openKeys, setOpenKeys] = useState<string[]>(['group-stock'])

  const handleSelect: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    onItemClick?.()
  }

  const handleOpenChange = (keys: string[]) => {
    if (collapsed) return

    const latestOpenKey = keys.find(
      key => !openKeys.includes(key)
    )

    if (latestOpenKey && INVENTORY_GROUP_KEYS.includes(latestOpenKey)) {
      setOpenKeys([latestOpenKey])
    } else {
      setOpenKeys([])
    }
  }

  const sidebarW = collapsed ? 'w-[64px]' : 'w-56'

  return (
    <aside
      className={`glass-sidebar flex flex-col ${sidebarW} min-h-screen shrink-0 transition-all duration-200 overflow-hidden`}
      style={{ position: 'relative' }}
    >
      {/* Brand */}
      <div
        className={`flex items-center ${
          collapsed ? 'justify-center px-2' : 'px-4'
        } border-b border-white/40 shrink-0`}
        style={{ height: 52, backgroundColor: '#FEFEFA' }}
      >
        <img
          src={collapsed ? smallLogo : logo}
          alt="Logo"
          className={
            collapsed
              ? 'h-8 w-8 object-contain'
              : 'h-9 w-auto object-contain'
          }
        />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {!collapsed && (
          <p className="text-violet-500/80 text-[10px] font-bold uppercase tracking-widest px-5 mb-1 mt-3">
            Inventory
          </p>
        )}

        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[location.pathname]}
          // When collapsed, leave openKeys uncontrolled (undefined) so Ant Design
          // manages the hover fly-out popups itself; pinning it to [] would suppress
          // them. The controlled accordion only applies when expanded.
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={handleOpenChange}
          items={makeInventoryItems()}
          onClick={handleSelect}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 13,
            width: '100%',
          }}
          inlineIndent={12}
        />
      </div>
    </aside>
  )
}