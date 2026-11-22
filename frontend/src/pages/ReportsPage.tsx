import { useEffect, useState } from "react";
import { api } from "../api/client";
import { DataView } from "../components/DataView";
import "../styles/soc.css";

export function ReportsPage() {
  const [types, setTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState("executive");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.reportTypes().then((res) => setTypes(res.types)).catch(() => undefined);
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.generateReport(selected);
      setReport(res.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  async function downloadCsv() {
    const res = await fetch(api.reportCsvUrl(selected), { credentials: "include" });
    if (!res.ok) {
      setError("CSV export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-${selected}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    const res = await fetch(api.reportPdfUrl(selected), { credentials: "include" });
    if (!res.ok) {
      setError("PDF export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-${selected}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Reporting</p>
        <h1>Report Center</h1>
        <p className="sub">
          Generate operational summaries from live Wazuh telemetry and Aegis workflow data. Export CSV where useful.
        </p>
      </header>

      <section className="panel glass">
        <div className="toolbar">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="button" disabled={loading} onClick={generate}>
            {loading ? "Generating…" : "Preview"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={downloadCsv}>
            Export CSV
          </button>
          <button className="btn btn-ghost" type="button" onClick={downloadPdf}>
            Export PDF
          </button>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      {report && (
        <section className="panel glass">
          <div className="warning-banner">{String(report.disclaimer || "")}</div>
          <p className="empty" style={{ paddingTop: "0.75rem", paddingBottom: "0.75rem" }}>
            Generated {report.generatedAt ? new Date(String(report.generatedAt)).toLocaleString() : "—"} · type{" "}
            {String(report.type)}
          </p>
          <DataView data={report} storageKey="aegis-report-view" title="Report data" />
        </section>
      )}
    </div>
  );
}
