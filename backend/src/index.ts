import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./lib/config.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import alertsRoutes from "./routes/alerts.js";
import dashboardRoutes from "./routes/dashboard.js";
import vulnerabilitiesRoutes from "./routes/vulnerabilities.js";
import agentsRoutes from "./routes/agents.js";
import huntingRoutes from "./routes/hunting.js";
import fimRoutes from "./routes/fim.js";
import scaRoutes from "./routes/sca.js";
import malwareRoutes from "./routes/malware.js";
import mitreRoutes from "./routes/mitre.js";
import incidentsRoutes from "./routes/incidents.js";
import ticketsRoutes from "./routes/tickets.js";
import auditRoutes from "./routes/audit.js";
import notificationsRoutes from "./routes/notifications.js";
import opsSummaryRoutes from "./routes/opsSummary.js";
import complianceRoutes from "./routes/compliance.js";
import reportsRoutes from "./routes/reports.js";
import chatbotSettingsRoutes from "./routes/chatbotSettings.js";
import chatRoutes from "./routes/chat.js";
import playbooksRoutes from "./routes/playbooks.js";
import responseActionsRoutes from "./routes/responseActions.js";
import appSettingsRoutes from "./routes/appSettings.js";
import rolesRoutes from "./routes/roles.js";
import notificationRulesRoutes from "./routes/notificationRules.js";
import openctiRoutes from "./routes/opencti.js";
import threatCasesRoutes from "./routes/threatCases.js";
import { requireAuth } from "./middleware/auth.js";
import { ensureChatbotSettings } from "./ai/settingsService.js";
import { ensurePlaybooks } from "./soar/ensurePlaybooks.js";
import { prisma } from "./lib/prisma.js";
import { defaultPermissionsForRole } from "./lib/roleModules.js";
import { Role } from "@prisma/client";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "aegis-backend",
    phase: 8,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/vulnerabilities", vulnerabilitiesRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/hunting", huntingRoutes);
app.use("/api/fim", fimRoutes);
app.use("/api/sca", scaRoutes);
app.use("/api/malware", malwareRoutes);
app.use("/api/mitre", mitreRoutes);
app.use("/api/incidents", incidentsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/ops", opsSummaryRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings/chatbot", chatbotSettingsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/playbooks", playbooksRoutes);
app.use("/api/response-actions", responseActionsRoutes);
app.use("/api/settings/app", appSettingsRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/notification-rules", notificationRulesRoutes);
app.use("/api/opencti", openctiRoutes);
app.use("/api/threat-cases", threatCasesRoutes);

app.get("/api/session/ping", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

async function ensureAppBootstrap() {
  await ensureChatbotSettings();
  await ensurePlaybooks();
  await prisma.appSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  for (const role of [Role.ADMINISTRATOR, Role.SOC_ANALYST]) {
    for (const row of defaultPermissionsForRole(role)) {
      await prisma.rolePermission.upsert({
        where: { role_module: { role: row.role, module: row.module } },
        create: row,
        update: {},
      });
    }
  }
}

ensureAppBootstrap()
  .then(() => {
    app.listen(config.port, config.host, () => {
      console.log(`Aegis API listening on http://${config.host}:${config.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize application services", err);
    process.exit(1);
  });
