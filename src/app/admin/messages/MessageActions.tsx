"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Archive, Check, Trash2, Undo2 } from "lucide-react";
import { deleteSubscriberAction, messageStatusAction } from "@/lib/admin/actions/content";
import { idleState } from "@/lib/admin/action-state";

export function MessageActions({ id, csrf, status }: { id: string; csrf: string; status: string }) {
  const [state, action] = useActionState(messageStatusAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="flex shrink-0 items-center gap-1">
      <CsrfInput value={csrf} />
      <input type="hidden" name="messageId" value={id} />
      {status !== "replied" && (
        <button type="submit" name="status" value="replied" aria-label="Mark replied" title="Mark replied" className="p-1.5 text-muted hover:text-success">
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
      {status !== "archived" ? (
        <button type="submit" name="status" value="archived" aria-label="Archive" title="Archive" className="p-1.5 text-muted hover:text-ink">
          <Archive className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button type="submit" name="status" value="new" aria-label="Move back to new" title="Move back to new" className="p-1.5 text-muted hover:text-ink">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="submit"
        name="status"
        value="delete"
        aria-label="Delete message"
        onClick={(e) => {
          if (!window.confirm("Delete this message?")) e.preventDefault();
        }}
        className="p-1.5 text-muted hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export function SubscriberDelete({ id, csrf }: { id: string; csrf: string }) {
  const [state, action] = useActionState(deleteSubscriberAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  return (
    <form action={action}>
      <CsrfInput value={csrf} />
      <input type="hidden" name="subscriberId" value={id} />
      <button
        type="submit"
        aria-label="Remove subscriber"
        onClick={(e) => {
          if (!window.confirm("Remove this subscriber?")) e.preventDefault();
        }}
        className="p-1 text-muted hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
