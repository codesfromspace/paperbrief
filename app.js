if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8000/");
}

const form = document.querySelector("#generateForm");
const backendUrl = document.querySelector("#backendUrl");
const apiKey = document.querySelector("#apiKey");
const modelInput = document.querySelector("#model");
const refreshModelsButton = document.querySelector("#refreshModelsButton");
const modelHelp = document.querySelector("#modelHelp");
const templatePreset = document.querySelector("#templatePreset");
const customInstructions = document.querySelector("#customInstructions");
const profileSelect = document.querySelector("#profileSelect");
const profileName = document.querySelector("#profileName");
const saveProfileButton = document.querySelector("#saveProfileButton");
const deleteProfileButton = document.querySelector("#deleteProfileButton");
const pdfInput = document.querySelector("#pdfInput");
const pdfLabel = document.querySelector("#pdfLabel");
const pdfHelp = document.querySelector("#pdfHelp");
const batchMode = document.querySelector("#batchMode");
const statusPill = document.querySelector("#status");
const themeToggle = document.querySelector("#themeToggle");
const apiStep = document.querySelector("#apiStep");
const renderStep = document.querySelector("#renderStep");
const generateButton = document.querySelector("#generateButton");
const toast = document.querySelector("#toast");
const shortViewButton = document.querySelector("#shortViewButton");
const fullViewButton = document.querySelector("#fullViewButton");
const editButton = document.querySelector("#editButton");
const snapshotButton = document.querySelector("#snapshotButton");
const citationButton = document.querySelector("#citationButton");
const regenerateButton = document.querySelector("#regenerateButton");
const regenerateSection = document.querySelector("#regenerateSection");
const regenerateStyle = document.querySelector("#regenerateStyle");
const saveEditButton = document.querySelector("#saveEditButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const pptxButton = document.querySelector("#pptxButton");
const paperTabs = document.querySelector("#paperTabs");
const synthesisPanel = document.querySelector("#synthesisPanel");
const comparisonPanel = document.querySelector("#comparisonPanel");
const exportStatus = document.querySelector("#exportStatus");
const workspace = document.querySelector(".workspace");
const resultStage = document.querySelector(".result-stage");
const stageResizeHandle = document.querySelector("#stageResizeHandle");
let latestPayload = null;
let latestBatch = null;
let currentView = "short";
let selectedPaperIndex = 0;
let isEditMode = false;
let editBackup = null;
const PROFILE_STORAGE_KEY = "paperbrief.profiles.v1";
const ACTIVE_PROFILE_KEY = "paperbrief.activeProfile.v1";
const THEME_STORAGE_KEY = "paperbrief.theme.v1";
const OUTPUT_WIDTH_STORAGE_KEY = "paperbrief.outputWidth.v1";
const DEFAULT_MODELS = ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4.1", "gpt-4.1-mini", "o4-mini"];

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getOutputWidthBounds() {
  const workspaceRect = workspace.getBoundingClientRect();
  const resultRect = resultStage.getBoundingClientRect();
  const min = 430;
  const max = Math.max(min, workspaceRect.right - resultRect.left);
  return { min, max };
}

function setOutputWidth(width, persist = true) {
  const { min, max } = getOutputWidthBounds();
  const clamped = clampNumber(Math.round(width), min, max);
  workspace.style.setProperty("--result-stage-width", `${clamped}px`);
  if (persist) localStorage.setItem(OUTPUT_WIDTH_STORAGE_KEY, String(clamped));
}

function resetOutputWidth() {
  workspace.style.removeProperty("--result-stage-width");
  localStorage.removeItem(OUTPUT_WIDTH_STORAGE_KEY);
  showToast("Output panel width reset.");
}

function initOutputResize() {
  const savedWidth = Number(localStorage.getItem(OUTPUT_WIDTH_STORAGE_KEY));
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    window.requestAnimationFrame(() => setOutputWidth(savedWidth, false));
  }

  let resizing = false;
  function stopResize() {
    if (!resizing) return;
    resizing = false;
    workspace.classList.remove("is-resizing-output");
  }

  stageResizeHandle.addEventListener("pointerdown", (event) => {
    resizing = true;
    stageResizeHandle.setPointerCapture(event.pointerId);
    workspace.classList.add("is-resizing-output");
    event.preventDefault();
  });

  stageResizeHandle.addEventListener("pointermove", (event) => {
    if (!resizing) return;
    const resultRect = resultStage.getBoundingClientRect();
    setOutputWidth(event.clientX - resultRect.left);
  });

  stageResizeHandle.addEventListener("pointerup", stopResize);
  stageResizeHandle.addEventListener("pointercancel", stopResize);
  stageResizeHandle.addEventListener("dblclick", resetOutputWidth);
  stageResizeHandle.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const currentWidth = resultStage.getBoundingClientRect().width;
      setOutputWidth(currentWidth + (event.key === "ArrowRight" ? 40 : -40));
      event.preventDefault();
    }
    if (event.key === "Escape" || event.key === "Enter") {
      resetOutputWidth();
      event.preventDefault();
    }
  });

  window.addEventListener("resize", () => {
    const saved = Number(localStorage.getItem(OUTPUT_WIDTH_STORAGE_KEY));
    if (Number.isFinite(saved) && saved > 0) setOutputWidth(saved, false);
  });
}

function getCurrentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalizedTheme;
  localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  themeToggle.textContent = normalizedTheme === "dark" ? "Light" : "Dark";
  themeToggle.setAttribute("aria-pressed", String(normalizedTheme === "dark"));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  generateButton.textContent = isBusy ? "Generating..." : getGenerateLabel();
  apiStep.classList.toggle("is-active", isBusy);
  statusPill.textContent = isBusy ? "Calling OpenAI API" : "Ready";
}

function getGenerateLabel() {
  const fileCount = pdfInput.files.length;
  if (fileCount === 1) return "Generate brief";
  if (fileCount > 1) return "Generate batch";
  return "Generate";
}

function updateGenerateLabel() {
  if (!generateButton.disabled) {
    generateButton.textContent = getGenerateLabel();
  }
}

function getBatchMode() {
  return document.querySelector('input[name="batchMode"]:checked')?.value || "separate";
}

function updateBatchModeVisibility() {
  batchMode.classList.toggle("is-hidden", pdfInput.files.length < 2);
}

function setModelOptions(models, selectedModel = modelInput.value || "gpt-5.2") {
  const uniqueModels = Array.from(new Set((models.length ? models : DEFAULT_MODELS).filter(Boolean)));
  const effectiveSelection = uniqueModels.includes(selectedModel) ? selectedModel : uniqueModels[0] || "gpt-5.2";
  modelInput.innerHTML = uniqueModels
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join("");
  modelInput.value = effectiveSelection;
}

async function loadModelOptions({ silent = false } = {}) {
  const baseUrl = backendUrl.value.trim().replace(/\/$/, "");
  const selectedModel = modelInput.value || "gpt-5.2";
  const enteredApiKey = apiKey.value.trim();

  refreshModelsButton.disabled = true;
  modelHelp.textContent = "Loading models from OpenAI...";
  try {
    const response = await fetch(`${baseUrl}/api/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: enteredApiKey || null }),
    });
    const payload = await parseApiResponse(response);
    if (!response.ok) {
      throw new Error(payload.detail || "Could not load model list.");
    }
    setModelOptions(payload.models || DEFAULT_MODELS, selectedModel);
    modelHelp.textContent = `Loaded ${modelInput.options.length} usable models from OpenAI.`;
    if (!silent) showToast("Model list refreshed.");
  } catch (error) {
    setModelOptions(DEFAULT_MODELS, selectedModel);
    modelHelp.textContent = "Using fallback models. Add an API key and refresh for the live list.";
    if (!silent) showToast(error.message);
  } finally {
    refreshModelsButton.disabled = false;
  }
}

function asList(items) {
  if (!Array.isArray(items) || items.length === 0) return "<li>Not returned.</li>";
  return items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("");
}

function editableList(items, listName) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<li data-edit-list="${listName}">Not returned.</li>`;
  }
  return items.map((item) => `<li data-edit-list="${listName}">${escapeHtml(String(item))}</li>`).join("");
}

function joinItems(items) {
  if (Array.isArray(items)) return items.join("; ");
  return items || "Not returned";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return { detail: text || response.statusText || "Request failed." };
}

function readProfiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProfiles(profiles) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function applyProfile(profile) {
  if (!profile) return;
  backendUrl.value = profile.backendUrl || "http://127.0.0.1:8000";
  setModelOptions(Array.from(modelInput.options).map((option) => option.value), profile.model || "gpt-5.2");
  apiKey.value = profile.apiKey || "";
  templatePreset.value = profile.templatePreset || "scientific_claims";
  customInstructions.value = profile.customInstructions || "";
}

function renderProfiles(selectedName = localStorage.getItem(ACTIVE_PROFILE_KEY) || "") {
  const profiles = readProfiles();
  const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));
  const effectiveSelection = selectedName || (names.length === 1 ? names[0] : "");
  profileSelect.innerHTML = [
    `<option value="">No saved profile</option>`,
    ...names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`),
  ].join("");

  if (effectiveSelection && profiles[effectiveSelection]) {
    profileSelect.value = effectiveSelection;
    profileName.value = effectiveSelection;
    applyProfile(profiles[effectiveSelection]);
    localStorage.setItem(ACTIVE_PROFILE_KEY, effectiveSelection);
  } else {
    profileSelect.value = "";
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
  }
}

function saveCurrentProfile() {
  const name = profileName.value.trim();
  if (!name) {
    showToast("Enter a profile name first.");
    return;
  }

  const enteredApiKey = apiKey.value.trim();
  if (enteredApiKey && !enteredApiKey.startsWith("sk-")) {
    showToast("OpenAI API key looks wrong. It should start with sk-.");
    return;
  }

  const profiles = readProfiles();
  profiles[name] = {
    backendUrl: backendUrl.value.trim() || "http://127.0.0.1:8000",
    model: modelInput.value.trim() || "gpt-5.2",
    templatePreset: templatePreset.value,
    customInstructions: customInstructions.value.trim(),
    apiKey: enteredApiKey,
    savedAt: new Date().toISOString(),
  };
  writeProfiles(profiles);
  renderProfiles(name);
  showToast(`Profile "${name}" saved locally.`);
}

function deleteSelectedProfile() {
  const name = profileSelect.value || profileName.value.trim();
  const profiles = readProfiles();
  if (!name || !profiles[name]) {
    showToast("Select a saved profile first.");
    return;
  }

  delete profiles[name];
  writeProfiles(profiles);
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
  profileName.value = "";
  renderProfiles("");
  showToast(`Profile "${name}" deleted.`);
}

function normalizeClaims(payload, view) {
  if (view === "full") {
    const full = payload.claims.full_structured_claims;
    return {
      thesis: full.thesis,
      why_it_matters: full.why_it_matters,
      study_design: {
        model_system: joinItems(full.study_design.model_system),
        methods: joinItems(full.study_design.methods),
        sample: full.study_design.sample,
        manipulation: full.study_design.manipulation,
        measures: joinItems(full.study_design.measures),
      },
      core_evidence: full.core_evidence.map((claim, index) => ({
        title: `Claim ${index + 1}`,
        claim,
      })),
      mechanism: full.mechanism,
      boundary_conditions: full.boundary_conditions,
      generalizable_insight: full.generalizable_insight,
    };
  }

  return payload.claims.infographic_claims;
}

function getTraceForClaim(payload, claimIndex) {
  return (payload.claims.evidence_traceability || []).find((item) => item.claim_index === claimIndex) || {
    claim_index: claimIndex,
    pages: [],
    support: "Evidence basis not returned.",
  };
}

function pageLabel(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return "Pages not returned";
  return `p. ${pages.join(", ")}`;
}

function displayConfidence(value) {
  const map = {
    strong: "Strong",
    supported: "Moderate",
    hypothesis: "Weak",
    speculative: "Weak",
  };
  return map[value] || "Unclear";
}

function formatPaperDetails(paper) {
  const parts = [
    paper.journal && paper.journal !== "Journal not found" ? paper.journal : "",
    paper.year ? String(paper.year) : "",
    paper.doi ? `DOI ${paper.doi}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Journal, year, and DOI not returned.";
}

