import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Select, Checkbox } from 'antd'
import {
  HomeOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'

type Permission = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SUBMIT' | 'VERIFY' | 'APPROVE' | 'EXPORT'

interface ModuleRow {
  key: string
  module: string
  CREATE: boolean
  READ: boolean
  UPDATE: boolean
  DELETE: boolean
  SUBMIT: boolean
  VERIFY: boolean
  APPROVE: boolean
  EXPORT: boolean
}

const PERMISSIONS: Permission[] = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'SUBMIT', 'VERIFY', 'APPROVE', 'EXPORT']

const CHEMIST_DEFAULT: ModuleRow[] = [
  { key: 'experiments',      module: 'Experiments',      CREATE: true,  READ: true,  UPDATE: true,  DELETE: false, SUBMIT: true,  VERIFY: false, APPROVE: false, EXPORT: true  },
  { key: 'notebooks',        module: 'Notebooks',         CREATE: false, READ: true,  UPDATE: true,  DELETE: false, SUBMIT: false, VERIFY: false, APPROVE: false, EXPORT: false },
  { key: 'projects',         module: 'Projects',          CREATE: false, READ: true,  UPDATE: false, DELETE: false, SUBMIT: false, VERIFY: false, APPROVE: false, EXPORT: false },
  { key: 'atr',              module: 'ATR',               CREATE: true,  READ: true,  UPDATE: false, DELETE: false, SUBMIT: true,  VERIFY: false, APPROVE: false, EXPORT: false },
  { key: 'reports',          module: 'Reports',           CREATE: false, READ: true,  UPDATE: false, DELETE: false, SUBMIT: false, VERIFY: false, APPROVE: false, EXPORT: true  },
  { key: 'admin-panel',      module: 'Admin Panel',       CREATE: false, READ: false, UPDATE: false, DELETE: false, SUBMIT: false, VERIFY: false, APPROVE: false, EXPORT: false },
  { key: 'user-management',  module: 'User Management',   CREATE: false, READ: false, UPDATE: false, DELETE: false, SUBMIT: false, VERIFY: false, APPROVE: false, EXPORT: false },
  { key: 'settings',         module: 'Settings',          CREATE: false, READ: false, UPDATE: false, DELETE: false, SUBMIT: false, VERIFY: false, APPROVE: false, EXPORT: false },
]

const ROLE_OPTIONS = [
  { value: 'chemist', label: 'Chemist' },
  { value: 'team-lead', label: 'Team Lead' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Admin' },
]

export default function AdminRolesPage() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<string>('chemist')
  const [privileges, setPrivileges] = useState<ModuleRow[]>(CHEMIST_DEFAULT)

  const toggle = (rowKey: string, perm: Permission) => {
    setPrivileges((prev) =>
      prev.map((row) =>
        row.key === rowKey ? { ...row, [perm]: !row[perm] } : row
      )
    )
  }

  const columns: ColumnsType<ModuleRow> = [
    {
      title: 'MODULE',
      dataIndex: 'module',
      key: 'module',
      width: 160,
      className: styles.moduleCell,
    },
    ...PERMISSIONS.map((perm) => ({
      title: perm,
      key: perm,
      width: 72,
      align: 'center' as const,
      render: (_: unknown, record: ModuleRow) => (
        <Checkbox
          checked={record[perm]}
          onChange={() => toggle(record.key, perm)}
          className={styles.permCheckbox}
        />
      ),
    })),
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="master-data" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <HomeOutlined className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')} />
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbLink} onClick={() => navigate('/admin')}>Admin</span>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Role Privileges</span>
          </div>

          <h1 className={styles.pageTitle}>Role Privileges</h1>

          {/* Info banner */}
          <div className={styles.infoBanner}>
            <WarningOutlined className={styles.bannerIcon} />
            <span>Changes to role privileges take effect for new sessions. Active users will retain current permissions until re-login.</span>
          </div>

          {/* Role selector row */}
          <div className={styles.roleRow}>
            <div className={styles.roleLabel}>Role:</div>
            <Select
              options={ROLE_OPTIONS}
              value={selectedRole}
              onChange={(v) => setSelectedRole(v)}
              className={styles.roleSelect}
            />
            <div className={styles.roleRowSpacer} />
            <Button type="primary" className={styles.saveBtn}>
              Save Privileges
            </Button>
          </div>

          {/* Privileges matrix */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>Privilege Matrix — {ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label}</span>
            </div>
            <Table<ModuleRow>
              columns={columns}
              dataSource={privileges}
              pagination={false}
              size="small"
              className={styles.table}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
