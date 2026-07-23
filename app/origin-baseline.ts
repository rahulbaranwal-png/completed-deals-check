export type BaselineComparableDeal = {
  id: string;
  target: string;
  sourceDate: string;
};

export type BaselineDealSnapshot = {
  identity: string;
  companyId: string;
  target: string;
  sourceDate: string;
};

export type DateAwareBaseline = {
  newestSourceDate: string;
  dealSnapshots: BaselineDealSnapshot[];
};

function normaliseValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normaliseName(value: string) {
  return normaliseValue(
    value.replace(/\b(group|holdings|limited|ltd|incorporated|inc|plc|llc)\b/gi, ""),
  );
}

export function dealIdentity(deal: BaselineComparableDeal) {
  const companyId = deal.id && !deal.id.startsWith("ROW-") ? normaliseValue(deal.id) : "";
  const target = normaliseName(deal.target);
  return companyId ? `company:${companyId}|target:${target}` : `target:${target}`;
}

export function parseOriginDate(value: string) {
  const trimmed = value.trim();
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

export function dealFingerprint(deal: BaselineComparableDeal) {
  return `${dealIdentity(deal)}|updated:${deal.sourceDate.trim()}`;
}

export function buildDealSnapshots(deals: BaselineComparableDeal[]) {
  return deals.map((deal) => ({
    identity: dealIdentity(deal),
    companyId: deal.id,
    target: deal.target,
    sourceDate: deal.sourceDate,
  }));
}

export function mergeDealSnapshots(
  previous: BaselineDealSnapshot[],
  current: BaselineDealSnapshot[],
) {
  const merged = new Map(previous.map((snapshot) => [snapshot.identity, snapshot]));
  current.forEach((snapshot) => merged.set(snapshot.identity, snapshot));
  return Array.from(merged.values());
}

export function shouldReviewOriginDeal(
  deal: BaselineComparableDeal,
  baseline: DateAwareBaseline | null,
) {
  if (!baseline) return true;

  const currentDate = parseOriginDate(deal.sourceDate);
  const cutoffDate = parseOriginDate(baseline.newestSourceDate);
  const previous = baseline.dealSnapshots.find(
    (snapshot) => snapshot.identity === dealIdentity(deal),
  );

  if (previous && previous.sourceDate.trim() === deal.sourceDate.trim()) return false;
  if (Number.isFinite(currentDate) && Number.isFinite(cutoffDate)) {
    return currentDate > cutoffDate;
  }

  return true;
}

export function filterOriginDeals<T extends BaselineComparableDeal>(
  deals: T[],
  baseline: DateAwareBaseline | null,
) {
  return deals.filter((deal) => shouldReviewOriginDeal(deal, baseline));
}

export function newestOriginDeal<T extends BaselineComparableDeal>(deals: T[]) {
  return deals.reduce<T | undefined>((newest, deal) => {
    if (!newest) return deal;
    const dealDate = parseOriginDate(deal.sourceDate);
    const newestDate = parseOriginDate(newest.sourceDate);
    if (!Number.isFinite(dealDate)) return newest;
    if (!Number.isFinite(newestDate) || dealDate > newestDate) return deal;
    return newest;
  }, undefined);
}
