# CONANP Inteligencia de Insumos

Static deployment bundle for the CONANP AI consolidation pilot.

## Fastest Temporary Domain: GitHub Pages

1. In GitHub, open `Settings -> Pages`.
2. Under `Build and deployment`, choose `GitHub Actions`.
3. Push or re-run the included workflow: `.github/workflows/pages.yml`.
4. The site will publish to:

```text
https://salasc3.github.io/conanp-inteligencia-insumos/
```

This version runs entirely from `src/data/pilotData.json`, so it does not need npm, a build step, auth, or a backend.

## Local Preview

```bash
python3 -m http.server 5180 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:5180
```

## Optional Supabase Connection

The site can query Supabase through the browser using PostgREST.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Import the pilot CSVs into the matching tables.
4. Edit `config.js`:

```js
window.CONANP_CONFIG = {
  dataMode: "supabase",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

Keep `dataMode: "local"` for the packaged static demo.

## Tables Expected By Supabase Mode

- `summary_by_anp`
- `summary_by_source`
- `data_quality_summary`
- `source_inventory`
- `species_index`
- `normalized_occurrences`
- `publication_ingestion_leads`

## Demo Script

Start on the dashboard:

"CONANP sent a folder. The system normalized 181,528 records, deduplicated them into 78,511 representative occurrences, and built a species index across three ANPs."

Then show:

1. Species explorer: searchable taxa with source systems and traceability.
2. Review queue: staff focus on validation decisions instead of spreadsheet cleanup.
3. Dashboard call strip: what was demonstrated, what CONANP still decides, and what comes next.
4. AI pipeline: the value graph explains how source documents become a consolidated evidence base, review queue, and Program of Management outputs.
5. Feature modules: traceability, synonyms, GIS validation, automation, visualization, and draft Programa de Manejo.

## Call Prep

Use `docs/CONANP_call_briefing_2026-06-11.md` for likely questions, defensible answers, and the system/value explanation for CONANP.
