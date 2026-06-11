const ANP_ACCENTS = {
  APFFPD: "#0b8f82",
  PNAGMS: "#2f6fbd",
  RBBK: "#7a8b2c",
};

const SOURCE_COLORS = {
  SNIB: "#0f8a5f",
  GBIF: "#5e6f2b",
  OBIS: "#246a9f",
  Naturalista: "#c1792d",
};

const TAB_IDS = new Set(["dashboard", "species", "review", "traceability", "synonyms", "gis", "automation", "visuals", "draft", "pipeline", "downloads", "sources"]);
const initialTab = new URLSearchParams(window.location.search).get("tab");

const state = {
  data: null,
  connection: "Cargando datos...",
  tab: TAB_IDS.has(initialTab) ? initialTab : "dashboard",
  anp: "ALL",
  query: "",
  source: "ALL",
};

const app = document.getElementById("app");
const drawer = document.getElementById("drawer");
const toast = document.getElementById("toast");
const anpSelect = document.getElementById("anp-select");
const pipelineButton = document.getElementById("pipeline-button");
const connectionPill = document.getElementById("connection-pill");
const config = window.CONANP_CONFIG || {};

const TABLES = {
  summaryByAnp: "summary_by_anp",
  summaryBySource: "summary_by_source",
  qualityFlags: "data_quality_summary",
  sourceInventory: "source_inventory",
  speciesSample: "species_index",
  reviewQueue: "normalized_occurrences",
  publicationLeads: "publication_ingestion_leads",
};

loadPilotData()
  .then((data) => {
    state.data = data;
    state.connection = data.connectionLabel;
    connectionPill.textContent = state.connection;
    hydrateControls();
    render();
  })
  .catch((error) => {
    connectionPill.textContent = "Error de datos";
    app.innerHTML = `<main class="error-shell">Error cargando datos: ${escapeHtml(error.message)}</main>`;
  });

async function loadPilotData() {
  const [localData, downloads] = await Promise.all([
    fetchJson("./src/data/pilotData.json"),
    fetchJson("./src/data/downloadManifest.json").catch(() => []),
  ]);
  localData.downloads = downloads;
  const wantsSupabase = config.dataMode === "supabase";
  const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);

  if (!wantsSupabase) {
    return { ...localData, connectionLabel: "Datos locales del piloto" };
  }

  if (!hasSupabase) {
    return { ...localData, connectionLabel: "Supabase sin credenciales; usando local" };
  }

  const remote = await loadSupabaseData(localData);
  return { ...remote, connectionLabel: "Supabase conectado" };
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} respondió ${response.status}`);
  }
  return response.json();
}

async function loadSupabaseData(localData) {
  const [
    summaryByAnp,
    summaryBySource,
    qualityFlags,
    sourceInventory,
    speciesSample,
    reviewQueue,
    publicationLeads,
  ] = await Promise.all([
    supabaseTable("summaryByAnp", { order: "anp_code.asc" }),
    supabaseTable("summaryBySource", { order: "anp_code.asc,source_system.asc" }),
    supabaseTable("qualityFlags", { order: "affected_records.desc" }),
    supabaseTable("sourceInventory", { order: "anp_code.asc,file_name.asc" }),
    supabaseTable("speciesSample", { order: "source_record_count.desc", limit: 1200 }),
    supabaseTable("reviewQueue", {
      filter: "quality_flags=neq.",
      order: "anp_code.asc,source_system.asc",
      limit: 650,
    }),
    supabaseTable("publicationLeads", { order: "anp_code.asc" }),
  ]);

  return {
    ...localData,
    meta: {
      ...localData.meta,
      normalized_occurrences: sum(summaryByAnp, "source_records"),
      deduped_occurrences: sum(summaryByAnp, "deduped_occurrences"),
      unique_taxa: sum(summaryByAnp, "unique_taxa"),
      anp_count: new Set(summaryByAnp.map((row) => row.anp_code)).size,
    },
    summaryByAnp,
    summaryBySource,
    qualityFlags,
    sourceInventory,
    speciesSample,
    reviewQueue,
    publicationLeads,
  };
}

async function supabaseTable(key, options = {}) {
  const base = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${TABLES[key]}`;
  const params = new URLSearchParams({ select: "*" });
  if (options.order) params.set("order", options.order);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.filter) {
    const [field, expression] = options.filter.split("=");
    params.set(field, expression);
  }
  const response = await fetch(`${base}?${params.toString()}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase ${TABLES[key]} respondió ${response.status}`);
  }
  return response.json();
}

document.querySelectorAll(".rail-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    document.querySelectorAll(".rail-button").forEach((b) => b.classList.toggle("active", b === button));
    render();
  });
});

pipelineButton.addEventListener("click", () => {
  state.tab = state.tab === "pipeline" ? "review" : "pipeline";
  document.querySelectorAll(".rail-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.tab);
  });
  render();
});

function hydrateControls() {
  anpSelect.innerHTML = [
    `<option value="ALL">Todas las ANP</option>`,
    ...state.data.summaryByAnp.map((row) => `<option value="${row.anp_code}">${row.anp_code}</option>`),
  ].join("");
  anpSelect.addEventListener("change", (event) => {
    state.anp = event.target.value;
    render();
  });
}

function render() {
  syncRail();
  pipelineButton.textContent = state.tab === "pipeline" ? "Abrir revisión" : "Ver flujo IA";
  const views = {
    dashboard: dashboardView,
    species: speciesView,
    review: reviewView,
    traceability: traceabilityView,
    synonyms: synonymsView,
    gis: gisView,
    automation: automationView,
    visuals: visualsView,
    draft: draftView,
    pipeline: pipelineView,
    downloads: downloadsView,
    sources: sourcesView,
  };
  app.innerHTML = views[state.tab]();
  bindViewEvents();
}

