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

const TAB_IDS = new Set(["dashboard", "species", "review", "traceability", "synonyms", "gis", "draft", "pipeline", "sources"]);
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
  const localData = await fetchJson("./src/data/pilotData.json");
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
    draft: draftView,
    pipeline: pipelineView,
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
      showToast(button.dataset.aiAction);
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
        </div>
        <div class="metric-strip">
          ${metric("Registros normalizados", number(scoped.source_records))}
          ${metric("Ocurrencias deduplicadas", number(scoped.deduped_occurrences))}
          ${metric("Taxa por ANP", number(scoped.unique_taxa))}
          ${metric("En cola de revisión", number(scoped.records_with_quality_flags), "warn")}
        </div>
      </section>
      <section class="anp-grid">
        ${state.data.summaryByAnp.map(anpTile).join("")}
      </section>
      <section class="module-strip">
        ${moduleJump("Trazabilidad", "Evidencia por archivo, fila, fuente y decision humana.", "traceability")}
        ${moduleJump("Sinónimos", "Homologación taxonómica con reemplazos aprobables.", "synonyms")}
        ${moduleJump("Validación GIS", "Congruencia contra polígono ANP y distribución.", "gis")}
        ${moduleJump("Borrador PM", "Texto técnico alimentado por datos trazables.", "draft")}
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
        <button class="primary-action" data-ai-action="Simulación: el borrador se genera con citas enlazadas y queda bloqueado hasta revisión técnica.">Generar sección</button>
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
          <button class="inline-action" data-tab-link="traceability">Ver trazabilidad</button>
          <button class="inline-action" data-tab-link="gis">Validar GIS</button>
        </aside>
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
      <div class="pipeline">${state.data.pipeline.map(pipelineStep).join("")}</div>
      <div class="future-row">${state.data.publicationLeads.map(leadCard).join("")}</div>
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
    button.addEventListener("click", () => showToast(button.dataset.aiAction));
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

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}
