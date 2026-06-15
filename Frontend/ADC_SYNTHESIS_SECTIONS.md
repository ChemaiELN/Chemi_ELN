# ADC Synthesis v2 — Workflow Template Sections Summary

Sections 1–6 extracted from `ADC_synthesis_v2.jsx`.

---

## Section 1 — Project and Experiment Information

### Screen 1.1: Project Master
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | project_id | Project ID | text | true |
  | customer | Customer | text | true |
  | product_name | Product Name | text | true |
  | adc_code | ADC Code | text | true |
  | target_antigen | Target Antigen | text | true |
  | antibody_clone | Antibody Clone | text | true |
  | payload | Payload | text | true |
  | linker | Linker | text | true |
  | target_dar | Target DAR | text | true |
  | project_stage | Project Stage | select | true |
  | project_master_remarks | Project Master · Remarks | textarea | false |

### Screen 1.2: Team Assignment
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | pd_scientist | PD Scientist | select | true |
  | pd_reviewer | PD Reviewer | select | true |
  | analytical_scientist | Analytical Scientist | select | true |
  | analytical_reviewer | Analytical Reviewer | select | true |
  | qa_reviewer | QA Reviewer | select | true |
  | department | Department | text | true |
  | site | Site | text | true |
  | qa_review_required | QA Review required? | select | false |

### Screen 1.3: Experiment Metadata
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | general_information | General Information | text | false |
  | experiment_number | Experiment Number | text | true |
  | notebook_number | Notebook Number | text | true |
  | version | Version | text | true |
  | date | Date | date | false |
  | scientist | Scientist | text | false |

### Screen 1.4: Objective
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | objective_study_purpose | Objective · Study purpose | textarea | false |
  | objective_hypothesis | Objective · Hypothesis | textarea | false |
  | objective_success_criteria | Objective · Success criteria | textarea | false |

### Screen 1.5: Related Documents
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | related_documents_files | Related Documents | file | false |
  | related_documents_comments | Comments on references | textarea | false |

### Screen 1.6: Regulatory Classification Cytotoxic
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | oel_band | OEL band | select | true |
  | containment_category | Containment category | select | true |
  | gmp_non_gmp | GMP / Non-GMP | select | true |

### Screen 1.7: Risk Assessment
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | assessment_id | Assessment ID | text | true |
  | assessment_type | Assessment type | select | true |
  | last_reviewed | Last reviewed | date | false |
  | reviewed_by | Reviewed by | text | true |
  | overall_risk_level | Overall risk level | select | true |
  | risk_status | Status | select | true |
  | risk_additional_notes | Risk Assessment · Additional notes | textarea | false |

---

## Section 2 — Materials and Consumables

### Screen 2.1: Antibody Info
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | antibody_code | Antibody code | text | true |
  | antibody_clone | Clone | text | true |
  | isotype | Isotype | select | true |
  | antibody_molecular_weight | Molecular weight (Da) | text | true |
  | lot_number | Lot number | text | true |
  | manufacturing_date | Manufacturing date | date | true |
  | antibody_storage_conditions | Storage conditions | select | true |
  | antibody_expiry_date | Expiry date | date | true |
  | antibody_supporting_documents | Supporting documents (CoA, release certificate, batch record) | file | false |
  | antibody_doc_comments | Comments | textarea | false |

### Screen 2.2: Linker-payload Info
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | linker_type | Linker type | select | true |
  | payload_type | Payload type | select | true |
  | linker_payload_type | Linker-payload type | select | true |
  | lp_molecular_weight | Molecular weight (Da) | text | true |
  | dar_target | DAR target (linker-payload : mAb) | text | true |
  | lp_lot_number | Lot number | text | true |
  | lp_supplier | Supplier | text | true |
  | lp_coa_upload | Upload CoA / supplier documents | file | false |
  | lp_doc_comments | Comments | textarea | false |

### Screen 2.3: Reagents and Salts
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | reagent_chemical | Chemical | text | true |
  | reagent_make | Make | text | false |
  | reagent_cat_no | Cat. No. | text | false |
  | reagent_cas_no | CAS No. | text | false |
  | reagent_coa | CoA | file | false |
  | reagent_msds | MSDS | file | false |
  | reagent_others | Others | text | false |

### Screen 2.4: Consumables
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | consumable_item | Item | text | true |
  | consumable_category | Category | text | false |
  | consumable_make | Make / Brand | text | false |
  | consumable_cat_no | Catalogue No. | text | false |
  | consumable_lot_no | Lot No. | text | false |
  | consumable_qty | Quantity used | number | false |
  | consumable_unit | Unit | text | false |
  | consumable_remarks | Step remarks / operator observations | textarea | false |

