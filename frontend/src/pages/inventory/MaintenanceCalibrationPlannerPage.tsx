import { Tabs } from 'antd'
import { useSearchParams } from 'react-router-dom'
import PlannerPage from './PlannerPage'

export default function MaintenanceCalibrationPlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeKey = searchParams.get('tab') === 'calibration' ? 'calibration' : 'maintenance'

  return (
    <div className="p-4 md:p-6">
      <Tabs
        activeKey={activeKey}
        onChange={key => setSearchParams({ tab: key })}
        items={[
          { key: 'maintenance', label: 'Maintenance Planner', children: <PlannerPage targetKind="EQUIPMENT" /> },
          { key: 'calibration', label: 'Calibration Planner', children: <PlannerPage targetKind="INSTRUMENT" /> },
        ]}
      />
    </div>
  )
}
