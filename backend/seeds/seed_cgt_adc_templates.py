"""Seed the CGT "ADC Synthesis" workflow template. Idempotent upsert by slug.

Definition follows the Template Builder's section -> screen -> field JSON shape
(frontend/src/pages/admin/templateBuilder/types.ts), category 'CGT_ADC' — a new
CGT modality alongside CGT_PLASMID / CGT_AAV / CGT_MOLBIO.

Content is a STARTER OUTLINE derived from the standalone ADC-module template
'adc-synthesis-v2' (seed_adc_templates.py): the same 7 sections / 23 screen
titles, but populated with a clean set of builder-native fields per screen
rather than that template's full ~1000 fields. adc-synthesis-v2 uses ADC-runtime
field types the CGT drag-and-drop builder can't represent (data-tables,
e-signatures, time-recorders, auto-IDs, Excel sheets, test-result tabs); those
are intentionally left for authoring in the builder. Extend each screen there.
"""
import os
import re
import sys
import uuid
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
import app.models.admin       # noqa: F401
import app.models.settings    # noqa: F401
import app.models.inventory   # noqa: F401
from app.models.workflow_template import WorkflowTemplate, WorkflowTemplateVersion

# ── Master-data option lists ─────────────────────────────────────────────────
UOM = ['g', 'mg', 'µg', 'mL', 'µL', 'L']
STORAGE_SHORT = ['−80 °C', '−20 °C', '2-8 °C', 'RT']
CAL_STATUS = ['OK', 'Due Soon', 'Expired']
LP_TYPES = ['MC-GGFG-DXd (Deruxtecan)', 'MC-Val-Cit-PABC-MMAE', 'SMCC-DM1', 'MC-MMAF', 'CL2A-SN-38', 'Other']
THAW_METHODS = ['Water bath', 'Ice bath', 'Room temperature', '37°C incubator']
FILTRATION_METHODS = ['Centrifugation', 'Dead-end filtration', 'Syringe filtration', 'Gravity filtration']
CHROM_TYPES = ['HIC (Hydrophobic Interaction)', 'SEC (Size Exclusion)', 'IEX (Ion Exchange)', 'Affinity', 'Other']
CHROM_MODES = ['Bind-and-elute', 'Flow-through', 'Gradient', 'Isocratic']
MEMBRANE_TYPES = ['Pellicon 3 Ultracel', 'Pellicon 3 Biomax', 'Pellicon 2 Biomax', 'Hydrosart', 'Other']
PLATE_FORMATS = ['96-well', '384-well', '24-well', 'Other']
DOE_STRATEGIES = ['Fractional factorial (resolution V)', 'Full factorial', 'Central composite design', 'D-optimal', 'Custom']
VIAL_FORMATS = ['Glass vial (2R / 6R)', 'Plastic vial', 'Pre-filled syringe', 'Other']
CONCLUSIONS = ['Release for purification', 'Hold — further review required', 'Reject — terminate batch']
DISPOSITIONS = ['Pass — release', 'Conditional pass — minor deviations', 'Fail — reject batch', 'Hold — further investigation required']

# ── Field / screen / section builders (mirrors seed_aav_templates.py) ─────────
_seq = 0
_used_names: set[str] = set()


def _mk_id(prefix: str) -> str:
    global _seq
    _seq += 1
    return f"{prefix}_{_seq}"


def _mk_name(label: str) -> str:
    base = re.sub(r'[^a-z0-9]+', '_', label.lower()).strip('_')
    base = re.sub(r'^[^a-z]+', '', base) or 'field'
    name = base
    i = 1
    while name in _used_names:
        i += 1
        name = f"{base}_{i}"
    _used_names.add(name)
    return name


def field(ftype: str, label: str, *, required=False, read_only=False, options=None, col_span=1, help_text=None, placeholder=None) -> dict:
    d = {
        'id': _mk_id('field'),
        'type': ftype,
        'label': label,
        'name': _mk_name(label),
        'colSpan': col_span,
    }
    if required:
        d['required'] = True
    if read_only:
        d['readOnly'] = True
    if options:
        d['options'] = options
    if placeholder:
        d['placeholder'] = placeholder
    if help_text:
        d['helpText'] = help_text
    return d


def text(label, **kw):  return field('SINGLE_LINE_TEXT', label, **kw)
def area(label, **kw):  return field('MULTI_LINE_TEXT', label, col_span=2, **kw)
def num(label, **kw):   return field('NUMBER', label, **kw)
def date(label, **kw):  return field('DATE', label, **kw)
def dt(label, **kw):    return field('DATE_TIME', label, **kw)
def yn(label, **kw):    return field('RADIO', label, options=['Yes', 'No', 'N/A'], **kw)
def dd(label, options, **kw): return field('DROPDOWN', label, options=list(options), **kw)


