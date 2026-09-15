"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Monitor, Save, ShieldCheck, ShieldOff } from "lucide-react";
import { FormBanner, SelectField, SubmitButton, TextField } from "@/components/admin/Fields";
import {
  beginTotpAction,
  cancelTotpSetupAction,
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  revokeSessionAction,
  updateProfileAction,
} from "@/lib/admin/actions/auth";
import { idleState } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils";

/**
 * Mirror of `passwordStrength()` in src/lib/auth/password.ts. That module pulls
 * in node:crypto, so it cannot be imported into a client bundle — the rules are
 * duplicated here purely to give live feedback while typing.
 */
function strengthOf(pw: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (pw.length < 12) issues.push("min_length");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) issues.push("mixed_case");
  if (!/\d/.test(pw)) issues.push("number");
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("symbol");
  return { score: Math.max(0, 4 - issues.length), issues };
}

export function ProfileDetails({ csrf, name, email, role, locale }: { csrf: string; name: string; email: string; role: string; locale: string }) {
  const [state, action] = useActionState(updateProfileAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <CsrfInput value={csrf} />
      <FormBanner state={state} />
      <TextField name="name" label="Name" defaultValue={name} required error={state.fieldErrors?.name} />
      <TextField label="Email" defaultValue={email} readOnly disabled hint="Ask an owner to change your sign-in email." />
      <TextField label="Role" defaultValue={role} readOnly disabled />
      <SelectField name="locale" label="Studio language preference" defaultValue={locale} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
      <SubmitButton size="sm" pendingLabel="Saving…">
        <Save className="h-3.5 w-3.5" />
        Save profile
      </SubmitButton>
    </form>
  );
}

export function ChangePassword({ csrf }: { csrf: string }) {
  const [state, action] = useActionState(changePasswordAction, idleState);
  const [next, setNext] = useState("");
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) {
      toast.success(state.message);
      setNext("");
    }
  }, [state]);

  const { score, issues } = strengthOf(next);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const hints: Record<string, string> = {
    min_length: "at least 12 characters",
    mixed_case: "upper and lower case",
    number: "a number",
    symbol: "a symbol",
  };

  return (
    <form action={action} className="space-y-4">
      <CsrfInput value={csrf} />
      <FormBanner state={state} />
      <TextField name="current" type="password" label="Current password" autoComplete="current-password" required error={state.fieldErrors?.current} />
      <div>
        <TextField
          name="next"
          type="password"
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          error={state.fieldErrors?.next}
        />
        {next.length > 0 && (
          <div className="mt-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1 flex-1", i < score ? (score >= 3 ? "bg-success" : "bg-warning") : "bg-line")} />
              ))}
            </div>
            <p className={cn("mt-1 text-xs", score >= 3 ? "text-success" : "text-muted")}>
              {labels[score]}
              {issues.length > 0 && ` — add ${issues.map((i) => hints[i] ?? i).join(", ")}`}
            </p>
          </div>
        )}
      </div>
      <TextField name="confirm" type="password" label="Repeat new password" autoComplete="new-password" required error={state.fieldErrors?.confirm} />
      <SubmitButton size="sm" pendingLabel="Saving…">
        <KeyRound className="h-3.5 w-3.5" />
        Change password
      </SubmitButton>
    </form>
  );
}

