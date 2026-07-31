import {
  buildEligibleDealsCsv,
  buildPatchCsv,
  canonicalise,
  createBaseline,
  createReviewQueue,
  filterOriginDeals,
  isValidBaseline,
  parseCsv,
  statusLabel,
} from "./logic.mjs";

const STORAGE_KEY = "completed-deals-check-origin-baseline-v2";

const DEMO_ORIGIN = [
  {
    id: "ORI-1042",
    target: "BrightFoods Group",
    buyer: "Atlas Partners",
    seller: "Founding shareholders",
    completionDate: "2026-07-15",
    enterpriseValue: "€420m",
    revenue: "€210m",
    ebitda: "€38m",
    stake: "100%",
    advisers: "Rothschild & Co; Latham & Watkins",
    sourceType: "Prop intelligence",
    sourceDate: "2026-07-18",
  },
  {
    id: "ORI-1048",
    target: "Nova Health Services",
    buyer: "Cedar Capital",
    seller: "Medica Holdings",
    completionDate: "2026-07-11",
    enterpriseValue: "£185m",
    revenue: "£96m",
    ebitda: "£21m",
    stake: "75%",
    advisers: "Houlihan Lokey",
    sourceType: "Prop intelligence",
    sourceDate: "2026-07-17",
  },
  {
    id: "ORI-1051",
    target: "Orbit Data Systems",
    buyer: "Summit Ridge",
    seller: "Orion Ventures",
    completionDate: "2026-07-09",
    enterpriseValue: "$310m",
    revenue: "",
    ebitda: "$29m",
    stake: "75%",
    advisers: "William Blair",
    sourceType: "Prop intelligence",
    sourceDate: "2026-07-16",
  },
  {
    id: "ORI-1055",
    target: "BlueHarbor Logistics",
    buyer: "Northstar Infrastructure",
    seller: "BlueHarbor Family Office",
    completionDate: "2026-07-08",
    enterpriseValue: "€265m",
    revenue: "€144m",
    ebitda: "€24m",
    stake: "100%",
    advisers: "Jefferies",
    sourceType: "Prop intelligence",
    sourceDate: "2026-07-14",
  },
  {
    id: "ORI-1057",
    target: "Kestrel Packaging",
    buyer: "Meridian Equity",
    seller: "Kestrel Management",
    completionDate: "2026-07-04",
    enterpriseValue: "€150m",
    revenue: "€88m",
    ebitda: "€16m",
    stake: "80%",
    advisers: "Lincoln International",
    sourceType: "Aggregation",
    sourceDate: "2026-07-05",
  },
];

const DEMO_GAIN = [
  {
    id: "GAIN-7711",
    target: "BrightFoods Group",
    buyer: "Atlas Partners",
    seller: "Founding shareholders",
    completionDate: "2026-07-15",
    enterpriseValue: "",
    revenue: "€210m",
    ebitda: "",
    stake: "100%",
    advisers: "",
    sourceType: "",
    sourceDate: "2026-07-15",
  },
  {
    id: "GAIN-7735",
    target: "Nova Health Services",
    buyer: "Cedar Capital",
    seller: "Medica Holdings",
    completionDate: "2026-07-11",
    enterpriseValue: "£175m",
    revenue: "£96m",
    ebitda: "",
    stake: "75%",
    advisers: "Houlihan Lokey",
    sourceType: "",
    sourceDate: "2026-07-12",
  },
  {
    id: "GAIN-7741",
    target: "Orbit Data Systems",
    buyer: "Summit Ridge",
    seller: "Orion Ventures",
    completionDate: "2026-07-09",
    enterpriseValue: "$310m",
    revenue: "$122m",
    ebitda: "$29m",
    stake: "80%",
    advisers: "",
    sourceType: "",
    sourceDate: "2026-07-10",
  },
  {
    id: "GAIN-7750",
    target: "Kestrel Packaging",
    buyer: "Meridian Equity",
    seller: "Kestrel Management",
    completionDate: "2026-07-04",
    enterpriseValue: "€150m",
    revenue: "€88m",
    ebitda: "€16m",
    stake: "80%",
    advisers: "Lincoln International",
    sourceType: "",
    sourceDate: "2026-07-05",
  },
];

