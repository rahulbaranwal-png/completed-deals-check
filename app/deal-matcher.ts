export type RawRow = Record<string, string>;

export type CanonicalDeal = {
  id: string;
  recordId?: string;
  dealId?: string;
  companyId?: string;
  target: string;
  buyer: string;
  buyerCandidates: string;
  seller: string;
  completionDate: string;
  launchDate?: string;
  nboDeadline?: string;
  boDeadline?: string;
  enterpriseValue: string;
  enterpriseValueCurrency?: string;
  enterpriseValueCurrencySupplied?: boolean;
  revenue: string;
  revenueCurrency?: string;
  revenueCurrencySupplied?: boolean;
  revenueFinancialYear?: string;
  revenueFinancialYearSupplied?: boolean;
  ebitda: string;
  ebitdaCurrency?: string;
  ebitdaCurrencySupplied?: boolean;
  ebitdaFinancialYear?: string;
  ebitdaFinancialYearSupplied?: boolean;
  stake: string;
  advisers: string;
  sourceType: string;
  sourceDate: string;
};

export type FieldKey =
  | "enterpriseValue"
  | "revenue"
  | "ebitda"
  | "stake"
  | "advisers"
  | "buyerCandidates"
  | "launchDate"
  | "nboDeadline"
  | "boDeadline"
  | "seller"
  | "completionDate";

export type FieldDiff = {
  key: FieldKey | "deal";
  label: string;
  originValue: string;
  gainValue: string;
  status: "missing" | "conflict" | "unmatched";
  updateMode?: "set" | "append";
  note?: string;
};

export type ReviewDeal = {
  reviewId: string;
  originId: string;
  gainId: string;
  target: string;
  buyer: string;
  completionDate: string;
  sourceType: string;
  sourceDate: string;
  matchConfidence: number;
  matchReason: string;
  status: "missing" | "conflict" | "unmatched" | "aligned";
  diffs: FieldDiff[];
};

type MatchKind = "company" | "target";

type CandidateScore = {
  deal: CanonicalDeal;
  score: number;
  evidence: string[];
  buyerMatch: boolean;
  dateMatch: boolean;
};

type DealMatch = {
  deal: CanonicalDeal;
  confidence: number;
  reason: string;
};

type GainIndex = {
  byDealId: Map<string, CanonicalDeal[]>;
  byCompanyId: Map<string, CanonicalDeal[]>;
  byTarget: Map<string, CanonicalDeal[]>;
};

const FIELD_DEFINITIONS: Array<{ key: FieldKey; label: string }> = [
  { key: "enterpriseValue", label: "Enterprise value" },
  { key: "revenue", label: "Revenue" },
  { key: "ebitda", label: "EBITDA" },
  { key: "stake", label: "Stake acquired" },
  { key: "advisers", label: "Advisers" },
  { key: "buyerCandidates", label: "Suitors/bidders" },
  { key: "launchDate", label: "Launch date" },
  { key: "nboDeadline", label: "NBO deadline" },
  { key: "boDeadline", label: "BO deadline" },
  { key: "seller", label: "Seller" },
  { key: "completionDate", label: "Completion date" },
];

