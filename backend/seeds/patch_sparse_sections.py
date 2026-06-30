"""
Patch adc-synthesis-v2: replace the two sparse placeholder sections.
  2. Buffer Preparation  (was 1 screen / 4 fields → 5 screens / ~120 fields)
  7. Analytical Characterization DP Release (was 1 screen / 2 fields → 4 screens / 51 fields)

Idempotent – run multiple times safely.  Also rewrites seed_adc_templates.py
so future reseeds preserve the new definition.
"""
import os, sys, json, ast, re, copy, textwrap, datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
import app.models.admin, app.models.settings, app.models.inventory
from app.models import workflow_template as _wt
from app.models.workflow_template import WorkflowTemplate, WorkflowTemplateVersion

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def hdr(key, label):
    return {'key': key, 'label': label, 'type': 'section_header',
            'required': False, 'placeholder': '', 'options': []}

def fld(key, label, ftype='text', required=False, placeholder='', options=None, columns=None):
    f = {'key': key, 'label': label, 'type': ftype,
         'required': required, 'placeholder': placeholder,
         'options': options or []}
    if columns:
        f['columns'] = columns
    return f

def num(key, label, required=False, placeholder=''):
    return fld(key, label, 'number', required, placeholder)

def sel(key, label, options, required=True):
    return fld(key, label, 'select', required, '', options)

def ta(key, label='Observations', placeholder='Enter observations…'):
    return fld(key, label, 'textarea', False, placeholder)

def dt(key, label, required=True):
    return fld(key, label, 'date', required)

def process_steps_table(key):
    return fld(key, 'Process steps', 'table', False, '', [], [
        {'key': 'step',        'label': 'Step',        'type': 'number', 'required': True},
        {'key': 'description', 'label': 'Description', 'type': 'text',   'required': True},
    ])

COMPONENTS_COLS = [
    {'key': 'chemical',        'label': 'Chemical / Reagent',   'type': 'text',   'required': True},
    {'key': 'grade',           'label': 'Grade',                 'type': 'select', 'required': False,
     'options': ['BioReagent', 'ACS', 'GMP-grade', 'Analytical', 'Other']},
    {'key': 'target_conc',     'label': 'Target conc. (mM)',    'type': 'number', 'required': False},
    {'key': 'actual_weight_g', 'label': 'Actual weight (g)',    'type': 'number', 'required': False},
    {'key': 'actual_vol_ml',   'label': 'Actual volume (mL)',   'type': 'number', 'required': False},
    {'key': 'lot_number',      'label': 'Lot number',           'type': 'text',   'required': True},
]

STERILE_FILTER_OPTS = ['0.22 µm PES', '0.22 µm PVDF', '0.22 µm Nylon', 'Not filtered']
APPEARANCE_OPTS     = ['Clear, colourless', 'Slightly hazy', 'Turbid – rejected', 'Other']
BIOBURDEN_OPTS      = ['Pass', 'Fail', 'Pending', 'Not tested']
STORAGE_OPTS        = ['2–8°C', 'RT', '−20°C', '−80°C']

