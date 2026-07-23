type BaselineDealSnapshot = {
  identity: string;
  companyId: string;
  target: string;
  sourceDate: string;
};

type BaselinePayload = {
  version: 2;
  savedAt: string;
  sourceFileName: string;
  newestDealKey: string;
  newestTarget: string;
  newestSourceDate: string;
  dealKeys: string[];
  dealSnapshots: BaselineDealSnapshot[];
  totalChecked: number;
};

type BaselineRow = {
  version: number;
  saved_at: string;
  source_file_name: string;
  newest_deal_key: string;
  newest_target: string;
  newest_source_date: string;
  deal_keys_json: string;
  deal_snapshots_json: string;
  total_checked: number;
};

async function getDatabase() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("The local D1 database binding is unavailable.");
  return env.DB;
}

async function ensureTable(database: D1Database) {
  await database.prepare(
    `CREATE TABLE IF NOT EXISTS origin_baseline (
      id INTEGER PRIMARY KEY,
      version INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      source_file_name TEXT NOT NULL,
      newest_deal_key TEXT NOT NULL,
      newest_target TEXT NOT NULL,
      newest_source_date TEXT NOT NULL,
      deal_keys_json TEXT NOT NULL,
      deal_snapshots_json TEXT NOT NULL DEFAULT '[]',
      total_checked INTEGER NOT NULL
    )`,
  ).run();

  const columns = await database
    .prepare("PRAGMA table_info(origin_baseline)")
    .all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "deal_snapshots_json")) {
    await database
      .prepare(
        "ALTER TABLE origin_baseline ADD COLUMN deal_snapshots_json TEXT NOT NULL DEFAULT '[]'",
      )
      .run();
  }
}

function toPayload(row: BaselineRow): BaselinePayload {
  const parsedKeys = JSON.parse(row.deal_keys_json);
  const dealKeys = Array.isArray(parsedKeys)
    ? parsedKeys.filter((value): value is string => typeof value === "string")
    : [];
  const parsedSnapshots = JSON.parse(row.deal_snapshots_json || "[]");
  const dealSnapshots = Array.isArray(parsedSnapshots)
    ? parsedSnapshots.filter(
        (value): value is BaselineDealSnapshot =>
          Boolean(value) &&
          typeof value === "object" &&
          typeof value.identity === "string" &&
          typeof value.companyId === "string" &&
          typeof value.target === "string" &&
          typeof value.sourceDate === "string",
      )
    : [];

  return {
    version: 2,
    savedAt: row.saved_at,
    sourceFileName: row.source_file_name,
    newestDealKey: row.newest_deal_key,
    newestTarget: row.newest_target,
    newestSourceDate: row.newest_source_date,
    dealKeys,
    dealSnapshots,
    totalChecked: dealSnapshots.length || row.total_checked,
  };
}

function isPayload(value: unknown): value is BaselinePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BaselinePayload>;
  return (
    candidate.version === 2 &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.sourceFileName === "string" &&
    typeof candidate.newestDealKey === "string" &&
    typeof candidate.newestTarget === "string" &&
    typeof candidate.newestSourceDate === "string" &&
    Array.isArray(candidate.dealKeys) &&
    candidate.dealKeys.every((key) => typeof key === "string") &&
    Array.isArray(candidate.dealSnapshots) &&
    candidate.dealSnapshots.every(
      (snapshot) =>
        Boolean(snapshot) &&
        typeof snapshot === "object" &&
        typeof snapshot.identity === "string" &&
        typeof snapshot.companyId === "string" &&
        typeof snapshot.target === "string" &&
        typeof snapshot.sourceDate === "string",
    )
  );
}

export async function GET() {
  try {
    const database = await getDatabase();
    await ensureTable(database);
    const row = await database.prepare(
      `SELECT version, saved_at, source_file_name, newest_deal_key, newest_target,
        newest_source_date, deal_keys_json, deal_snapshots_json, total_checked
       FROM origin_baseline
       WHERE id = 1`,
    ).first<BaselineRow>();

    return Response.json({ baseline: row ? toPayload(row) : null });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Baseline lookup failed." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isPayload(body)) {
      return Response.json({ error: "Invalid rolling-baseline payload." }, { status: 400 });
    }

    const dealKeys = Array.from(new Set(body.dealKeys.map((key) => key.trim()).filter(Boolean)));
    const snapshotsByIdentity = new Map(
      body.dealSnapshots.map((snapshot) => [snapshot.identity.trim(), snapshot]),
    );
    const dealSnapshots = Array.from(snapshotsByIdentity.values());
    const baseline: BaselinePayload = {
      ...body,
      dealKeys,
      dealSnapshots,
      totalChecked: dealSnapshots.length,
    };

    const database = await getDatabase();
    await ensureTable(database);
    await database.prepare(
      `INSERT INTO origin_baseline (
        id, version, saved_at, source_file_name, newest_deal_key, newest_target,
        newest_source_date, deal_keys_json, deal_snapshots_json, total_checked
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version,
        saved_at = excluded.saved_at,
        source_file_name = excluded.source_file_name,
        newest_deal_key = excluded.newest_deal_key,
        newest_target = excluded.newest_target,
        newest_source_date = excluded.newest_source_date,
        deal_keys_json = excluded.deal_keys_json,
        deal_snapshots_json = excluded.deal_snapshots_json,
        total_checked = excluded.total_checked`,
    )
      .bind(
        baseline.version,
        baseline.savedAt,
        baseline.sourceFileName,
        baseline.newestDealKey,
        baseline.newestTarget,
        baseline.newestSourceDate,
        JSON.stringify(baseline.dealKeys),
        JSON.stringify(baseline.dealSnapshots),
        baseline.totalChecked,
      )
      .run();

    return Response.json({ baseline });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Baseline save failed." },
      { status: 500 },
    );
  }
}