### Screen 2.5: Equipment Details
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | equipment_name | Name of Equipment | text | true |
  | equipment_id | Equipment ID | text | true |
  | equipment_logbook_no | Log Book No. | text | false |
  | calibration_status | Calibration Status | select | true |
  | calibration_due | Calibration Due | date | false |
  | pv_due | PV Due | date | false |

---

## Section 3 — Buffer Preparation

### Screen 3.1: Buffer Preparation
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | buffer_name | Buffer Name | text | true |
  | buffer_subtitle | Buffer description / subtitle | text | false |
  | buffer_makeup_volume_ml | Make-up volume (mL) | number | true |
  | buffer_required_conc | Required concentration | number | true |
  | buffer_required_conc_uom | Concentration UOM | select | true |
  | buffer_components | Components (name and quantity) | textarea | true |
  | buffer_qc_before_ph | QC before adjustment · pH | number | true |
  | buffer_qc_before_cond | QC before adjustment · Conductivity (mS/cm) | number | true |
  | buffer_qc_after_ph | QC after adjustment · pH | number | true |
  | buffer_qc_after_cond | QC after adjustment · Conductivity (mS/cm) | number | true |
  | buffer_storage_temp | Storage temperature | text | true |

---

## Section 4 — Bioconjugation

### Screen 4.1: Thaw, Pool and Filter mAb
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | batch_record_id | Batch Record ID | text | true |
  | mab_lot_no | Lot No. | text | true |
  | mab_vial_id | Vial ID | text | true |
  | mab_initial_volume_ul | Initial volume (µL) | number | true |
  | mab_concentration_um | Concentration (µM) | number | true |
  | mab_storage | Storage | text | false |
  | thawing_method | Thawing method | select | true |
  | thawing_temperature_c | Thawing temperature (°C) | number | true |
  | thaw_start_time | Thaw start time | text | true |
  | thaw_end_time | Thaw end time | text | true |
  | thaw_duration_auto | Duration (auto) | text | false |
  | vials_pooled_count | Vials pooled (count) | number | true |
  | pooling_container_ids | Pooling container ID(s) | text | true |
  | total_pooled_volume_ul | Total pooled volume (µL) | number | true |
  | filter_type | Filter type | select | true |
  | filter_lot | Filter lot | text | true |
  | filter_expiry | Filter expiry | date | false |
  | filtration_method | Filtration method | select | true |
  | filtration_speed_pressure | Speed / pressure | text | true |
  | filtration_duration_min | Duration (min) | number | true |
  | recovered_volume_ul | Recovered volume (µL) | number | true |
  | thaw_intermediate_sample_id | Sample ID | text | true |
  | thaw_storage_condition | Storage condition | select | true |
  | thaw_storage_location | Storage location | text | true |
  | thaw_step_remarks | Step remarks / operator observations | textarea | false |

### Screen 4.2: System Checks
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | training_verified | Training verified | text | true |
  | access_verified | Access verified | text | true |
  | template_version_locked | Template version locked | text | true |
  | material_status_check | Material status check | text | true |
  | equipment_readiness | Equipment readiness | text | true |
  | containment_verified | Containment verified | text | true |

### Screen 4.3: Reduction Reaction
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | reduction_intermediate_sample | Intermediate sample | select | true |
  | reduction_parent_lots | Parent lot(s) | text | false |
  | reduction_available_volume_ul | Available volume (µL) | number | false |
  | reducing_agent | Reducing agent | select | true |
  | tcep_lot | TCEP lot (from registry) | select | true |
  | equivalents_vs_mab | Equivalents (vs mAb) | text | true |
  | target_molar_ratio_tcep_mab | Target molar ratio (TCEP : mAb) | number | true |
  | actual_molar_ratio_tcep_mab | Actual molar ratio (TCEP : mAb) | number | true |
  | reduction_planned_duration | Planned duration | text | true |
  | reduction_temperature_c | Temperature (°C) | number | true |
  | protein_concentration | Protein concentration | text | true |
  | mixing_conditions | Mixing conditions | text | true |
  | hold_time | Hold time | text | true |
  | reduction_reaction_start_time | Reaction start time | text | true |
  | reduction_reaction_end_time | Reaction end time | text | true |
  | reduction_duration_auto | Duration (auto) | text | false |
  | reduction_free_thiols_per_mab | Free thiols (per mAb) — result | number | false |
  | reduction_residual_reductant | Residual reductant (TCEP) — result | text | false |
  | reduction_dar_prediction | DAR prediction — result | text | false |
  | reduction_sec_chromatograms | Attachments — SEC chromatograms | file | false |
  | reduction_ms_spectra | Attachments — MS spectra | file | false |
  | reduction_reduced_mab_sample_id | New intermediate Sample ID | text | true |
  | reduction_output_storage_condition | Storage condition | select | true |
  | reduction_operator_observations | Operator observations | textarea | false |
  | reduction_deviations_observations | Deviations · Observations | textarea | false |
  | reduction_deviations_corrective_actions | Deviations · Corrective actions | textarea | false |

