import { Tag } from 'antd'
import type {
  InvStatus, StockRequestStatus, VerificationStatus,
  ScheduleStatus, AssetStatus, ServiceStatus,
} from '../../types'

type AnyStatus =
  | InvStatus
  | StockRequestStatus
  | VerificationStatus
  | ScheduleStatus
  | AssetStatus
  | ServiceStatus
  | string

const COLOR_MAP: Record<string, string> = {
  // Batch / Inv status
  AVAILABLE:          'green',
  PARTIALLY_CONSUMED: 'blue',
  CONSUMED:           'default',
  EXPIRED:            'red',
  QUARANTINE:         'orange',
  // Stock request
  PENDING:            'gold',
  APPROVED:           'cyan',
  REJECTED:           'red',
  FULFILLED:          'green',
  CANCELLED:          'default',
  // Verification
  VERIFIED:           'green',
  // Schedule
  DUE:                'orange',
  IN_PROGRESS:        'processing',
  COMPLETED:          'green',
  // Asset
  ACTIVE:             'green',
  INACTIVE:           'default',
  UNDER_MAINTENANCE:  'orange',
  UNDER_CALIBRATION:  'orange',
  DECOMMISSIONED:     'red',
  // Service
  OK:                 'green',
  OVERDUE:            'red',
  EXHAUSTED:          'red',
  // Other
  LOW:                'blue',
  MEDIUM:             'gold',
  HIGH:               'orange',
  CRITICAL:           'red',
}

const LABEL_MAP: Record<string, string> = {
  PARTIALLY_CONSUMED: 'Part. Consumed',
  IN_PROGRESS:        'In Progress',
  UNDER_MAINTENANCE:  'Under Maint.',
  UNDER_CALIBRATION:  'Under Calib.',
  DECOMMISSIONED:     'Decomm.',
}

interface StatusTagProps {
  status: AnyStatus
  /** Override displayed text */
  label?: string
}

export default function StatusTag({ status, label }: StatusTagProps) {
  const color = COLOR_MAP[status] ?? 'default'
  const text  = label ?? LABEL_MAP[status] ?? status

  return (
    <Tag color={color} style={{ margin: 0, textTransform: 'capitalize' }}>
      {text}
    </Tag>
  )
}