export function TwoFactor({
  csrf,
  enabled,
  pending,
  qr,
  secret,
}: {
  csrf: string;
  enabled: boolean;
  /** a secret exists but has not been confirmed with a code yet */
  pending: boolean;
  qr: string | null;
  secret: string | null;
}) {
  const [beginState, beginAction] = useActionState(beginTotpAction, idleState);
  const [confirmState, confirmAction] = useActionState(confirmTotpAction, idleState);
  const [disableState, disableAction] = useActionState(disableTotpAction, idleState);
  const [cancelState, cancelAction] = useActionState(cancelTotpSetupAction, idleState);

  useEffect(() => {
    for (const s of [beginState, confirmState, disableState, cancelState]) {
      if (s.error) toast.error(s.error);
      else if (s.ok && s.message) toast.success(s.message);
    }
  }, [beginState, confirmState, disableState, cancelState]);

  if (enabled) {
    return (
      <div>
        <p className="mb-4 inline-flex items-center gap-2 border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          <ShieldCheck className="h-4 w-4" />
          Two-factor authentication is on.
        </p>
        <form action={disableAction} className="space-y-3">
          <CsrfInput value={csrf} />
          <TextField
            name="code"
            label="Enter a current code to turn it off"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            required
            inputClassName="max-w-[10rem] text-center font-mono tracking-[0.3em]"
          />
          <SubmitButton size="sm" variant="outline" className="border-danger text-danger hover:bg-danger hover:text-paper" pendingLabel="Working…">
            <ShieldOff className="h-3.5 w-3.5" />
            Turn off 2FA
          </SubmitButton>
        </form>
      </div>
    );
  }

  if (pending && qr && secret) {
    return (
      <div className="space-y-4">
        <p className="text-sm">Scan this with Google Authenticator, Authy, 1Password or any TOTP app, then enter the 6-digit code it shows.</p>
        <div className="flex flex-wrap items-start gap-5">
          <div className="border border-line bg-paper p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Two-factor QR code" width={200} height={200} />
          </div>
          <div className="min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">Or type this secret</p>
            <p className="mt-1 break-all border border-line bg-bone px-2.5 py-2 font-mono text-sm">{secret}</p>
            <p className="mt-2 text-xs text-muted">Keep it private. Anyone with this secret can generate your codes.</p>
          </div>
        </div>
        <form action={confirmAction} className="space-y-3">
          <CsrfInput value={csrf} />
          <TextField
            name="code"
            label="Verification code"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
            inputClassName="max-w-[10rem] text-center font-mono tracking-[0.3em]"
          />
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingLabel="Verifying…">
              <ShieldCheck className="h-3.5 w-3.5" />
              Confirm and enable
            </SubmitButton>
            <button type="submit" formAction={cancelAction} className="btn-ghost text-[0.65rem] text-muted">
              Cancel setup
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form action={beginAction}>
      <CsrfInput value={csrf} />
      <p className="mb-4 text-sm text-muted">
        Add a second step at sign-in using a code from your phone. Strongly recommended for the owner account — the studio can move money and change prices.
      </p>
      <SubmitButton size="sm" pendingLabel="Generating…">
        <ShieldCheck className="h-3.5 w-3.5" />
        Set up two-factor authentication
      </SubmitButton>
    </form>
  );
}

export type SessionRow = { id: string; ip: string; userAgent: string; createdAt: string; expiresAt: string; current: boolean };

export function SessionList({ csrf, sessions }: { csrf: string; sessions: SessionRow[] }) {
  const [state, action] = useActionState(revokeSessionAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <div>
      <ul className="divide-y divide-line/70">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
            <div className="flex min-w-0 gap-2.5">
              <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="text-sm">
                  {s.ip}
                  {s.current && <span className="ml-2 border border-oxide/40 bg-oxide/10 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.14em] text-oxide">This device</span>}
                </p>
                <p className="mt-0.5 break-words text-xs text-muted">{s.userAgent || "Unknown device"}</p>
                <p className="text-xs text-muted">
                  Signed in {s.createdAt} · expires {s.expiresAt}
                </p>
              </div>
            </div>
            {!s.current && (
              <form action={action}>
                <CsrfInput value={csrf} />
                <input type="hidden" name="sessionId" value={s.id} />
                <SubmitButton size="sm" variant="ghost" className="text-[0.62rem] text-danger">
                  Revoke
                </SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
      <form action={action} className="mt-4 border-t border-line pt-4">
        <CsrfInput value={csrf} />
        <input type="hidden" name="sessionId" value="all" />
        <button
          type="submit"
          onClick={(e) => {
            if (!window.confirm("Sign out everywhere, including this device?")) e.preventDefault();
          }}
          className="btn-outline px-4 py-2.5 text-[0.65rem]"
        >
          Sign out of every device
        </button>
      </form>
    </div>
  );
}
