const FIELD_DEFINITIONS = [
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
    buyer: ["buyer", "buyers", "acquirer", "investor", "buyer_name", "announcedbuyer"],
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
    enterpriseValue: ["enterprise_value", "enterprisevalue", "deal_value", "ev", "transaction_value", "ev_eur", "ev_eurm"],
    revenue: ["revenue", "revenue_eur", "revenue_eurm", "sales", "target_revenue", "marketedrevenue"],
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
    ebitda: ["ebitda", "ebitda_eur", "ebitda_eurm", "target_ebitda", "marketedebitda"],
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
        "buysideadvisors",
        "buy_side_advisors",
    ],
    sourceType: ["source_type", "source", "intelligence_type", "provenance"],
    sourceDate: ["source_date", "intelligence_date", "publication_date", "updated_at", "last_updated", "lastupdated"],
};
export function normaliseHeader(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
}
export function normaliseValue(value) {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}
export function normaliseName(value) {
    return normaliseValue(String(value ?? "").replace(/\b(group|holdings?|company|co|corporation|corp|limited|ltd|incorporated|inc|plc|llc|gmbh|ag|sarl|sas|bv|nv|spa|srl)\b/gi, ""));
}
function pick(row, aliases) {
    for (const alias of aliases) {
        const value = row[alias];
        const text = String(value ?? "").trim();
        if (text)
            return text;
    }
    return "";
}
function pickMany(row, aliases) {
    return Array.from(new Set(aliases
        .map((alias) => String(row[alias] ?? "").trim())
        .filter(Boolean))).join("; ");
}
function hasAnyAlias(row, aliases) {
    return aliases.some((alias) => Object.prototype.hasOwnProperty.call(row, alias));
}
export function canonicalise(rows, source = "origin") {
    return rows.map((row, index) => {
        const normalised = Object.fromEntries(Object.entries(row).map(([key, value]) => [normaliseHeader(key), String(value ?? "")]));
        const sourcePrefixes = source === "gain" ? ["gain_"] : ["origin_", "itn_"];
        const preferred = Object.fromEntries(Object.entries(normalised).flatMap(([key, value]) => {
            const prefix = sourcePrefixes.find((candidate) => key.startsWith(candidate));
            return prefix ? [[key.slice(prefix.length), value]] : [];
        }));
        const cleaned = { ...normalised, ...preferred };
        const recordId = pick(cleaned, ["id"]);
        const dealId = pick(cleaned, ALIASES.dealId) || (source === "gain" ? recordId : "");
        const companyId = pick(cleaned, ALIASES.companyId);
        const originator = pick(cleaned, ["originator"]);
        const suppliedSourceType = pick(cleaned, ALIASES.sourceType);
        const buyer = pick(cleaned, ALIASES.buyer);
        const buyerCandidates = pickMany(cleaned, ALIASES.buyerCandidates);
        const combinedBuyerCandidates = appendUniqueListValues(buyerCandidates, buyer);
        return {
            id: (source === "origin" ? companyId || dealId || recordId : dealId || companyId || recordId) ||
                `ROW-${index + 1}`,
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
            enterpriseValue: pick(cleaned, ALIASES.enterpriseValue),
            revenue: pick(cleaned, ALIASES.revenue),
            revenueFinancialYear: pick(cleaned, ALIASES.revenueFinancialYear),
            revenueFinancialYearSupplied: hasAnyAlias(cleaned, ALIASES.revenueFinancialYear),
            ebitda: pick(cleaned, ALIASES.ebitda),
            ebitdaFinancialYear: pick(cleaned, ALIASES.ebitdaFinancialYear),
            ebitdaFinancialYearSupplied: hasAnyAlias(cleaned, ALIASES.ebitdaFinancialYear),
            stake: pick(cleaned, ALIASES.stake),
            advisers: pickMany(cleaned, ALIASES.advisers),
            sourceType: suppliedSourceType ||
                (normaliseValue(originator) === "aggregation"
                    ? "Aggregation"
                    : originator
                        ? "Prop intelligence"
                        : "Not supplied"),
            sourceDate: pick(cleaned, ALIASES.sourceDate) || "Not supplied",
        };
    });
}
function addToIndex(map, key, deal) {
    if (!key)
        return;
    const current = map.get(key) ?? [];
    current.push(deal);
    map.set(key, current);
}
export function buildGainIndex(gainDeals) {
    const index = {
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
function normaliseDate(value) {
    const text = String(value ?? "").trim();
    if (!text)
        return "";
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
function sameDate(left, right) {
    const normalisedLeft = normaliseDate(left);
    const normalisedRight = normaliseDate(right);
    if (!normalisedLeft || !normalisedRight)
        return false;
    return (normalisedLeft === normalisedRight ||
        (normalisedLeft.length === 7 && normalisedRight.startsWith(normalisedLeft)) ||
        (normalisedRight.length === 7 && normalisedLeft.startsWith(normalisedRight)));
}
function numericValue(value) {
    const text = String(value ?? "").trim().toLowerCase().replace(/,/g, "");
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match)
        return Number.NaN;
    let amount = Number(match[0]);
    if (/\b(bn|billion)\b/.test(text))
        amount *= 1_000;
    if (/\b(k|thousand)\b/.test(text))
        amount /= 1_000;
    if (!/[a-z]/.test(text) && Math.abs(amount) >= 1_000_000)
        amount /= 1_000_000;
    return amount;
}
function numbersClose(left, right, tolerance = 0.03) {
    const leftNumber = numericValue(left);
    const rightNumber = numericValue(right);
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber))
        return false;
    const scale = Math.max(Math.abs(leftNumber), Math.abs(rightNumber), 1);
    return Math.abs(leftNumber - rightNumber) <= Math.max(0.25, scale * tolerance);
}
function buyerMatches(origin, gain) {
    const originBuyer = normaliseName(origin.buyer);
    if (!originBuyer)
        return false;
    const gainBuyer = normaliseName(gain.buyer);
    if (gainBuyer && gainBuyer === originBuyer)
        return true;
    const candidates = normaliseValue(gain.buyerCandidates);
    return originBuyer.length >= 4 && candidates.includes(originBuyer);
}
function splitNamedList(value, stripSquareAnnotations = false) {
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
    const seen = new Set();
    return entries.filter((entry) => {
        if (seen.has(entry.key))
            return false;
        seen.add(entry.key);
        return true;
    });
}
function appendUniqueListValues(primary, extra) {
    const entries = splitNamedList(`${primary}${primary && extra ? "; " : ""}${extra}`);
    return entries
        .map((entry) => `${entry.name}${entry.annotation ? ` (${entry.annotation})` : ""}`)
        .join("; ");
}
function missingNamedEntries(originValue, gainValue, stripSquareAnnotations = false) {
    const gainEntries = splitNamedList(gainValue, stripSquareAnnotations);
    return splitNamedList(originValue, stripSquareAnnotations).filter((entry) => !gainEntries.some((gainEntry) => entityNamesEquivalent(entry, gainEntry)));
}
function entityCore(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/\b(pe)\b/g, " private equity ")
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .filter((token) => ![
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
    ].includes(token))
        .join("");
}
function nameAcronym(value) {
    return String(value ?? "")
        .replace(/&/g, " ")
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((token) => token[0].toLowerCase())
        .join("");
}
function looksLikeAcronym(value) {
    const compact = String(value ?? "").replace(/[^a-zA-Z0-9]/g, "");
    return compact.length >= 2 && compact.length <= 6 && compact === compact.toUpperCase();
}
function entityNamesEquivalent(left, right) {
    if (left.key === right.key)
        return true;
    const shorter = left.key.length <= right.key.length ? left : right;
    const longer = shorter === left ? right : left;
    if ((shorter.key.length >= 5 || looksLikeAcronym(shorter.name)) &&
        longer.key.includes(shorter.key)) {
        return true;
    }
    const leftCore = entityCore(left.name);
    const rightCore = entityCore(right.name);
    if (leftCore.length >= 4 && leftCore === rightCore)
        return true;
    if (looksLikeAcronym(left.name) &&
        left.key === nameAcronym(right.name)) {
        return true;
    }
    if (looksLikeAcronym(right.name) &&
        right.key === nameAcronym(left.name)) {
        return true;
    }
    const longestLength = Math.max(left.key.length, right.key.length);
    return (longestLength >= 8 &&
        1 - levenshtein(left.key, right.key) / longestLength >= 0.9);
}
function listAdditionNote(entries, label) {
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
function adviserOverlap(origin, gain) {
    const gainAdvisers = normaliseValue(gain.advisers);
    if (!gainAdvisers)
        return false;
    return origin.advisers
        .split(/[;,|]/)
        .map((value) => normaliseName(value.replace(/\[[^\]]*\]/g, "")))
        .filter((value) => value.length >= 4)
        .some((value) => gainAdvisers.includes(value));
}
function advisersCovered(originValue, gainValue) {
    const gainAdvisers = normaliseValue(gainValue);
    const originAdvisers = originValue
        .split(/[;,|]/)
        .map((value) => normaliseName(value.replace(/\[[^\]]*\]/g, "")))
        .filter((value) => value.length >= 4);
    return Boolean(originAdvisers.length) && originAdvisers.every((value) => gainAdvisers.includes(value));
}
function currencyCode(value) {
    const text = value.toLowerCase();
    if (text.includes("€") || /\beur\b/.test(text))
        return "EUR";
    if (text.includes("£") || /\bgbp\b/.test(text))
        return "GBP";
    if (text.includes("$") || /\busd\b/.test(text))
        return "USD";
    return "";
}
function normaliseFinancialYear(value) {
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
    if (!match)
        return text;
    const year = match[1].length === 2
        ? String(Number(match[1]) >= 50 ? 1900 + Number(match[1]) : 2000 + Number(match[1]))
        : match[1];
    return `${year}${match[2]}`;
}
function financialYearDisplay(value) {
    const normalised = normaliseFinancialYear(value);
    if (!normalised)
        return "";
    return /^\d{4}[A-Z]*$/.test(normalised)
        ? `FY${normalised}`
        : String(value ?? "").trim();
}
function financialValueDisplay(amount, year, yearColumnSupplied, showYearState) {
    if (!amount)
        return year ? `Blank (${financialYearDisplay(year)})` : "Blank";
    if (year)
        return `${amount} (${financialYearDisplay(year)})`;
    if (!showYearState)
        return amount;
    return yearColumnSupplied === false
        ? `${amount} (FY column not supplied)`
        : `${amount} (FY blank)`;
}
function financialFieldDiff(field, origin, gain) {
    const originAmount = origin[field.key];
    if (!originAmount)
        return null;
    const isRevenue = field.key === "revenue";
    const originYear = isRevenue ? origin.revenueFinancialYear ?? "" : origin.ebitdaFinancialYear ?? "";
    const gainYear = isRevenue ? gain.revenueFinancialYear ?? "" : gain.ebitdaFinancialYear ?? "";
    const gainYearColumnSupplied = isRevenue
        ? gain.revenueFinancialYearSupplied
        : gain.ebitdaFinancialYearSupplied;
    const gainAmount = gain[field.key];
    const showYearState = Boolean(originYear);
    const originDisplay = financialValueDisplay(originAmount, originYear, true, showYearState);
    const gainDisplay = financialValueDisplay(gainAmount, gainYear, gainYearColumnSupplied, showYearState);
    const requestedColumn = isRevenue ? "revenue_period" : "ebitda_year";
    const yearLabel = financialYearDisplay(originYear);
    if (!gainAmount) {
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
            note: originYear && gainYearColumnSupplied === false
                ? `${field.label} is blank in Gain. Add the amount only; ${requestedColumn} was not supplied, so verify ${yearLabel} before adding the financial year.`
                : originYear
                    ? `Add ${field.label} together with ${yearLabel}.`
                    : undefined,
        };
    }
    if (!fieldValuesEquivalent(field.key, originAmount, gainAmount)) {
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
    if (!originYear)
        return null;
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
function fieldValuesEquivalent(field, originValue, gainValue) {
    if (field === "advisers")
        return advisersCovered(originValue, gainValue);
    if (["completionDate", "launchDate", "nboDeadline", "boDeadline"].includes(field)) {
        return sameDate(originValue, gainValue);
    }
    if (["enterpriseValue", "revenue", "ebitda", "stake"].includes(field)) {
        const originCurrency = currencyCode(originValue);
        const gainCurrency = currencyCode(gainValue);
        if (originCurrency && gainCurrency && originCurrency !== gainCurrency)
            return false;
        return numbersClose(originValue, gainValue, 0.001);
    }
    return normaliseValue(originValue) === normaliseValue(gainValue);
}
function scoreCandidate(origin, gain, kind) {
    const evidence = [kind === "company" ? "Target Asset ID" : "exact target name"];
    let score = kind === "company" ? 70 : 55;
    const exactTarget = Boolean(normaliseName(origin.target)) && normaliseName(origin.target) === normaliseName(gain.target);
    if (exactTarget) {
        score += 20;
        if (kind !== "target")
            evidence.push("exact target name");
    }
    const hasBuyerEvidence = buyerMatches(origin, gain);
    if (hasBuyerEvidence) {
        score += 18;
        evidence.push("buyer");
    }
    else if (origin.buyer && (gain.buyer || gain.buyerCandidates)) {
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
function deduplicateDeals(deals) {
    return Array.from(new Set(deals));
}
export function matchGainDeal(origin, gainDeals, suppliedIndex) {
    const index = suppliedIndex ?? buildGainIndex(gainDeals);
    const dealId = normaliseValue(origin.dealId);
    if (dealId) {
        const exactDeal = index.byDealId.get(dealId)?.[0];
        if (exactDeal)
            return { deal: exactDeal, confidence: 100, reason: "Deal ID" };
    }
    const companyCandidates = normaliseValue(origin.companyId)
        ? index.byCompanyId.get(normaliseValue(origin.companyId)) ?? []
        : [];
    const targetCandidates = normaliseName(origin.target)
        ? index.byTarget.get(normaliseName(origin.target)) ?? []
        : [];
    const kind = companyCandidates.length ? "company" : "target";
    const candidates = deduplicateDeals(companyCandidates.length ? companyCandidates : targetCandidates);
    if (!candidates.length)
        return null;
    const scored = candidates
        .map((candidate) => scoreCandidate(origin, candidate, kind))
        .sort((left, right) => right.score - left.score);
    const top = scored[0];
    if (scored.length === 1) {
        const confidence = kind === "company" ? 98 : top.buyerMatch ? 96 : top.dateMatch ? 94 : 92;
        return { deal: top.deal, confidence, reason: top.evidence.join(" + ") };
    }
    const lead = top.score - scored[1].score;
    const minimumScore = kind === "company" ? 85 : 80;
    if (top.score < minimumScore || lead < 12)
        return null;
    const supportingSignals = Math.max(0, top.evidence.length - 2);
    const confidence = kind === "company"
        ? Math.min(99, 95 + supportingSignals)
        : Math.min(97, 91 + supportingSignals);
    return { deal: top.deal, confidence, reason: top.evidence.join(" + ") };
}
function levenshtein(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            current[rightIndex] = Math.min(current[rightIndex - 1] + 1, previous[rightIndex] + 1, previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
        }
        previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
}
export function suggestGainDeals(origin, gainDeals, suppliedIndex) {
    const index = suppliedIndex ?? buildGainIndex(gainDeals);
    const target = normaliseName(origin.target);
    if (target.length < 4)
        return [];
    return Array.from(index.byTarget.entries())
        .filter(([candidate]) => {
        if (!candidate || candidate[0] !== target[0])
            return false;
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
export function createReviewQueue(originDeals, gainDeals) {
    const index = buildGainIndex(gainDeals);
    return originDeals.map((origin, rowIndex) => {
        const match = matchGainDeal(origin, gainDeals, index);
        if (!match) {
            const suggestions = suggestGainDeals(origin, gainDeals, index);
            const suggestionText = suggestions.length
                ? `Possible Gain matches: ${suggestions
                    .map(({ deal, similarity }) => `${deal.target} [${deal.dealId || deal.id}, ${Math.round(similarity * 100)}% name]`)
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
                status: "unmatched",
                diffs: [
                    {
                        key: "deal",
                        label: "Deal match",
                        originValue: `${origin.target || "Unnamed target"} / ${origin.buyer || "Buyer not supplied"}`,
                        gainValue: suggestionText,
                        status: "unmatched",
                    },
                ],
            };
        }
        const diffs = [];
        for (const field of FIELD_DEFINITIONS) {
            const originValue = origin[field.key] ?? "";
            const gainValue = match.deal[field.key] ?? "";
            if (!originValue)
                continue;
            if (field.key === "revenue" || field.key === "ebitda") {
                const financialDiff = financialFieldDiff(field, origin, match.deal);
                if (financialDiff)
                    diffs.push(financialDiff);
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
            }
            else if (!fieldValuesEquivalent(field.key, originValue, gainValue)) {
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
