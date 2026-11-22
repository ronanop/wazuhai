import { config } from "../lib/config.js";
import { httpJson } from "./http.js";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getApiToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const url = `${config.wazuh.apiUrl.replace(/\/$/, "")}/security/user/authenticate?raw=true`;
  const res = await httpJson<string | { data?: { token?: string }; title?: string; detail?: string }>(
    url,
    {
      method: "GET",
      auth: {
        user: config.wazuh.apiUser,
        pass: config.wazuh.apiPassword,
      },
    },
  );

  if (res.status >= 400) {
    const detail =
      typeof res.data === "object" && res.data && "detail" in res.data
        ? String(res.data.detail)
        : "Wazuh API auth failed";
    throw new Error(detail);
  }

  const token =
    typeof res.data === "string"
      ? res.data.trim()
      : res.data?.data?.token?.trim() ?? "";

  if (!token) throw new Error("Wazuh API returned empty token");

  cachedToken = {
    value: token,
    expiresAt: Date.now() + 14 * 60 * 1000,
  };
  return token;
}

async function wazuhApiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getApiToken();
  const url = `${config.wazuh.apiUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await httpJson<T & { title?: string; detail?: string; error?: number }>(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  if (res.status >= 400 || (typeof res.data === "object" && res.data && "error" in res.data && res.data.error)) {
    const detail =
      typeof res.data === "object" && res.data && "detail" in res.data
        ? String(res.data.detail)
        : `Wazuh API request failed (${res.status})`;
    throw new Error(detail);
  }

  return res.data;
}

export async function wazuhApiGet<T>(path: string): Promise<T> {
  return wazuhApiRequest<T>("GET", path);
}

export async function wazuhApiPut<T>(path: string, body?: unknown): Promise<T> {
  return wazuhApiRequest<T>("PUT", path, body);
}

export async function wazuhApiPost<T>(path: string, body?: unknown): Promise<T> {
  return wazuhApiRequest<T>("POST", path, body);
}
