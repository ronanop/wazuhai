export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function tryParseJson(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "string") {
    const d = Date.parse(value);
    if (
      value.length >= 10 &&
      !Number.isNaN(d) &&
      (/^\d{4}-\d{2}-\d{2}/.test(value) || value.endsWith("Z"))
    ) {
      return new Date(value).toLocaleString();
    }
    return value || "—";
  }
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || ["string", "number", "boolean"].includes(typeof v))) {
      return value.map((v) => formatCell(v)).join(", ") || "—";
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    return keys.length ? `{${keys.length} fields}` : "{}";
  }
  return String(value);
}

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** True when every item is a plain object (good candidate for a columns table). */
export function isObjectArray(value: unknown): value is JsonObject[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}

export function collectColumns(rows: JsonObject[], limit = 12): string[] {
  const seen = new Set<string>();
  const cols: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      cols.push(key);
      if (cols.length >= limit) return cols;
    }
  }
  return cols;
}

export function splitObject(obj: JsonObject): {
  scalars: Array<[string, unknown]>;
  nested: Array<[string, unknown]>;
} {
  const scalars: Array<[string, unknown]> = [];
  const nested: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(obj)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !(Array.isArray(value) && value.every((v) => v === null || ["string", "number", "boolean"].includes(typeof v)))
    ) {
      nested.push([key, value]);
    } else {
      scalars.push([key, value]);
    }
  }
  return { scalars, nested };
}
