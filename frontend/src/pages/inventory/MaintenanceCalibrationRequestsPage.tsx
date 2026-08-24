import RequestsPage from './RequestsPage'

// Scheduled maintenance/calibration requests moved into the Planner page
// (Plan/Raise actions on schedule rows) since they were just a duplicate view
// over the same Schedule data. What's left here — unplanned/breakdown
// equipment maintenance, raised with no schedule at all — has no calibration
// equivalent, so there's no tab split by target kind anymore.
export default function MaintenanceCalibrationRequestsPage() {
  return (
    <div className="p-4 md:p-6">
      <RequestsPage />
    </div>
  )
}
