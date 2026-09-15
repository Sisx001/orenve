"use client";

import { useEffect, useState } from "react";
import { ensureCsrf } from "@/lib/api";

/**
 * Hidden double-submit CSRF field for every studio form.
 *
 * The server can only read the cookie while rendering (Next 15 forbids writing
 * cookies outside actions and route handlers), so this component syncs to the
 * real cookie on mount — minting one via GET /api/csrf when it is absent.
 */
export function CsrfInput({ value }: { value?: string }) {
  const [token, setToken] = useState(value ?? "");

  useEffect(() => {
    let cancelled = false;
    void ensureCsrf().then((t) => {
      if (!cancelled && t) setToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <input type="hidden" name="_csrf" value={token} />;
}

/** Same guarantee for components that need the raw token (XHR uploads). */
export function useCsrf(initial?: string): string {
  const [token, setToken] = useState(initial ?? "");
  useEffect(() => {
    let cancelled = false;
    void ensureCsrf().then((t) => {
      if (!cancelled && t) setToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return token;
}

export default CsrfInput;
