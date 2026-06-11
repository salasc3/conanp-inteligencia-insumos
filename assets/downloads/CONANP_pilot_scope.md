# CONANP AI Pilot - Consolidated Biodiversity Database

Generated: 2026-06-01 18:46

## Scope captured from the director's email

- Build one biodiversity database per ANP from the supplied GBIF, SNIB, Naturalista, and OBIS files.
- Remove duplicate species/records where possible and preserve source traceability.
- Use taxonomic authorities to reduce synonymy, then flag unresolved cases for expert review.
- Prepare the foundation for geographic congruence checks, scientific publication ingestion, GIS, economy, and demography modules.

## Granola status

The connected Granola workspace did not return a CONANP meeting transcript for the May 4 meeting or broader CONANP queries, so this first pass uses the email and supplied folder as the working scope.

## Current pilot outputs

- SQLite database with normalized occurrences, deduplicated occurrences, species index, source inventory, and quality summaries.
- CSV exports for species lists, deduplicated occurrences, normalized occurrences, quality flags, and source inventory.
- Summary workbook for presentation and review.

## Summary by ANP

| anp_code | anp_name | source_records | deduped_occurrences | possible_duplicate_records | unique_taxa | records_with_coordinates | records_with_quality_flags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| APFFPD | Área de Protección de Flora y Fauna Playa Delfines | 9088 | 5858 | 4636 | 710 | 9088 | 4646 |
| PNAGMS | Parque Nacional Arrecifes del Golfo de México-Sur | 40007 | 19231 | 25495 | 5776 | 40007 | 25659 |
| RBBK | Reserva de la Biosfera Balam Kú | 132433 | 53422 | 96576 | 6207 | 132433 | 97145 |

## Summary by source

| anp_code | anp_name | source_system | source_file | source_records | deduped_occurrences | unique_taxa | records_with_coordinates | records_with_quality_flags |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APFFPD | Área de Protección de Flora y Fauna Playa Delfines | GBIF | Insumos/APFF Playa Delfines/PlayaDelfines_GBIF.xlsx | 2642 | 1627 | 243 | 2642 | 1495 |
| APFFPD | Área de Protección de Flora y Fauna Playa Delfines | Naturalista | Insumos/APFF Playa Delfines/PlayaDelfines_Naturalista.xlsx | 213 | 212 | 105 | 213 | 3 |
| APFFPD | Área de Protección de Flora y Fauna Playa Delfines | SNIB | Insumos/APFF Playa Delfines/PlayaDelfines_SNIB.xlsx | 6233 | 4019 | 405 | 6233 | 3148 |
| PNAGMS | Parque Nacional Arrecifes del Golfo de México-Sur | GBIF | Insumos/PN Arrecifes del GMS/ArrecifesGMS_GBIF.xlsx | 16469 | 9134 | 2796 | 16469 | 10799 |
| PNAGMS | Parque Nacional Arrecifes del Golfo de México-Sur | Naturalista | Insumos/PN Arrecifes del GMS/ArrecifesGMS_Naturalista.xlsx | 79 | 74 | 64 | 79 | 26 |
| PNAGMS | Parque Nacional Arrecifes del Golfo de México-Sur | OBIS | Insumos/PN Arrecifes del GMS/ArrecifesGMS_OBIS.xlsx | 12514 | 3183 | 2018 | 12514 | 9863 |
| PNAGMS | Parque Nacional Arrecifes del Golfo de México-Sur | SNIB | Insumos/PN Arrecifes del GMS/ArrecifesGMS_SNIB.xlsx | 10945 | 6840 | 2453 | 10945 | 4971 |
| RBBK | Reserva de la Biosfera Balam Kú | GBIF | Insumos/RB Balam Kú/BalamKu_GBIF.xlsx | 58572 | 22461 | 2662 | 58572 | 45628 |
| RBBK | Reserva de la Biosfera Balam Kú | Naturalista | Insumos/RB Balam Kú/BalamKu_Naturalista.xlsx | 2952 | 2783 | 1128 | 2952 | 367 |
| RBBK | Reserva de la Biosfera Balam Kú | SNIB | Insumos/RB Balam Kú/BalamKu_SNIB.xlsx | 70909 | 28178 | 2976 | 70909 | 51150 |

## Data-quality flags

| quality_flag | affected_records | affected_anps |
| --- | --- | --- |
| missing_taxon | 2642 | APFFPD; PNAGMS; RBBK |
| missing_coordinates | 0 |  |
| invalid_coordinates | 0 |  |
| country_not_mexico_review | 0 |  |
| coordinate_uncertainty_gt_10km | 688 | APFFPD; PNAGMS; RBBK |
| duplicate_source_record_id | 0 |  |
| possible_cross_source_duplicate | 126707 | APFFPD; PNAGMS; RBBK |
| invasive_or_exotic | 0 |  |

## Initial publication-ingestion leads

This was a quick web-screening pass, not a full literature review. The pilot can use these as seed examples for the publication-ingestion workflow:

| ANP | Lead | Use in pilot | URL |
| --- | --- | --- | --- |
| RBBK | Carrillo-Reyna, Reyna-Hurtado & Schmook (2015), Revista Mexicana de Biodiversidad, on Tapirus bairdii in Calakmul and Balam Kú | Good first scientific-paper extraction example because it documents a focal species and methods in Balam Kú | https://revista.ib.unam.mx/index.php/bio/article/view/1113 |
| APFFPD | Official CONANP Playa Delfines profile and EPJ | Not a scientific paper, but a control source for ANP metadata, decree date, surface, context, and official biodiversity claims | https://descubreanp.conanp.gob.mx/es/conanp/ANP?suri=194 |
| PNAGMS | DOF decree and CONANP/SEMARNAT EPJ for Arrecifes del Golfo de México-Sur | Official source for protected-area biodiversity counts and named taxa; should be linked to the document-ingestion layer | https://sidof.segob.gob.mx/notas/docFuente/5739808 |
| PNAGMS | Adjacent reef literature for Sistema Arrecifal Veracruzano / Gulf of Mexico reefs | Candidate scientific literature pool, but needs screening before merging because several results are adjacent rather than exact-boundary records | https://pmc.ncbi.nlm.nih.gov/articles/PMC6821827/ |

## Recommended next build

1. Add official ANP polygons and run point-in-polygon validation for every record.
2. Add GBIF/WoRMS/CONABIO authority matching as an automated service layer for names that disagree across sources.
3. Add scientific-publication ingestion: search, screen, extract taxon tables from PDFs, and merge them as a separately traceable source layer.
4. Add document retrieval from Decreto/EPJ PDFs to populate the Programas de Manejo drafting knowledge base.
5. Add a lightweight review UI for CONANP specialists to approve, reject, or annotate flagged records.
