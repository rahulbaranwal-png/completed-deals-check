import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPatchCsv,
  canonicalise,
  createBaseline,
  createReviewQueue,
  filterOriginDeals,
  parseCsv,
} from "../docs/logic.mjs";
import { readDealRows } from "../docs/file-reader.mjs";

test("CSV parser handles quoted commas and canonical aliases", () => {
  const rows = parseCsv(
    [
      "companyId,target,buyer,lastUpdated,sellSideAdvisors",
      '42,"Alpha, Systems",Acquirer,17-07-2026,"Advisor A, Advisor B"',
    ].join("\n"),
  );
  const [deal] = canonicalise(rows, "origin");
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

test("Excel reader finds an offset deal table and repairs an incomplete worksheet range", async () => {
  const cover = [["Gain export overview"], ["Generated today"]];
  const dealsSheet = [
    ["General information", "", ""],
    ["ID", "Deal target", "Buyers"],
    ["42", "Excel Target", "Example Buyer"],
  ];
  const workbook = {
    SheetNames: ["Overview", "Deals"],
    Sheets: {
      Overview: {},
      Deals: { "!ref": "A1:C2", A1: {}, C3: {} },
    },
  };
  const xlsxApi = {
    read(buffer, options) {
      assert.ok(buffer instanceof ArrayBuffer);
      assert.deepEqual(options, { type: "array", cellDates: false });
      return workbook;
    },
    utils: {
      sheet_to_json(sheet, options) {
        assert.deepEqual(options, { header: 1, defval: "", raw: false, blankrows: true });
        if (sheet === workbook.Sheets.Deals) assert.equal(sheet["!ref"], "A1:C3");
        return sheet === workbook.Sheets.Overview ? cover : dealsSheet;
      },
    },
  };
  const file = {
    name: "origin-export.xlsx",
    arrayBuffer: async () => new ArrayBuffer(8),
  };

  assert.deepEqual(await readDealRows(file, xlsxApi), [
    { ID: "42", "Deal target": "Excel Target", Buyers: "Example Buyer" },
  ]);
});

test("public matcher selects the correct AEMtec Gain row", () => {
  const [origin] = canonicalise(
    [{ companyId: "2152", target: "AEMtec Group", announcedBuyer: "Micross Components", marketedEbitda: "15" }],
    "origin",
  );
  const gain = canonicalise(
    [
      { "Deal ID": "10744399", "Target Asset ID": "2152", "Target name": "AEMtec Group", "EBITDA (EURm)": "12.815", "Suitors/bidders": "capiton" },
      { "Deal ID": "10715032", "Target Asset ID": "2152", "Target name": "AEMtec Group", "EBITDA (EURm)": "15", "Suitors/bidders": "Micross Components" },
    ],
    "gain",
  );
  const [review] = createReviewQueue([origin], gain);

  assert.equal(review.gainId, "10715032");
  assert.match(review.matchReason, /Target Asset ID/);
});

test("public matcher and patch export preserve Gain bidders while appending ATOZ omissions", () => {
  const [origin] = canonicalise(
    [
      {
        companyId: "2494624",
        target: "ATOZ",
        announcedBuyer: "Bregal Sagemount",
        suitors:
          "Eurazeo (R1) | Bregal Sagemount (R1, Exclusivity, Announced) | HIG (R1) | Pollen Street (R1) | Cobepa (R1)",
      },
    ],
    "origin",
  );
  const [gain] = canonicalise(
    [
      {
        "Deal ID": "10802447",
        "Target Asset ID": "2494624",
        "Target name": "ATOZ",
        "Suitors/bidders": "Cobepa; Bregal Sagemount; Eurazeo",
      },
    ],
    "gain",
  );
  const [review] = createReviewQueue([origin], [gain]);
  const bidders = review.diffs.find((diff) => diff.key === "buyerCandidates");
  const csv = buildPatchCsv(
    [review],
    new Set([`${review.reviewId}:buyerCandidates`]),
  );

  assert.equal(bidders?.originValue, "HIG; Pollen Street");
  assert.equal(bidders?.updateMode, "append");
  assert.match(csv, /Suitors\/bidders,append/);
  assert.match(csv, /Cobepa; Bregal Sagemount; Eurazeo/);
  assert.match(csv, /HIG; Pollen Street/);
});

test("public matcher compares revenue and EBITDA financial years without false FY-format conflicts", () => {
  const [origin] = canonicalise(
    [
      {
        companyId: "42",
        target: "Financial year target",
        marketedRevenue: "100",
        marketedRevenuePeriod: "FY24",
        marketedEbitda: "20",
        marketedEbitdaPeriod: "FY2025E",
      },
    ],
    "origin",
  );
  const [gain] = canonicalise(
    [
      {
        deal_id: "900",
        company_id: "42",
        asset: "Financial year target",
        revenue_eur: "100",
        revenue_period: "2024",
        ebitda_eur: "20",
        ebitda_year: "2025A",
      },
    ],
    "gain",
  );
  const [review] = createReviewQueue([origin], [gain]);

  assert.equal(review.diffs.some((diff) => diff.key === "revenue"), false);
  const ebitda = review.diffs.find((diff) => diff.key === "ebitda");
  assert.equal(ebitda?.originValue, "20 (FY2025E)");
  assert.equal(ebitda?.gainValue, "20 (FY2025A)");
  assert.equal(ebitda?.status, "conflict");
  assert.equal(review.diffs.some((diff) => /financial year/i.test(diff.label)), false);
});

test("public matcher reports an omitted Gain financial-year column inside Revenue", () => {
  const [origin] = canonicalise(
    [{ companyId: "43", target: "FY schema target", marketedRevenue: "100", marketedRevenuePeriod: "FY2024" }],
    "origin",
  );
  const [gain] = canonicalise(
    [{ deal_id: "901", company_id: "43", asset: "FY schema target", revenue_eur: "100" }],
    "gain",
  );
  const [review] = createReviewQueue([origin], [gain]);
  const revenue = review.diffs.find((diff) => diff.key === "revenue");

  assert.equal(revenue?.originValue, "100 (FY2024)");
  assert.equal(revenue?.gainValue, "100 (FY column not supplied)");
  assert.equal(revenue?.status, "conflict");
  assert.match(revenue?.note ?? "", /revenue_period/);
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

test("public matcher reads spaced announced-buyer headers from the 25 Aug export", () => {
  const origin = canonicalise(
    [
      { "Company ID": "15457", Target: "ScioTeq", "Announced buyer": "Tikehau Capital" },
      { "Company ID": "25551", Target: "Ardentis Cliniques Dentaires et d'Orthodontie", "Announced buyer": "Migros Group" },
    ],
    "origin",
  );
  const gain = canonicalise(
    [
      { "#deal_id": "10826881", target_asset_id: "15457", target_name: "ScioTeq" },
      { "#deal_id": "10638783", target_asset_id: "15457", target_name: "ScioTeq", suitors_bidders: "Tikehau Capital" },
      { "#deal_id": "10825820", target_asset_id: "25551", target_name: "Ardentis Cliniques Dentaires et d'Orthodontie", suitors_bidders: "Migros Group" },
      { "#deal_id": "10558959", target_asset_id: "25551", target_name: "Ardentis Cliniques Dentaires et d'Orthodontie", suitors_bidders: "Columna Capital" },
    ],
    "gain",
  );
  const reviews = createReviewQueue(origin, gain);

  assert.deepEqual(reviews.map((review) => review.gainId), ["10638783", "10825820"]);
});

test("static HTML uses relative assets and makes no server API call", async () => {
  const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../docs/app.js", import.meta.url), "utf8");
  const logic = await readFile(new URL("../docs/logic.mjs", import.meta.url), "utf8");
  await readFile(new URL("../docs/deal-matcher.mjs", import.meta.url), "utf8");
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /src="\.\/xlsx\.full\.min\.js"/);
  assert.match(html, /accept="\.csv,\.xlsx,\.xls/);
  assert.match(html, /src="\.\/origin-logo\.png"/);
  assert.match(logic, /\.\/deal-matcher\.mjs/);
  assert.match(app, /deal\.diffs\.some\(\(diff\) => diff\.status === "missing"\)/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /\/api\/origin-baseline/);
});
