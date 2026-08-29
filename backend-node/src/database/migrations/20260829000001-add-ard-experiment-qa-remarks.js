'use strict'

// Scenario 25 (persistQaComment) — QA annotations attached to an experiment
// independent of workflow stage, same shape/pattern as post_analytical
// (a JSONB array of {id, remark, by, byName, at} entries appended over
// time, never overwritten), but this is its own annotation layer: legacy
// kept QA remarks and post-analytical remarks as two distinct lists.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_experiments', 'qa_remarks', {
      type: Sequelize.JSONB,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_experiments', 'qa_remarks')
  },
}
