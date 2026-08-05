import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildDealSnapshots,
  filterOriginDeals,
} from "../app/origin-baseline.ts";
import { readDealRows } from "../app/file-reader.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Completed deals check", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Completed deals check<\/title>/i);
  assert.match(html, /\/origin-logo\.png/i);
  assert.match(html, /\/gain-logo\.png/i);
  assert.match(html, /Compare Origin and Gain exports/i);
  assert.match(html, /Completed deals/i);
  assert.match(html, /Rolling Origin baseline/i);
  assert.match(html, /Complete run &amp; save baseline/i);
  assert.match(html, /Choose CSV or Excel/i);
  assert.match(html, /\.csv,\.xlsx,\.xls/i);
  assert.match(html, /\/xlsx\.full\.min\.js/i);
  assert.match(html, /Origin remains read-only/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("finds the deal table when an Excel export has a cover sheet and offset headers", async () => {
  const cover = [["Gain export overview"], ["Generated today"]];
  const dealsSheet = [
    ["General information", "", ""],
    ["ID", "Deal target", "Buyers"],
    ["42", "Excel Target", "Example Buyer"],
  ];
  const workbook = { SheetNames: ["Overview", "Deals"], Sheets: { Overview: {}, Deals: {} } };
  const xlsxApi = {
    read(buffer, options) {
      assert.ok(buffer instanceof ArrayBuffer);
      assert.deepEqual(options, { type: "array", cellDates: false });
      return workbook;
    },
    utils: {
      sheet_to_json(sheet, options) {
        assert.deepEqual(options, { header: 1, defval: "", raw: false, blankrows: true });
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

test("keeps the starter preview removed and safety rules in the app", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));

  assert.match(page, /Add to blanks only/);
  assert.match(page, /Conflicts stay in review/);
  assert.match(page, /No safe Gain match found/);
  assert.match(page, /sourceType/);
  assert.match(page, /companyid/);
  assert.match(page, /lastupdated/);
  assert.match(page, /origin-baseline/);
  assert.match(page, /completeRunAndSaveBaseline/);
  assert.match(page, /id: \["companyid",/);
});

test("retains updated companies and unseen deals on the cutoff date", () => {
  const priorDeals = [
    { id: "13480", target: "Alphatron", sourceDate: "17-07-2026" },
    { id: "1225536", target: "Benchmark Capital", sourceDate: "15-07-2026" },
  ];
  const baseline = {
    newestSourceDate: "17-07-2026",
    dealSnapshots: buildDealSnapshots(priorDeals),
  };
  const week30Deals = [
    { id: "13480", target: "Alphatron", sourceDate: "21-07-2026" },
    { id: "1225536", target: "Benchmark Capital", sourceDate: "15-07-2026" },
    { id: "999", target: "Unseen cutoff deal", sourceDate: "17-07-2026" },
    { id: "1000", target: "Newer deal", sourceDate: "18-07-2026" },
  ];

  assert.deepEqual(
    filterOriginDeals(week30Deals, baseline).map((deal) => deal.target),
    ["Alphatron", "Unseen cutoff deal", "Newer deal"],
  );
});
