export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 10_000;

export interface CsvDocument {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export function parseCsv(text: string): CsvDocument {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field); records.push(row); row = []; field = ""; }
    else if (character !== "\r") field += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field || row.length) { row.push(field); records.push(row); }
  if (!records.length) throw new Error("CSV is empty");

  const headers = records[0]!.map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim());
  if (headers.some((header) => !header)) throw new Error("CSV contains an empty header");
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate headers");
  const data = records.slice(1).filter((values) => values.some((value) => value.trim()));
  if (data.length > MAX_CSV_ROWS) throw new Error(`CSV exceeds ${MAX_CSV_ROWS} data rows`);

  return {
    headers,
    rows: data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))),
  };
}

export function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
