export type RawSpreadsheetRow = Record<string, string>;

type XlsxWorkbook = {
  SheetNames?: string[];
  Sheets?: Record<string, unknown>;
};

type XlsxApi = {
  read(data: ArrayBuffer, options: { type: "array"; cellDates: false }): XlsxWorkbook;
  utils: {
    sheet_to_json(
      sheet: unknown,
      options: { defval: string; raw: false; blankrows: false },
    ): RawSpreadsheetRow[];
  };
};

function extensionOf(fileName = "") {
  return fileName.toLowerCase().split(".").pop() ?? "";
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

  if (extension === "xlsx") {
    const xlsxApi = suppliedXlsxApi ?? (globalThis as typeof globalThis & { XLSX?: XlsxApi }).XLSX;
    if (!xlsxApi?.read || !xlsxApi?.utils?.sheet_to_json) {
      throw new Error("Excel support did not load. Refresh the page and try again.");
    }

    const workbook = xlsxApi.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: false,
    });
    const firstSheetName = workbook.SheetNames?.[0];
    const firstSheet = firstSheetName ? workbook.Sheets?.[firstSheetName] : null;
    if (!firstSheet) throw new Error("No worksheet was found in this Excel file.");

    return xlsxApi.utils.sheet_to_json(firstSheet, {
      defval: "",
      raw: false,
      blankrows: false,
    });
  }

  throw new Error("Choose a CSV or Excel (.xlsx) file.");
}
