import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalise,
  createBaseline,
  createReviewQueue,
  filterOriginDeals,
  parseCsv,
} from "../docs/logic.mjs";

test("CSV parser handles quoted commas and canonical aliases", () => {
  const rows = parseCsv(
    [
      "companyId,target,buyer,lastUpdated,sellSideAdvisors",
      '42,"Alpha, Systems",Acquirer,17-07-2026,"Advisor A, Advisor B"',
    ].join("\n"),
  );
  const [deal] = canonicalise(rows);
  assert.equal(deal.id, "42");
  assert.equal(deal.target, "Alpha, Systems");
  assert.equal(deal.sourceDate, "17-07-2026");
  assert.equal(deal.advisers, "Advisor A, Advisor B");
});

test("rolling baseline excludes unchanged rows but includes updated and same-day new deals", () => {
  const priorDeals = [
    { id: "1", target: "Alphatron", sourceDate: "17-07-2026" },
    { id: "2", target: "Benchmark Capital", sourceDate: "13-07-2026" },
  ];
  const baseline = createBaseline(priorDeals, null, "week-29.csv", "2026-07-18T00:00:00Z");
  const currentDeals = [
    { id: "1", target: "Alphatron", sourceDate: "21-07-2026" },
    { id: "2", target: "Benchmark Capital", sourceDate: "13-07-2026" },
    { id: "3", target: "New same-day deal", sourceDate: "17-07-2026" },
    { id: "4", target: "Old untracked deal", sourceDate: "12-07-2026" },
  ];
  const eligible = filterOriginDeals(currentDeals, baseline);
  assert.deepEqual(
    eligible.map((deal) => deal.target),
    ["Alphatron", "New same-day deal"],
  );
});

test("comparison proposes blanks and locks conflicts", () => {
  const origin = [
    {
      id: "ORI-1",
      target: "Target",
      buyer: "Buyer",
      seller: "",
      completionDate: "2026-07-20",
      enterpriseValue: "€100m",
      revenue: "",
      ebitda: "€10m",
      stake: "",
      advisers: "",
      sourceType: "Prop intelligence",
      sourceDate: "2026-07-21",
    },
  ];
  const gain = [
    {
      id: "GAIN-1",
      target: "Target",
      buyer: "Buyer",
      seller: "",
      completionDate: "2026-07-20",
      enterpriseValue: "",
      revenue: "",
      ebitda: "€9m",
      stake: "",
      advisers: "",
      sourceType: "",
      sourceDate: "",
    },
  ];
  const [review] = createReviewQueue(origin, gain);
  assert.equal(review.matchConfidence, 96);
  assert.equal(review.status, "conflict");
  assert.equal(review.diffs.find((diff) => diff.key === "enterpriseValue")?.status, "missing");
  assert.equal(review.diffs.find((diff) => diff.key === "ebitda")?.status, "conflict");
});

test("static HTML uses relative assets and makes no server API call", async () => {
  const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../docs/app.js", import.meta.url), "utf8");
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /src="\.\/origin-logo\.png"/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /\/api\/origin-baseline/);
});
