import "server-only";

/**
 * Minimal SMTP mailer (optional). Uses nodemailer if it is installed and SMTP
 * env vars are set; otherwise logs and returns false so nothing breaks.
 * Install with `npm i nodemailer` to enable order confirmation emails.
 */
export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return false;
  try {
    const mod: any = await import(/* webpackIgnore: true */ "nodemailer" as string).catch(() => null);
    if (!mod) return false;
    const transporter = mod.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, ...opts });
    return true;
  } catch (e) {
    console.error("[mail] failed", e);
    return false;
  }
}
