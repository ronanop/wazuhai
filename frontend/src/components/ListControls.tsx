import type { ReactNode } from "react";
import {
  fromLocalInput,
  patchListControls,
  toLocalInput,
  type ListControlValue,
  type RangeKey,
  type SortDir,
} from "../lib/listControls";

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

type Props = {
  value: ListControlValue;
  onChange: (next: ListControlValue) => void;
  showAgent?: boolean;
  agentPlaceholder?: string;
  /** Extra controls rendered after the shared filters (search, severity, etc. stay outside). */
  children?: ReactNode;
};

export function ListControls({
  value,
  onChange,
  showAgent = true,
  agentPlaceholder = "Filter by agent…",
  children,
}: Props) {
  function set(patch: Partial<ListControlValue>) {
    onChange(patchListControls(value, patch));
  }

  return (
    <div className="list-controls">
      <div className="list-controls-row">
        <span className="list-controls-label">Time range</span>
        <div className="range-pills" role="group" aria-label="Time range">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`btn ${value.range === opt.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => set({ range: opt.key })}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="list-controls-inline">
          <span className="list-controls-label">Sort</span>
          <select
            value={value.sort}
            onChange={(e) => set({ sort: e.target.value as SortDir })}
            aria-label="Sort by time"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
        {showAgent && (
          <input
            className="list-controls-agent"
            placeholder={agentPlaceholder}
            value={value.agent}
            onChange={(e) => set({ agent: e.target.value })}
            aria-label="Filter by agent"
          />
        )}
        {children}
      </div>
      {value.range === "custom" && (
        <div className="list-controls-row list-controls-custom">
          <label className="list-controls-inline">
            <span className="list-controls-label">From</span>
            <input
              type="datetime-local"
              value={toLocalInput(value.from)}
              onChange={(e) => set({ from: fromLocalInput(e.target.value), range: "custom" })}
            />
          </label>
          <label className="list-controls-inline">
            <span className="list-controls-label">To</span>
            <input
              type="datetime-local"
              value={toLocalInput(value.to)}
              onChange={(e) => set({ to: fromLocalInput(e.target.value), range: "custom" })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

type SortableThProps = {
  label?: string;
  sort: SortDir;
  onToggle: () => void;
};

/** Clickable time column header that mirrors the shared sort control. */
export function SortableTimeTh({ label = "Time", sort, onToggle }: SortableThProps) {
  return (
    <th className="sortable-th">
      <button type="button" className="sortable-th-btn" onClick={onToggle} title="Toggle time sort">
        {label}
        <span className="sort-indicator" aria-hidden>
          {sort === "desc" ? "↓" : "↑"}
        </span>
      </button>
    </th>
  );
}
