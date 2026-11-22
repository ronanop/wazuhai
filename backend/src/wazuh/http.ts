import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

export type HttpJsonResult<T> = {
  status: number;
  data: T;
};

export async function httpJson<T>(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    auth?: { user: string; pass: string };
  } = {},
): Promise<HttpJsonResult<T>> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const payload = init.body === undefined ? undefined : JSON.stringify(init.body);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers ?? {}),
  };
  if (payload) headers["Content-Type"] = "application/json";
  if (init.auth) {
    headers.Authorization =
      "Basic " + Buffer.from(`${init.auth.user}:${init.auth.pass}`).toString("base64");
  }

  return new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: init.method ?? (payload ? "POST" : "GET"),
        headers,
        agent: isHttps ? insecureAgent : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data: T;
          try {
            data = raw ? (JSON.parse(raw) as T) : ({} as T);
          } catch {
            data = raw as unknown as T;
          }
          resolve({ status: res.statusCode ?? 500, data });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
