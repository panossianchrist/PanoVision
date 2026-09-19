import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { ServiceError } from "./errors";

export type AccountMail = { to: string; subject: string; text: string };
const configSchema = z.object({
  host: z
    .string()
    .regex(/^[a-zA-Z0-9.-]+$/)
    .max(253),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().min(1).max(254),
  password: z.string().min(1),
  from: z.email().max(254),
});
function mailConfig() {
  return configSchema.safeParse({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 465,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  });
}
export function accountMailConfigured() {
  return mailConfig().success;
}
export async function sendAccountMail(message: AccountMail) {
  const config = mailConfig();
  if (!config.success) throw new ServiceError("EMAIL_NOT_CONFIGURED", 503);
  const { host, port, user, password, from } = config.data;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user, pass: password },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    dnsTimeout: 8000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "PanoVision", address: from },
      to: message.to,
      subject: message.subject,
      text: message.text,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (!result.accepted?.length || result.rejected?.length)
      throw new Error("Delivery rejected");
  } catch {
    throw new ServiceError("EMAIL_DELIVERY_FAILED", 503);
  } finally {
    transport.close();
  }
}
