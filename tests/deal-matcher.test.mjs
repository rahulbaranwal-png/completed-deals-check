import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalise,
  createReviewQueue,
  matchGainDeal,
} from "../app/deal-matcher.ts";

test("AEMtec Group selects the correct Gain deal from two rows for the same asset", () => {
  const [origin] = canonicalise(
    [
      {
        id: "cmpv62k9f0x7hotu467h2yy3h",
        companyId: "2152",
        target: "AEMtec Group",
        announcedBuyer: "Micross Components",
        marketedEbitda: "15",
        marketedRevenue: "75",
        sellSideAdvisors: "Lincoln International",
        processLaunchDate: "2026-04-30",
        nboDeadline: "2026-06-11",
        lastUpdated: "2026-07-29",
        originator: "Reporter",
      },
    ],
    "origin",
  );
  const gain = canonicalise(
    [
      {
        "Deal ID": "10744399",
        "Target Asset ID": "2152",
        "Target name": "AEMtec Group",
        "Revenue (EURm)": "73.954",
        "EBITDA (EURm)": "12.815",
        "Advisors (all)": "Kroll [unknown]; Houlihan Lokey [unknown]",
        "Suitors/bidders": "capiton",
      },
      {
        "Deal ID": "10715032",
        "Target Asset ID": "2152",
        "Target name": "AEMtec Group",
        "EBITDA (EURm)": "15",
        "Advisors (all)": "Harris Williams [buy-side]; Lincoln International [sell-side]",
        "Launch date": "2026-04-30T00:00:00Z",
        "NBO deadline": "2026-06-11T00:00:00Z",
        "Suitors/bidders": "IK Partners; Micross Components",
      },
    ],
    "gain",
  );

  assert.equal(origin.companyId, "2152");
  assert.equal(gain[1].companyId, "2152");
  assert.equal(gain[1].dealId, "10715032");
  assert.equal(gain[1].ebitda, "15");
  assert.match(gain[1].advisers, /Lincoln International/);

  const [review] = createReviewQueue([origin], gain);
  assert.equal(review.gainId, "10715032");
  assert.ok(review.matchConfidence >= 98);
  assert.match(review.matchReason, /Target Asset ID/);
  assert.match(review.matchReason, /buyer/);
  assert.match(review.matchReason, /EBITDA/);
  assert.equal(review.status, "missing");
  assert.equal(review.diffs.some((diff) => diff.key === "ebitda"), false);
  assert.equal(review.diffs.some((diff) => diff.key === "advisers"), false);
});

test("a unique exact target name matches even when IDs and buyer are unavailable", () => {
  const [origin] = canonicalise([{ companyId: "42", target: "Alpha Group" }], "origin");
  const [gain] = canonicalise([{ "Deal ID": "900", "Target name": "Alpha Group" }], "gain");
  const match = matchGainDeal(origin, [gain]);

  assert.equal(match?.deal.dealId, "900");
  assert.equal(match?.confidence, 92);
  assert.match(match?.reason ?? "", /exact target name/);
});

test("duplicate exact target names stay in review when no evidence separates them", () => {
  const [origin] = canonicalise([{ target: "Beacon Group" }], "origin");
  const gain = canonicalise(
    [
      { "Deal ID": "100", "Target name": "Beacon Group" },
      { "Deal ID": "101", "Target name": "Beacon Group" },
    ],
    "gain",
  );
  const [review] = createReviewQueue([origin], gain);

  assert.equal(review.status, "unmatched");
  assert.equal(review.gainId, "");
  assert.match(review.matchReason, /requires review/);
  assert.match(review.diffs[0].gainValue, /Possible Gain matches/);
});

test("an explicit deal ID remains the highest-priority match", () => {
  const [origin] = canonicalise(
    [{ deal_id: "777", companyId: "42", target: "Different spelling" }],
    "origin",
  );
  const gain = canonicalise(
    [
      { "Deal ID": "777", "Target Asset ID": "99", "Target name": "Gain spelling" },
      { "Deal ID": "888", "Target Asset ID": "42", "Target name": "Different spelling" },
    ],
    "gain",
  );
  const match = matchGainDeal(origin, gain);

  assert.equal(match?.deal.dealId, "777");
  assert.equal(match?.confidence, 100);
  assert.equal(match?.reason, "Deal ID");
});

test("similar names are suggested but never auto-matched", () => {
  const [origin] = canonicalise([{ target: "Alfa Systems" }], "origin");
  const gain = canonicalise([{ "Deal ID": "500", "Target name": "Alpha Systems" }], "gain");
  const [review] = createReviewQueue([origin], gain);

  assert.equal(review.status, "unmatched");
  assert.equal(review.matchConfidence, 0);
  assert.match(review.diffs[0].gainValue, /Alpha Systems/);
});