function syncRail() {
  document.querySelectorAll(".rail-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.tab);
  });
}

function bindViewEvents() {
  const q = document.getElementById("species-query");
  if (q) {
    q.value = state.query;
    q.addEventListener("input", (event) => {
      state.query = event.target.value;
      render();
    });
  }
  const source = document.getElementById("source-filter");
  if (source) {
    source.value = state.source;
    source.addEventListener("change", (event) => {
      state.source = event.target.value;
      render();
    });
  }
  document.querySelectorAll("[data-select-anp]").forEach((button) => {
    button.addEventListener("click", () => {
      state.anp = button.dataset.selectAnp;
      anpSelect.value = state.anp;
      render();
    });
  });
  document.querySelectorAll("[data-species]").forEach((row) => {
    row.addEventListener("click", () => {
      const species = state.data.speciesSample.find((item) => item.species_uid === row.dataset.species);
      showDrawer(species);
    });
  });
  document.querySelectorAll("[data-tab-link]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tabLink;
      document.querySelectorAll(".rail-button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
      render();
    });
  });
  document.querySelectorAll("[data-ai-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      runAction(button);
    });
  });
  document.querySelectorAll("[data-generate-draft]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      generateDraftSection(button);
    });
  });
}

function dashboardView() {
  const anps = state.anp === "ALL"
    ? state.data.summaryByAnp
    : state.data.summaryByAnp.filter((row) => row.anp_code === state.anp);
  const scoped = anps.reduce(
    (acc, row) => ({
      source_records: acc.source_records + Number(row.source_records || 0),
      deduped_occurrences: acc.deduped_occurrences + Number(row.deduped_occurrences || 0),
      unique_taxa: acc.unique_taxa + Number(row.unique_taxa || 0),
      records_with_quality_flags: acc.records_with_quality_flags + Number(row.records_with_quality_flags || 0),
    }),
    { source_records: 0, deduped_occurrences: 0, unique_taxa: 0, records_with_quality_flags: 0 },
  );
  return `
    <div class="screen-grid">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">De carpeta dispersa a base trazable</p>
          <h2>Un sistema para consolidar, auditar y convertir insumos técnicos en inteligencia de manejo.</h2>
          <p class="hero-summary">La maqueta muestra cómo una carpeta de documentos y bases heterogéneas se convierte en una base consultable, una cola de revisión técnica y módulos futuros para taxonomía, GIS, literatura científica y borradores de Programa de Manejo.</p>
        </div>
        <div class="metric-strip">
          ${metric("Registros normalizados", number(scoped.source_records))}
          ${metric("Ocurrencias deduplicadas", number(scoped.deduped_occurrences))}
          ${metric("Taxa por ANP", number(scoped.unique_taxa))}
          ${metric("En cola de revisión", number(scoped.records_with_quality_flags), "warn")}
        </div>
      </section>
      <section class="call-strip">
        ${callCard("1. Qué ya se demostró", "181,528 registros normalizados, 78,511 ocurrencias deduplicadas y 12,693 taxa por ANP con trazabilidad a fuentes.")}
        ${callCard("2. Qué no decide la IA", "La IA prepara evidencia y propone agrupaciones; CONANP conserva la decisión técnica, taxonómica, geográfica y jurídica.")}
        ${callCard("3. Qué sigue", "Conectar polígonos oficiales, autoridades taxonómicas y extracción de publicaciones para pasar de maqueta a piloto operativo.")}
      </section>
      <section class="anp-grid">
        ${state.data.summaryByAnp.map(anpTile).join("")}
      </section>
      <section class="module-strip">
        ${moduleJump("Trazabilidad", "Evidencia por archivo, fila, fuente y decision humana.", "traceability")}
        ${moduleJump("Sinónimos", "Homologación taxonómica con reemplazos aprobables.", "synonyms")}
        ${moduleJump("Validación GIS", "Congruencia contra polígono ANP y distribución.", "gis")}
        ${moduleJump("Automatización", "Reglas, colas y validación por lotes.", "automation")}
        ${moduleJump("Visualización", "Cobertura, calidad y fuentes en una vista ejecutiva.", "visuals")}
        ${moduleJump("Borrador PM", "Texto técnico alimentado por datos trazables.", "draft")}
        ${moduleJump("Descargas", "PDF, Excel y CSV generados desde el flujo piloto.", "downloads")}
      </section>
      <section class="wide-panel">
        ${panelTitle("Fuentes integradas", "Explorar insumos", "sources")}
        <div class="source-stack">${state.data.summaryBySource.map(sourceRow).join("")}</div>
      </section>
      <section class="side-panel">
        ${panelTitle("Calidad de datos", "Cola", "review")}
        <div class="flag-list">
          ${state.data.qualityFlags.map((flag) => `
            <div class="flag-row">
              <span>${cleanFlag(flag.quality_flag)}</span>
              <strong>${number(flag.affected_records)}</strong>
            </div>
          `).join("")}
        </div>
      </section>
    </div>`;
}

function speciesView() {
  const species = filteredSpecies();
  return `
    <section class="table-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">Índice consolidado</p>
          <h2>Explorador de especies</h2>
        </div>
        <div class="filters">
          <label class="searchbox">
            <span>Buscar</span>
            <input id="species-query" placeholder="Taxón, familia, NOM-059..." />
          </label>
          <label class="selectbox">
            <span>Fuente</span>
            <select id="source-filter">
              <option value="ALL">Todas</option>
              <option value="SNIB">SNIB</option>
              <option value="GBIF">GBIF</option>
              <option value="OBIS">OBIS</option>
              <option value="Naturalista">Naturalista</option>
            </select>
          </label>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Taxón</th>
              <th>ANP</th>
              <th>Familia</th>
              <th>Fuentes</th>
              <th>Registros</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>${species.slice(0, 220).map(speciesRow).join("")}</tbody>
        </table>
      </div>
      <p class="table-note">Mostrando ${number(Math.min(species.length, 220))} de ${number(species.length)} filas cargadas para el prototipo.</p>
    </section>`;
}

