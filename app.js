if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8000/");
}

const form = document.querySelector("#generateForm");
const backendUrl = document.querySelector("#backendUrl");
const apiKey = document.querySelector("#apiKey");
const modelInput = document.querySelector("#model");
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
const saveEditButton = document.querySelector("#saveEditButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const pptxButton = document.querySelector("#pptxButton");
const paperTabs = document.querySelector("#paperTabs");
const synthesisPanel = document.querySelector("#synthesisPanel");
const exportStatus = document.querySelector("#exportStatus");
let latestPayload = null;
let latestBatch = null;
let currentView = "short";
let selectedPaperIndex = 0;
let isEditMode = false;
let editBackup = null;
const PROFILE_STORAGE_KEY = "paperbrief.profiles.v1";
const ACTIVE_PROFILE_KEY = "paperbrief.activeProfile.v1";
const THEME_STORAGE_KEY = "paperbrief.theme.v1";

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
  modelInput.value = profile.model || "gpt-5.2";
  apiKey.value = profile.apiKey || "";
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

function renderClaims(payload, view = currentView) {
  latestPayload = payload;
  currentView = view;
  const claims = normalizeClaims(payload, view);
  const metadata = payload.metadata;

  document.querySelector("#sourceLabel").textContent = "OpenAI Responses API";
  if (metadata.journal && metadata.journal !== "not found") {
    document.querySelector("#sourceLabel").textContent = metadata.journal;
  }
  document.querySelector("#paperTitle").textContent = metadata.title || payload.filename;
  document.querySelector("#paperTitle").dataset.editField = "title";
  document.querySelector("#modelBadge").textContent = payload.model;
  document.querySelector("#fileMeta").textContent = payload.filename;
  document.querySelector("#pagesMeta").textContent = `${metadata.page_count} pages`;
  document.querySelector("#charsMeta").textContent = `${metadata.char_count.toLocaleString()} chars`;
  const notes = payload.claims._normalization_notes || [];
  document.querySelector("#normalizationMeta").textContent = notes.length ? `${notes.length} fields compressed` : "No compression";
  renderJournalMetric(metadata);
  renderSnapshot(payload);

  document.querySelector("#thesisText").textContent = claims.thesis;
  document.querySelector("#thesisText").dataset.editField = "thesis";
  document.querySelector("#whyList").innerHTML = editableList(claims.why_it_matters, "why_it_matters");
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

  document.querySelector("#coreEvidence").innerHTML = claims.core_evidence
    .map(
      (card, index) => `
        <div class="finding ${index === 0 ? "is-selected" : ""}" data-evidence-index="${index}">
          <span data-edit-field="evidence.title">${escapeHtml(String(card.title))}</span>
          <strong data-edit-field="evidence.claim">${escapeHtml(String(card.claim))}</strong>
          <small>generated by OpenAI API</small>
        </div>
      `
    )
    .join("");

  renderStep.classList.add("is-done");
  statusPill.textContent = "Infographic ready";
  applyEditMode();
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

function renderBatch(batch) {
  isEditMode = false;
  editBackup = null;
  latestBatch = batch;
  selectedPaperIndex = 0;
  renderPaperTabs(batch);
  renderSynthesis(batch.synthesis);
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

async function generateInfographic(event) {
  event.preventDefault();

  const files = Array.from(pdfInput.files);
  if (!files.length) {
    showToast("Upload at least one PDF first.");
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("pdfs", file));
  formData.append("model", modelInput.value.trim() || "gpt-5.2");
  formData.append("synthesis_mode", files.length > 1 ? getBatchMode() : "separate");
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
applyTheme(getCurrentTheme());
renderProfiles();
updateBatchModeVisibility();
