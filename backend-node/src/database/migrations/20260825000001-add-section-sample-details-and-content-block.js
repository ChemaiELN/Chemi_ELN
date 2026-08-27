'use strict'

// Restores two of the old ARD Template Builder's section types that the
// rearchitecture (20260819000001) dropped: 'sample_details' (a Lab Component,
// same shape as weighing/ph/etc. — just needed adding to the type catalog)
// and 'content_block' (references the existing ard_content_blocks library,
// which had no attachment point on ard_sections until now).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_sections', 'content_block_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'ard_content_blocks', key: 'id' },
      onDelete: 'SET NULL',
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_sections', 'content_block_id')
  },
}
