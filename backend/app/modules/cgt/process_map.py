"""Maps a CgtProject.process value to the workflow_template category whose
templates should be offered when creating a notebook under that project.

Mirrors the CGT template categories seeded by seeds/seed_cgt_plasmid_templates.py,
seeds/seed_aav_templates.py, seeds/seed_molbio_templates.py, and
seeds/seed_cgt_adc_templates.py.
"""

PROCESS_TO_TEMPLATE_CATEGORY: dict[str, str] = {
    "Molecular Biology": "CGT_MOLBIO",
    "Plasmid": "CGT_PLASMID",
    "AAV": "CGT_AAV",
    "ADC Synthesis": "CGT_ADC",
}


def category_for_process(process: str | None) -> str | None:
    if not process:
        return None
    return PROCESS_TO_TEMPLATE_CATEGORY.get(process)