const ALIASES = {
  dealId: ["deal_id", "dealid", "gain_deal_id", "origin_deal_id"],
  companyId: [
    "companyid",
    "company_id",
    "target_asset_id",
    "targetassetid",
    "target_id",
    "asset_id",
  ],
  target: ["target", "target_name", "deal_target", "target_asset", "company", "asset", "target_company"],
  buyer: [
    "buyer",
    "buyers",
    "acquirer",
    "investor",
    "buyer_name",
    "announcedbuyer",
    "announced_buyer",
  ],
  buyerCandidates: [
    "bidder_names",
    "suitors_bidders",
    "buyer_candidates",
    "bidders",
    "suitors",
    "firstroundbidders",
    "first_round_bidders",
    "secondroundbidders",
    "second_round_bidders",
    "exclusivitybidders",
    "exclusivity_bidders",
  ],
  seller: ["seller", "sellers", "vendor", "seller_name"],
  completionDate: ["completion_date", "completed_date", "close_date", "closed_date", "date"],
  launchDate: ["launch_date", "process_launch_date", "processlaunchdate"],
  nboDeadline: ["nbo_deadline", "nbodeadline"],
  boDeadline: ["bo_deadline", "bodeadline"],
  enterpriseValue: [
    "enterprise_value",
    "enterprisevalue",
    "deal_value",
    "ev",
    "transaction_value",
    "ev_eur",
    "ev_eurm",
    "ev_gbp",
    "ev_usd",
    "ev_chf",
  ],
  enterpriseValueCurrency: [
    "enterprisevaluecurrency",
    "enterprise_value_currency",
    "dealvaluecurrency",
    "deal_value_currency",
    "transaction_value_currency",
    "ev_currency",
  ],
  revenue: [
    "revenue",
    "revenue_eur",
    "revenue_eurm",
    "revenue_gbp",
    "revenue_usd",
    "revenue_chf",
    "sales",
    "target_revenue",
    "marketedrevenue",
  ],
  revenueCurrency: [
    "revenuecurrency",
    "revenue_currency",
    "target_revenue_currency",
    "marketedrevenuecurrency",
    "marketed_revenue_currency",
  ],
  revenueFinancialYear: [
    "marketedrevenueperiod",
    "marketed_revenue_period",
    "marketedrevenueyear",
    "marketed_revenue_year",
    "revenue_financial_year",
    "revenuefinancialyear",
    "revenue_fiscal_year",
    "revenuefiscalyear",
    "revenue_fy",
    "revenuefy",
    "revenue_year",
    "revenueyear",
    "revenue_period",
    "revenueperiod",
  ],
  ebitda: [
    "ebitda",
    "ebitda_eur",
    "ebitda_eurm",
    "ebitda_gbp",
    "ebitda_usd",
    "ebitda_chf",
    "target_ebitda",
    "marketedebitda",
  ],
  ebitdaCurrency: [
    "ebitdacurrency",
    "ebitda_currency",
    "target_ebitda_currency",
    "marketedebitdacurrency",
    "marketed_ebitda_currency",
  ],
  ebitdaFinancialYear: [
    "marketedebitdaperiod",
    "marketed_ebitda_period",
    "marketedebitdayear",
    "marketed_ebitda_year",
    "ebitda_financial_year",
    "ebitdafinancialyear",
    "ebitda_fiscal_year",
    "ebitdafiscalyear",
    "ebitda_fy",
    "ebitdafy",
    "ebitda_year",
    "ebitdayear",
    "ebitda_period",
    "ebitdaperiod",
  ],
  stake: ["stake", "stake_acquired", "percentage_acquired", "ownership"],
  advisers: [
    "advisers",
    "advisors",
    "advisors_all",
    "financial_advisers",
    "financial_advisors",
    "sellsideadvisors",
    "sell_side_advisors",
    "sellsideadvisers",
    "sell_side_advisers",
    "buysideadvisors",
    "buy_side_advisors",
    "buysideadvisers",
    "buy_side_advisers",
  ],
  sourceType: ["source_type", "source", "intelligence_type", "provenance"],
  financialCurrency: [
    "currency",
    "currency_code",
    "financialcurrency",
    "financial_currency",
    "marketedcurrency",
    "marketed_currency",
    "deal_currency",
  ],
  sourceDate: [
    "source_date",
    "intelligence_date",
    "publication_date",
    "updated_at",
    "last_updated",
    "lastupdated",
    "current_lastupdated",
    "current_last_updated",
  ],
};

