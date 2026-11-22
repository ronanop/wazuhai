import { config } from "../lib/config.js";
import { httpJson } from "./http.js";

type SearchResponse = {
  took?: number;
  hits?: {
    total?: { value?: number } | number;
    hits?: Array<{
      _id: string;
      _index: string;
      _source: Record<string, unknown>;
      sort?: unknown[];
    }>;
  };
  aggregations?: Record<string, unknown>;
  error?: unknown;
};

function totalHits(total: SearchResponse["hits"] extends infer H
  ? H extends { total?: infer T }
    ? T
    : never
  : never): number {
  if (typeof total === "number") return total;
  if (total && typeof total === "object" && "value" in total) {
    return Number((total as { value?: number }).value ?? 0);
  }
  return 0;
}

export async function indexerSearch(index: string, body: Record<string, unknown>) {
  const url = `${config.wazuh.indexerUrl.replace(/\/$/, "")}/${index}/_search`;
  const res = await httpJson<SearchResponse>(url, {
    method: "POST",
    body,
    auth: {
      user: config.wazuh.indexerUser,
      pass: config.wazuh.indexerPassword,
    },
  });

  if (res.status >= 400) {
    throw new Error(
      typeof res.data === "object" && res.data && "error" in res.data
        ? JSON.stringify(res.data.error)
        : `Indexer search failed (${res.status})`,
    );
  }

  return {
    total: totalHits(res.data.hits?.total),
    hits: res.data.hits?.hits ?? [],
    aggregations: res.data.aggregations ?? {},
  };
}

export async function indexerCount(index: string, query: Record<string, unknown> = { match_all: {} }) {
  const url = `${config.wazuh.indexerUrl.replace(/\/$/, "")}/${index}/_count`;
  const res = await httpJson<{ count?: number }>(url, {
    method: "POST",
    body: { query },
    auth: {
      user: config.wazuh.indexerUser,
      pass: config.wazuh.indexerPassword,
    },
  });
  if (res.status >= 400) {
    throw new Error(`Indexer count failed (${res.status})`);
  }
  return res.data.count ?? 0;
}
