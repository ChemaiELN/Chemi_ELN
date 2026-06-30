"""Seed: inv_uom_dimensions + inv_uom_units — 40 dimensions."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.inventory import InvUomDimension, InvUomUnit

# (dimension_key, display_name, base_unit, [units: (symbol, name)])
DIMENSIONS = [
    ("volume",          "Volume",               "L",    [("L","Litre"),("mL","Millilitre"),("µL","Microlitre"),("nL","Nanolitre")]),
    ("mass",            "Mass",                 "g",    [("kg","Kilogram"),("g","Gram"),("mg","Milligram"),("µg","Microgram"),("ng","Nanogram"),("pg","Picogram")]),
    ("molar_amount",    "Molar Amount",         "mol",  [("mol","Mole"),("mmol","Millimole"),("µmol","Micromole"),("nmol","Nanomole")]),
    ("concentration",   "Concentration",        "g/L",  [("g/L","Gram per Litre"),("mg/L","Milligram per Litre"),("µg/L","Microgram per Litre"),("ng/L","Nanogram per Litre"),("mg/mL","Milligram per mL"),("µg/mL","Microgram per mL"),("ng/mL","Nanogram per mL")]),
    ("molarity",        "Molarity",             "M",    [("M","Molar"),("mM","Millimolar"),("µM","Micromolar"),("nM","Nanomolar")]),
    ("percentage",      "Percentage",           "%",    [("%","Percent"),("%v/v","Percent v/v"),("%w/v","Percent w/v"),("%w/w","Percent w/w")]),
    ("length",          "Length",               "m",    [("m","Metre"),("cm","Centimetre"),("mm","Millimetre"),("µm","Micrometre"),("nm","Nanometre")]),
    ("area",            "Area",                 "m²",   [("m²","Square Metre"),("cm²","Square Centimetre"),("mm²","Square Millimetre")]),
    ("temperature",     "Temperature",          "°C",   [("°C","Degree Celsius"),("°F","Degree Fahrenheit"),("K","Kelvin")]),
    ("pressure",        "Pressure",             "Pa",   [("Pa","Pascal"),("kPa","Kilopascal"),("MPa","Megapascal"),("bar","Bar"),("psi","PSI"),("atm","Atmosphere")]),
    ("time",            "Time",                 "s",    [("s","Second"),("min","Minute"),("h","Hour"),("d","Day")]),
    ("flow_rate",       "Flow Rate",            "mL/min",[("mL/min","Millilitre per Minute"),("µL/min","Microlitre per Minute"),("L/min","Litre per Minute")]),
    ("density",         "Density",              "g/mL", [("g/mL","Gram per mL"),("g/L","Gram per Litre"),("kg/m³","Kilogram per Cubic Metre")]),
    ("viscosity",       "Viscosity",            "cP",   [("cP","Centipoise"),("mPa·s","Millipascal Second")]),
    ("ph",              "pH",                   "pH",   [("pH","pH")]),
    ("activity",        "Enzymatic Activity",   "U",    [("U","Unit"),("mU","Milliunit"),("kU","Kilounit"),("U/mL","Units per mL"),("U/mg","Units per mg")]),
    ("specific_activity","Specific Activity",   "U/mg", [("U/mg","Units per Milligram"),("mU/mg","Milliunits per Milligram")]),
    ("purity",          "Purity",               "%",    [("%","Percent")]),
    ("absorbance",      "Absorbance",           "AU",   [("AU","Absorbance Unit"),("mAU","Milli Absorbance Unit")]),
    ("wavelength",      "Wavelength",           "nm",   [("nm","Nanometre"),("µm","Micrometre")]),
    ("frequency",       "Frequency",            "Hz",   [("Hz","Hertz"),("kHz","Kilohertz"),("MHz","Megahertz")]),
    ("rotation_speed",  "Rotation Speed",       "rpm",  [("rpm","Revolutions per Minute"),("g","Relative Centrifugal Force")]),
    ("power",           "Power",                "W",    [("W","Watt"),("mW","Milliwatt"),("µW","Microwatt")]),
    ("voltage",         "Voltage",              "V",    [("V","Volt"),("mV","Millivolt"),("kV","Kilovolt")]),
    ("current",         "Current",              "A",    [("A","Ampere"),("mA","Milliampere"),("µA","Microampere")]),
    ("conductivity",    "Conductivity",         "mS/cm",[("mS/cm","Millisiemens per cm"),("µS/cm","Microsiemens per cm"),("S/m","Siemens per Metre")]),
    ("osmolality",      "Osmolality",           "mOsm/kg",[("mOsm/kg","Milliosmole per kg"),("Osm/kg","Osmole per kg")]),
    ("particle_size",   "Particle Size",        "nm",   [("nm","Nanometre"),("µm","Micrometre"),("mm","Millimetre")]),
    ("surface_area",    "Surface Area",         "m²/g", [("m²/g","Square Metre per Gram"),("cm²/g","Square Centimetre per Gram")]),
    ("amount",          "Amount / Count",       "units",[("units","Units"),("pcs","Pieces"),("vials","Vials"),("ampoules","Ampoules")]),
    ("dilution",        "Dilution Factor",      "x",    [("x","Fold"),("1:n","Ratio")]),
    ("ratio",           "Ratio",                "",     [("v/v","Volume per Volume"),("w/v","Weight per Volume"),("w/w","Weight per Weight")]),
    ("iu",              "International Units",  "IU",   [("IU","International Unit"),("mIU","Milli International Unit"),("IU/mL","IU per mL")]),
    ("colony_units",    "Colony Forming Units", "CFU",  [("CFU","Colony Forming Unit"),("CFU/mL","CFU per mL")]),
    ("endotoxin",       "Endotoxin",            "EU",   [("EU","Endotoxin Unit"),("EU/mL","EU per mL"),("EU/mg","EU per mg")]),
    ("radiation",       "Radioactivity",        "Bq",   [("Bq","Becquerel"),("kBq","Kilobecquerel"),("MBq","Megabecquerel"),("Ci","Curie"),("mCi","Millicurie")]),
    ("force",           "Force",                "N",    [("N","Newton"),("mN","Millinewton"),("kN","Kilonewton")]),
    ("energy",          "Energy",               "J",    [("J","Joule"),("kJ","Kilojoule"),("cal","Calorie"),("kcal","Kilocalorie")]),
    ("angle",           "Angle",                "°",    [("°","Degree"),("rad","Radian"),("mrad","Milliradian")]),
    ("custom",          "Custom / Other",       "",     []),
]


def run():
    db = SessionLocal()
    try:
        dim_added = unit_added = 0
        for i, (key, display, base, units) in enumerate(DIMENSIONS):
            dim = db.query(InvUomDimension).filter_by(dimension_key=key).first()
            if not dim:
                dim = InvUomDimension(
                    dimension_key=key,
                    display_name=display,
                    base_unit=base,
                    sort_order=i,
                )
                db.add(dim)
                db.flush()
                dim_added += 1

            for j, (sym, name) in enumerate(units):
                exists = (
                    db.query(InvUomUnit)
                    .filter_by(dimension_id=dim.id, symbol=sym)
                    .first()
                )
                if not exists:
                    db.add(InvUomUnit(dimension_id=dim.id, symbol=sym, name=name, sort_order=j))
                    unit_added += 1

        db.commit()
        print(f"seed_uom_master: {dim_added} dimensions, {unit_added} units inserted.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
