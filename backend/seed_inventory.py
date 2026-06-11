"""
Seed script — Inventory Master
Inserts all prototype data from CGT_MOD/Inventory_Master.jsx into the 21 inv_* tables.

Run from D:/sensor-proto/backend/:
    python seed_inventory.py
"""

import sys
import os
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.inventory_materials import (
    InvMaterial, InvMaterialChemicalProps, InvMaterialFormulationProps,
)
from app.models.inventory_manufacturers import InvManufacturer, InvManufacturerMapping
from app.models.inventory_batches import InvBatch, InvBatchEvent, InvBatchVerification
from app.models.inventory_stock import InvStockRequest, InvStockRequestEvent
from app.models.inventory_equipment import (
    InvEquipmentType, InvInstrumentType, InvColumnType,
    InvEquipmentCatalogue, InvInstrumentCatalogue, InvColumnCatalogue,
    InvMaintenanceSchedule, InvCalibrationSchedule,
    InvEquipmentVerification, InvInstrumentVerification,
    InvAuditTrail,
)


def d(s):
    """Parse date string like '2026-01-15' safely."""
    if not s or s in ("—", ""):
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def dt(s):
    """Parse datetime string safely."""
    if not s or s in ("—", ""):
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def seed():
    db = SessionLocal()
    try:
        # ── Guard: skip if already seeded ─────────────────────────────────────
        if db.query(InvMaterial).count() > 0:
            print("Inventory seed data already present — skipping.")
            return

        print("Seeding Inventory Master data...")

        # ── 1. Materials ──────────────────────────────────────────────────────
        materials_data = [
            dict(id=1,  code="MAT/26/100001", name="TCEP Hydrochloride",          material_type="RAW MATERIAL",    cas_no="51805-45-9",  molecular_formula="C9H16ClNO4S", mol_weight=286.74, storage_condition="2–8°C",  hazard_class="Hazardous", description="Reducing agent for disulfide bond cleavage in ADC conjugation"),
            dict(id=2,  code="MAT/26/100002", name="N-Acetyl-L-cysteine",          material_type="RAW MATERIAL",    cas_no="616-91-1",    molecular_formula="C5H9NO3S",    mol_weight=163.20, storage_condition="RT",     hazard_class=None,         description="Capping agent for unreacted maleimide groups"),
            dict(id=3,  code="MAT/26/100003", name="Dimethyl Sulfoxide",           material_type="RAW MATERIAL",    cas_no="67-68-5",     molecular_formula="C2H6OS",      mol_weight=78.13,  storage_condition="RT",     hazard_class="Flammable",  description="Cosolvent for linker-payload dissolution"),
            dict(id=4,  code="MAT/26/100004", name="vc-MMAE (Linker-Payload)",     material_type="API INTERMEDIATE",cas_no=None,          molecular_formula=None,          mol_weight=None,   storage_condition="−20°C",  hazard_class="Cytotoxic",  description="Cytotoxic payload for ADC conjugation"),
            dict(id=5,  code="MAT/26/100005", name="Phosphate Buffered Saline 10×",material_type="BUFFER",          cas_no=None,          molecular_formula=None,          mol_weight=None,   storage_condition="RT",     hazard_class=None,         description="Wash and dilution buffer for ADC process"),
            dict(id=6,  code="MAT/26/100006", name="Tween 20 (Polysorbate 20)",    material_type="RAW MATERIAL",    cas_no="9005-64-5",   molecular_formula=None,          mol_weight=None,   storage_condition="RT",     hazard_class=None,         description="Surfactant/stabilizer for formulation buffer"),
            dict(id=7,  code="MAT/26/100007", name="Anti-HER2 mAb Intermediate",   material_type="API INTERMEDIATE",cas_no=None,          molecular_formula=None,          mol_weight=None,   storage_condition="2–8°C",  hazard_class=None,         description="Monoclonal antibody intermediate for conjugation"),
            dict(id=8,  code="MAT/26/100008", name="Acetonitrile HPLC Grade",      material_type="RAW MATERIAL",    cas_no="75-05-8",     molecular_formula="C2H3N",       mol_weight=41.05,  storage_condition="RT",     hazard_class="Flammable",  description="Mobile phase solvent for HPLC analysis"),
            dict(id=9,  code="MAT/26/100009", name="Trifluoroacetic Acid",         material_type="RAW MATERIAL",    cas_no="76-05-1",     molecular_formula="CF3COOH",     mol_weight=114.02, storage_condition="RT",     hazard_class="Corrosive",  description="Ion-pairing agent for RP-HPLC mobile phases"),
        ]
        for m in materials_data:
            db.add(InvMaterial(**m))
        db.flush()
        print(f"  ✓ {len(materials_data)} materials")

        # ── 2. Chemical Properties ────────────────────────────────────────────
        chem_props_data = [
            dict(material_id=1, purity_pct=98.0,  grade="ACS",         appearance="White crystalline powder", solubility="Soluble in water",    boiling_pt=None,     melting_pt=None,   flash_pt=None,  density=1.31,  ph_range=None),
            dict(material_id=2, purity_pct=99.0,  grade="BioReagent",  appearance="White powder",             solubility="Soluble in water",    boiling_pt=None,     melting_pt=None,   flash_pt=None,  density=None,  ph_range=None),
            dict(material_id=3, purity_pct=99.9,  grade="ACS",         appearance="Clear liquid",             solubility="Miscible with water", boiling_pt="189°C",  melting_pt="18.5°C", flash_pt=None, density=1.10, ph_range=None),
            dict(material_id=4, purity_pct=95.0,  grade="Pharma",      appearance="White lyophilized powder", solubility="Soluble in DMSO",     boiling_pt=None,     melting_pt=None,   flash_pt=None,  density=None,  ph_range=None),
            dict(material_id=5, purity_pct=None,  grade="Cell culture",appearance="Clear solution",           solubility="Miscible with water", boiling_pt=None,     melting_pt=None,   flash_pt=None,  density=None,  ph_range="7.2–7.4"),
            dict(material_id=6, purity_pct=None,  grade="BioXtra",     appearance="Viscous liquid",           solubility="Miscible with water", boiling_pt=None,     melting_pt=None,   flash_pt=None,  density=None,  ph_range=None),
            dict(material_id=7, purity_pct=95.0,  grade="In-process",  appearance="Clear solution",           solubility="Aqueous buffer",      boiling_pt=None,     melting_pt=None,   flash_pt=None,  density=None,  ph_range=None),
            dict(material_id=8, purity_pct=99.9,  grade="HPLC",        appearance="Clear colourless liquid",  solubility="Miscible with water", boiling_pt="81–82°C",melting_pt="-48°C",flash_pt=None,  density=0.79,  ph_range=None),
            dict(material_id=9, purity_pct=99.5,  grade="HPLC",        appearance="Clear fuming liquid",      solubility="Miscible with water", boiling_pt="72–73°C",melting_pt="-15°C",flash_pt=None,  density=1.49,  ph_range=None),
        ]
        for cp in chem_props_data:
            db.add(InvMaterialChemicalProps(**cp))
        db.flush()
        print(f"  ✓ {len(chem_props_data)} chemical property records")

        # ── 3. Formulation Properties ─────────────────────────────────────────
        form_props_data = [
            dict(material_id=1, role="Reducing agent",      concentration="10 mM",   units="mM",  function="Cleaves disulfide bonds for conjugation",        compatibility_notes="Incompatible with oxidising agents"),
            dict(material_id=2, role="Capping agent",       concentration="5 mM",    units="mM",  function="Caps unreacted maleimide groups post-conjugation", compatibility_notes=None),
            dict(material_id=3, role="Cosolvent",           concentration="≤10% v/v",units="% v/v",function="Dissolves hydrophobic linker-payload",            compatibility_notes="Flammable; keep away from heat"),
            dict(material_id=4, role="Cytotoxic payload",   concentration="1 mg/mL", units="mg/mL",function="ADC conjugation payload",                        compatibility_notes="Handle in BSC; cytotoxic"),
            dict(material_id=5, role="Buffer",              concentration="1× working",units="×", function="Wash and dilution buffer",                         compatibility_notes=None),
            dict(material_id=6, role="Surfactant",          concentration="0.02% v/v",units="% v/v",function="Prevents aggregation in formulation buffer",     compatibility_notes=None),
            dict(material_id=7, role="Antibody intermediate",concentration="5 mg/mL",units="mg/mL",function="Conjugation substrate",                          compatibility_notes="Store at 2–8°C; avoid freeze-thaw"),
            dict(material_id=8, role="Mobile phase solvent",concentration="60–90% v/v",units="% v/v",function="Organic modifier for RP-HPLC",                 compatibility_notes="Flammable"),
            dict(material_id=9, role="Ion-pairing agent",  concentration="0.1% v/v", units="% v/v",function="Sharpens peak shape in RP-HPLC",                 compatibility_notes="Corrosive; handle with gloves"),
        ]
        for fp in form_props_data:
            db.add(InvMaterialFormulationProps(**fp))
        db.flush()
        print(f"  ✓ {len(form_props_data)} formulation property records")

        # ── 4. Manufacturers ──────────────────────────────────────────────────
        manufacturers_data = [
            dict(id=1, code="SIG", name="Sigma-Aldrich (Merck)",  country="USA",     contact_person="Sales Desk",      email="orders@sigmaaldrich.com",  phone="+1-800-325-3010", website="https://www.sigmaaldrich.com", address="3050 Spruce St, St. Louis, MO 63103"),
            dict(id=2, code="MCE", name="MedChemExpress",         country="China",   contact_person="Technical Support",email="tech@medchemexpress.com",  phone="+1-732-484-9848", website="https://www.medchemexpress.com",address="Shanghai, China"),
            dict(id=3, code="GIB", name="Gibco (Thermo Fisher)",  country="USA",     contact_person="Customer Care",   email="gibco@thermofisher.com",   phone="+1-800-955-6288", website="https://www.thermofisher.com", address="Grand Island, NY 14072"),
            dict(id=4, code="AGI", name="Agilent Technologies",   country="USA",     contact_person="Lab Solutions",   email="chem@agilent.com",         phone="+1-800-227-9770", website="https://www.agilent.com",      address="5301 Stevens Creek Blvd, Santa Clara, CA 95051"),
            dict(id=5, code="WAT", name="Waters Corporation",     country="USA",     contact_person="Sales",           email="info@waters.com",          phone="+1-508-478-2000", website="https://www.waters.com",       address="34 Maple St, Milford, MA 01757"),
            dict(id=6, code="PHN", name="Phenomenex",             country="USA",     contact_person="Tech Support",    email="techsupport@phenomenex.com",phone="+1-310-212-0555",website="https://www.phenomenex.com",   address="411 Madrid Ave, Torrance, CA 90501"),
            dict(id=7, code="TSH", name="Tosoh Bioscience",       country="Japan",   contact_person="Sales",           email="info@tosohbioscience.com", phone="+81-3-5427-5261", website="https://www.tosohbioscience.com",address="3-8-2 Shiba, Minato-ku, Tokyo"),
            dict(id=8, code="MRK", name="Merck Life Science",     country="Germany", contact_person="Customer Service",email="info@merckgroup.com",      phone="+49-6151-72-0",   website="https://www.merckgroup.com",   address="Frankfurter Str. 250, 64293 Darmstadt"),
            dict(id=9, code="RDY", name="Reddy Labs Supplies",    country="India",   contact_person="Mr. Ravi Kumar",  email="sales@reddylabs.in",       phone="+91-40-49002900",  website=None,                           address="Hyderabad, Telangana, India"),
        ]
        for mfr in manufacturers_data:
            db.add(InvManufacturer(**mfr))
        db.flush()
        print(f"  ✓ {len(manufacturers_data)} manufacturers")

        # ── 5. Manufacturer Mappings ──────────────────────────────────────────
        mappings_data = [
            dict(material_id=1, manufacturer_id=1, catalogue_no="C4706",       technical_grade="ACS",         lead_time_days=5,  min_order_qty=5),
            dict(material_id=1, manufacturer_id=8, catalogue_no="851004",       technical_grade="ACS",         lead_time_days=7,  min_order_qty=5),
            dict(material_id=2, manufacturer_id=1, catalogue_no="A7250",        technical_grade="BioReagent",  lead_time_days=5,  min_order_qty=10),
            dict(material_id=3, manufacturer_id=1, catalogue_no="D8418",        technical_grade="ACS",         lead_time_days=3,  min_order_qty=100),
            dict(material_id=3, manufacturer_id=8, catalogue_no="102931",       technical_grade="ACS",         lead_time_days=5,  min_order_qty=100),
            dict(material_id=4, manufacturer_id=2, catalogue_no="HY-15558",     technical_grade="Pharma",      lead_time_days=14, min_order_qty=1),
            dict(material_id=5, manufacturer_id=3, catalogue_no="70011044",     technical_grade="Cell culture",lead_time_days=7,  min_order_qty=1),
            dict(material_id=8, manufacturer_id=1, catalogue_no="34851",        technical_grade="HPLC",        lead_time_days=3,  min_order_qty=1),
            dict(material_id=8, manufacturer_id=8, catalogue_no="100030",       technical_grade="HPLC",        lead_time_days=5,  min_order_qty=1),
            dict(material_id=9, manufacturer_id=1, catalogue_no="T6508",        technical_grade="HPLC",        lead_time_days=5,  min_order_qty=25),
        ]
        for mp in mappings_data:
            db.add(InvManufacturerMapping(**mp))
        db.flush()
        print(f"  ✓ {len(mappings_data)} manufacturer mappings")

        # ── 6. Equipment Types ────────────────────────────────────────────────
        equip_types_data = [
            dict(id=1, code="ET-001", name="HPLC System",            description="High Performance Liquid Chromatography"),
            dict(id=2, code="ET-002", name="GC-MS System",            description="Gas Chromatography Mass Spectrometry"),
            dict(id=3, code="ET-003", name="UV-Vis Spectrophotometer",description="UV-Visible absorbance measurement"),
            dict(id=4, code="ET-004", name="Analytical Balance",      description="High precision weighing (0.01 mg)"),
            dict(id=5, code="ET-005", name="Karl Fischer Titrator",   description="Moisture content determination"),
            dict(id=6, code="ET-006", name="Dissolution Apparatus",   description="Drug release testing (USP I/II)"),
            dict(id=7, code="ET-007", name="Freeze Dryer",            description="Lyophilization for ADC stability samples"),
            dict(id=8, code="ET-008", name="Particle Size Analyzer",  description="DLS and laser diffraction"),
        ]
        for et in equip_types_data:
            db.add(InvEquipmentType(**et))
        db.flush()
        print(f"  ✓ {len(equip_types_data)} equipment types")

        # ── 7. Instrument Types ───────────────────────────────────────────────
        instr_types_data = [
            dict(id=1,  code="IT-001", name="UV Detector",          description="Variable wavelength UV detector for HPLC"),
            dict(id=2,  code="IT-002", name="RI Detector",           description="Refractive index detector"),
            dict(id=3,  code="IT-003", name="Autosampler",           description="Automated sample injection"),
            dict(id=4,  code="IT-004", name="Column Oven",           description="Temperature-controlled column compartment"),
            dict(id=5,  code="IT-005", name="Quaternary Pump",       description="Gradient pump for HPLC"),
            dict(id=6,  code="IT-006", name="DAD Detector",          description="Diode Array Detector for spectral analysis"),
            dict(id=7,  code="IT-007", name="Fluorescence Detector", description="For fluorescently-labeled ADC detection"),
            dict(id=8,  code="IT-008", name="Mass Spec Detector",    description="Single quadrupole MS for GC-MS"),
            dict(id=9,  code="IT-009", name="pH Meter",              description="Mettler Toledo SevenExcellence"),
            dict(id=10, code="IT-010", name="Conductivity Meter",    description="Buffer conductivity verification"),
        ]
        for it in instr_types_data:
            db.add(InvInstrumentType(**it))
        db.flush()
        print(f"  ✓ {len(instr_types_data)} instrument types")

        # ── 8. Column Types ───────────────────────────────────────────────────
        col_types_data = [
            dict(id=1, code="CT-001", name="Zorbax Eclipse Plus C18 (250mm)", description="Primary RP-HPLC column for DAR analysis",    length_mm=250, particle_size_um=5.0,  pore_size_angstrom=95),
            dict(id=2, code="CT-002", name="Zorbax Eclipse Plus C18 (150mm)", description="Fast screening column",                       length_mm=150, particle_size_um=3.5,  pore_size_angstrom=95),
            dict(id=3, code="CT-003", name="TSKgel G3000SWXL",                description="SEC for ADC aggregate/fragment analysis",     length_mm=300, particle_size_um=5.0,  pore_size_angstrom=250),
            dict(id=4, code="CT-004", name="TSKgel Butyl-NPR",                description="HIC for DAR distribution profiling",          length_mm=100, particle_size_um=2.5,  pore_size_angstrom=None),
            dict(id=5, code="CT-005", name="ProPac SCX-10",                   description="Charge variant analysis",                     length_mm=250, particle_size_um=5.0,  pore_size_angstrom=300),
            dict(id=6, code="CT-006", name="Poroshell 120 EC-C4",             description="Intact mass analysis / RP for large molecules",length_mm=150, particle_size_um=2.7,  pore_size_angstrom=120),
            dict(id=7, code="CT-007", name="Aeris WIDEPORE XB-C18",           description="Wide-pore C18 for ADC subunit analysis",      length_mm=150, particle_size_um=3.6,  pore_size_angstrom=200),
            dict(id=8, code="CT-008", name="DB-5ms GC Column",                description="GC-MS residual solvent analysis",             length_mm=30000,particle_size_um=None, pore_size_angstrom=None),
        ]
        for ct in col_types_data:
            db.add(InvColumnType(**ct))
        db.flush()
        print(f"  ✓ {len(col_types_data)} column types")

        # ── 9. Equipment Catalogue ────────────────────────────────────────────
        equip_cat_data = [
            dict(id=1, asset_id="EQ-HPLC-001", name="HPLC System #1",    equipment_type_id=1, serial_no="HPLC-SN-2024-001", manufacturer="Agilent", model="1260 Infinity II", location="Lab A — Analytical",    purchase_date=d("2024-01-15"), last_maintenance_date=d("2026-02-15"), maintenance_due_date=d("2026-08-15"), maintenance_status="DUE",  status="ACTIVE"),
            dict(id=2, asset_id="EQ-BAL-002",  name="Analytical Balance", equipment_type_id=4, serial_no="BAL-SN-2023-002",  manufacturer="Mettler Toledo", model="XPR204",    location="Lab B — Weighing Room", purchase_date=d("2023-06-01"), last_maintenance_date=d("2026-01-01"), maintenance_due_date=d("2026-10-01"), maintenance_status="OK",   status="ACTIVE"),
        ]
        for ec in equip_cat_data:
            db.add(InvEquipmentCatalogue(**ec))
        db.flush()
        print(f"  ✓ {len(equip_cat_data)} equipment catalogue entries")

        # ── 10. Instrument Catalogue ──────────────────────────────────────────
        instr_cat_data = [
            dict(id=1, asset_id="INS-UV-001",  name="UV Detector Module", instrument_type_id=1, serial_no="UV-SN-2024-001",  manufacturer="Agilent", model="G1314F",    location="Lab A — HPLC Bay 1", purchase_date=d("2024-01-15"), last_calibration_date=d("2026-02-15"), calibration_due_date=d("2026-08-15"), calibration_status="DUE", status="ACTIVE"),
            dict(id=2, asset_id="INS-DAD-002", name="DAD Detector",       instrument_type_id=6, serial_no="DAD-SN-2024-002", manufacturer="Waters",  model="2998 PDA",  location="Lab A — HPLC Bay 2", purchase_date=d("2024-03-01"), last_calibration_date=d("2026-03-01"), calibration_due_date=d("2026-09-01"), calibration_status="OK",  status="ACTIVE"),
        ]
        for ic in instr_cat_data:
            db.add(InvInstrumentCatalogue(**ic))
        db.flush()
        print(f"  ✓ {len(instr_cat_data)} instrument catalogue entries")

        # ── 11. Column Catalogue ──────────────────────────────────────────────
        col_cat_data = [
            dict(id=1, column_id="COL-C18-001", name="Zorbax Eclipse Plus C18", column_type_id=1, serial_no="SN-2026-0145", manufacturer="Agilent",  part_no="959990-902", purchased_date=d("2026-01-10"), max_injections=2000, cumulative_injections=342, status="ACTIVE"),
            dict(id=2, column_id="COL-SEC-002", name="TSKgel G3000SWXL",        column_type_id=3, serial_no="LOT-08541-A",  manufacturer="Tosoh",    part_no="08541",      purchased_date=d("2026-02-22"), max_injections=500,  cumulative_injections=128, status="ACTIVE"),
        ]
        for cc in col_cat_data:
            db.add(InvColumnCatalogue(**cc))
        db.flush()
        print(f"  ✓ {len(col_cat_data)} column catalogue entries")

        # ── 12. Maintenance Schedules ─────────────────────────────────────────
        maint_data = [
            dict(equipment_id=1, maintenance_type="Preventive", scheduled_date=d("2026-08-15"), completed_date=None,          technician=None,           status="DUE",         notes="Scheduled annual PM for HPLC System #1"),
            dict(equipment_id=2, maintenance_type="Preventive", scheduled_date=d("2026-10-01"), completed_date=None,          technician="CRD-Chemist",  status="IN_PROGRESS", notes="Annual PM — started 01-May-2026"),
        ]
        for ms in maint_data:
            db.add(InvMaintenanceSchedule(**ms))
        db.flush()
        print(f"  ✓ {len(maint_data)} maintenance schedules")

        # ── 13. Calibration Schedules ─────────────────────────────────────────
        calib_data = [
            dict(instrument_id=1, calibration_type="Semi-annual", scheduled_date=d("2026-08-15"), completed_date=None,          technician=None,           certificate_no=None,         status="DUE",       notes="Semi-annual calibration for UV Detector"),
            dict(instrument_id=2, calibration_type="Semi-annual", scheduled_date=d("2026-09-01"), completed_date=d("2026-03-22"),technician="CRD-Chemist",  certificate_no="CAL-DAD-002",status="COMPLETED", notes="Completed 22-Mar-2026 by ARD-TL"),
        ]
        for cs in calib_data:
            db.add(InvCalibrationSchedule(**cs))
        db.flush()
        print(f"  ✓ {len(calib_data)} calibration schedules")

        # ── 14. Equipment Verification Requests ───────────────────────────────
        equip_verif_data = [
            dict(request_no="EVR-2026-001", equipment_id=1, requested_by="CRD-Chemist", requested_at=dt("2026-05-10 16:45:00"), status="PENDING", remarks="Annual maintenance verification"),
            dict(request_no="EVR-2026-002", equipment_id=2, requested_by="Invuser1",    requested_at=dt("2026-05-12 09:00:00"), status="PENDING", remarks=""),
        ]
        for ev in equip_verif_data:
            db.add(InvEquipmentVerification(**ev))
        db.flush()
        print(f"  ✓ {len(equip_verif_data)} equipment verification requests")

        # ── 15. Instrument Verification Requests ──────────────────────────────
        instr_verif_data = [
            dict(request_no="IVR-2026-001", instrument_id=1, requested_by="CRD-Chemist", requested_at=dt("2026-05-08 10:00:00"), status="PENDING", remarks="Semi-annual calibration verification"),
            dict(request_no="IVR-2026-002", instrument_id=2, requested_by="ARD-TL",      requested_at=dt("2026-05-09 11:00:00"), status="PENDING", remarks=""),
        ]
        for iv in instr_verif_data:
            db.add(InvInstrumentVerification(**iv))
        db.flush()
        print(f"  ✓ {len(instr_verif_data)} instrument verification requests")

        # ── 16. Inventory Batches ─────────────────────────────────────────────
        batches_data = [
            # Available stock
            dict(id=1,  batch_no="TCEP-026-A/Bottles/1", material_id=1, manufacturer_id=1, qty_received=10.000, qty_available=5.200,  unit="gm", location="Lab A — Fridge 2",      mfg_date=d("2025-09-01"), expiry_date=d("2027-09-01"), retest_date=d("2027-03-01"), invoice_no=None, po_no=None, status="PARTIALLY_CONSUMED", category="available", received_by="CRD-Chemist", received_at=dt("2026-01-15 09:00:00")),
            dict(id=2,  batch_no="TCEP-026-B/Bottles/1", material_id=1, manufacturer_id=8, qty_received=10.000, qty_available=10.000, unit="gm", location="Lab A — Fridge 2",      mfg_date=d("2026-01-15"), expiry_date=d("2028-01-15"), retest_date=d("2027-07-15"), invoice_no=None, po_no=None, status="AVAILABLE",          category="available", received_by="CRD-Chemist", received_at=dt("2026-04-10 09:00:00")),
            dict(id=3,  batch_no="LP-26-008",            material_id=4, manufacturer_id=2, qty_received=5.000,  qty_available=1.950,  unit="ml", location="FRZ-PD-02 / Shelf 3",   mfg_date=d("2026-02-01"), expiry_date=d("2026-08-15"), retest_date=None,             invoice_no=None, po_no=None, status="PARTIALLY_CONSUMED", category="available", received_by="CRD-Chemist", received_at=dt("2026-04-22 09:00:00")),
            dict(id=4,  batch_no="LP-26-009",            material_id=4, manufacturer_id=2, qty_received=5.000,  qty_available=5.000,  unit="ml", location="FRZ-PD-02 / Shelf 3",   mfg_date=d("2026-03-15"), expiry_date=d("2027-01-15"), retest_date=None,             invoice_no=None, po_no=None, status="AVAILABLE",          category="available", received_by="Invuser1",    received_at=dt("2026-05-02 09:00:00")),
            dict(id=5,  batch_no="PBS-026-A",            material_id=5, manufacturer_id=3, qty_received=10.000, qty_available=6.500,  unit="lt", location="Shelf B-12",             mfg_date=d("2025-11-01"), expiry_date=d("2027-09-01"), retest_date=d("2027-03-01"), invoice_no=None, po_no=None, status="PARTIALLY_CONSUMED", category="available", received_by="CRD-Chemist", received_at=dt("2026-02-05 09:00:00")),
            dict(id=7,  batch_no="DMSO-026-A",           material_id=3, manufacturer_id=8, qty_received=500.000,qty_available=312.000,unit="ml", location="Solvent Cabinet SC-03",  mfg_date=d("2025-10-01"), expiry_date=d("2028-02-28"), retest_date=d("2027-10-01"), invoice_no=None, po_no=None, status="PARTIALLY_CONSUMED", category="available", received_by="CRD-Chemist", received_at=dt("2026-01-20 09:00:00")),
            dict(id=8,  batch_no="AB-26-031",            material_id=7, manufacturer_id=None,qty_received=100.000,qty_available=15.000,unit="mg", location="FRZ-PD-01 / Shelf 1",  mfg_date=d("2026-02-28"), expiry_date=d("2026-08-28"), retest_date=None,             invoice_no=None, po_no=None, status="PARTIALLY_CONSUMED", category="available", received_by="ARD-TL",      received_at=dt("2026-03-12 09:00:00")),
            dict(id=9,  batch_no="ACN-026-A",            material_id=8, manufacturer_id=8, qty_received=4.000,  qty_available=1.200,  unit="lt", location="Solvent Cabinet SC-01",  mfg_date=d("2025-11-15"), expiry_date=d("2027-11-15"), retest_date=d("2027-05-15"), invoice_no=None, po_no=None, status="PARTIALLY_CONSUMED", category="available", received_by="CRD-Chemist", received_at=dt("2026-02-01 09:00:00")),
            # Non-available stock
            dict(id=6,  batch_no="PBS-026-C",            material_id=5, manufacturer_id=3, qty_received=5.000,  qty_available=0.000,  unit="lt", location=None,                     mfg_date=d("2025-03-01"), expiry_date=d("2026-03-01"), retest_date=None,             invoice_no=None, po_no=None, status="EXPIRED",            category="non_available", received_by="Invuser2",    received_at=dt("2025-08-10 09:00:00")),
            # Historic stock
            dict(id=10, batch_no="AB-25-018",            material_id=7, manufacturer_id=None,qty_received=80.000, qty_available=0.000, unit="mg", location=None,                    mfg_date=d("2025-05-01"), expiry_date=d("2025-11-01"), retest_date=None,             invoice_no=None, po_no=None, status="CONSUMED",           category="historic",  received_by="Invuser1",    received_at=dt("2025-06-10 09:00:00")),
            dict(id=11, batch_no="NAC-025-A",            material_id=2, manufacturer_id=1, qty_received=25.000, qty_available=0.000,  unit="gm", location=None,                     mfg_date=d("2025-04-01"), expiry_date=d("2027-04-01"), retest_date=None,             invoice_no=None, po_no=None, status="CONSUMED",           category="historic",  received_by="Invuser2",    received_at=dt("2025-08-15 09:00:00")),
        ]
        for b in batches_data:
            db.add(InvBatch(**b))
        db.flush()
        print(f"  ✓ {len(batches_data)} inventory batches")

        # ── 17. Batch Events ──────────────────────────────────────────────────
        batch_events_data = [
            dict(batch_id=1, event_type="ADJUSTMENT",       qty=2.0,   ref_no=None,                  module="INVENTORY", issued_to=None,          purpose="Handling Losses",      project_code=None,       performed_by="CRD-Chemist", performed_at=dt("2026-05-18 15:07:44"), remarks="Adjusted qty from 7.2 → 5.2 gm"),
            dict(batch_id=3, event_type="ISSUED",           qty=3.050, ref_no="PD-ADC-26-015/R1S1",  module="CRD",       issued_to="CRD-Chemist", purpose="Experiment",           project_code="PD-ADC-26",performed_by="CRD-Chemist", performed_at=dt("2026-05-17 11:22:10"), remarks="Consumed in experiment PD-ADC-26-015"),
            dict(batch_id=4, event_type="RECEIVED",         qty=5.000, ref_no=None,                  module="INVENTORY", issued_to=None,          purpose=None,                   project_code=None,       performed_by="Invuser1",    performed_at=dt("2026-05-15 09:30:00"), remarks="New batch LP-26-009 received from MedChemExpress"),
            dict(batch_id=8, event_type="STOCK_ALLOCATION", qty=50.000,ref_no=None,                  module="INVENTORY", issued_to=None,          purpose="Project allocation",   project_code="CGT-ADC",  performed_by="ARD-TL",      performed_at=dt("2026-05-14 14:15:33"), remarks="Allocated to Project CGT-ADC"),
            dict(batch_id=7, event_type="RECEIVED",         qty=500.0, ref_no=None,                  module="INVENTORY", issued_to=None,          purpose=None,                   project_code=None,       performed_by="Invuser2",    performed_at=dt("2026-05-12 10:00:00"), remarks="Batch receipt verification completed. Result: PASS"),
            dict(batch_id=2, event_type="RECEIVED",         qty=10.000,ref_no=None,                  module="INVENTORY", issued_to=None,          purpose=None,                   project_code=None,       performed_by="CRD-Chemist", performed_at=dt("2026-05-10 16:45:00"), remarks="Verification requested — pending QA review"),
        ]
        for be in batch_events_data:
            db.add(InvBatchEvent(**be))
        db.flush()
        print(f"  ✓ {len(batch_events_data)} batch events")

        # ── 18. Batch Verification Requests ───────────────────────────────────
        batch_verif_data = [
            dict(request_no="BVR-2026-001", batch_id=2,  requested_by="CRD-Chemist", requested_at=dt("2026-05-10 16:45:00"), status="PENDING",  verified_by=None,          verified_at=None,                        remarks="Awaiting QA verification after receipt"),
            dict(request_no="BVR-2026-002", batch_id=4,  requested_by="Invuser1",    requested_at=dt("2026-05-15 09:30:00"), status="VERIFIED", verified_by="QA-Analyst",  verified_at=dt("2026-05-16 10:00:00"),   remarks="Quality check passed — approved for use"),
        ]
        for bv in batch_verif_data:
            db.add(InvBatchVerification(**bv))
        db.flush()
        print(f"  ✓ {len(batch_verif_data)} batch verification requests")

        # ── 19. Stock Requests ────────────────────────────────────────────────
        stock_req_data = [
            dict(id=1, request_no="SR-2026-001", material_id=8, qty_required=25.000, unit="gm", required_by_date=d("2026-06-01"), criticality="LOW",    purpose="Q2 restock",                    requested_by="CRD-Chemist",    requested_at=dt("2026-05-18 09:15:00"), approved_by="ARD-TL",  approved_at=dt("2026-05-18 14:30:22"), status="APPROVED", remarks=""),
            dict(id=2, request_no="SR-2026-002", material_id=1, qty_required=10.000, unit="gm", required_by_date=d("2026-06-05"), criticality="HIGH",   purpose="Urgent for PD-ADC-26-016",      requested_by="Dr. Sanjay Patel",requested_at=dt("2026-05-22 10:00:00"), approved_by=None,      approved_at=None,                      status="PENDING",  remarks="Urgent for PD-ADC-26-016"),
            dict(id=3, request_no="SR-2026-003", material_id=4, qty_required=5.000,  unit="ml", required_by_date=d("2026-06-10"), criticality="HIGH",   purpose="Cytotoxic payload — handle BSC",requested_by="Dr. Sanjay Patel",requested_at=dt("2026-05-25 08:00:00"), approved_by=None,      approved_at=None,                      status="PENDING",  remarks="Cytotoxic payload — handle in BSC"),
            dict(id=4, request_no="SR-2026-004", material_id=3, qty_required=200.000,unit="ml", required_by_date=d("2026-06-15"), criticality="MEDIUM", purpose="Solvent restock for Q2 runs",   requested_by="CRD-Chemist",    requested_at=dt("2026-05-28 09:00:00"), approved_by=None,      approved_at=None,                      status="PENDING",  remarks="Solvent restock for Q2 runs"),
        ]
        for sr in stock_req_data:
            db.add(InvStockRequest(**sr))
        db.flush()
        print(f"  ✓ {len(stock_req_data)} stock requests")

        # ── 20. Stock Request Events ──────────────────────────────────────────
        stock_req_events_data = [
            dict(request_id=1, event_type="SUBMITTED", performed_by="CRD-Chemist",    performed_at=dt("2026-05-18 09:15:00"), remarks="Stock request submitted for Acetonitrile HPLC Grade, Qty: 25.000 gm"),
            dict(request_id=1, event_type="APPROVED",  performed_by="ARD-TL",         performed_at=dt("2026-05-18 14:30:22"), remarks="Stock request approved. Procurement initiated."),
            dict(request_id=2, event_type="SUBMITTED", performed_by="Dr. Sanjay Patel",performed_at=dt("2026-05-22 10:00:00"),remarks="Stock request submitted for TCEP Hydrochloride, Qty: 10.000 gm, Criticality: HIGH"),
            dict(request_id=2, event_type="REVIEW",    performed_by="ARD-TL",         performed_at=dt("2026-05-23 11:45:00"), remarks="Request under review — awaiting inventory manager approval."),
            dict(request_id=3, event_type="SUBMITTED", performed_by="Dr. Sanjay Patel",performed_at=dt("2026-05-25 08:00:00"),remarks="Stock request submitted for vc-MMAE, Qty: 5.000 ml, Criticality: HIGH"),
            dict(request_id=4, event_type="SUBMITTED", performed_by="CRD-Chemist",    performed_at=dt("2026-05-28 09:00:00"), remarks="Stock request submitted for DMSO, Qty: 200.000 ml"),
        ]
        for sre in stock_req_events_data:
            db.add(InvStockRequestEvent(**sre))
        db.flush()
        print(f"  ✓ {len(stock_req_events_data)} stock request events")

        # ── 21. Audit Trail ───────────────────────────────────────────────────
        audit_data = [
            dict(event_type="MATERIAL_CREATED",          entity_type="material",   entity_id=9,  entity_ref="MAT/26/100009", performed_by="Dr. Priya Reddy",  performed_at=dt("2026-06-04 11:24:01"), details="Material Name: Trifluoroacetic Acid, Type: RAW MATERIAL, Grade: HPLC"),
            dict(event_type="MAPPING_CREATED",           entity_type="mapping",    entity_id=1,  entity_ref="MAT/26/100001", performed_by="Dr. Priya Reddy",  performed_at=dt("2026-06-04 11:20:15"), details="Vendor Sigma-Aldrich (SIG) associated to TCEP Hydrochloride"),
            dict(event_type="BATCH_UPDATED",             entity_type="batch",      entity_id=3,  entity_ref="LP-26-008",     performed_by="Dr. Sanjay Patel", performed_at=dt("2026-06-03 16:45:22"), old_value="AVAILABLE / 5.000 ml", new_value="PARTIALLY_CONSUMED / 1.950 ml", details="Consumed in experiment PD-ADC-26-015"),
            dict(event_type="BATCH_RECEIVED",            entity_type="batch",      entity_id=4,  entity_ref="LP-26-009",     performed_by="Lab Mgr Rajesh K.",performed_at=dt("2026-06-02 09:30:00"), details="New batch received. Vendor: MedChemExpress, Qty: 5.000 ml, Expiry: 15-Jan-2027"),
            dict(event_type="CHEMICAL_PROPS_UPDATED",    entity_type="material",   entity_id=1,  entity_ref="MAT/26/100001", performed_by="Dr. Sanjay Patel", performed_at=dt("2026-06-01 14:12:33"), old_value="Density: 1.30", new_value="Density: 1.31", details="Chemical Properties updated for TCEP Hydrochloride"),
            dict(event_type="MANUFACTURER_CREATED",      entity_type="manufacturer",entity_id=7, entity_ref="TSH",           performed_by="Dr. Priya Reddy",  performed_at=dt("2026-05-28 10:05:00"), details="New Vendor Tosoh Bioscience added — SEC and HIC columns"),
            dict(event_type="COLUMN_TYPE_CREATED",       entity_type="column_type",entity_id=8,  entity_ref="CT-008",        performed_by="Dr. A. Sharma",    performed_at=dt("2026-05-27 15:30:12"), details="New Column Type: DB-5ms GC Column, 30 m × 0.25 mm × 0.25 µm"),
            dict(event_type="BATCH_EXPIRED",             entity_type="batch",      entity_id=6,  entity_ref="PBS-026-C",     performed_by="System",           performed_at=dt("2026-03-01 00:00:00"), details="Batch expired. Available Qty at expiry: 0.000 lt. Auto-moved to Non-Available Stock"),
            dict(event_type="CALIBRATION_COMPLETED",     entity_type="instrument", entity_id=1,  entity_ref="INS-UV-001",    performed_by="Dr. A. Sharma",    performed_at=dt("2026-02-15 09:00:00"), details="HPLC System calibration completed using USP Caffeine CRS. Result: PASS. Next due: 15-Aug-2026"),
            dict(event_type="MATERIAL_CREATED",          entity_type="material",   entity_id=7,  entity_ref="MAT/26/100007", performed_by="Dr. Priya Reddy",  performed_at=dt("2026-02-10 11:00:00"), details="Material Name: Anti-HER2 mAb Intermediate, Type: API INTERMEDIATE, Grade: In-process"),
        ]
        for at in audit_data:
            db.add(InvAuditTrail(**at))
        db.flush()
        print(f"  ✓ {len(audit_data)} audit trail entries")

        db.commit()
        print("\n✅ Inventory Master seed complete.")
        print("   Materials: 9 | Manufacturers: 9 | Mappings: 10")
        print("   Batches: 11  | Batch Events: 6  | Verifications: 2")
        print("   Stock Requests: 4 | Stock Events: 6")
        print("   Equip Types: 8 | Instr Types: 10 | Col Types: 8")
        print("   Equipment: 2 | Instruments: 2 | Columns: 2")
        print("   Maint: 2 | Calib: 2 | Equip Verif: 2 | Instr Verif: 2")
        print("   Audit Trail: 10")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
