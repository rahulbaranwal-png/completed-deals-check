export const FIELD_DEFINITIONS = [
  { key: "enterpriseValue", label: "Enterprise value" },
  { key: "revenue", label: "Revenue" },
  { key: "ebitda", label: "EBITDA" },
  { key: "stake", label: "Stake acquired" },
  { key: "advisers", label: "Advisers" },
  { key: "seller", label: "Seller" },
  { key: "completionDate", label: "Completion date" },
];

export const ALIASES = {
  id: ["companyid", "deal_id", "id", "dealid", "origin_deal_id", "gain_deal_id"],
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

export function normaliseHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normaliseValue(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normaliseName(value) {
  return normaliseValue(
    String(value ?? "").replace(
      /\b(group|holdings|limited|ltd|incorporated|inc|plc|llc)\b/gi,
      "",
    ),
  );
}

function pick(row, aliases) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined) return String(value).trim();
  }
  return "";
}

function pickMany(row, aliases) {
  return Array.from(
    new Set(
      aliases
        .map((alias) => row[alias]?.trim())
        .filter((value) => Boolean(value)),
    ),
  ).join("; ");
}

export function canonicalise(rows) {
  return rows.map((row, index) => {
    const cleaned = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normaliseHeader(key), String(value ?? "")]),
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

export function parseCsv(text) {
  const table = [];
  let row = [];
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

  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");

  row.push(cell);
  if (row.some((value) => value.trim())) table.push(row);
  if (table.length < 2) {
    throw new Error("The CSV needs a header row and at least one deal.");
  }

  const headers = table[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return table.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

export function parseOriginDate(value) {
  const trimmed = String(value ?? "").trim();
  const dayFirst = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dayFirst) {
    return Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
  }

  const yearFirst = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yearFirst) {
    return Date.UTC(Number(yearFirst[1]), Number(yearFirst[2]) - 1, Number(yearFirst[3]));
  }

  return Number.NaN;
}

export function dealIdentity(deal) {
  const companyId =
    deal.id && !String(deal.id).startsWith("ROW-") ? normaliseValue(deal.id) : "";
  const target = normaliseName(deal.target);
  return companyId ? `company:${companyId}|target:${target}` : `target:${target}`;
}

export function dealFingerprint(deal) {
  return `${dealIdentity(deal)}|updated:${String(deal.sourceDate ?? "").trim()}`;
}

export function buildDealSnapshots(deals) {
  return deals.map((deal) => ({
    identity: dealIdentity(deal),
    companyId: deal.id,
    target: deal.target,
    sourceDate: deal.sourceDate,
  }));
}

export function mergeDealSnapshots(previous, current) {
  const merged = new Map(previous.map((snapshot) => [snapshot.identity, snapshot]));
  current.forEach((snapshot) => merged.set(snapshot.identity, snapshot));
  return Array.from(merged.values());
}

export function shouldReviewOriginDeal(deal, baseline) {
  if (!baseline) return true;

  const currentDate = parseOriginDate(deal.sourceDate);
  const cutoffDate = parseOriginDate(baseline.newestSourceDate);
  const previous = baseline.dealSnapshots.find(
    (snapshot) => snapshot.identity === dealIdentity(deal),
  );

  if (previous) {
    return String(previous.sourceDate).trim() !== String(deal.sourceDate).trim();
  }

  if (Number.isFinite(currentDate) && Number.isFinite(cutoffDate)) {
    return currentDate >= cutoffDate;
  }

  return true;
}

export function filterOriginDeals(deals, baseline) {
  return deals.filter((deal) => shouldReviewOriginDeal(deal, baseline));
}

export function newestOriginDeal(deals) {
  return deals.reduce((newest, deal) => {
    if (!newest) return deal;
    const dealDate = parseOriginDate(deal.sourceDate);
    const newestDate = parseOriginDate(newest.sourceDate);
    if (!Number.isFinite(dealDate)) return newest;
    if (!Number.isFinite(newestDate) || dealDate > newestDate) return deal;
    return newest;
  }, undefined);
}

export function matchGainDeal(origin, gainDeals) {
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

export function createReviewQueue(originDeals, gainDeals) {
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
        status: "unmatched",
        diffs: [
          {
            key: "deal",
            label: "Deal match",
            originValue: `${origin.target || "Unnamed target"} / ${origin.buyer || "Buyer not supplied"}`,
            gainValue: "No safe Gain match found",
            status: "unmatched",
          },
        ],
      };
    }

    const diffs = [];
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
      completionDate:
        origin.completionDate || match.deal.completionDate || "Date not supplied",
      sourceType: origin.sourceType,
      sourceDate: origin.sourceDate,
      matchConfidence: match.confidence,
      status: hasConflict ? "conflict" : hasMissing ? "missing" : "aligned",
      diffs,
    };
  });
}

export function statusLabel(status) {
  if (status === "missing") return "Ready to add";
  if (status === "conflict") return "Review conflict";
  if (status === "unmatched") return "Match required";
  return "Aligned";
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createBaseline(originDeals, previousBaseline, sourceFileName, savedAt) {
  const newestDeal = newestOriginDeal(originDeals);
  const mergedSnapshots = mergeDealSnapshots(
    previousBaseline?.dealSnapshots ?? [],
    buildDealSnapshots(originDeals),
  );
  const mergedKeys = mergedSnapshots.map(
    (snapshot) => `${snapshot.identity}|updated:${String(snapshot.sourceDate).trim()}`,
  );

  return {
    version: 2,
    savedAt,
    sourceFileName,
    newestDealKey:
      (newestDeal && dealFingerprint(newestDeal)) || previousBaseline?.newestDealKey || "",
    newestTarget:
      newestDeal?.target || previousBaseline?.newestTarget || "No target supplied",
    newestSourceDate:
      newestDeal?.sourceDate || previousBaseline?.newestSourceDate || "Not supplied",
    dealKeys: mergedKeys,
    dealSnapshots: mergedSnapshots,
    totalChecked: mergedSnapshots.length,
  };
}

export function isValidBaseline(value) {
  return Boolean(
    value &&
      value.version === 2 &&
      typeof value.newestSourceDate === "string" &&
      Array.isArray(value.dealSnapshots) &&
      value.dealSnapshots.every(
        (snapshot) =>
          snapshot &&
          typeof snapshot.identity === "string" &&
          typeof snapshot.target === "string" &&
          typeof snapshot.sourceDate === "string",
      ),
  );
}

export function buildPatchCsv(reviews, approvedKeys) {
  const rows = [
    [
      "gain_deal_id",
      "origin_deal_id",
      "target",
      "field",
      "current_gain_value",
      "proposed_value",
      "source_type",
      "source_date",
      "match_confidence",
    ],
  ];

  reviews.forEach((deal) => {
    deal.diffs.forEach((diff) => {
      if (approvedKeys.has(`${deal.reviewId}:${diff.key}`) && diff.status === "missing") {
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

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function buildEligibleDealsCsv(deals) {
  const fields = [
    ["id", "company_id"],
    ["target", "target"],
    ["buyer", "buyer"],
    ["seller", "seller"],
    ["completionDate", "completion_date"],
    ["enterpriseValue", "enterprise_value"],
    ["revenue", "revenue"],
    ["ebitda", "ebitda"],
    ["stake", "stake"],
    ["advisers", "advisers"],
    ["sourceType", "source_type"],
    ["sourceDate", "source_date"],
  ];
  const rows = [
    fields.map(([, heading]) => heading),
    ...deals.map((deal) => fields.map(([key]) => deal[key] ?? "")),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
