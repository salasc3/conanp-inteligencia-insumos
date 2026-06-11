from __future__ import annotations

import csv
import json
import shutil
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
PILOT_ROOT = ROOT.parent / "conanp_pilot"
SOURCE_OUTPUTS = PILOT_ROOT / "outputs"
DOWNLOADS = ROOT / "assets" / "downloads"
PILOT_DATA = ROOT / "src" / "data" / "pilotData.json"


COPY_TARGETS = [
    ("CONANP_pilot_summary.xlsx", "CONANP_pilot_summary.xlsx", "Libro resumen del piloto", "Resumen ejecutivo con pestañas de ANP, fuentes, calidad, especies, inventario y metodología."),
    ("conanp_species_index.csv", "conanp_species_index.csv", "Índice maestro de especies", "Índice consolidado de taxa por ANP con fuentes, trazabilidad y banderas."),
    ("species_index_APFFPD.csv", "species_index_APFFPD.csv", "Índice de especies APFF Playa Delfines", "Índice de especies para APFF Playa Delfines."),
    ("species_index_PNAGMS.csv", "species_index_PNAGMS.csv", "Índice de especies PN Arrecifes del GMS", "Índice de especies para Parque Nacional Arrecifes del Golfo de México-Sur."),
    ("species_index_RBBK.csv", "species_index_RBBK.csv", "Índice de especies RB Balam Kú", "Índice de especies para Reserva de la Biosfera Balam Kú."),
    ("conanp_data_quality_summary.csv", "conanp_data_quality_summary.csv", "Resumen de calidad de datos", "Resumen de banderas de calidad y revisión."),
    ("conanp_source_inventory.csv", "conanp_source_inventory.csv", "Inventario de insumos", "Inventario de documentos y bases procesadas."),
    ("conanp_publication_ingestion_leads.csv", "conanp_publication_ingestion_leads.csv", "Pistas de ingesta de publicaciones", "Primeras pistas para el flujo de búsqueda e ingesta de publicaciones."),
    ("CONANP_pilot_scope.md", "CONANP_pilot_scope.md", "Nota de alcance del piloto", "Nota de alcance y próximos módulos del piloto."),
]


