import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { ensurePlaybooks } from "../soar/ensurePlaybooks.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  await ensurePlaybooks();
  const playbooks = await prisma.playbook.findMany({
    where: { enabled: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return res.json({ playbooks });
});

export default router;