export function normaliseHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normaliseValue(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normaliseName(value: string | undefined) {
  return normaliseValue(
    String(value ?? "").replace(
      /\b(group|holdings?|company|co|corporation|corp|limited|ltd|incorporated|inc|plc|llc|gmbh|ag|sarl|sas|bv|nv|spa|srl)\b/gi,
      "",
    ),
  );
}

function pick(row: RawRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function pickWithAlias(row: RawRow, aliases: string[]) {
  let suppliedAlias = "";
  for (const alias of aliases) {
    if (!suppliedAlias && Object.prototype.hasOwnProperty.call(row, alias)) suppliedAlias = alias;
    const value = String(row[alias] ?? "").trim();
    if (value) return { value, alias };
  }
  return { value: "", alias: suppliedAlias };
}

function pickMany(row: RawRow, aliases: string[]) {
  return Array.from(
    new Set(
      aliases
        .map((alias) => String(row[alias] ?? "").trim())
        .filter(Boolean),
    ),
  ).join("; ");
}

function hasAnyAlias(row: RawRow, aliases: string[]) {
  return aliases.some((alias) => Object.prototype.hasOwnProperty.call(row, alias));
}

export function canonicalise(rows: RawRow[], source: "origin" | "gain" = "origin"): CanonicalDeal[] {
  return rows.map((row, index) => {
    const normalised = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normaliseHeader(key), String(value ?? "")]),
    );
    const sourcePrefixes = source === "gain" ? ["gain_"] : ["origin_", "itn_"];
    const preferred = Object.fromEntries(
      Object.entries(normalised).flatMap(([key, value]) => {
        const prefix = sourcePrefixes.find((candidate) => key.startsWith(candidate));
        return prefix ? [[key.slice(prefix.length), value]] : [];
      }),
    );
    const cleaned = { ...normalised, ...preferred };
    const recordId = pick(cleaned, ["id"]);
    const dealId = pick(cleaned, ALIASES.dealId) || (source === "gain" ? recordId : "");
    const companyId = pick(cleaned, ALIASES.companyId);
    const originator = pick(cleaned, ["originator"]);
    const suppliedSourceType = pick(cleaned, ALIASES.sourceType);
    const buyer = pick(cleaned, ALIASES.buyer);
    const buyerCandidates = pickMany(cleaned, ALIASES.buyerCandidates);
    const combinedBuyerCandidates = appendUniqueListValues(buyerCandidates, buyer);
    const enterpriseValue = pickWithAlias(cleaned, ALIASES.enterpriseValue);
    const revenue = pickWithAlias(cleaned, ALIASES.revenue);
    const ebitda = pickWithAlias(cleaned, ALIASES.ebitda);
    const sharedCurrency = pick(cleaned, ALIASES.financialCurrency);
    const sharedCurrencySupplied = hasAnyAlias(cleaned, ALIASES.financialCurrency);
    const enterpriseValueCurrency = resolveFinancialCurrency(
      cleaned,
      enterpriseValue,
      ALIASES.enterpriseValueCurrency,
      sharedCurrency,
      sharedCurrencySupplied,
    );
    const revenueCurrency = resolveFinancialCurrency(
      cleaned,
      revenue,
      ALIASES.revenueCurrency,
      sharedCurrency,
      sharedCurrencySupplied,
    );
    const ebitdaCurrency = resolveFinancialCurrency(
      cleaned,
      ebitda,
      ALIASES.ebitdaCurrency,
      sharedCurrency,
      sharedCurrencySupplied,
    );

    return {
      id:
        (source === "origin" ? companyId || dealId || recordId : dealId || companyId || recordId) ||
        `ROW-${index + 1}`,
      recordId,
      dealId,
      companyId,
      target: pick(cleaned, ALIASES.target),
      buyer,
      buyerCandidates: combinedBuyerCandidates,
      seller: pick(cleaned, ALIASES.seller),
      completionDate: pick(cleaned, ALIASES.completionDate),
      launchDate: pick(cleaned, ALIASES.launchDate),
      nboDeadline: pick(cleaned, ALIASES.nboDeadline),
      boDeadline: pick(cleaned, ALIASES.boDeadline),
      enterpriseValue: enterpriseValue.value,
      enterpriseValueCurrency: enterpriseValueCurrency.code,
      enterpriseValueCurrencySupplied: enterpriseValueCurrency.supplied,
      revenue: revenue.value,
      revenueCurrency: revenueCurrency.code,
      revenueCurrencySupplied: revenueCurrency.supplied,
      revenueFinancialYear: pick(cleaned, ALIASES.revenueFinancialYear),
      revenueFinancialYearSupplied: hasAnyAlias(cleaned, ALIASES.revenueFinancialYear),
      ebitda: ebitda.value,
      ebitdaCurrency: ebitdaCurrency.code,
      ebitdaCurrencySupplied: ebitdaCurrency.supplied,
      ebitdaFinancialYear: pick(cleaned, ALIASES.ebitdaFinancialYear),
      ebitdaFinancialYearSupplied: hasAnyAlias(cleaned, ALIASES.ebitdaFinancialYear),
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

function addToIndex(map: Map<string, CanonicalDeal[]>, key: string, deal: CanonicalDeal) {
  if (!key) return;
  const current = map.get(key) ?? [];
  current.push(deal);
  map.set(key, current);
}

export function buildGainIndex(gainDeals: CanonicalDeal[]): GainIndex {
  const index: GainIndex = {
    byDealId: new Map(),
    byCompanyId: new Map(),
    byTarget: new Map(),
  };

  for (const deal of gainDeals) {
    addToIndex(index.byDealId, normaliseValue(deal.dealId), deal);
    addToIndex(index.byCompanyId, normaliseValue(deal.companyId), deal);
    addToIndex(index.byTarget, normaliseName(deal.target), deal);
  }

  return index;
}

function normaliseDate(value: string | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(text) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }

  const dayFirst = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  }

  const yearFirst = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (yearFirst) {
    return `${yearFirst[1]}-${yearFirst[2].padStart(2, "0")}${yearFirst[3] ? `-${yearFirst[3].padStart(2, "0")}` : ""}`;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : normaliseValue(text);
}

function sameDate(left: string | undefined, right: string | undefined) {
  const normalisedLeft = normaliseDate(left);
  const normalisedRight = normaliseDate(right);
  if (!normalisedLeft || !normalisedRight) return false;
  return (
    normalisedLeft === normalisedRight ||
    (normalisedLeft.length === 7 && normalisedRight.startsWith(normalisedLeft)) ||
    (normalisedRight.length === 7 && normalisedLeft.startsWith(normalisedRight))
  );
}

function numericValue(value: string | undefined) {
  const text = String(value ?? "").trim().toLowerCase().replace(/,/g, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return Number.NaN;
  let amount = Number(match[0]);
  if (/\b(bn|billion)\b/.test(text)) amount *= 1_000;
  if (/\b(k|thousand)\b/.test(text)) amount /= 1_000;
  if (!/[a-z]/.test(text) && Math.abs(amount) >= 1_000_000) amount /= 1_000_000;
  return amount;
}

function numbersClose(left: string | undefined, right: string | undefined, tolerance = 0.03) {
  const leftNumber = numericValue(left);
  const rightNumber = numericValue(right);
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false;
  const scale = Math.max(Math.abs(leftNumber), Math.abs(rightNumber), 1);
  return Math.abs(leftNumber - rightNumber) <= Math.max(0.25, scale * tolerance);
}

function buyerMatches(origin: CanonicalDeal, gain: CanonicalDeal) {
  const originBuyer = normaliseName(origin.buyer);
  if (!originBuyer) return false;
  const gainBuyer = normaliseName(gain.buyer);
  if (gainBuyer && gainBuyer === originBuyer) return true;
  const candidates = normaliseValue(gain.buyerCandidates);
  return originBuyer.length >= 4 && candidates.includes(originBuyer);
}

type NamedListEntry = {
  name: string;
  key: string;
  annotation: string;
};

function splitNamedList(value: string, stripSquareAnnotations = false): NamedListEntry[] {
  const entries = String(value ?? "")
    .split(/[;|]/)
    .map((raw) => {
      const trimmed = raw.trim();
      const annotationMatch = trimmed.match(/\s*\(([^()]*)\)\s*$/);
      const withoutRoundAnnotation = annotationMatch
        ? trimmed.slice(0, annotationMatch.index).trim()
        : trimmed;
      const name = stripSquareAnnotations
        ? withoutRoundAnnotation.replace(/\s*\[[^\]]*\]\s*$/g, "").trim()
        : withoutRoundAnnotation;
      return {
        name,
        key: normaliseName(name),
        annotation: annotationMatch?.[1]?.trim() ?? "",
      };
    })
    .filter((entry) => entry.name && entry.key.length >= 2);

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });
}

