"use client";

import { useEffect, useMemo, useState } from "react";
import {
  canonicalise,
  createReviewQueue,
  type CanonicalDeal,
  type FieldDiff,
  type ReviewDeal,
} from "./deal-matcher";
import { readDealRows } from "./file-reader";
import {
  buildDealSnapshots,
  dealFingerprint,
  filterOriginDeals,
  mergeDealSnapshots,
  newestOriginDeal,
  type BaselineDealSnapshot,
} from "./origin-baseline";

type OriginBaseline = {
  version: 2;
  savedAt: string;
  sourceFileName: string;
  newestDealKey: string;
  newestTarget: string;
  newestSourceDate: string;
  dealKeys: string[];
  dealSnapshots: BaselineDealSnapshot[];
  totalChecked: number;
};

const DEMO_ORIGIN: CanonicalDeal[] = [
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

const DEMO_GAIN: CanonicalDeal[] = [
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

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function statusLabel(status: ReviewDeal["status"]) {
  if (status === "missing") return "Ready to add";
  if (status === "conflict") return "Review conflict";
  if (status === "unmatched") return "Match required";
  return "Aligned";
}

export default function Home() {
  const [originDeals, setOriginDeals] = useState(DEMO_ORIGIN);
  const [gainDeals, setGainDeals] = useState(DEMO_GAIN);
  const [reviews, setReviews] = useState(() => createReviewQueue(DEMO_ORIGIN, DEMO_GAIN));
  const [originFileName, setOriginFileName] = useState("Demo Origin export.csv");
  const [gainFileName, setGainFileName] = useState("Demo Gain export.csv");
  const [baseline, setBaseline] = useState<OriginBaseline | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [baselineError, setBaselineError] = useState("");
  const [isOriginUpload, setIsOriginUpload] = useState(false);
  const [comparedOriginFileName, setComparedOriginFileName] = useState("");
  const [selectedId, setSelectedId] = useState(() => reviews[0]?.reviewId ?? "");
  const [filter, setFilter] = useState<"all" | ReviewDeal["status"]>("all");
  const [search, setSearch] = useState("");
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("Demo comparison loaded — no data will be written to Gain.");

  useEffect(() => {
    let active = true;

    async function loadBaseline() {
      try {
        const response = await fetch("/api/origin-baseline", { cache: "no-store" });
        if (!response.ok) throw new Error("The rolling baseline could not be loaded.");
        const payload = (await response.json()) as { baseline: OriginBaseline | null };
        if (active) setBaseline(payload.baseline);
      } catch (error) {
        if (active) {
          setBaselineError(error instanceof Error ? error.message : "The rolling baseline could not be loaded.");
        }
      } finally {
        if (active) setBaselineLoading(false);
      }
    }

    loadBaseline();
    return () => {
      active = false;
    };
  }, []);

  const originDealsForRun = useMemo(
    () => (isOriginUpload ? filterOriginDeals(originDeals, baseline) : originDeals),
    [baseline, isOriginUpload, originDeals],
  );
  const skippedOriginDeals = isOriginUpload ? originDeals.length - originDealsForRun.length : 0;
  const selected = reviews.find((deal) => deal.reviewId === selectedId) ?? reviews[0];

  const metrics = useMemo(() => {
    const missing = reviews.reduce(
      (total, deal) => total + deal.diffs.filter((diff) => diff.status === "missing").length,
      0,
    );
    const conflicts = reviews.reduce(
      (total, deal) => total + deal.diffs.filter((diff) => diff.status === "conflict").length,
      0,
    );
    return {
      scanned: originDealsForRun.length,
      matched: reviews.filter((deal) => deal.status !== "unmatched").length,
      missing,
      conflicts,
      unmatched: reviews.filter((deal) => deal.status === "unmatched").length,
    };
  }, [originDealsForRun.length, reviews]);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reviews.filter((deal) => {
      const filterMatch = filter === "all" || deal.status === filter;
      const searchMatch = !query || `${deal.target} ${deal.buyer} ${deal.originId} ${deal.gainId}`.toLowerCase().includes(query);
      return filterMatch && searchMatch;
    });
  }, [filter, reviews, search]);

  async function handleFile(file: File, source: "origin" | "gain") {
    try {
      const rows = await readDealRows(file);
      const deals = canonicalise(rows, source).filter((deal) => deal.target);
      if (!deals.length) {
        const foundColumns = Object.keys(rows[0] ?? {}).slice(0, 6).join(", ");
        throw new Error(
          foundColumns
            ? `No target/company column was detected. Found: ${foundColumns}.`
            : "No target/company column was detected.",
        );
      }

      if (source === "origin") {
        setOriginDeals(deals);
        setOriginFileName(file.name);
        setIsOriginUpload(true);
        setComparedOriginFileName("");
        setReviews([]);
        setSelectedId("");
        setApproved(new Set());

        const newCount = filterOriginDeals(deals, baseline).length;
        setNotice(
          baseline
            ? `${file.name} loaded: ${newCount} new or updated deals since ${baseline.newestSourceDate}; ${deals.length - newCount} unchanged/older deals skipped.`
            : `${file.name} loaded for the first run. All ${deals.length} deals are new.`,
        );
      } else {
        setGainDeals(deals);
        setGainFileName(file.name);
        setNotice(`${file.name} loaded. Select Compare files when both exports are ready.`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The file could not be read.");
    }
  }

  function runComparison() {
    if (baselineLoading) {
      setNotice("Wait a moment while the rolling Origin baseline loads.");
      return;
    }
    if (baselineError) {
      setNotice("The rolling baseline is unavailable, so comparison is paused to avoid rechecking old deals.");
      return;
    }

    const dealsToCompare = isOriginUpload ? originDealsForRun : originDeals;
    const nextReviews = createReviewQueue(dealsToCompare, gainDeals);
    setReviews(nextReviews);
    setSelectedId(nextReviews[0]?.reviewId ?? "");
    setApproved(new Set());
    setFilter("all");
    if (isOriginUpload) setComparedOriginFileName(originFileName);
    setNotice(
      `Comparison complete: ${dealsToCompare.length} eligible Origin deals checked against ${gainDeals.length} Gain deals; ${skippedOriginDeals} cutoff/unchanged deals skipped.`,
    );
  }

  function restoreDemo() {
    const nextReviews = createReviewQueue(DEMO_ORIGIN, DEMO_GAIN);
    setOriginDeals(DEMO_ORIGIN);
    setGainDeals(DEMO_GAIN);
    setReviews(nextReviews);
    setSelectedId(nextReviews[0]?.reviewId ?? "");
    setOriginFileName("Demo Origin export.csv");
    setGainFileName("Demo Gain export.csv");
    setIsOriginUpload(false);
    setComparedOriginFileName("");
    setApproved(new Set());
    setNotice("Demo comparison restored — no data will be written to Gain.");
  }

  async function completeRunAndSaveBaseline() {
    if (!isOriginUpload || comparedOriginFileName !== originFileName) {
      setNotice("Compare the current Origin export before completing this run.");
      return;
    }

    try {
      const newestDeal = newestOriginDeal(originDeals);
      const mergedSnapshots = mergeDealSnapshots(
        baseline?.dealSnapshots ?? [],
        buildDealSnapshots(originDeals),
      );
      const mergedKeys = mergedSnapshots.map(
        (snapshot) => `${snapshot.identity}|updated:${snapshot.sourceDate.trim()}`,
      );
      const nextBaseline: OriginBaseline = {
        version: 2,
        savedAt: new Date().toISOString(),
        sourceFileName: originFileName,
        newestDealKey: newestDeal ? dealFingerprint(newestDeal) : baseline?.newestDealKey ?? "",
        newestTarget: newestDeal?.target || baseline?.newestTarget || "No target supplied",
        newestSourceDate: newestDeal?.sourceDate || baseline?.newestSourceDate || "Not supplied",
        dealKeys: mergedKeys,
        dealSnapshots: mergedSnapshots,
        totalChecked: mergedSnapshots.length,
      };

      const response = await fetch("/api/origin-baseline", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextBaseline),
      });
      if (!response.ok) throw new Error("The completed-run baseline could not be saved.");

      const payload = (await response.json()) as { baseline: OriginBaseline };
      setBaseline(payload.baseline);
      setNotice(
        `Run completed. The rolling baseline now includes ${payload.baseline.totalChecked} deals through ${payload.baseline.newestTarget} (${payload.baseline.newestSourceDate}).`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The completed-run baseline could not be saved.");
    }
  }

  function toggleApproval(deal: ReviewDeal, diff: FieldDiff) {
    const key = `${deal.reviewId}:${diff.key}`;
    setApproved((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function approveAllSafe() {
    const next = new Set(approved);
    reviews.forEach((deal) => {
      deal.diffs.forEach((diff) => {
        if (diff.status === "missing") next.add(`${deal.reviewId}:${diff.key}`);
      });
    });
    setApproved(next);
    setNotice("All safe blank-field additions have been approved for export.");
  }

  function exportPatch() {
    const rows: Array<Array<string | number>> = [
      ["gain_deal_id", "origin_deal_id", "target", "field", "current_gain_value", "proposed_value", "source_type", "source_date", "match_confidence"],
    ];

    reviews.forEach((deal) => {
      deal.diffs.forEach((diff) => {
        if (approved.has(`${deal.reviewId}:${diff.key}`)) {
          rows.push([
            deal.gainId,
            deal.originId,
            deal.target,
            diff.label,
            diff.gainValue,
            diff.originValue,
            deal.sourceType,
            deal.sourceDate,
            deal.matchConfidence,
          ]);
        }
      });
    });

    if (rows.length === 1) {
      setNotice("Approve at least one safe addition before exporting a patch.");
      return;
    }

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "gain-approved-field-patch.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`${rows.length - 1} approved field updates exported. Gain has not been changed.`);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-copy">
            <strong>Completed deals check</strong>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="mode-pill"><span className="pulse-dot" /> Dry-run mode</span>
          <button className="button button-quiet" type="button" onClick={restoreDemo}>Restore demo</button>
          <button className="button button-dark" type="button" onClick={exportPatch}>
            Export approved ({approved.size})
          </button>
        </div>
      </header>

      <section className="dashboard-intro">
        <div>
          <p className="eyebrow">Completed deals</p>
          <h1>Compare Origin and Gain exports</h1>
          <p className="intro-copy">
            Upload the latest Origin export and the current Gain export as CSV or Excel. Previously completed Origin deals are skipped automatically.
          </p>
        </div>
        <div className="rule-note">
          <strong>Add to blanks only</strong>
          <span>Existing Gain values are never overwritten. Conflicts stay in review.</span>
        </div>
      </section>

      <section className="baseline-strip" aria-label="Rolling Origin baseline">
        <div className="baseline-copy">
          <p className="eyebrow">Rolling Origin baseline</p>
          <strong>
            {baselineLoading
              ? "Loading the last completed run…"
              : baselineError
                ? "Baseline unavailable"
                : baseline
                  ? `Last completed cutoff: ${baseline.newestTarget} · ${baseline.newestSourceDate}`
                  : "First run — every Origin deal will be checked"}
          </strong>
          <span>
            {baseline
              ? `${baseline.totalChecked} baseline rows saved locally. Date plus company ID/name controls filtering.`
              : "After review, complete the run once to make this export the baseline for next time."}
          </span>
        </div>
        <div className="baseline-actions">
          {isOriginUpload && (
            <span>
              <strong>{originDealsForRun.length} to review</strong>
              <small>{skippedOriginDeals} cutoff/unchanged skipped</small>
            </span>
          )}
          <button
            className="button button-dark"
            type="button"
            onClick={completeRunAndSaveBaseline}
            disabled={
              baselineLoading ||
              Boolean(baselineError) ||
              !isOriginUpload ||
              comparedOriginFileName !== originFileName
            }
          >
            Complete run &amp; save baseline
          </button>
        </div>
      </section>

      <section className="upload-grid" aria-label="Deal export files">
        <label className="upload-card" data-source="origin">
          <input
            type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0], "origin")}
          />
          <img className="source-logo source-logo-origin" src="/origin-logo.png" alt="Origin" />
          <span className="upload-source">Origin export</span>
          <strong>{originFileName}</strong>
          <span>
            {isOriginUpload
              ? `${originDealsForRun.length} to review of ${originDeals.length} total deals`
              : `${originDeals.length} completed deals ready`}
          </span>
          <small>Choose CSV or Excel</small>
        </label>

        <div className="compare-card">
          <div className="flow-line"><span>Origin</span><i /><span>Gain</span></div>
          <button className="button button-accent" type="button" onClick={runComparison}>Compare files</button>
          <p>{notice}</p>
        </div>

        <label className="upload-card" data-source="gain">
          <input
            type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0], "gain")}
          />
          <img className="source-logo source-logo-gain" src="/gain-logo.png" alt="Gain" />
          <span className="upload-source">Gain export</span>
          <strong>{gainFileName}</strong>
          <span>{gainDeals.length} completed deals ready</span>
          <small>Choose CSV or Excel</small>
        </label>
      </section>

      <section className="metric-grid" aria-label="Comparison summary">
        <article><span>Origin deals to review</span><strong>{metrics.scanned}</strong><small>After cutoff filtering</small></article>
        <article><span>Safe matches</span><strong>{metrics.matched}</strong><small>Linked to Gain</small></article>
        <article className="metric-mint"><span>Missing fields</span><strong>{metrics.missing}</strong><small>Eligible to add</small></article>
        <article className="metric-amber"><span>Conflicts</span><strong>{metrics.conflicts}</strong><small>Need a decision</small></article>
        <article className="metric-rose"><span>Unmatched</span><strong>{metrics.unmatched}</strong><small>Need deal matching</small></article>
      </section>

      <section className="workspace">
        <aside className="queue-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Review queue</p>
              <h2>Completed deals</h2>
            </div>
            <span className="count-badge">{filteredReviews.length}</span>
          </div>

          <label className="search-box">
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Target, buyer or ID" />
          </label>

          <div className="filter-row" aria-label="Queue filters">
            {(["all", "missing", "conflict", "unmatched", "aligned"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "filter active" : "filter"}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All" : statusLabel(value)}
              </button>
            ))}
          </div>

          <div className="deal-list">
            {filteredReviews.map((deal) => (
              <button
                key={deal.reviewId}
                className={selected?.reviewId === deal.reviewId ? "deal-row selected" : "deal-row"}
                type="button"
                onClick={() => setSelectedId(deal.reviewId)}
              >
                <span className={`status-dot status-${deal.status}`} />
                <span className="deal-row-copy">
                  <strong>{deal.target}</strong>
                  <span>{deal.buyer}</span>
                  <small>{deal.completionDate}</small>
                </span>
                <span className={`status-label status-${deal.status}`}>{statusLabel(deal.status)}</span>
              </button>
            ))}
            {!filteredReviews.length && <p className="empty-state">No deals match this filter.</p>}
          </div>
        </aside>

        <section className="detail-panel">
          {selected ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">{selected.originId} → {selected.gainId || "No Gain match"}</p>
                  <h2>{selected.target}</h2>
                  <p>{selected.buyer} · Completed {selected.completionDate}</p>
                </div>
                <div className="confidence-card">
                  <span>Match confidence</span>
                  <strong>{selected.matchConfidence}%</strong>
                  <small>{selected.matchReason}</small>
                </div>
              </div>

              <div className="provenance-strip">
                <div><span>Origin classification</span><strong>{selected.sourceType}</strong></div>
                <div><span>Intelligence date</span><strong>{selected.sourceDate}</strong></div>
                <div><span>Workflow</span><strong>Reviewer approval required</strong></div>
              </div>

              <div className="comparison-heading">
                <div>
                  <h3>Field comparison</h3>
                  <p>Approve safe blank-field additions. Conflicts remain locked for a manual decision.</p>
                </div>
                <button className="button button-quiet" type="button" onClick={approveAllSafe}>Approve all safe</button>
              </div>

              <div className="comparison-table" role="table" aria-label="Field comparison">
                <div className="comparison-row comparison-labels" role="row">
                  <span>Field</span><span>Origin value</span><span>Current Gain value</span><span>Decision</span>
                </div>
                {selected.diffs.map((diff) => {
                  const approvalKey = `${selected.reviewId}:${diff.key}`;
                  const isApproved = approved.has(approvalKey);
                  return (
                    <div className="comparison-row" role="row" key={`${selected.reviewId}-${diff.key}`}>
                      <div className="field-name">
                        <span className={`status-dot status-${diff.status}`} />
                        <strong>{diff.label}</strong>
                        <small>{diff.status === "missing" ? "Missing on Gain" : diff.status === "conflict" ? "Values differ" : "No safe match"}</small>
                      </div>
                      <div className="value-cell origin-value">{diff.originValue}</div>
                      <div className={diff.status === "missing" ? "value-cell blank-value" : "value-cell"}>{diff.gainValue}</div>
                      <div>
                        {diff.status === "missing" ? (
                          <button
                            className={isApproved ? "approval-button approved" : "approval-button"}
                            type="button"
                            onClick={() => toggleApproval(selected, diff)}
                            aria-pressed={isApproved}
                          >
                            {isApproved ? "Approved" : "Approve add"}
                          </button>
                        ) : (
                          <span className="locked-decision">Manual review</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!selected.diffs.length && (
                  <div className="all-aligned">
                    <strong>Everything is aligned.</strong>
                    <span>No Origin fields need to be added to this Gain deal card.</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-detail"><strong>No deal selected</strong><span>Choose a deal from the review queue.</span></div>
          )}
        </section>
      </section>

      <footer>
        <span>Local MVP · CSV and Excel files are processed in this browser session</span>
        <span>Rolling deal keys are saved locally and excluded from GitHub</span>
        <span>Origin remains read-only · Gain changes require export and approval</span>
      </footer>
    </main>
  );
}
