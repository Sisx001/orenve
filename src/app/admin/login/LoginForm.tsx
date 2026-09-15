"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { loginAction, loginTotpAction } from "@/lib/admin/actions/auth";
import { FormBanner, SubmitButton, TextField } from "@/components/admin/Fields";
import { idleState } from "@/lib/admin/action-state";

export function LoginForm({ csrf, next }: { csrf: string; next: string }) {
  const [state, action] = useActionState(loginAction, idleState);
  const [totpState, totpAction] = useActionState(loginTotpAction, idleState);
  const [step, setStep] = useState<"password" | "totp">("password");

  useEffect(() => {
    if (state.data?.step === "totp") setStep("totp");
  }, [state.data?.step]);

  if (step === "totp") {
    return (
      <form action={totpAction} className="space-y-4">
        <CsrfInput value={csrf} />
        <input type="hidden" name="next" value={state.data?.next ?? next} />
        <div className="flex items-center gap-2 border border-line bg-bone/60 px-3 py-2.5 text-xs text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-oxide" />
          Enter the 6-digit code from your authenticator app.
        </div>
        <FormBanner state={totpState} />
        <TextField
          name="code"
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          placeholder="000000"
          required
          autoFocus
          inputClassName="text-center font-mono text-lg tracking-[0.4em]"
        />
        <SubmitButton className="w-full" pendingLabel="Verifying…">
          Verify and sign in
        </SubmitButton>
        <button type="button" onClick={() => setStep("password")} className="btn-ghost w-full justify-center text-[0.65rem] text-muted">
          Use a different account
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <CsrfInput value={csrf} />
      <input type="hidden" name="next" value={next} />
      <FormBanner state={state} />
      <TextField name="email" type="email" label="Email" autoComplete="username" required autoFocus placeholder="owner@orynve.com" />
      <TextField name="password" type="password" label="Password" autoComplete="current-password" required placeholder="••••••••••••" />
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export default LoginForm;
