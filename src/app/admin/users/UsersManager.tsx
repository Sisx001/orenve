"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, LogOut, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { FormBanner, SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { createUserAction, deleteUserAction, resetUserPasswordAction, revokeUserSessionsAction, updateUserAction } from "@/lib/admin/actions/users";
import { idleState } from "@/lib/admin/action-state";
import { ROLES } from "@/lib/constants";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  sessions: number;
  isSelf: boolean;
};

const ROLE_HINTS: Record<string, string> = {
  owner: "Everything, including users, backups and settings.",
  admin: "Everything except managing users and backups.",
  editor: "Products, content and media. No orders or settings.",
  support: "Orders and customers. No catalogue or settings.",
};

export function UsersManager({ rows, csrf }: { rows: UserRow[]; csrf: string }) {
  const [createState, createAction] = useActionState(createUserAction, idleState);
  const [updateState, updateAction] = useActionState(updateUserAction, idleState);
  const [resetState, resetAction] = useActionState(resetUserPasswordAction, idleState);
  const [revokeState, revokeAction] = useActionState(revokeUserSessionsAction, idleState);
  const [delState, delAction] = useActionState(deleteUserAction, idleState);

  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    for (const s of [createState, updateState, resetState, revokeState, delState]) {
      if (s.error) toast.error(s.error);
      else if (s.ok && s.message) toast.success(s.message);
    }
    if (createState.ok) setNewOpen(false);
    if (updateState.ok) setEditing(null);
  }, [createState, updateState, resetState, revokeState, delState]);

  useEffect(() => {
    const data = createState.data ?? resetState.data;
    if (data?.password && data.email) setCredential({ email: data.email, password: data.password });
  }, [createState.data, resetState.data]);

  const owners = rows.filter((u) => u.role === "owner" && u.isActive).length;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setNewOpen(true)} className="btn px-4 py-2.5 text-[0.65rem]">
          <Plus className="h-3.5 w-3.5" />
          Add user
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((u) => {
          const lastOwner = u.role === "owner" && owners <= 1;
          return (
            <li key={u.id} className="card flex flex-wrap items-center gap-3 p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-ink text-sm font-semibold text-paper">{u.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{u.name}</p>
                  <Badge tone={u.role === "owner" ? "accent" : u.role === "admin" ? "brass" : "neutral"}>{u.role}</Badge>
                  {!u.isActive && <Badge tone="danger">Deactivated</Badge>}
                  {u.totpEnabled && (
                    <Badge tone="success">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      2FA
                    </Badge>
                  )}
                  {u.isSelf && <span className="text-[0.58rem] uppercase tracking-[0.14em] text-muted">you</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {u.email} · {u.lastLoginAt ? `last signed in ${u.lastLoginAt}` : "never signed in"} · {u.sessions} active session{u.sessions === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`} className="p-1.5 text-muted hover:text-ink">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <form action={resetAction}>
                  <CsrfInput value={csrf} />
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    aria-label="Reset password"
                    title="Reset password"
                    onClick={(e) => {
                      if (!window.confirm(`Reset the password for ${u.name}? Their sessions and 2FA will be cleared.`)) e.preventDefault();
                    }}
                    className="p-1.5 text-muted hover:text-ink"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                </form>
                <form action={revokeAction}>
                  <CsrfInput value={csrf} />
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    aria-label="Revoke sessions"
                    title="Sign this user out everywhere"
                    disabled={u.sessions === 0}
                    className="p-1.5 text-muted disabled:opacity-30 hover:text-ink"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </form>
                <form action={delAction}>
                  <CsrfInput value={csrf} />
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    aria-label="Delete user"
                    disabled={u.isSelf || lastOwner}
                    title={u.isSelf ? "You cannot delete yourself" : lastOwner ? "The last owner cannot be deleted" : "Delete user"}
                    onClick={(e) => {
                      if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) e.preventDefault();
                    }}
                    className="p-1.5 text-muted disabled:opacity-30 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      {/* new user */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Add a studio user" description="They sign in at /admin with the email and password you set here.">
        <form action={createAction} className="space-y-4">
          <CsrfInput value={csrf} />
          <FormBanner state={createState} />
          <TextField name="name" label="Name" required error={createState.fieldErrors?.name} />
          <TextField name="email" type="email" label="Email" required error={createState.fieldErrors?.email} />
          <SelectField name="role" label="Role" defaultValue="editor" options={ROLES.map((r) => ({ value: r, label: r }))} />
          <div className="border border-line bg-bone/50 p-3">
            <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">What each role can do</p>
            <ul className="space-y-0.5 text-xs text-muted">
              {ROLES.map((r) => (
                <li key={r}>
                  <span className="font-medium text-ink">{r}</span> — {ROLE_HINTS[r]}
                </li>
              ))}
            </ul>
          </div>
          <TextField
            name="password"
            type="text"
            label="Temporary password"
            placeholder="Leave empty to generate one"
            hint="Shown once after you save — copy it before closing."
            error={createState.fieldErrors?.password}
            inputClassName="font-mono text-xs"
          />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setNewOpen(false)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
              Cancel
            </button>
            <SubmitButton size="sm" pendingLabel="Creating…">
              Create user
            </SubmitButton>
          </div>
        </form>
      </Modal>

      {/* edit user */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""}>
        {editing && (
          <form action={updateAction} className="space-y-4" key={editing.id}>
            <CsrfInput value={csrf} />
            <input type="hidden" name="id" value={editing.id} />
            <FormBanner state={updateState} />
            <TextField name="name" label="Name" defaultValue={editing.name} required />
            <SelectField name="role" label="Role" defaultValue={editing.role} options={ROLES.map((r) => ({ value: r, label: `${r} — ${ROLE_HINTS[r]}` }))} />
            <ToggleRow
              name="isActive"
              label="Active"
              hint={editing.isSelf ? "You cannot deactivate your own account." : "Deactivating signs them out immediately."}
              defaultChecked={editing.isActive}
              disabled={editing.isSelf}
            />
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button type="button" onClick={() => setEditing(null)} className="btn-outline px-4 py-2.5 text-[0.65rem]">
                Cancel
              </button>
              <SubmitButton size="sm" pendingLabel="Saving…">
                Save user
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>

      {/* one-time credential */}
      <Modal open={!!credential} onClose={() => setCredential(null)} title="Share this password once" description="It is not stored in readable form — if you lose it, reset the password again.">
        {credential && (
          <div className="space-y-4">
            <div className="border border-line bg-bone/60 p-3">
              <p className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">Email</p>
              <p className="font-mono text-sm">{credential.email}</p>
              <p className="mt-3 text-[0.6rem] uppercase tracking-[0.14em] text-muted">Temporary password</p>
              <p className="break-all font-mono text-sm">{credential.password}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${credential.email}\n${credential.password}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
                className="btn-outline px-4 py-2.5 text-[0.65rem]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={() => setCredential(null)} className="btn px-4 py-2.5 text-[0.65rem]">
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default UsersManager;
