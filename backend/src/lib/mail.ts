import { prisma } from "./prisma.js";

/** Stub mailer: logs when SMTP disabled; ready for real transport later. */
export async function sendMail(input: { to: string; subject: string; body: string }) {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  if (!settings.smtpEnabled || !settings.smtpHost) {
    console.info("[mail:stub]", {
      to: input.to,
      subject: input.subject,
      from: settings.smtpFrom,
      preview: input.body.slice(0, 240),
    });
    return { delivered: false, mode: "stub" as const };
  }

  // Real SMTP transport can be wired here without changing callers.
  console.info("[mail:queued]", { to: input.to, subject: input.subject, host: settings.smtpHost });
  return { delivered: true, mode: "smtp" as const };
}
