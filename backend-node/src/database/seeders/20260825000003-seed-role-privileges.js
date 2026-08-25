'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('role_privileges', [
  {
    "id": "0830e496-6ada-4875-b5a5-15d6e9313d77",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "atr.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "411ff0da-e9aa-4fd1-baf2-a73f536f9080",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "admin.settings",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "60948f3f-c6e3-41a9-9fed-16ce663d881c",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "admin.excel_templates",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "60bd35fb-3eb0-4300-a14d-c41eb3c32e07",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "notebook.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "6242585b-d468-4ada-830b-d90c4afbe3ab",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "experiment.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "6d0fbb6a-b559-453c-93cc-28786ffe797b",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "departments.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "7821c3bf-9418-433d-846d-0b8581862d74",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "master_data.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "b4c9b780-e7fe-4b37-83ae-7ef75dd2e9ca",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "department_id": null,
    "privilege_key": "master_data.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-06-27T22:06:41.283Z"
  },
  {
    "id": "b4d92214-f51e-4898-8bd9-d16041c24490",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "project.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "c48f7485-3ea1-4342-90c4-292fa38fb656",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "ard.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-27T22:30:02.441Z"
  },
  {
    "id": "d16fa5bb-e60c-4486-9b26-874b61a3f646",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "labs.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "d331a803-7c71-432b-808c-e00ef8b6a50f",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "admin.role_privileges",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "d3b9add3-9846-437d-b8d9-869f54f2b768",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "users.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "e6eadf95-82a2-4425-b063-2ae80a9fa0f2",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "department_id": null,
    "privilege_key": "users.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-08-06T23:30:15.311Z"
  },
  {
    "id": "e7db1a1a-6953-4230-bd89-416da7c7facd",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "admin.notifications",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  },
  {
    "id": "f61eccfc-0804-4ca6-b881-7d5d5a199df9",
    "role_id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "department_id": null,
    "privilege_key": "calc_templates.manage",
    "is_granted": true,
    "updated_by": null,
    "updated_at": "2026-07-23T01:32:17.536Z"
  }
], {})
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('role_privileges', null, {})
  },
}