function compactCardText(value, limit = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}...`;
}

function compactList(items, fallback, limit = 3) {
  const list = (Array.isArray(items) ? items : [items])
    .map((item) => compactCardText(item, 130))
    .filter(Boolean);
  return (list.length ? list : [fallback]).slice(0, limit);
}

function buildInterestingPoints(claims, metadata) {
  const doiHooks = metadata.article_signals?.reuse_hooks || [];
  return compactList(
    [
      claims.mechanism,
      claims.generalizable_insight,
      ...doiHooks,
    ],
    "The most interesting angle will appear after claim extraction.",
    3
  );
}

function inferRelevance(metadata, claims) {
  const score = Number(metadata.journal_metric?.interest_score || 0);
  const clinicalText = [
    claims.thesis,
    claims.mechanism,
    ...(claims.why_it_matters || []),
  ].join(" ").toLowerCase();
  if (/\b(patient|clinical|diagnos|treat|therapy|symptom|risk|prognos|hospital)\b/.test(clinicalText)) return "High";
  if (score >= 75) return "High";
  if (score >= 40) return "Medium";
  return metadata.journal_metric?.metric_value && metadata.journal_metric.metric_value !== "not found" ? "Medium" : "Unclear";
}

function inferClaimImplication(claim, claims) {
  const insight = claims.generalizable_insight || "";
  if (insight && insight !== "Not specified") return insight;
  return claim ? `Use this claim to interpret ${claim.toLowerCase()}` : "Implication requires closer reading.";
}

function buildDisplayModel(payload, view) {
  const claims = normalizeClaims(payload, view);
  const metadata = payload.metadata || {};
  const confidence = payload.claims.claim_confidence || {};
  const quality = payload.claims.quality_check || {};
  const keyTrace = getTraceForClaim(payload, 1);
  const relevance = inferRelevance(metadata, claims);
  const keyConfidence = displayConfidence(confidence.main_thesis || confidence.core_evidence?.[0]);

  // Creates the clinician-facing display model from raw extraction JSON.
  // Extraction stays unchanged; only this presentation adapter decides labels,
  // badges, fallback text, and how traceability appears in the report.
  return {
    paper: {
      title: metadata.title || payload.filename || "Uploaded paper",
      journal: metadata.journal && metadata.journal !== "not found" ? metadata.journal : "Journal not found",
      year: metadata.year || "",
      doi: metadata.doi || "",
      pagesAnalyzed: metadata.page_count || 0,
      extractedClaims: claims.core_evidence?.length || 0,
    },
    executiveTakeaway: claims.thesis || "The main claim will be generated by the OpenAI API.",
    keyFinding: {
      text: claims.thesis || "The main claim will be generated by the OpenAI API.",
      pages: keyTrace.pages || [],
      relevance,
      confidence: keyConfidence,
    },
    claims: (claims.core_evidence || []).slice(0, 4).map((card, index) => {
      const trace = getTraceForClaim(payload, index + 1);
      return {
        id: index + 1,
        title: card.title || `Claim ${index + 1}`,
        summary: card.claim || "Claim not returned.",
        pages: trace.pages || [],
        evidenceBasis: compactCardText(trace.support || "Evidence basis not returned."),
        implication: inferClaimImplication(card.claim, claims),
        strength: displayConfidence(confidence.core_evidence?.[index]),
        limitations: (claims.boundary_conditions || [])[index % Math.max((claims.boundary_conditions || []).length, 1)]
          || "Uncertainty requires closer reading.",
      };
    }),
    soWhat: {
      whyItMatters: (claims.why_it_matters || [])[0] || "The finding changes how the paper should be interpreted.",
      rememberThis: claims.generalizable_insight || claims.thesis || "Remember the paper-specific mechanism, not only the topic.",
      doNotOverinterpret: (claims.boundary_conditions || [])[0] || quality.issues?.[0] || "Do not generalize beyond the study design.",
    },
    readerBrief: {
      whyImportant: compactList(claims.why_it_matters, "Why this matters was not returned.", 3),
      whatFound: compactList((claims.core_evidence || []).map((card) => card.claim), claims.thesis, 4),
      interesting: buildInterestingPoints(claims, metadata),
      weaknesses: compactList(
        [
          ...(claims.boundary_conditions || []),
          ...(quality.issues || []),
        ],
        "Limitations were not returned by the model.",
        3
      ),
    },
    rawClaims: claims,
  };
}

function renderClaims(payload, view = currentView) {
  latestPayload = payload;
  currentView = view;
  const display = buildDisplayModel(payload, view);
  const claims = display.rawClaims;
  const metadata = payload.metadata || {};

  document.querySelector("#sourceLabel").textContent = "OpenAI Responses API";
  if (metadata.journal && metadata.journal !== "not found") {
    document.querySelector("#sourceLabel").textContent = metadata.journal;
  }
  document.querySelector("#paperTitle").textContent = display.paper.title;
  document.querySelector("#paperTitle").dataset.editField = "title";
  document.querySelector("#paperDetails").textContent = formatPaperDetails(display.paper);
  document.querySelector("#modelBadge").textContent = payload.model;
  document.querySelector("#fileMeta").textContent = payload.filename;
  document.querySelector("#pagesMeta").textContent = `${display.paper.pagesAnalyzed} pages`;
  document.querySelector("#claimsMeta").textContent = `${display.paper.extractedClaims} claims`;
  document.querySelector("#charsMeta").textContent = `${Number(metadata.char_count || 0).toLocaleString()} chars`;
  document.querySelector("#executiveTakeaway").textContent = display.executiveTakeaway;
  const notes = payload.claims._normalization_notes || [];
  document.querySelector("#normalizationMeta").textContent = notes.length ? `${notes.length} fields compressed` : "No compression";
  renderJournalMetric(metadata);
  renderDoiContext(metadata);
  renderSnapshot(payload);
  renderTraceability(payload);
  renderQuality(payload);

  document.querySelector("#thesisText").textContent = claims.thesis;
  document.querySelector("#thesisText").dataset.editField = "thesis";
  document.querySelector("#keyFindingPages").textContent = pageLabel(display.keyFinding.pages);
  document.querySelector("#keyFindingRelevance").textContent = `Relevance ${display.keyFinding.relevance}`;
  document.querySelector("#keyFindingConfidence").textContent = `Evidence ${display.keyFinding.confidence}`;
  document.querySelector("#whyList").innerHTML = editableList(display.readerBrief.whyImportant, "why_it_matters");
  document.querySelector("#foundList").innerHTML = asList(display.readerBrief.whatFound);
  document.querySelector("#interestingList").innerHTML = asList(display.readerBrief.interesting);
  document.querySelector("#weaknessList").innerHTML = asList(display.readerBrief.weaknesses);
  document.querySelector("#modelSystem").textContent = claims.study_design.model_system;
  document.querySelector("#modelSystem").dataset.editField = "study_design.model_system";
  document.querySelector("#methods").textContent = claims.study_design.methods;
  document.querySelector("#methods").dataset.editField = "study_design.methods";
  document.querySelector("#sample").textContent = claims.study_design.sample;
  document.querySelector("#sample").dataset.editField = "study_design.sample";
  document.querySelector("#manipulation").textContent = claims.study_design.manipulation;
  document.querySelector("#manipulation").dataset.editField = "study_design.manipulation";
  document.querySelector("#measures").textContent = claims.study_design.measures;
  document.querySelector("#measures").dataset.editField = "study_design.measures";
  document.querySelector("#mechanismText").textContent = claims.mechanism;
  document.querySelector("#mechanismText").dataset.editField = "mechanism";
  document.querySelector("#boundaryList").innerHTML = editableList(claims.boundary_conditions, "boundary_conditions");
  document.querySelector("#insightText").textContent = claims.generalizable_insight;
  document.querySelector("#insightText").dataset.editField = "generalizable_insight";

  document.querySelector("#coreEvidence").innerHTML = display.claims
    .map(
      (card, index) => `
        <div class="finding evidence-card ${index === 0 ? "is-selected" : ""}" data-evidence-index="${index}">
          <div class="claim-card-top">
            <span data-edit-field="evidence.title">${escapeHtml(card.title)}</span>
            <em>${escapeHtml(card.strength)}</em>
          </div>
          <strong data-edit-field="evidence.claim">${escapeHtml(card.summary)}</strong>
          <div class="claim-card-meta">
            <small>${escapeHtml(pageLabel(card.pages))}</small>
            <small>${escapeHtml(card.evidenceBasis)}</small>
          </div>
          <div class="claim-card-bottom">
            <p><b>Implication</b> ${escapeHtml(card.implication)}</p>
            <p><b>Uncertainty</b> ${escapeHtml(card.limitations)}</p>
          </div>
        </div>
      `
    )
    .join("");

  document.querySelector("#soWhatWhy").textContent = display.soWhat.whyItMatters;
  document.querySelector("#soWhatRemember").textContent = display.soWhat.rememberThis;
  document.querySelector("#soWhatLimit").textContent = display.soWhat.doNotOverinterpret;

  renderStep.classList.add("is-done");
  statusPill.textContent = "Infographic ready";
  document.querySelector("#postControls").classList.remove("is-hidden");
  citationButton.disabled = false;
  applyEditMode();
  fitBriefToA4();
}

function fitBriefToA4() {
  window.requestAnimationFrame(() => {
    const card = document.querySelector("#briefCard");
    card.dataset.density = "normal";
    const a4HeightPx = 1122;
    if (card.scrollHeight > a4HeightPx) {
      card.dataset.density = "compact";
    }
    if (card.scrollHeight > a4HeightPx) {
      card.dataset.density = "dense";
    }
    statusPill.textContent = card.dataset.density === "normal" ? "A4 ready" : `A4 ${card.dataset.density}`;
  });
}

function renderTraceability(payload) {
  const panel = document.querySelector("#tracePanel");
  const trace = payload.claims.evidence_traceability || [];
  panel.classList.toggle("is-hidden", trace.length === 0);
  document.querySelector("#traceList").innerHTML = trace
    .map((item) => `
      <div class="trace-item">
        <span>Evidence card ${item.claim_index} · ${pageLabel(item.pages)}</span>
        <p>${escapeHtml(item.support || "Support should be verified against the PDF")}</p>
      </div>
    `)
    .join("");
}

function renderQuality(payload) {
  const panel = document.querySelector("#qualityPanel");
  const confidence = payload.claims.claim_confidence || {};
  const quality = payload.claims.quality_check || {};
  panel.classList.remove("is-hidden");
  document.querySelector("#confidenceList").innerHTML = `
    <span>Thesis: ${escapeHtml(confidence.main_thesis || "supported")}</span>
    <span>Mechanism: ${escapeHtml(confidence.mechanism || "hypothesis")}</span>
    <span>Guard: ${escapeHtml(quality.status || "review")} · ${escapeHtml(quality.risk_level || "medium")}</span>
  `;
  const issues = [...(quality.issues || []), ...(quality.recommended_fixes || [])].filter(Boolean);
  document.querySelector("#qualityCheck").innerHTML = issues.length ? `<ul>${asList(issues)}</ul>` : "<p>No issues flagged.</p>";
}

function renderJournalMetric(metadata) {
  const badge = document.querySelector("#journalMetricMeta");
  const metric = metadata.journal_metric || {};
  const tier = ["low", "moderate", "high", "very_high"].includes(metric.interest_tier)
    ? metric.interest_tier
    : "low";
  const journal = metadata.journal || "Journal not found";
  const metricName = metric.metric_name && metric.metric_name !== "not found" ? metric.metric_name : "metric not found";
  const metricValue = metric.metric_value && metric.metric_value !== "not found" ? metric.metric_value : "";
  const quartile = metric.quartile && metric.quartile !== "not found" ? ` ${metric.quartile}` : "";
  const score = Number.isFinite(Number(metric.interest_score)) ? ` · ${metric.interest_score}/100` : "";

  badge.className = `metric-badge metric-${tier}`;
  badge.textContent = `${journal}: ${metricName}${metricValue ? ` ${metricValue}` : ""}${quartile}${score}`;
  badge.title = metric.rationale || "Journal-level metric from DOI lookup";
}

function renderDoiContext(metadata) {
  const panel = document.querySelector("#doiContext");
  const signals = metadata.article_signals || {};
  const hooks = Array.isArray(signals.reuse_hooks) ? signals.reuse_hooks.filter(Boolean) : [];
  const hasContext = Boolean(metadata.doi) && (
    hooks.length > 0 ||
    ["article_type", "access_status", "citation_signal", "data_code_signal", "external_context"]
      .some((key) => signals[key] && signals[key] !== "not found")
  );

  panel.classList.toggle("is-hidden", !hasContext);
  if (!hasContext) return;

  document.querySelector("#doiContextStatus").textContent = metadata.doi;
  document.querySelector("#articleTypeSignal").textContent = signals.article_type || "Not found";
  document.querySelector("#accessSignal").textContent = signals.access_status || "Not found";
  document.querySelector("#citationSignal").textContent = signals.citation_signal || "Not found";
  document.querySelector("#dataCodeSignal").textContent = signals.data_code_signal || "Not found";
  document.querySelector("#externalContextSignal").textContent = signals.external_context || "Not found";
  document.querySelector("#reuseHooks").innerHTML = hooks
    .map((hook) => `<li>${escapeHtml(String(hook))}</li>`)
    .join("");
}

function renderSnapshot(payload) {
  const figure = document.querySelector("#snapshotFigure");
  const image = document.querySelector("#snapshotImage");
  const caption = document.querySelector("#snapshotCaption");
  const snapshot = payload.snapshot;

  if (!snapshot?.data_url) {
    figure.classList.add("is-hidden");
    image.removeAttribute("src");
    snapshotButton.disabled = true;
    snapshotButton.textContent = "Add snapshot";
    return;
  }

  const isVisible = Boolean(payload.snapshot_visible);
  snapshotButton.disabled = false;
  snapshotButton.textContent = isVisible ? "Hide snapshot" : "Add snapshot";
  caption.textContent = `Page ${snapshot.page || 1} snapshot`;
  figure.classList.toggle("is-hidden", !isVisible);

  if (isVisible) {
    image.src = snapshot.data_url;
  } else {
    image.removeAttribute("src");
  }
}

function renderPaperTabs(batch) {
  paperTabs.innerHTML = batch.papers
    .map(
      (paper, index) => `
        <button class="${index === selectedPaperIndex ? "is-selected" : ""}" data-paper-index="${index}">
          ${index + 1}. ${escapeHtml(paper.metadata.title || paper.filename).slice(0, 42)}
        </button>
      `
    )
    .join("");
}

function renderSynthesis(synthesis) {
  if (!synthesis) {
    synthesisPanel.classList.add("is-hidden");
    return;
  }
  synthesisPanel.classList.remove("is-hidden");
  document.querySelector("#synthesisThesis").textContent = synthesis.synthesis_thesis;
  document.querySelector("#sharedMechanisms").innerHTML = asList(synthesis.shared_mechanisms);
  document.querySelector("#contrasts").innerHTML = asList(synthesis.contrasts);
  document.querySelector("#researchImplication").textContent = synthesis.research_implication;
}

function renderComparison(batch) {
  if (!batch || batch.papers.length < 2) {
    comparisonPanel.classList.add("is-hidden");
    return;
  }
  comparisonPanel.classList.remove("is-hidden");
  document.querySelector("#comparisonTable").innerHTML = `
    <thead>
      <tr><th>Paper</th><th>Thesis</th><th>Mechanism</th><th>Model</th><th>Limit</th><th>Metric</th></tr>
    </thead>
    <tbody>
      ${batch.papers.map((paper) => {
        const claims = paper.claims.infographic_claims;
        const metric = paper.metadata.journal_metric || {};
        return `
          <tr>
            <td>${escapeHtml(paper.metadata.title || paper.filename)}</td>
            <td>${escapeHtml(claims.thesis)}</td>
            <td>${escapeHtml(claims.mechanism)}</td>
            <td>${escapeHtml(claims.study_design.model_system)}</td>
            <td>${escapeHtml((claims.boundary_conditions || [])[0] || "Not returned")}</td>
            <td>${escapeHtml(metric.interest_tier || "low")} ${escapeHtml(String(metric.interest_score ?? 0))}/100</td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
}

function renderBatch(batch) {
  isEditMode = false;
  editBackup = null;
  latestBatch = batch;
  selectedPaperIndex = 0;
  renderPaperTabs(batch);
  renderSynthesis(batch.synthesis);
  renderComparison(batch);
  renderClaims(batch.papers[0], "short");
  pptxButton.disabled = false;
  editButton.disabled = false;
  statusPill.textContent = batch.synthesis ? "Synthesis ready" : batch.papers.length > 1 ? "Batch ready" : "Infographic ready";
  updateEditControls();
}

function setView(view) {
  if (!latestPayload) return;
  if (isEditMode) {
    saveCurrentEdits();
  }
  shortViewButton.classList.toggle("is-selected", view === "short");
  fullViewButton.classList.toggle("is-selected", view === "full");
  renderClaims(latestPayload, view);
}

function updateEditControls() {
  editButton.classList.toggle("is-hidden", isEditMode);
  saveEditButton.classList.toggle("is-hidden", !isEditMode);
  cancelEditButton.classList.toggle("is-hidden", !isEditMode);
  shortViewButton.disabled = isEditMode;
  fullViewButton.disabled = isEditMode;
}

function applyEditMode() {
  const canEdit = isEditMode && currentView === "short";
  document.querySelector(".brief-card").classList.toggle("is-editing", canEdit);
  document
    .querySelectorAll("[data-edit-field], [data-edit-list]")
    .forEach((element) => {
      element.contentEditable = canEdit ? "true" : "false";
      element.spellcheck = canEdit;
    });
  updateEditControls();
}

function startEditMode() {
  if (!latestBatch || !latestPayload) return;
  if (currentView !== "short") {
    setView("short");
  }
  editBackup = JSON.parse(JSON.stringify(latestBatch));
  isEditMode = true;
  applyEditMode();
  showToast("Edit mode enabled.");
}

function getEditableText(selector) {
  return document.querySelector(selector)?.textContent.trim() || "";
}

function getEditableList(selector) {
  return Array.from(document.querySelectorAll(selector))
    .map((item) => item.textContent.trim())
    .filter(Boolean);
}

function collectCurrentEdits() {
  if (!latestPayload) return;
  const claims = latestPayload.claims.infographic_claims;
  latestPayload.metadata.title = getEditableText("#paperTitle") || latestPayload.metadata.title;
  claims.thesis = getEditableText("#thesisText");
  claims.why_it_matters = getEditableList('#whyList [data-edit-list="why_it_matters"]');
  claims.study_design.model_system = getEditableText("#modelSystem");
  claims.study_design.methods = getEditableText("#methods");
  claims.study_design.sample = getEditableText("#sample");
  claims.study_design.manipulation = getEditableText("#manipulation");
  claims.study_design.measures = getEditableText("#measures");
  claims.mechanism = getEditableText("#mechanismText");
  claims.boundary_conditions = getEditableList('#boundaryList [data-edit-list="boundary_conditions"]');
  claims.generalizable_insight = getEditableText("#insightText");
  claims.core_evidence = Array.from(document.querySelectorAll("#coreEvidence .finding")).map((card) => ({
    title: card.querySelector('[data-edit-field="evidence.title"]')?.textContent.trim() || "Claim",
    claim: card.querySelector('[data-edit-field="evidence.claim"]')?.textContent.trim() || "",
  }));
  latestBatch.edited = true;
}

function saveCurrentEdits() {
  if (!isEditMode) return;
  collectCurrentEdits();
  isEditMode = false;
  editBackup = null;
  renderPaperTabs(latestBatch);
  renderClaims(latestPayload, "short");
  showToast("Infographic edits saved.");
}

function cancelCurrentEdits() {
  if (!isEditMode || !editBackup) return;
  latestBatch = editBackup;
  latestPayload = latestBatch.papers[selectedPaperIndex] || latestBatch.papers[0];
  isEditMode = false;
  editBackup = null;
  renderPaperTabs(latestBatch);
  renderSynthesis(latestBatch.synthesis);
  renderClaims(latestPayload, "short");
  showToast("Edits discarded.");
}

function buildBibtex(paper) {
  const metadata = paper.metadata || {};
  const title = metadata.title || paper.filename || "Untitled";
  const year = String(metadata.year || new Date().getFullYear());
  const key = `${title.split(/\s+/).slice(0, 2).join("").replace(/\W/g, "")}${year}`;
  return `@article{${key},\n  title = {${title}},\n  journal = {${metadata.journal || ""}},\n  year = {${year}},\n  doi = {${metadata.doi || ""}}\n}`;
}

function buildRis(paper) {
  const metadata = paper.metadata || {};
  return [
    "TY  - JOUR",
    `TI  - ${metadata.title || paper.filename || "Untitled"}`,
    `JO  - ${metadata.journal || ""}`,
    `PY  - ${metadata.year || ""}`,
    `DO  - ${metadata.doi || ""}`,
    "ER  -",
  ].join("\n");
}

async function copyCitation() {
  if (!latestPayload) return;
  const citation = `${buildBibtex(latestPayload)}\n\n${buildRis(latestPayload)}`;
  try {
    await navigator.clipboard.writeText(citation);
    showToast("BibTeX/RIS citation copied.");
  } catch {
    exportStatus.textContent = citation;
    exportStatus.classList.remove("is-hidden");
    showToast("Citation shown below export buttons.");
  }
}

function applyRegeneratedSection(section, value) {
  const claims = latestPayload.claims.infographic_claims;
  if (section === "thesis") claims.thesis = limitClientWords(value, 28);
  if (section === "mechanism") claims.mechanism = limitClientWords(value, 35);
  if (section === "generalizable_insight") claims.generalizable_insight = limitClientWords(value, 28);
  if (section === "why_it_matters") claims.why_it_matters = value.split(/\n|•|-/).map((item) => limitClientWords(item, 14)).filter(Boolean).slice(0, 3);
  latestBatch.edited = true;
  renderClaims(latestPayload, "short");
}

function limitClientWords(text, limit) {
  return String(text || "").replaceAll(";", ",").split(/\s+/).filter(Boolean).slice(0, limit).join(" ");
}

async function regenerateCurrentSection() {
  if (!latestPayload) return;
  const enteredApiKey = apiKey.value.trim();
  if (enteredApiKey && !enteredApiKey.startsWith("sk-")) {
    showToast("OpenAI API key looks wrong. It should start with sk-.");
    return;
  }
  regenerateButton.disabled = true;
  regenerateButton.textContent = "Regenerating...";
  try {
    const baseUrl = backendUrl.value.trim().replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/api/regenerate-section`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: enteredApiKey || null,
        model: modelInput.value || "gpt-5.2",
        section: regenerateSection.value,
        style: regenerateStyle.value,
        paper: latestPayload,
      }),
    });
    const payload = await parseApiResponse(response);
    if (!response.ok) throw new Error(payload.detail || "Regeneration failed.");
    applyRegeneratedSection(payload.section, payload.value);
    showToast("Section regenerated.");
  } catch (error) {
    showToast(error.message);
  } finally {
    regenerateButton.disabled = false;
    regenerateButton.textContent = "Regenerate";
  }
}

