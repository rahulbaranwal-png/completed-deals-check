import { normaliseName, normaliseValue } from "./deal-matcher.mjs";

export const MAX_UPLOAD_FILES = 10;
const LIST_FIELDS = ["buyerCandidates", "advisers"];
const SUPPLIED_FIELDS = ["enterpriseValueCurrencySupplied", "revenueCurrencySupplied", "revenueFinancialYearSupplied", "ebitdaCurrencySupplied", "ebitdaFinancialYearSupplied"];

function dateValue(value) {
  const text = String(value ?? "").trim();
  const dayFirst = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dayFirst) return Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
  const yearFirst = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (yearFirst) return Date.UTC(Number(yearFirst[1]), Number(yearFirst[2]) - 1, Number(yearFirst[3]));
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function identity(deal, source, fileIndex, rowIndex) {
  const recordId = normaliseValue(deal.recordId);
  const dealId = normaliseValue(deal.dealId);
  if (source === "gain" && (dealId || recordId)) return `deal:${dealId || recordId}`;
  if (source === "origin" && recordId) return `record:${recordId}`;
  if (dealId) return `deal:${dealId}`;
  const companyId = normaliseValue(deal.companyId || (String(deal.id).startsWith("ROW-") ? "" : deal.id));
  const target = normaliseName(deal.target);
  const completed = normaliseValue(deal.completionDate);
  if (companyId && target) return `company:${companyId}|target:${target}|completed:${completed}`;
  if (target) return `target:${target}|completed:${completed}`;
  return `row:${fileIndex}:${rowIndex}`;
}

function mergeListValues(values) {
  const seen = new Set();
  const output = [];
  values.forEach((value) => String(value ?? "").split(/[;|]/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const key = normaliseName(part.replace(/\s*\([^()]*\)\s*$/, ""));
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(part);
  }));
  return output.join("; ");
}

function mergeGroup(group) {
  const ordered = [...group].sort((left, right) => dateValue(right.deal.sourceDate) - dateValue(left.deal.sourceDate) || right.fileIndex - left.fileIndex || right.rowIndex - left.rowIndex);
  const merged = { ...ordered[0].deal };
  Object.keys(merged).forEach((field) => {
    if (LIST_FIELDS.includes(field) || SUPPLIED_FIELDS.includes(field)) return;
    const firstPopulated = ordered.map(({ deal }) => deal[field]).find((value) => String(value ?? "").trim());
    if (firstPopulated !== undefined) merged[field] = firstPopulated;
  });
  LIST_FIELDS.forEach((field) => { merged[field] = mergeListValues(ordered.map(({ deal }) => deal[field])); });
  SUPPLIED_FIELDS.forEach((field) => { merged[field] = ordered.some(({ deal }) => deal[field] === true); });
  return merged;
}

export function compileDealFiles(batches, source) {
  if (!batches.length) throw new Error("Choose at least one file.");
  if (batches.length > MAX_UPLOAD_FILES) throw new Error(`Choose no more than ${MAX_UPLOAD_FILES} files per side.`);
  const groups = new Map();
  batches.forEach((batch) => batch.deals.forEach((deal, rowIndex) => {
    const key = identity(deal, source, batch.fileIndex, rowIndex);
    const group = groups.get(key) ?? [];
    group.push({ deal, fileIndex: batch.fileIndex, rowIndex });
    groups.set(key, group);
  }));
  const deals = Array.from(groups.values(), mergeGroup);
  const inputDealCount = batches.reduce((total, batch) => total + batch.deals.length, 0);
  return { deals, fileCount: batches.length, inputDealCount, duplicateDealCount: inputDealCount - deals.length };
}