function reviewView() {
  const records = state.data.reviewQueue.filter((row) => state.anp === "ALL" || row.anp_code === state.anp);
  return `
    <section class="review-screen">
      <div class="section-head">
        <div>
          <h2>Cola de revisión asistida</h2>
        </div>
        <div class="queue-count">${number(records.length)} casos visibles</div>
      </div>
      <div class="review-grid">${records.slice(0, 120).map(reviewCard).join("")}</div>
    </section>`;
}

function traceabilityView() {
  const species = representativeSpecies();
  const anp = anpSummary(species.anp_code);
  const sources = String(species.source_systems || "SNIB; GBIF; Naturalista").split("; ").filter(Boolean);
  const sourceRows = state.data.summaryBySource
    .filter((row) => row.anp_code === species.anp_code && sources.includes(row.source_system))
    .slice(0, 4);
  const steps = [
    ["01", "Insumo recibido", "Archivo original identificado dentro de la carpeta enviada por CONANP.", "Completo"],
    ["02", "Registro normalizado", "Columnas heterogéneas traducidas a un modelo común de ocurrencias.", "Completo"],
    ["03", "Taxón consolidado", "Registros agrupados por ANP, nombre aceptado, fuente y evidencia disponible.", "Completo"],
    ["04", "Cita preservada", "La ruta de archivo, fuente, identificador y cita quedan disponibles para auditoría.", "Completo"],
    ["05", "Decisión especialista", "Pendiente de validación taxonómica y geográfica por el área técnica.", "Pendiente"],
  ];

  return `
    <section class="module-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">Evidencia auditable</p>
          <h2>Línea de trazabilidad</h2>
        </div>
        ${badge(species.anp_code, species.anp_code)}
      </div>
      <div class="trace-layout">
        <article class="specimen-panel">
          <span class="panel-kicker">Taxón de demostración</span>
          <h3 class="latin">${escapeHtml(displayTaxonName(species.accepted_scientific_name))}</h3>
          <dl>
            ${detail("ANP", anp ? anp.anp_name : species.anp_name)}
            ${detail("Familia", species.family || "Sin dato")}
            ${detail("Fuentes", species.source_systems || "Sin dato")}
            ${detail("Registros fuente", number(species.source_record_count))}
            ${detail("Ocurrencias deduplicadas", number(species.deduped_occurrence_count))}
          </dl>
          <button class="inline-action" data-tab-link="species">Abrir explorador</button>
        </article>
        <div class="trace-timeline">
          ${steps.map(traceStep).join("")}
        </div>
      </div>
      <div class="evidence-grid">
        ${sourceRows.map((row) => evidenceCard(row, species)).join("")}
      </div>
    </section>`;
}

function synonymsView() {
  const species = presentableSpeciesRows().slice(0, 4);
  const cases = species.map((row, index) => ({
    accepted: row.accepted_scientific_name || "Taxón pendiente",
    oldName: synonymVariant(row.accepted_scientific_name, index),
    authority: index % 2 === 0 ? "GBIF Backbone / revisión especialista" : "WoRMS / criterio CONABIO",
    affected: Math.max(2, Math.round(Number(row.source_record_count || 4) / 18)),
    status: index === 0 ? "Listo para aprobar" : index === 1 ? "Conflicto de autoridad" : "Pendiente especialista",
  }));

  return `
    <section class="module-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">Homologación taxonómica</p>
          <h2>Resolución de sinónimos</h2>
        </div>
        <button class="primary-action" data-ai-action="Simulación: se consultan autoridades taxonómicas y se genera un script de reemplazos reversible.">Detectar sinónimos</button>
      </div>
      <div class="synonym-board">
        ${cases.map(synonymCard).join("")}
      </div>
      <article class="script-panel">
        <div>
          <span class="panel-kicker">Script reversible propuesto</span>
          <h3>Homologar nomenclatura sin borrar la versión original</h3>
        </div>
        <pre><code>${escapeHtml(`for each mention where scientific_name in synonym_set:
  keep original_name
  set accepted_name = authority.accepted_name
  attach authority_source
  mark status = "requires_specialist_approval"`)}</code></pre>
      </article>
    </section>`;
}

function gisView() {
  const anp = state.anp === "ALL"
    ? [...state.data.summaryByAnp].sort((a, b) => Number(b.records_with_quality_flags || 0) - Number(a.records_with_quality_flags || 0))[0]
    : anpSummary(state.anp);
  const scopedRecords = state.data.reviewQueue.filter((row) => row.anp_code === anp.anp_code);
  const records = (scopedRecords.length >= 4 ? scopedRecords : state.data.reviewQueue).slice(0, 7);
  const inside = Math.max(0, Number(anp.records_with_coordinates || 0) - Number(anp.records_with_quality_flags || 0));
  const review = Number(anp.records_with_quality_flags || 0);

  return `
    <section class="module-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">Validación espacial</p>
          <h2>Congruencia GIS y biogeográfica</h2>
        </div>
        ${badge(anp.anp_code, anp.anp_code)}
      </div>
      <div class="gis-layout">
        <article class="map-panel" style="--accent:${ANP_ACCENTS[anp.anp_code] || "#0b6b55"}">
          <div class="anp-shape"></div>
          ${records.map((record, index) => `<span class="map-point p${index + 1}" title="${escapeHtml(record.source_system || "")}"></span>`).join("")}
          <div class="map-legend">
            <span><i class="inside"></i> Dentro / congruente</span>
            <span><i class="review"></i> Revisar</span>
          </div>
        </article>
        <div class="validation-panel">
          ${metric("Con coordenadas", number(anp.records_with_coordinates))}
          ${metric("Congruencia inicial", number(inside))}
          ${metric("Requieren revisión", number(review), "warn")}
          ${metric("Especialista asignado", "Alejandro Rendón")}
        </div>
      </div>
      <div class="review-grid compact">${records.map(gisCaseCard).join("")}</div>
    </section>`;
}