### Screen 4.4: Conjugation Reaction (Linker-Payload)
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | conjugation_intermediate_sample | Intermediate sample | select | true |
  | conjugation_parent_lineage | Parent lineage | text | false |
  | conjugation_available_volume_ul | Available volume (µL) | number | false |
  | lp_lot | Linker-Payload lot | select | true |
  | lp_expiry_retest | LP expiry / retest | date | false |
  | lp_added_ul | LP added (µL) | number | true |
  | dmso_lot | DMSO lot | select | true |
  | dmso_grade | DMSO grade | text | false |
  | dmso_added_ul | DMSO added (µL) | number | true |
  | target_molar_ratio_lp_mab_sh | Target molar ratio (LP : mAb-SH) | text | true |
  | actual_molar_ratio_lp_mab_sh | Actual molar ratio (LP : mAb-SH) | text | true |
  | conjugation_reaction_start_time | Reaction start time | text | true |
  | conjugation_reaction_end_time | Reaction end time | text | true |
  | conjugation_duration_auto | Duration (auto) | text | false |
  | target_dar | Target DAR | text | true |
  | solvent_composition | Solvent composition | text | true |
  | addition_mode | Addition mode | select | true |
  | addition_rate | Addition rate | text | true |
  | conjugation_mixing_speed | Mixing speed | text | true |
  | conjugation_temperature | Temperature | text | true |
  | conjugation_crude_adc_sample_id | New crude ADC Sample ID | text | true |
  | conjugation_output_volume_ul | Volume registered (µL) | number | true |
  | conjugation_output_storage_condition | Storage condition | select | true |
  | conjugation_step_remarks | Step remarks / contemporaneous notes | textarea | false |
  | conjugation_deviations_observations | Deviations · Observations | textarea | false |
  | conjugation_deviations_corrective_actions | Deviations · Corrective actions | textarea | false |

### Screen 4.5: In Process Analysis and Quenching
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | nac_lot | NAC lot | text | true |
  | nac_lp_molar_ratio | NAC : Linker-Payload molar ratio | text | true |
  | quench_time_min | Quench time | text | true |
  | quench_start_time | Start time | text | true |
  | quench_end_time | End time | text | true |
  | quench_temperature | Quench Temperature | text | true |
  | dar_time0 | Time0 DAR | number | false |
  | dar_time30 | Time30 DAR | number | false |
  | dar_time60 | Time60 DAR | number | false |
  | dar_time90 | Time90 DAR | number | false |

---

## Section 5 — Purification

### Screen 5.1: 5.1 Purification
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | purif_intermediate_sample | Intermediate sample | select | true |
  | purif_parent_lineage | Parent lineage | text | false |
  | purif_available_volume_ul | Available volume (µL) | number | false |
  | chromatography_type | Chromatography type | select | true |
  | chromatography_mode | Mode | select | true |
  | chromatography_purpose | Purpose | text | true |
  | resin_column | Resin / column | select | true |
  | resin_lot | Resin lot | text | true |
  | column_dimensions_mm | Column dimensions (Ø × L, mm) | text | true |
  | bed_column_volume_ml | Bed / column volume (mL) | number | true |
  | flow_rate_ml_min | Flow rate (mL/min) | number | true |
  | residence_time_min | Residence time (min) | number | false |
  | load_mg_per_ml_resin | Load (mg ADC / mL resin) | number | true |
  | column_temperature_c | Column temperature (°C) | number | true |
  | instrument_id | System / instrument ID | select | true |
  | gradient_type | Gradient type | select | true |
  | gradient_start_pct_b | Start %B | number | true |
  | gradient_end_pct_b | End %B | number | true |
  | gradient_length_cv | Gradient length (CV) | number | true |
  | wash_cv | Wash (CV at start %B) | number | false |
  | re_equilibration_cv | Re-equilibration (CV of A) | number | false |
  | run_start_time | Run start time | text | true |
  | run_end_time | Run end time | text | true |
  | run_duration_auto | Duration (auto) | text | false |
  | chrom_uv_traces | Process Data · UV traces / chromatogram attachments | file | false |
  | pooling_criteria | Pooling criteria | select | true |
  | fractions_pooled | Fractions pooled | text | true |
  | pool_volume_ml | Pool volume (mL) | number | true |
  | pool_a280_mau | Pool A280 (mAU) | number | false |
  | pool_mass_balance_pct | Pool mass balance (% of load) | number | false |
  | step_recovery_pct | Step recovery (protein mass) — result | text | false |
  | monomer_purity_pct | Monomer purity — result | text | false |
  | free_drug_pct | Free drug (unconjugated) — result | text | false |
  | chrom_analytical_files | Attachments — analytical chromatograms (HIC, SEC, RP, LC-MS) | file | false |
  | purified_adc_sample_id | New intermediate Sample ID | text | true |
  | purif_output_storage_condition | Storage condition | select | true |

