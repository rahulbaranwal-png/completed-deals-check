"use client";

import { useEffect, useMemo, useState } from "react";

type RawRow = Record<string, string>;

type CanonicalDeal = {
  id: string;
  target: string;
  buyer: string;
  seller: string;
  completionDate: string;
  enterpriseValue: string;
  revenue: string;
  ebitda: string;
  stake: string;
  advisers: string;
  sourceType: string;
  sourceDate: string;
};

type FieldKey =
  | "enterpriseValue"
  | "revenue"
  | "ebitda"
  | "stake"
  | "advisers"
  | "seller"
  | "completionDate";

type FieldDiff = {
  key: FieldKey | "deal";
  label: string;
  originValue: string;
  gainValue: string;
  status: "missing" | "conflict" | "unmatched";
};

type ReviewDeal = {
  reviewId: string;
  originId: string;
  gainId: string;
  target: string;
  buyer: string;
  completionDate: string;
  sourceType: string;
  sourceDate: string;
  matchConfidence: number;
  status: "missing" | "conflict" | "unmatched" | "aligned";
  diffs: FieldDiff[];
};

type OriginBaseline = {
  version: 1;
  savedAt: string;
  sourceFileName: string;
  newestDealKey: string;
  newestTarget: string;
  newestSourceDate: string;
  dealKeys: string[];
  totalChecked: number;
};

const FIELD_DEFINITIONS: Array<{ key: FieldKey; label: string }> = [
  { key: "enterpriseValue", label: "Enterprise value" },
  { key: "revenue", label: "Revenue" },
  { key: "ebitda", label: "EBITDA" },
  { key: "stake", label: "Stake acquired" },
  { key: "advisers", label: "Advisers" },
  { key: "seller", label: "Seller" },
  { key: "completionDate", label: "Completion date" },
];

const ALIASES: Record<keyof CanonicalDeal, string[]> = {
  id: ["deal_id", "id", "dealid", "companyid", "origin_deal_id", "gain_deal_id"],
  target: ["target", "target_name", "company", "asset", "target_company"],
  buyer: ["buyer", "acquirer", "investor", "buyer_name", "announcedbuyer"],
  seller: ["seller", "vendor", "seller_name"],
  completionDate: ["completion_date", "completed_date", "close_date", "closed_date"],
  enterpriseValue: ["enterprise_value", "deal_value", "ev", "transaction_value"],
  revenue: ["revenue", "sales", "target_revenue", "marketedrevenue"],
  ebitda: ["ebitda", "target_ebitda", "marketedebitda"],
  stake: ["stake", "stake_acquired", "percentage_acquired", "ownership"],
  advisers: [
    "advisers",
    "advisors",
    "financial_advisers",
    "financial_advisors",
    "sellsideadvisors",
    "buysideadvisors",
  ],
  sourceType: ["source_type", "source", "intelligence_type", "provenance"],
  sourceDate: ["source_date", "intelligence_date", "updated_at", "last_updated", "lastupdated"],
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

function normaliseHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normaliseValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normaliseName(value: string) {
  return normaliseValue(
    value.replace(/\b(group|holdings|limited|ltd|incorporated|inc|plc|llc)\b/gi, ""),
  );
}

function dealKey(deal: CanonicalDeal) {
  const id = deal.id && !deal.id.startsWith("ROW-") ? normaliseValue(deal.id) : "";
  const target = normaliseName(deal.target);
  const buyer = normaliseName(deal.buyer);
  return id ? `id:${id}|target:${target}|buyer:${buyer}` : `target:${target}|buyer:${buyer}`;
}

function pick(row: RawRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined) return value.trim();
  }
  return "";
}

function pickMany(row: RawRow, aliases: string[]) {
  return Array.from(
    new Set(aliases.map((alias) => row[alias]?.trim()).filter((value): value is string => Boolean(value))),
  ).join("; ");
}

