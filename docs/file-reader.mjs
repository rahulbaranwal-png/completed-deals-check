import { parseCsv } from "./logic.mjs";

const EXCEL_EXTENSIONS = new Set(["xlsx"]);

function extensionOf(fileName = "") {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

export async function readDealRows(file, xlsxApi = globalThis.XLSX) {
  const extension = extensionOf(file?.name);

  if (extension === "csv") {
    return parseCsv(await file.text());
  }

  if (EXCEL_EXTENSIONS.has(extension)) {
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
