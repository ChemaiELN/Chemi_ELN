'use strict';

// Fills in the experiment e-signature settings that were referenced in code
// (ESIGN_FLAGS / ESIGN_TRANSITIONS in ardExperiments.routes.ts) but never
// actually seeded — enforceEsignature() treats a missing setting row as
// "flag off", so Submit/Approve (and, until this session, Verify-Submit/
// Reject/Deactivate weren't even wired to a flag at all) silently skipped
// the re-authentication check regardless of what an admin might expect.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const rows = [
      {
        id: '5a1b6f2e-2b3a-4b8e-9c1a-7e2f6d4a1001',
        setting_key: 'ExperimentSubmitAuthentication',
        setting_label: 'Re-auth on Experiment Submit for Approval',
        setting_category: 'Authentication',
        setting_value: 'true',
        description: null,
        value_type: 'boolean',
      },
      {
        id: '5a1b6f2e-2b3a-4b8e-9c1a-7e2f6d4a1002',
        setting_key: 'ExperimentApproveAuthentication',
        setting_label: 'Re-auth on Experiment Approve',
        setting_category: 'Authentication',
        setting_value: 'true',
        description: null,
        value_type: 'boolean',
      },
      {
        id: '5a1b6f2e-2b3a-4b8e-9c1a-7e2f6d4a1003',
        setting_key: 'ExperimentVerifySubmitAuthentication',
        setting_label: 'Re-auth on Experiment Submit for Verification',
        setting_category: 'Authentication',
        setting_value: 'true',
        description: null,
        value_type: 'boolean',
      },
      {
        id: '5a1b6f2e-2b3a-4b8e-9c1a-7e2f6d4a1004',
        setting_key: 'ExperimentRejectAuthentication',
        setting_label: 'Re-auth on Experiment Reject/Rework',
        setting_category: 'Authentication',
        setting_value: 'true',
        description: null,
        value_type: 'boolean',
      },
      {
        id: '5a1b6f2e-2b3a-4b8e-9c1a-7e2f6d4a1005',
        setting_key: 'ExperimentDeactivateAuthentication',
        setting_label: 'Re-auth on Experiment Deactivate',
        setting_category: 'Authentication',
        setting_value: 'true',
        description: null,
        value_type: 'boolean',
      },
    ];

    for (const row of rows) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM ard_settings WHERE setting_key = :key',
        { replacements: { key: row.setting_key } },
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('ard_settings', [row]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('ard_settings', {
      setting_key: [
        'ExperimentSubmitAuthentication',
        'ExperimentApproveAuthentication',
        'ExperimentVerifySubmitAuthentication',
        'ExperimentRejectAuthentication',
        'ExperimentDeactivateAuthentication',
      ],
    });
  },
};