function canonicalise(rows: RawRow[]): CanonicalDeal[] {
  return rows.map((row, index) => {
    const cleaned = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normaliseHeader(key), value]),
    );
    const originator = pick(cleaned, ["originator"]);
    const suppliedSourceType = pick(cleaned, ALIASES.sourceType);

    return {
      id: pick(cleaned, ALIASES.id) || `ROW-${index + 1}`,
      target: pick(cleaned, ALIASES.target),
      buyer: pick(cleaned, ALIASES.buyer),
      seller: pick(cleaned, ALIASES.seller),
      completionDate: pick(cleaned, ALIASES.completionDate),
      enterpriseValue: pick(cleaned, ALIASES.enterpriseValue),
      revenue: pick(cleaned, ALIASES.revenue),
      ebitda: pick(cleaned, ALIASES.ebitda),
      stake: pick(cleaned, ALIASES.stake),
      advisers: pickMany(cleaned, ALIASES.advisers),
      sourceType:
        suppliedSourceType ||
        (normaliseValue(originator) === "aggregation"
          ? "Aggregation"
          : originator
            ? "Prop intelligence"
            : "Not supplied"),
      sourceDate: pick(cleaned, ALIASES.sourceDate) || "Not supplied",
    };
  });
}

function parseCsv(text: string): RawRow[] {
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) table.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) table.push(row);
  if (table.length < 2) throw new Error("The CSV needs a header row and at least one deal.");

  const headers = table[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return table.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function matchGainDeal(origin: CanonicalDeal, gainDeals: CanonicalDeal[]) {
  const exactId = gainDeals.find((deal) => deal.id && deal.id === origin.id);
  if (exactId) return { deal: exactId, confidence: 100 };

  const target = normaliseName(origin.target);
  const buyer = normaliseName(origin.buyer);
  const targetAndBuyer = gainDeals.find(
    (deal) => normaliseName(deal.target) === target && normaliseName(deal.buyer) === buyer,
  );
  if (targetAndBuyer) return { deal: targetAndBuyer, confidence: 96 };

  const targetAndDate = gainDeals.find(
    (deal) =>
      normaliseName(deal.target) === target &&
      Boolean(origin.completionDate) &&
      deal.completionDate === origin.completionDate,
  );
  if (targetAndDate) return { deal: targetAndDate, confidence: 88 };

  return null;
}

function createReviewQueue(originDeals: CanonicalDeal[], gainDeals: CanonicalDeal[]): ReviewDeal[] {
  return originDeals.map((origin, index) => {
    const match = matchGainDeal(origin, gainDeals);

    if (!match) {
      return {
        reviewId: `unmatched-${origin.id}-${index}`,
        originId: origin.id,
        gainId: "",
        target: origin.target || "Unnamed target",
        buyer: origin.buyer || "Buyer not supplied",
        completionDate: origin.completionDate || "Date not supplied",
        sourceType: origin.sourceType,
        sourceDate: origin.sourceDate,
        matchConfidence: 0,
        status: "unmatched" as const,
        diffs: [
          {
            key: "deal" as const,
            label: "Deal match",
            originValue: `${origin.target || "Unnamed target"} / ${origin.buyer || "Buyer not supplied"}`,
            gainValue: "No safe Gain match found",
            status: "unmatched" as const,
          },
        ],
      };
    }

    const diffs: FieldDiff[] = [];
    for (const field of FIELD_DEFINITIONS) {
      const originValue = origin[field.key];
      const gainValue = match.deal[field.key];
      if (!originValue) continue;

      if (!gainValue) {
        diffs.push({
          key: field.key,
          label: field.label,
          originValue,
          gainValue: "Blank",
          status: "missing",
        });
      } else if (normaliseValue(originValue) !== normaliseValue(gainValue)) {
        diffs.push({
          key: field.key,
          label: field.label,
          originValue,
          gainValue,
          status: "conflict",
        });
      }
    }

    const hasConflict = diffs.some((diff) => diff.status === "conflict");
    const hasMissing = diffs.some((diff) => diff.status === "missing");

    return {
      reviewId: `${origin.id}-${match.deal.id}`,
      originId: origin.id,
      gainId: match.deal.id,
      target: origin.target || match.deal.target || "Unnamed target",
      buyer: origin.buyer || match.deal.buyer || "Buyer not supplied",
      completionDate: origin.completionDate || match.deal.completionDate || "Date not supplied",
      sourceType: origin.sourceType,
      sourceDate: origin.sourceDate,
      matchConfidence: match.confidence,
      status: hasConflict ? "conflict" : hasMissing ? "missing" : "aligned",
      diffs,
    };
  });
}

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
  const [selectedId, setSelectedId] = useState(() => reviews[0]?.reviewId ?? "");
  const [filter, setFilter] = useState<"all" | ReviewDeal["status"]>("all");
  const [search, setSearch] = useState("");
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("Demo comparison loaded — no data will be written to Gain.");

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
      scanned: originDeals.length,
      matched: reviews.filter((deal) => deal.status !== "unmatched").length,
      missing,
      conflicts,
      unmatched: reviews.filter((deal) => deal.status === "unmatched").length,
    };
  }, [originDeals.length, reviews]);

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
      const rows = parseCsv(await file.text());
      const deals = canonicalise(rows).filter((deal) => deal.target);
      if (!deals.length) throw new Error("No target/company column was detected.");

      if (source === "origin") {
        setOriginDeals(deals);
        setOriginFileName(file.name);
      } else {
        setGainDeals(deals);
        setGainFileName(file.name);
      }
      setNotice(`${file.name} loaded. Select Compare files when both exports are ready.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The file could not be read.");
    }
  }

  function runComparison() {
    const nextReviews = createReviewQueue(originDeals, gainDeals);
    setReviews(nextReviews);
    setSelectedId(nextReviews[0]?.reviewId ?? "");
    setApproved(new Set());
    setFilter("all");
    setNotice(`Comparison complete: ${originDeals.length} Origin deals checked against ${gainDeals.length} Gain deals.`);
  }

  function restoreDemo() {
    const nextReviews = createReviewQueue(DEMO_ORIGIN, DEMO_GAIN);
    setOriginDeals(DEMO_ORIGIN);
    setGainDeals(DEMO_GAIN);
    setReviews(nextReviews);
    setSelectedId(nextReviews[0]?.reviewId ?? "");
    setOriginFileName("Demo Origin export.csv");
    setGainFileName("Demo Gain export.csv");
    setApproved(new Set());
    setNotice("Demo comparison restored — no data will be written to Gain.");
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
            Upload both files, review missing fields, then export approved Gain updates.
          </p>
        </div>
        <div className="rule-note">
          <strong>Add to blanks only</strong>
          <span>Existing Gain values are never overwritten. Conflicts stay in review.</span>
        </div>
      </section>

      <section className="upload-grid" aria-label="Deal export files">
        <label className="upload-card" data-source="origin">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0], "origin")}
          />
          <img className="source-logo source-logo-origin" src="/origin-logo.png" alt="Origin" />
          <span className="upload-source">Origin export</span>
          <strong>{originFileName}</strong>
          <span>{originDeals.length} completed deals ready</span>
          <small>Choose CSV</small>
        </label>

        <div className="compare-card">
          <div className="flow-line"><span>Origin</span><i /><span>Gain</span></div>
          <button className="button button-accent" type="button" onClick={runComparison}>Compare files</button>
          <p>{notice}</p>
        </div>

        <label className="upload-card" data-source="gain">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0], "gain")}
          />
          <img className="source-logo source-logo-gain" src="/gain-logo.png" alt="Gain" />
          <span className="upload-source">Gain export</span>
          <strong>{gainFileName}</strong>
          <span>{gainDeals.length} completed deals ready</span>
          <small>Choose CSV</small>
        </label>
      </section>

      <section className="metric-grid" aria-label="Comparison summary">
        <article><span>Origin deals</span><strong>{metrics.scanned}</strong><small>Scanned this run</small></article>
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
        <span>Local MVP · CSV files are processed in this browser session</span>
        <span>Origin remains read-only · Gain changes require export and approval</span>
      </footer>
    </main>
  );
}