function appendUniqueListValues(primary: string, extra: string) {
  const entries = splitNamedList(`${primary}${primary && extra ? "; " : ""}${extra}`);
  return entries
    .map((entry) => `${entry.name}${entry.annotation ? ` (${entry.annotation})` : ""}`)
    .join("; ");
}

function missingNamedEntries(originValue: string, gainValue: string, stripSquareAnnotations = false) {
  const gainEntries = splitNamedList(gainValue, stripSquareAnnotations);
  return splitNamedList(originValue, stripSquareAnnotations).filter(
    (entry) => !gainEntries.some((gainEntry) => entityNamesEquivalent(entry, gainEntry)),
  );
}

function entityCore(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(pe)\b/g, " private equity ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter(
      (token) =>
        ![
          "and",
          "capital",
          "company",
          "corporation",
          "corp",
          "equity",
          "fund",
          "group",
          "holding",
          "holdings",
          "international",
          "investment",
          "investments",
          "management",
          "partners",
          "private",
          "technologies",
        ].includes(token),
    )
    .join("");
}

function nameAcronym(value: string) {
  return String(value ?? "")
    .replace(/&/g, " ")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((token) => token[0].toLowerCase())
    .join("");
}

function looksLikeAcronym(value: string) {
  const compact = String(value ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return compact.length >= 2 && compact.length <= 6 && compact === compact.toUpperCase();
}

function entityNamesEquivalent(left: NamedListEntry, right: NamedListEntry) {
  if (left.key === right.key) return true;
  const shorter = left.key.length <= right.key.length ? left : right;
  const longer = shorter === left ? right : left;
  if (
    (shorter.key.length >= 5 || looksLikeAcronym(shorter.name)) &&
    longer.key.includes(shorter.key)
  ) {
    return true;
  }

  const leftCore = entityCore(left.name);
  const rightCore = entityCore(right.name);
  if (leftCore.length >= 4 && leftCore === rightCore) return true;

  if (
    looksLikeAcronym(left.name) &&
    left.key === nameAcronym(right.name)
  ) {
    return true;
  }
  if (
    looksLikeAcronym(right.name) &&
    right.key === nameAcronym(left.name)
  ) {
    return true;
  }

  const longestLength = Math.max(left.key.length, right.key.length);
  return (
    longestLength >= 8 &&
    1 - levenshtein(left.key, right.key) / longestLength >= 0.9
  );
}

function listAdditionNote(entries: NamedListEntry[], label: string) {
  const stageEvidence = entries
    .filter((entry) => entry.annotation)
    .map((entry) => `${entry.name} (${entry.annotation})`)
    .join("; ");
  return [
    `Append only; keep all existing Gain ${label}.`,
    stageEvidence ? `Origin stage evidence: ${stageEvidence}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function adviserOverlap(origin: CanonicalDeal, gain: CanonicalDeal) {
  const gainAdvisers = normaliseValue(gain.advisers);
  if (!gainAdvisers) return false;
  return origin.advisers
    .split(/[;,|]/)
    .map((value) => normaliseName(value.replace(/\[[^\]]*\]/g, "")))
    .filter((value) => value.length >= 4)
    .some((value) => gainAdvisers.includes(value));
}

function advisersCovered(originValue: string, gainValue: string) {
  const gainAdvisers = normaliseValue(gainValue);
  const originAdvisers = originValue
    .split(/[;,|]/)
    .map((value) => normaliseName(value.replace(/\[[^\]]*\]/g, "")))
    .filter((value) => value.length >= 4);
  return Boolean(originAdvisers.length) && originAdvisers.every((value) => gainAdvisers.includes(value));
}

const SUPPORTED_CURRENCY_CODES = [
  "EUR",
  "GBP",
  "USD",
  "CHF",
  "CAD",
  "AUD",
  "SEK",
  "NOK",
  "DKK",
  "JPY",
  "CNY",
  "INR",
] as const;

function currencyCode(value: string) {
  const text = String(value ?? "").trim();
  const upper = text.toUpperCase();
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  if (text.includes("$")) return "USD";
  for (const code of SUPPORTED_CURRENCY_CODES) {
    if (new RegExp(`(?:^|[^A-Z])${code}(?:[^A-Z]|$)`).test(upper)) return code;
  }
  return "";
}

function currencyFromHeader(alias: string) {
  const suffix = /(?:^|_)(eur|gbp|usd|chf|cad|aud|sek|nok|dkk|jpy|cny|inr)m?$/.exec(alias);
  return suffix?.[1]?.toUpperCase() ?? "";
}

function resolveFinancialCurrency(
  row: RawRow,
  amount: { value: string; alias: string },
  fieldCurrencyAliases: string[],
  sharedCurrency: string,
  sharedCurrencySupplied: boolean,
) {
  const fieldCurrencySupplied = hasAnyAlias(row, fieldCurrencyAliases);
  const fieldCurrency = pick(row, fieldCurrencyAliases);
  const code = currencyCode(amount.value)
    || currencyCode(fieldCurrency)
    || currencyFromHeader(amount.alias)
    || currencyCode(sharedCurrency);
  return {
    code,
    supplied: Boolean(code || fieldCurrencySupplied || sharedCurrencySupplied),
  };
}

function normaliseFinancialYear(value: string) {
  let text = String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  text = text
    .replace(/^(?:FINANCIALYEAR|FISCALYEAR|FY)/, "")
    .replace(/FY$/, "");

  const match = /^(\d{2}|\d{4})([A-Z]*)$/.exec(text);
  if (!match) return text;

  const year = match[1].length === 2
    ? String(Number(match[1]) >= 50 ? 1900 + Number(match[1]) : 2000 + Number(match[1]))
    : match[1];
  return `${year}${match[2]}`;
}

function financialYearDisplay(value: string) {
  const normalised = normaliseFinancialYear(value);
  if (!normalised) return "";
  return /^\d{4}[A-Z]*$/.test(normalised)
    ? `FY${normalised}`
    : String(value ?? "").trim();
}

type FinancialFieldKey = "enterpriseValue" | "revenue" | "ebitda";

function financialCurrencyFor(deal: CanonicalDeal, key: FinancialFieldKey) {
  if (key === "enterpriseValue") {
    return deal.enterpriseValueCurrency || currencyCode(deal.enterpriseValue);
  }
  if (key === "revenue") return deal.revenueCurrency || currencyCode(deal.revenue);
  return deal.ebitdaCurrency || currencyCode(deal.ebitda);
}

function financialCurrencySuppliedFor(deal: CanonicalDeal, key: FinancialFieldKey) {
  const inferred = Boolean(financialCurrencyFor(deal, key));
  if (key === "enterpriseValue") return inferred || deal.enterpriseValueCurrencySupplied;
  if (key === "revenue") return inferred || deal.revenueCurrencySupplied;
  return inferred || deal.ebitdaCurrencySupplied;
}

function financialValueDisplay(
  amount: string,
  currency: string,
  currencySupplied: boolean | undefined,
  year: string,
  yearColumnSupplied: boolean | undefined,
  showCurrencyState: boolean,
  showYearState: boolean,
) {
  const metadata: string[] = [];
  if (currency) metadata.push(currency);
  else if (showCurrencyState) {
    metadata.push(currencySupplied === false ? "currency not supplied" : "currency blank");
  }
  if (year) metadata.push(financialYearDisplay(year));
  else if (showYearState) {
    metadata.push(yearColumnSupplied === false ? "FY column not supplied" : "FY blank");
  }
  const base = amount || "Blank";
  return metadata.length ? `${base} (${metadata.join(", ")})` : base;
}

function financialFieldDiff(
  field: { key: FinancialFieldKey; label: string },
  origin: CanonicalDeal,
  gain: CanonicalDeal,
): FieldDiff | null {
  const originAmount = origin[field.key];
  if (!originAmount) return null;

  const isRevenue = field.key === "revenue";
  const isEbitda = field.key === "ebitda";
  const hasFinancialYear = isRevenue || isEbitda;
  const originYear = isRevenue
    ? origin.revenueFinancialYear ?? ""
    : isEbitda
      ? origin.ebitdaFinancialYear ?? ""
      : "";
  const gainYear = isRevenue
    ? gain.revenueFinancialYear ?? ""
    : isEbitda
      ? gain.ebitdaFinancialYear ?? ""
      : "";
  const originYearColumnSupplied = isRevenue
    ? origin.revenueFinancialYearSupplied
    : isEbitda
      ? origin.ebitdaFinancialYearSupplied
      : false;
  const gainYearColumnSupplied = isRevenue
    ? gain.revenueFinancialYearSupplied
    : isEbitda
      ? gain.ebitdaFinancialYearSupplied
      : false;
  const gainAmount = gain[field.key];
  const originCurrency = financialCurrencyFor(origin, field.key);
  const gainCurrency = financialCurrencyFor(gain, field.key);
  const originCurrencySupplied = financialCurrencySuppliedFor(origin, field.key);
  const gainCurrencySupplied = financialCurrencySuppliedFor(gain, field.key);
  const showCurrencyState = Boolean(
    originCurrency || gainCurrency || originCurrencySupplied || gainCurrencySupplied,
  );
  const showYearState = hasFinancialYear && Boolean(originYear);
  const originDisplay = financialValueDisplay(
    originAmount,
    originCurrency,
    originCurrencySupplied,
    originYear,
    originYearColumnSupplied,
    showCurrencyState,
    showYearState,
  );
  const gainDisplay = financialValueDisplay(
    gainAmount,
    gainCurrency,
    gainCurrencySupplied,
    gainYear,
    gainYearColumnSupplied,
    showCurrencyState,
    showYearState,
  );
  const requestedColumn = isRevenue ? "revenue_period" : "ebitda_year";
  const yearLabel = financialYearDisplay(originYear);
  const currenciesConflict = Boolean(
    originCurrency && gainCurrency && originCurrency !== gainCurrency,
  );
  const amountMatches = Boolean(gainAmount && numbersClose(originAmount, gainAmount, 0.001));

  if (!gainAmount) {
    if (currenciesConflict) {
      return {
        key: field.key,
        label: field.label,
        originValue: originDisplay,
        gainValue: gainDisplay,
        status: "conflict",
        note: `${field.label} is blank, but the currencies differ (Origin: ${originCurrency}; Gain: ${gainCurrency}). Review the destination currency before adding the amount; no conversion has been applied.`,
      };
    }

    const gainHasConflictingYear = Boolean(originYear && gainYear)
      && normaliseFinancialYear(originYear) !== normaliseFinancialYear(gainYear);
    if (gainHasConflictingYear) {
      return {
        key: field.key,
        label: field.label,
        originValue: originDisplay,
        gainValue: gainDisplay,
        status: "conflict",
        note: `${field.label} is blank, but its financial year differs. Keep for review and do not overwrite Gain.`,
      };
    }

    return {
      key: field.key,
      label: field.label,
      originValue: originDisplay,
      gainValue: gainDisplay,
      status: "missing",
      updateMode: "set",
      note: !originCurrency && gainCurrency
        ? `${field.label} is blank in Gain. Verify the Origin currency before adding the amount to the ${gainCurrency} field.`
        : originYear && gainYearColumnSupplied === false
          ? `${field.label} is blank in Gain. Add the amount only; ${requestedColumn} was not supplied, so verify ${yearLabel} before adding the financial year.`
          : originYear
            ? `Add ${field.label} together with ${originCurrency ? `${originCurrency} and ` : ""}${yearLabel}.`
            : originCurrency
              ? `Add ${field.label} in ${originCurrency}.`
              : undefined,
    };
  }

  if (currenciesConflict) {
    return {
      key: field.key,
      label: field.label,
      originValue: originDisplay,
      gainValue: gainDisplay,
      status: "conflict",
      note: amountMatches
        ? `${field.label} numeric amount matches, but currency differs (Origin: ${originCurrency}; Gain: ${gainCurrency}). This difference is due to currency; no conversion has been applied.`
        : `${field.label} amount and currency differ (Origin: ${originCurrency}; Gain: ${gainCurrency}). Compare the values after currency conversion; existing Gain values are not overwritten.`,
    };
  }

  if (!amountMatches) {
    return {
      key: field.key,
      label: field.label,
      originValue: originDisplay,
      gainValue: gainDisplay,
      status: "conflict",
      note: originYear
        ? `${field.label} and its financial year are reviewed together; existing Gain values are not overwritten.`
        : undefined,
    };
  }

  if (!hasFinancialYear) return null;
  if (!originYear) return null;
  if (gainYearColumnSupplied === false) {
    return {
      key: field.key,
      label: field.label,
      originValue: originDisplay,
      gainValue: gainDisplay,
      status: "conflict",
      note: `${field.label} amount matches, but ${requestedColumn} was not supplied in the Gain export. Verify the financial year before updating.`,
    };
  }
  if (!gainYear) {
    return {
      key: field.key,
      label: field.label,
      originValue: originDisplay,
      gainValue: gainDisplay,
      status: "missing",
      updateMode: "set",
      note: `${field.label} amount already matches. Add ${yearLabel} without changing the amount.`,
    };
  }
  if (normaliseFinancialYear(originYear) !== normaliseFinancialYear(gainYear)) {
    return {
      key: field.key,
      label: field.label,
      originValue: originDisplay,
      gainValue: gainDisplay,
      status: "conflict",
      note: `${field.label} amount matches, but the financial year differs. Keep for review and do not overwrite Gain.`,
    };
  }
  return null;
}

function fieldValuesEquivalent(field: FieldKey, originValue: string, gainValue: string) {
  if (field === "advisers") return advisersCovered(originValue, gainValue);
  if (["completionDate", "launchDate", "nboDeadline", "boDeadline"].includes(field)) {
    return sameDate(originValue, gainValue);
  }
  if (["enterpriseValue", "revenue", "ebitda", "stake"].includes(field)) {
    const originCurrency = currencyCode(originValue);
    const gainCurrency = currencyCode(gainValue);
    if (originCurrency && gainCurrency && originCurrency !== gainCurrency) return false;
    return numbersClose(originValue, gainValue, 0.001);
  }
  return normaliseValue(originValue) === normaliseValue(gainValue);
}

function scoreCandidate(origin: CanonicalDeal, gain: CanonicalDeal, kind: MatchKind): CandidateScore {
  const evidence = [kind === "company" ? "Target Asset ID" : "exact target name"];
  let score = kind === "company" ? 70 : 55;
  const exactTarget = Boolean(normaliseName(origin.target)) && normaliseName(origin.target) === normaliseName(gain.target);
  if (exactTarget) {
    score += 20;
    if (kind !== "target") evidence.push("exact target name");
  }

  const hasBuyerEvidence = buyerMatches(origin, gain);
  if (hasBuyerEvidence) {
    score += 18;
    evidence.push("buyer");
  } else if (origin.buyer && (gain.buyer || gain.buyerCandidates)) {
    score -= 6;
  }

  const completionMatch = sameDate(origin.completionDate, gain.completionDate);
  if (completionMatch) {
    score += 12;
    evidence.push("completion date");
  }

  if (sameDate(origin.launchDate, gain.launchDate)) {
    score += 7;
    evidence.push("launch date");
  }
  if (sameDate(origin.nboDeadline, gain.nboDeadline)) {
    score += 7;
    evidence.push("NBO deadline");
  }
  if (sameDate(origin.boDeadline, gain.boDeadline)) {
    score += 7;
    evidence.push("BO deadline");
  }
  if (numbersClose(origin.ebitda, gain.ebitda)) {
    score += 10;
    evidence.push("EBITDA");
  }
  if (numbersClose(origin.revenue, gain.revenue, 0.05)) {
    score += 7;
    evidence.push("revenue");
  }
  if (adviserOverlap(origin, gain)) {
    score += 6;
    evidence.push("adviser overlap");
  }

  return {
    deal: gain,
    score,
    evidence,
    buyerMatch: hasBuyerEvidence,
    dateMatch: completionMatch,
  };
}

function deduplicateDeals(deals: CanonicalDeal[]) {
  return Array.from(new Set(deals));
}

export function matchGainDeal(
  origin: CanonicalDeal,
  gainDeals: CanonicalDeal[],
  suppliedIndex?: GainIndex,
): DealMatch | null {
  const index = suppliedIndex ?? buildGainIndex(gainDeals);
  const dealId = normaliseValue(origin.dealId);
  if (dealId) {
    const exactDeal = index.byDealId.get(dealId)?.[0];
    if (exactDeal) return { deal: exactDeal, confidence: 100, reason: "Deal ID" };
  }

  const companyCandidates = normaliseValue(origin.companyId)
    ? index.byCompanyId.get(normaliseValue(origin.companyId)) ?? []
    : [];
  const targetCandidates = normaliseName(origin.target)
    ? index.byTarget.get(normaliseName(origin.target)) ?? []
    : [];
  const kind: MatchKind = companyCandidates.length ? "company" : "target";
  const candidates = deduplicateDeals(companyCandidates.length ? companyCandidates : targetCandidates);
  if (!candidates.length) return null;

  const scored = candidates
    .map((candidate) => scoreCandidate(origin, candidate, kind))
    .sort((left, right) => right.score - left.score);
  const top = scored[0];

  if (scored.length === 1) {
    if (kind === "company" && !top.evidence.includes("exact target name") && !top.buyerMatch && !top.dateMatch) {
      return null;
    }
    const confidence =
      kind === "company" ? 98 : top.buyerMatch ? 96 : top.dateMatch ? 94 : 92;
    return { deal: top.deal, confidence, reason: top.evidence.join(" + ") };
  }

  const lead = top.score - scored[1].score;
  const minimumScore = kind === "company" ? 85 : 80;
  if (top.score < minimumScore || lead < 12) return null;

  const supportingSignals = Math.max(0, top.evidence.length - 2);
  const confidence =
    kind === "company"
      ? Math.min(99, 95 + supportingSignals)
      : Math.min(97, 91 + supportingSignals);
  return { deal: top.deal, confidence, reason: top.evidence.join(" + ") };
}

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function suggestGainDeals(
  origin: CanonicalDeal,
  gainDeals: CanonicalDeal[],
  suppliedIndex?: GainIndex,
) {
  const index = suppliedIndex ?? buildGainIndex(gainDeals);
  const target = normaliseName(origin.target);
  if (target.length < 4) return [];

  return Array.from(index.byTarget.entries())
    .filter(([candidate]) => {
      if (!candidate || candidate[0] !== target[0]) return false;
      return Math.abs(candidate.length - target.length) <= Math.max(4, Math.ceil(target.length * 0.25));
    })
    .map(([candidate, deals]) => ({
      deal: deals[0],
      similarity: 1 - levenshtein(target, candidate) / Math.max(target.length, candidate.length),
    }))
    .filter(({ similarity }) => similarity >= 0.82)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 3);
}

export function createReviewQueue(originDeals: CanonicalDeal[], gainDeals: CanonicalDeal[]): ReviewDeal[] {
  const index = buildGainIndex(gainDeals);
  return originDeals.map((origin, rowIndex) => {
    const match = matchGainDeal(origin, gainDeals, index);

    if (!match) {
      const suggestions = suggestGainDeals(origin, gainDeals, index);
      const suggestionText = suggestions.length
        ? `Possible Gain matches: ${suggestions
            .map(({ deal, similarity }) =>
              `${deal.target} [${deal.dealId || deal.id}, ${Math.round(similarity * 100)}% name]`,
            )
            .join("; ")}`
        : "No safe Gain match found";
      return {
        reviewId: `unmatched-${origin.id}-${rowIndex}`,
        originId: origin.dealId || origin.companyId || origin.id,
        gainId: "",
        target: origin.target || "Unnamed target",
        buyer: origin.buyer || "Buyer not supplied",
        completionDate: origin.completionDate || "Date not supplied",
        sourceType: origin.sourceType,
        sourceDate: origin.sourceDate,
        matchConfidence: 0,
        matchReason: suggestions.length ? "Similar target requires review" : "No reliable candidate",
        status: "unmatched" as const,
        diffs: [
          {
            key: "deal" as const,
            label: "Deal match",
            originValue: `${origin.target || "Unnamed target"} / ${origin.buyer || "Buyer not supplied"}`,
            gainValue: suggestionText,
            status: "unmatched" as const,
          },
        ],
      };
    }

    const diffs: FieldDiff[] = [];
    for (const field of FIELD_DEFINITIONS) {
      const originValue = origin[field.key] ?? "";
      const gainValue = match.deal[field.key] ?? "";
      if (!originValue) continue;

      if (
        field.key === "enterpriseValue"
        || field.key === "revenue"
        || field.key === "ebitda"
      ) {
        const financialDiff = financialFieldDiff(
          { key: field.key, label: field.label },
          origin,
          match.deal,
        );
        if (financialDiff) diffs.push(financialDiff);
        continue;
      }

      if (field.key === "buyerCandidates") {
        const missingEntries = missingNamedEntries(originValue, gainValue);
        if (missingEntries.length) {
          const proposedValue = missingEntries.map((entry) => entry.name).join("; ");
          diffs.push({
            key: field.key,
            label: field.label,
            originValue: proposedValue,
            gainValue: gainValue || "Blank",
            status: "missing",
            updateMode: gainValue ? "append" : "set",
            note: gainValue
              ? listAdditionNote(missingEntries, "suitors/bidders")
              : undefined,
          });
        }
        continue;
      }

      if (!gainValue) {
        diffs.push({
          key: field.key,
          label: field.label,
          originValue,
          gainValue: "Blank",
          status: "missing",
          updateMode: "set",
        });
      } else if (!fieldValuesEquivalent(field.key, originValue, gainValue)) {
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
    const gainId = match.deal.dealId || match.deal.id;

    return {
      reviewId: `${origin.id}-${gainId}`,
      originId: origin.dealId || origin.companyId || origin.id,
      gainId,
      target: origin.target || match.deal.target || "Unnamed target",
      buyer: origin.buyer || match.deal.buyer || "Buyer not supplied",
      completionDate: origin.completionDate || match.deal.completionDate || "Date not supplied",
      sourceType: origin.sourceType,
      sourceDate: origin.sourceDate,
      matchConfidence: match.confidence,
      matchReason: match.reason,
      status: hasConflict ? "conflict" : hasMissing ? "missing" : "aligned",
      diffs,
    };
  });
}
