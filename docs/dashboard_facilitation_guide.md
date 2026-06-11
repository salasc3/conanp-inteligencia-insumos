# Dashboard Facilitation Guide

Audience: CONANP group call with 25+ participants  
Goal: Explain what exists, what is simulated, what CONANP controls, and what the next operational pilot would require.

## One-Minute Setup

Open the dashboard and say:

"We are going to walk through a working mockup built from the files CONANP sent. The important thing is not the visual layer alone. Underneath, the data has been normalized into a traceable structure: source files, source systems, record IDs, row numbers, species names, flags, and review status. This is a foundation for reducing manual consolidation work while keeping scientific decisions in CONANP's hands."

## Recommended Screen-Share Order

| Time | Screen | What to show | Message |
| --- | --- | --- | --- |
| 0:00 | Dashboard | Top metrics and call strip | "This proves consolidation, not final scientific validation." |
| 2:00 | ANP cards | Click each ANP | "The same model works per protected area." |
| 4:00 | Species | Search and open a species drawer | "Each taxon keeps sources and traceability." |
| 7:00 | Review | Review queue cards | "Uncertainty becomes a work queue, not hidden risk." |
| 10:00 | Traceability | Demonstration taxon timeline | "A reviewer can see how evidence moves from file to decision." |
| 13:00 | Synonyms | Detect synonyms button | "Names can be proposed for authority matching without erasing originals." |
| 16:00 | GIS | Map mockup | "This is where official polygons and distribution checks enter." |
| 19:00 | Automation | Job lane and rules | "The system automates repetitive preparation and leaves approvals to people." |
| 22:00 | Pipeline | Value graph and pipeline | "This is how the project scales into literature ingestion and Program drafting." |
| 25:00 | Guide | SVG links and closing ask | "Here are the implementation pieces we need to move forward." |

## Dashboard Page Talking Points

- The top numbers are from the pilot data, not placeholders.
- The call strip is the executive summary: what is demonstrated, what remains human, what comes next.
- ANP cards help directors understand that this is repeatable by area, not a one-off spreadsheet exercise.

## Species Explorer Talking Points

- The search table is a working interface for a consolidated species index.
- The drawer is the important part: it shows source systems, record counts, traceability, taxonomy status, and review status.
- Do not present the species list as final. Present it as an auditable first consolidation.

## Review Queue Talking Points

- The review queue is the workforce value proposition.
- Instead of asking specialists to reconcile entire spreadsheets manually, the system gives them the records that need judgment.
- Simulated buttons show the intended future actions: validate, merge, or assign to a specialist.

## Traceability Talking Points

- This answers the question "where did this claim come from?"
- Every technical output should be able to link back to source file, row, source system, and citation when available.
- This is the best defense against black-box AI concerns.

## Synonyms Talking Points

- The pilot uses accepted names already present in sources.
- The next version should connect to taxonomic authorities such as GBIF, WoRMS, CONABIO/SNIB, and group-specific criteria.
- Original names should be preserved even when an accepted name is proposed.

## GIS Talking Points

- Current records have coordinates and ANP labels.
- The operational version needs official ANP polygons and agreed geographic validation rules.
- Suggested statuses: inside, near boundary, outside, uncertain, no coordinates.

## Automation Talking Points

- The purpose is not to automate final decisions.
- The purpose is to automate ingestion, normalization, duplicate grouping, flagging, and draft preparation.
- Every automation should produce a log and a review queue.

## Pipeline Talking Points

Use the value graph:

1. CONANP folder enters.
2. Ingestion classifies the contents.
3. Database consolidates species, records, sources, and flags.
4. Specialists review the uncertain parts.
5. Outputs become dashboards, reports, GIS packages, and draft Program text.

## SVG Visual Aids

Open these directly during the call if useful:

- `assets/diagrams/database_dashboard_logistics.svg`
- `assets/diagrams/database_architecture.svg`
- `assets/diagrams/workflow_pipeline.svg`
- `assets/diagrams/human_review_loop.svg`

## Strong Defensible Phrases

- "This is a review and traceability system, not an unsupervised decision system."
- "The AI prepares and prioritizes; CONANP approves."
- "We preserve the original record even when we propose a normalized value."
- "The first value is reducing manual consolidation. The second value is making every output defensible."
- "Uncertainty is not hidden. It is routed to the appropriate expert."

## Questions To Ask CONANP

1. Which taxonomic authorities should be considered official by biological group?
2. Can CONANP provide official ANP polygons and boundary rules?
3. Who should approve taxonomy, geography, citations, and final Program text?
4. Should the next pilot focus on all three ANPs or one deeper example?
5. Does CONANP prefer Supabase, an internal database, or another approved hosting environment?

## Closing

"The dashboard is meant to show the operating model. If CONANP agrees with the model, the next step is to connect official polygons, taxonomic authorities, and a review workflow so the pilot can move from demonstration to an operational tool."
