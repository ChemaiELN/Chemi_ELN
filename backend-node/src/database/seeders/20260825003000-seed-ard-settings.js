'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_settings', [
      {
        id: "0a557225-95d5-4aa1-ac3f-95ba7a8516e7",
        setting_key: "ATRSubmitAuthentication",
        setting_label: "Re-auth on ATR Submit",
        setting_category: "Authentication",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "0c75574e-e51d-43d4-9f92-10551f2c9791",
        setting_key: "IncludeChromatographicSection",
        setting_label: "Include Chromatographic Section",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "0f9bcf71-db66-4da0-b6f1-ceea585facc2",
        setting_key: "AutoFormApproval",
        setting_label: "Auto ATR Approval",
        setting_category: "Workflow",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "11952e8e-ac90-4e4b-80a2-1e77d4a5cbfa",
        setting_key: "WithdrawTest",
        setting_label: "Withdraw Test",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "14ed9b1c-ed5a-4bec-a819-92a751303e90",
        setting_key: "DisplayAllUserForAssignment",
        setting_label: "Display All Users For Assignment",
        setting_category: "Users",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "21adb33a-a900-4da5-a504-7045515b72b1",
        setting_key: "QARemarksStage",
        setting_label: "QA Remarks Stage",
        setting_category: "Workflow",
        setting_value: "certification",
        description: null,
        value_type: "text"
      },
      {
        id: "25d57229-c1f4-4bd9-9c4b-b5834fc09f91",
        setting_key: "ApproveForm",
        setting_label: "Enable ATR Approval",
        setting_category: "Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "25da6bcf-3850-44bc-aa35-40ed6c92f736",
        setting_key: "RequestClarification",
        setting_label: "Request Clarification",
        setting_category: "Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "278eba86-c1fa-4b3b-b712-432f5def7457",
        setting_key: "AssignTestAuthentication",
        setting_label: "Re-auth on Analyst Assignment",
        setting_category: "Authentication",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "2b7f8ef7-1b80-4173-a2b1-ccc128593799",
        setting_key: "ReferAttachment",
        setting_label: "Refer Attachment",
        setting_category: "Storage",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "30afc1f9-a25d-427f-87f5-2a01f5e89cb0",
        setting_key: "AcceptTest",
        setting_label: "Accept Test",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "339412ad-4249-49fe-a787-e03e1d51bdee",
        setting_key: "NotebookExperimentLimit",
        setting_label: "Max Experiments per Notebook",
        setting_category: "Experiments",
        setting_value: "50",
        description: null,
        value_type: "number"
      },
      {
        id: "3be38adf-2062-4618-bbbf-19fb3c927ec0",
        setting_key: "WithdrawATRAuthentication",
        setting_label: "Re-auth on Withdraw ATR",
        setting_category: "Authentication",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "3d6818fd-7661-4882-9454-4087c6ec152a",
        setting_key: "RestrictMaxInjection",
        setting_label: "Restrict Max Injection",
        setting_category: "Test Workflow",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "42bb0fe2-23ec-40a4-ac5e-2f608d0d03e8",
        setting_key: "ATRFormNoPrefix",
        setting_label: "ATR Form No Prefix",
        setting_category: "Workflow",
        setting_value: "ATR",
        description: null,
        value_type: "text"
      },
      {
        id: "4bbe0abf-2cd7-46f7-b834-782ef710b5cf",
        setting_key: "DelayedSubmissionExpAD",
        setting_label: "Delayed Submission Warning (days)",
        setting_category: "Experiments",
        setting_value: "7",
        description: null,
        value_type: "number"
      },
      {
        id: "4c2f803b-2892-4ebb-a0ee-307a3a365a38",
        setting_key: "AttachmentSize",
        setting_label: "Max Attachment Size (MB)",
        setting_category: "Storage",
        setting_value: "10",
        description: null,
        value_type: "number"
      },
      {
        id: "4d9921d6-e1fe-45d8-94bf-fd885cf4e72b",
        setting_key: "SmtpPassword",
        setting_label: "SMTP Password",
        setting_category: "Notifications",
        setting_value: "",
        description: null,
        value_type: "text"
      },
      {
        id: "4efa7964-94c7-4ab0-9861-966d2fb4cd77",
        setting_key: "ApprovalAfterVerify",
        setting_label: "Approval After Verify",
        setting_category: "Workflow",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "4f7bc449-603d-4242-9aee-0ee0d6a272e1",
        setting_key: "AllowEditInjection",
        setting_label: "Allow Edit Injection",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "50a5af72-e75a-4078-8857-6b81c4485fcc",
        setting_key: "SmtpUser",
        setting_label: "SMTP User",
        setting_category: "Notifications",
        setting_value: "",
        description: null,
        value_type: "text"
      },
      {
        id: "558449c2-93b6-42b0-9b6b-9e73f5adbe0b",
        setting_key: "ADLengthOfNumberInNotebookCode",
        setting_label: "Notebook Code Number Length",
        setting_category: "Experiments",
        setting_value: "4",
        description: null,
        value_type: "number"
      },
      {
        id: "55b0c33b-e82b-4b33-a46e-dbc5adc6152d",
        setting_key: "ADNotebookNameSetting",
        setting_label: "Notebook Name Setting",
        setting_category: "Experiments",
        setting_value: "auto",
        description: null,
        value_type: "text"
      },
      {
        id: "5a40f23c-1a09-4741-bcfc-c2b02836297d",
        setting_key: "MailNotification",
        setting_label: "Mail Notification",
        setting_category: "Notifications",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "625a2099-cfb2-4c30-b239-7ab928748e1d",
        setting_key: "AssignTest",
        setting_label: "Assign Test",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "637a618b-8160-47df-824c-f1699cd92086",
        setting_key: "QARejectAuthentication",
        setting_label: "QA Re-auth on Reject",
        setting_category: "Authentication",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "65168b8a-d609-48b5-b853-4fe18a6254f3",
        setting_key: "BatchPurity",
        setting_label: "Batch Purity",
        setting_category: "Reporting",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "7335200a-0f91-477b-9480-345b2e7a29b6",
        setting_key: "IncludeADVerificationFlow",
        setting_label: "Include Verification Flow",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: "Gate the AD verification step in ATR workflow.",
        value_type: "boolean"
      },
      {
        id: "756c98f6-d223-4ae1-8670-e173ef0dd77c",
        setting_key: "ReportHeader",
        setting_label: "Report Header",
        setting_category: "Reporting",
        setting_value: "Analytical Research & Development",
        description: null,
        value_type: "text"
      },
      {
        id: "7b327ade-4857-4fec-a22a-d3417b4ce553",
        setting_key: "PublishTentativeWithoutVerification",
        setting_label: "Publish Tentative Without Verification",
        setting_category: "Test Workflow",
        setting_value: "True",
        description: null,
        value_type: "boolean"
      },
      {
        id: "7e5dfa04-7611-460e-815c-09080e2a7c2e",
        setting_key: "FileStoreRootPath",
        setting_label: "File Store Root Path",
        setting_category: "Storage",
        setting_value: "/data/ard/files",
        description: null,
        value_type: "text"
      },
      {
        id: "813fbb1d-8470-4d9e-968e-03ed763f42f3",
        setting_key: "IndividualTestSubmission",
        setting_label: "Individual Test Submission",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "859941db-66ba-48bf-8e60-bda289dff14a",
        setting_key: "ATRQAPreApproval",
        setting_label: "QA Pre-Approval Required",
        setting_category: "Workflow",
        setting_value: "false",
        description: "Gate the dashboard ATR-QA-pre-approval tile.",
        value_type: "boolean"
      },
      {
        id: "86fcda23-71e3-40e7-ad57-a98a5709cd79",
        setting_key: "DelayedApprovalExpAD",
        setting_label: "Delayed Approval Warning (days)",
        setting_category: "Experiments",
        setting_value: "14",
        description: null,
        value_type: "number"
      },
      {
        id: "88d65c90-f590-44a6-a89a-877bb16e04a4",
        setting_key: "TemplateIncludeStandardPreparation",
        setting_label: "Template Include Standard Preparation",
        setting_category: "STP",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "939d90cb-20cb-4186-aa38-bca69f5c6833",
        setting_key: "AttachmentType",
        setting_label: "Allowed Attachment Types",
        setting_category: "Storage",
        setting_value: "pdf,doc,docx,xls,xlsx,png,jpg",
        description: null,
        value_type: "text"
      },
      {
        id: "9581c5ca-65d6-4252-b0fa-b91dc7ee184f",
        setting_key: "QACertifyAuthentication",
        setting_label: "QA Re-auth on Certify",
        setting_category: "Authentication",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "97d68c0e-35e5-4bc0-9f36-a66467fb8f1b",
        setting_key: "ADNotebookCodePrefix",
        setting_label: "Notebook Code Prefix",
        setting_category: "Experiments",
        setting_value: "NB",
        description: null,
        value_type: "text"
      },
      {
        id: "9f5c5525-8b58-4213-8715-f612c11ee92d",
        setting_key: "DelegateTest",
        setting_label: "Delegate Test",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "a0b1685c-5532-4acf-b6e8-092877d3e1d5",
        setting_key: "SubmitTest",
        setting_label: "Submit Test",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "a33232ae-4713-43db-9fb2-39c215a604c1",
        setting_key: "QARemarks",
        setting_label: "QA Remarks",
        setting_category: "Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "a93ad41e-b105-4912-94a3-89126d3466c2",
        setting_key: "CertificationAfterApproval",
        setting_label: "Certification After Approval",
        setting_category: "Workflow",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "b4946c4b-b638-4004-9d06-204eccf25088",
        setting_key: "PublishTentative",
        setting_label: "Publish Tentative Results",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "bbac9185-630e-4938-910c-94c75eb0ce37",
        setting_key: "SmtpPort",
        setting_label: "SMTP Port",
        setting_category: "Notifications",
        setting_value: "587",
        description: null,
        value_type: "number"
      },
      {
        id: "c603aaf1-6e46-45da-9579-f7c006ec3e30",
        setting_key: "ARNumberCodeFormat",
        setting_label: "AR Number Code Format",
        setting_category: "Workflow",
        setting_value: "AR-{YYYY}-{SEQ:4}",
        description: null,
        value_type: "text"
      },
      {
        id: "d0fa4fc4-9183-4bb5-b5a8-0c13298e46d2",
        setting_key: "DelayedClarificationDays",
        setting_label: "Delayed Clarification (days)",
        setting_category: "SLA",
        setting_value: "5",
        description: null,
        value_type: "number"
      },
      {
        id: "d29530be-bf7b-4870-8fde-3f03280e2bd0",
        setting_key: "IncludeSTP",
        setting_label: "Include STP",
        setting_category: "STP",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "d570e698-863a-4092-a71d-d4d1884e4856",
        setting_key: "ModifyAfterReview",
        setting_label: "Modify After Review",
        setting_category: "Workflow",
        setting_value: "false",
        description: "Allow edits to locked/reviewed experiments.",
        value_type: "boolean"
      },
      {
        id: "d588ed26-d7bc-4f66-bc93-d9cde2c559de",
        setting_key: "DetailedReportWithAnnexure",
        setting_label: "Detailed Report With Annexure",
        setting_category: "Reporting",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "dd878779-ce04-4df3-b9ea-8f1cd9789664",
        setting_key: "ADExpCodeFormat",
        setting_label: "Experiment Code Format",
        setting_category: "Experiments",
        setting_value: "EXP-{SEQ:5}",
        description: null,
        value_type: "text"
      },
      {
        id: "de2f21a6-0a8e-4781-b022-9527ca7dae1c",
        setting_key: "DisplayAnalysedByInReport",
        setting_label: "Display Analysed By In Report",
        setting_category: "Reporting",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "de33948c-ca9d-4b3d-9fa8-a6fef7ed8b55",
        setting_key: "GracePeriodForEditingObservation",
        setting_label: "Grace Period For Editing Observation (hours)",
        setting_category: "Test Workflow",
        setting_value: "24",
        description: null,
        value_type: "number"
      },
      {
        id: "e37a6e1c-11f5-43fc-9bc9-b023b02410b6",
        setting_key: "NotYetReceivedDays",
        setting_label: "Not Yet Received (days)",
        setting_category: "SLA",
        setting_value: "3",
        description: null,
        value_type: "number"
      },
      {
        id: "ea08c3f7-f406-44d8-b735-791a6b0fb03f",
        setting_key: "ChemiaLogoRequired",
        setting_label: "Logo Required On Report",
        setting_category: "Reporting",
        setting_value: "false",
        description: null,
        value_type: "boolean"
      },
      {
        id: "eae35ee2-5e2c-4e10-bdc7-b1778962bf6e",
        setting_key: "AutoGenerationFormatForSTPCode",
        setting_label: "STP Code Format",
        setting_category: "STP",
        setting_value: "STP-{SEQ:4}",
        description: null,
        value_type: "text"
      },
      {
        id: "efb10597-a20d-4811-947f-c72df69d0532",
        setting_key: "VerifyResults",
        setting_label: "Verify Results",
        setting_category: "Test Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "f2094c8a-2b89-4daf-a225-e8211dabb350",
        setting_key: "OverdueAtrCount",
        setting_label: "Overdue ATR Count Threshold",
        setting_category: "SLA",
        setting_value: "10",
        description: null,
        value_type: "number"
      },
      {
        id: "f325f2ca-76e3-411c-8198-6e52d3ea3ac4",
        setting_key: "AddExpReference",
        setting_label: "Add Experiment Reference",
        setting_category: "Experiments",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "f3981f0d-f50d-4e5d-8094-c6fcc808f313",
        setting_key: "InactiveExperimentsAD",
        setting_label: "Inactive Experiments Threshold (days)",
        setting_category: "Experiments",
        setting_value: "30",
        description: null,
        value_type: "number"
      },
      {
        id: "f5c0ccc0-a724-41f9-8935-848b7e615798",
        setting_key: "SmtpFrom",
        setting_label: "SMTP From",
        setting_category: "Notifications",
        setting_value: "",
        description: null,
        value_type: "text"
      },
      {
        id: "f9cd2ee9-c25d-4ab4-9545-0b98ef0a6f05",
        setting_key: "MandateCertification",
        setting_label: "Mandate Certification",
        setting_category: "Workflow",
        setting_value: "true",
        description: null,
        value_type: "boolean"
      },
      {
        id: "fb1de718-5708-421d-b21c-a39b06425ec8",
        setting_key: "SmtpHost",
        setting_label: "SMTP Host",
        setting_category: "Notifications",
        setting_value: "",
        description: null,
        value_type: "text"
      },
      {
        id: "fb6c185a-7dd1-4957-8a20-81876a31e740",
        setting_key: "IndividualTestAssignment",
        setting_label: "Individual Test Assignment",
        setting_category: "Test Workflow",
        setting_value: "True",
        description: null,
        value_type: "boolean"
      },
      {
        id: "ff07e2ee-496a-407b-943c-c4c43031f3f4",
        setting_key: "AnalystQualification",
        setting_label: "Analyst Qualification Enforcement",
        setting_category: "Test Workflow",
        setting_value: "False",
        description: null,
        value_type: "boolean"
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_settings', null, {});
  }
};