const elements = {
  originInput: document.querySelector("#origin-file"),
  gainInput: document.querySelector("#gain-file"),
  baselineInput: document.querySelector("#baseline-file"),
  originFileName: document.querySelector("#origin-file-name"),
  originFileCount: document.querySelector("#origin-file-count"),
  gainFileName: document.querySelector("#gain-file-name"),
  gainFileCount: document.querySelector("#gain-file-count"),
  notice: document.querySelector("#notice"),
  baselineHeadline: document.querySelector("#baseline-headline"),
  baselineDescription: document.querySelector("#baseline-description"),
  baselineRunSummary: document.querySelector("#baseline-run-summary"),
  completeRun: document.querySelector("#complete-run"),
  exportBaseline: document.querySelector("#export-baseline"),
  importBaseline: document.querySelector("#import-baseline"),
  exportEligible: document.querySelector("#export-eligible"),
  metrics: document.querySelector("#metrics"),
  filterRow: document.querySelector("#filter-row"),
  search: document.querySelector("#search"),
  dealList: document.querySelector("#deal-list"),
  detail: document.querySelector("#detail-panel"),
  queueCount: document.querySelector("#queue-count"),
  compare: document.querySelector("#compare"),
  restoreDemo: document.querySelector("#restore-demo"),
  exportPatch: document.querySelector("#export-patch"),
};

