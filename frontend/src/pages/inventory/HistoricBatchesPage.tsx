import BatchesPage from './BatchesPage'

// Same table/columns/actions as the main Batches page, pre-filtered to
// batches that have been fully consumed (status CONSUMED).
export default function HistoricBatchesPage() {
  return <BatchesPage statusFilter="historic" />
}
