"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Check, EyeOff, Trash2 } from "lucide-react";
import { reviewDecisionAction } from "@/lib/admin/actions/content";
import { idleState } from "@/lib/admin/action-state";

export function ReviewActions({ id, csrf, isApproved }: { id: string; csrf: string; isApproved: boolean }) {
  const [state, action] = useActionState(reviewDecisionAction, idleState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="flex shrink-0 items-center gap-1.5">
      <CsrfInput value={csrf} />
      <input type="hidden" name="reviewId" value={id} />
      {isApproved ? (
        <button type="submit" name="decision" value="unapprove" className="btn-outline px-3 py-2 text-[0.62rem]">
          <EyeOff className="h-3 w-3" />
          Hide
        </button>
      ) : (
        <button type="submit" name="decision" value="approve" className="btn px-3 py-2 text-[0.62rem]">
          <Check className="h-3 w-3" />
          Approve
        </button>
      )}
      <button
        type="submit"
        name="decision"
        value="delete"
        aria-label="Delete review"
        onClick={(e) => {
          if (!window.confirm("Delete this review permanently?")) e.preventDefault();
        }}
        className="p-2 text-muted hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export default ReviewActions;