def buffer_screen(p, screen_key, title, intended_use_opts):
    """Generate a standard buffer-preparation screen."""
    return {
        'key': screen_key,
        'title': title,
        'has_signature': False,
        'has_files': False,
        'fields': [
            # ── Identity ────────────────────────────────────────────────────
            hdr(f'{p}_section_identity', 'Buffer Identity'),
            fld(f'{p}_name',         'Buffer name',            'text', True, 'e.g. PBS pH 7.4 + 1 mM EDTA'),
            fld(f'{p}_code',         'Buffer code / Lot ID',   'text', True, 'e.g. BUF-RED-2026-001'),
            sel(f'{p}_intended_use', 'Intended use', intended_use_opts),
            num(f'{p}_target_volume','Target batch volume (mL)', True),

            # ── Composition ─────────────────────────────────────────────────
            hdr(f'{p}_section_composition', 'Target Composition'),
            fld(f'{p}_components', 'Components', 'table', True, '', [], COMPONENTS_COLS),

            # ── Preparation ─────────────────────────────────────────────────
            hdr(f'{p}_section_prep', 'Preparation'),
            sel(f'{p}_prep_method', 'Preparation method',
                ['Gravimetric', 'Volumetric', 'Dilution from stock']),
            fld(f'{p}_mixing_equipment', 'Mixing equipment / instrument ID', 'text',
                False, 'e.g. STR-001'),

            # ── QC ──────────────────────────────────────────────────────────
            hdr(f'{p}_section_qc', 'Quality Checks'),
            num(f'{p}_target_ph',      'Target pH', True, 'e.g. 7.4'),
            num(f'{p}_actual_ph',      'Actual pH (measured)', True),
            num(f'{p}_ph_tolerance',   'pH tolerance (±)', False, '0.1'),
            fld(f'{p}_ph_meter_id',    'pH meter instrument ID', 'text', False),
            num(f'{p}_conductivity',   'Conductivity (mS/cm)', False),
            sel(f'{p}_appearance',     'Visual appearance', APPEARANCE_OPTS),
            sel(f'{p}_sterile_filter', 'Sterile filtration', STERILE_FILTER_OPTS),
            fld(f'{p}_filter_lot',     'Filter lot number', 'text', False),

            # ── IPC ─────────────────────────────────────────────────────────
            hdr(f'{p}_section_ipc', 'IPC Results'),
            sel(f'{p}_bioburden', 'Bioburden', BIOBURDEN_OPTS),
            sel(f'{p}_endotoxin', 'Endotoxin', BIOBURDEN_OPTS),

            # ── Storage ─────────────────────────────────────────────────────
            hdr(f'{p}_section_storage', 'Storage & Traceability'),
            sel(f'{p}_storage_condition', 'Storage condition', STORAGE_OPTS),
            dt(f'{p}_prep_date',   'Preparation date'),
            dt(f'{p}_expiry_date', 'Expiry / use-by date'),
            fld(f'{p}_prepared_by', 'Prepared by', 'text', False,
                'Auto-filled from current user'),

            # ── Steps ───────────────────────────────────────────────────────
            hdr(f'{p}_section_steps', 'Process / Step Details'),
            process_steps_table(f'{p}_process_steps'),
            ta(f'{p}_observations',
               'Enter observations, deviations or additional notes…'),
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Section 2: Buffer Preparation  (5 screens)
# ─────────────────────────────────────────────────────────────────────────────
SECTION_2 = {
    'key': 'buffer_preparation',
    'title': '2. Buffer Preparation',
    'screens': [
        buffer_screen(
            'red_buf', 'buf_reduction_buffer', '2.1 Reduction Buffer',
            ['Reduction step (3.4)', 'Other'],
        ),
        buffer_screen(
            'conj_buf', 'buf_conjugation_buffer', '2.2 Conjugation Buffer',
            ['Conjugation step (3.5)', 'Other'],
        ),
        buffer_screen(
            'quench_buf', 'buf_quench_stock', '2.3 Quench Stock (NAC Solution)',
            ['Quench step (3.6)', 'Other'],
        ),
        buffer_screen(
            'chrom_buf', 'buf_chrom_running', '2.4 Chromatography Running Buffers',
            ['SEC column (4.1)', 'HIC column (4.1)', 'Mixed-mode (4.1)', 'Other'],
        ),
        buffer_screen(
            'form_buf', 'buf_formulation', '2.5 Formulation / Diafiltration Buffer',
            ['UF/DF diafiltration (4.2)', 'Final formulation', 'Other'],
        ),
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Section 7: Analytical Characterization DP Release  (4 screens)
# ─────────────────────────────────────────────────────────────────────────────
REVIEW_APPROVAL_FIELDS = [
    hdr('dp_checklist_hdr', 'Pre-approval Checklist'),
    fld('dp_pre_approval_checklist', 'Pre-approval checklist', 'table', False, '', [], [
        {'key': 'item',   'label': 'Checklist item', 'type': 'text',   'required': True},
        {'key': 'status', 'label': 'Status',          'type': 'select', 'required': True,
         'options': ['Complete', 'Not applicable', 'Pending']},
    ]),
    hdr('dp_reviewer_sig_hdr', 'Reviewer Electronic Signature (21 CFR Part 11)'),
    fld('dp_reviewer_username',  'Reviewer username',            'text',     False),
    fld('dp_reviewer_password',  'Password (2nd component)',     'password', False),
    sel('dp_reviewer_reason',    'Reason for signature',
        ['Peer reviewed and approved', 'Supervisor reviewed and approved',
         'Approved with comments']),
    fld('dp_reviewer_timestamp', 'Signature timestamp',          'text',     False,
        'Auto-stamped on signing'),
    hdr('dp_qa_sig_hdr', 'QA Electronic Signature (21 CFR Part 11)'),
    fld('dp_qa_username',  'QA username',                'text',     False),
    fld('dp_qa_password',  'Password (2nd component)',   'password', False),
    sel('dp_qa_reason',    'Reason for signature',
        ['QA reviewed and released', 'QA reviewed – conditional release',
         'QA reviewed – reject']),
    fld('dp_qa_timestamp', 'QA signature timestamp',     'text',     False,
        'Auto-stamped on signing'),
    hdr('dp_qa_remarks_hdr', 'QA Remarks'),
    ta('dp_qa_remarks',       'QA Remarks', 'Enter QA remarks…'),
    ta('dp_observations',     'Observations'),
]

SECTION_7 = {
    'key': 'analytical_characterization',
    'title': '7. Analytical Characterization (DP Release)',
    'screens': [
        {
            'key': 'dp_sample_registration',
            'title': '7.1 DP Sample Registration',
            'has_signature': False,
            'has_files': False,
            'fields': [
                hdr('dp_source_hdr', 'Source Intermediate'),
                fld('dp_source_sample_id', 'Source sample ID (from 6.3)', 'text', True,
                    'Carry-forward from lyophilization / final UF/DF'),
                fld('dp_parent_lineage',   'Parent lineage',              'text', False),
                fld('dp_registered_by',    'Registered by',               'text', False),

                hdr('dp_sample_details_hdr', 'Sample Details'),
                num('dp_concentration',     'Concentration (mg/mL)', True),
                num('dp_total_volume_ml',   'Total volume available (mL)', True),
                fld('dp_lot_batch_number',  'Lot / batch number',    'text', True),
                fld('dp_formulation_buffer','Formulation buffer',    'text', True),
                sel('dp_storage_condition', 'Storage condition', STORAGE_OPTS),
                fld('dp_vial_type',         'Vial type / size',      'text', False,
                    'e.g. 2 mL Type I glass'),

                hdr('dp_test_panel_hdr', 'Test Panel Selection'),
                fld('dp_test_panel', 'Test panel', 'table', True, '', [], [
                    {'key': 'test',      'label': 'Test method',   'type': 'text',   'required': True},
                    {'key': 'volume_ul', 'label': 'Volume req. (µL)', 'type': 'number', 'required': False},
                    {'key': 'priority',  'label': 'Priority',      'type': 'select', 'required': True,
                     'options': ['Mandatory', 'Conditional', 'Informational']},
                    {'key': 'status',    'label': 'Status',         'type': 'select', 'required': True,
                     'options': ['Pending', 'In progress', 'Complete', 'Not applicable']},
                ]),
                ta('dp_registration_notes', 'Sample registration notes', 'Enter notes…'),
                ta('dp_observations'),
            ],
        },
        {
            'key': 'dp_analytical_results',
            'title': '7.2 DP Analytical Results',
            'has_signature': False,
            'has_files': True,
            'fields': [
                hdr('dp_results_hdr', 'Analytical Results'),
                fld('dp_analytical_results', 'Analytical results', 'test_results_tabs',
                    False, '', []),
                fld('dp_release_spec_check', 'All results within release specification?',
                    'select', True, '',
                    ['Yes – all pass', 'No – one or more OOS', 'Pending – results outstanding']),
                fld('dp_out_of_spec_details', 'OOS details (if any)', 'textarea', False,
                    'Describe any out-of-specification results…'),
                ta('dp_overall_analytical_comments', 'Overall analytical comments',
                   'Summarise key analytical findings…'),
                ta('dp_observations'),
            ],
        },
        {
            'key': 'dp_scientist_conclusion',
            'title': '7.3 Scientist Conclusion',
            'has_signature': False,
            'has_files': False,
            'fields': [
                hdr('dp_summary_hdr', 'Summary'),
                fld('dp_scientist_name',        'Scientist name', 'text', False),
                dt('dp_date',                   'Date'),
                sel('dp_preliminary_disposition','Preliminary disposition',
                    ['Pass – release recommended', 'Fail – reject', 'Hold – further investigation']),

                hdr('dp_key_results_hdr', 'Key Release Results'),
                fld('dp_average_dar',      'Average DAR achieved',  'text', True),
                fld('dp_sec_purity',       'SEC monomer purity (%)', 'text', True),
                fld('dp_concentration_final', 'Final concentration (mg/mL)', 'text', True),
                fld('dp_endotoxin_result', 'Endotoxin result (EU/mL)', 'text', True),
                fld('dp_bioburden_result', 'Bioburden result (CFU/mL)', 'text', True),

                hdr('dp_conclusion_hdr', 'Scientist Conclusion'),
                ta('dp_scientist_conclusion', 'Scientist conclusion',
                   'Enter overall conclusion and assessment of product quality…'),

                hdr('dp_risks_hdr', 'Risks and Mitigations'),
                ta('dp_risks_mitigations', 'Risks and mitigations (if any)',
                   'Describe any identified risks and proposed mitigations…'),

                hdr('dp_scientist_sig_hdr', 'Scientist Electronic Signature (21 CFR Part 11)'),
                fld('dp_scientist_username',  'Username',              'text',     False),
                fld('dp_scientist_password',  'Password',              'password', False),
                sel('dp_reason_for_signature','Reason for signature',
                    ['Authored and submitted', 'Re-submitted after revision']),
                fld('dp_signature_timestamp', 'Signature timestamp',   'text', False,
                    'Auto-stamped on signing'),
                ta('dp_observations'),
            ],
        },
        {
            'key': 'dp_review_approval',
            'title': '7.4 Review and Approval',
            'has_signature': True,
            'has_files': False,
            'fields': REVIEW_APPROVAL_FIELDS,
        },
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Apply patch to DB
# ─────────────────────────────────────────────────────────────────────────────
def patch_db():
    db = SessionLocal()
    try:
        t = db.query(WorkflowTemplate).filter(
            WorkflowTemplate.slug == 'adc-synthesis-v2'
        ).first()
        if not t:
            print('ERROR: adc-synthesis-v2 not found in DB')
            return

        defn = copy.deepcopy(t.definition)
        sections = defn['sections']

        replaced = []
        for i, sec in enumerate(sections):
            if sec['key'] == 'buffer_preparation':
                sections[i] = SECTION_2
                replaced.append('buffer_preparation')
            elif sec['key'] == 'analytical_characterization':
                sections[i] = SECTION_7
                replaced.append('analytical_characterization')

        if not replaced:
            print('WARNING: sections not found – check keys')
            return

        # Snapshot current version before overwrite
        snap = WorkflowTemplateVersion(
            template_id=t.id,
            version=t.version,
            definition=t.definition,
        )
        db.add(snap)

        t.definition = defn
        t.version = t.version + 1
        db.commit()

        for sec in SECTION_2['screens']:
            nf = len(sec['fields'])
            print(f"  patched {sec['title']} — {nf} fields")
        for sec in SECTION_7['screens']:
            nf = len(sec['fields'])
            print(f"  patched {sec['title']} — {nf} fields")
        print(f"\nDB updated. Template is now version {t.version}.")
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Patch seed file: replace the two sections inside the TEMPLATES literal
# ─────────────────────────────────────────────────────────────────────────────
def patch_seed_file():
    seed_path = os.path.join(os.path.dirname(__file__), 'seed_adc_templates.py')
    with open(seed_path, 'r', encoding='utf-8') as fh:
        src = fh.read()

    # Parse the existing TEMPLATES
    match = re.search(r'TEMPLATES\s*=\s*(\[)', src)
    text = src[match.start(1):]
    depth = 0
    end = 0
    for i, ch in enumerate(text):
        if ch == '[': depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    templates = ast.literal_eval(text[:end])

    # Patch v2
    v2 = next(t for t in templates if t['slug'] == 'adc-synthesis-v2')
    sections = v2['definition']['sections']
    for i, sec in enumerate(sections):
        if sec['key'] == 'buffer_preparation':
            sections[i] = SECTION_2
        elif sec['key'] == 'analytical_characterization':
            sections[i] = SECTION_7

    # Rebuild the TEMPLATES string using repr (single-line, parseable)
    templates_repr = repr(templates)
    new_src = src[:match.start(1)] + templates_repr + src[match.start(1) + end:]
    with open(seed_path, 'w', encoding='utf-8') as fh:
        fh.write(new_src)
    print("Seed file updated.")


if __name__ == '__main__':
    print("=== Patching DB ===")
    patch_db()
    print("\n=== Patching seed file ===")
    patch_seed_file()
    print("\nDone.")