function draftView() {
  const anp = state.anp === "ALL" ? state.data.summaryByAnp[2] : anpSummary(state.anp);
  const species = presentableSpeciesRows(anp.anp_code).slice(0, 6);

  return `
    <section class="module-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">Programa de Manejo</p>
          <h2>Vista previa de borrador asistido</h2>
        </div>
        <button class="primary-action" data-generate-draft>Generar sección</button>
      </div>
      <div class="draft-layout">
        <article class="draft-page">
          <span class="panel-kicker">Borrador técnico / biodiversidad</span>
          <h3>${escapeHtml(anp.anp_name)}</h3>
          <p>La base consolidada integra ${number(anp.source_records)} registros de biodiversidad y ${number(anp.unique_taxa)} taxa únicos para apoyar la elaboración del capítulo de biodiversidad del Programa de Manejo.</p>
          <p>La información proviene de fuentes normalizadas como ${escapeHtml(sourceListForAnp(anp.anp_code))}. Cada afirmación conserva trazabilidad hacia archivo, fila, fuente y cita disponible.</p>
          <h4>Taxa de referencia para revisión</h4>
          <ul>
            ${species.map((row) => `<li><span class="latin">${escapeHtml(displayTaxonName(row.accepted_scientific_name))}</span> · ${escapeHtml(row.family || "Sin familia")} · ${number(row.source_record_count)} registros</li>`).join("")}
          </ul>
        </article>
        <aside class="draft-controls">
          ${draftControl("Citas enlazadas", "Activo", "ok")}
          ${draftControl("Nomenclatura", "Pendiente especialista", "warn")}
          ${draftControl("Distribución geográfica", "Pendiente GIS", "warn")}
          ${draftControl("Jurídico", "No iniciado", "default")}
          <a class="inline-action download-cta" href="assets/downloads/programa_manejo_borrador_preview.pdf" target="_blank" rel="noreferrer" download>Ver PDF de vista previa</a>
          <button class="inline-action" data-tab-link="downloads">Ver descargas</button>
          <button class="inline-action" data-tab-link="traceability">Ver trazabilidad</button>
          <button class="inline-action" data-tab-link="gis">Validar GIS</button>
        </aside>
      </div>
      <section class="draft-generated-output" id="draft-generated-output" hidden>
        <div class="section-head">
          <div>
            <p class="eyebrow">Salida generada</p>
            <h2>PDF de vista previa</h2>
          </div>
          <div class="download-actions">
            <a class="primary-action" href="assets/downloads/programa_manejo_borrador_preview.pdf" target="_blank" rel="noreferrer">Abrir PDF</a>
            <a class="inline-action download-cta" href="assets/downloads/programa_manejo_borrador_preview.pdf" download>Descargar PDF</a>
          </div>
        </div>
        <iframe class="pdf-preview" src="assets/downloads/programa_manejo_borrador_preview.pdf" title="Vista previa PDF del borrador asistido de Programa de Manejo"></iframe>
      </section>
    </section>`;
}

function automationView() {
  const anps = state.anp === "ALL" ? state.data.summaryByAnp : state.data.summaryByAnp.filter((row) => row.anp_code === state.anp);
  const scoped = anps.reduce(
    (acc, row) => ({
      records: acc.records + Number(row.source_records || 0),
      review: acc.review + Number(row.records_with_quality_flags || 0),
      taxa: acc.taxa + Number(row.unique_taxa || 0),
    }),
    { records: 0, review: 0, taxa: 0 },
  );
  const jobs = automationJobs(scoped);

  return `
    <section class="module-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">De tarea manual a flujo operativo</p>
          <h2>Workbench de automatización</h2>
        </div>
        <button class="primary-action" data-ai-action="Simulación: se ejecuta un lote de normalización, validación y generación de salidas con bitácora auditable.">Ejecutar lote</button>
      </div>
      <div class="automation-hero">
        ${metric("Registros que entran al flujo", number(scoped.records))}
        ${metric("Taxa consolidados", number(scoped.taxa))}
        ${metric("Casos enviados a revisión", number(scoped.review), "warn")}
        ${metric("Tiempo técnico estimado", "3 sem → 1-2 días")}
      </div>
      <div class="automation-layout">
        <div class="job-lane">
          ${jobs.map(jobCard).join("")}
        </div>
        <aside class="rules-panel">
          <span class="panel-kicker">Reglas automatizadas</span>
          <h3>Validar antes de redactar</h3>
          ${ruleRow("Duplicados", "Agrupar registros por ANP, taxón, coordenada, fecha y fuente.", "Activo")}
          ${ruleRow("Taxonomía", "Consultar autoridad, preservar nombre original y pedir aprobación.", "Borrador")}
          ${ruleRow("Geografía", "Cruzar ocurrencias contra polígono y distribución esperada.", "Borrador")}
          ${ruleRow("Citas", "Bloquear salidas sin fuente, archivo o identificador trazable.", "Activo")}
          <button class="inline-action" data-tab-link="review">Abrir cola humana</button>
        </aside>
      </div>
    </section>`;
}

