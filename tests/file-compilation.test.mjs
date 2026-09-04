import assert from "node:assert/strict";
import test from "node:test";
import { canonicalise, createReviewQueue } from "../docs/deal-matcher.mjs";
import { compileDealFiles, MAX_UPLOAD_FILES } from "../docs/file-compilation.mjs";

test("multiple Origin files compile repeated snapshots into one enriched deal", () => {
  const older = canonicalise([{ id: "ORI-1", companyId: "42", target: "Alpha", lastUpdated: "18-08-2026", marketedEbitda: "20", suitors: "Buyer A (R1)" }], "origin");
  const newer = canonicalise([{ id: "ORI-1", companyId: "42", target: "Alpha", lastUpdated: "31-08-2026", marketedRevenue: "100", suitors: "Buyer B (Announced)" }], "origin");
  const compiled = compileDealFiles([
    { fileName: "18 Aug.csv", fileIndex: 0, deals: older },
    { fileName: "31 Aug.xlsx", fileIndex: 1, deals: newer },
  ], "origin");

  assert.equal(compiled.fileCount, 2);
  assert.equal(compiled.inputDealCount, 2);
  assert.equal(compiled.duplicateDealCount, 1);
  assert.equal(compiled.deals.length, 1);
  assert.equal(compiled.deals[0].revenue, "100");
  assert.equal(compiled.deals[0].ebitda, "20");
  assert.match(compiled.deals[0].buyerCandidates, /Buyer A/);
  assert.match(compiled.deals[0].buyerCandidates, /Buyer B/);
});

test("Gain compilation keeps data points found only in an older uploaded file", () => {
  const firstGain = canonicalise([{ deal_id: "GAIN-1", target_asset_id: "42", target_name: "Alpha", last_updated: "25-08-2026", bidder_names: "Buyer A | Buyer B", revenue_eur: "100" }], "gain");
  const secondGain = canonicalise([{ deal_id: "GAIN-1", target_asset_id: "42", target_name: "Alpha", last_updated: "31-08-2026", ebitda_eur: "20" }], "gain");
  const gain = compileDealFiles([
    { fileName: "Gain 25 Aug.csv", fileIndex: 0, deals: firstGain },
    { fileName: "Gain 31 Aug.csv", fileIndex: 1, deals: secondGain },
  ], "gain").deals;
  const [origin] = canonicalise([{ id: "ORI-1", companyId: "42", target: "Alpha", announcedBuyer: "Buyer B", marketedRevenue: "100", marketedEbitda: "20" }], "origin");
  const [review] = createReviewQueue([origin], gain);

  assert.equal(gain.length, 1);
  assert.match(gain[0].buyerCandidates, /Buyer A/);
  assert.match(gain[0].buyerCandidates, /Buyer B/);
  assert.equal(review.gainId, "GAIN-1");
  assert.equal(review.diffs.some((diff) => diff.key === "buyerCandidates" && diff.status === "missing"), false);
});

test("different Origin deal records for one company are not collapsed", () => {
  const deals = canonicalise([
    { id: "ORI-1", companyId: "42", target: "Alpha", lastUpdated: "25-08-2026" },
    { id: "ORI-2", companyId: "42", target: "Alpha", lastUpdated: "31-08-2026" },
  ], "origin");
  const compiled = compileDealFiles([{ fileName: "Origin.csv", fileIndex: 0, deals }], "origin");
  assert.equal(compiled.deals.length, 2);
  assert.equal(compiled.duplicateDealCount, 0);
});

test("each side is capped at ten files", () => {
  const batches = Array.from({ length: MAX_UPLOAD_FILES + 1 }, (_, fileIndex) => ({ fileName: `${fileIndex}.csv`, fileIndex, deals: [] }));
  assert.throws(() => compileDealFiles(batches, "origin"), /no more than 10 files/i);
});