def main() -> None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    data = json.loads(PILOT_DATA.read_text(encoding="utf-8"))

    manifest = []
    for source_name, target_name, title, description in COPY_TARGETS:
        source = SOURCE_OUTPUTS / source_name
        target = DOWNLOADS / target_name
        shutil.copy2(source, target)
        manifest.append(download_item(target, title, description, category_for(target)))

    pdf_path = DOWNLOADS / "programa_manejo_borrador_preview.pdf"
    build_program_preview_pdf(pdf_path, data)
    manifest.insert(
        0,
        download_item(
            pdf_path,
            "PDF: vista previa de borrador asistido de Programa de Manejo",
            "Vista previa en PDF de una sección técnica generada desde el índice consolidado y la trazabilidad del piloto.",
            "Borrador PM",
        ),
    )

    (ROOT / "src" / "data" / "downloadManifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps({"downloads": len(manifest), "output_dir": str(DOWNLOADS)}, ensure_ascii=False, indent=2))


def download_item(path: Path, title: str, description: str, category: str) -> dict:
    return {
        "title": title,
        "description": description,
        "category": category,
        "file": f"assets/downloads/{path.name}",
        "format": path.suffix.lstrip(".").upper() or "FILE",
        "sizeBytes": path.stat().st_size,
    }


def category_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        return "Resumen"
    if "species" in path.name:
        return "Biodiversidad"
    if "quality" in path.name:
        return "Calidad"
    if "inventory" in path.name:
        return "Trazabilidad"
    if "publication" in path.name:
        return "Publicaciones"
    return "Metodología"


def build_program_preview_pdf(path: Path, data: dict) -> None:
    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.68 * inch,
        bottomMargin=0.62 * inch,
        title="Vista previa de borrador asistido de Programa de Manejo",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Kicker", parent=styles["Normal"], fontSize=9, leading=12, textColor=colors.HexColor("#0b6b55"), spaceAfter=8, uppercase=True))
    styles.add(ParagraphStyle(name="BodyLarge", parent=styles["BodyText"], fontSize=10.5, leading=15, spaceAfter=8))
    styles.add(ParagraphStyle(name="SmallMuted", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=colors.HexColor("#66706d")))
    styles["Title"].fontName = "Times-Bold"
    styles["Title"].fontSize = 22
    styles["Heading2"].fontName = "Times-Bold"
    styles["Heading2"].fontSize = 15

    story = [
        Paragraph("VISTA PREVIA / BORRADOR ASISTIDO", styles["Kicker"]),
        Paragraph("Programa de Manejo: sección técnica de biodiversidad", styles["Title"]),
        Paragraph(
            "Documento de demostración generado a partir de la base consolidada del piloto. "
            "No sustituye revisión científica, jurídica ni editorial de CONANP; muestra el tipo de salida que el sistema puede preparar con trazabilidad.",
            styles["BodyLarge"],
        ),
        Paragraph(f"Fecha de generación: {date.today().isoformat()}", styles["SmallMuted"]),
        Spacer(1, 0.18 * inch),
    ]

    summary_rows = [["ANP", "Registros", "Ocurrencias dedup.", "Taxa", "Con revisión"]]
    for row in data["summaryByAnp"]:
        summary_rows.append([
            row["anp_name"],
            fmt(row["source_records"]),
            fmt(row["deduped_occurrences"]),
            fmt(row["unique_taxa"]),
            fmt(row["records_with_quality_flags"]),
        ])
    story.append(Table(summary_rows, colWidths=[2.45 * inch, 1.05 * inch, 1.15 * inch, 0.75 * inch, 1.05 * inch], repeatRows=1, style=table_style()))
    story.append(Spacer(1, 0.25 * inch))

    for anp in data["summaryByAnp"]:
        code = anp["anp_code"]
        species = [
            row for row in data["speciesSample"]
            if row["anp_code"] == code and row.get("accepted_scientific_name")
        ][:8]
        sources = sorted({row["source_system"] for row in data["summaryBySource"] if row["anp_code"] == code})
        story.extend([
            Paragraph(anp["anp_name"], styles["Heading2"]),
            Paragraph(
                f"La base consolidada integra {fmt(anp['source_records'])} registros fuente y "
                f"{fmt(anp['unique_taxa'])} taxa únicos para esta ANP. Después de la agrupación inicial "
                f"se generaron {fmt(anp['deduped_occurrences'])} ocurrencias representativas. "
                f"Las fuentes integradas en esta vista son: {', '.join(sources)}.",
                styles["BodyLarge"],
            ),
            Paragraph(
                "Este texto debe leerse como una salida de trabajo: resume evidencia, conserva la fuente y marca "
                "qué requiere validación por especialistas antes de incorporarse a un Programa de Manejo.",
                styles["BodyLarge"],
            ),
        ])
        taxa_rows = [["Taxón de referencia", "Familia", "Fuentes", "Registros"]]
        for item in species:
            taxa_rows.append([
                italic(item["accepted_scientific_name"]),
                item.get("family") or "Sin dato",
                item.get("source_systems") or "Sin dato",
                fmt(item.get("source_record_count")),
            ])
        story.append(Table(taxa_rows, colWidths=[2.35 * inch, 1.45 * inch, 1.45 * inch, 0.85 * inch], repeatRows=1, style=table_style()))
        story.append(Spacer(1, 0.22 * inch))

    story.extend([
        Paragraph("Trazabilidad y controles propuestos", styles["Heading2"]),
        Paragraph(
            "Cada salida debería enlazar a archivo fuente, fila o identificador de registro, sistema de origen, "
            "autoridad taxonómica y estado de revisión. Las decisiones de validación deben registrar usuario, "
            "fecha, criterio y justificación.",
            styles["BodyLarge"],
        ),
        Paragraph(
            "Siguiente paso recomendado: conectar polígonos oficiales de ANP, autoridades taxonómicas acordadas "
            "por grupo biológico y un flujo de aprobación por roles.",
            styles["BodyLarge"],
        ),
    ])
    doc.build(story)


def table_style() -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#18221f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("LEADING", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d9dee3")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f7f8")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])


def fmt(value) -> str:
    try:
        return f"{int(float(value)):,}"
    except (TypeError, ValueError):
        return str(value or "")


def italic(value: str) -> str:
    escaped = (value or "Taxón pendiente").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"<i>{escaped}</i>"


if __name__ == "__main__":
    main()
