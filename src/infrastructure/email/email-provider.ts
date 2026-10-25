import "server-only";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Development provider: writes the message to the server log instead of sending it. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage): Promise<void> {
    if (getEnv().NODE_ENV === "production") {
      logger.warn("email.console_provider_in_production", { to: message.to, subject: message.subject });
      return;
    }
    // Local development only: the body may contain one-time links, printed so a developer can use them.
    console.log(`\n--- email to ${message.to} ---\nSubject: ${message.subject}\n\n${message.text}\n--- end email ---\n`);
  }
}

/** Resend HTTP API (https://resend.com). Any provider can be added behind EmailProvider. */
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!res.ok) {
      throw new Error(`Email provider responded with ${res.status}`);
    }
  }
}

let override: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (override) return override;
  const env = getEnv();
  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.EMAIL_PROVIDER_API_KEY) throw new Error("EMAIL_PROVIDER_API_KEY is required for the resend provider");
    return new ResendEmailProvider(env.EMAIL_PROVIDER_API_KEY, env.EMAIL_FROM);
  }
  return new ConsoleEmailProvider();
}

/** Tests replace the provider with an in-memory fake. */
export function setEmailProviderForTests(provider: EmailProvider | undefined): void {
  override = provider;
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal consistent layout for transactional emails. */
export function renderEmail(opts: { heading: string; body: string; actionUrl?: string; actionLabel?: string }): { text: string; html: string } {
  const text = [opts.heading, "", opts.body, opts.actionUrl ? `\n${opts.actionLabel ?? "Open"}: ${opts.actionUrl}` : ""].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px">
<h2 style="margin:0 0 12px">${escapeHtml(opts.heading)}</h2>
<p style="white-space:pre-line;line-height:1.5">${escapeHtml(opts.body)}</p>
${opts.actionUrl ? `<p><a href="${escapeHtml(opts.actionUrl)}" style="display:inline-block;padding:10px 16px;background:#025f6b;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(opts.actionLabel ?? "Open")}</a></p>` : ""}
</div>`;
  return { text, html };
}
