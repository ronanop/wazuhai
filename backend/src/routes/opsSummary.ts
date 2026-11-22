import { Router } from "express";
import { IncidentStatus, TicketStatus } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/summary", requireAuth, async (req, res) => {
  const openIncidents = await prisma.incident.count({
    where: {
      status: {
        in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING, IncidentStatus.CONTAINED],
      },
    },
  });

  const openTickets = await prisma.ticket.count({
    where: {
      status: {
        in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.BLOCKED],
      },
    },
  });

  const overdueTickets = await prisma.ticket.count({
    where: {
      dueAt: { lt: new Date() },
      status: {
        in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.BLOCKED],
      },
    },
  });

  const unreadNotifications = await prisma.notification.count({
    where: { userId: req.user!.id, readAt: null },
  });

  return res.json({
    openIncidents,
    openTickets,
    overdueTickets,
    unreadNotifications,
  });
});

export default router;
