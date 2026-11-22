function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  jwtSecret: required("JWT_SECRET", "aegis_dev_jwt_change_me_in_production_32chars"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  cookieName: "aegis_session",
  wazuh: {
    apiUrl: process.env.WAZUH_API_URL ?? "https://192.168.191.128:55000",
    apiUser: process.env.WAZUH_API_USER ?? "wazuh",
    apiPassword: process.env.WAZUH_API_PASSWORD ?? "wazuh",
    indexerUrl: process.env.WAZUH_INDEXER_URL ?? "https://192.168.191.128:9200",
    indexerUser: process.env.WAZUH_INDEXER_USER ?? "admin",
    indexerPassword: process.env.WAZUH_INDEXER_PASSWORD ?? "admin",
  },
  opencti: {
    url: (process.env.OPENCTI_URL ?? "http://host.docker.internal:8080").replace(/\/$/, ""),
    token: process.env.OPENCTI_TOKEN ?? "",
    streamId: (process.env.OPENCTI_STREAM_ID ?? "").trim(),
    uiUrl: (process.env.OPENCTI_UI_URL ?? "http://localhost:8080").replace(/\/$/, ""),
  },
};