def screen(title, fields, columns=2) -> dict:
    return {'id': _mk_id('screen'), 'title': title, 'columns': columns, 'fields': fields}


def section(title, screens) -> dict:
    return {'id': _mk_id('section'), 'title': title, 'screens': screens}


def apply_phases(sections, phase_layout):
    """Tag each section with its phase per the (name, count) layout, in order."""
    total = sum(c for _, c in phase_layout)
    assert total == len(sections), f"phase_layout covers {total} but there are {len(sections)} sections"
    i = 0
    for phase_name, count in phase_layout:
        for s in sections[i:i + count]:
            s['phase'] = phase_name
        i += count


def conclusion_screen(title='Scientist Conclusion') -> dict:
    """Reusable sign-off screen (e-signature not supported by the builder — a
    scientist name + date + disposition stand in for the runtime signature)."""
    return screen(title, [
        text('Scientist name', required=True), date('Date', required=True),
        dd('Conclusion', CONCLUSIONS, required=True),
        area('Scientist conclusion'),
        area('Observations'),
    ])


# ── Template definition ──────────────────────────────────────────────────────
def build_adc_synthesis():
    # Antibody Info driver dropdown (inventory-backed: Materials) + its
    # auto-filled dependents. Mirrors the standalone ADC module's "1.1 Antibody
    # Info" screen as closely as this builder's field set allows — there is no
    # button/action field type here, so the reference screen's "Submit to AD"
    # button has no equivalent and is intentionally omitted.
    antibody_field = field('DROPDOWN', 'Antibody (select from registry)', required=True)
    antibody_field['optionsMode'] = 'inventory'
    antibody_field['inventorySource'] = {'source': 'materials', 'valueField': 'code', 'labelField': 'name'}

    def autofilled(f, attribute):
        f['autoFill'] = {'sourceFieldName': antibody_field['name'], 'attribute': attribute}
        return f

    sections = [
        # 1. Materials & Consumables — five standalone sections (not nested
        # screens under one section), all grouped under the MATERIALS & SETUP
        # phase below.
        section('1.1 Antibody Info', [
            screen('Antibody Identity', [
                antibody_field,
                autofilled(text('Name'), 'name'),
                autofilled(text('ISO Type'), 'iso_type'),
                autofilled(text('CAS No'), 'cas_no'),
                autofilled(text('Storage Condition', required=True), 'storage_condition'),
            ]),
            screen('Batch Information (table)', [
                text('In-house Lot / Batch No'), text('SKU / Pack ID'), text('MFG Lot No'),
                text('Manufacturer'), date('Exp. Date'), num('Qty'),
            ]),
            screen('Sample for Analysis', [
                num('Sample Qty', required=True), dd('Unit', UOM),
            ]),
            screen('Test Required (table)', [
                text('Test / Analysis'), text('Method'), text('Acceptance Criteria'), text('Remarks'),
            ]),
            screen('Sample Analysis Results (table)', [
                text('Sample ID'), text('Test / Analysis'), text('Method'),
                text('Acceptance Criteria'), text('Results'), dd('Status', ['Pass', 'Fail', 'Pending']),
            ]),
            screen('Conclusion', [
                area('Observations', required=True),
            ]),
        ]),
        section('1.2 Linker-payload Info', [
            screen('1.2 Linker-payload Info', [
                text('Linker-Payload (from registry)', required=True), text('LP Name'),
                text('DAR target (linker-payload : mAb)'), dd('Linker-payload type', LP_TYPES),
                text('LP CAS No'), text('LP Storage Condition'),
                num('LP Sample Qty'), dd('LP Unit', UOM),
            ]),
        ]),
        section('1.3 Reagents & Salts', [
            screen('1.3 Reagents & Salts', [
                text('Reagent name'), text('Lot No'), text('Grade'),
                num('Quantity'), dd('Reagent unit', UOM), area('Observations'),
            ]),
        ]),
        section('1.4 Consumables', [
            screen('1.4 Consumables', [
                text('Consumable name'), text('Catalogue No'), text('Consumable Lot No'),
                area('Consumable observations'),
            ]),
        ]),
        section('1.5 Equipment/Instrument Details', [
            screen('1.5 Equipment/Instrument Details', [
                text('Equipment ID'), text('Equipment name'),
                dd('Calibration status', CAL_STATUS), area('Equipment observations'),
            ]),
        ]),
        # 2. Buffer Preparation
        section('2. Buffer Preparation', [
            screen('2.1 Buffer Preparation', [
                text('Buffer name'), area('Composition'), num('pH'),
                text('Prepared by'), date('Prepared date'), area('Buffer observations'),
            ]),
        ]),
        # 3. Bioconjugation
        section('3. Bioconjugation', [
            screen('3.1 Thaw, Pool & Filter mAb', [
                dd('Thawing method', THAW_METHODS), text('Thawing temperature'),
                dt('Thaw start time'), dt('Thaw end time'),
                num('Total pooled volume'), dd('Total pooled volume unit', UOM),
                dd('Filtration method', FILTRATION_METHODS), area('Observations'),
            ]),
            screen('3.2 System Checks', [
                yn('System check performed'), area('System check observations'),
            ]),
            screen('3.3 Reactant / Batch Calculation', [
                num('Batch size'), dd('Batch size unit', UOM),
                area('Calculation notes / assumptions'),
            ]),
            screen('3.4 Reduction Reaction (TCEP)', [
                text('Intermediate output ID'), text('Parent lot(s)'),
                num('Available volume'), dd('Available volume unit', UOM),
                text('Target molar ratio (TCEP:mAb)'), text('Actual molar ratio (TCEP:mAb)'),
                text('Planned duration'), area('Reduction observations'),
            ]),
            screen('3.5 Conjugation Reaction (Linker-Payload)', [
                text('Conjugation intermediate output ID'), text('Parent lineage'),
                num('Conjugation available volume'), dd('Conjugation available volume unit', UOM),
                num('LP Volume added'), dd('LP Volume added unit', UOM),
                text('Target molar ratio (LP:mAb-SH)'), area('Conjugation observations'),
            ]),
            screen('3.6 In Process Analysis and Quenching', [
                text('Input intermediate ID'), text('Quench parent lineage'),
                num('Quench available volume'), dd('Quench available volume unit', UOM),
                text('NAC lot'), text('NAC : Linker-Payload molar ratio'),
                dt('Start time'), text('Quench time'),
            ]),
            conclusion_screen('3.7 Scientist Conclusion'),
        ]),
        # 4. Purification & Analysis
        section('4. Purification & Analysis', [
            screen('4.1 Purification', [
                text('Purification intermediate output ID'), text('Purification parent lineage'),
                num('Purification available volume (µL)'), dd('Chromatography type', CHROM_TYPES),
                dd('Mode', CHROM_MODES), text('Resin / column'), text('Resin lot'),
                area('Purpose'),
            ]),
            screen('4.2 UF/DF', [
                text('UF/DF intermediate output ID'), text('UF/DF parent lineage'),
                num('UF/DF available volume'), dd('UF/DF available volume unit', UOM),
                num('Starting concentration (mg/mL)'), num('Starting protein mass (mg)'),
                text('Incoming buffer'), dd('Membrane type', MEMBRANE_TYPES),
            ]),
            conclusion_screen('4.3 Scientist Conclusion'),
        ]),
        # 5. Analytical Characterization DS
        section('5. Analytical Characterization DS', [
            screen('5.1 Analytical Sample', [
                text('Analytical parent lineage'), text('Registered by'),
                num('Concentration (mg/mL)'), num('Total volume available (µL)'),
                text('Lot / batch number'), text('Storage condition'),
                text('Formulation buffer'), area('Sample registration notes'),
            ]),
            screen('5.2 ADC Results', [
                area('Overall analytical comments'), area('Observations'),
            ]),
            screen('5.3 Scientist Conclusion', [
                text('Scientist name', required=True), date('Date', required=True),
                dd('Preliminary disposition', DISPOSITIONS, required=True),
                text('Average DAR achieved'), text('SEC monomer purity'),
                area('Scientist conclusion'), area('Risks and mitigations (if any)'),
                area('Observations'),
            ]),
        ]),
        # 6. Formulation & Lyo Studies
        section('6. Formulation & Lyo Studies', [
            screen('6.1 High-throughput Formulation Screening', [
                text('Intermediate sample'), text('Formulation parent lineage'),
                num('Available volume (mL)'), num('Starting concentration (mg/mL)'),
                num('Starting DAR (LC-MS)'), text('Incoming buffer'),
                dd('Plate format', PLATE_FORMATS), dd('DoE strategy', DOE_STRATEGIES),
            ]),
            screen('6.2 Formulation Optimization Screening', [
                text('Top candidates carried'), text('Source intermediate'),
                num('ADC concentration (mg/mL)'), dd('Format', VIAL_FORMATS),
                dd('Optimization DoE strategy', DOE_STRATEGIES), num('Number of formulations'),
                num('Replicates per condition'), num('Fill volume per vial (mL)'),
            ]),
            screen('6.3 Lyophilization Cycle Optimization Suites', [
                text('Locked formulation'), text('Composition'),
                num('Lyo ADC concentration (mg/mL)'), num('Lyo available volume (mL)'),
                num("Tg' (glass transition of maximally freeze-concentrated phase)"),
                num('Tc (collapse temperature)'), text('Te (eutectic, if present)'),
                area('Lyo observations'),
            ]),
            conclusion_screen('6.4 Scientist Conclusion'),
        ]),
        # 7. Analytical Characterization (DP Release)
        section('7. Analytical Characterization (DP Release)', [
            screen('7.1 DP Sample Registration', [
                text('Source sample ID (from 6.3)'), text('DP parent lineage'),
                text('DP registered by'), num('DP concentration (mg/mL)'),
                num('Total volume available (mL)'), text('DP lot / batch number'),
                text('DP formulation buffer'), dd('Storage condition', STORAGE_SHORT),
            ]),
            screen('7.2 DP Analytical Results', [
                dd('All results within release specification?', ['Yes', 'No', 'N/A']),
                area('OOS details (if any)'), area('Overall analytical comments'),
                area('Observations'),
            ]),
            screen('7.3 Scientist Conclusion', [
                text('DP scientist name', required=True), date('DP date', required=True),
                dd('DP preliminary disposition', DISPOSITIONS, required=True),
                text('DP average DAR achieved'), text('SEC monomer purity (%)'),
                text('Final concentration (mg/mL)'), text('Endotoxin result (EU/mL)'),
                text('Bioburden result (CFU/mL)'),
            ]),
        ]),
    ]
    apply_phases(sections, [
        ('MATERIALS & SETUP', 5),        # sections 1.1-1.5 (Antibody/LP Info, Reagents, Consumables, Equipment)
        ('BUFFER PREPARATION', 1),       # Buffer Preparation — its own phase, not grouped under Materials & Setup
        ('BIOCONJUGATION', 1),           # Bioconjugation
        ('PURIFICATION', 1),             # Purification & Analysis
        ('DS CHARACTERIZATION', 1),      # Analytical Characterization DS
        ('FORMULATION & LYO', 1),        # Formulation & Lyo Studies
        ('DP RELEASE', 1),               # Analytical Characterization (DP Release)
    ])
    return {'sections': sections}


