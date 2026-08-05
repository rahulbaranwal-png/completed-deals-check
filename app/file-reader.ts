export type RawSpreadsheetRow = Record<string, string>;

type XlsxWorkbook = {
  SheetNames?: string[];
  Sheets?: Record<string, unknown>;
};

type SpreadsheetCell = string | number | boolean | Date | null | undefined;

type XlsxApi = {
  read(data: ArrayBuffer, options: { type: "array"; cellDates: false }): XlsxWorkbook;
  utils: {
    sheet_to_json(
      sheet: unknown,
      options: { header: 1; defval: string; raw: false; blankrows: true },
    ): SpreadsheetCell[][];
  };
};

const HEADER_HINTS = new Set([
  "id",
  "companyid",
  "company_id",
  "deal_id",
  "dealid",
  "target",
  "target_name",
  "target_asset",
  "target_company",
  "deal_target",
  "company",
  "asset",
  "buyer",
  "buyers",
  "seller",
  "sellers",
  "date",
  "completion_date",
  "completed_date",
  "deal_status",
  "revenue",
  "ebitda",
  "ev",
  "enterprise_value",
]);

const TARGET_HEADERS = new Set([
  "target",
  "target_name",
  "target_asset",
  "target_company",
  "deal_target",
  "company",
  "asset",
]);

function extensionOf(fileName = "") {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

function cellText(value: SpreadsheetCell) {
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? "" : String(value).trim();
}

function normaliseHeader(value: SpreadsheetCell) {
  return cellText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function withoutSourcePrefix(value: string) {
  return value.replace(/^(gain|origin|itn)_+/, "");
}

function headerScore(row: SpreadsheetCell[]) {
  const headers = row.map(normaliseHeader).filter(Boolean);
  const unprefixed = headers.map(withoutSourcePrefix);
  if (!unprefixed.some((header) => TARGET_HEADERS.has(header))) return 0;

  const recognised = unprefixed.filter((header) => HEADER_HINTS.has(header)).length;
  const hasId = unprefixed.some((header) =>
    ["id", "companyid", "company_id", "deal_id", "dealid"].includes(header),
  );
  return 20 + recognised * 4 + (hasId ? 6 : 0) + Math.min(headers.length, 20) / 20;
}

function rowsFromMatrix(matrix: SpreadsheetCell[][], headerIndex: number): RawSpreadsheetRow[] {
  const seen = new Map<string, number>();
  const headers = matrix[headerIndex].map((value) => {
    const base = cellText(value);
    if (!base) return "";
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} ${count}`;
  });

  return matrix.slice(headerIndex + 1).flatMap((values) => {
    if (!values.some((value) => cellText(value))) return [];
    const row = Object.fromEntries(
      headers.flatMap((header, index) =>
        header ? [[header, cellText(values[index])]] : [],
      ),
    );
    return Object.keys(row).length ? [row] : [];
  });
}

export function parseCsv(text: string): RawSpreadsheetRow[] {
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) table.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) table.push(row);
  if (table.length < 2) throw new Error("The CSV needs a header row and at least one deal.");

  const headers = table[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return table.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

export async function readDealRows(
  file: Pick<File, "name" | "text" | "arrayBuffer">,
  suppliedXlsxApi?: XlsxApi,
): Promise<RawSpreadsheetRow[]> {
  const extension = extensionOf(file.name);
  if (extension === "csv") return parseCsv(await file.text());

  if (extension === "xlsx" || extension === "xls") {
    const xlsxApi = suppliedXlsxApi ?? (globalThis as typeof globalThis & { XLSX?: XlsxApi }).XLSX;
    if (!xlsxApi?.read || !xlsxApi?.utils?.sheet_to_json) {
      throw new Error("Excel support did not load. Refresh the page and try again.");
    }

    const workbook = xlsxApi.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: false,
    });
    let bestTable: { matrix: SpreadsheetCell[][]; headerIndex: number; score: number } | null = null;

    for (const sheetName of workbook.SheetNames ?? []) {
      const sheet = workbook.Sheets?.[sheetName];
      if (!sheet) continue;
      const matrix = xlsxApi.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: true,
      });

      matrix.slice(0, 50).forEach((row, headerIndex) => {
        const score = headerScore(row);
        if (score > (bestTable?.score ?? 0)) bestTable = { matrix, headerIndex, score };
      });
    }

    if (!bestTable) {
      throw new Error("No deal table was found. The Excel file needs a target/company column.");
    }

    return rowsFromMatrix(bestTable.matrix, bestTable.headerIndex);
  }

  throw new Error("Choose a CSV or Excel (.xlsx or .xls) file.");
}
