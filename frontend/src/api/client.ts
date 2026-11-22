/** Empty = same-origin (Vite proxies /api → backend). */
const API_URL = import.meta.env.VITE_API_URL ?? "";

export type Role = "ADMINISTRATOR" | "SOC_ANALYST";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  lastLoginAt: string | null;
};

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Alert = {
  id: string;
  indexId: string;
  timestamp: string;
  ruleId: string;
  ruleDescription: string;
  level: number;
  severity: Severity;
  agentId: string;
  agentName: string;
  location: string;
  groups: string[];
  decoder: string;
  mitre?: string[];
  compliance: {
    pciDss: string[];
    hipaa: string[];
    nist: string[];
    gdpr: string[];
    tsc: string[];
  };
  raw: Record<string, unknown>;
};

export type Vulnerability = {
  id: string;
  cve: string;
  severity: string;
  packageName: string;
  packageVersion: string;
  agentId: string;
  agentName: string;
  os: string;
  description: string;
  detectedAt: string;
  reference: string;
  score: number | null;
};

export type Agent = {
  id: string;
  name: string;
  ip: string | null;
  status: string;
  version: string | null;
  lastKeepAlive: string | null;
  os: string | null;
  alertCount?: number;
};

export type DashboardSummary = {
  source: string;
  range?: { from: string | null; to: string | null };
  totals: {
    alerts: number;
    vulnerabilities: number;
    agentsObserved: number;
  };
  severity: Record<Severity, number>;
  agents: Array<{ name: string; alertCount: number }>;
  timeline?: Array<{ at: string; alerts: number; highCritical: number }>;
  recentAlerts: Alert[];
  moduleCounts?: {
    fim: number;
    malware: number;
    sca: number;
    mitreTechniques: number;
    complianceFrameworks: number;
  };
};

export type AlertTriage = {
  indexId: string;
  status: string;
  assignee: string;
  updatedAt: string | null;
};

