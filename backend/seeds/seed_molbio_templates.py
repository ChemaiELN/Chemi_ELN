"""Seed Molecular Biology workflow templates. Idempotent upsert by slug.

Five templates, category 'CGT_MOLBIO':
  - Mol-Bio Cloning            (docs/MolBio_Cloning_Form_Spec.md)            25 sections, 6 phases
  - Positive Clone Screening   (docs/PositiveCloneScreening_Form_Spec.md)    13 sections, 5 phases (subset of Cloning)
  - Bacterial Transformation   (docs/MolBio_Transformation_Form_Spec.md)      8 sections, 3 phases
  - Plasmid DNA Isolation      (docs/MolBio_PlasmidIsolation_Form_Spec.md)   13 sections, 5 phases
  - Research Cell Banking      (docs/MolBio_CellBanking_Form_Spec.md)        10 sections, 4 phases

Definitions follow the Template Builder's section -> screen -> field JSON
shape (frontend/src/pages/admin/templateBuilder/types.ts). A screen title
ending in "(table)" renders as a repeatable table at preview/runtime (see
PreviewModal.tsx); "(entry table)" as a repeatable vertical Parameter|Entry
card. PCS reuses the same section-builder functions as Cloning (per its
spec: "structurally identical ... just re-lists a 13-section subset").

Simplifications (flat form model, no conditional logic):
  - The shared "Process / Step Details" trailer (Cloning/PCS, phases 2-6)
    is one extra table screen appended per applicable section.
  - The "Gel-conditions" micro-form is a reusable screen (gel_conditions_screen).
  - PrepTypeToggle branching in Plasmid Isolation (Binding/Washing/Elution show
    different tables per prep type) is flattened to always-present
    Mini/Midi/Maxi screens rather than conditional visibility.
  - `type="time"` fields (Cell Banking) are represented as text fields
    (no dedicated TIME field type in the builder).
  - E-signature role cards are represented as a generic Role/Signed By/Signed
    At table rather than click-to-sign widgets.
  - Computed/read-only fields (efficiency, totals) are flagged read-only but
    the formula itself isn't encoded.
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

# ── Shared master-data option lists ─────────────────────────────────────────
STORAGE_OPTS = ['RT', '4 °C', '-20 °C', '-80 °C']
GRADE_OPTS = ['GMP', 'Research', 'Molecular biology grade', 'Analytical', 'Other']
DEPARTMENTS = ['Molecular Biology', 'Vector Engineering', 'Bioprocess Development', 'Research']
BIOSAFETY = ['BSL-1', 'BSL-2', 'BSL-2+']
CAL_STATUS = ['OK', 'Due Soon', 'Expired']
UOM_LIST = ['ng', 'µg', 'ng/µl', 'µg/ml', 'µl', 'pmol', 'fmol', 'nM']
EQUIP_NAMES = [
    'Analytical Balance', 'Autoclave', 'Biosafety Cabinet', 'Centrifuge',
    'Incubator / Shaker', 'Laminar flow hood', 'Microcentrifuge',
    'Refrigerator (2-8 °C)', 'Water bath', '-20 °C Freezer', '-80 °C Freezer',
]
INSTR_NAMES = [
    'DAD Detector', 'Gel electrophoresis system', 'NanoDrop / Spectrophotometer',
    'pH Meter', 'Pipette (calibrated)', 'Thermocycler', 'Vi-CELL / Cell counter',
    'Vortex mixer',
]
GATE_OPTS = ['Go', 'No-Go', 'Hold']
SIGN_ROLES = ['Scientist', 'Reviewed by Lead', 'Reviewed by', 'Unit head', 'Reviewed by QA', 'Approved by QA']

# ── Field / screen / section builders ──────────────────────────────────────
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
    d = {'id': _mk_id('field'), 'type': ftype, 'label': label, 'name': _mk_name(label), 'colSpan': col_span}
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
def dd(label, options, **kw): return field('DROPDOWN', label, options=list(options), **kw)
def attach(label, **kw): return field('ATTACHMENT', label, **kw)


def screen(title, fields, columns=2) -> dict:
    return {'id': _mk_id('screen'), 'title': title, 'columns': columns, 'fields': fields}


def section(title, screens) -> dict:
    return {'id': _mk_id('section'), 'title': title, 'screens': screens}


def apply_phases(sections, phase_layout):
    total = sum(c for _, c in phase_layout)
    assert total == len(sections), f"phase_layout covers {total} but there are {len(sections)} sections"
    i = 0
    for phase_name, count in phase_layout:
        for s in sections[i:i + count]:
            s['phase'] = phase_name
        i += count


# ── Shared building blocks (reused across all 5 templates) ─────────────────

def equipment_instrument_section(title='Equipment / Instrument Details'):
    """Shared MolBioEquipmentSection component — identical across all 5 screens."""
    return section(title, [
        screen('Equipment (table)', [
            dd('Name of equipment', EQUIP_NAMES), text('Equipment ID'), text('Log book No.'),
            date('Last PV date'), date('PV due'),
        ]),
        screen('Instrument (table)', [
            dd('Name of instrument', INSTR_NAMES), text('Instrument ID'), text('Log book No.'),
            dd('Calibration status', CAL_STATUS), date('Calibration due'), date('PV due date'),
        ]),
        screen('Notes', [area('Observations', required=True)]),
    ])


def materials_screens(grade_options=None):
    return [
        screen('Materials & Reagents (table)', [
            text('Mat. ID'), text('Name / Reagent'), text('Make'), text('Cat. No.'), text('Lot No.'),
            dd('Grade', grade_options or GRADE_OPTS), date('Expiry'), dd('Storage', STORAGE_OPTS),
        ]),
    ]


def gel_conditions_screen(title='Gel conditions', img_label='Gel image', img_hint=None, with_procedure=True):
    """[Gel-conditions block] — reused across PCR/clean-up/digest/extraction/RE-confirm sections."""
    fields = [
        text('Agarose %', placeholder='e.g. 1.0'), dd('Running buffer', ['TAE 1x', 'TBE 1x', 'TBE 0.5x', 'Other']),
        text('Voltage / time', placeholder='e.g. 100V x 30 min'), text('DNA ladder', placeholder='e.g. 1 kb Plus'),
        dd('DNA stain', ['EtBr', 'SYBR Safe', 'GelRed', 'Other']), num('Loaded volume (µl)'),
        attach(img_label, help_text=img_hint),
    ]
    if with_procedure:
        fields.append(area('Procedure'))
    return screen(title, fields)


def process_step_trailer():
    """Shared 'Process / Step Details' repeatable trailer (Cloning/PCS, phases 2-6)."""
    return screen('Process / Step Details (table)', [text('Process / Step'), area('Details')])


def with_trailer(sec):
    sec['screens'].append(process_step_trailer())
    return sec


def signatures_screen():
    return screen('Signatures (table)', [dd('Role', SIGN_ROLES), text('Signed By'), dt('Signed At')])


def results_closeout_screens(summary_required=True, summary_rows=4, conclusions_rows=3):
    return [
        screen('Outcomes', [
            area('Summary of results', required=summary_required),
            area('Conclusions & next steps'),
            area('Deviations (if any)'),
        ]),
        screen('Gate decision', [dd('Gate decision', GATE_OPTS)]),
        signatures_screen(),
    ]


def linked_experiment_screen(ref_label, ref_default, required_toggle_label, extra_fields=None, summary_rows=3):
    fields = [
        yesno(required_toggle_label),
        text(ref_label, required=True, help_text=f'link to {ref_default}', placeholder=ref_default),
    ]
    if extra_fields:
        fields += extra_fields
    fields.append(area('Summary / outcome'))
    return screen('Linked workflow', fields)


# ══════════════════════════════════════════════════════════════════════════
# Molecular Cloning — section builders (also reused, subset, by PCS)
# ══════════════════════════════════════════════════════════════════════════

def sec_aim_cloning(default_exp_id='Mol-Col-001'):
    return section('Aim & Objectives', [
        screen('Experiment identity', [
            text('Experiment ID', placeholder=default_exp_id), text('Study title', required=True),
            text('Study type'), dd('Department', DEPARTMENTS, required=True),
            dd('Biosafety classification', BIOSAFETY), text('Reference SOP / protocol', required=True, placeholder='e.g. SOP-MB-001'),
            date('Start date'), text('Related change control', placeholder='e.g. CC-2026-001'),
        ]),
        screen('Narrative', [area('Objectives', required=True), area('Background')]),
    ])


def sec_samples_cloning():
    return section('Sample Details', [
        screen('Vector order details (table)', [
            text('Component / Vector name'), text('Make'), text('Catalogue No.'), text('Lot No.'),
            attach('COA', read_only=True), attach('Vector map'), attach('Vector sequences'),
            dd('Storage temp.', STORAGE_OPTS),
        ]),
        screen('Gene synthesis order details (table)', [
            text('Component'), text('Make'), text('Cat. No.'), text('Lot No.'), attach('COA ref'),
            date('Delivery date'), attach('Map & sequence file'), text('Receipt sequence check'),
            dd('Storage temp.', STORAGE_OPTS),
        ]),
        screen('Bacterial strain order details (table)', [
            text('Bacterial strain'), text('Make'), text('Catalogue No.'), text('Lot No.'),
            attach('COA'), dd('Storage temp.', STORAGE_OPTS),
        ]),
        screen('Notes', [area('Remarks')]),
    ])


def sec_materials_cloning():
    return section('Materials & Reagents', materials_screens())


def sec_equipment_cloning():
    return equipment_instrument_section('Equipment / Instrument Details')


def sec_primers():
    return with_trailer(section('Primers / Oligo Design', [
        screen('Primers / oligo detail (table)', [
            text('Primer ID', read_only=True, help_text='auto: PRM-001…'), text('Primer name'),
            text("Sequence (5'→3')"), num('Length (bp)'), num('Tm (°C)'), num('GC%'),
            dd('Hairpin loop', ['None', 'Low', 'Moderate', 'High']), dd('Primer dimer', ['None', 'Low', 'Moderate', 'High']),
        ]),
        screen('Primers order details — COA (table)', [
            text('Primer name'), text('Scale of synthesis'), text('Lot no.'), text('Mol. weight'),
            text('Yield / concentration'), text('Reconstitution vol.'),
            dd('Purity analysis', ['Pass', 'Fail', 'Pending', 'N/A']), date('MFG date'),
        ]),
    ]))


def sec_backbone():
    return with_trailer(section('Plasmid Backbone & Insert Details', [
        screen('Plasmid backbone detail (entry table)', [
            text('Vector name', required=True), dd('Expression system', ['Prokaryotic (E. coli)', 'Mammalian', 'Baculovirus', 'Yeast', 'Other']),
            text('Promoter'), text('RBS'), dd('Selection marker', ['Ampicillin', 'Kanamycin', 'Hygromycin', 'Neomycin', 'Zeocin', 'Blasticidin', 'Other']),
            text('Tag / Fusion'), num('Vector length (bp)'), text('MCS for insert'), text('Poly A signal'),
            area('Any specialised or secondary element'), text('Reporter gene / inducible operator'),
            area('Vector DNA sequences'),
        ]),
        screen('Plasmid insert detail (entry table)', [
            text('Insert name', required=True), text('NCBI accession / Source for insert'),
            num('Insert length'), area('Components used in insert'),
            dd('Sequence verification', ['Yes', 'No', 'Pending']), area('Any sequence modification'),
            dd('Codon optimization', ['Yes', 'No', 'Partial']), text('MCS mapping', placeholder="BamHI (5') / EcoRI (3')"),
            area('GOI DNA sequences'),
        ]),
    ]))


def sec_plasmid_map():
    return with_trailer(section('Plasmid Map and Sequence', [
        screen('Process sequence map — vector + insert (TeselaGen OVE)', [
            text('Construct snapshot (OVE)', read_only=True, help_text='Embedded TeselaGen OVE editor — not a plain field'),
            dt('Snapshot saved', read_only=True),
        ]),
        screen('Static plasmid map upload (optional)', [
            attach('Upload plasmid map image / PDF', help_text='SnapGene / APE / Vector NTI export; supplements OVE'),
        ]),
    ]))


def sec_pcr_mix():
    return with_trailer(section('PCR Reaction Mix', [
        screen('PCR reaction mix (table)', [
            text('Components'), num('Vol. test (µl)'), num('Vol. -ve ctrl (µl)'),
            num('Vol. +ve ctrl (µl)'), text('Final concentration'),
        ]),
        screen('DNA template — Test samples (table)', [
            text('Tube ID', help_text='auto: TMP-001…'), text('Source / Name'), num('Quantity'), dd('UOM', UOM_LIST),
        ]),
        screen('Controls', [
            text('Negative control — Source / Name'), num('Negative control — Quantity'), dd('Negative control — UOM', UOM_LIST),
            text('Positive control — Source / Name'), num('Positive control — Quantity'), dd('Positive control — UOM', UOM_LIST),
        ]),
        screen('Master mix distribution', [
            num('No. of reactions / tubes'), num('Total volume per tube — test (µl)', read_only=True),
            num('Total volume per tube — ctrl (µl)', read_only=True), text('Tube ID(s)'), text('PCR tube capacity'),
        ]),
        screen('DNA template standard concentration range (table)', [
            text('Template type'), text('Standard concentration range'),
        ]),
        screen('Notes', [area('Remarks')]),
    ]))


def sec_thermo(title='Thermocycling Conditions', trailer=True):
    sec = section(title, [
        screen('Thermocycling programme (table)', [text('Steps'), num('Temp (°C)'), text('Time'), num('Cycles')]),
    ])
    return with_trailer(sec) if trailer else sec


def sec_pcr_gel():
    return with_trailer(section('Agarose gel analysis', [
        screen('PCR product output details (table)', [
            text('Tube ID'), num('Volume (µl)'), dd('Storage conditions', STORAGE_OPTS), text('Storage location'),
        ]),
        gel_conditions_screen('Agarose gel analysis of PCR product'),
        screen('Observation of PCR product (table)', [
            text('Tube ID'), text('Sample'), num('No. of band(s) Observed'), num('Estimated size (bp)'),
            dd('Verdict (+/-)', ['+', '-', 'N/A']),
        ]),
        screen('Notes', [area('Remarks')]),
    ]))


def sec_pcr_cleanup():
    return with_trailer(section('PCR Clean-up / Gel Extraction', [
        screen('Sample information (table)', [
            text('Sample ID'), dd('Sample type', ['PCR clean-up', 'Gel extraction', 'Other']),
            text('Gel slice wt (mg)', help_text='NA if clean-up'), text('Starting volume'),
        ]),
        screen('7.1 Solubilisation of gel (table)', [text('Tube ID'), num('Binding buffer volume (µl)'), text('Notes')]),
        screen('7.2 PCR clean-up (table)', [text('Tube ID'), num('PCR Volume (µl)'), num('Binding Buffer Volume'), text('Mixing')]),
        screen('7.3 Incubation time for gel (table)', [
            text('Tube ID'), num('Water bath temp (°C)'), num('Time for melting (min)'),
            text('Mix between interval'), text('Final observation'), dd('Normalize to RT', ['Yes', 'No']),
        ]),
        screen('7.4 Binding (table)', [
            text('Tube ID'), num('Volume passed through spin column'), text('Spin speed'), num('Spin temp (°C)'), text('Spin time'),
        ]),
        screen('7.5 Washing (table)', [
            text('Tube ID'), num('Wash buffer vol. (µl)'), text('Spin speed'), num('Spin temp (°C)'), text('Spin time'),
        ]),
        screen('7.6 Dry membrane (table)', [text('Tube ID'), text('Spin speed'), num('Spin temp (°C)'), text('Spin time')]),
        screen('7.7 Elute (table)', [
            text('Tube ID'), num('Eluent vol. (µl)'), text('Static incubation at RT'),
            text('Spin speed'), num('Spin temp (°C)'), text('Spin time'),
        ]),
        screen('7.8 Quantification (table)', [
            text('Tube ID'), num('Eluate vol. (µl)'), num('Concentration (ng/µl)'), num('Total DNA quantity'),
            num('Purity A260/280'), dd('Quality check', ['Pass', 'Fail', 'Pending']),
        ]),
        screen('7.9 Storage (table)', [
            text('Tube ID'), num('Volume (µl)'), dd('Storage condition', STORAGE_OPTS), text('Storage location'),
        ]),
        gel_conditions_screen('7.10 Agarose gel analysis'),
        screen('Notes', [area('Observations', help_text='Band identity, purity check, size match…')]),
    ]))


def sec_re_components():
    return with_trailer(section('Vector & Insert Components', [
        screen('Components (table)', [
            dd('Components', ['Vector', 'Insert']), text('Name'), text('Restriction enzyme(s)'), num('Expected band size (bp)'),
        ]),
    ]))


def sec_digest():
    return with_trailer(section('Restriction Digestion Reaction Mix', [
        screen('Reaction setup (table)', [
            text('Tube ID'), text('Components'), text('Name'), text('Make'), num('Amount (µl)'), text('Total concentration'),
        ]),
        screen('Protocol steps / checklist (table)', [text('Name'), text('Status / Value')]),
        screen('Notes', [area('Remarks')]),
    ]))


def sec_postdigest():
    return with_trailer(section('Post-Digest Processing', [
        screen('Dephosphorylation', [
            dd('Dephosphorylation required', ['Yes — CIP/SAP treated', 'Yes — Fast-AP treated', 'No', 'Not required']),
        ]),
        screen('Vector dephosphorylation reaction mix (table)', [
            text('Tube ID'), text('Components'), text('Name'), num('Volume (µl)'), text('Final concentration'),
        ]),
        screen('Incubation time (table)', [text('Process Name'), num('Temp (°C)'), num('Time (min)')]),
        gel_conditions_screen('9.2 Preparatory agarose gel'),
        screen('Notes', [area('Observations', help_text='Band separation quality, vector vs insert resolution')]),
    ]))


def sec_gel_extraction():
    return with_trailer(section('Gel Extraction', [
        screen('Sample information (table)', [
            text('Tube ID'), dd('Sample type', ['Gel extraction', 'PCR clean-up', 'Other']),
            num('Gel slice wt (mg)'), text('Sample name'),
        ]),
        screen('10.1 Solubilisation of gel (table)', [text('Tube ID'), num('Binding buffer added to gel (µl)'), text('Notes')]),
        screen('10.2 Incubation time for gel (table)', [
            text('Tube ID'), num('Water bath temp (°C)'), num('Time for melting (min)'),
            text('Mix between time interval'), text('Final observation'), text('Cooling / normalize to RT'),
        ]),
        screen('10.3 Binding (table)', [
            text('Tube ID'), num('Vol. dissolved gel through spin column (µl)'), text('Spin speed'),
            num('Spin temp (°C)'), text('Spin time'),
        ]),
        screen('10.4 Washing (table)', [
            text('Tube ID'), num('Wash buffer vol. through column (µl)'), text('Spin speed'), num('Spin temp (°C)'), text('Spin time'),
        ]),
        screen('10.5 Dry membrane (table)', [text('Tube ID'), text('Spin speed'), num('Spin temp (°C)'), text('Spin time')]),
        screen('10.6 Elute (table)', [
            text('Tube ID'), text('Sample Name'), text('Type'), num('Volume of eluent added (µl)'),
            text('Static incubation time'), text('Spin speed'), num('Spin temp (°C)'), text('Spin time'),
        ]),
        screen('10.7 Quantification (table)', [
            text('Tube ID'), text('Sample Name'), num('Eluate volume (µl)'), num('Concentration (ng/µl)'),
            num('Total DNA quantity'), num('Purity A260/280'), dd('Quality check', ['Pass', 'Fail', 'Pending']),
        ]),
        gel_conditions_screen('Gel conditions'),
        screen('Observation of agarose gel image (table)', [text('Component'), num('Band(s) observed'), text('Size observed')]),
        screen('Storage (table)', [text('Sample ID'), num('Volume (µl)'), dd('Storage temp.', STORAGE_OPTS), text('Storage location')]),
    ]))


def sec_ligation():
    return with_trailer(section('Ligation', [
        screen('11.1 Ligation ratio details (table)', [text('Sample ID / Tube ID'), text('Vector : Insert ratio')]),
        screen('11.2 Ligation method', [dd('Ligation method', ['RE', 'Golden Gate', 'Gibson', 'InSnap fusion', 'Other'], required=True)]),
        screen('11.3 Ligation reaction mix (table)', [text('Reagents'), text('Name'), num('Volume (µl)')]),
        screen('11.4 Incubation time for ligation', [text('Incubation time', placeholder='16°C overnight'), text('Incubation place')]),
    ]))


def sec_transform_link():
    return with_trailer(section('Bacterial Transformation', [
        linked_experiment_screen('Transformation experiment reference ID', 'Bact-Trans-001', 'Transformation analysis required'),
    ]))


def sec_colony_pcr():
    return with_trailer(section('Colony PCR', [
        screen('Experimental overview (table)', [
            text('Plate ID'), text('Antibiotic selection'), text('Target insert / length'),
            num('No. of colonies screened'), text('Polymerase brand'), text('FP name'), text('RP name'),
        ]),
        screen('Colony PCR — master mix (table)', [
            text('Components'), num('Vol. test (µl)'), num('Vol. -ve ctrl (µl)'), num('Vol. +ve ctrl (µl)'), text('Final concentration'),
        ]),
        screen('DNA template (table)', [text('DNA template'), text('Source')]),
        screen('Components — master-mix distribution (table)', [text('Components'), text('Values')]),
        screen('Procedure', [area('Procedure — numbered steps')]),
        screen('Thermocycler profile (table)', [text('Steps'), num('Temp (°C)'), text('Time'), num('Cycles')]),
        gel_conditions_screen('Agarose gel analysis of PCR product', img_hint='colony PCR products'),
        screen('Results (table)', [
            text('Tube / Well no.'), text('Colony / Sample'), dd('Band observed (Y/N)', ['Y', 'N']),
            num('Estimated size (bp)'), dd('Verdict (+/-)', ['+', '-', 'N/A']),
        ]),
        screen('Notes', [area('Successful colonies identified'), area('Conclusion and next step')]),
    ]))


def sec_plasmid_isolation_link():
    return with_trailer(section('Plasmid Isolation', [
        linked_experiment_screen(
            'Plasmid isolation experiment reference ID', 'Plasmid-DNA-001', 'Plasmid isolation required',
            extra_fields=[num('No. of clones isolated for RE confirm')],
        ),
    ]))


def sec_re_confirm():
    return with_trailer(section('RE Confirmation', [
        screen('Experimental overview (table)', [
            text('Plasmid ID'), text('Plasmid backbone'), text('Plasmid source'), text('Enzyme(s)'),
            dd('Digest type', ['Single', 'Double', 'Other']), num('Expected band size (bp)'), text('Link to plasmid isolation'),
        ]),
        screen('Reaction calculator for master mix (table)', [text('Components'), text('Make'), num('Amount (µl)')]),
        screen('Protocol steps / checklist (table)', [text('Name'), text('Status / Value')]),
        screen('Notes', [area('Remarks')]),
        gel_conditions_screen('Agarose gel image', img_label='Upload RE confirmation gel'),
        screen('Gel results — band observation (table)', [
            text('Sample / Tube no.'), dd('Band observed (Y/N)', ['Y', 'N']), num('Estimated size (bp)'),
            dd('Verdict (+/-)', ['+', '-', 'N/A']),
        ]),
        screen('Clone verified table', [
            text('Tube / Well no.'), text('Sample source'), num('Expected size (bp)'), num('Observed size (bp)'),
            dd('Clone verified (Y/N)', ['Y', 'N', 'N/A']),
        ]),
        screen('Conclusion and next step (table)', [
            text('Verified clones identified'), text('Finalized clone no. for scale-up'),
            text('Finalized clone no. for Midi/maxi prep'),
        ]),
        screen('Notes ', [area('Remarks')]),
    ]))


def sec_clone_stability():
    return with_trailer(section('Plasmid Stability', [
        screen('Stability', [
            text('Finalized clone ID', required=True, placeholder='Puc57_1'),
            dd('Stability outcome', ['Pass', 'Fail', 'Under review', 'N/A']),
            area('Plasmid stability / clone stability'),
        ]),
    ]))


def sec_scale_up_prep():
    return with_trailer(section('Mini/Midi/Maxi Prep', [
        screen('Scale-up prep', [
            yesno('Plasmid DNA preparation required'),
            text('Plasmid DNA reference experiment ID', required=True, placeholder='Plasmid-DNA-001'),
            text('Finalized clone ID', placeholder='Puc57_1'), dd('Prep type', ['Mini prep', 'Midi prep', 'Maxi prep']),
            area('Summary / outcome'),
        ]),
    ]))


def sec_final_re_sanger():
    return with_trailer(section('Final RE & Sanger', [
        screen('Confirmation required', [
            yesno('Final RE / Sanger confirmation required'),
            text('Plasmid DNA reference experiment ID', required=True, placeholder='Plasmid-DNA-001'),
        ]),
        screen('18.1 Restriction (table)', [text('Components'), text('Make'), num('Amount (µl)')]),
        screen('Incubation time', [text('Incubation time', placeholder='37°C for 1 h')]),
        gel_conditions_screen('18.2 Agarose gel image', img_label='Upload final prepared clone restriction digest'),
        screen('18.3 Result (table)', [
            text('Sample / Tube no.'), num('Expected band size (bp)'), num('Observed band size (bp)'),
            dd('Clone verified (Y/N)', ['Y', 'N', 'N/A']),
        ]),
        screen('18.4 Sanger sequences results (table)', [
            text('Primer'), num('Read length (bp)'), num('Match %'), dd('Verdict', ['Pass', 'Fail', 'Review']),
        ]),
        screen('Notes', [area('Sanger conclusion')]),
    ]))


def sec_scb_prep():
    return with_trailer(section('SCB Preparation', [
        screen('Source Cell Bank preparation', [
            yesno('SCB / RCB preparation required'), text('Reference experiment number', required=True, placeholder='RCB-001'),
            text('Finalized clone ID', placeholder='Puc57_1'), yesno('Downstream analysis required'),
            area('Summary / outcome'),
        ]),
    ]))


def sec_results_cloning():
    return with_trailer(section('Results & Conclusion', results_closeout_screens()))


CLONING_SECTION_BUILDERS = {
    'aim': sec_aim_cloning, 'samples': sec_samples_cloning, 'materials': sec_materials_cloning,
    'equipment': sec_equipment_cloning, 'primers': sec_primers, 'backbone': sec_backbone,
    'plasmid-map': sec_plasmid_map, 'pcr-mix': sec_pcr_mix, 'thermo': sec_thermo, 'pcr-gel': sec_pcr_gel,
    'pcr-cleanup': sec_pcr_cleanup, 're-comps': sec_re_components, 'digest': sec_digest,
    'postdigest': sec_postdigest, 'gel-extraction': sec_gel_extraction, 'ligation': sec_ligation,
    'transform': sec_transform_link, 'colonies': sec_colony_pcr, 'plasmid-isolation': sec_plasmid_isolation_link,
    're-confirm': sec_re_confirm, 'clone-stability': sec_clone_stability, 'scale-up-prep': sec_scale_up_prep,
    'final-re-confirm': sec_final_re_sanger, 'scb-prep': sec_scb_prep, 'results': sec_results_cloning,
}


def build_molbio_cloning():
    order = ['aim', 'samples', 'materials', 'equipment', 'primers', 'backbone', 'plasmid-map',
             'pcr-mix', 'thermo', 'pcr-gel', 'pcr-cleanup', 're-comps', 'digest', 'postdigest',
             'gel-extraction', 'ligation', 'transform', 'colonies', 'plasmid-isolation', 're-confirm',
             'clone-stability', 'scale-up-prep', 'final-re-confirm', 'scb-prep', 'results']
    sections = [CLONING_SECTION_BUILDERS[k]() for k in order]
    apply_phases(sections, [
        ('RUN SETUP', 4), ('IN SILICO ANALYSIS', 3), ('PCR', 4), ('RESTRICTION & LIGATION', 5),
        ('TRANSFORMATION & SCREENING', 4), ('RUN CLOSEOUT', 5),
    ])
    return {'sections': sections}


def build_pcs():
    """Positive Clone Screening — 13-section subset of Cloning, same components, PCS-001 default."""
    order = ['aim', 'samples', 'materials', 'equipment', 'transform', 'colonies',
             'plasmid-isolation', 're-confirm', 'clone-stability', 'scale-up-prep',
             'final-re-confirm', 'scb-prep', 'results']
    sections = []
    for k in order:
        s = CLONING_SECTION_BUILDERS['aim']('PCS-001') if k == 'aim' else CLONING_SECTION_BUILDERS[k]()
        sections.append(s)
    apply_phases(sections, [
        ('RUN SETUP', 4), ('COLONY PCR', 2), ('RE CONFIRMATION', 2),
        ('FINAL CLONE CONFIRMATION', 2), ('FINAL RE AND SANGER', 3),
    ])
    return {'sections': sections}


# ══════════════════════════════════════════════════════════════════════════
# Bacterial Transformation — 8 sections, 3 phases
# ══════════════════════════════════════════════════════════════════════════
def build_transformation():
    sections = [
        section('Aim & Objectives', [
            screen('Experiment identity', [
                text('Experiment ID', placeholder='Bact-Trans-001'), text('Title', required=True),
                text('Upstream cloning experiment', placeholder='Mol-Col-001'),
                dd('Department', DEPARTMENTS, required=True), dd('Biosafety classification', BIOSAFETY),
                text('Reference SOP / protocol', required=True, placeholder='e.g. SOP-MB-002'),
                date('Start date'), text('Related change control', placeholder='e.g. CC-2026-002'),
            ]),
            screen('Narrative', [area('Objectives', required=True), area('Background')]),
        ]),
        section('Sample Details', [
            screen('Competent Cell Type (table)', [
                text('Bacterial Strain'), dd('Type', ['Chemically competent', 'Electrocompetent', 'One Shot', 'Other']),
                text('CFU / µg'), text('Make'), text('Cat No.'), text('Lot No.'),
                dd('Storage Condition', ['-80 °C', '-20 °C', '4 °C']),
            ]),
            screen('Plasmid DNA / Insert (table)', [
                text('Plasmid Name'), text('Antibiotic Resistance Marker'), text('Stock Concentration'),
                text('Make'), text('Cat No.'), text('Lot No.'), dd('Storage Condition', ['-20 °C', '-80 °C', '4 °C']),
            ]),
            screen('Control DNA (table)', [
                text('Plasmid Name'), text('Antibiotic Resistance Marker'), text('Stock Concentration'),
                text('Make'), text('Cat No.'), text('Lot No.'), dd('Storage Condition', ['-20 °C', '-80 °C', '4 °C']),
            ]),
            screen('Selection Agent (table)', [text('Antibiotic Name'), text('Working Concentration'), text('Stock Concentration')]),
            screen('Recovery Medium (table)', [text('Media Name'), date('Media MFG Date'), dd('Media Storage Condition', ['4 °C', 'RT', '-20 °C'])]),
            screen('Selective Agar Plates (table)', [
                text('Solid Media'), text('Antibiotic + Concentration'), date('Plates MFG Date'), dd('Plates Storage Condition', ['4 °C', 'RT']),
            ]),
        ]),
        section('Materials & Reagents', materials_screens()),
        equipment_instrument_section('Equipment / Instrument Details'),

        section('Experimental Design', [
            screen('Tube layout (table)', [
                text('Tube'), num('Competent cells vol. (µl)'), num('Plasmid DNA vol. (µl)'),
                dd('Heat shock / electroporation', ['Yes', 'No', 'N/A']), text('Plating medium'), text('Expected result'),
            ]),
        ]),

        section('Step-by-Step Procedure', [
            screen('Competent Cells Thaw Time on Ice', [text('Thaw time', placeholder='10-15 minutes')]),
            screen('Test Plasmid DNA Details (table)', [text('Volume of DNA'), text('Transformed DNA Quantity'), text('DNA Concentration')]),
            screen('Control DNA Details (table)', [text('Volume of DNA'), text('Transformed DNA Quantity'), text('DNA Concentration')]),
            screen('Mixing & Incubation', [yesno('Mixing of Competent Cells and Plasmid DNA'), text('Incubation Time on Ice', placeholder='20 minutes')]),
            screen('Heat Shock Conditions (table)', [text('Temperature'), text('Place for Incubation'), text('Time for Heat Shock')]),
            screen('Recovery Time on Ice', [text('Recover time on ice', placeholder='2 minutes')]),
            screen('Outgrowth (table)', [
                text('Media Name'), text('Volume of Media'), text('Incubation Place'), text('Incubation Time'),
                text('Incubation Temperature'), text('Shaker Speed'),
            ]),
            screen('Plating (table)', [
                text('Plating Type'), text('Centrifuge Conditions'), text('Resuspension Volume'),
                text('Spread Volume'), text('Labelling on Plate'), date('Date on Plate'),
            ]),
            screen('Incubation Condition (table)', [dd('Position of Plate', ['Inverted', 'Upright']), text('Incubation Temperature'), text('Incubation Time')]),
        ]),

        section('Results & Observations', [
            screen('Visual Inspection', [area('Describe the colonies')]),
            screen('Colonies Counts — 1/10 (table)', [text('Tube No.'), num('Colonies No.')]),
            screen('Colonies Counts — 9/10 (table)', [text('Tube No.'), num('Colonies No.')]),
            screen('File Attachments / Photos', [attach('Upload plate image')]),
            screen('Transformation Efficiency', [
                num('Number of Colonies'), num('Total Recovery Volume (µl)'), num('DNA Mass (µg)'),
                num('Volume Plated (µl)'), num('Efficiency (cfu/µg)', read_only=True, help_text='computed'),
            ]),
        ]),

        section('Conclusion & Next Steps', [
            screen('Success Criteria (table)', [
                text('Colonies Condition on Negative Plate'), text('Colonies Condition on Positive Plate'),
                text('Colonies Condition on Test Plate'), dd('Efficiency Condition', ['Good', 'Bad', 'N/A']),
                dd('Any Contamination Observed', ['Yes', 'No']), dd('Any False Positive Colonies Observed', ['Yes', 'No']),
            ]),
            screen('Next Steps', [area('Next steps')]),
            screen('Storage Conditions (table)', [text('Storage Time'), text('Storage Place')]),
            screen('Gate decision', [dd('Gate Decision', GATE_OPTS)]),
            signatures_screen(),
        ]),
    ]
    apply_phases(sections, [('RUN SETUP', 4), ('TRANSFORMATION PROCEDURE', 2), ('RUN CLOSEOUT', 2)])
    return {'sections': sections}


# ══════════════════════════════════════════════════════════════════════════
# Plasmid DNA Isolation & Confirmation — 13 sections, 5 phases
# ══════════════════════════════════════════════════════════════════════════
def build_plasmid_isolation():
    sections = [
        section('Aim & Objectives', [
            screen('Experiment identity', [
                text('Experiment ID', placeholder='Plasmid-DNA-001'), text('Title', required=True),
                text('Upstream transformation experiment', placeholder='Bact-Trans-001'),
                text('Original cloning experiment', placeholder='Mol-Col-001'),
                dd('Department', DEPARTMENTS, required=True),
                dd('Prep scale', ['Mini-prep (≤10 ml)', 'Midi-prep (50-100 ml)', 'Maxi-prep (100-500 ml)', 'Mega-prep (≥500 ml)'], required=True),
                dd('Kit / chemistry', ['QIAprep Spin Mini', 'QIAGEN Plasmid Plus Midi/Maxi', 'Macherey-Nagel NucleoBond', 'Zyppy Plasmid', 'In-house alkaline lysis', 'Other']),
                text('Reference SOP', placeholder='e.g. SOP-MB-003'),
            ]),
            screen('Narrative', [area('Objectives', required=True), area('Background')]),
        ]),

        section('Sample Details', [
            screen('In-house generated material (table)', [
                text('Plasmid detail / ID'), date('MFG date'), dd('Storage temp.', STORAGE_OPTS), text('Remarks'),
            ]),
            screen('Synthesised plasmid (table)', [
                text('Plasmid name / ID'), text('Make'), text('Cat. no.'), text('Lot no.'), text('COA'),
                date('Delivery date'), text('Sequence file'), dd('Sanger done?', ['Yes', 'No', 'N/A']),
                dd('Storage', STORAGE_OPTS),
            ]),
        ]),

        section('Materials & Reagents', materials_screens()),
        equipment_instrument_section('Equipment / Instrument Details'),

        section('Colony Selection', [
            screen('Type of plasmid preparation', [
                dd('Type of plasmid preparation', ['Mini prep', 'Midi prep', 'Maxi prep'],
                   help_text='Shared state — also set in Lysis/Binding/Washing/Elution'),
            ]),
            screen('Colony selection (table)', [
                text('Plasmid detail/Plate ID'), text('Host strain'), text('Selective pressure'),
                num('Observed colonies'), num('No. picked'), text('Pick criteria'), dd('Replica plating', ['Yes', 'No']),
            ]),
        ]),

        section('Cell Growth & Harvesting', [
            screen('Cell growth (table)', [
                text('Colony ID'), text('Host strain'), text('Culture medium'), text('Media volume'),
                text('Selective pressure'), text('Incubation temp'), text('Aeration / shaking'), text('Harvest time'),
            ]),
            screen('Harvesting (table)', [
                text('Centrifugation speed'), text('Centrifugation time'), text('Centrifugation temp'),
                num('Harvest OD'), num('Cell pellet wt (g)'), dd('Supernatant removed', ['Yes', 'No']), text('Remarks'),
            ]),
        ]),

        section('Alkaline Lysis (P1 / P2 / P3)', [
            screen('Type of plasmid preparation', [dd('Type of plasmid preparation', ['Mini prep', 'Midi prep', 'Maxi prep'])]),
            screen('Resuspension — P1 (table)', [text('Component'), text('Status / Value')]),
            screen('Lysis — P2 (table)', [text('Component'), text('Status / Value')]),
            screen('Neutralization — P3 (table)', [text('Component'), text('Status / Value')]),
            screen('Notes', [area('Remarks')]),
        ]),

        section('Separation', [
            screen('Clarification (table)', [text('Component'), text('Value')]),
        ]),

        section('Binding', [
            screen('Type of plasmid preparation', [dd('Type of plasmid preparation', ['Mini prep', 'Midi prep', 'Maxi prep'])]),
            screen('Type: Mini Prep (table)', [text('Process'), text('Buffer / lysate'), text('Speed'), text('Temp'), text('Time'), text('Flow through')]),
            screen('Type: Midi Prep (table)', [
                text('Process'), text('Buffer / Lysate'), text('Volume added'), text('Time for gravity flow'),
                text('Flow through'), text('Remarks'),
            ]),
            screen('Type: Maxi Prep (table)', [
                text('Process'), text('Buffer / Lysate'), text('Volume added'), text('Time for gravity flow'),
                text('Flow through'), text('Remarks'),
            ]),
        ]),

        section('Washing', [
            screen('Type of plasmid preparation', [dd('Type of plasmid preparation', ['Mini prep', 'Midi prep', 'Maxi prep'])]),
            screen('Type: Mini Prep (table)', [text('Process'), text('Buffer / lysate / volume'), text('Speed'), text('Temp'), text('Time'), text('Flow through')]),
            screen('Type: Midi Prep (table)', [
                text('Process'), text('Buffer / Lysate'), text('Volume added'), text('Time for gravity flow'),
                text('Flow through'), text('Remarks'),
            ]),
            screen('Type: Maxi Prep (table)', [
                text('Process'), text('Buffer / Lysate'), text('Volume added'), text('Time for gravity flow'),
                text('Flow through'), text('Remarks'),
            ]),
        ]),

        section('Elution', [
            screen('Type of plasmid preparation', [dd('Type of plasmid preparation', ['Mini prep', 'Midi prep', 'Maxi prep'])]),
            screen('Type: Mini Prep (table)', [
                text('Process'), text('Eluent / volume'), text('Pre-warmed'), text('Speed'), text('Temp'), text('Time'), text('Eluate'),
            ]),
            screen('Type: Midi Prep — Elution (table)', [
                text('Process'), text('Eluent / volume'), text('Pre-warmed'), text('Volume added'),
                text('Time for gravity flow'), text('Eluate'), text('Remarks'),
            ]),
            screen('Type: Maxi Prep — Elution (table)', [
                text('Process'), text('Eluent / volume'), text('Pre-warmed'), text('Volume added'),
                text('Time for gravity flow'), text('Eluate'), text('Remarks'),
            ]),
            screen('DNA Precipitation (table)', [
                text('Process'), text('Isopropanol volume added'), text('Mixing'), text('Speed'), text('Temp'),
                text('Time'), text('Supernatant'), text('Remarks'),
            ]),
            screen('Washing — 70% Ethanol (table)', [
                text('Process'), text('Added vol. 70% Ethanol'), text('Speed'), text('Temp'), text('Time'),
                text('Supernatant'), text('Remarks'),
            ]),
            screen('Re-dissolution (table)', [text('Process'), text('Air dry'), text('Eluent'), text('Volume of eluent'), text('Remarks')]),
        ]),

        section('Sample Analysis', [
            screen('Sample analysis (table)', [
                text('Sample ID'), text('Sample details'), date('Date of MFG'), num('Sample qty (µl)'),
                dd('Storage', STORAGE_OPTS), text('Analysis required'),
            ]),
            gel_conditions_screen('Gel conditions', with_procedure=False),
            screen('Notes', [area('Observations', help_text='Band identity (supercoiled/linear/nicked), gDNA contamination, RNA smear, size match')]),
        ]),

        section('Results & Conclusion', [
            screen('Quantification (table)', [
                text('Sample ID'), num('Total volume (µl)'), num('Yield / Concentration (ng/µl)'),
                num('Purity A260/280', placeholder='1.8-2.0'), num('Purity A260/230', placeholder='≥ 2.0'), num('Total quantity (µg)'),
            ]),
            screen('Storage (table)', [text('Plasmid ID'), text('Box ID'), text('Location'), dd('Storage temp.', STORAGE_OPTS)]),
            screen('Restriction enzymes confirmation (table)', [
                text('Plasmid name'), text('Restriction enzyme(s)', placeholder='e.g. EcoRI + HindIII'),
                text('Expected band pattern (bp)', placeholder='e.g. 2686 + 500'), text('Observed band pattern (bp)'),
            ]),
            screen('Agarose gel image of restriction enzymes', [
                attach('Agarose gel image of restriction enzymes'), area('Observation of agarose gel image for restriction enzyme'),
            ]),
            screen('DNA Sequencing confirmation', [
                area('Observed DNA sequences and its alignment with in-silico DNA sequences'),
                attach('Sequencing trace / FASTA upload', help_text='Upload .ab1 / .fasta / .pdf'), area('Observation'),
            ]),
            screen('Summary & conclusions', [area('Summary of results'), area('Conclusions & next steps'), area('Deviations (if any)')]),
            screen('Gate decision', [dd('Gate decision', GATE_OPTS)]),
            signatures_screen(),
        ]),
    ]
    apply_phases(sections, [
        ('RUN SETUP', 4), ('EXPERIMENTAL PROCEDURE', 7), ('SAMPLE ANALYSIS', 1), ('RESULTS & CONCLUSION', 1),
    ])
    return {'sections': sections}


# ══════════════════════════════════════════════════════════════════════════
# Research Cell Bank (Cell Banking) — 10 sections, 4 phases
# ══════════════════════════════════════════════════════════════════════════
def build_cell_banking():
    sections = [
        section('Aim & Objectives', [
            screen('Experiment identity', [
                text('Experiment ID', placeholder='RCB-001'),
                text('Molecular cloning experiment reference ID', required=True, placeholder='e.g. Mol-Col-001'),
            ]),
            screen('Objectives', [
                area('Objectives', required=True, help_text='Preparation of Research Cell Bank (RCB) — state strain, plasmid, and intended downstream use'),
            ]),
        ]),

        section('Administrator & Regulatory Metadata', [
            screen('Metadata', [
                text('Cell bank name / ID', required=True, placeholder='e.g. RCB-001-C3'), date('Date of MFG'),
                text('Primary operator name'), text('Reviewer / supervisor name'),
                dd('Regulatory compliance level', ['Research Use Only', 'Pre-clinical', 'GMP-aligned', 'Other']),
                text('Storage location', placeholder='e.g. ULT-03 / MB Lab'),
            ]),
        ]),

        section('Strain / Cell Line History', [
            screen('History', [
                text('Parent strain name', placeholder='e.g. NEB Stbl3'), text('Species', placeholder='e.g. E. coli'),
                text('Source / repository', placeholder='e.g. NEB / Merck'), text('Cat. no.'), text('Lot no.'),
                text('Plasmid name'), text('Selection marker', placeholder='e.g. Ampicillin'),
                text('Pre-banking verification ID / results', col_span=2, placeholder='e.g. Sanger Seq, RE, PCR — Pass'),
                text('Verification file link', col_span=2, placeholder='Link to alignment / COA / gel image'),
            ], columns=2),
        ]),

        section('Culture & Banking Parameters', [
            screen('Banking parameters', [
                num('RCB vials count', placeholder='e.g. 25'), text('Base medium', placeholder='e.g. LB broth / DMEM'),
                text('Supplementation / antibiotic selection', placeholder='e.g. Amp 100 µg/ml'),
                text('Freezing medium / cryoprotectant', placeholder='e.g. 20% glycerol'),
                num('O.D. at banking', placeholder='e.g. 0.6'), text('Cell count (CFU/ml)', placeholder='e.g. 8 x 10^8'),
                num('Viability (%)', placeholder='e.g. 96'), date('RCB preparation date'),
            ]),
        ]),

        section('Materials & Reagents', materials_screens()),
        equipment_instrument_section('Equipment / Instrument Details'),

        section('Inoculation & Fermentation', [
            screen('Pre-culture inoculation', [
                date('Date'), text('Time', placeholder='HH:MM'), text('Pre-culture inoculum name'),
                text('Volume', placeholder='e.g. 5 mL'), text('Media'), text('Antibiotic selection'),
                num('Incubation temp (°C)'), num('Shaking (RPM)'), num('Duration (hours)'),
            ]),
            screen('Main culture inoculation', [
                date('Date'), text('Time', placeholder='HH:MM'), num('Pre-culture final OD'),
                num('Main culture starting OD600'), text('Volume'), text('Media'), text('Antibiotic selection'),
                num('Incubation temp (°C)'), num('Shaking (RPM)'), num('Duration (hours)'),
            ]),
            screen('Growth kinetics monitoring', [num('Time point 1 OD'), num('Time point 2 OD'), num('Time point 3 OD')]),
            screen('Harvest criteria (mid log phase)', [
                num('Target OD600'), num('Actual OD600'), date('Harvest date'), text('Harvest time', placeholder='HH:MM'),
            ]),
        ]),

        section('Cryopreservation', [
            screen('Harvest cooling step', [area('Harvest cooling step')]),
            screen('Freezing media & centrifugation parameters', [
                text('Freezing media'), text('Centrifuge speed'), num('Centrifuge temp (°C)'), text('Centrifuge time'),
            ]),
            screen('Resuspension / cryomixing ratio', [
                text('Volume of bacterial slurry'), text('Volume of cryoprotectant'), num('Final target OD'),
                text('Final target cell density (CFU/ml)'),
            ]),
            screen('Filling & cryovials', [
                text('Filling start time'), text('Filling end time'), num('Total no. of cryovials filled'),
                text('Volume aliquoted per cryovial'),
                dd('Freezing method', ['Controlled-rate freezing', 'Direct to -80°C', 'Dry ice / ethanol bath', 'Snap-freeze in LN₂', 'Other'], required=True),
            ]),
            screen('Transfer to ultra-low temperature storage', [
                date('Date of transfer'), text('Time of transfer', placeholder='HH:MM'), text('Storage location / freezer ID'),
            ]),
        ]),

        section('Quality Control (Post-Freeze)', [
            screen('Sample', [text('Sample ID', placeholder='e.g. RCB-001-QC-01')]),
            screen('Sample analysis and results (table)', [
                text('Test performed', read_only=True), text('Target'), text('Actual'), text('Method'),
                dd('Status (Pass/Fail)', ['Pass', 'Fail', 'N/A', 'Review']),
            ]),
            screen('Overall verdict', [dd('Overall bank QC verdict', ['Pass', 'Fail', 'Conditional'], required=True)]),
        ]),

        section('Results & Conclusion', [
            screen('Outcomes', [
                area('Summary of results', required=True, help_text='Vials prepared, storage location, thaw recovery result, plasmid retention confirmation'),
                area('Conclusions & next steps'), area('Deviations (if any)'),
            ]),
            screen('Gate decision', [dd('Gate decision', GATE_OPTS)]),
            signatures_screen(),
        ]),
    ]
    apply_phases(sections, [
        ('RUN SETUP', 6), ('EXPERIMENTAL PROCEDURE', 2), ('QUALITY CHECK', 1), ('RUN CLOSEOUT', 1),
    ])
    return {'sections': sections}


TEMPLATES = [
    {'slug': 'cgt-molbio-cloning', 'name': 'Mol-Bio Cloning', 'category': 'CGT_MOLBIO',
     'description': 'Molecular Cloning — primer design, PCR, restriction/ligation, transformation & screening '
                    '(from Mol-Bio Cloning Runtime field reference).',
     'build': build_molbio_cloning},
    {'slug': 'cgt-molbio-pcs', 'name': 'Positive Clone Screening', 'category': 'CGT_MOLBIO',
     'description': 'Positive Clone Screening — colony PCR, RE confirmation, clone stability, final RE & Sanger '
                    '(13-section subset of Mol-Bio Cloning).',
     'build': build_pcs},
    {'slug': 'cgt-molbio-transformation', 'name': 'Bacterial Transformation', 'category': 'CGT_MOLBIO',
     'description': 'Bacterial Transformation — heat shock/electroporation, recovery, plating, colony counts, '
                    'transformation efficiency (from Mol-Bio Transformation field reference).',
     'build': build_transformation},
    {'slug': 'cgt-molbio-plasmid-isolation', 'name': 'Plasmid DNA Isolation', 'category': 'CGT_MOLBIO',
     'description': 'Plasmid DNA Isolation & Confirmation — colony selection, alkaline lysis, prep-type-specific '
                    'binding/washing/elution, sample analysis (from Mol-Bio Plasmid Isolation field reference).',
     'build': build_plasmid_isolation},
    {'slug': 'cgt-molbio-cell-banking', 'name': 'Research Cell Bank', 'category': 'CGT_MOLBIO',
     'description': 'Research Cell Bank (RCB) — strain history, banking parameters, inoculation/fermentation, '
                    'cryopreservation, post-freeze QC (from Mol-Bio Cell Banking field reference).',
     'build': build_cell_banking},
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