### Screen 5.2: 5.2 UF/DF
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | ufdf_intermediate_sample | Intermediate sample | select | true |
  | ufdf_parent_lineage | Parent lineage | text | false |
  | ufdf_available_volume_ml | Available volume (mL) | number | false |
  | ufdf_starting_conc_mg_ml | Starting concentration (mg/mL) | number | false |
  | ufdf_starting_mass_mg | Starting protein mass (mg) | number | false |
  | incoming_buffer | Incoming buffer | text | false |
  | membrane_type | Membrane type | select | true |
  | mwco | MWCO | select | true |
  | surface_area_cm2 | Surface area (cm²) | number | true |
  | membrane_part_number | Membrane part number | text | true |
  | membrane_lot | Membrane lot | text | true |
  | membrane_installed_cycles | Membrane installed (cycles) | number | true |
  | tff_system_instrument_id | TFF system / instrument ID | select | true |
  | pre_use_nwp | Pre-use NWP (LMH/psi) | number | true |
  | df_buffer_name | Diafiltration buffer name | text | true |
  | df_buffer_composition | Diafiltration buffer composition | text | true |
  | df_buffer_lot | Diafiltration buffer lot | text | true |
  | df_buffer_conductivity | Diafiltration buffer conductivity (mS/cm) | number | true |
  | df_buffer_ph | Diafiltration buffer pH | number | true |
  | ufdf_mode | Mode | select | true |
  | tmp_target_psi | TMP target (psi) | number | true |
  | feed_flow_rate_ml_min | Feed flow rate (mL/min) | number | true |
  | crossflow_lmm | Crossflow (L/m²/min) | number | true |
  | flux_lmh | Flux (LMH) | number | true |
  | diafiltration_volumes | Diafiltration volumes (DV) | number | true |
  | df_mode | DF mode | select | true |
  | process_temperature_c | Process temperature (°C) | number | true |
  | target_retentate_conc_mg_ml | Target retentate concentration (mg/mL) | number | true |
  | ufdf_run_start_time | Run start time | text | true |
  | ufdf_run_end_time | Run end time | text | true |
  | ufdf_total_duration_auto | Total duration (auto) | text | false |
  | post_use_nwp | Post-use NWP (LMH/psi) | number | true |
  | nwp_recovery_pct | NWP recovery (%) | number | false |
  | ufdf_run_log | Process Data · TFF run log / pressure profile | file | false |
  | ufdf_step_recovery_pct | Step recovery (protein mass) — result | text | false |
  | ufdf_final_conc_mg_ml | Final retentate concentration — result | text | false |
  | ufdf_retentate_conductivity | Retentate conductivity — result | text | false |
  | ufdf_analytical_files | Attachments — analytical chromatograms | file | false |
  | ufdf_step_remarks | Step remarks / operator observations | textarea | false |
  | ds_intermediate_sample_id | New intermediate Sample ID | text | true |
  | ufdf_output_storage_condition | Storage condition | select | true |

### Screen 5.3: 5.3 Scientist Conclusion
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | scientist_conclusion | Scientist conclusion | textarea | true |
  | disposition | Conclusion | select | true |

### Screen 5.4: 5.4 Peer Review → Approval e-Sig → Record Locked
- **Persona:** Reviewer | **has_signature:** true | **has_files:** false
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | reviewer_username | Reviewer username | text | true |
  | reviewer_password | Password (2nd component) | text | true |
  | reason_for_signature | Reason for signature | select | true |
  | signature_timestamp | Signature timestamp | text | false |

