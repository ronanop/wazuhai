import { useMemo, useState } from "react";
import {
  collectColumns,
  formatCell,
  humanizeKey,
  isObjectArray,
  isPlainObject,
  splitObject,
  type JsonObject,
} from "../lib/jsonTable";

export type DataViewMode = "table" | "json";

type Props = {
  data: unknown;
  title?: string;
  defaultMode?: DataViewMode;
  /** Persist mode across remounts via a shared key (optional). */
  storageKey?: string;
  className?: string;
  maxHeight?: string;
};

function readStoredMode(key: string | undefined, fallback: DataViewMode): DataViewMode {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const v = window.sessionStorage.getItem(key);
    return v === "json" || v === "table" ? v : fallback;
  } catch {
    return fallback;
  }
}

export function DataView({
  data,
  title,
  defaultMode = "table",
  storageKey,
  className,
  maxHeight = "70vh",
}: Props) {
  const [mode, setMode] = useState<DataViewMode>(() => readStoredMode(storageKey, defaultMode));

  function setView(next: DataViewMode) {
    setMode(next);
    if (!storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  }

  const jsonText = useMemo(() => {
    try {
      return JSON.stringify(data ?? null, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <div className={`data-view ${className ?? ""}`.trim()}>
      <div className="data-view-bar">
        {title ? <span className="data-view-title">{title}</span> : <span />}
        <div className="range-pills" role="group" aria-label="Data view mode">
          <button
            type="button"
            className={`btn ${mode === "table" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setView("table")}
          >
            Table
          </button>
          <button
            type="button"
            className={`btn ${mode === "json" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setView("json")}
          >
            JSON
          </button>
        </div>
      </div>

      {mode === "json" ? (
        <pre className="data-view-json" style={{ maxHeight }}>
          {jsonText}
        </pre>
      ) : (
        <div className="data-view-tables" style={{ maxHeight }}>
          <JsonTables value={data} depth={0} />
        </div>
      )}
    </div>
  );
}

function JsonTables({ value, depth, label }: { value: unknown; depth: number; label?: string }) {
  if (value === undefined) {
    return <p className="empty">No data</p>;
  }

  if (isObjectArray(value)) {
    return (
      <section className="data-view-section">
        {label && <h3 className="data-view-section-title">{humanizeKey(label)}</h3>}
        <ObjectArrayTable rows={value} />
      </section>
    );
  }

  if (Array.isArray(value)) {
    return (
      <section className="data-view-section">
        {label && <h3 className="data-view-section-title">{humanizeKey(label)}</h3>}
        <table className="data-table data-view-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {value.length === 0 ? (
              <tr>
                <td colSpan={2}>—</td>
              </tr>
            ) : (
              value.map((item, i) => (
                <tr key={i} style={{ cursor: "default" }}>
                  <td>{i + 1}</td>
                  <td>
                    {isPlainObject(item) || Array.isArray(item) ? (
                      <JsonTables value={item} depth={depth + 1} />
                    ) : (
                      formatCell(item)
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    );
  }

  if (isPlainObject(value)) {
    const { scalars, nested } = splitObject(value);
    return (
      <div className="data-view-object">
        {label && depth > 0 && <h3 className="data-view-section-title">{humanizeKey(label)}</h3>}
        {scalars.length > 0 && (
          <section className="data-view-section">
            {depth === 0 && !label && nested.length > 0 && (
              <h3 className="data-view-section-title">Summary</h3>
            )}
            <table className="data-table data-view-table data-view-kv">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {scalars.map(([key, v]) => (
                  <tr key={key} style={{ cursor: "default" }}>
                    <td>
                      <strong>{humanizeKey(key)}</strong>
                      <div className="data-view-keyhint">{key}</div>
                    </td>
                    <td>{formatCell(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {nested.map(([key, v]) => (
          <JsonTables key={key} value={v} depth={depth + 1} label={key} />
        ))}
        {scalars.length === 0 && nested.length === 0 && <p className="empty">Empty object</p>}
      </div>
    );
  }

  return (
    <section className="data-view-section">
      {label && <h3 className="data-view-section-title">{humanizeKey(label)}</h3>}
      <p className="data-view-scalar">{formatCell(value)}</p>
    </section>
  );
}

function ObjectArrayTable({ rows }: { rows: JsonObject[] }) {
  const columns = collectColumns(rows);
  const complexCols = new Set(
    columns.filter((col) =>
      rows.some((row) => {
        const v = row[col];
        return isPlainObject(v) || (Array.isArray(v) && isObjectArray(v));
      }),
    ),
  );

  return (
    <div className="data-view-table-wrap">
      <table className="data-table data-view-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{humanizeKey(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ cursor: "default" }}>
              {columns.map((col) => {
                const v = row[col];
                if (complexCols.has(col) && (isPlainObject(v) || isObjectArray(v))) {
                  return (
                    <td key={col}>
                      <details className="data-view-details">
                        <summary>{formatCell(v)}</summary>
                        <JsonTables value={v} depth={1} />
                      </details>
                    </td>
                  );
                }
                return <td key={col}>{formatCell(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
