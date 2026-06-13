import { useState } from 'react'
import { Layout } from 'antd'
import type { InvView } from './types'
import InventorySidebar from './components/InventorySidebar'
import Header from '@/common/Header'

// Views
import DashboardView              from './views/DashboardView'
import MaterialsView              from './views/MaterialsView'
import ManufacturersView          from './views/ManufacturersView'
import MappingsView               from './views/MappingsView'
import AuditTrailView             from './views/AuditTrailView'
import BatchesAvailableView       from './views/BatchesAvailableView'
import BatchesNonAvailableView    from './views/BatchesNonAvailableView'
import BatchesHistoricView        from './views/BatchesHistoricView'
import BatchVerificationsView     from './views/BatchVerificationsView'
import StockRequestsView          from './views/StockRequestsView'
import EquipmentTypesView         from './views/EquipmentTypesView'
import InstrumentTypesView        from './views/InstrumentTypesView'
import ColumnTypesView            from './views/ColumnTypesView'
import EquipmentCatalogueView     from './views/EquipmentCatalogueView'
import InstrumentCatalogueView    from './views/InstrumentCatalogueView'
import ColumnCatalogueView        from './views/ColumnCatalogueView'
import MaintenanceSchedulesView   from './views/MaintenanceSchedulesView'
import CalibrationSchedulesView   from './views/CalibrationSchedulesView'
import EquipmentVerificationsView from './views/EquipmentVerificationsView'
import InstrumentVerificationsView from './views/InstrumentVerificationsView'
import ReportBatchInventoryView   from './views/ReportBatchInventoryView'
import ReportExpiryView           from './views/ReportExpiryView'
import ReportStockRequestsView    from './views/ReportStockRequestsView'
import ReportEquipmentStatusView  from './views/ReportEquipmentStatusView'

import styles from './styles.module.less'

const VIEW_MAP: Record<InvView, React.ReactNode> = {
  'dashboard':                  <DashboardView />,
  'materials':                  <MaterialsView />,
  'manufacturers':              <ManufacturersView />,
  'mappings':                   <MappingsView />,
  'audit-trail':                <AuditTrailView />,
  'batches-available':          <BatchesAvailableView />,
  'batches-non-available':      <BatchesNonAvailableView />,
  'batches-historic':           <BatchesHistoricView />,
  'batch-verifications':        <BatchVerificationsView />,
  'stock-requests':             <StockRequestsView />,
  'equipment-types':            <EquipmentTypesView />,
  'instrument-types':           <InstrumentTypesView />,
  'column-types':               <ColumnTypesView />,
  'equipment-catalogue':        <EquipmentCatalogueView />,
  'instrument-catalogue':       <InstrumentCatalogueView />,
  'column-catalogue':           <ColumnCatalogueView />,
  'maintenance-schedules':      <MaintenanceSchedulesView />,
  'calibration-schedules':      <CalibrationSchedulesView />,
  'equipment-verifications':    <EquipmentVerificationsView />,
  'instrument-verifications':   <InstrumentVerificationsView />,
  'report-batch-inventory':     <ReportBatchInventoryView />,
  'report-expiry':              <ReportExpiryView />,
  'report-stock-requests':      <ReportStockRequestsView />,
  'report-equipment-status':    <ReportEquipmentStatusView />,
}

export default function InventoryPage() {
  const [activeView, setActiveView] = useState<InvView>('dashboard')

  return (
    <div className={styles.shell}>
      <Header />
      <Layout className={styles.page}>
        <InventorySidebar activeView={activeView} onSelect={setActiveView} />
        <Layout.Content className={styles.content}>
          <div className={styles.viewWrapper}>
            {VIEW_MAP[activeView]}
          </div>
        </Layout.Content>
      </Layout>
    </div>
  )
}
