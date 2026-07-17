"""Seed AAV workflow templates (AAV USP, AAV DSP). Idempotent upsert by slug.

Definitions follow the Template Builder's section -> screen -> field JSON
shape (frontend/src/pages/admin/templateBuilder/types.ts), category
'CGT_AAV' (kept separate from CGT_PLASMID so the two modalities don't mix
in template pickers).

Field content is sourced from docs/AAV_Runtime_Form_Spec.md:
  Workflow 1 (USP) -> section 1 of this file (27 sections, 5 phases)
  Workflow 2 (DSP) -> section 2 of this file (19 sections, 5 phases)

Data tables from the doc are represented as a screen whose fields are the
table's columns (the builder is a flat form designer with no repeatable-table
field type); a screen title ending in "(table)" renders as a repeatable
horizontal table at preview/runtime, "(entry table)" as a repeatable
vertical Parameter|Entry card (see PreviewModal.tsx). Yes/No/N-A checklist
items become RADIO fields; master-data dropdowns are inlined as static
options; per-row sub-fields (e.g. per-flask incubation, per-filter QC) are
folded into the same table screen as extra columns, matching the runtime's
stacked "Add entry" cards.
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

# ── Master-data option lists (Appendix A) ───────────────────────────────────
STORAGE = [
    'Room temperature (RT)', 'Controlled RT', 'Refrigerated (2-8 °C)',
    'Cold (-20 °C ± 5)', 'Deep frozen (-80 °C ± 10)', 'LN₂ vapor phase',
    'LN₂ liquid phase', 'Incubator (37 °C / 5% CO₂)', 'Cool (8-15 °C)',
]
SAMPLE_TYPES = [
    'In-process', 'Cell pellet', 'Supernatant', 'Cell lysate', 'Clarified harvest',
    'Column eluate', 'Pooled fraction', 'UF/DF pool', 'Bulk Drug Substance (BDS)',
    'Drug Substance (DS)', 'Drug Product (DP)', 'Reference Standard', 'Retain',
    'Stability', 'Spiked control',
]
METHODS = [
    'ddPCR-ITR', 'ddPCR-WPRE', 'qPCR-gen', 'ELISA-cap', 'ELISA-p24', 'ELISA-HCP',
    'SEC-MALS', 'AUC', 'CDMS', 'cryo-EM', 'AEX-HPLC', 'CGE', 'A260_A280', 'FlowCAR',
    'FlowVia', 'Vi-CELL', 'BCA', 'Bradford', 'LAL-KC', 'Myco-qPCR', 'USP_71',
    'Potency-CB', 'WB', 'Sanger', 'NGS', 'NanoSight', 'DLS', 'Osmometry',
]
DEVIATIONS = [
    'Minor', 'Major', 'Critical', 'Out-of-specification', 'Out-of-trend',
    'Out-of-calibration', 'Out-of-limit', 'Out-of-expectation',
]
MAT_STORAGE = ['RT', '4 °C', '-20 °C', '-80 °C']
CAL_STATUS = ['OK', 'Due Soon', 'Expired']
GMG = ['g', 'mg']
GMG_EXT = ['g', 'mg', 'µg', 'mL', 'µL']
LML = ['L', 'mL']
MAKEUP_UOM = ['mL', 'L', 'µL']
CONC_UOM = ['mM', 'M', 'μM', 'mg/mL', 'g/L', '%']
STORAGE_SHORT = ['-80 °C', '-20 °C', '2-8 °C', 'RT']

# ── Field / screen / section builders (mirrors seed_cgt_plasmid_templates.py) ──
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
def yn(label, **kw):    return field('RADIO', label, options=list(['Yes', 'No', 'N/A']), **kw)
def yesno(label, **kw): return field('RADIO', label, options=list(['Yes', 'No']), **kw)
def passfail(label, **kw): return field('RADIO', label, options=list(['Pass', 'Fail']), **kw)
def dd(label, options, **kw): return field('DROPDOWN', label, options=list(options), **kw)
def check(label, **kw): return field('CHECKBOX', label, **kw)


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


# ── Shared building blocks ───────────────────────────────────────────────────

def header_screens():
    """U1 / D1 — Experiment Header (identical component both workflows)."""
    return [
        screen('Experiment identity', [
            text('Experiment ID', required=True), text('Experiment Title', required=True),
            text('Performed By', required=True), text('Reviewer (designated)'),
            date('Start Date', required=True), text('Project Code'),
        ]),
        screen('Narrative', [
            area('Objectives', help_text='Primary aim — what success looks like'),
            area('Background', help_text='Context, prior runs, hypotheses'),
        ]),
    ]


def materials_screens():
    """U3 / D3 — Materials / Reagents & Consumables."""
    return [
        screen('Materials / Reagents & Consumables (table)', [
            text('Material ID'), text('Name of Materials / Reagents'), text('Make'),
            text('Catalogue No.'), text('Lot No.'), text('Grade'),
            date('Expiry Date'), dd('Storage Temp.', MAT_STORAGE),
        ]),
        screen('Notes', [area('Observations')]),
    ]


def equipment_screens():
    """U4 / D4 — Equipment Details."""
    return [
        screen('Equipment Details (table)', [
            text('Name of Equipment'), text('Equipment ID'), text('Log Book No.'),
            dd('Calibration Status', CAL_STATUS), date('Calibration Due Date'), date('PV Status (Due Date)'),
        ]),
        screen('Notes', [area('Observations')]),
    ]


def media_prep_section(title, sample_id_prefix, batch_volume_label='Total batch volume', show_output=True):
    """U5/U6 shared MediaPrep component."""
    screens = [
        screen('Media details', [num(f'{batch_volume_label} (L)'), num('Final pH Target (0-14)')]),
        screen('Components (table)', [
            text('Material ID'), text('Component'), num('Quantity'), dd('UOM', GMG),
            num('Make-up Vol'), dd('Make-up Vol UOM', LML),
        ]),
        screen('Mixing Controls', [num('Time (min)'), num('Temp (°C)'), num('pH (0-14)')]),
        screen('Procedure', [area('Stepwise procedure / deviations')]),
    ]
    if show_output:
        screens += [
            screen('Filtration', [check('N/A — No filtration')]),
            screen('Filter details (table)', [
                text('Filter ID'), text('Filter Name'), text('Filter Cat. No.'), text('Make'),
            ]),
            screen('Filtration Results', [num('pH (0-14)'), num('Osmolality (mOsm/kg)')]),
            screen('Sample Results (table)', [text('Parameter'), text('Value'), text('UOM')]),
            screen('Intermediate Lot ID (table)', [
                text('Output Lot ID', help_text=f'generate: {sample_id_prefix}-…'),
                date('Expiry Date'), num('Prepared Volume (L)'), dd('Storage Condition', STORAGE_SHORT),
            ]),
        ]
    return section(title, screens)


def probe_readiness_section(title, tubing_check=False):
    """U11 Bioreactor Readiness / D5 Equipment Readiness pattern (probe entry-tables)."""
    checks = [
        yn('Bioreactor cleanliness'), yn('pH probe calibration'), yn('DO probe calibration'),
        yn('Exhaust filter checked / changed'), yn('Bottle connection checked'),
    ]
    if tubing_check:
        checks.append(yn('Required tubing connections done'))
    return section(title, [
        screen('Readiness checklist', checks),
        screen('pH Probe (entry table)', [
            text('Probe serial no.'), num('Calibration zero', placeholder='ideal: 0 ± 30'),
            num('Calibration slope', placeholder='ideal: 95-105'),
        ]),
        screen('DO Probe (entry table)', [
            text('Probe serial no.'), num('Calibration zero'), num('Calibration slope'),
        ]),
        screen('Notes', [area('Observations')]),
    ])


def seed_generation_screens(source_label='Source Seed Flask ID', extra_incubation=None):
    """U15/U18/U19 shared per-flask setup + incubation table shape."""
    incubation = ['Temp (°C)', 'RPM', 'CO2 (%)', 'Duration (hr)']
    if extra_incubation:
        incubation.append(extra_incubation)
    return [
        screen('Flask rows (table)', [
            text(source_label),
            num('Flask Capacity'), dd('Flask Capacity UOM', LML),
            num('Media Volume'), dd('Media Volume UOM', LML),
            num('Inoculation Vol'), dd('Inoculation Vol UOM', LML),
            num('Flask Quantity'),
            *[num(lbl) for lbl in incubation],
        ]),
        screen('Output Sample Record (table)', [
            text('Output Sample ID', help_text='generate: NN-…'), date('Expiry Date'),
            num('Volume (mL)'), dd('Storage Condition', STORAGE),
        ]),
        screen('Notes', [area('Observations')]),
    ]


def monitoring_section(title, sample_prefix, metabolite_gas_cols):
    """U17/U20/U22 shared per-sample monitoring pattern (cell density + metabolites)."""
    return section(title, [
        screen('Sample header', [
            text('Output Sample ID', help_text=f'ph: {sample_prefix}-…'), num('Volume (mL)'),
        ]),
        screen('Cell density, viability, and gas analysis (table)', [
            text('Age (hr)'), *[num(c) for c in metabolite_gas_cols],
        ]),
        screen('Metabolites — BioProfile FLEX2 (table)', [
            text('Age (hr)'), num('Glucose (g/L)'), num('L-Glutamine (mM)'), num('Glutamate (mM)'),
            num('Lactate (g/L)'), num('Ammonia (mM)'), num('Osmolality (mOsm/kg)'),
        ]),
        screen('Notes', [area('Observations')]),
    ])


def sampling_plan_screen(title='Sampling Plan (table)'):
    return screen(title, [
        text('Sample details'), text('Sample ID'), date('MFG date'), num('Quantity (µL)'),
        dd('Storage condition', STORAGE), dd('Test / Analysis', METHODS),
    ])


def buffer_prep_section(title, is_dsp=False):
    """U9 Lysis Buffer Preparation / D6 Buffer Preparation shared BufferPrep component.

    DSP variant adds the Req. Conc. column and the After-Filtration QC block.
    """
    comp_cols = [text('Material ID'), text('Component'), text('Lot No.')]
    if is_dsp:
        comp_cols += [num('Req. Conc.'), dd('Req. Conc. UOM', CONC_UOM)]
    comp_cols += [num('Qty (g)')]

    screens = [
        screen('Buffer header', [text('Buffer name', help_text='repeatable, default: Buffer 1'), text('Buffer subtitle')]),
        screen('Composition & Quantity (table)', comp_cols),
        screen('Preparation details', [
            text('Buffer Lot ID', help_text='generate: BUF-…'), date('Expiry Date'),
            num('Volume'), dd('Volume UOM', ['mL', 'L']),
        ]),
        screen('Measurements — Before Filtration (0.2 μm)', [num('pH'), num('Conductivity (mS/cm)')]),
    ]
    if is_dsp:
        screens.append(screen('Measurements — After Filtration (0.2 μm)', [
            num('pH'), num('Conductivity (mS/cm)'), num('Density (g/cm³)'),
        ]))
    screens += [
        screen('Storage', [text('Storage temperature', help_text='default: 2-8 °C')]),
        screen('Procedure', [area('Procedure')]),
        screen('Notes', [area('Observations')]),
    ]
    return section(title, screens)


def chromatography_section(title, resin_ph, process_extra_cols, has_sampling_plan=False, output_prefix='C', include_pool_ft=True):
    """D9/D11 shared Chromatography component (chrom1/chrom2 variants)."""
    screens = [
        screen('Buffer Usage (table)', [text('Role'), text('Buffer Lot ID'), num('Volume used (mL)')]),
        screen('Column & Resin Details', [
            text('Column Type', placeholder='e.g. XK 16/20'), text('Name of Resin', placeholder=resin_ph),
            num('Height (cm)'), num('CV (mL)'), num('AS Value'), num('Plates / meter'), num('Resin Usage Cycle (No.)'),
        ]),
        screen('Process Details', process_extra_cols),
        screen('Residence Time', [num('Loading (min)'), num('Wash (min)'), num('Elution (min)'), num('CIP (min)')]),
        screen('Elution Fractions (table)', [
            text('Elution / FT'), num('Fraction volume (mL)'), num('CP Conc (ct/mL)'),
            num('VG Conc (vg/mL)'), num('Total CP', read_only=True), num('Total VG', read_only=True),
        ]),
    ]
    if include_pool_ft:
        screens.append(screen('Pool Elution / FT Fractions (table)', [
            num('Volume (mL)'), num('CP Conc (ct/mL)'), num('VG Conc (vg/mL)'),
            num('Total CP (ct)', read_only=True), num('Total VG (vg)', read_only=True),
        ]))
    if has_sampling_plan:
        screens.append(sampling_plan_screen())
    screens.append(screen(f'Output lot — {title} → next step', [
        text('Lot ID', help_text=f'generate: {output_prefix}-…'), num('Volume (mL)'), dd('Storage Condition', STORAGE_SHORT),
    ]))
    screens.append(screen('Notes', [area('Observations')]))
    return section(title, screens)


def ufdf_section(title, output_prefix='UFDF', has_sampling_plan=True):
    return section(title, [
        screen('TFF Cassette Details', [
            num('MWCO'), text('MOC', placeholder='e.g. PES'), num('Area (m²)'),
            num('Cycle No.'), num('Hold-up Volume (mL)'),
        ]),
        screen('Operation', [num('Load Volume (mL)'), num('Concentration Factor'), num('Diafiltration (DV)')]),
        screen('Flush details (table)', [num('Flush Number'), num('Flush Volume (mL)')]),
        screen('Operation Metrics', [
            num('Avg Flux – Concentration', placeholder='LMH'), num('Avg Flux – Diafiltration', placeholder='LMH'),
            num('Total Run Time', placeholder='min'),
        ]),
        screen('Retentate & Permeate Volumes', [
            num('Retentate Volume (mL)'), num('Retentate volume incl. Flush (mL)'), num('Permeate Volume (mL)'),
        ]),
        screen('Retentate Parameters', [num('pH'), num('CT (mS/cm)'), num('NTU')]),
        *([sampling_plan_screen()] if has_sampling_plan else []),
        screen(f'Output lot — {title} → next step', [
            text('Lot ID', help_text=f'generate: {output_prefix}-…'), num('Volume (mL)'), dd('Storage Condition', STORAGE_SHORT),
        ]),
        screen('Notes', [area('Observations')]),
    ])


def capsule_filter_screens(label='Capsule Filter Details'):
    return [
        screen(f'{label} (table)', [
            text('Cat. No.'), text('Lot No.'), text('MOC', placeholder='e.g. PES / PVDF'),
            num('Area (m²)'), text('Micron Grading', placeholder='e.g. 0.2 µm'),
            num('Flush WFI (mL)'), num('Flush EQB Buffer (mL)'), num('Post flush EQB (mL)'),
            num('Total Vol after filtration (mL)'),
        ]),
        screen('After Capsule Filtration Parameters', [
            num('pH'), num('Conductivity (mS/cm)'), num('NTU'),
        ]),
    ]


def sample_table_screen(title, default_prefix):
    return screen(f'{title} (table)', [
        text('Sample ID', help_text=f'generate: {default_prefix}-…'), text('Sample details'),
        date('MFG date'), num('Qty (µL)'), text('Storage'), text('Analysis required'),
    ])


# ══════════════════════════════════════════════════════════════════════════
# WORKFLOW 1 — AAV USP (Upstream Process) — 27 sections, 5 phases
# ══════════════════════════════════════════════════════════════════════════
def build_aav_usp():
    sections = [
        # ── Phase: Run Setup ──────────────────────────────────────────────
        section('Experiment Header', header_screens()),                              # U1
        section('Sample Details', [                                                   # U2
            screen('Cell bank vials (table)', [
                text('Vial / Sample ID'), text('Cell line'), text('Passage'),
                dd('Sample type', SAMPLE_TYPES), dd('Storage', STORAGE), text('Notes'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),
        section('Materials / Reagents & Consumables', materials_screens()),           # U3
        section('Equipment Details', equipment_screens()),                            # U4

        # ── Phase: Media Prep & Bio Reactor ──────────────────────────────
        media_prep_section('Seed Media Prep', 'SM'),                                  # U5
        media_prep_section('Production Media Prep', 'PM'),                            # U6

        section('Feed Media Preparation', [                                           # U7
            screen('Mode', [dd('Feed Media Mode', ['Prepared in-house', 'Procured externally'])]),
            screen('Media details', [num('Feed Media volume (L)')]),
            screen('Components (table)', [
                text('Material ID'), text('Component'), num('Quantity'), dd('UOM', GMG),
                num('Make-up Vol'), dd('Make-up Vol UOM', LML),
            ]),
            screen('Mixing Controls', [num('Time (min)'), num('Temp (°C)'), num('pH (0-14)')]),
            screen('Procedure', [area('Stepwise procedure / deviations')]),
            screen('Filtration', [check('N/A — No filtration')]),
            screen('Filter details (table)', [
                text('Filter ID'), text('Filter Name'), text('Filter Cat. No.'), text('Make'),
            ]),
            screen('Results after filtration', [num('pH (0-14)'), num('Osmolality (mOsm/kg)')]),
            screen('Sample Results (table)', [text('Parameter'), text('Value'), text('UOM')]),
            screen('Intermediate Lot ID (table)', [
                text('Output Lot ID', help_text='generate: FM-…'), date('Expiry Date'),
                num('Prepared Volume (L)'), dd('Storage Condition', STORAGE_SHORT),
            ]),
            screen('Inventory Lookup (if procured externally)', [text('Procured Inventory ID')]),
            screen('Procurement Details', [
                text('Supplier'), text('Lot / Batch No.'), date('Expiry Date'),
                num('Volume Received'), dd('Volume Received UOM', LML), date('Receipt Date'),
                dd('Storage Condition', STORAGE_SHORT), text('CoA / Reference No.'),
                area('Remarks / Deviations'),
            ]),
        ]),

        section('Base & Acid Preparation', [                                          # U8
            screen('Base Details (table)', [
                text('Material ID'), text('Compound', help_text='default: NH4OH 28%'),
                num('Concentration', help_text='default: 5'), dd('Conc. UOM', ['M', 'mM', 'μM']),
                num('Volume Prepared'), dd('Vol. UOM', ['mL', 'L']),
            ]),
            screen('Base — Procedure & Remarks', [area('Procedure'), area('Remarks')]),
            screen('Output Sample Record — Base (table)', [
                text('Output Sample ID', help_text='generate: BS-…'), date('Expiry Date'),
                num('Volume Prepared (mL)'), dd('Storage Condition', STORAGE_SHORT),
            ]),
            screen('Acid Details (table)', [
                text('Material ID'), text('Compound', help_text='default: H3PO4 85%'),
                num('Concentration', help_text='default: 2'), dd('Conc. UOM', ['M', 'mM', 'μM']),
                num('Volume Prepared'), dd('Vol. UOM', ['mL', 'L']),
            ]),
            screen('Acid — Procedure & Remarks', [area('Procedure'), area('Remarks')]),
            screen('Output Sample Record — Acid (table)', [
                text('Output Sample ID', help_text='generate: AC-…'), date('Expiry Date'),
                num('Volume Prepared (mL)'), dd('Storage Condition', STORAGE_SHORT),
            ]),
            screen('Antifoam Details (table)', [
                text('Material ID'), text('Compound', help_text='default: Antifoam C emulsion'),
                num('Concentration', help_text='default: 0.1'), dd('Conc. UOM', ['M', 'mM', 'μM']),
                num('Volume Prepared'), dd('Vol. UOM', ['mL', 'L']),
            ]),
            screen('Antifoam — Procedure & Remarks', [area('Procedure'), area('Remarks')]),
            screen('Output Sample Record — Antifoam (table)', [
                text('Output Sample ID', help_text='generate: AF-…'), date('Expiry Date'),
                num('Volume Prepared (mL)'), dd('Storage Condition', STORAGE_SHORT),
            ]),
        ]),

        buffer_prep_section('Lysis Buffer Preparation', is_dsp=False),                 # U9

        section('Transfection Reagents Preparation', [                                # U10 — AAV-specific
            screen('T.R Volume Required', [num('T.R Volume Required (mL)')]),
            screen('Reagent Preparation (table)', [
                text('Reagent ID'), text('Reagent'), num('Required Quantity'), dd('UOM', GMG_EXT),
                num('Make Up Volume'), dd('Make Up Volume UOM', ['mL', 'L', 'µL']),
            ]),
            screen('Mixing Controls', [num('Time (min)'), num('Temperature (°C)'), num('pH (0-14)')]),
            screen('Transfection Reagent', [
                num('Concentration (mg/mL)', help_text='default: 1'), num('Volume prepared (mL)'),
            ]),
            screen('Plasmid Components (table)', [
                text('Plasmid'), text('Inventory Lot', read_only=True), num('Required (µg)'),
                num('Actual (µg)'), num('Stock Conc. (µg/µL)'), dd('Storage Condition', STORAGE),
            ]),
            screen('Complex Formation Parameters', [
                num('DNA ratio'), num('PEI : DNA ratio w/w', help_text='Typical 3:1 to 4:1, default 4'),
                num('Total DNA (µg)'), num('PEI required (µg)'),
                text('Diluent', help_text='default: Opti-MEM I'), num('Diluent volume (mL)'),
                num('Complexing time (min)', help_text='Critical: 10–20 min; default 15'),
                num('Complexing temperature (°C)', help_text='default: 22'),
                num('Final complex volume (mL)'),
            ]),
            screen('Notes', [area('Remarks'), area('Procedure / observations')]),
        ]),

        probe_readiness_section('Bioreactor Readiness', tubing_check=True),           # U11

        section('Autoclave Operation', [                                              # U12
            screen('Cycle', [
                yn('VLT performed'), text('Autoclave cycle no. / ID', placeholder='e.g. AC-2026-1142'),
                text('Autoclave recipe name', placeholder='e.g. STD-LIQUID-121C-30M'),
            ]),
            screen('If recipe not used, capture parameters', [
                num('Sterilization temp. (°C, 100-140)'), num('Hold time (min, min 15)'), num('Pressure (bar)'),
            ]),
            screen('Confirmation', [yn('Sterilization completed'), area('Observations')]),
        ]),

        section('Media Sterility Check', [                                            # U13
            screen('Seed Media (table)', [
                num('Temp (°C)'), num('RPM'), num('Time (hr)'),
                dd('Sterility Result', ['Pass', 'Fail'], required=True), text('Observations'),
            ]),
            screen('Feed Media (table)', [
                num('Scale (L)'), num('Temp (°C)'), num('Time (hr)'),
                dd('Sterility Result', ['Pass', 'Fail'], required=True), text('Observations'),
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

        # ── Phase: Seed Train ─────────────────────────────────────────────
        section('Vial Thaw — Inoculum N-n', [                                        # U14
            screen('Thaw record', [
                text('Vial Number', required=True, placeholder='V-01'),
                text('Vial Name', required=True, placeholder='WCB-HEK293-2025-04'),
                text('Thawing Method', placeholder='Water bath, 37 °C'),
                num('Thaw Time (min)', placeholder='2'), text('Purpose / Use'),
            ]),
            screen('Source Seed Flask IDs (table)', [text('Source Seed Flask ID')]),
            screen('Notes', [area('Observations')]),
            screen('Output Sample Record (table)', [
                text('Output Sample ID', help_text='generate: VT-…'), date('Expiry Date'),
                num('Volume (mL)'), dd('Storage Condition', STORAGE),
            ]),
        ]),

        section('N-n Seed Generation', seed_generation_screens(
            source_label='Source Seed Flask ID',
            extra_incubation='Seeding cell density (10⁶ cells/mL)',
        )),                                                                            # U15

        section('Passaging & Maintenance', [                                          # U16 — AAV-specific
            screen('Passaging log (table)', [
                date('Date'), text('Sample ID', help_text='select from Vial Thaw outputs'),
                num('Sample Volume (mL)'), text('Passage from'), text('Passage to'),
                text('Passage Number', placeholder='P13'), num('Viability Cell Density (×10⁶/mL)'),
                num('Viability (%)'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        monitoring_section('N-n Seed Monitoring', 'NN',
                            ['Cell count (×10⁶/mL)', 'Viability (%)']),                # U17

        section('N-1 Seed Generation at SF Scale', [                                  # U18
            screen('Setup', [
                text('Source Seed Flask ID', placeholder='F-2026-N1'), num('Volume (mL)'),
            ]),
            *seed_generation_screens(source_label='Flask ID', extra_incubation='Seeding cell density (10⁶ cells/mL)'),
            screen('Procedure', [area('Stepwise procedure / observations')]),
        ]),

        section('N-1 Seed Generation (Bioreactor scale)', [                           # U19
            screen('Setup', [
                text('Seed Source Flask ID', placeholder='F-2026-N1'), num('Volume'), dd('Volume UOM', LML),
            ]),
            screen('Setpoints — Batch', [
                num('Bioreactor Scale (L)', help_text='default: 2'), num('Working Volume (L)', help_text='default: 1'),
                num('Seeding Density', help_text='default: 0.4'), num('Set Temperature (°C)', help_text='default: 37'),
                num('Set pH', help_text='default: 7.2'),
            ]),
            screen('Setpoints — Gas & Duration', [
                num('Set RPM', help_text='default: 120'), num('Set DO (%)', help_text='default: 50'),
                num('CO2 Setpoint (%)', help_text='default: 5'), num('Duration (hr)', help_text='default: 72'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        monitoring_section('N-1 Seed Monitoring', 'N1',
                            ['Cell count (×10⁶/mL)', 'Viability (%)', 'Online pH', 'Offline pH',
                             'pCO₂ (mmHg)', 'pO₂ (mmHg)']),                            # U20

        # ── Phase: Production ─────────────────────────────────────────────
        section('AAV Production in Bioreactor', [                                    # U21
            screen('Bioreactor', [text('Bioreactor ID', placeholder='BR-2026-001')]),
            screen('Process Parameters — Batch', [
                num('Batch Scale (L)', help_text='default: 2'), num('Media Filtered (L)', help_text='default: 1.6'),
                num('Set Temperature (°C)', help_text='default: 37'), num('Set pH', help_text='default: 7.2'),
                num('Set RPM', help_text='default: 180'),
            ]),
            screen('Process Parameters — Gas & Power', [
                num('Set DO (%)', help_text='default: 50'), num('Tip Speed (m/s)'), num('Power / Volume (W/m³)'),
            ]),
            screen('Aeration', [
                num('Air Sparger (vvm)', help_text='default: 0.05'), num('O2 Sparger (vvm)', help_text='default: 0.02'),
                num('CO2 Sparger (vvm)', help_text='default: 0.01'), num('Air Overlay (L/min)', help_text='default: 0.1'),
            ]),
            screen('Pre-batch checks', [
                yn('Feed profile if any'), yn('DO probe calibration done'), yn('pH probe calibration done'),
                yn('Bottle connection done'), yn('Temperature jacket connected'), yn('pH probe connected'),
                yn('DO probe connected'), yn('Temperature sensor'), yn('Stirring motor connected'),
                yn('Exhaust condenser with chilled water'),
            ]),
            screen('Batch start', [
                num('Inoculation Volume (mL)', help_text='default: 400'), text('Batch ID', placeholder='CGT-AAV-2026-0042'),
                dt('Batch Initiation Date/Time'), yn('MFCS Sync Done'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        monitoring_section('Sampling & Batch Monitoring', 'BM',
                            ['Cell count (×10⁶/mL)', 'Viability (%)', 'Online pH', 'Offline pH',
                             'pCO₂ (mmHg)', 'pO₂ (mmHg)']),                            # U22 (extends with extra screens below)

        section('Batch Harvest', [                                                    # U23
            screen('Harvest conditions', [
                num('Harvest Time Post-Tfxn (hr)', help_text='default: 120'),
                num('Harvest Temperature (°C)', help_text='default: 37'), num('Cell Count At Harvest'),
            ]),
            screen('Harvest measurements', [
                num('Viability At Harvest (%)'), num('Volume At Harvest'), dd('Volume At Harvest UOM', LML),
                text('Visual Observations', placeholder='Colour, opacity, foaming…'),
            ]),
            screen('In-process values', [
                num('NTU'), num('pH', placeholder='7.2'), num('Conductivity (mS/cm)'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('In-situ Lysis', [                                                    # U24 — AAV-specific
            screen('Lysis Reagents (table)', [
                text('Reagent / Stock Buffer Name'), num('Stock Concentration'), text('Stock Concentration UOM'),
                num('Required Concentration'), text('Required Concentration UOM'),
                num('Volume Required'), dd('Volume Required UOM', LML), text('Lot No.'),
            ]),
            screen('Lysis conditions', [
                num('Bioreactor Vol At Lysis'), dd('Bioreactor Vol At Lysis UOM', LML),
                num('Lysis Buffer Added (mL)'), num('Detergent Concentration (%)', help_text='default: 0.5'),
                num('Detergent Volume (mL)'),
            ]),
            screen('Incubation', [
                num('Incubation Time (min)', help_text='default: 120'), num('Incubation Temp (°C)', help_text='default: 37'),
                num('RPM During Lysis', help_text='default: 120'),
            ]),
            screen('Post-lysis checks', [
                num('Total Volume After Lysis'), dd('Total Volume After Lysis UOM', LML),
                num('pH', placeholder='7.2'), num('Conductivity (mS/cm)'), num('NTU'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Clarification — Cell Lysate Suspension (CLS)', [                    # U25
            screen('Step 1 — Depth filtration', [
                num('Volume'), dd('Volume UOM', LML), num('Before Depth NTU', help_text='default: 180'),
                text('Depth Filter Cat No'), text('Depth Filter Lot'), num('Depth Filter Area (m²)'),
                num('After Depth NTU', help_text='< 50 ideal'), num('Total Volume After Depth Filter'),
                dd('Total Volume After Depth Filter UOM', LML),
            ]),
            screen('Step 2 — 0.2 μm sterilizing filtration', [
                num('Before 0.2 μm NTU'), text('0.2 μm Filter Cat No'), text('0.2 μm Filter Lot No'),
                num('0.2 μm Filter Area (m²)'), num('Volume Post 0.2 μm Filtration', help_text='feeds CLS ledger, shrink-validated'),
                dd('Volume Post 0.2 μm Filtration UOM', LML), num('After 0.2 μm NTU'),
                num('pH', placeholder='7.2'), num('Conductivity (mS/cm)'),
            ]),
            sampling_plan_screen('Sample Request Submission (table)'),
            screen('Storage & Notes', [
                text('Clarified Harvest Storage condition', help_text='default: -80 C, in 1 L PETG bottles'),
                area('Observations'),
            ]),
        ]),

        # ── Phase: Harvest (closeout) ─────────────────────────────────────
        section('Material & Reagent Reconciliation', [                               # U26
            screen('Reconciliation (table)', [
                text('Media / Buffer'), text('Lot No.'), num('Prepared (mL)'), num('Consumed (mL)'),
                num('Remaining (mL)', read_only=True, help_text='computed = prepared − consumed'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Results & Conclusion', [                                            # U27
            screen('Outcomes', [
                area('Results — key outcomes', help_text='Summarize what was achieved against objectives'),
                area('Conclusion', help_text='What this means / next steps'),
                area('Remarks', help_text='Deviations, observations, notes for reviewer'),
            ]),
        ]),
    ]

    # Extend U22 (Sampling & Batch Monitoring) with the extra sub-blocks the
    # shared monitoring_section() helper doesn't cover: fixed Parameter/Entry
    # cell-culture panel + a Sampling Plan table.
    sbm = sections[21]
    assert sbm['title'] == 'Sampling & Batch Monitoring'
    sbm['screens'].insert(-1, screen('Cell culture and Transfection Parameters (entry table)', [
        num('Batch scale (L)', help_text='default: 2'), num('Media filtered into the Bioreactor (L)', help_text='default: 1.6'),
        text('Cell count and viability of N-1 seed'), num('N-1 seed volume (mL) required'),
        num('Targeted seeding cell density', help_text='default: 1'),
        num('Media Volume in Bioreactor post seeding (L)', help_text='default: 1.6'),
        num('Harvest time point (hr)', help_text='default: 120'),
    ]))
    sbm['screens'].insert(-1, sampling_plan_screen())

    # ── Phase grouping (runtime: 27 sections, 5 phases) ────────────────────
    apply_phases(sections, [
        ('RUN SETUP', 4),                       # U1-U4
        ('MEDIA PREP & BIO REACTOR', 9),        # U5-U13
        ('SEED TRAIN', 7),                      # U14-U20
        ('PRODUCTION', 5),                      # U21-U25
        ('HARVEST', 2),                         # U26-U27
    ])
    return {'sections': sections}


# ══════════════════════════════════════════════════════════════════════════
# WORKFLOW 2 — AAV DSP (Downstream Process) — 19 sections, 5 phases
# ══════════════════════════════════════════════════════════════════════════
def build_aav_dsp():
    sections = [
        # ── Phase: Run Setup ──────────────────────────────────────────────
        section('Experiment Header', header_screens()),                              # D1 (same as U1)

        section('Sample Details — CLS Link', [                                       # D2
            screen('Linked to upstream experiment (read-only)', [
                text('USP Batch ID', read_only=True), text('USP Experiment', read_only=True),
                text('Serotype', read_only=True), num('CLS total', read_only=True),
            ]),
            screen('CLS volume allocation (read-only)', [
                num('Total', read_only=True), num('Allocated to prior DSPs', read_only=True),
                num('Available', read_only=True),
            ]),
            screen('This DSP allocation', [
                num('This DSP — CLS volume', help_text='disabled until USP CLS total > 0; validated vs Available'),
                num('pH'), num('Conductivity (mS/cm)'), num('NTU'), num('Cell viability (%)'),
                text('Storage Condition', help_text='default: -80 °C'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Materials / Reagents & Consumables', materials_screens()),          # D3
        section('Equipment Details', equipment_screens()),                           # D4

        # ── Phase: Buffer Prep & Column ───────────────────────────────────
        section('Equipment Readiness', [                                             # D5
            screen('Readiness checks', [
                yesno('Daily Verification of weighing balance'), yesno('Daily Calibration of pH meter'),
                yesno('Daily Calibration of conductivity meter'), yesno('Daily Calibration of pH and Conductivity meters'),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        buffer_prep_section('Buffer Preparation', is_dsp=True),                      # D6

        section('Column Packing & Qualification', [                                 # D7
            screen('Column packing (table)', [
                text('Column type', placeholder='XK 16/20'), text('Resin', placeholder='POROS HQ 50 um'),
                num('Height of Column (cm)'), num('Column Volume (L)'),
                num('AS Value'), num('Plates / M'), num('HETP (MM)'),
            ]),
            screen('Notes', [area('Procedure / observations')]),
        ]),

        section('System & Column CIP', [                                             # D8
            screen('CIP checks', [
                yesno('Chromatography system CIP'), yesno('Column CIP-1'), yesno('TFF System CIP-1'),
            ]),
            screen('Procedure', [area('CIP procedure details')]),
        ]),

        # ── Phase: Capture & Polishing ────────────────────────────────────
        chromatography_section(
            'Chromatography I — Affinity (POROS AAVX)', resin_ph='POROS AAVX',
            process_extra_cols=[
                num('Load Volume (mL)'), num('PLW (MV)'), num('HS W (CV)'), num('LPW (CV)'), num('Elution (mL)'),
            ],
            has_sampling_plan=False, output_prefix='C1',
        ),                                                                            # D9

        section('Chromatography Elute Neutralization', [                            # D10 — AAV-specific
            screen('Neutralization', [
                num('Elution Vol (mL)'), num('Before neutralization — pH', help_text='default: 2.5'),
                num('Before neutralization — CT'), num('Before neutralization — NTU'),
                num('Addition of 1 M Tris (mL)'), num('After neutralization — pH', help_text='default: 7.5'),
                num('After neutralization — CT'), num('After neutralization — NTU'), text('Remark'),
            ]),
            screen('Sampling Plan — Elute Neutralization (table)', [
                text('Sample Details'), date('Date of MFG'), num('Sample Qty (µL)'),
                text('Storage Condition', help_text='default: -80 °C'), text('Analysis Required'),
            ]),
            screen('Output lot — Neutralize Elute → Chromatography II', [
                text('Lot ID', help_text='generate: NEUT-…'), num('Volume (mL)'), dd('Storage Condition', STORAGE_SHORT),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        chromatography_section(
            'Chromatography II — Polish (Anion Exchange)', resin_ph='Q Sepharose FF',
            process_extra_cols=[
                num('Load Volume (mL)'), num('PLW (CV)'), text('Elution Fr.', placeholder='Fr. 1-3'), num('Elution Fr. (mL)'),
            ],
            has_sampling_plan=True, output_prefix='C2',
        ),                                                                            # D11

        section('Chromatography III', [                                             # D12
            screen('Applicability', [yesno('Is Chromatography III required?')]),
            screen('Buffer Usage (table)', [text('Role'), text('Buffer Lot ID'), num('Volume used (mL)')]),
            screen('Column & Resin Details', [
                text('Column Type / Membrane Type', placeholder='Mustang Q'), text('Name of Resin / Membrane'),
                num('CV/MV'), text('Elution/FT Fractions'), num('Elution/FT Volume (mL)'),
            ]),
            screen('Process Details', [
                num('Load Volume (mL)'), num('PLW (MV)'), num('Wash 1 (MV)'), num('Wash 2 (MV)'), num('Elution (mL)'),
            ]),
            screen('Residence Time', [num('Loading (min)'), num('Wash (min)'), num('Elution (min)'), num('CIP (min)')]),
            screen('Elution Fractions (table)', [
                text('Elution / FT'), num('Fraction volume (mL)'), num('CP Conc (ct/mL)'),
                num('VG Conc (vg/mL)'), num('Total CP', read_only=True), num('Total VG', read_only=True),
            ]),
            screen('Pool Elution / FT Fractions (table)', [
                num('Volume (mL)'), num('CP Conc (ct/mL)'), num('VG Conc (vg/mL)'),
                num('Total CP (ct)', read_only=True), num('Total VG (vg)', read_only=True),
            ]),
            screen('Output lot — Chromatography III → next step', [
                text('Lot ID', help_text='generate: C1-…'), num('Volume (mL)'), dd('Storage Condition', STORAGE_SHORT),
            ]),
            screen('Notes', [area('Observations')]),
        ]),

        ufdf_section('Ultrafiltration & Diafiltration (UFDF)', output_prefix='UFDF', has_sampling_plan=True),  # D13

        # ── Phase: Filtration & Fill ──────────────────────────────────────
        section('Final Filtration', [                                                # D14
            *capsule_filter_screens(),
            screen('Output lot — Drug Substance bulk (DS)', [
                text('Lot ID', help_text='generate: DS-…'), num('Volume (mL)'), num('pH'),
                num('Conductivity (mS/cm)'), dd('Storage', STORAGE_SHORT),
            ], columns=2),
            screen('Notes', [area('Procedure / observations')]),
        ]),

        section('Drug Substance Sampling', [                                        # D15 — AAV-specific
            sample_table_screen('Sample table', 'DS-S'),
            screen('ARD submission', [dd('Submission route', ['In House Testing', 'Submit sample to ARD'])]),
            screen('Notes', [
                area('Observations'), yesno('Is post-DS filtration required?'),
            ]),
        ]),

        section('Post-DS Filtration', [                                             # D16 — AAV-specific, gated
            *capsule_filter_screens(),
            screen('Notes', [area('Procedure / observations')]),
        ]),

        section('Drug Product Sampling', [                                          # D17 — AAV-specific
            sample_table_screen('Sample table', 'DP-S'),
            screen('ARD submission', [dd('Submission route', ['In House Testing', 'Submit sample to ARD'])]),
            screen('Notes', [area('Observations')]),
        ]),

        section('Storage of Final Product', [                                       # D18
            screen('Storage details', [
                text('Container type', placeholder='PETG, sterile'), text('Container Cat. No.'),
                dd('Storage temperature', ['-80 °C', '-20 °C', '2-8 °C', 'RT']),
            ]),
            screen('Product Aliquot (table)', [
                num('Aliquot Vol (mL)'), num('No of Aliquot'),
                num('Total Volume (mL)', read_only=True, help_text='computed = Vol × Count'), text('Storage Location'),
            ]),
            screen('Notes', [area('Remarks')]),
        ]),

        # ── Phase: Run Closeout ───────────────────────────────────────────
        section('Step Recovery — CP & VG', [                                        # D19 — AAV-specific
            screen('Recovery (table)', [
                text('Unit operation', read_only=True), num('Vol (mL)'),
                num('CP/mL', placeholder='e.g. 1e11'), num('VG/mL', placeholder='e.g. 5e10'),
                num('Total CP', read_only=True), num('Total VG', read_only=True),
                num('CP step %', read_only=True), num('VG step %', read_only=True),
                num('CP overall %', read_only=True), num('VG overall %', read_only=True),
            ]),
            screen('Notes', [area('Conclusion / overall remarks')]),
        ]),
    ]

    # ── Phase grouping (runtime: 19 sections, 5 phases) ────────────────────
    apply_phases(sections, [
        ('RUN SETUP', 4),                # D1-D4
        ('BUFFER PREP & COLUMN', 4),     # D5-D8
        ('CAPTURE & POLISHING', 5),      # D9-D13
        ('FILTRATION & FILL', 5),        # D14-D18
        ('RUN CLOSEOUT', 1),             # D19
    ])
    return {'sections': sections}


TEMPLATES = [
    {'slug': 'cgt-aav-usp', 'name': 'AAV USP', 'category': 'CGT_AAV',
     'description': 'AAV Upstream Process — seed train, transfection, bioreactor production, in-situ lysis, '
                    'clarification (from AAV Runtime field reference).',
     'build': build_aav_usp},
    {'slug': 'cgt-aav-dsp', 'name': 'AAV DSP', 'category': 'CGT_AAV',
     'description': 'AAV Downstream Process — affinity/polish chromatography, UF/DF, final filtration, '
                    'CP/VG recovery (from AAV Runtime field reference).',
     'build': build_aav_dsp},
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
