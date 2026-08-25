'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('department_role_privileges', [
  {
    "id": "022db343-20b9-4186-a484-a01b3f47a450",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.module.access",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "023fd50b-4017-4652-a953-3168b739d365",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "02cdfb77-6300-4c38-aa5e-73a522ccf79e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "02d6a796-6480-4dd0-a4aa-3db429c1daaa",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "04584e48-46cb-4d1b-959e-231ba978f863",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "05038d1f-f8b9-481f-be6f-b384aa680342",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "07acd45d-0bd0-4c89-af35-972ac725dd4c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "07b60855-9de7-4c73-8da7-f62f7580c1f1",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "0803aa50-0e03-4c6b-8f19-bc449ec21373",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.calc_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "0a416c32-9510-4728-bd08-ac346da8d4fd",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "0aab5d88-834c-42c8-b51d-8afcdc227011",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.module.access",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "0ab9aa0f-2366-42b3-befc-34bf5824b777",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "0b3a5c85-24f4-4e71-980b-a3dafc4622f0",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "0bb23fde-7fbf-4135-8fe9-90d2de3682c5",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "0c4d2cd5-58cd-4fc9-913a-a4056895d05e",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.risk_assessment_approve",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "0cb49507-d798-4687-8a44-3d2cd4a77e9b",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "0d6dde4b-4745-4eaf-ae07-a087e7c57d5c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.clone",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "0e160bc8-c4db-4aaf-b597-8a3b7f7f3b2e",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "0f069faa-6bc0-412b-95ad-a4debf0e383a",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "0f1e4c0e-df24-4e61-98f8-56e6d5699a3f",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "0f32c9d6-5e90-45a7-9c7f-aa1fdb21cc8a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "0f774bad-3742-4ea9-af81-3f7947e90281",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.raise_atr",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "10532997-115f-4c7a-a5e1-65fbd12da24b",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "1054b99e-00ed-4ae5-9805-f5656b2b5d67",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.submit_to_ad",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "105571da-8543-46c3-9ab9-4f2d524f0fd1",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "1078d794-d0eb-4c17-93b4-8cea10a2ce64",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "112f5177-8117-4157-90fb-d45098d25a98",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "1145cf5a-4901-4fad-a98c-11dd8a09c4d7",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.module.access",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "115c83c6-b167-4714-841b-91689c7842bd",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.create",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "12066235-7121-4e73-a939-54f040ae751c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.risk_assessment_approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "1230668a-9d60-4520-9e34-5dc390b891f9",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "1348c553-0a67-45dc-8826-511845ed7718",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "1377c2a2-970a-42c4-8936-4ff3656fc6cb",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "13c17f95-787e-4de1-8b10-c41c6af3bde3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "14df5b6f-20e0-444e-980c-565d20c487ed",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "154f4c0d-de6a-405a-a50f-399edbc36c05",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "160859fd-9508-4d59-897c-bb0421e953e2",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "18798704-bae1-4072-a486-66778b1c1421",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "18d72fcb-b1a0-4b45-96d0-68d2db54ac83",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "19a4d648-2c70-4e12-a20d-5b3e8af4c7ce",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "19caa89c-d2ad-47b3-acf0-eb4f9cb1c333",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.deactivate",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "1a09c467-be05-4f06-b249-b520df0882e9",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.module.access",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "1bd42638-e1b8-4f8d-84dd-dd61861dab8a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "1c1db572-4be3-4b71-a3b8-a6669ca19120",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "1c59d35b-ebed-494f-aaea-bb0900132178",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "1d15fbf3-6fc5-4067-961c-5dc1d88e48ad",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.archive",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:28:35.954Z"
  },
  {
    "id": "1d9ad56c-0a14-48a9-ac1f-df721c11bd29",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "1efa4dbd-b979-4afb-a7b7-b44b501032d8",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "1ff186e0-76e4-43c0-ad51-4fd717ff663e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "209c03fc-337d-44e0-ac2d-480e211aafe7",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.manage_files",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "20a6613d-08e8-44b7-9dfa-bdcb4628463d",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "21407945-b0a9-4110-b1a5-cbae44fb0038",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "216a0a8a-39f8-4523-963f-8daed89a15bb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "21a01226-2b51-4862-92e3-b2152e5bbef2",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "21b5acb3-209c-4e98-a8f5-a1d7edb864a1",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "2216934a-8d4a-412c-95d8-aee3c7a97e8d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "2218e4fa-474c-4dce-ac61-1e6d8d194a4c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "228fdbd0-edce-4372-99a1-f5478373b2c3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "23a9409d-23e9-4f13-8f51-c2f2229600ec",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "24e25b91-a9b6-4962-8477-dc944b4019cb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "24feca2f-e675-450c-be49-dd70c9082fcd",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "2624a926-9ee5-419d-86c5-53680bf8619e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.dashboard.analyst",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "2673d987-cd0f-4ab7-922b-765527fc4c81",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "268a4239-8b74-436a-8658-f1e8cab3b4ea",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "2705319d-cecd-4139-8f95-6bc90104aa5c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "2743f3c0-7216-4059-a051-78b2da5bc743",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "27ad2618-bfd8-4d4a-853f-93775508e727",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "27db912c-1d6a-472a-899e-b443c4254be1",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "2913d535-98ab-4429-86eb-1a9f6b2d9ac5",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "2921f0f1-832e-41f6-92b9-747784b15ac9",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "2b411f4b-8fa4-49be-873e-97510f1b144a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "2ba88894-dd73-4ec3-8c4e-c401038e9dc2",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.module.access",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "2c0ee9a0-7600-48f8-8e0d-ebf65b0a5aa2",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "2c1cf0b8-6c72-4412-acc4-c4e1fbf3a748",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "2c3dc331-820c-4efe-b286-ec014e7b29eb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "2c85b886-8696-4822-962a-57a57e1c5bc9",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "2d5213a0-6d05-47c6-af27-b89f61bbf546",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "2e826e3b-3344-4abd-a040-7cb0dde8bf0d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.module.access",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "2ec12b1c-e082-400a-b977-9afa95bd1139",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "2f2f8161-6b1e-4028-833d-c9c184ab004a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.void",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "311d0843-fe7d-491b-8390-f5f78ed36bf3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "319977f0-ad1e-4f06-87db-e319ff6fb184",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.sign_done",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "31ae7449-6133-4f88-b51b-841954ac33e8",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "31f91b5c-1227-476a-8390-ac362189c867",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "325d4319-d267-4a13-87a0-e80f9d8b41e1",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "32b1d0e0-3b19-4091-812d-9b6d98080bfc",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.hod",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "32e79a2a-3d7b-4517-ad20-7a902ef352b1",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.archive",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T05:59:53.324Z"
  },
  {
    "id": "32fa26c2-12f6-4aea-8305-c08fa141bfcd",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "3364a6d0-6e28-4517-be1b-08872578c1be",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "33d31d32-2534-466b-98ed-98507c6f5fcc",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "340b12ad-e574-4b78-950f-fe5b4dfbf65b",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "345ad2ec-fc0a-43af-bad7-323d141c3546",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "35f925b9-d684-4289-b380-491e4897df8e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.dashboard.chemist",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "3645fd46-da5d-4efe-9c97-6f234f690dcd",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "3695a08a-fe5a-4338-82b5-8a0786ead10c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.manage_files",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "373a44a7-a043-4df8-aebc-fc18823fc4a0",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "3781b76d-9b1a-4dfb-9a0c-ad83d0209ce2",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "37b06b77-7b62-4ef7-bbe4-6e87bc9a6f7c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "38697892-4959-4872-ac8e-e02051aa205e",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "38df0687-5abe-41c3-b389-d16682397f06",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.create",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "39ade26f-c7ba-4b83-bb85-9d47cb10609c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "39afc713-5f36-43a6-8d10-7b1cc164a510",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.dashboard.analyst",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "39d80916-df6a-445a-a8e0-9bcfee42389c",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "3a6cc071-1839-4af0-996f-11101227c141",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.calc_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "3b114640-d4af-416a-9681-a5829a676c52",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "3b4f9b49-077c-4b1a-be8b-e19000dc8929",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "3b5d193e-b608-4fc7-b482-5824eff08e1c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "3b978ba4-eb76-4d4a-b4df-7540da53bf9a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "3bbb62d9-33d9-4a8e-a2a7-6b06f8d3ff01",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "3c188527-100b-499a-814b-a3a544ce812a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "3e2ad1f2-aadf-4409-89c2-30cc9dd699d3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "402b2478-7e30-4d1a-a51d-59d219bbfb63",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.dashboard.analyst",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "405ffbb3-0c55-43fd-9b9b-05e0d33fe73d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "40f9c09d-d896-4d2d-a57a-48093f16d06a",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "41920f0e-54d1-4ed4-b47f-e7469244a2cd",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "423306e8-8bde-49ac-a789-0f7a9fb84402",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "4274af83-2d6b-40ff-968f-991e350ed180",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "42b8a58d-0e8b-4955-90a0-b3611d958430",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "43e552ec-57fe-4598-b5e9-f0a4361af4bc",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "441f8842-3b61-438f-934c-083f5f3eee49",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.assign_user",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "449b1612-2ccf-44ef-a105-fe0fd8528fbb",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "44f7464f-80ee-42d9-b6ad-6bd101f5ba90",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "4534b5c7-7c41-4b7b-8a66-1c05740fa842",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "463707c6-5785-4b1f-9f11-e974701d5b71",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.risk_assessment_approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "4638bf69-48f6-4517-9b0c-78389143bcd4",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.submit_to_ad",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "47efdb90-5488-46f2-a305-a401face2e8d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "48428aab-5c17-4136-9fb8-6e6bbc613c05",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "49e3d491-66a0-488a-a4b4-f87f3425ac74",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "4b202268-f184-4045-b032-d5fac4d7411b",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "4b33dd68-af5d-4263-8da9-2cc36dc7a1ce",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:28:51.804Z"
  },
  {
    "id": "4b4f83b3-e25c-4607-8203-15d28d6dd699",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "4bcb35a7-9899-4a79-ad48-dd43303655d2",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "4c7b265e-3734-4492-9685-2b853f6bf906",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "4cabb8b8-86c5-45bd-895c-9cff81c3c63d",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "4d4b1b4f-44ed-4d21-bf7e-59dcc5637833",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "4e912802-bd8b-4eab-98f4-db6481fca9d8",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.assign_user",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "4f4aa84e-6324-4dbf-8bf5-a1799cb70d6e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.module.access",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "4f640ff3-3950-4bb8-bc9c-8c4ba26c83e6",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "4fd020b9-78c7-42e5-8a6f-f0afed948811",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.manage_members",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "50d31100-47a2-4944-b034-1574f577b751",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "50db141b-fdcd-42e7-8a95-000bb1885065",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "5123a88f-af55-427e-b0d6-1f21cd8316aa",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.workflow_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "5125c888-a826-49a6-bae5-2c6a36bc30a8",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "514ee0aa-03b4-4c5b-bed4-50e8b0a3789d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "51b9282a-f392-45ad-97c1-faf9cb4973e8",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "51c61fe0-5369-4495-9b9a-a508a60fa9b7",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "5360ffa8-1189-4f28-a272-2e82fda3bdd0",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "53749cc0-75ad-4d69-a6e5-241101ebf9d1",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "53f44e75-cc7d-45dc-b522-c362918df583",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "54269343-5e84-4bb1-b89a-edba372a4455",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "546f3c48-cad2-45fc-9265-c7ff5d341230",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.create",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "54b092dd-492d-436e-b2cc-e14ce669ab25",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.unlock",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "5538aeab-73c9-48a1-8010-4010f39e707c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.deactivate",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "56745d80-6a54-464a-b1c8-43d4afb3eb73",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "567ba2b7-3e43-40ec-9049-c610c2bdc027",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "570a9060-42e2-4016-adb3-c204df374722",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.raise_atr",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "572e8035-726f-4e59-afbb-18f1e018d177",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "5781d0a7-f75e-4967-8b5e-4004c2e602fe",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "57f76b12-6be9-4387-b78a-e06b4320d9a3",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "57f8d736-3c39-4914-a3c5-a5811ea80c67",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "58c8ef85-11bd-4adf-8120-8ecad5e4d3b3",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "5a4ee59b-f205-4660-8214-115a210082db",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.module.access",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "5b3bbcbd-8fd4-4d7a-ba0f-69fc846c2952",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "5b8b6dc7-dc2d-4ea5-8c85-6ef230737f6f",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "5bd3e73c-da40-48c1-b806-2e7e755d8c35",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.dashboard.tl",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "5be8171f-d32f-4ceb-888a-7c0536a4e47d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "5c59d350-6e7f-42f9-8cde-7e517bf3921c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "5d206da0-e2fc-41ba-9446-e9e074ccc65e",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "5db3be73-6dd9-473d-8142-8a813943b48a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "5def6a1c-4c07-425f-8e68-8d1fb732ad35",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "5e5de0da-a56a-4da6-acb0-28e1f719454b",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "5e6cdeb8-e4c8-4ee6-8568-bf6bc4d45082",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "600ebf94-afe5-48b5-837d-76d3c6545f3d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "607f85a0-4c46-489b-97f4-48656ea83bb7",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.dashboard.chemist",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "609a8abd-b799-4c1b-a80a-8b1d55a3149a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "6101f0ba-2a40-476c-ad23-fe66255e7fba",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "61638099-156a-49b8-98b0-ecea4eedf284",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "636a0b02-c95c-423e-a395-0432da7f14cd",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "63b719b8-2058-46e4-bb05-fb8512f11781",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "64040596-0244-48ff-a831-a6dbc5868257",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "6620776e-de88-4c68-a892-4044c1576430",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "668cface-a828-4162-b357-36665703a00e",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "6705de84-fd72-4f31-abb5-b5f14a903619",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.reopen",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "67182c96-c48c-473a-8c12-3f8925aafbaf",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "6791baca-acb2-4a12-b27f-83bf867bb7e0",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "67bf12a1-0eec-4764-9cd3-c9016520ac94",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "68a4b5b8-ab5a-43bc-8211-5eb3d22d08a5",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "68bd358d-06b2-45d4-ab5c-c5f06247bcd3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "69668f37-9834-42a1-a78f-4c2ef06daaa8",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "6a869a06-117c-402e-9762-4107c92267ff",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.module.access",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "6aaa8469-8375-471a-a45c-560452116db5",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.manage_members",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "6b73558e-d796-4fda-8400-d495f3d2aec2",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "6ba5114b-37c4-4ab7-9008-1cb1801b8408",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.archive",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "6ba7c67e-85a3-4609-bb3b-a73f06c24e2e",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.reject",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "6bdae802-4685-47c3-afe9-08f706e475fb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "6bebd7fc-75d6-40eb-8b0a-a8684e40d14a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "6ca6bb80-3641-4f00-b130-47597b4263cd",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "6cb30d61-85e4-4a2b-a826-dac144dd5ba6",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "6d45b32f-74f9-4219-a71c-d7b62d2172fd",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "6d856e36-417d-4e99-bbb9-2cd0b428148f",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "6dba6355-a845-460e-b6be-58d36791aebd",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.workflow_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "6e2759bb-fa05-4ba1-a350-c8cc594945cc",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "6f1b340c-ea81-41df-af0d-d49ec68433be",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "6f49d984-a09e-48b7-9fa4-7fbd6773d478",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "6f62bbaa-c496-4658-9b75-1c3d71d614b4",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "6fda1fb2-92a6-4592-84fa-045ba6d0de7e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "7014c3d9-bf23-4b73-9458-42a5c84c64e7",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "7067e0ff-3f10-4655-83bf-709cf9a40f91",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.submit_to_ad",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "708092e3-00cc-4737-91e1-c3f7f1492a80",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "712734f3-6928-4421-b934-fcaa8cb39ca3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "738e336e-24e6-45cc-b2bb-4292f73bea71",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "73c3eb5b-2f12-4cad-84c6-d44b6853a648",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "73ebdf35-1fd2-46c6-ae94-981e080d7e41",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "74b1d996-9c2d-4713-931c-31a3f47d6892",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "74c2bb53-c0fd-47db-bcaa-6fe9e4765c6f",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.assign_user",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "753adeec-0604-4bef-9622-7f7013da5f32",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "75cad3c4-b288-437d-848b-dd36b576306d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "75d5a94a-3f4b-4e79-a059-ce2202a67ebf",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "76161d5a-e123-442e-9f96-b5d272d24264",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "76514e7d-1be5-4c03-9b6f-10d322688e3f",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.raise_atr",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "77d4b800-43be-4f53-9fd7-e3b9285d0440",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "788640fa-079d-4b1f-b1ca-ef666312fc92",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "7a12d937-2f20-4419-96b5-3fb0b3c5fed0",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.manage_attachments",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "7a3a49c1-cbb0-4cb5-ac87-acd0446f0292",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "7ac9f850-8902-4f9c-9f80-68202c9ad17c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "7b127b36-9381-4684-9809-119a9bff2520",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "7b4d3f51-b376-4887-959f-80dbb7ede9f0",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.dashboard.chemist",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "7b9e12f7-a265-4896-8410-f19ff43e1308",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "7befe717-ce22-449e-af5b-cfb95da47f94",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "7c312684-38f2-4fd1-954c-7fb8ac0e7d0d",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "7c5f473c-9ef9-4702-a1c5-d1835fdc0aa2",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "7d410f11-baa8-4d05-92b6-53637c10b73f",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "7d765dbe-2610-4aa2-a516-1bfc746e5345",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "7daaa5d0-78ad-412d-9637-44d44c5346b6",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.risk_assessment_edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "8017c9be-a328-4ad9-b193-4f4872182874",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "80418ba4-056e-4340-9613-aa56376dbd00",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "80b7e8de-cfbd-4469-ac78-1e750a7bb249",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "818adef6-ba43-4e11-ac2f-96627411f0d0",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "819006a5-25d2-4d0d-98af-eca7d3869fe3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "81ad4e3b-1117-40a5-97d6-e25ab9c1e5eb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "81e72ca8-ab5f-4858-bac2-105dda7327b2",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "822cd8aa-2b27-4efd-a18e-ad71b6d8feff",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "82a7f168-1a55-413e-8ea2-0fe45b58e4f0",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "82aa92c0-ac51-4977-bc45-6b26fcff562a",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "82dda615-1b53-4b6b-9dc3-120284434f48",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "8331d93f-28cf-4d3f-ae3c-6555f53571fd",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "835de24a-a986-427a-8129-ffe008df5308",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "83b8d40a-60ea-496f-b5ba-a34e10c0b0d6",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "8414aa41-ca58-469a-bab7-c419fbc2a630",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "845f07ad-e0ce-4a95-b0b0-9547c3ca5806",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "850cdbee-c449-4b80-a173-aee715a9b31d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "85a49202-5d47-4030-af29-544484e7712b",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "863e6d9c-2ee6-4104-b228-257b473abf57",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "86624506-f604-467a-a3b9-28cf5224eb4a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:28:51.804Z"
  },
  {
    "id": "875ab96a-0819-4212-aa50-eb2c425fa71a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:28:35.954Z"
  },
  {
    "id": "87ab2c09-b390-4e72-93ff-26c160486b09",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.submit_to_ad",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "87ae00a2-8602-4381-9e54-0531bec5f022",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "87cd67f8-781a-488a-9b62-37c0fc3085a3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "88061352-6fcd-445a-9876-871b9390cff1",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "88393b56-feac-4b55-b75d-a903aa566b6e",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "8879bf50-e545-4488-a9aa-7c89926381f1",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "89aef8a4-c93b-4c83-8fd4-bc92f4213a72",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "89db4392-bcc4-4ef1-9be0-23dd791f2b84",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "89f3bab4-7afe-44db-9dbb-ca8af7645430",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "89fd847d-9dd4-4171-af74-54c0579fc873",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "8a8d1199-bb44-4dd6-9257-6904efd49565",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "8ae25f5d-38a9-4a84-a098-e6b95b193825",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "8b67b1b7-e976-45a6-b90c-fbc044c27dbe",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "8c0aac6d-29b2-46ba-829e-143774ae397f",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "8c6e0cb9-b942-466d-9ec6-90e55f90b33e",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "8c70c12a-3e13-4438-9f32-ded5f40124af",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "8ca63a00-0e2d-43dd-8a50-cc324e89d816",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.submit_to_ad",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "8d2be78a-c3d0-4814-ab90-d446364f47f6",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "8de69b1c-9798-456d-80dc-b73cd6e62880",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "8e7b9ab2-87e2-4fa9-8fb0-9548310dd3d1",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "8ed49902-f658-41ee-8379-297d15555fee",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "8fc0efb1-39b5-40a4-acbd-71d7a8f835da",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "915d3b3e-2d3e-4812-a6ef-79713d3b31f5",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "91c8fc25-7199-4602-9eac-67a453011644",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "92582394-0fbd-4e72-b268-8437f48454f9",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "92cd6444-0ff3-4511-ae42-c66c83c98ebe",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.risk_assessment_edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "92cd7951-be25-4221-a27b-8fff9543cc80",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "92cf0ff7-536a-4740-942f-e4a504879430",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "9353763f-28cf-4e13-98ed-d48a78b1e40c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.manage_files",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "936c2d52-d348-42b3-9ad1-afb47d11db80",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "93a83a19-c942-4d86-a4b4-9c0939ff8e4c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.clone",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "945d4a91-69b5-4c04-9649-40a95eaf1451",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "94ceffa2-bba1-409a-8d52-d5b38a617f28",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "95d30832-587c-472f-8c73-1017baab4b6b",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.raise_atr",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "95d36302-4e85-4df7-bef6-9daa2765d9a8",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.workflow_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "9687a79f-d5b7-4d3d-a164-51691f7a3ae9",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "96d8da02-0426-40df-8a36-78082239eaed",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "973b99c9-1d37-47b9-b75c-d8ab13cf2676",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "979e2585-f363-48e7-be40-c69bb5e14e23",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.chemist",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "97d86d89-adde-4a8c-8583-cdbc20c479a4",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "97e60f9c-f512-4a46-9092-2cf45001e882",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.reopen",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "98917514-d81f-47bf-a1aa-26da2ffb9b5b",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "98a25048-82e4-43c2-8d9b-edaa086be77f",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.notebook.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "98aadfaf-426d-4b91-a4f0-c7ac81117257",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "98f5e0d2-5a0b-4392-89af-77d9532d7411",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.analyst",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "991e34d0-05d6-4787-862a-2c8edd950b90",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.dashboard.chemist",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "996f18f7-b1ca-4620-842b-f05e1da1e391",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "99873b4c-5df4-4895-be66-065d4c2728ad",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "9987f6af-dd81-4218-8ff6-71a851aeba0c",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "99e4b6d6-e812-4fa9-82d7-35522df68890",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.raise_atr",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "99ef995c-2bb8-455c-9de8-8629b99b28bf",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.submit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "9a1243fe-a461-47d8-8ed1-41fe290e6cde",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "9a7c3fac-3b05-4450-9112-6bb79adf16b9",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "9a846afd-3313-41de-b0ea-ca3b08adedce",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "9ac02976-1b90-4a7e-8378-f0ba13ff51a6",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "9b3694bf-f471-4da3-a055-d572484ad66a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.chemist",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "9bbdc172-fbf6-4f94-a4f4-156437505b76",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.analyst",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "9c4cca43-aa62-4d02-8bd8-23c483931d05",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.risk_assessment_approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "9c884e50-609c-4f89-bf93-bc206925a450",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "9d09e15e-a962-4d59-9eed-9302c06e5d89",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.calc_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "9d5fe30f-510a-4dfd-9fcf-7a28f302e596",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T08:10:23.505Z"
  },
  {
    "id": "9d64ba27-9654-4c51-8166-229f05cde650",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.create",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "9db36f26-ebcc-4d06-b026-e6d19933a558",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "9decd475-37f8-459b-9cda-01c68b948475",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.risk_assessment_approve",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "9ea2d2e3-ab0d-4d8c-98f0-d2eabfd43f83",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "9ec4c523-7fba-485d-92b9-0e9a052dc110",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.submit_to_ad",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "a07d63c2-0307-4aab-ace9-1f356280437a",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "a087ba9f-c96a-4d86-8433-159f172ea310",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "a13796bc-1e7d-480a-b14e-604c1ee31b1e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "a24df016-e092-4e0b-835e-89b0285e4bc8",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "a28d4ae0-447c-4f7f-8650-b4d3ad4952a6",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "a318e838-3814-40e2-84d1-47b4f85d0ba3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.void",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "a3ec8b97-c9a2-4cbd-acaa-f3db76cd3bbb",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "a438d00b-f272-4ff8-ba81-e7ec34ef0c74",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.dashboard.tl",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "a4f36f63-06af-4ac2-8573-d6412a5924ca",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "a4f5c8ff-6458-41a0-8fa1-73e6810e38dc",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.notebook.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "a553d920-3bde-498e-b27d-2790f35ac491",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "a567ce89-514e-444e-b10d-748640f5661b",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "a62f449b-a0d5-42ae-b7ed-44c83ac1d7ba",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "a640d71f-824d-4d1f-8140-429bfb5a5e0c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "a6f50ec7-4ed2-456c-bf2b-3117e9a9e1fb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "a702950d-8a5c-43d2-b9fb-b9c4da829673",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "a86985c5-92a1-49e6-a165-cad70146c2b9",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "aaf8bead-09ec-4313-abb9-202c30b4b19a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "ace892b1-f4e6-40a8-93e7-5aa44b2b5bb5",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "ad74bf6b-c9eb-4898-a943-d7c5db5dd9e4",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "ad9f3c78-d503-49dc-9fe4-f248d8dc445a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "ae3aca84-0936-428d-be9e-34a0d2505d48",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "afb69bf2-baef-4591-8f23-52439fe2efe4",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "b0a5083d-0241-434a-9e4d-78a61edf30d3",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "b1a28328-6e00-4df9-9762-d41e336ff0fb",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "b1ed7a62-3178-4e18-bd4e-306f203667b8",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.reject",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "b29c7603-506a-4364-96b7-8f0967e73387",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "b41ec447-2763-4dd5-a19f-a9444167a46e",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "b4bee21f-55b8-44ba-ba79-d6226854c1d9",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "b71f2ffb-57c4-417c-b4f6-96d6bcd47abf",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "b761f042-d929-4424-9026-ec2fa362ef51",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "b7bfd834-f6e3-4254-985a-71a633f8be82",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "b7eddc4a-3541-4754-b008-14db8a89ec77",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.deactivate",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "b9a0070e-cc44-4b30-bc3a-82b04e19532d",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "b9b9f1c8-db35-4550-9afb-95fda63f5078",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "bb07a4c1-c25b-4496-8d52-fe6ea2c9b222",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "bb113622-5817-4ef3-93d1-6779650f44f5",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "bb35af9c-558d-4929-a52d-a91abbd4f31c",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.workflow_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "bbaee541-53d9-43b2-86e2-b62a93badb77",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "bbe44a82-2816-4d52-be8a-ee7d3c2183cc",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "bcb2d135-e27d-4868-856b-d8d45c17e8d5",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "bd129ffd-8859-4b5d-a349-a889617a350b",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.chemist",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "bdb4215a-5416-45de-94a0-8a1dcf5018e9",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.workflow_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "bdebbacf-3fd5-460c-b499-eed24cbc92e9",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "be6aa922-18d4-4e8b-8128-f7d3c96b1d1b",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "c0137213-6980-46dc-8d79-f043e3497b9f",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "c0294e76-25da-4e8d-8c7f-e91775514d94",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.risk_assessment_approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "c125401e-466d-492c-b5cf-213eb2ccc390",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "c13f9c14-716e-4319-ab72-4e6f881a0a65",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "c14c60d8-15ec-445b-93b8-a22fb7008b58",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "c1d5cdfa-f77c-43e6-a878-32e43d0cd417",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.workflow_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "c26ec023-6c9b-49ec-a121-252f649830ba",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "c34e3d78-febe-4b87-9b33-376bad992d32",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.workflow_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "c3f64aa6-799a-4cea-b735-a14f7bbe9a1b",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.close",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "c5557f76-7134-4100-9a45-361c9c42f2c1",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.workflow_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "c5ad0ed0-9b9e-484f-9969-56598c4a6fb5",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "c5c9db8e-db39-4960-b3bf-a2216b3927cb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.unlock",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "c5e5694f-611e-4ba4-b516-c931370636db",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "c5fa3f6d-f691-44cb-9212-48b1221f074d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "c718d4e3-ffae-46da-ae2f-ba98518735cb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "c7d1bf46-4ee4-4ae3-9a17-fe29eb1ba4a2",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "c9052ae8-9ea2-48e4-9812-bd614f96111c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "c9efd1b5-0995-42a7-a529-aeac52b8fece",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T08:10:23.505Z"
  },
  {
    "id": "caa193a3-2228-45a0-bc88-54ba604b7689",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "cb1cce0a-b4b7-45d8-950a-c907ab7be2f8",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.approve",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "cb209e3e-73d9-4184-98e2-19aa69d3d2de",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "cbf63cba-ebf6-4e4d-8988-7585b55350a0",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "cc15472d-08cf-49c9-a2cf-a96163883133",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.workflow_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "cc473afa-76e9-4eee-a794-2a77a1a7e321",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "cc752eb0-8d5b-4f1a-a622-8e3538fdceda",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "cc8b4a07-446d-4724-ad21-191abba4063e",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "cce5d614-9760-47ac-832a-807e230968c1",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "ce019348-41fa-4636-819c-65be3bb6f529",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.raise_atr",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "ce3062b3-7dac-4229-85ff-38a3d1f73abb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "cfbb0d7c-d213-465b-868f-9401176424af",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "d0366dae-3375-4c32-b360-74ec55705eff",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "d1406e21-0218-4d38-aeab-72b7831a392a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.workflow_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "d196db2b-efa6-4d04-be8f-9f7f7c0c5798",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "d1aeeea2-2bec-4bc4-b390-6e09ccab151d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "d1c330a1-861a-4e7d-9e07-7c27601da88a",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "d1e003a5-f394-4875-9cd4-7691bbedc444",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.sign_done",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "d1e1ba6f-81f2-4290-b7dc-cd801b6d20d0",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.notebook.close",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "d2712a6f-75fe-48cc-acf0-265d311a6b19",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "d2eb7c4d-2052-4b8d-8513-19cd96d3b7ce",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "d35d6b93-1aab-4192-a8c8-27822a2af91a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.reject",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "d3872c1d-6923-4567-b2a9-1521d45bdab5",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "d43ebf8c-e8b5-4cbe-813b-e16eee954f6e",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "d45e6af4-0378-445c-a2bc-fb599157c36b",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "d48af809-9e4a-4dfd-8154-a27ce444584f",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "d555b9e1-a95e-4ae4-a072-ab5fbdd01422",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "d58b0f48-c103-457b-9558-c34bd14c5a18",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "d6b4a1e0-0e57-401e-a7e0-8c79fe57c4f9",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.approve",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "d7286f2d-f60b-4586-acf5-6d9fb506cc2d",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "d7cead06-dfdb-4707-9139-2b776324b85c",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.raise_atr",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "d8539946-0eb0-42a8-9ea5-b8871071356c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.manage_files",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "d8859b75-84ff-4cd6-8247-4304619e7082",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.module.access",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "d8d20a52-cc5c-47e8-9b82-cdcaf9080d94",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "d9759683-9bd4-48b4-97bb-a51394857c28",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.sign_checked",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "d9ec8655-e0ea-45e5-a754-f666d7d8a515",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "da7e11cb-8ea7-489b-9dcd-be5fd40089a8",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "daa84e7d-87fb-4b3e-939f-2d33b9bf3ffe",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "dad08189-84e6-44aa-a683-fd9fef2c0174",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.workflow_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "db307706-d8e8-48eb-9f4a-d51ed1b5d21c",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.submit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "dc0b2a1b-86ae-4858-9ff8-5391dbf9c11a",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.close",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "dc5fe9e3-5d22-42bb-87bd-762047409f58",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.module.access",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "dcaf36fa-c834-4822-9871-2330fe88045f",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "dcefe2ea-69e5-4a29-9a0b-b8ec64ec98ad",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "dcf26b5b-7dcd-46ca-ab4b-3723b22af91e",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "dd0acb84-5400-4ee2-aa5d-fc646b194db0",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "dda045b0-e0c3-4f6c-9844-3cfec023e564",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.archive",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "de179376-a782-4b1e-ae32-9ee52661e69d",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.risk_assessment_edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "de2ef30b-7945-484a-92ce-22a092e09bbe",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.clone",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "deb9835a-8d2b-47c4-8262-eaf0f7f23fa0",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "ded2a66c-2032-4675-9e98-bd8795e25ddb",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "dede648f-9e2f-4691-9e31-fdcd28bc776d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "df5243d6-c2b6-4f32-8fdb-c649cbf80226",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "e06ecb06-b1b3-4933-ab0c-9ffcbc36299e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "e0f8cab0-fcf2-4df5-8b99-2926ca29c63b",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "e13d6092-6056-48bb-9048-3448237be18f",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.module.access",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "e23da37f-654c-482e-8523-ca13b10b8160",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.void",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "e36bdd7c-0254-4e28-9a03-5d62b7da6743",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "e396e676-9b46-4c39-8b9f-2cffa8c30be9",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.workflow_templates.manage",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "e4580b44-ca00-4c44-9261-c89f77ab1a39",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "e4d3df72-2ade-45eb-afac-cc1cecbe8381",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "e52e8cf6-31b0-4660-9bde-676ed14e9a56",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "e586ae34-b18d-4cb1-ba7b-223a2f20585d",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.assign_user",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "e67abd5d-090e-4a7a-903c-7d5b05ccdd35",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "e6ffde12-4a55-40d4-bd1b-4d2622d879ba",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "e85b2ff7-4684-42b9-95da-c1dd550a68f8",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "e8773c58-998b-4587-bbda-0a796de2e19e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "e8a4382e-922b-4fa8-b720-353c658ca900",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.dashboard.hod",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "e8f85054-de73-4508-973c-e48773d5a530",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "ea057d53-2af7-4b09-9b0c-2088bbef8d3e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "ea365895-b407-487c-99b5-74cf1c0870b3",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "ea64d03f-490c-472d-a389-fa8807908988",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.create",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "ea93f028-3f93-4a26-ad48-c8cdddb6a5f6",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "eb89e713-89d4-4d9a-8fe6-970686d9914f",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "ebc9d6f8-cc3b-4c73-8655-af64b55876ac",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "ecb3a148-7f51-409a-a4e4-b700f6ef91c9",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "eccc7dfc-6f20-4817-a0e1-7bc2a6117d73",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.deactivate",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "ed66d4f1-0997-4f10-99a5-e6c700572ee5",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.experiment.approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "ee9a199e-2536-4fa2-add7-e3216d111038",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "ef25defc-7ccb-46b9-9da7-c150626ec277",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.unlock",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "ef272b10-e0e7-49f6-b705-5fde132acc18",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "ef5c267f-47db-4ef8-9e5e-d1a329761d57",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.edit",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "ef6b1779-fa9f-4345-bbeb-dc819894a138",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.experiment.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "ef81c3d4-7626-4715-9448-3f5d0289ada7",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.submit_to_ad",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "eff047f6-e171-46b0-8f2f-3e87f8c4f668",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "f00ad0f5-7753-457b-a806-322ad18cba8a",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "f06a48c8-bbfa-4352-bbd2-589fe455ef2f",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.sign_done",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "f07e15ba-7356-4643-811e-fe0aa9892475",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.manage_attachments",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "f11a1fcb-ee2a-4795-802b-afb6518723c8",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.experiment.sign_checked",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "f223df69-4e3d-435e-b68e-5cb02fc75df8",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "f2839df0-b163-484f-b7dd-8ad1c5a94dd1",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.manage_attachments",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "f3888ec4-8342-4aed-af93-a1976b5f9995",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.view",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "f4011e14-0388-426a-a7e4-6d09a76ea4c6",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.module.access",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "f4f300f3-4728-4066-b735-75fb78824ddb",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.view",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "f524433e-6b40-4b0e-aaec-074168074f27",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.calc_templates.manage",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "f54407cb-60c7-4a1e-aaee-8bcab739b541",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.manage_members",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "f5583687-3927-4667-9bbf-52f7cdc0550e",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.reopen",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "f5775412-928f-44c9-95b4-67f120968697",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.create",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "f590b435-391e-4a1b-9115-47eac9a49e4a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.dashboard.tl",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "f601be0a-b834-4a1e-8072-9a46a4a0a3e9",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.notebook.assign_user",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "f63d1411-acea-4ba9-83b0-264543dcd05b",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.experiment.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "f6afd8a6-60a1-4fb0-96ce-19d22ca007c6",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "f6bc8af6-667c-4e99-96be-e8880d2f0784",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.submit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:29:09.101Z"
  },
  {
    "id": "f72b0d6f-29f4-424f-b2c0-43daff7d8605",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.analyst",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "f906953f-d3ae-4875-a3c7-c215185aaaf1",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:07.164Z"
  },
  {
    "id": "f988fb1d-8344-4269-9df8-657245f7e123",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.project.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "f9dd13c9-7281-4434-8eae-13bec5dc5874",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-15T09:27:32.047Z"
  },
  {
    "id": "fa589e38-0290-4993-bdca-faa9b9522f34",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.notebook.deactivate",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "fa8863d6-6499-474e-9b65-2e25742722ba",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "adc.project.edit",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "facd8414-a35e-4fd6-9f92-09702f0d3f0e",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "cgt.project.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T10:39:52.942Z"
  },
  {
    "id": "fb605a42-bf5e-4d9d-ac1b-6f99dfcdd517",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.experiment.risk_assessment_approve",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "fcb66f27-2c55-4b45-9934-17f750595a54",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.experiment.sign_checked",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.291Z"
  },
  {
    "id": "fd457848-71cb-4c0d-b939-c5070c3e4484",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "cgt.dashboard.hod",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  },
  {
    "id": "fd738241-708e-4622-acf9-a3c2f58bc13b",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "privilege_key": "cgt.project.view_all",
    "is_granted": true,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:11:55.418Z"
  },
  {
    "id": "fd78a39b-7f84-4152-9840-e1010522284e",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "privilege_key": "adc.project.create",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-14T10:32:36.617Z"
  },
  {
    "id": "fde6f75a-558b-49e2-984a-ac7eb7cbe112",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "privilege_key": "adc.notebook.view_all",
    "is_granted": false,
    "updated_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "updated_at": "2026-08-20T09:12:15.290Z"
  }
], {})
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('department_role_privileges', null, {})
  },
}
