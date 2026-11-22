function escapeCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Download `rows` as a CSV file. Columns are the union of object keys in order of first appearance. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    const blob = new Blob([""], { type: "text/csv;charset=utf-8" });
    triggerDownload(filename.endsWith(".csv") ? filename : `${filename}.csv`, blob);
    return;
  }

  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  const lines = [
    columns.map(escapeCell).join(","),
    ...rows.map((row) => columns.map((col) => escapeCell(row[col])).join(",")),
  ];

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(filename.endsWith(".csv") ? filename : `${filename}.csv`, blob);
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