---

## Section 6 — Formulation and Lyo Studies

### Screen 6.1: 6.1 High-throughput Formulation Screening
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | ht_intermediate_sample | Intermediate sample | select | true |
  | ht_available_volume_ml | Available volume (mL) | number | false |
  | ht_starting_conc_mg_ml | Starting concentration (mg/mL) | number | false |
  | ht_starting_dar | Starting DAR (LC-MS) | number | false |
  | ht_incoming_buffer | Incoming buffer | text | false |
  | plate_format | Plate format | select | true |
  | doe_strategy | DoE strategy | select | true |
  | number_of_formulations | Number of formulations | number | true |
  | replicates_per_condition | Replicates per condition | number | true |
  | working_volume_per_well_ul | Working volume per well (µL) | number | true |
  | robotics_platform | Robotics platform | select | true |
  | ht_ph_range | pH range | text | true |
  | ht_ionic_strength_mm | Ionic strength (mM) | text | true |
  | ht_adc_concentration_levels | ADC concentration levels (mg/mL) | text | true |
  | ht_execution_observations | Execution Observations / Deviations | textarea | false |
  | ht_analytical_files | Attachments — DoE plate map, SEC / HIC / RP / LC-MS chromatograms | file | false |

### Screen 6.2: 6.2 Formulation Optimization Screening
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | opt_top_candidates | Top candidates carried | text | true |
  | opt_source_intermediate | Source intermediate | select | true |
  | opt_adc_concentration_mg_ml | ADC concentration (mg/mL) | number | true |
  | opt_format | Format | select | true |
  | opt_doe_strategy | DoE strategy | select | true |
  | opt_number_of_formulations | Number of formulations | number | true |
  | opt_replicates_per_condition | Replicates per condition | number | true |
  | opt_fill_volume_per_vial_ml | Fill volume per vial (mL) | number | true |
  | opt_headspace | Headspace | select | true |
  | opt_ph_range | pH range | text | true |
  | opt_ionic_strength_mm | Ionic strength (mM) | text | true |
  | opt_adc_concentration_levels | ADC concentration levels (mg/mL) | text | true |
  | opt_execution_observations | Execution Observations / Deviations | textarea | false |
  | locked_formulation_id | Locked formulation ID | text | true |
  | recipe_version | Recipe version | select | true |
  | recipe_approver | Recipe approver | text | false |
  | recipe_effective_date | Effective date | date | false |
  | recipe_change_history | Recipe change history | textarea | false |
  | opt_stability_data_files | Attachments — extended stability data | file | false |

### Screen 6.3: 6.3 Lyophilization Cycle Optimization Suites
- **Persona:** PD Scientist | **has_signature:** false | **has_files:** true
- Fields:
  | Key | Label | Type | Required |
  |-----|-------|------|----------|
  | lyo_locked_formulation | Locked formulation | text | false |
  | lyo_composition | Composition | text | false |
  | lyo_adc_concentration_mg_ml | ADC concentration (mg/mL) | number | true |
  | lyo_source_intermediate | Source intermediate | select | true |
  | lyo_available_volume_ml | Available volume (mL) | number | false |
  | tg_prime_c | Tg′ (glass transition of maximally freeze-concentrated phase) | text | true |
  | tc_collapse_temp_c | Tc (collapse temperature) | text | true |
  | te_eutectic_c | Te (eutectic, if present) | text | true |
  | tg_dry_product_c | Tg (dry product) | text | true |
  | thermal_char_method | Method | select | true |
  | thermal_char_instrument_id | Instrument ID | text | true |
  | selected_lyo_cycle | Selected cycle | select | true |
  | lyophilizer_instrument_id | Lyophilizer instrument ID | select | true |
  | loading_temperature_c | Loading temperature (°C) | number | true |
  | annealing_step | Annealing step? | select | true |
  | lyo_cycle_start_time | Cycle start time | text | true |
  | lyo_cycle_end_time | Cycle end time | text | true |
  | lyo_cycle_log_files | Process Data · Lyo cycle log | file | false |
  | lyo_execution_observations | Execution Observations / Deviations | textarea | false |
  | lead_vial_fill | Lead vial / fill | text | true |
  | lead_lyo_cycle | Lead lyo cycle | text | true |
  | lead_selection_justification | Justification (one-line) | text | true |
  | lyo_analytical_files | Attachments — post-lyo analytical | file | false |

---

*Generated from ADC_synthesis_v2.jsx — sections 1 through 6 only.*