function visualsView() {
  const anps = state.data.summaryByAnp;
  const sources = aggregateSources();
  const flags = state.data.qualityFlags.filter((flag) => Number(flag.affected_records || 0) > 0);

  return `
    <section class="module-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">Visualización para decidir</p>
          <h2>Mapa operativo de datos</h2>
        </div>
        <button class="primary-action" data-ai-action="Simulación: se exportaría un paquete ejecutivo con gráficos, tablas y observaciones para dirección.">Exportar reporte</button>
      </div>
      <div class="visual-grid">
        <article class="chart-panel span-2">
          <span class="panel-kicker">Cobertura por ANP</span>
          <h3>Registros, taxa y revisión pendiente</h3>
          <div class="bar-matrix">
            ${anps.map(anpChartRow).join("")}
          </div>
        </article>
        <article class="chart-panel">
          <span class="panel-kicker">Fuentes</span>
          <h3>Composición integrada</h3>
          <div class="donut-wrap">
            <div class="donut-chart" style="${donutStyle(sources)}"></div>
            <div class="donut-legend">${sources.map((row) => `<span><i style="background:${SOURCE_COLORS[row.source] || "#777"}"></i>${escapeHtml(row.source)} · ${number(row.records)}</span>`).join("")}</div>
          </div>
        </article>
        <article class="chart-panel">
          <span class="panel-kicker">Riesgo de calidad</span>
          <h3>Principales alertas</h3>
          <div class="risk-list">${flags.slice(0, 5).map(flagRiskRow).join("")}</div>
        </article>
      </div>
      <div class="insight-strip">
        ${insightCard("Dónde automatiza", "Normaliza fuentes, detecta duplicados, prepara validaciones y genera salidas iniciales.")}
        ${insightCard("Dónde decide CONANP", "Autoridades taxonómicas, congruencia geográfica, criterios jurídicos y publicación final.")}
        ${insightCard("Qué se visualiza", "Cobertura por ANP, fuentes dominantes, cuellos de botella y trazabilidad pendiente.")}
      </div>
    </section>`;
}

function pipelineView() {
  return `
    <section class="pipeline-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">La historia para dirección</p>
          <h2>Flujo de IA propuesto</h2>
        </div>
      </div>
      ${valueGraph()}
      <div class="pipeline">${state.data.pipeline.map(pipelineStep).join("")}</div>
      <div class="future-row">${state.data.publicationLeads.map(leadCard).join("")}</div>
    </section>`;
}

function downloadsView() {
  const downloads = state.data.downloads || [];
  const featured = downloads.find((item) => item.format === "PDF") || downloads[0];
  return `
    <section class="downloads-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">Salidas generadas por el flujo piloto</p>
          <h2>Centro de descargas</h2>
        </div>
        ${featured ? `<a class="primary-action" href="${escapeHtml(featured.file)}" target="_blank" rel="noreferrer" download>Abrir PDF de borrador</a>` : ""}
      </div>
      <div class="download-note">
        <strong>Nota operativa</strong>
        <p>Estos archivos son salidas ligeras para revisión y demostración. Las exportaciones pesadas de ocurrencias normalizadas, ocurrencias deduplicadas y la base SQLite completa deben salir desde Supabase o un proceso de exportación autenticado, no desde GitHub Pages.</p>
      </div>
      <div class="downloads-grid">
        ${downloads.map(downloadCard).join("")}
      </div>
    </section>`;
}

function sourcesView() {
  return `
    <section class="sources-screen">
      <div class="section-head">
        <div>
          <p class="eyebrow">Inventario de evidencia</p>
          <h2>Insumos procesados</h2>
        </div>
      </div>
      <div class="inventory-grid">${state.data.sourceInventory.map(inventoryCard).join("")}</div>
    </section>`;
}

function downloadCard(item) {
  return `
    <article class="download-card">
      <div class="download-topline">
        ${badge(item.format, item.format === "PDF" ? "warn" : "ok")}
        <span>${escapeHtml(item.category || "Salida")}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="download-meta">
        <span>${formatBytes(item.sizeBytes)}</span>
        <a href="${escapeHtml(item.file)}" target="_blank" rel="noreferrer" download>Descargar</a>
      </div>
    </article>`;
}

function speciesForCurrentAnp() {
  const rows = state.data.speciesSample.filter((row) => state.anp === "ALL" || row.anp_code === state.anp);
  return rows.length ? rows : state.data.speciesSample;
}

function presentableSpeciesRows(anpCode = null) {
  const rows = state.data.speciesSample.filter((row) => {
    const inAnp = anpCode ? row.anp_code === anpCode : state.anp === "ALL" || row.anp_code === state.anp;
    const name = displayTaxonName(row.accepted_scientific_name);
    return inAnp && name.split(" ").length >= 2 && row.family;
  });
  return rows.length ? rows : speciesForCurrentAnp();
}

function representativeSpecies() {
  return presentableSpeciesRows().find((row) => Number(row.source_record_count || 0) > 20) || speciesForCurrentAnp()[0];
}

function anpSummary(anpCode) {
  return state.data.summaryByAnp.find((row) => row.anp_code === anpCode);
}

function filteredSpecies() {
  const q = state.query.trim().toLowerCase();
  return state.data.speciesSample.filter((row) => {
    const inAnp = state.anp === "ALL" || row.anp_code === state.anp;
    const inSource = state.source === "ALL" || String(row.source_systems || "").includes(state.source);
    const inSearch = !q || [
      row.accepted_scientific_name,
      row.family,
      row.kingdom,
      row.nom059,
      row.iucn,
      row.quality_flags,
    ].join(" ").toLowerCase().includes(q);
    return inAnp && inSource && inSearch;
  });
}

function anpTile(anp) {
  const selected = state.anp === anp.anp_code ? " selected" : "";
  return `
    <button class="anp-tile${selected}" data-select-anp="${anp.anp_code}" style="--accent:${ANP_ACCENTS[anp.anp_code]}">
      <div class="tile-head"><span>${anp.anp_code}</span><span>→</span></div>
      <h3>${escapeHtml(anp.anp_name)}</h3>
      <div class="tile-bars">
        ${progress("Deduplicado", anp.deduped_occurrences, anp.source_records)}
        ${progress("Taxa", anp.unique_taxa, state.data.meta.unique_taxa)}
      </div>
      <div class="tile-stats">
        <span>${number(anp.source_records)} registros</span>
        <span>${number(anp.unique_taxa)} taxa</span>
      </div>
    </button>`;
}

function speciesRow(row) {
  return `
    <tr data-species="${row.species_uid}">
      <td>
        <strong class="latin">${escapeHtml(displayTaxonName(row.accepted_scientific_name))}</strong>
        <span>${escapeHtml(row.kingdom || "sin reino")} / ${escapeHtml(row.class_name || "sin clase")}</span>
      </td>
      <td>${badge(row.anp_code, row.anp_code)}</td>
      <td>${escapeHtml(row.family || "Sin familia")}</td>
      <td>${sourcePills(row.source_systems)}</td>
      <td>${number(row.source_record_count)}</td>
      <td>${row.quality_flags ? badge("Revisar", "warn") : badge("Trazable", "ok")}</td>
    </tr>`;
}

function reviewCard(record) {
  const flags = String(record.quality_flags || "").split("; ").filter(Boolean).slice(0, 3);
  return `
    <article class="review-card">
      <div class="review-topline">
        ${badge(record.anp_code, record.anp_code)}
        <span>${escapeHtml(record.source_system || "")}</span>
      </div>
      <h3>${escapeHtml(displayTaxonName(record.accepted_scientific_name || record.scientific_name_raw || "Taxón no resuelto"))}</h3>
      <p>${escapeHtml(record.locality || "Sin localidad textual")} · ${escapeHtml(record.event_year || "sin año")}</p>
      <div class="flag-cloud">${flags.map((flag) => `<span>${cleanFlag(flag)}</span>`).join("")}</div>
      <div class="review-actions">
        <button data-ai-action="Validación registrada en la maqueta. En producción guardaría decisión, usuario y justificación.">Validar</button>
        <button data-ai-action="Fusión simulada. El sistema agruparía evidencia duplicada sin borrar la trazabilidad original.">Fusionar</button>
        <button data-ai-action="Derivación simulada. El caso quedaría asignado a un especialista taxonómico o regional.">Enviar a especialista</button>
      </div>
    </article>`;
}

function moduleJump(title, detailText, tab) {
  return `
    <button class="module-jump" data-tab-link="${tab}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(detailText)}</strong>
    </button>`;
}

function callCard(title, detailText) {
  return `
    <article class="call-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(detailText)}</p>
    </article>`;
}

function valueGraph() {
  const nodes = [
    ["Carpeta CONANP", "Decretos, EPJ, SIG, economía y biodiversidad"],
    ["Capa de ingesta", "Lectura, clasificación y extracción"],
    ["Base consolidada", "Ocurrencias, especies, fuentes y calidad"],
    ["Revisión humana", "Taxonomía, GIS, criterios técnicos"],
    ["Salidas", "Tablero, reportes y borrador de Programa"],
  ];
  return `
    <div class="value-graph">
      ${nodes.map((node, index) => `
        <article class="value-node">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(node[0])}</strong>
          <p>${escapeHtml(node[1])}</p>
        </article>
        ${index < nodes.length - 1 ? `<b class="value-arrow">→</b>` : ""}
      `).join("")}
    </div>`;
}

function traceStep(step) {
  return `
    <article class="trace-step">
      <span>${escapeHtml(step[0])}</span>
      <div>
        <h3>${escapeHtml(step[1])}</h3>
        <p>${escapeHtml(step[2])}</p>
      </div>
      ${badge(step[3], step[3] === "Completo" ? "ok" : "warn")}
    </article>`;
}

function evidenceCard(row, species) {
  return `
    <article class="evidence-card">
      <div>
        ${badge(row.source_system, row.source_system)}
        <span>${number(row.source_records)} registros fuente</span>
      </div>
      <h3>${escapeHtml(shortPath(row.source_file))}</h3>
      <p>Soporta <span class="latin">${escapeHtml(displayTaxonName(species.accepted_scientific_name))}</span> dentro del índice consolidado. En producción abriría archivo, fila, cita y registro original.</p>
    </article>`;
}

function synonymCard(item) {
  return `
    <article class="synonym-card">
      <div class="synonym-flow">
        <div>
          <span>Nombre encontrado</span>
          <strong class="latin">${escapeHtml(item.oldName)}</strong>
        </div>
        <b>→</b>
        <div>
          <span>Nombre aceptado</span>
          <strong class="latin">${escapeHtml(displayTaxonName(item.accepted))}</strong>
        </div>
      </div>
      <dl>
        ${detail("Autoridad", item.authority)}
        ${detail("Menciones afectadas", number(item.affected))}
        ${detail("Estado", item.status)}
      </dl>
      <button class="inline-action" data-ai-action="Simulación: reemplazo preparado, conservando nombre original y fuente para auditoría.">Preparar reemplazo</button>
    </article>`;
}

function gisCaseCard(record) {
  const flags = String(record.quality_flags || "").split("; ").filter(Boolean).slice(0, 2);
  return `
    <article class="review-card">
      <div class="review-topline">
        ${badge(record.source_system || "Fuente", record.anp_code)}
        <span>${escapeHtml(record.event_year || "sin año")}</span>
      </div>
      <h3>${escapeHtml(displayTaxonName(record.accepted_scientific_name || record.scientific_name_raw || "Taxón por resolver"))}</h3>
      <p>${escapeHtml(record.locality || "Sin localidad textual")}</p>
      <div class="coord-pair">
        <span>${escapeHtml(record.latitude || "s/lat")}</span>
        <span>${escapeHtml(record.longitude || "s/lon")}</span>
      </div>
      <div class="flag-cloud">${flags.map((flag) => `<span>${cleanFlag(flag)}</span>`).join("")}</div>
    </article>`;
}

function draftControl(label, value, tone) {
  return `
    <div class="draft-control">
      <span>${escapeHtml(label)}</span>
      ${badge(value, tone)}
    </div>`;
}

function automationJobs(scoped) {
  return [
    {
      step: "01",
      title: "Ingesta de carpeta",
      detail: "Detectar decretos, EPJ, SIG, economía/demografía y bases de biodiversidad.",
      status: "Automatizado",
      progress: 100,
    },
    {
      step: "02",
      title: "Normalización de esquemas",
      detail: `${number(scoped.records)} registros traducidos a un modelo común sin perder fuente original.`,
      status: "Automatizado",
      progress: 100,
    },
    {
      step: "03",
      title: "Validación taxonómica",
      detail: "Resolver sinónimos y conservar nombre histórico como evidencia.",
      status: "Humano aprueba",
      progress: 58,
    },
    {
      step: "04",
      title: "Validación GIS",
      detail: "Cruzar coordenadas contra polígono y distribución biogeográfica.",
      status: "Humano aprueba",
      progress: 44,
    },
    {
      step: "05",
      title: "Salida técnica",
      detail: "Generar matriz, cola de revisión, visualización y borrador inicial.",
      status: "Listo para revisión",
      progress: 72,
    },
  ];
}

function jobCard(job) {
  return `
    <article class="job-card">
      <span class="step-index">${escapeHtml(job.step)}</span>
      <div>
        <h3>${escapeHtml(job.title)}</h3>
        <p>${escapeHtml(job.detail)}</p>
        ${progress(job.status, job.progress, 100)}
      </div>
      ${badge(job.status, job.status === "Automatizado" ? "ok" : "warn")}
    </article>`;
}

function ruleRow(title, detailText, status) {
  return `
    <div class="rule-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(detailText)}</span>
      </div>
      ${badge(status, status === "Activo" ? "ok" : "warn")}
    </div>`;
}

function aggregateSources() {
  const totals = new Map();
  state.data.summaryBySource.forEach((row) => {
    totals.set(row.source_system, (totals.get(row.source_system) || 0) + Number(row.source_records || 0));
  });
  return [...totals.entries()]
    .map(([source, records]) => ({ source, records }))
    .sort((a, b) => b.records - a.records);
}

function anpChartRow(anp) {
  const maxRecords = Math.max(...state.data.summaryByAnp.map((row) => Number(row.source_records || 0)));
  const maxTaxa = Math.max(...state.data.summaryByAnp.map((row) => Number(row.unique_taxa || 0)));
  return `
    <div class="chart-row" style="--accent:${ANP_ACCENTS[anp.anp_code] || "#0b6b55"}">
      <strong>${escapeHtml(anp.anp_code)}</strong>
      <div>
        ${miniBar("Registros", anp.source_records, maxRecords)}
        ${miniBar("Taxa", anp.unique_taxa, maxTaxa)}
        ${miniBar("Revisión", anp.records_with_quality_flags, anp.source_records, "warn")}
      </div>
    </div>`;
}

function miniBar(label, value, max, tone = "") {
  const pct = percent(value, max);
  return `
    <div class="mini-bar ${tone}">
      <span>${escapeHtml(label)}</span>
      <div><i style="width:${pct}"></i></div>
      <strong>${number(value)}</strong>
    </div>`;
}

function donutStyle(sources) {
  const total = sources.reduce((acc, row) => acc + row.records, 0) || 1;
  let cursor = 0;
  const segments = sources.map((row) => {
    const start = cursor;
    cursor += (row.records / total) * 100;
    return `${SOURCE_COLORS[row.source] || "#777"} ${start}% ${cursor}%`;
  });
  return `background: conic-gradient(${segments.join(", ")});`;
}

function flagRiskRow(flag) {
  const max = Math.max(...state.data.qualityFlags.map((row) => Number(row.affected_records || 0)));
  return `
    <div class="risk-row">
      <div>
        <strong>${cleanFlag(flag.quality_flag)}</strong>
        <span>${escapeHtml(flag.affected_anps || "sin ANP")}</span>
      </div>
      ${miniBar("Casos", flag.affected_records, max, "warn")}
    </div>`;
}

function insightCard(title, detailText) {
  return `
    <article class="insight-card">
      <span class="panel-kicker">${escapeHtml(title)}</span>
      <p>${escapeHtml(detailText)}</p>
    </article>`;
}

function pipelineStep(step, index) {
  return `
    <article class="pipeline-step ${step.status}">
      <span class="step-index">${String(index + 1).padStart(2, "0")}</span>
      <div>
        <h3>${escapeHtml(step.step)}</h3>
        <p>${escapeHtml(step.detail)}</p>
      </div>
      <span>${step.status === "complete" ? "✓" : "✦"}</span>
    </article>`;
}

function leadCard(lead) {
  return `
    <article class="lead-card">
      <span>${escapeHtml(lead.anp_code)}</span>
      <h3>${escapeHtml(lead.title)}</h3>
      <p>${escapeHtml(lead.use_in_pilot)}</p>
    </article>`;
}

function inventoryCard(file) {
  return `
    <article class="inventory-card">
      <div>
        ${badge(file.anp_code, file.anp_code)}
        <span class="file-type">${escapeHtml(file.file_type)}</span>
      </div>
      <h3>${escapeHtml(file.file_name)}</h3>
      <p>${escapeHtml(String(file.role || "").replaceAll("_", " "))}</p>
      <small>${escapeHtml(shortPath(file.path))}</small>
    </article>`;
}

function sourceRow(row) {
  const color = SOURCE_COLORS[row.source_system] || "#777";
  return `
    <div class="source-row" style="--source:${color}">
      <div>
        <strong>${escapeHtml(row.source_system)}</strong>
        <span>${escapeHtml(row.anp_code)} · ${escapeHtml(shortPath(row.source_file))}</span>
      </div>
      <div class="source-numbers">
        <span>${number(row.source_records)} registros</span>
        <span>${number(row.unique_taxa)} taxa</span>
      </div>
    </div>`;
}

function synonymVariant(name = "", index = 0) {
  const cleaned = displayTaxonName(name);
  const parts = String(cleaned || "Taxon pendiente").split(" ").filter(Boolean);
  if (parts.length < 2) return `${name || "Taxon pendiente"} sensu lato`;
  const suffixes = ["auct.", "syn. nov.", "var. regional", "sensu CONABIO"];
  return `${parts[0]} ${parts[1]} ${suffixes[index % suffixes.length]}`;
}

function sourceListForAnp(anpCode) {
  const sources = [...new Set(state.data.summaryBySource
    .filter((row) => row.anp_code === anpCode)
    .map((row) => row.source_system))];
  return sources.join(", ");
}

function displayTaxonName(name = "") {
  const parts = String(name || "Taxón pendiente").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts.slice(1).join(" ");
  }
  return parts.join(" ") || "Taxón pendiente";
}

function showDrawer(species) {
  drawer.hidden = false;
  drawer.innerHTML = `
    <button class="drawer-close" id="drawer-close">×</button>
    ${badge(species.anp_code, species.anp_code)}
    <h2 class="latin">${escapeHtml(displayTaxonName(species.accepted_scientific_name))}</h2>
    <dl>
      ${detail("Familia", species.family || "Sin dato")}
      ${detail("Fuentes", species.source_systems || "Sin dato")}
      ${detail("Registros fuente", number(species.source_record_count))}
      ${detail("Ocurrencias deduplicadas", number(species.deduped_occurrence_count))}
      ${detail("Taxonomía", species.taxonomic_resolution_status)}
      ${detail("Trazabilidad", species.traceability_status)}
      ${detail("NOM-059", species.nom059 || "Sin marca en fuentes")}
      ${detail("IUCN", species.iucn || "Sin marca en fuentes")}
    </dl>
    <div class="drawer-ai">
      <span>✦</span>
      <div>
        <strong>Acción simulada</strong>
        <p>Explicar conflicto taxonómico, comparar autoridades y proponer decisión con evidencia.</p>
        <button data-ai-action="Explicación simulada: aquí aparecería el razonamiento con fuentes, autoridad taxonómica y recomendación.">Generar explicación</button>
      </div>
    </div>`;
  document.getElementById("drawer-close").addEventListener("click", () => {
    drawer.hidden = true;
  });
  drawer.querySelectorAll("[data-ai-action]").forEach((button) => {
    button.addEventListener("click", () => runAction(button));
  });
}

function panelTitle(title, action, tab) {
  return `
    <div class="panel-title">
      <h2>${title}</h2>
      <button data-tab-link="${tab}">${action}</button>
    </div>`;
}

function metric(label, value, tone = "") {
  return `<div class="metric ${tone}"><strong>${value}</strong><span>${label}</span></div>`;
}

function progress(label, value, total) {
  const pct = percent(value, total);
  return `
    <div class="progress-row">
      <div><span>${label}</span><strong>${pct}</strong></div>
      <div class="progress-track"><span style="width:${pct}"></span></div>
    </div>`;
}

function sourcePills(sources = "") {
  return `
    <div class="source-pills">
      ${String(sources).split("; ").filter(Boolean).map((source) => (
        `<span style="--source:${SOURCE_COLORS[source] || "#777"}">${escapeHtml(source)}</span>`
      )).join("")}
    </div>`;
}

function badge(text, tone = "default") {
  return `<span class="badge tone-${tone}">${escapeHtml(text)}</span>`;
}

function detail(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function number(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function percent(value, total) {
  if (!Number(total)) return "0%";
  return `${Math.round((Number(value || 0) / Number(total)) * 100)}%`;
}

function cleanFlag(flag = "") {
  return escapeHtml(String(flag).replaceAll("_", " "));
}

function shortPath(path = "") {
  return String(path).replace("Insumos/", "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function runAction(button) {
  const message = button.dataset.aiAction;
  button.classList.add("action-running");
  button.disabled = true;
  showToast(message, "Procesando acción simulada");
  clearTimeout(button.actionTimeout);
  button.actionTimeout = setTimeout(() => {
    button.classList.remove("action-running");
    button.classList.add("action-complete");
    button.disabled = false;
    showToast("Listo. La maqueta registró la acción, conservó trazabilidad y dejó una decisión pendiente para revisión humana.", "Resultado generado");
    setTimeout(() => button.classList.remove("action-complete"), 1800);
  }, 1350);
}

function generateDraftSection(button) {
  button.classList.add("action-running");
  button.disabled = true;
  button.textContent = "Generando...";
  showToast("Preparando PDF con resumen de biodiversidad, taxa de referencia y controles de trazabilidad.", "Generando sección");
  clearTimeout(button.actionTimeout);
  button.actionTimeout = setTimeout(() => {
    const output = document.getElementById("draft-generated-output");
    if (output) {
      output.hidden = false;
      output.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    button.classList.remove("action-running");
    button.classList.add("action-complete");
    button.disabled = false;
    button.textContent = "Sección generada";
    showToast("PDF listo. La vista previa quedó abierta en el tablero y puede descargarse.", "Resultado generado");
    setTimeout(() => button.classList.remove("action-complete"), 1800);
  }, 1050);
}

function showToast(message, title = "Acción simulada") {
  toast.innerHTML = `
    <strong class="toast-title">${escapeHtml(title)}</strong>
    <span>${escapeHtml(message)}</span>
    <div class="action-steps" aria-hidden="true">
      <i></i><i></i><i></i>
    </div>`;
  toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}
