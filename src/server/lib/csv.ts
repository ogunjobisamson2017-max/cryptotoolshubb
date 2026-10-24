/** CSV serialization with RFC-4180 quoting and formula-injection guarding. */

function guard(value: string): string {
  // Prevent Excel/Sheets from interpreting cells as formulas.
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  s = guard(s);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, csv: string): Response {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${safe}"`,
      "cache-control": "no-store",
    },
  });
}