TEMPLATES = [
    {'slug': 'cgt-adc-synthesis', 'name': 'ADC Synthesis', 'category': 'CGT_ADC',
     'description': 'Antibody-drug conjugate synthesis — materials, buffer prep, bioconjugation, '
                    'purification, DS/DP analytical characterization & formulation/lyo studies '
                    '(starter outline from the ADC Synthesis v2 spec).',
     'build': build_adc_synthesis},
]


def seed():
    db = SessionLocal()
    try:
        for tmpl in TEMPLATES:
            global _used_names
            _used_names = set()
            definition = tmpl['build']()
            now = datetime.datetime.utcnow()
            existing = db.query(WorkflowTemplate).filter(WorkflowTemplate.slug == tmpl['slug']).first()
            if existing:
                existing.name = tmpl['name']
                existing.category = tmpl['category']
                existing.description = tmpl['description']
                existing.definition = definition
                existing.updated_at = now
                latest = (
                    db.query(WorkflowTemplateVersion)
                    .filter(WorkflowTemplateVersion.template_id == existing.id)
                    .order_by(WorkflowTemplateVersion.version.desc())
                    .first()
                )
                if latest:
                    latest.definition = definition
                    latest.saved_at = now
                print(f"Updated: {tmpl['slug']}")
            else:
                t = WorkflowTemplate(
                    id=uuid.uuid4(), slug=tmpl['slug'], name=tmpl['name'],
                    description=tmpl['description'], category=tmpl['category'],
                    version=1, is_active=True, definition=definition,
                    created_at=now, updated_at=now,
                )
                db.add(t)
                db.add(WorkflowTemplateVersion(
                    id=uuid.uuid4(), template_id=t.id, version=1,
                    definition=definition, saved_at=now,
                ))
                print(f"Created: {tmpl['slug']}")
        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == '__main__':
    seed()
