import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { PLATFORM_MODULES, defaultPermissionsForRole } from "../lib/roleModules.js";

const router = Router();

async function ensureRolePermissions() {
  for (const role of [Role.ADMINISTRATOR, Role.SOC_ANALYST]) {
    const defaults = defaultPermissionsForRole(role);
    for (const row of defaults) {
      await prisma.rolePermission.upsert({
        where: { role_module: { role: row.role, module: row.module } },
        create: row,
        update: {},
      });
    }
  }
}

router.get("/", requireAuth, requireRoles("ADMINISTRATOR"), async (_req, res) => {
  await ensureRolePermissions();
  const permissions = await prisma.rolePermission.findMany({
    orderBy: [{ role: "asc" }, { module: "asc" }],
  });
  const assignments = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });
  return res.json({
    modules: PLATFORM_MODULES,
    permissions,
    assignments: assignments.map((a) => ({ role: a.role, count: a._count._all })),
  });
});

const updateSchema = z.object({
  role: z.nativeEnum(Role),
  module: z.string().min(1).max(60),
  canView: z.boolean().optional(),
  canCreate: z.boolean().optional(),
  canUpdate: z.boolean().optional(),
  canExport: z.boolean().optional(),
  canAdmin: z.boolean().optional(),
});

router.put("/", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid permission payload" });
  await ensureRolePermissions();
  const { role, module, ...flags } = parsed.data;
  const permission = await prisma.rolePermission.update({
    where: { role_module: { role, module } },
    data: flags,
  });
  await writeAudit({
    userId: req.user!.id,
    action: "roles.permission.update",
    outcome: "success",
    meta: { role, module, flags },
  });
  return res.json({ permission });
});

router.post("/reset", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  await prisma.rolePermission.deleteMany({});
  await ensureRolePermissions();
  await writeAudit({
    userId: req.user!.id,
    action: "roles.permission.reset",
    outcome: "success",
  });
  const permissions = await prisma.rolePermission.findMany({
    orderBy: [{ role: "asc" }, { module: "asc" }],
  });
  return res.json({ permissions });
});

export default router;
