'use strict'

// The legacy "Template DataItems" scheme only has SHORT|LONG length categories
// (no MEDIUM) — but rows created before 2026-08-20's Integer/Inventory-LOV
// rework were stamped MEDIUM by the earlier (now-superseded) TEXT default.
// Normalize them so every TEXT row reads LONG, matching what
// deriveLengthCategory() would compute for them going forward.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE ard_data_items SET length_category = 'LONG' WHERE length_category = 'MEDIUM'`,
    )
  },
  async down() {
    // One-way — MEDIUM was never a real distinction, nothing meaningful to restore.
  },
}
