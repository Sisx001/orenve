import type { ReactNode } from "react";
import { Lock } from "lucide-react";

/**
 * LockedNotice — rendered by pages/areas that require a permission the current
 * user's role does not have.  Exported here for future workstreams; pages may
 * render this instead of silently redirecting.
 *
 * Usage:
 *   <LockedNotice permission="settings.write" />
 *   <LockedNotice permission="backup.run">
 *     <p>Contact your administrator for access.</p>
 *   </LockedNotice>
 */
export function LockedNotice({ permission, children }: { permission: string; children?: ReactNode }) {
  return (
    <div className="card mx-auto max-w-lg px-8 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-line">
        <Lock className="h-5 w-5 text-muted" />
      </div>
      <h2 className="display text-xl">This area is locked for your role</h2>
      <p className="mt-2 text-sm text-muted">
        You need the{" "}
        <code className="rounded bg-bone px-1.5 py-0.5 font-mono text-xs">{permission}</code> permission
        to access this area.
      </p>
      <p className="mt-1 text-sm text-muted">Ask the owner to grant you access.</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default LockedNotice;
