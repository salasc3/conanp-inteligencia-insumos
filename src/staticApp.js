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

const state = {
  data: null,
  connection: "Cargando datos...",
  tab: "dashboard",
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
  pipelineButton.textContent = state.tab === "pipeline" ? "Abrir revisión" : "Ver flujo IA";
  const views = {
    dashboard: dashboardView,
    species: speciesView,
    review: reviewView,
    pipeline: pipelineView,
    sources: sourcesView,
  };
  app.innerHTML = views[state.tab]();
  bindViewEvents();
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
        <strong class="latin">${escapeHtml(row.accepted_scientific_name || "Taxón pendiente")}</strong>
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
      <h3>${escapeHtml(record.accepted_scientific_name || record.scientific_name_raw || "Taxón no resuelto")}</h3>
      <p>${escapeHtml(record.locality || "Sin localidad textual")} · ${escapeHtml(record.event_year || "sin año")}</p>
      <div class="flag-cloud">${flags.map((flag) => `<span>${cleanFlag(flag)}</span>`).join("")}</div>
      <div class="review-actions">
        <button data-ai-action="Validación registrada en la maqueta. En producción guardaría decisión, usuario y justificación.">Validar</button>
        <button data-ai-action="Fusión simulada. El sistema agruparía evidencia duplicada sin borrar la trazabilidad original.">Fusionar</button>
        <button data-ai-action="Derivación simulada. El caso quedaría asignado a un especialista taxonómico o regional.">Enviar a especialista</button>
      </div>
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

function showDrawer(species) {
  drawer.hidden = false;
  drawer.innerHTML = `
    <button class="drawer-close" id="drawer-close">×</button>
    ${badge(species.anp_code, species.anp_code)}
    <h2 class="latin">${escapeHtml(species.accepted_scientific_name || "Taxón pendiente")}</h2>
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
