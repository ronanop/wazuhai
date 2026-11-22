import { prisma } from "./prisma.js";

export async function notifyUser(input: {
  userId: string;
  title: string;
  body?: string;
  type?: string;
  href?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body ?? "",
      type: input.type ?? "info",
      href: input.href,
    },
  });
}