export type SavedHuntQuery = {
  id: string;
  name: string;
  query: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FimEvent = {
  id: string;
  indexId: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  path: string;
  event: string;
  user: string;
  md5: string;
  sha256: string;
  ruleId: string;
  ruleDescription: string;
  level: number;
  fullLog: string;
};

export type AgentRelated = {
  alerts: Alert[];
  vulnerabilities: Vulnerability[];
  fimEvents: FimEvent[];
};

export type ScaSummary = {
  indexId: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  policy: string;
  policyId: string;
  score: number;
  passed: number;
  failed: number;
  invalid: number;
  totalChecks: number;
  description: string;
};

export type ScaCheck = {
  indexId: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  policy: string;
  checkId: string;
  title: string;
  description: string;
  result: string;
  remediation: string;
  rationale: string;
  reason: string;
};

export type MalwareFinding = Alert & {
  classification: "confirmed" | "suspicious";
  title: string;
  file: string;
  fullLog: string;
  investigation: {
    status: string;
    note: string;
    updatedAt: string | null;
  };
};

export type MitreCoverage = {
  source: string;
  observedTechniques: number;
  coveredInMatrix: number;
  matrixSize: number;
  tactics: Array<{
    tactic: string;
    total: number;
    covered: number;
    techniques: Array<{
      id: string;
      name: string;
      tactic: string;
      alertCount: number;
      covered: boolean;
    }>;
  }>;
};

export type ThreatIntelLabel = { value: string; color?: string };

export type ThreatIndicator = {
  id: string;
  name: string;
  patternType: string;
  pattern: string;
  validFrom: string | null;
  validUntil: string | null;
  confidence: number | null;
  score: number | null;
  createdAt: string | null;
  modifiedAt: string | null;
  labels: ThreatIntelLabel[];
  raw: Record<string, unknown>;
};

export type ThreatActorLike = {
  id: string;
  entityType: string;
  name: string;
  aliases: string[];
  description: string;
  createdAt: string | null;
  modifiedAt: string | null;
  labels: ThreatIntelLabel[];
  regions: string[];
  countries: string[];
  raw: Record<string, unknown>;
};

export type ThreatFeedEvent = {
  id: string;
  eventId: string;
  eventType: string;
  entityType: string;
  name: string;
  message: string;
  timestamp: string | null;
  score: number | null;
  labels: string[];
  regions: string[];
  raw: Record<string, unknown>;
};

export type OpenCtiHealth = {
  ok: boolean;
  version?: string | null;
  uiUrl: string;
  streamConfigured: boolean;
  error?: string;
};

export type OpenCtiSummary = {
  indicators: number;
  malwares: number;
  intrusionSets: number;
  reports: number;
  campaigns: number;
  last24hIndicators: number;
};

export type DashboardNamedCount = {
  id: string;
  name: string;
  entityType: string;
  count: number;
};

export type OpenCtiDashboard = {
  windowDays: number;
  summary: {
    intrusionSets: number;
    malwares: number;
    reports: number;
    indicators: number;
    campaigns: number;
    relationships: number;
    last24h: {
      intrusionSets: number;
      malwares: number;
      reports: number;
      indicators: number;
    };
  };
  distribution: Array<{ label: string; value: number }>;
  activeThreats: DashboardNamedCount[];
  activeMalware: DashboardNamedCount[];
  targetedVictims: DashboardNamedCount[];
  countries: DashboardNamedCount[];
  vulnerabilities: DashboardNamedCount[];
  relationshipTimeline: Array<{ date: string; label: string; count: number }>;
  recentReports: ThreatActorLike[];
  activeLabels: Array<{ value: string; color?: string; count: number }>;
};

export type CatalogEntity = ThreatActorLike & {
  patternType?: string;
  pattern?: string;
  confidence?: number | null;
  score?: number | null;
  mitreId?: string | null;
  slug: string;
};

export type EntityRelNode = {
  id: string;
  name: string;
  entityType: string;
  slug: string;
};

export type EntityRelEdge = {
  id: string;
  relationshipType: string;
  fromId: string;
  toId: string;
};

export type IndicatorSightings = {
  indicatorId: string;
  name: string;
  observables: Array<{ kind: string; value: string }>;
  total: number;
  alerts: Alert[];
};

export type AttackCoverageState = "both" | "opencti_only" | "wazuh_only" | "gap";

export type AttackCoverage = {
  source: string;
  openctiPatterns: number;
  wazuhObserved: number;
  both: number;
  openctiOnly: number;
  wazuhOnly: number;
  gap: number;
  tactics: Array<{
    tactic: string;
    total: number;
    both: number;
    openctiOnly: number;
    wazuhOnly: number;
    gap: number;
    techniques: Array<{
      id: string;
      name: string;
      tactic: string;
      alertCount: number;
      state: AttackCoverageState;
      openctiId: string | null;
    }>;
  }>;
  uiUrl?: string;
};

export type ThreatIntelCase = {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  incidentId: string | null;
  incident: { id: string; title: string; status: string } | null;
  createdBy: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
  entities: Array<{
    id: string;
    openctiId: string;
    entityType: string;
    name: string;
    slug: string;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Request failed");
  }
  return data as T;
}

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/api/auth/me"),
  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  acceptInvite: (payload: { token: string; password: string; name?: string }) =>
    request<{ ok: boolean; user: User }>("/api/auth/accept-invite", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  updateProfile: (name: string) =>
    request<{ user: User }>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  users: () => request<{ users: User[] }>("/api/users"),
  inviteUser: (payload: { email: string; name: string; role: Role }) =>
    request<{ user: User; inviteToken: string; expiresAt: string }>("/api/users/invite", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (id: string, payload: { name?: string; role?: Role; status?: string }) =>
    request<{ user: User }>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  adminResetPassword: (id: string) =>
    request<{ ok: boolean; resetToken: string; expiresAt: string }>(`/api/users/${id}/reset-password`, {
      method: "POST",
    }),
  appSettings: () => request<{ settings: AppSettings }>("/api/settings/app"),
  appSettingsPublic: () =>
    request<{
      settings: { timezone: string; dateFormat: string; defaultLanding: string; sessionHours: number };
    }>("/api/settings/app/public"),
  updateAppSettings: (payload: Record<string, unknown>) =>
    request<{ settings: AppSettings }>("/api/settings/app", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  testEmail: (to?: string) =>
    request<{ result: { delivered: boolean; mode: string } }>("/api/settings/app/test-email", {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  roles: () =>
    request<{
      modules: string[];
      permissions: RolePermission[];
      assignments: Array<{ role: Role; count: number }>;
    }>("/api/roles"),
  updateRolePermission: (payload: Record<string, unknown>) =>
    request<{ permission: RolePermission }>("/api/roles", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  resetRolePermissions: () =>
    request<{ permissions: RolePermission[] }>("/api/roles/reset", { method: "POST" }),
  notificationRules: () => request<{ rules: NotificationRule[] }>("/api/notification-rules"),
  createNotificationRule: (payload: Record<string, unknown>) =>
    request<{ rule: NotificationRule }>("/api/notification-rules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateNotificationRule: (id: string, payload: Record<string, unknown>) =>
    request<{ rule: NotificationRule }>(`/api/notification-rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  health: () => request<{ status: string; phase?: number }>("/api/health"),
  dashboardSummary: (params: { from?: string; to?: string } = {}) =>
    request<DashboardSummary>(`/api/dashboard/summary${qs(params)}`),
  alerts: (params: {
    page?: number;
    pageSize?: number;
    q?: string;
    severity?: string;
    agent?: string;
    from?: string;
    to?: string;
    sort?: string;
  } = {}) =>
    request<{ page: number; pageSize: number; total: number; alerts: Alert[] }>(
      `/api/alerts${qs(params)}`,
    ),
  alertTriageGet: (ids: string[]) =>
    request<{ triage: AlertTriage[] }>(
      `/api/alerts/triage${qs({ ids: ids.join(",") })}`,
    ),
  alertTriageSet: (payload: { indexId: string; status: string; assignee?: string }) =>
    request<{ triage: AlertTriage }>("/api/alerts/triage", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  vulnerabilities: (params: {
    page?: number;
    pageSize?: number;
    q?: string;
    severity?: string;
    agent?: string;
    from?: string;
    to?: string;
    sort?: string;
  } = {}) =>
    request<{
      page: number;
      pageSize: number;
      total: number;
      summary: Array<{ severity: string; count: number }>;
      vulnerabilities: Vulnerability[];
    }>(`/api/vulnerabilities${qs(params)}`),
  agents: () =>
    request<{
      source: string;
      total: number;
      agents: Agent[];
      warning: string | null;
    }>("/api/agents"),
  agentRelated: (id: string) =>
    request<AgentRelated>(`/api/agents/${encodeURIComponent(id)}/related`),
  huntSearch: (params: Record<string, string | number | undefined> = {}) =>
    request<{ page: number; pageSize: number; total: number; events: Alert[] }>(
      `/api/hunting/search${qs(params)}`,
    ),
  huntSaved: () => request<{ queries: SavedHuntQuery[] }>("/api/hunting/saved"),
  huntSave: (name: string, query: Record<string, unknown>) =>
    request<{ query: SavedHuntQuery }>("/api/hunting/saved", {
      method: "POST",
      body: JSON.stringify({ name, query }),
    }),
  huntDelete: (id: string) =>
    request<{ ok: boolean }>(`/api/hunting/saved/${id}`, { method: "DELETE" }),
  huntNotesGet: (ids: string[]) =>
    request<{
      notes: Array<{ findingKey: string; note: string; status: string; updatedAt: string }>;
    }>(`/api/hunting/notes${qs({ ids: ids.join(",") })}`),
  huntNoteSet: (payload: { findingKey: string; note?: string; status?: string }) =>
    request<{
      note: { findingKey: string; note: string; status: string; updatedAt: string };
    }>("/api/hunting/notes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  fim: (params: Record<string, string | number | undefined> = {}) =>
    request<{ page: number; pageSize: number; total: number; note: string | null; events: FimEvent[] }>(
      `/api/fim${qs(params)}`,
    ),
  scaSummary: () => request<{ summaries: ScaSummary[] }>("/api/sca/summary"),
  scaChecks: (params: Record<string, string | number | undefined> = {}) =>
    request<{
      page: number;
      pageSize: number;
      total: number;
      byResult: Array<{ result: string; count: number }>;
      checks: ScaCheck[];
    }>(`/api/sca/checks${qs(params)}`),
  malware: (params: Record<string, string | number | undefined> = {}) =>
    request<{ page: number; pageSize: number; total: number; findings: MalwareFinding[] }>(
      `/api/malware${qs(params)}`,
    ),
  malwareNote: (payload: { findingKey: string; note?: string; status?: string }) =>
    request<{ note: unknown }>("/api/malware/notes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  mitreCoverage: () => request<MitreCoverage>("/api/mitre/coverage"),
  mitreTechnique: (id: string) =>
    request<{
      technique: { id: string; name: string; tactic: string };
      total: number;
      alerts: Alert[];
    }>(`/api/mitre/technique/${encodeURIComponent(id)}`),

  opsSummary: () =>
    request<{
      openIncidents: number;
      openTickets: number;
      overdueTickets: number;
      unreadNotifications: number;
    }>("/api/ops/summary"),

  incidents: (params: Record<string, string | number | undefined> = {}) =>
    request<{ incidents: Incident[] }>(`/api/incidents${qs(params)}`),
  incident: (id: string) => request<{ incident: IncidentDetail }>(`/api/incidents/${id}`),
  createIncident: (payload: Record<string, unknown>) =>
    request<{ incident: Incident }>("/api/incidents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateIncident: (id: string, payload: Record<string, unknown>) =>
    request<{ incident: Incident }>(`/api/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  addIncidentNote: (id: string, body: string) =>
    request<{ note: { id: string; body: string; createdAt: string; user: { id: string; name: string } } }>(
      `/api/incidents/${id}/notes`,
      { method: "POST", body: JSON.stringify({ body }) },
    ),

  tickets: (params: Record<string, string | number | undefined> = {}) =>
    request<{ tickets: Ticket[] }>(`/api/tickets${qs(params)}`),
  ticket: (id: string) => request<{ ticket: TicketDetail }>(`/api/tickets/${id}`),
  createTicket: (payload: Record<string, unknown>) =>
    request<{ ticket: Ticket }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTicket: (id: string, payload: Record<string, unknown>) =>
    request<{ ticket: Ticket }>(`/api/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  addTicketComment: (id: string, body: string) =>
    request<{ comment: { id: string; body: string; createdAt: string; user: { id: string; name: string } } }>(
      `/api/tickets/${id}/comments`,
      { method: "POST", body: JSON.stringify({ body }) },
    ),

  auditLogs: (params: Record<string, string | number | undefined> = {}) =>
    request<{ logs: AuditEntry[] }>(`/api/audit${qs(params)}`),

  notifications: (unread?: boolean) =>
    request<{ unreadCount: number; notifications: AppNotification[] }>(
      `/api/notifications${qs({ unread: unread ? "1" : undefined })}`,
    ),
  markNotificationRead: (id: string) =>
    request<{ notification: AppNotification }>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    request<{ ok: boolean }>("/api/notifications/read-all", { method: "POST" }),

  complianceFrameworks: () =>
    request<{
      source: string;
      note: string;
      frameworks: ComplianceFramework[];
    }>("/api/compliance/frameworks"),
  complianceControls: (frameworkId: string) =>
    request<{
      framework: { id: string; name: string; shortName: string; description: string; disclaimer: string };
      controls: ComplianceControl[];
    }>(`/api/compliance/frameworks/${frameworkId}/controls`),
  complianceEvidence: (frameworkId: string, controlId: string, params: Record<string, string | number | undefined> = {}) =>
    request<{
      framework: { id: string; name: string; shortName: string; disclaimer: string };
      controlId: string;
      page: number;
      pageSize: number;
      alertTotal: number;
      alerts: Alert[];
      scaTotal: number;
      scaChecks: Array<{
        indexId: string;
        timestamp: string;
        agentName: string;
        policy: string;
        title: string;
        result: string;
        remediation: string;
      }>;
    }>(
      `/api/compliance/frameworks/${frameworkId}/controls/${encodeURIComponent(controlId)}/evidence${qs(params)}`,
    ),

  reportTypes: () => request<{ types: Array<{ id: string; name: string }> }>("/api/reports/types"),
  generateReport: (type: string) =>
    request<{ report: Record<string, unknown> }>(`/api/reports/generate/${type}`),
  reportCsvUrl: (type: string) => `/api/reports/generate/${type}?format=csv`,
  reportPdfUrl: (type: string) => `/api/reports/generate/${type}?format=pdf`,

  chatbotSettings: () => request<{ settings: ChatbotSettings }>("/api/settings/chatbot"),
  chatbotPublicSettings: () =>
    request<{
      settings: {
        enabled: boolean;
        model: string;
        groundingEnabled: boolean;
        requireCitations: boolean;
        refuseIfNoEvidence: boolean;
        apiKeyConfigured: boolean;
        toolsEnabled: boolean;
        suggestPlaybooks: boolean;
        activeResponseEnabled: boolean;
        dryRunDefault: boolean;
        maxActionsPerDay: number;
      };
    }>("/api/settings/chatbot/public"),
  updateChatbotSettings: (payload: Record<string, unknown>) =>
    request<{ settings: ChatbotSettings }>("/api/settings/chatbot", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  resetChatbotPrompt: () =>
    request<{ settings: ChatbotSettings }>("/api/settings/chatbot/reset-prompt", { method: "POST" }),
  chat: (payload: {
    message: string;
    page?: string;
    selected?: { type?: string; id?: string; title?: string; meta?: Record<string, unknown> };
  }) =>
    request<{
      message: { id: string; role: string; content: string; createdAt: string };
      evidence?: {
        sources: Array<{ kind: string; id: string; label: string }>;
        retrievedAt: string;
        page: string;
      };
      mode: string;
      model?: string;
      suggestions?: string[];
    }>("/api/chat", { method: "POST", body: JSON.stringify(payload) }),
  chatSuggestions: (page?: string, selectedType?: string) =>
    request<{ prompts: string[] }>(
      `/api/chat/suggestions${qs({ page: page || undefined, selectedType: selectedType || undefined })}`,
    ),
  chatHistory: () =>
    request<{
      messages: Array<{
        id: string;
        role: string;
        content: string;
        page: string | null;
        evidence: unknown;
        createdAt: string;
      }>;
    }>("/api/chat/history"),
  clearChatHistory: () => request<{ ok: boolean }>("/api/chat/history", { method: "DELETE" }),

  playbooks: () => request<{ playbooks: Playbook[] }>("/api/playbooks"),
  responseActions: (params: {
    status?: string;
    incidentId?: string;
    agent?: string;
    from?: string;
    to?: string;
    sort?: string;
  } = {}) =>
    request<{ actions: ResponseAction[] }>(`/api/response-actions${qs(params)}`),
  proposeResponseAction: (payload: Record<string, unknown>) =>
    request<{ action: ResponseAction; autoExecuted?: boolean }>("/api/response-actions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  approveResponseAction: (id: string) =>
    request<{ action: ResponseAction }>(`/api/response-actions/${id}/approve`, { method: "POST" }),
  rejectResponseAction: (id: string, reason?: string) =>
    request<{ action: ResponseAction }>(`/api/response-actions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  incidentInvestigation: (id: string) =>
    request<{ investigation: IncidentInvestigation }>(`/api/incidents/${id}/investigation`),

  openctiHealth: () => request<OpenCtiHealth>("/api/opencti/health"),
  openctiSummary: () =>
    request<{
      summary: OpenCtiSummary;
      uiUrl: string;
      streamConfigured: boolean;
    }>("/api/opencti/summary"),
  openctiDashboard: (params: { windowDays?: number } = {}) =>
    request<{
      dashboard: OpenCtiDashboard;
      uiUrl: string;
      streamConfigured: boolean;
    }>(`/api/opencti/dashboard${qs(params)}`),
  openctiIndicators: (
    params: {
      pageSize?: number;
      q?: string;
      sort?: string;
      after?: string;
    } = {},
  ) =>
    request<{ indicators: ThreatIndicator[]; total: number; endCursor: string | null }>(
      `/api/opencti/indicators${qs(params)}`,
    ),
  openctiThreats: (params: { limit?: number } = {}) =>
    request<{
      malwares: ThreatActorLike[];
      intrusionSets: ThreatActorLike[];
      campaigns: ThreatActorLike[];
      reports: ThreatActorLike[];
    }>(`/api/opencti/threats${qs(params)}`),
  openctiFeed: (params: { limit?: number } = {}) =>
    request<{ events: ThreatFeedEvent[]; mode: string }>(`/api/opencti/feed${qs(params)}`),
  openctiStreamUrl: (from?: string) =>
    `${API_URL}/api/opencti/stream${qs({ from: from || undefined })}`,
  openctiEntities: (
    type: string,
    params: { pageSize?: number; q?: string; after?: string } = {},
  ) =>
    request<{
      entities: CatalogEntity[];
      total: number;
      endCursor: string | null;
      catalog: { type: string; routeSlug: string; label: string; entityType: string };
      uiUrl: string;
    }>(`/api/opencti/entities/${encodeURIComponent(type)}${qs(params)}`),
  openctiEntity: (type: string, id: string) =>
    request<{ entity: CatalogEntity; uiUrl: string }>(
      `/api/opencti/entities/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
    ),
  openctiRelationships: (type: string, id: string, params: { limit?: number } = {}) =>
    request<{ nodes: EntityRelNode[]; edges: EntityRelEdge[] }>(
      `/api/opencti/entities/${encodeURIComponent(type)}/${encodeURIComponent(id)}/relationships${qs(params)}`,
    ),
  openctiIndicatorSightings: (id: string, params: { pageSize?: number } = {}) =>
    request<IndicatorSightings>(
      `/api/opencti/indicators/${encodeURIComponent(id)}/sightings${qs(params)}`,
    ),
  openctiAttackCoverage: () => request<AttackCoverage>("/api/opencti/attack-coverage"),
  threatCases: (params: { status?: string; q?: string } = {}) =>
    request<{ cases: ThreatIntelCase[] }>(`/api/threat-cases${qs(params)}`),
  threatCase: (id: string) => request<{ case: ThreatIntelCase }>(`/api/threat-cases/${id}`),
  createThreatCase: (payload: {
    title: string;
    description?: string;
    severity?: string;
    status?: string;
    incidentId?: string | null;
  }) =>
    request<{ case: ThreatIntelCase }>("/api/threat-cases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateThreatCase: (
    id: string,
    payload: Partial<{
      title: string;
      description: string;
      severity: string;
      status: string;
      incidentId: string | null;
    }>,
  ) =>
    request<{ case: ThreatIntelCase }>(`/api/threat-cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  attachThreatCaseEntity: (
    id: string,
    payload: { openctiId: string; entityType: string; name: string; slug?: string },
  ) =>
    request<{ case: ThreatIntelCase }>(`/api/threat-cases/${id}/entities`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  detachThreatCaseEntity: (id: string, entityId: string) =>
    request<{ case: ThreatIntelCase }>(`/api/threat-cases/${id}/entities/${entityId}`, {
      method: "DELETE",
    }),
  addThreatCaseNote: (id: string, body: string) =>
    request<{ case: ThreatIntelCase }>(`/api/threat-cases/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  threatCaseCreateIncident: (id: string) =>
    request<{ case: ThreatIntelCase; incidentId?: string; created: boolean }>(
      `/api/threat-cases/${id}/create-incident`,
      { method: "POST" },
    ),
};

export type AppSettings = {
  id: string;
  timezone: string;
  dateFormat: string;
  defaultLanding: string;
  sessionHours: number;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpFrom: string;
  smtpConfigured: boolean;
  updatedAt: string;
};

export type RolePermission = {
  id: string;
  role: Role;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canExport: boolean;
  canAdmin: boolean;
};

export type NotificationRule = {
  id: string;
  name: string;
  enabled: boolean;
  eventType: string;
  minSeverity: string;
  channels: string[] | unknown;
  createdAt: string;
  updatedAt: string;
};

export type ChatbotSettings = {
  id: string;
  enabled: boolean;
  provider: string;
  model: string;
  apiBaseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  groundingEnabled: boolean;
  requireCitations: boolean;
  refuseIfNoEvidence: boolean;
  maxEvidenceItems: number;
  toolsEnabled: boolean;
  suggestPlaybooks: boolean;
  activeResponseEnabled: boolean;
  dryRunDefault: boolean;
  maxActionsPerDay: number;
  updatedAt: string;
};

export type Playbook = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  actionType: string;
  command: string;
  riskLevel: string;
  requiresApproval: boolean;
  enabled: boolean;
};

export type ResponseAction = {
  id: string;
  playbookKey: string;
  playbookName: string;
  status: string;
  dryRun: boolean;
  rationale: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  agentId: string | null;
  agentName: string | null;
  incidentId: string | null;
  params: unknown;
  result: unknown;
  errorMessage: string | null;
  createdAt: string;
  executedAt: string | null;
  proposedBy?: { id: string; name: string; email: string };
  reviewedBy?: { id: string; name: string; email: string } | null;
  playbook?: Playbook | null;
};

export type IncidentInvestigation = {
  summary: {
    severity: string;
    status: string;
    agentName: string | null;
    agentId: string | null;
    relatedAlertCount: number;
    relatedVulnCount: number;
    openTicketCount: number;
    pendingActionCount: number;
  };
  relatedAlerts: Array<{ indexId: string; ruleDescription: string; severity: string; timestamp: string }>;
  relatedVulns: Array<{ id: string; cve: string; severity: string }>;
  tickets: Array<{ id: string; title: string; status: string; priority: string }>;
  pendingActions: ResponseAction[];
  suggestedPlaybooks: Array<{
    key: string;
    name: string;
    description: string;
    category: string;
    riskLevel: string;
    actionType: string;
    requiresApproval: boolean;
  }>;
  timeline: Array<{ at: string; kind: string; label: string; detail: string }>;
  sources: Array<{ kind: string; id: string; label: string }>;
};

export type ComplianceFramework = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  disclaimer: string;
  alertCount: number;
  controlCount: number;
  highSeverityCount: number;
  topControls: Array<{ id: string; alertCount: number }>;
};

export type ComplianceControl = {
  id: string;
  alertCount: number;
  highSeverityCount: number;
  agentCount: number;
  latestAlertAt: string;
  latestRule: string;
  latestAgent: string;
};

export type Incident = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  ownerId: string | null;
  createdById: string;
  alertIndexId: string | null;
  alertRuleId: string | null;
  alertRuleDescription: string | null;
  agentName: string | null;
  agentId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  owner?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string };
  noteCount?: number;
  ticketCount?: number;
};

export type IncidentDetail = Incident & {
  notes: Array<{ id: string; body: string; createdAt: string; user: { id: string; name: string } }>;
  activities: Array<{
    id: string;
    action: string;
    detail: string;
    createdAt: string;
    user: { id: string; name: string } | null;
  }>;
  tickets: Array<{ id: string; title: string; status: string; priority: string }>;
};

export type Ticket = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  ownerId: string | null;
  createdById: string;
  dueAt: string | null;
  incidentId: string | null;
  linkedAlertId: string | null;
  linkedVulnId: string | null;
  linkedAgentName: string | null;
  createdAt: string;
  updatedAt: string;
  overdue?: boolean;
  commentCount?: number;
  owner?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string };
  incident?: { id: string; title: string } | null;
};

export type TicketDetail = Ticket & {
  comments: Array<{ id: string; body: string; createdAt: string; user: { id: string; name: string } }>;
};

export type AuditEntry = {
  id: string;
  action: string;
  outcome: string;
  meta: unknown;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};
