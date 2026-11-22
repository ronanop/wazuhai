export type RangeKey = "24h" | "7d" | "30d" | "all" | "custom";
export type SortDir = "desc" | "asc";

export type ListControlValue = {
  range: RangeKey;
  from: string;
  to: string;
  agent: string;
  sort: SortDir;
};

export const DEFAULT_LIST_CONTROLS: ListControlValue = {
  range: "all",
  from: "",
  to: "",
  agent: "",
  sort: "desc",
};

export function rangeToIso(range: Exclude<RangeKey, "custom" | "all">): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (range === "24h") from.setHours(from.getHours() - 24);
  else if (range === "7d") from.setDate(from.getDate() - 7);
  else from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function resolveRangeBounds(value: ListControlValue): { from?: string; to?: string } {
  if (value.range === "all") return {};
  if (value.range === "custom") {
    return {
      ...(value.from ? { from: value.from } : {}),
      ...(value.to ? { to: value.to } : {}),
    };
  }
  return rangeToIso(value.range);
}

/** Query params for API list calls. */
export function listQueryParams(value: ListControlValue): {
  from?: string;
  to?: string;
  agent?: string;
  sort?: SortDir;
} {
  const bounds = resolveRangeBounds(value);
  const agent = value.agent.trim();
  return {
    ...bounds,
    ...(agent ? { agent } : {}),
    sort: value.sort,
  };
}

export function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function patchListControls(
  prev: ListControlValue,
  patch: Partial<ListControlValue>,
): ListControlValue {
  const next = { ...prev, ...patch };
  if (patch.range && patch.range !== "custom" && patch.range !== "all") {
    const bounds = rangeToIso(patch.range);
    next.from = bounds.from;
    next.to = bounds.to;
  }
  if (patch.range === "all") {
    next.from = "";
    next.to = "";
  }
  return next;
}

/** Client-side filter + sort when the API returns a full (or large) list. */
export function applyClientListControls<T>(
  items: T[],
  value: ListControlValue,
  get: {
    time: (item: T) => string | null | undefined;
    agent?: (item: T) => string | null | undefined;
  },
): T[] {
  const bounds = resolveRangeBounds(value);
  const fromMs = bounds.from ? Date.parse(bounds.from) : NaN;
  const toMs = bounds.to ? Date.parse(bounds.to) : NaN;
  const agentQ = value.agent.trim().toLowerCase();

  let next = items.filter((item) => {
    if (agentQ && get.agent) {
      const name = String(get.agent(item) ?? "").toLowerCase();
      if (!name.includes(agentQ)) return false;
    }
    const raw = get.time(item);
    if (!raw) return !bounds.from && !bounds.to;
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return true;
    if (!Number.isNaN(fromMs) && t < fromMs) return false;
    if (!Number.isNaN(toMs) && t > toMs) return false;
    return true;
  });

  next = [...next].sort((a, b) => {
    const ta = Date.parse(String(get.time(a) ?? "")) || 0;
    const tb = Date.parse(String(get.time(b) ?? "")) || 0;
    return value.sort === "asc" ? ta - tb : tb - ta;
  });

  return next;
}

export function sortLabel(sort: SortDir): string {
  return sort === "asc" ? "Oldest first" : "Newest first";
}

export function toggleSort(sort: SortDir): SortDir {
  return sort === "desc" ? "asc" : "desc";
}