async function generateInfographic(event) {
  event.preventDefault();

  const files = Array.from(pdfInput.files);
  if (!files.length) {
    showToast("Upload at least one PDF first.");
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("pdfs", file));
  const selectedModel = modelInput.value || "gpt-5.2";
  if (!selectedModel) {
    showToast("Select a model first.");
    return;
  }
  formData.append("model", selectedModel);
  formData.append("synthesis_mode", files.length > 1 ? getBatchMode() : "separate");
  formData.append("template_preset", templatePreset.value || "scientific_claims");
  formData.append("custom_instructions", customInstructions.value.trim());
  const enteredApiKey = apiKey.value.trim();
  if (enteredApiKey && !enteredApiKey.startsWith("sk-")) {
    statusPill.textContent = "Invalid API key";
    showToast("OpenAI API key looks wrong. It should start with sk-.");
    return;
  }
  if (enteredApiKey) formData.append("api_key", enteredApiKey);

  const baseUrl = backendUrl.value.trim().replace(/\/$/, "");
  setBusy(true);

  try {
    const response = await fetch(`${baseUrl}/api/generate-batch`, {
      method: "POST",
      body: formData,
    });

    const payload = await parseApiResponse(response);
    if (!response.ok) {
      throw new Error(payload.detail || "Generation failed.");
    }

    renderBatch(payload);
    exportStatus.classList.add("is-hidden");
    exportStatus.innerHTML = "";
    const generatedMessage = payload.synthesis
      ? "Batch claims and synthesis generated."
      : payload.papers.length > 1
        ? "Separate paper briefs generated."
        : "Structured claims generated.";
    showToast(generatedMessage);
  } catch (error) {
    statusPill.textContent = "Generation failed";
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

pdfInput.addEventListener("change", () => {
  const files = Array.from(pdfInput.files);
  if (!files.length) {
    pdfLabel.textContent = "Upload PDFs";
    pdfHelp.textContent = "PDF text is extracted locally, claims are generated by OpenAI API.";
    statusPill.textContent = "Waiting for PDF";
    updateBatchModeVisibility();
    updateGenerateLabel();
    return;
  }
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  pdfLabel.textContent = files.length === 1 ? files[0].name : `${files.length} PDFs selected`;
  pdfHelp.textContent = `${(totalSize / 1024 / 1024).toFixed(1)} MB total`;
  statusPill.textContent = files.length === 1 ? "PDF selected" : "Batch selected";
  updateBatchModeVisibility();
  updateGenerateLabel();
});

form.addEventListener("submit", generateInfographic);
refreshModelsButton.addEventListener("click", () => loadModelOptions());
apiKey.addEventListener("change", () => loadModelOptions({ silent: true }));
themeToggle.addEventListener("click", () => {
  applyTheme(getCurrentTheme() === "dark" ? "light" : "dark");
});
profileSelect.addEventListener("change", () => {
  const profiles = readProfiles();
  const name = profileSelect.value;
  if (!name) {
    profileName.value = "";
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    return;
  }
  profileName.value = name;
  applyProfile(profiles[name]);
  localStorage.setItem(ACTIVE_PROFILE_KEY, name);
  loadModelOptions({ silent: true });
  showToast(`Profile "${name}" loaded.`);
});
saveProfileButton.addEventListener("click", saveCurrentProfile);
deleteProfileButton.addEventListener("click", deleteSelectedProfile);
shortViewButton.addEventListener("click", () => setView("short"));
fullViewButton.addEventListener("click", () => setView("full"));
snapshotButton.addEventListener("click", () => {
  if (!latestPayload?.snapshot?.data_url) return;
  latestPayload.snapshot_visible = !latestPayload.snapshot_visible;
  if (latestBatch) latestBatch.edited = true;
  renderSnapshot(latestPayload);
});
citationButton.addEventListener("click", copyCitation);
regenerateButton.addEventListener("click", regenerateCurrentSection);
paperTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-paper-index]");
  if (!button || !latestBatch) return;
  if (isEditMode) {
    saveCurrentEdits();
  }
  selectedPaperIndex = Number(button.dataset.paperIndex);
  renderPaperTabs(latestBatch);
  renderClaims(latestBatch.papers[selectedPaperIndex], currentView);
});
editButton.addEventListener("click", startEditMode);
saveEditButton.addEventListener("click", saveCurrentEdits);
cancelEditButton.addEventListener("click", cancelCurrentEdits);
pptxButton.addEventListener("click", async () => {
  if (!latestBatch) return;
  if (isEditMode) {
    saveCurrentEdits();
  }
  const baseUrl = backendUrl.value.trim().replace(/\/$/, "");
  pptxButton.disabled = true;
  const previousLabel = pptxButton.textContent;
  pptxButton.textContent = "Preparing PPTX...";

  try {
    const response = latestBatch.edited
      ? await fetch(`${baseUrl}/api/export-pptx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(latestBatch),
        })
      : await fetch(`${baseUrl}/api/export-pptx/${latestBatch.batch_id}`);
    if (!response.ok) {
      const payload = await parseApiResponse(response).catch(() => ({}));
      throw new Error(payload.detail || "PPTX export failed.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "paperbrief-claims.pptx";
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (latestBatch.edited) {
      exportStatus.innerHTML = `
        PPTX created from your edited infographic.
        <br>Also saved locally in <code>exports/</code>.
      `;
    } else {
      const directUrl = `${baseUrl}/api/export-pptx/${latestBatch.batch_id}`;
      exportStatus.innerHTML = `
        PPTX created. If it did not download automatically,
        <a href="${directUrl}" download="paperbrief-claims.pptx">download it here</a>.
        <br>Also saved locally in <code>exports/</code>.
      `;
    }
    exportStatus.classList.remove("is-hidden");
    showToast("PPTX export ready.");
  } catch (error) {
    showToast(error.message);
  } finally {
    pptxButton.textContent = previousLabel;
    pptxButton.disabled = false;
  }
});
document.querySelector("#printButton").addEventListener("click", () => {
  if (isEditMode) {
    saveCurrentEdits();
  }
  window.print();
});
initOutputResize();
applyTheme(getCurrentTheme());
renderProfiles();
updateBatchModeVisibility();
setModelOptions(DEFAULT_MODELS, modelInput.value || "gpt-5.2");
loadModelOptions({ silent: true });
