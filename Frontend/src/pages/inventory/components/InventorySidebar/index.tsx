import { useState } from 'react'
import { Tooltip } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons'
import type { InvView } from '../../types'
import styles from './styles.module.less'

interface NavItem {
  key: InvView
  label: string
}

interface NavGroup {
  title: string
  icon: React.ReactNode
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    icon: <DashboardOutlined />,
    items: [
      { key: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    title: 'Inv Master Data',
    icon: <AppstoreOutlined />,
    items: [
      { key: 'materials',   label: 'Materials' },
      { key: 'manufacturers', label: 'Manufacturers' },
      { key: 'mappings',    label: 'Manufacturer Mapping' },
      { key: 'audit-trail', label: 'Audit Trail' },
    ],
  },
  {
    title: 'Equip Master Data',
    icon: <ToolOutlined />,
    items: [
      { key: 'equipment-types',  label: 'Equipment Types' },
      { key: 'instrument-types', label: 'Instrument Types' },
      { key: 'column-types',     label: 'Column Types' },
    ],
  },
  {
    title: 'Inventory Batches',
    icon: <InboxOutlined />,
    items: [
      { key: 'batches-available',     label: 'Available' },
      { key: 'batches-non-available', label: 'Non-Available' },
      { key: 'batches-historic',      label: 'Historic' },
      { key: 'batch-verifications',   label: 'Batch Verifications' },
      { key: 'stock-requests',        label: 'Stock Requests' },
    ],
  },
  {
    title: 'Equipment Catalogue',
    icon: <SafetyCertificateOutlined />,
    items: [
      { key: 'equipment-catalogue',  label: 'Equipment' },
      { key: 'instrument-catalogue', label: 'Instruments' },
      { key: 'column-catalogue',     label: 'Columns' },
      { key: 'maintenance-schedules',    label: 'Maintenance' },
      { key: 'calibration-schedules',    label: 'Calibration' },
      { key: 'equipment-verifications',  label: 'Equip. Verifications' },
      { key: 'instrument-verifications', label: 'Instr. Verifications' },
    ],
  },
  {
    title: 'Reporting',
    icon: <BarChartOutlined />,
    items: [
      { key: 'report-batch-inventory',  label: 'Batch Inventory' },
      { key: 'report-expiry',           label: 'Expiry Report' },
      { key: 'report-stock-requests',   label: 'Stock Requests' },
      { key: 'report-equipment-status', label: 'Equipment Status' },
    ],
  },
]

interface InventorySidebarProps {
  activeView: InvView
  onSelect:   (view: InvView) => void
}

export default function InventorySidebar({ activeView, onSelect }: InventorySidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Start with the group containing the active view expanded, rest collapsed
  const initialOpen = NAV_GROUPS.reduce<Record<string, boolean>>((acc, g) => {
    acc[g.title] = g.items.some((i) => i.key === activeView)
    return acc
  }, {})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen)

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Toggle button */}
      <button
        className={styles.collapseBtn}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </button>

      <nav className={styles.nav}>
        {NAV_GROUPS.map((group) => {
          const isOpen = !!openGroups[group.title]
          const hasActive = group.items.some((i) => i.key === activeView)

          // Collapsed mode — show only icon with tooltip
          if (collapsed) {
            return (
              <div key={group.title} className={styles.group}>
                <Tooltip title={group.title} placement="right">
                  <button
                    className={`${styles.groupHeader} ${hasActive ? styles.groupHeaderActive : ''}`}
                    onClick={() => toggleGroup(group.title)}
                  >
                    <span className={styles.groupIcon}>{group.icon}</span>
                  </button>
                </Tooltip>
              </div>
            )
          }

          return (
            <div key={group.title} className={styles.group}>
              {/* Group header row */}
              <button
                className={`${styles.groupHeader} ${hasActive ? styles.groupHeaderActive : ''}`}
                onClick={() => toggleGroup(group.title)}
              >
                <span className={styles.groupIcon}>{group.icon}</span>
                <span className={styles.groupTitle}>{group.title}</span>
                <span className={styles.groupArrow}>
                  {isOpen ? <DownOutlined /> : <RightOutlined />}
                </span>
              </button>

              {/* Sub-items */}
              {isOpen && (
                <div className={styles.subItems}>
                  {group.items.map((item) => {
                    const isActive = activeView === item.key
                    return (
                      <button
                        key={item.key}
                        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        onClick={() => onSelect(item.key)}
                      >
                        <RightOutlined className={styles.subArrow} />
                        <span className={styles.navLabel}>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
