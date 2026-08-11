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

test("ATOZ flags missing Origin bidders as append-only and keeps adviser differences in review", () => {
  const [origin] = canonicalise(
    [
      {
        companyId: "2494624",
        target: "ATOZ",
        announcedBuyer: "Bregal Sagemount",
        sellSideAdvisors: "Baird",
        buySideAdvisors: "Lincoln",
        marketedEbitda: "22",
        enterpriseValue: "330",
        nboDeadline: "2026-07-01",
        suitors:
          "Eurazeo (R1) | Bregal Sagemount (R1, Exclusivity, Announced) | HIG (R1) | Pollen Street (R1) | Cobepa (R1)",
        firstRoundBidders: "Cobepa | Eurazeo | Bregal Sagemount | Pollen Street | HIG",
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
        "EBITDA (EURm)": "22",
        "Advisors (all)":
          "Baird [sell-side]; Goodwin Procter [buy-side]; A&O Shearman [sell-side]",
        "NBO deadline": "2026-07-01T00:00:00.000Z",
        "Suitors/bidders": "Cobepa; Bregal Sagemount; Eurazeo",
        "Bidder stage": "NBO; Buyer; Suitor",
      },
    ],
    "gain",
  );

  const [review] = createReviewQueue([origin], [gain]);
  const bidders = review.diffs.find((diff) => diff.key === "buyerCandidates");
  const advisers = review.diffs.find((diff) => diff.key === "advisers");

  assert.equal(review.gainId, "10802447");
  assert.equal(bidders?.status, "missing");
  assert.equal(bidders?.updateMode, "append");
  assert.equal(bidders?.originValue, "HIG; Pollen Street");
  assert.equal(bidders?.gainValue, "Cobepa; Bregal Sagemount; Eurazeo");
  assert.match(bidders?.note ?? "", /HIG \(R1\)/);
  assert.match(bidders?.note ?? "", /Pollen Street \(R1\)/);
  assert.equal(advisers?.status, "conflict");
  assert.equal(advisers?.updateMode, undefined);
  assert.match(advisers?.originValue ?? "", /Lincoln/);
  assert.equal(review.diffs.some((diff) => diff.key === "nboDeadline"), false);
});

test("known expanded bidder names are not reported as missing list items", () => {
  const [origin] = canonicalise(
    [
      {
        companyId: "2152",
        target: "AEMtec Group",
        suitors: "DPE (R1) | Bregal (R1)",
      },
    ],
    "origin",
  );
  const [gain] = canonicalise(
    [
      {
        "Deal ID": "10715032",
        "Target Asset ID": "2152",
        "Target name": "AEMtec Group",
        "Suitors/bidders": "Deutsche Private Equity; Bregal Unternehmerkapital",
      },
    ],
    "gain",
  );
  const [review] = createReviewQueue([origin], [gain]);

  assert.equal(review.diffs.some((diff) => diff.key === "buyerCandidates"), false);
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

test("current Gain snake-case export headers map bidders and financial fields", () => {
  const [gain] = canonicalise(
    [
      {
        deal_id: "10668632",
        company_id: "554",
        asset: "Funeral Partners",
        publication_date: "2026-08-06T11:38:50Z",
        revenue_eur: "109.5055034",
        ebitda_eur: "23.7242446",
        ev_eur: "233.7364",
        advisors_all: "HSBC [sell-side]",
        bo_deadline: "2026-06-16T00:00:00Z",
        bidder_names: "Duke Street; Sereni Group",
        bidder_stages: "Suitor; Buyer",
      },
    ],
    "gain",
  );

  assert.equal(gain.buyerCandidates, "Duke Street; Sereni Group");
  assert.equal(gain.revenue, "109.5055034");
  assert.equal(gain.ebitda, "23.7242446");
  assert.equal(gain.enterpriseValue, "233.7364");
  assert.equal(gain.boDeadline, "2026-06-16T00:00:00Z");
  assert.equal(gain.sourceDate, "2026-08-06T11:38:50Z");
});

test("current Gain bidder_names prevents false additions for Funeral Partners", () => {
  const [origin] = canonicalise(
    [
      {
        companyId: "554",
        target: "Funeral Partners",
        suitors: "Sereni Group (Announced) | Sereni | Duke Street (R2)",
        secondRoundBidders: "Duke Street",
        announcedBuyer: "Sereni Group",
      },
    ],
    "origin",
  );
  const [gain] = canonicalise(
    [
      {
        deal_id: "10668632",
        company_id: "554",
        asset: "Funeral Partners",
        bidder_names: "Duke Street; Sereni Group",
        bidder_stages: "Suitor; Buyer",
      },
    ],
    "gain",
  );

  const [review] = createReviewQueue([origin], [gain]);
  assert.equal(review.gainId, "10668632");
  assert.equal(review.diffs.some((diff) => diff.key === "buyerCandidates"), false);
});

test("expanded Gain bidder names prevent false additions for FNZ Bank Deutschland", () => {
  const [origin] = canonicalise(
    [
      {
        companyId: "Parent - 3180",
        target: "FNZ Bank Deutschland",
        suitors:
          "Brookfield (R1) | Advent (R1) | HarbourVest Partners (Announced) | Advent International (Announced)",
        firstRoundBidders: "Advent | Brookfield",
        announcedBuyer: "Advent International | HarbourVest Partners",
      },
    ],
    "origin",
  );
  const [gain] = canonicalise(
    [
      {
        deal_id: "10701193",
        company_id: "940587",
        asset: "FNZ Bank Deutschland",
        bidder_names: "Advent International; Brookfield Asset Management; HarbourVest Partners",
        bidder_stages: "Buyer; BO; Buyer",
      },
    ],
    "gain",
  );

  const [review] = createReviewQueue([origin], [gain]);
  assert.equal(review.gainId, "10701193");
  assert.equal(review.diffs.some((diff) => diff.key === "buyerCandidates"), false);
});

test("legal entity suffixes do not create false bidder additions", () => {
  const [origin] = canonicalise(
    [{ companyId: "99", target: "Suffix Target", suitors: "ORIX Corporation (Announced)" }],
    "origin",
  );
  const [gain] = canonicalise(
    [{ deal_id: "900", company_id: "99", asset: "Suffix Target", bidder_names: "ORIX Group" }],
    "gain",
  );
  const [review] = createReviewQueue([origin], [gain]);
  assert.equal(review.diffs.some((diff) => diff.key === "buyerCandidates"), false);
});

test("blank earlier aliases do not hide populated fallback values", () => {
  const [origin] = canonicalise(
    [{ target: "Fallback Buyer Target", buyer: "", announcedBuyer: "Sereni Group" }],
    "origin",
  );
  assert.equal(origin.buyer, "Sereni Group");
});
