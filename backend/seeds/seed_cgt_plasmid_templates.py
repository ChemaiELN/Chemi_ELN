"""Seed CGT Plasmid workflow templates (Plasmid USP, Plasmid DDV).

Idempotent upsert by slug. Definitions follow the Template Builder's
section -> screen -> field JSON shape
(frontend/src/pages/admin/templateBuilder/types.ts), category 'CGT_PLASMID',
so they load directly in the CGT Plasmid Template Builder.

Field content is sourced from docs/scientist_runtime_detailed_fields.md
(USP = section 2, DDV = section 1). Data tables from the doc are represented
as a screen whose fields are the table's columns (the builder is a flat form
designer with no repeatable-table field type); Yes/No/N-A checklist items
become RADIO fields; master-data dropdowns are inlined as static options.
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

# ── Master-data option lists (inlined; see doc "Master Data Reference") ────────
STORAGE = [
    'Room temperature (RT)', 'Controlled RT', 'Refrigerated (2-8 °C)',
    'Cold (-20 °C ± 5)', 'Deep frozen (-80 °C ± 10)', 'LN₂ vapor phase',
    'LN₂ liquid phase', 'Incubator (37 °C / 5% CO₂)', 'Cool (8-15 °C)',
]
SAMPLE_TYPES = [
    'In-process', 'Cell pellet', 'Supernatant', 'Cell lysate', 'Clarified harvest',
    'Column eluate', 'Pooled fraction', 'UF/DF pool', 'Bulk Drug Substance',
    'Drug Substance', 'Drug Product', 'Reference Standard', 'Retain', 'Stability', 'Spiked control',
]
METHODS = [
    'ddPCR-ITR', 'ddPCR-WPRE', 'qPCR-gen', 'ELISA-cap', 'ELISA-p24', 'ELISA-HCP',
    'SEC-MALS', 'AUC', 'CDMS', 'cryo-EM', 'AEX-HPLC', 'CGE', 'A260_A280', 'FlowCAR', 'FlowVia',
]
DEVIATIONS = [
    'Minor', 'Major', 'Critical', 'Out-of-specification', 'Out-of-trend',
    'Out-of-calibration', 'Out-of-limit', 'Out-of-expectation',
]
MAT_STORAGE = ['RT', '4 °C', '-20 °C', '-80 °C']
CAL_STATUS = ['OK', 'Due Soon', 'Expired']
GMG = ['g', 'mg']
LML = ['L', 'mL']
CONC_UOM = ['mM', 'M', 'μM', 'mg/mL', 'g/L', '%']

# ── Field / screen / section builders ──────────────────────────────────────────
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


# shorthands
def text(label, **kw):  return field('SINGLE_LINE_TEXT', label, **kw)
def area(label, **kw):  return field('MULTI_LINE_TEXT', label, col_span=2, **kw)
def num(label, **kw):   return field('NUMBER', label, **kw)
def date(label, **kw):  return field('DATE', label, **kw)
def dt(label, **kw):    return field('DATE_TIME', label, **kw)
def yn(label, **kw):    return field('RADIO', label, options=list(['Yes', 'No', 'N/A']), **kw)
def passfail(label, **kw): return field('RADIO', label, options=list(['Pass', 'Fail']), **kw)
def dd(label, options, **kw): return field('DROPDOWN', label, options=list(options), **kw)
def check(label, **kw): return field('CHECKBOX', label, **kw)


def screen(title, fields, columns=2) -> dict:
    return {'id': _mk_id('screen'), 'title': title, 'columns': columns, 'fields': fields}


def section(title, screens) -> dict:
    return {'id': _mk_id('section'), 'title': title, 'screens': screens}


def filtration_screens(prefix=''):
    """Reusable Filtration screens (doc §2.5-2.8).

    Matches the runtime layout: an N/A toggle, a repeatable Filter table,
    a Filtration Results block (pH / osmolality), then a Sample Results table.
    """
    p = f'{prefix} ' if prefix else ''
    return [
        screen(f'{p}Filtration', [
            check('N/A — No filtration'),
        ]),
        screen(f'{p}Filter details (table)', [
            text('Filter ID'), text('Filter Name'), text('Filter Cat. No.'), text('Make'),
        ]),
        screen(f'{p}Filtration Results', [
            num('Filtration pH'), num('Osmolality (mOsm/kg)'),
        ]),
        screen(f'{p}Filtration — Sample Results (table)', [
            text('Parameter'), text('Value'), text('UOM'),
        ]),
    ]


def media_prep_section(title, vol_label):
    """Shared MediaPrep pattern (doc §2.5 / §2.6)."""
    return section(title, [
        screen('Media details', [
            num(f'{vol_label} (L)'), text('Vessel ID'), num('Final pH Target (0-14)'),
        ]),
        screen('Components (table)', [
            text('Component'), num('Required Quantity'), dd('Quantity UOM', GMG),
            num('Make-up Vol'), dd('Make-up Vol UOM', LML),
        ]),
        screen('Mixing Controls', [
            num('Time (min)'), num('Temp (°C)'), num('pH (0-14)'),
        ]),
        screen('Procedure', [area('Stepwise procedure / deviations')]),
        *filtration_screens(),
    ])


# ── USP — Upstream Process (doc section 2) ─────────────────────────────────────
def build_usp():
    sections = [
        section('Aim & Objectives', [
            screen('Experiment identity', [
                text('Experiment ID', required=True), text('Experiment Title', required=True),
                text('Performed By', required=True), text('Reviewer (designated)'),
                date('Start Date', required=True), text('Project Code'),
            ]),
            screen('Narrative', [area('Objectives'), area('Background')]),
        ]),

        section('Sample Details', [
            screen('Sample list (table)', [
                text('Vial / Sample ID'), text('Strain / Plasmid'), text('Passage'),
                dd('Sample type', SAMPLE_TYPES), dd('Storage', STORAGE), text('Notes'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Materials & Reagents', [
            screen('Materials / Reagents & Consumables (table)', [
                text('Name of Materials / Reagents'), text('Make'), text('Catalogue No.'),
                text('Lot No.'), text('Grade'), date('Expiry Date'), dd('Storage Temp.', MAT_STORAGE),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Equipment Details', [
            screen('Equipment Details (table)', [
                text('Name of Equipment'), text('Equipment ID'), text('Log Book No.'),
                dd('Calibration Status', CAL_STATUS), date('Calibration Due Date'), date('PV Status (Due Date)'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        media_prep_section('Seed Media Preparation', 'Seed media volume'),
        media_prep_section('Production Media Preparation', 'Production media volume'),
        media_prep_section('Feed Media Preparation', 'Feed media volume'),

        section('Base & Acid Prep', [
            screen('Base Details (table)', [
                text('Compound', help_text='default: NH4OH 28%'), num('Concentration'),
                text('Conc. UOM (molarity)'), num('Volume Prepared'), text('Vol. UOM'),
                text('Output Sample ID', help_text='auto: BS-…'),
            ]),
            screen('Base — Procedure', [area('Procedure')]),
            *filtration_screens('Base'),
            screen('Acid Details (table)', [
                text('Compound', help_text='default: H3PO4 85%'), num('Concentration'),
                text('Conc. UOM (molarity)'), num('Volume Prepared'), text('Vol. UOM'),
                text('Output Sample ID', help_text='auto: AC-…'),
            ]),
            screen('Acid — Procedure', [area('Procedure')]),
            *filtration_screens('Acid'),
            screen('Antifoam (table)', [
                text('Compound', help_text='default: Antifoam C emulsion'), num('Concentration'),
                text('Conc. UOM (molarity)'), num('Volume Prepared'), text('Vol. UOM'),
                text('Output Sample ID', help_text='auto: AF-…'),
            ]),
            screen('Antifoam — Procedure', [area('Procedure')]),
        ]),

        section('Fermenter Readiness', [
            screen('Readiness checklist', [
                yn('Fermenter cleanliness'), yn('pH probe calibration'), yn('DO probe calibration'),
                yn('Exhaust filter checked / changed'), yn('Bottle connection checked'),
            ]),
            screen('pH Probe (entry table)', [
                text('Probe serial no.', placeholder='e.g. PHS-2025-114'),
                num('Calibration zero', placeholder='ideal: 0 +/- 30'),
                num('Calibration slope', placeholder='ideal: 95-105'),
            ]),
            screen('DO Probe (entry table)', [
                text('Probe serial no.', placeholder='e.g. DOS-2025-088'),
                num('Calibration zero'), num('Calibration slope'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Autoclave Operation', [
            screen('Cycle', [
                yn('VLT performed'), text('Autoclave cycle no. / ID'), text('Autoclave recipe name'),
            ]),
            screen('If recipe not used, capture parameters', [
                num('Sterilization temp. (°C, 100-140)'), num('Hold time (min, min 15)'), num('Pressure (bar)'),
            ]),
            screen('Confirmation', [yn('Sterilization completed'), area('Observations')]),
        ]),

        section('Media Sterility Check', [
            screen('Seed Media (table)', [
                num('Temp (°C)'), num('RPM'), num('Time (hr)'), dd('Sterility Result', ['Pass', 'Fail'], required=True), text('Observations'),
            ]),
            screen('Production Media (table)', [
                num('Scale (L)'), num('Temp (°C)'), num('RPM'), num('Time (hr)'), num('Air (vvm)'),
                dd('Sterility Result', ['Pass', 'Fail'], required=True), text('Observations'),
            ]),
            screen('If any result = Fail', [
                dd('Deviation classification', DEVIATIONS),
                area('Failure investigation (root cause, corrective action)'),
            ]),
        ]),

        section('Vial Thaw — N-2', [
            screen('Thaw record', [
                text('Vial Number', required=True), text('Vial Name', required=True),
                text('Thawing Method'), num('Thaw Time (min)'), text('Purpose / Use'),
            ]),
            screen('Flask IDs (table)', [text('Flask ID')]),
            screen('Notes', [area('Observations')]),
        ]),

        section('N-2 Seed Generation', [
            # Each flask entry carries its own incubation params (per-row), matching
            # the runtime's stacked "Add flask entry" layout.
            screen('Flask rows (table)', [
                text('Flask ID'),
                num('Flask Capacity'), dd('Flask Capacity UOM', LML),
                num('Media Volume'), dd('Media Volume UOM', LML),
                num('Inoculation Vol'), dd('Inoculation Vol UOM', LML),
                num('Flask Quantity'),
                num('Temp (°C)'), num('RPM'), num('Duration (hr)'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('N-2 Seed Monitoring', [
            screen('OD readings (table)', [num('Seed age (hr)'), num('OD600')]),
            screen('Transfer', [
                num('Achieved OD (for batch inoculation)'),
                text('Flask ID at transfer', help_text='repeatable list'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('N-1 Seed Generation', [
            # Per-row incubation params (incl. Culture Vol Box), matching the
            # runtime's stacked "Add flask entry" layout.
            screen('Flask rows (table)', [
                text('Flask ID'),
                text('Seed Source Flask ID', placeholder='e.g. F-2026-N2-A'),
                num('Flask Capacity'), dd('Flask Capacity UOM', LML),
                num('Media Volume'), dd('Media Volume UOM', LML),
                num('Inoculation Vol'), dd('Inoculation Vol UOM', LML),
                num('Flask Quantity'),
                num('Temp (°C)'), num('RPM'), num('Duration (hr)'), num('Culture Vol Box (mL)'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('N-1 Seed Monitoring', [
            screen('OD readings (table)', [num('Seed age (hr)'), num('OD600')]),
            screen('Transfer', [num('Achieved OD (for batch inoculation)'), text('Flask ID at transfer')]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Fermentation Setup', [
            screen('Process parameters', [
                num('Batch scale (L)'), num('Working media volume (L)'), num('Set temperature (°C, 20-42)'),
                num('Set pH (0-14)'), num('pH dead band (±)'), num('Set RPM'), num('Set DO (%, 0-100)'),
                num('Air Flow Rate (vvm)'), num('Oxygen Flow Rate (vvm)'),
            ]),
            screen('Pre-batch checks', [
                yn('Feed profile applied'), yn('DO probe calibration done'), yn('pH probe calibration done'),
                yn('Bottle connection done'), yn('Temperature jacket connected'), yn('pH probe connected'),
                yn('DO probe connected'), yn('Temperature sensor connected'), yn('Stirring motor connected'),
                yn('Exhaust condenser with chilled water'),
            ]),
            screen('Batch start', [
                num('Inoculation volume (mL)'), text('Batch ID'), dt('Batch initiation date/time'),
                yn('MFCS sync done'), yn('All parameters in auto mode'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Batch Monitoring', [
            screen('Timepoints (table)', [num('Batch age (hr)'), num('OD600'), num('Feed vol (mL)'), text('Remarks')]),
            screen('Sampling Plan (table)', [
                text('Sample details'), text('Sample ID'), date('MFG date'), num('Quantity (µL)'),
                dd('Storage condition', STORAGE), dd('Test / Analysis', METHODS),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Batch Harvest', [
            screen('Harvest conditions', [
                num('Harvest Temp (°C)'), num('OD at Harvest'), num('Volume at Harvest (L)'),
                text('pH Probe Storage'), text('DO Probe Storage'),
            ]),
            screen('pH Probe & Cleanup Checks', [yn('pH Probe Disconnected'), yn('pH Probe Remove')]),
            screen('DO Probe & Cleanup Checks', [yn('DO Probe Disconnected'), yn('DO Probe Remove')]),
            screen('CIP', [yn('Fermenter CIP'), area('Observations')]),
        ]),

        section('Centrifugation', [
            screen('Run conditions', [
                num('Temp (°C)'), text('RPM / RCF'), num('Time (min)'), num('Vol / Tube (mL)'), num('Vol / Cycle (mL)'),
            ]),
            screen('Pellet details', [
                num('No. of Cycles'), num('Pellet Weight (g)'), dd('Pellet Storage', STORAGE),
            ]),
            screen('Plasmid metadata', [
                num('Concentration of Plasmid — Mini Prep (ng/µL)'), date('Manufacturing Date'),
            ]),
            screen('Sample Plan (table)', [
                text('Sample ID'), dd('Sample Type', SAMPLE_TYPES), num('Volume (mL)'), text('Time Point'),
                dd('Test / Analysis', METHODS), dd('Storage', STORAGE),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Reconciliation', [
            screen('Reconciliation (table)', [
                text('Media / Buffer'), num('Prepared (mL)'), num('Consumed (mL)'),
                num('Remaining (mL)', read_only=True, help_text='computed'),
            ]),
        ]),

        section('Results & Conclusion', [
            screen('Outcomes', [
                area('Results — key outcomes'), area('Conclusion'), area('Remarks'),
            ]),
        ]),
    ]

    # ── Phase grouping (runtime: "22 sections · 5 phases") ────────────────────
    # Each section (a runtime page) is tagged with the phase it belongs to. The
    # 22 sections above are authored in phase order, so we slice by count.
    phase_layout = [
        ('RUN SETUP', 4),            # Aim & Objectives, Sample Details, Materials & Reagents, Equipment Details
        ('MEDIA & BUFFER PREP', 7),  # Seed/Production/Feed Media, Base & Acid, Fermenter Readiness, Autoclave, Media Sterility
        ('SEED TRAIN', 5),           # Vial Thaw N-2, N-2 Gen/Monitor, N-1 Gen/Monitor
        ('PRODUCTION', 4),           # Fermentation Setup, Batch Monitoring, Batch Harvest, Centrifugation
        ('HARVEST', 2),              # Reconciliation, Results & Conclusion
    ]
    assert sum(c for _, c in phase_layout) == len(sections), \
        f"phase_layout covers {sum(c for _, c in phase_layout)} but there are {len(sections)} sections"
    i = 0
    for phase_name, count in phase_layout:
        for s in sections[i:i + count]:
            s['phase'] = phase_name
        i += count

    return {'sections': sections}


# ── DSP — Downstream Process (doc section 3) ───────────────────────────────────
BUF_VOL = ['mL', 'L']


def chromatography_section(title, with_applicability=False):
    """Shared Chromatography I/II/III pattern (doc §3.11)."""
    screens = []
    if with_applicability:
        screens.append(screen('Applicability', [
            field('RADIO', 'Applicability', options=['Applicable', 'Not Applicable']),
            area('Reason / remarks (if Not Applicable)'),
        ]))
    screens += [
        screen('Column & Resin Details (table)', [
            text('Column Type'), text('Resin Name'), num('Bed Height (cm)'), num('CV (mL)'),
            num('AS Value'), num('Plates / m'), text('Usage Cycle'),
        ]),
        screen('Process Parameters', [
            num('Load Volume (mL)'), num('PLW (CV)'), num('HSW (CV)'),
        ]),
        screen('Residence Time', [
            num('Loading (min)'), num('Wash (min)'), num('Elution (min)'), num('CIP (min)'),
        ]),
        screen('Elution Fractions (table)', [
            text('Elution fractions'), num('Fraction volume (mL)'),
            num('Plasmid Concentration (ng/µL)'), num('Total Plasmid (mg)'),
        ]),
        screen('Pool Elution Fractions (table)', [
            num('Volume (mL)'), num('Concentration (ng/µL)'), num('Total Plasmid (mg)'),
        ]),
        screen('Pool notes', [area('Pool observations'), area('Section Observations')]),
        screen('Sampling plan (table)', [
            text('Sample details'), text('Sample ID'), date('MFG date'), num('Quantity (µL)'),
            dd('Storage condition', STORAGE), dd('Test / Analysis', METHODS),
        ]),
    ]
    return section(title, screens)


def ufdf_section(title):
    """Shared UFDF I/II pattern — tangential flow filtration (doc §3.12)."""
    return section(title, [
        screen('TFF Membrane / Hollow Fiber (table)', [
            num('MWCO (kDa)'), text('MOC'), num('Area (m²)'), text('Cycle No.'), num('Hold-up Volume (mL)'),
        ]),
        screen('Operation (table)', [
            num('Load Volume (mL)'), num('Concentration Factor'), num('Diafiltration (DV)'),
        ]),
        screen('Flush Details (table)', [
            text('Flush Number'), num('Flush Volume (mL)'),
        ]),
        screen('Operation Metrics', [
            num('Avg Flux – Concentration'), num('Avg Flux – Diafiltration'), num('Total Run Time'),
        ]),
        screen('Retentate & Permeate Volumes', [
            num('Retentate Volume (mL)'), num('Retentate volume incl. Flush (mL)'), num('Permeate Volume (mL)'),
        ]),
        screen('Retentate Parameters', [
            num('pH'), num('Conductivity (mS/cm)'), num('NTU'),
            num('Plasmid Concentration (ng/µL)'), num('Total Plasmid (mg)'),
        ]),
        screen('Notes', [area('Observations')]),
        screen('Sampling plan (table)', [
            text('Sample details'), text('Sample ID'), date('MFG date'), num('Quantity (µL)'),
            dd('Storage condition', STORAGE), dd('Test / Analysis', METHODS),
        ]),
    ])


def build_dsp():
    sections = [
        # 3.1 — shared header (same as USP §2.1)
        section('Aim & Objectives', [
            screen('Experiment identity', [
                text('Experiment ID', required=True), text('Experiment Title', required=True),
                text('Performed By', required=True), text('Reviewer (designated)'),
                date('Start Date', required=True), text('Project Code'),
            ]),
            screen('Narrative', [area('Objectives'), area('Background')]),
        ]),

        # 3.2 — Sample Details — USP Link
        section('Sample Details — USP Link', [
            screen('Upstream link (read-only)', [
                text('USP Batch ID', read_only=True), text('USP Experiment', read_only=True),
                text('Plasmid', read_only=True), num('Harvest OD', read_only=True),
            ]),
            screen('Pellet allocation', [
                num('Total (from USP)', read_only=True), num('Allocated to prior DSPs', read_only=True),
                num('Available', read_only=True), num('This DSP — pellet weight (g)'),
            ]),
            screen('Plasmid details', [
                date('MFG Date'), dd('Storage Temp.', STORAGE),
                num('Mini-prep Conc. (ng/mL)'), num('Total Plasmid (mg)'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        # 3.3 — Materials & Reagents (same as USP §2.3)
        section('Materials & Reagents', [
            screen('Materials / Reagents & Consumables (table)', [
                text('Name of Materials / Reagents'), text('Make'), text('Catalogue No.'),
                text('Lot No.'), text('Grade'), date('Expiry Date'), dd('Storage Temp.', MAT_STORAGE),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        # 3.4 — Equipment Details (same as USP §2.4)
        section('Equipment Details', [
            screen('Equipment Details (table)', [
                text('Name of Equipment'), text('Equipment ID'), text('Log Book No.'),
                dd('Calibration Status', CAL_STATUS), date('Calibration Due Date'), date('PV Status (Due Date)'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        # 3.5 — Equipment Readiness
        section('Equipment Readiness', [
            screen('Daily verification checklist', [
                yn('Daily verification of weighing balance (BAL-014)'),
                yn('Daily calibration of pH meter (PH-007)'),
                yn('Daily calibration of conductivity meter (CON-003)'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        # 3.6 — Buffer Preparation (repeatable per buffer)
        section('Buffer Preparation', [
            screen('Buffer header', [
                text('Buffer name', help_text='repeatable per buffer (default: Buffer 1)'),
                text('Buffer subtitle / description'),
            ]),
            screen('Composition & Quantity (table)', [
                text('Material ID'), text('Component'), text('Lot No.'),
                num('Req. Conc.'), dd('Req. Conc. UOM', CONC_UOM), num('Qty (g)'),
            ]),
            screen('Preparation Details', [
                text('Buffer Lot ID', help_text='auto-generate available'), date('Expiry Date'),
                num('Volume'), dd('Volume UOM', BUF_VOL),
            ]),
            screen('Measurements — Before Adjustment', [num('pH'), num('Conductivity (mS/cm)')]),
            screen('Measurements — After Adjustment', [
                num('pH'), num('Conductivity (mS/cm)'), num('Density (g/mL)'),
            ]),
            screen('Storage', [text('Storage temperature', help_text='default: 2–8 °C')]),
            screen('Procedure', [area('Procedure')]),
        ]),

        # 3.7 — Column Packing (repeatable)
        section('Column Packing', [
            screen('Qualification (table)', [
                text('Column Type'), text('Resin'), num('Height of Column (cm)'), num('Column Volume (L)'),
                num('AS Value'), num('Plates / M'), num('HETP (MM)'),
            ]),
            screen('Notes', [area('Procedure / Observations')]),
        ]),

        # 3.8 — System & Column CIP
        section('System & Column CIP', [
            screen('CIP checks', [
                yn('Chromatography system CIP'), yn('Column CIP-1'), yn('TFF System CIP-1'),
            ]),
            screen('Procedure', [area('CIP procedure details')]),
        ]),

        # 3.9 — Cell Lysis
        section('Cell Lysis', [
            screen('Lysis parameters', [
                num('Pellet Weight (g)'), num('Resuspension Buffer Vol. (mL)'),
                num('Lysis Buffer Vol. (mL)'), num('Lysis Incubation (min)'),
                num('Neutralization Buffer Vol. (pre-chilled) (mL)'), num('Neutralization Incubation (min)'),
            ]),
            screen('Post-neutralization parameters', [
                num('Total Volume (mL)'), num('pH'), num('Conductivity (mS/cm)'), num('NTU'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        # 3.10 — Clarification
        # Each depth/capsule filter card carries its own post-filtration params
        # (pH/Conductivity/NTU) per-row; the "Final Post …" screens are the overall values.
        section('Clarification', [
            screen('Depth Filter Details (table)', [
                text('Cat. No.'), text('Lot No.'), text('MOC', placeholder='e.g. PP'),
                num('Area (m²)'), num('Micron grading (µm)'),
                num('WFI flush (mL)'), num('EQB flush (mL)'), num('Post-flush EQB (mL)'),
                num('Total vol after depth filter (mL)'),
                num('pH', placeholder='0.00'), num('Conductivity (mS/cm)', placeholder='0.0'), num('NTU', placeholder='0.0'),
            ]),
            screen('Final Post Depth Filtration Parameters', [num('pH'), num('Conductivity (mS/cm)'), num('NTU')]),
            screen('Capsule Filter Details (table)', [
                text('Cat. No.'), text('Lot No.'), text('MOC', placeholder='e.g. PP'),
                num('Area (m²)'), num('Micron (µm)'),
                num('WFI Flush (mL)'), num('EQB Flush (mL)'), num('Post-Flush EQB (mL)'),
                num('Total Vol After Capsule Filter (mL)'),
                num('pH', placeholder='0.00'), num('Conductivity (mS/cm)', placeholder='0.0'), num('NTU', placeholder='0.0'),
            ]),
            screen('Final Post Capsule Filtration Parameters', [num('pH'), num('Conductivity (mS/cm)'), num('NTU')]),
            screen('Notes', [area('Observations')]),
        ]),

        # 3.11 / 3.12 — Capture & polishing, interleaved to match the runtime nav order
        chromatography_section('Chromatography I'),
        ufdf_section('UFDF I'),
        chromatography_section('Chromatography II'),
        chromatography_section('Chromatography III (Optional)', with_applicability=True),
        ufdf_section('UFDF II'),

        # 3.13 — Final Filtration
        section('Final Filtration', [
            screen('Filter details', [
                text('Cat. No.'), text('Lot No.'), text('MOC'), num('Area (m²)'), num('Micron Grading (µm)'),
                num('WFI Flush (mL)'), num('EQB Flush (mL)'), num('Post-flush EQB (mL)'),
                num('Total Vol After Filtration (mL)'),
            ]),
            screen('Final Product Parameters', [
                num('pH'), num('Conductivity (mS/cm)'), num('Plasmid Concentration (ng/µL)'), num('Total Plasmid (mg)'),
            ]),
        ]),

        # 3.14 — Storage of Final Product
        section('Storage of Final Product', [
            screen('Storage details', [
                text('Container Type'), text('Container Cat. No.'), dd('Storage Temperature', STORAGE),
            ]),
            screen('Product Aliquot (table)', [
                num('Aliquot Vol (mL)'), num('No of Aliquot'),
                num('Total Volume (mL)', read_only=True, help_text='computed'), text('Storage Location'),
            ]),
            screen('Notes', [area('Remarks')]),
        ]),

        # 3.15 — Step Recovery & Conclusion
        section('Step Recovery & Conclusion', [
            screen('Unit operations (table)', [
                text('Unit operation'), num('Vol (mL)'), num('Conc. (ng/µL)'),
                num('Total Plasmid (mg)', read_only=True, help_text='computed'),
                num('Step rec. (%)', read_only=True, help_text='computed'),
                num('Overall Recovery (%)', read_only=True, help_text='computed'),
                text('Remarks'),
            ]),
            screen('Conclusion', [area('Conclusion')]),
        ]),
    ]

    # ── Phase grouping (runtime: "18 sections · 6 phases") ────────────────────
    phase_layout = [
        ('RUN SETUP', 4),                    # Aim & Objectives, Sample Details, Materials, Equipment
        ('BUFFER PREP & COLUMN', 4),         # Equipment Readiness, Buffer Prep, Column Packing, System & Column CIP
        ('CELL LYSIS & CLARIFICATION', 2),   # Cell Lysis, Clarification
        ('CAPTURE & POLISHING', 5),          # Chrom I, UFDF I, Chrom II, Chrom III (Optional), UFDF II
        ('FILTRATION & FILL', 2),            # Final Filtration, Storage of Final Product
        ('RUN CLOSEOUT', 1),                 # Step Recovery & Conclusion
    ]
    assert sum(c for _, c in phase_layout) == len(sections), \
        f"phase_layout covers {sum(c for _, c in phase_layout)} but there are {len(sections)} sections"
    i = 0
    for phase_name, count in phase_layout:
        for s in sections[i:i + count]:
            s['phase'] = phase_name
        i += count

    return {'sections': sections}


TEMPLATES = [
    {'slug': 'cgt-plasmid-usp', 'name': 'Plasmid USP', 'category': 'CGT_PLASMID',
     'description': 'Upstream Process — seed train, fermentation, harvest (from Scientist Runtime field reference).',
     'build': build_usp},
    {'slug': 'cgt-plasmid-dsp', 'name': 'Plasmid DSP', 'category': 'CGT_PLASMID',
     'description': 'Downstream Process — purification of the harvested pellet: lysis, clarification, '
                    'chromatography, UF/DF, final filtration (from Scientist Runtime field reference).',
     'build': build_dsp},
]

# Templates that have been renamed/replaced — removed from the DB on seed so
# stale copies don't linger (e.g. the old DDV template, now replaced by DSP).
OBSOLETE_SLUGS = ['cgt-plasmid-ddv']


def seed():
    db = SessionLocal()
    try:
        for tmpl in TEMPLATES:
            # reset per-template name registry (names only need to be unique within a template)
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

        # Remove obsolete/renamed templates (and their versions) so they don't linger.
        for slug in OBSOLETE_SLUGS:
            old = db.query(WorkflowTemplate).filter(WorkflowTemplate.slug == slug).first()
            if old:
                db.query(WorkflowTemplateVersion).filter(
                    WorkflowTemplateVersion.template_id == old.id
                ).delete(synchronize_session=False)
                db.delete(old)
                print(f"Removed obsolete: {slug}")

        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == '__main__':
    seed()
