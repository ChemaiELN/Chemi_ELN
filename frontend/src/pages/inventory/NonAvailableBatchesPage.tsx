import BatchesPage from './BatchesPage'

// Same table/columns/actions as the main Batches page, pre-filtered to
// batches currently RETEST (computed from retest_date) or EXPIRED.
export default function NonAvailableBatchesPage() {
  return <BatchesPage statusFilter="non_available" />
}
