'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('global_settings', [
    {
      "id": 1,
      "auth_type": "Application",
      "lock_user_after_x_attempts": 3,
      "password_expiry_days": 90,
      "max_image_kb": 2048,
      "max_attachment_kb": 51200,
      "experiments_per_notebook": 999,
      "notebooks_per_project": 999,
      "search_limit": 100,
      "qa_role": null,
      "smtp_host": null,
      "smtp_port": 587,
      "smtp_from_address": null,
      "smtp_username": null,
      "smtp_password": null,
      "enable_email_notifications": false
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('global_settings', null, {});
  },
};
