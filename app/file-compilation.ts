import { normaliseName, normaliseValue, type CanonicalDeal } from "./deal-matcher";

export const MAX_UPLOAD_FILES = 10;

export type DealFileBatch = {
  fileName: string;
  fileIndex: number;
  deals: CanonicalDeal[];
  fileKey?: string;
};

export type CompiledDeals = {
  deals: CanonicalDeal[];
  fileCount: number;
  inputDealCount: number;
  duplicateDealCount: number;
};

export type AppendedDealFileBatches<T extends DealFileBatch> = {
  batches: T[];
  addedCount: number;
  duplicateCount: number;
};

const LIST_FIELDS: Array<keyof CanonicalDeal> = ["buyerCandidates", "advisers"];
const SUPPLIED_FIELDS: Array<keyof CanonicalDeal> = [
  "enterpriseValueCurrencySupplied",
  "revenueCurrencySupplied",
  "revenueFinancialYearSupplied",
  "ebitdaCurrencySupplied",
  "ebitdaFinancialYearSupplied",
];

function dateValue(value: string | undefined) {
  const text = String(value ?? "").trim();
  const dayFirst = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dayFirst) return Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
  const yearFirst = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (yearFirst) return Date.UTC(Number(yearFirst[1]), Number(yearFirst[2]) - 1, Number(yearFirst[3]));
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function identity(deal: CanonicalDeal, source: "origin" | "gain", fileIndex: number, rowIndex: number) {
  const recordId = normaliseValue(deal.recordId);
  const dealId = normaliseValue(deal.dealId);
  if (source === "gain" && (dealId || recordId)) return `deal:${dealId || recordId}`;
  if (source === "origin" && recordId) return `record:${recordId}`;
  if (dealId) return `deal:${dealId}`;

  const companyId = normaliseValue(deal.companyId || (deal.id.startsWith("ROW-") ? "" : deal.id));
  const target = normaliseName(deal.target);
  const completed = normaliseValue(deal.completionDate);
  if (companyId && target) return `company:${companyId}|target:${target}|completed:${completed}`;
  if (target) return `target:${target}|completed:${completed}`;
  return `row:${fileIndex}:${rowIndex}`;
}

function mergeListValues(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  values.forEach((value) => {
    String(value ?? "").split(/[;|]/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
      const key = normaliseName(part.replace(/\s*\([^()]*\)\s*$/, ""));
      if (!key || seen.has(key)) return;
      seen.add(key);
      output.push(part);
    });
  });
  return output.join("; ");
}

function mergeGroup(group: Array<{ deal: CanonicalDeal; fileIndex: number; rowIndex: number }>) {
  const ordered = [...group].sort((left, right) => {
    const dateDifference = dateValue(right.deal.sourceDate) - dateValue(left.deal.sourceDate);
    return dateDifference || right.fileIndex - left.fileIndex || right.rowIndex - left.rowIndex;
  });
  const merged = { ...ordered[0].deal };

  for (const field of Object.keys(merged) as Array<keyof CanonicalDeal>) {
    if (LIST_FIELDS.includes(field) || SUPPLIED_FIELDS.includes(field)) continue;
    const firstPopulated = ordered.map(({ deal }) => deal[field]).find((value) => String(value ?? "").trim());
    if (firstPopulated !== undefined) (merged[field] as unknown) = firstPopulated;
  }
  LIST_FIELDS.forEach((field) => {
    (merged[field] as unknown) = mergeListValues(ordered.map(({ deal }) => String(deal[field] ?? "")));
  });
  SUPPLIED_FIELDS.forEach((field) => {
    (merged[field] as unknown) = ordered.some(({ deal }) => deal[field] === true);
  });
  return merged;
}

function batchKey(batch: DealFileBatch) {
  return batch.fileKey || `${batch.fileName.trim().toLowerCase()}::${batch.deals.length}`;
}

export function appendDealFileBatches<T extends DealFileBatch>(
  existing: T[],
  incoming: T[],
): AppendedDealFileBatches<T> {
  const seen = new Set(existing.map(batchKey));
  const accepted: T[] = [];
  let duplicateCount = 0;

  incoming.forEach((batch) => {
    const key = batchKey(batch);
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    accepted.push(batch);
  });

  if (existing.length + accepted.length > MAX_UPLOAD_FILES) {
    throw new Error(`Choose no more than ${MAX_UPLOAD_FILES} files per side. Remove a file before adding another.`);
  }

  return {
    batches: [...existing, ...accepted].map((batch, fileIndex) => ({ ...batch, fileIndex }) as T),
    addedCount: accepted.length,
    duplicateCount,
  };
}

export function compileDealFiles(batches: DealFileBatch[], source: "origin" | "gain"): CompiledDeals {
  if (!batches.length) throw new Error("Choose at least one file.");
  if (batches.length > MAX_UPLOAD_FILES) throw new Error(`Choose no more than ${MAX_UPLOAD_FILES} files per side.`);

  const groups = new Map<string, Array<{ deal: CanonicalDeal; fileIndex: number; rowIndex: number }>>();
  batches.forEach((batch) => batch.deals.forEach((deal, rowIndex) => {
    const key = identity(deal, source, batch.fileIndex, rowIndex);
    const group = groups.get(key) ?? [];
    group.push({ deal, fileIndex: batch.fileIndex, rowIndex });
    groups.set(key, group);
  }));
  const deals = Array.from(groups.values(), mergeGroup);
  const inputDealCount = batches.reduce((total, batch) => total + batch.deals.length, 0);
  return {
    deals,
    fileCount: batches.length,
    inputDealCount,
    duplicateDealCount: inputDealCount - deals.length,
  };
}