function loadBaseline() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return isValidBaseline(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const state = {
  originDeals: DEMO_ORIGIN,
  gainDeals: DEMO_GAIN,
  reviews: createReviewQueue(DEMO_ORIGIN, DEMO_GAIN),
  originFileName: "Demo Origin export.csv",
  gainFileName: "Demo Gain export.csv",
  baseline: loadBaseline(),
  isOriginUpload: false,
  comparedOriginFileName: "",
  selectedId: "",
  filter: "all",
  search: "",
  approved: new Set(),
  notice: "Demo comparison loaded — no data will be written to Gain.",
};
state.selectedId = state.reviews[0]?.reviewId ?? "";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dealsForRun() {
  return state.isOriginUpload
    ? filterOriginDeals(state.originDeals, state.baseline)
    : state.originDeals;
}

function skippedDeals() {
  return state.isOriginUpload ? state.originDeals.length - dealsForRun().length : 0;
}

function metrics() {
  return {
    scanned: dealsForRun().length,
    matched: state.reviews.filter((deal) => deal.status !== "unmatched").length,
    missing: state.reviews.reduce(
      (total, deal) =>
        total + deal.diffs.filter((diff) => diff.status === "missing").length,
      0,
    ),
    conflicts: state.reviews.reduce(
      (total, deal) =>
        total + deal.diffs.filter((diff) => diff.status === "conflict").length,
      0,
    ),
    unmatched: state.reviews.filter((deal) => deal.status === "unmatched").length,
  };
}

function filteredReviews() {
  const query = state.search.trim().toLowerCase();
  return state.reviews.filter((deal) => {
    const filterMatch = state.filter === "all" || deal.status === state.filter;
    const searchMatch =
      !query ||
      `${deal.target} ${deal.buyer} ${deal.originId} ${deal.gainId}`
        .toLowerCase()
        .includes(query);
    return filterMatch && searchMatch;
  });
}

function renderFiles() {
  elements.originFileName.textContent = state.originFileName;
  elements.gainFileName.textContent = state.gainFileName;
  elements.originFileCount.textContent = state.isOriginUpload
    ? `${dealsForRun().length} to review of ${state.originDeals.length} total deals`
    : `${state.originDeals.length} completed deals ready`;
  elements.gainFileCount.textContent = `${state.gainDeals.length} completed deals ready`;
}

function renderBaseline() {
  if (state.baseline) {
    elements.baselineHeadline.textContent =
      `Last completed cutoff: ${state.baseline.newestTarget} · ${state.baseline.newestSourceDate}`;
    elements.baselineDescription.textContent =
      `${state.baseline.totalChecked} baseline rows stored in this browser. ` +
      "Date plus company ID/name controls filtering.";
  } else {
    elements.baselineHeadline.textContent = "First run — every Origin deal will be checked";
    elements.baselineDescription.textContent =
      "Complete the first run to save a rolling baseline in this browser.";
  }

  if (state.isOriginUpload) {
    elements.baselineRunSummary.hidden = false;
    elements.baselineRunSummary.innerHTML =
      `<strong>${dealsForRun().length} to review</strong>` +
      `<small>${skippedDeals()} cutoff/unchanged skipped</small>`;
  } else {
    elements.baselineRunSummary.hidden = true;
  }

  elements.completeRun.disabled =
    !state.isOriginUpload || state.comparedOriginFileName !== state.originFileName;
  elements.exportBaseline.disabled = !state.baseline;
  elements.exportEligible.disabled = !state.isOriginUpload || !dealsForRun().length;
}

function renderMetrics() {
  const values = metrics();
  const cards = [
    ["Origin deals to review", values.scanned, "After cutoff filtering", ""],
    ["Safe matches", values.matched, "Linked to Gain", ""],
    ["Missing fields", values.missing, "Eligible to add", "metric-mint"],
    ["Conflicts", values.conflicts, "Need a decision", "metric-amber"],
    ["Unmatched", values.unmatched, "Need deal matching", "metric-rose"],
  ];
  elements.metrics.innerHTML = cards
    .map(
      ([label, value, note, className]) =>
        `<article class="${className}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`,
    )
    .join("");
}

function renderFilters() {
  const filters = ["all", "missing", "conflict", "unmatched", "aligned"];
  elements.filterRow.innerHTML = filters
    .map(
      (filter) =>
        `<button type="button" class="filter${state.filter === filter ? " active" : ""}" data-filter="${filter}">` +
        `${filter === "all" ? "All" : statusLabel(filter)}</button>`,
    )
    .join("");
}

function renderQueue() {
  const deals = filteredReviews();
  elements.queueCount.textContent = String(deals.length);
  if (!deals.length) {
    elements.dealList.innerHTML =
      '<p class="empty-state">No deals match this filter.</p>';
    return;
  }

  elements.dealList.innerHTML = deals
    .map(
      (deal) =>
        `<button class="deal-row${state.selectedId === deal.reviewId ? " selected" : ""}" ` +
        `type="button" data-review-id="${escapeHtml(deal.reviewId)}">` +
        `<span class="status-dot status-${deal.status}"></span>` +
        '<span class="deal-row-copy">' +
        `<strong>${escapeHtml(deal.target)}</strong>` +
        `<span>${escapeHtml(deal.buyer)}</span>` +
        `<small>${escapeHtml(deal.completionDate)}</small>` +
        "</span>" +
        `<span class="status-label status-${deal.status}">${statusLabel(deal.status)}</span>` +
        "</button>",
    )
    .join("");
}

function renderDetail() {
  const selected =
    state.reviews.find((deal) => deal.reviewId === state.selectedId) ?? state.reviews[0];
  if (!selected) {
    elements.detail.innerHTML =
      '<div class="empty-detail"><strong>No deal selected</strong><span>Choose a deal from the review queue.</span></div>';
    return;
  }

  const rows = selected.diffs.length
    ? selected.diffs
        .map((diff) => {
          const approvalKey = `${selected.reviewId}:${diff.key}`;
          const isApproved = state.approved.has(approvalKey);
          return (
            '<div class="comparison-row" role="row">' +
            '<div class="field-name">' +
            `<span class="status-dot status-${diff.status}"></span>` +
            `<strong>${escapeHtml(diff.label)}</strong>` +
            `<small>${diff.status === "missing" ? "Missing on Gain" : diff.status === "conflict" ? "Values differ" : "No safe match"}</small>` +
            "</div>" +
            `<div class="value-cell origin-value">${escapeHtml(diff.originValue)}</div>` +
            `<div class="value-cell${diff.status === "missing" ? " blank-value" : ""}">${escapeHtml(diff.gainValue)}</div>` +
            "<div>" +
            (diff.status === "missing"
              ? `<button class="approval-button${isApproved ? " approved" : ""}" type="button" ` +
                `data-approval-key="${escapeHtml(approvalKey)}" aria-pressed="${isApproved}">` +
                `${isApproved ? "Approved" : "Approve add"}</button>`
              : '<span class="locked-decision">Manual review</span>') +
            "</div></div>"
          );
        })
        .join("")
    : '<div class="all-aligned"><strong>Everything is aligned.</strong><span>No Origin fields need to be added to this Gain deal card.</span></div>';

  elements.detail.innerHTML =
    '<div class="detail-header">' +
    "<div>" +
    `<p class="eyebrow">${escapeHtml(selected.originId)} → ${escapeHtml(selected.gainId || "No Gain match")}</p>` +
    `<h2>${escapeHtml(selected.target)}</h2>` +
    `<p>${escapeHtml(selected.buyer)} · Completed ${escapeHtml(selected.completionDate)}</p>` +
    "</div>" +
    '<div class="confidence-card"><span>Match confidence</span>' +
    `<strong>${selected.matchConfidence}%</strong></div></div>` +
    '<div class="provenance-strip">' +
    `<div><span>Origin classification</span><strong>${escapeHtml(selected.sourceType)}</strong></div>` +
    `<div><span>Intelligence date</span><strong>${escapeHtml(selected.sourceDate)}</strong></div>` +
    "<div><span>Workflow</span><strong>Reviewer approval required</strong></div>" +
    "</div>" +
    '<div class="comparison-heading"><div><h3>Field comparison</h3>' +
    "<p>Approve safe blank-field additions. Conflicts remain locked for a manual decision.</p></div>" +
    '<button class="button button-quiet" id="approve-all-safe" type="button">Approve all safe</button></div>' +
    '<div class="comparison-table" role="table" aria-label="Field comparison">' +
    '<div class="comparison-row comparison-labels" role="row"><span>Field</span><span>Origin value</span><span>Current Gain value</span><span>Decision</span></div>' +
    rows +
    "</div>";
}

function renderActions() {
  elements.notice.textContent = state.notice;
  elements.exportPatch.textContent = `Export approved (${state.approved.size})`;
}

function renderAll() {
  renderFiles();
  renderBaseline();
  renderMetrics();
  renderFilters();
  renderQueue();
  renderDetail();
  renderActions();
}

function setNotice(message) {
  state.notice = message;
  renderActions();
}

async function handleDealFile(file, source) {
  try {
    const rows = parseCsv(await file.text());
    const deals = canonicalise(rows).filter((deal) => deal.target);
    if (!deals.length) throw new Error("No target/company column was detected.");

    if (source === "origin") {
      state.originDeals = deals;
      state.originFileName = file.name;
      state.isOriginUpload = true;
      state.comparedOriginFileName = "";
      state.reviews = [];
      state.selectedId = "";
      state.approved = new Set();
      const newCount = filterOriginDeals(deals, state.baseline).length;
      state.notice = state.baseline
        ? `${file.name} loaded: ${newCount} new or updated deals since ${state.baseline.newestSourceDate}; ${deals.length - newCount} unchanged/older deals skipped.`
        : `${file.name} loaded for the first run. All ${deals.length} deals are new.`;
    } else {
      state.gainDeals = deals;
      state.gainFileName = file.name;
      state.notice = `${file.name} loaded. Select Compare files when both exports are ready.`;
    }
    renderAll();
  } catch (error) {
    setNotice(error instanceof Error ? error.message : "The file could not be read.");
  }
}

function runComparison() {
  const eligible = state.isOriginUpload ? dealsForRun() : state.originDeals;
  state.reviews = createReviewQueue(eligible, state.gainDeals);
  state.selectedId = state.reviews[0]?.reviewId ?? "";
  state.approved = new Set();
  state.filter = "all";
  if (state.isOriginUpload) state.comparedOriginFileName = state.originFileName;
  state.notice =
    `Comparison complete: ${eligible.length} eligible Origin deals checked against ` +
    `${state.gainDeals.length} Gain deals; ${skippedDeals()} cutoff/unchanged deals skipped.`;
  renderAll();
}

function restoreDemo() {
  state.originDeals = DEMO_ORIGIN;
  state.gainDeals = DEMO_GAIN;
  state.reviews = createReviewQueue(DEMO_ORIGIN, DEMO_GAIN);
  state.selectedId = state.reviews[0]?.reviewId ?? "";
  state.originFileName = "Demo Origin export.csv";
  state.gainFileName = "Demo Gain export.csv";
  state.isOriginUpload = false;
  state.comparedOriginFileName = "";
  state.approved = new Set();
  state.filter = "all";
  state.search = "";
  elements.search.value = "";
  state.notice = "Demo comparison restored — no data will be written to Gain.";
  renderAll();
}

function completeRun() {
  if (!state.isOriginUpload || state.comparedOriginFileName !== state.originFileName) {
    setNotice("Compare the current Origin export before completing this run.");
    return;
  }
  const baseline = createBaseline(
    state.originDeals,
    state.baseline,
    state.originFileName,
    new Date().toISOString(),
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
  state.baseline = baseline;
  state.notice =
    `Run completed. This browser now remembers ${baseline.totalChecked} deals through ` +
    `${baseline.newestTarget} (${baseline.newestSourceDate}).`;
  renderAll();
}

function approveAllSafe() {
  state.reviews.forEach((deal) => {
    deal.diffs.forEach((diff) => {
      if (diff.status === "missing") {
        state.approved.add(`${deal.reviewId}:${diff.key}`);
      }
    });
  });
  state.notice = "All safe blank-field additions have been approved for export.";
  renderAll();
}

function download(name, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportPatch() {
  if (!state.approved.size) {
    setNotice("Approve at least one safe addition before exporting a patch.");
    return;
  }
  const csv = buildPatchCsv(state.reviews, state.approved);
  download("gain-approved-field-patch.csv", csv, "text/csv;charset=utf-8");
  setNotice(`${state.approved.size} approved field updates exported. Gain has not been changed.`);
}

function exportEligible() {
  const eligible = dealsForRun();
  if (!eligible.length) {
    setNotice("There are no new or updated Origin deals to export.");
    return;
  }
  download(
    "origin-new-or-updated-deals.csv",
    buildEligibleDealsCsv(eligible),
    "text/csv;charset=utf-8",
  );
  setNotice(`${eligible.length} new or updated Origin deals exported.`);
}

function exportBaseline() {
  if (!state.baseline) {
    setNotice("Complete a run before exporting a baseline backup.");
    return;
  }
  download(
    "completed-deals-baseline.json",
    JSON.stringify(state.baseline, null, 2),
    "application/json;charset=utf-8",
  );
  setNotice("Baseline backup exported. Import it when using a different browser or device.");
}

async function importBaseline(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (!isValidBaseline(parsed)) {
      throw new Error("This is not a valid Completed deals check baseline file.");
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    state.baseline = parsed;
    state.comparedOriginFileName = "";
    state.reviews = [];
    state.selectedId = "";
    state.approved = new Set();
    state.notice =
      `Baseline imported: ${parsed.totalChecked} deals through ${parsed.newestTarget} ` +
      `(${parsed.newestSourceDate}). Upload the latest Origin export next.`;
    renderAll();
  } catch (error) {
    setNotice(error instanceof Error ? error.message : "The baseline could not be imported.");
  } finally {
    elements.baselineInput.value = "";
  }
}

elements.originInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) handleDealFile(file, "origin");
});
elements.gainInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) handleDealFile(file, "gain");
});
elements.baselineInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importBaseline(file);
});
elements.compare.addEventListener("click", runComparison);
elements.restoreDemo.addEventListener("click", restoreDemo);
elements.exportPatch.addEventListener("click", exportPatch);
elements.exportEligible.addEventListener("click", exportEligible);
elements.completeRun.addEventListener("click", completeRun);
elements.exportBaseline.addEventListener("click", exportBaseline);
elements.importBaseline.addEventListener("click", () => elements.baselineInput.click());
elements.search.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderQueue();
});
elements.filterRow.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  renderFilters();
  renderQueue();
});
elements.dealList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-id]");
  if (!button) return;
  state.selectedId = button.dataset.reviewId;
  renderQueue();
  renderDetail();
});
elements.detail.addEventListener("click", (event) => {
  const approval = event.target.closest("[data-approval-key]");
  if (approval) {
    const key = approval.dataset.approvalKey;
    if (state.approved.has(key)) state.approved.delete(key);
    else state.approved.add(key);
    renderDetail();
    renderActions();
    return;
  }
  if (event.target.closest("#approve-all-safe")) approveAllSafe();
});

renderAll();
