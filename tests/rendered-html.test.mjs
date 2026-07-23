import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(html, /Origin remains read-only/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps the starter preview removed and safety rules in the app", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));

  assert.match(page, /Add to blanks only/);
  assert.match(page, /Conflicts stay in review/);
  assert.match(page, /No safe Gain match found/);
  assert.match(page, /sourceType/);
});
