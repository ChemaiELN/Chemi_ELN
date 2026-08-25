'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('user_labs', [
  {
    "user_id": "3adbf544-f9be-43db-8133-36a4fdefe695",
    "lab_id": "6ce92313-b0ef-42b5-8702-993a73cffd2e",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "53304795-2974-4293-b726-389da01b05ee",
    "lab_id": "6ce92313-b0ef-42b5-8702-993a73cffd2e",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "57cf6457-d3a5-44a4-a75a-273d82b77634",
    "lab_id": "6ce92313-b0ef-42b5-8702-993a73cffd2e",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "68b7ff69-cf20-4080-a8bb-526a1cdf8f63",
    "lab_id": "65d65823-dca7-4d65-bcd0-1594075c1fc8",
    "created_at": "2026-08-15T11:19:46.922Z"
  },
  {
    "user_id": "68b7ff69-cf20-4080-a8bb-526a1cdf8f63",
    "lab_id": "dd7ed07c-2b12-4c00-821b-145c2c4de471",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "9781045e-f80d-4daa-857a-a79a28c18dd2",
    "lab_id": "dd7ed07c-2b12-4c00-821b-145c2c4de471",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "a6feb3f4-0e92-4f4b-be20-1fb81df4ae89",
    "lab_id": "dd7ed07c-2b12-4c00-821b-145c2c4de471",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "c46f6784-8723-41dd-a609-8b3a66ee553e",
    "lab_id": "6ce92313-b0ef-42b5-8702-993a73cffd2e",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "d2b91eef-f56e-4b2e-bd0e-fa8140998b47",
    "lab_id": "dd7ed07c-2b12-4c00-821b-145c2c4de471",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "dc5c019d-8881-4e02-84e4-1162cbe5e462",
    "lab_id": "dd7ed07c-2b12-4c00-821b-145c2c4de471",
    "created_at": "2026-08-15T06:34:42.646Z"
  },
  {
    "user_id": "f2229c56-b2eb-4f46-886d-95b801b93975",
    "lab_id": "87b2642a-faf4-405c-86ec-2320866fe590",
    "created_at": "2026-08-15T06:34:42.646Z"
  }
], {})
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('user_labs', null, {})
  },
}
