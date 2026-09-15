"use client";

import { CsrfInput } from "@/components/admin/Csrf";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { deletePageAction, togglePageAction } from "@/lib/admin/actions/content";
import { idleState } from "@/lib/admin/action-state";

export function PageRowActions({ id, csrf, isPublished }: { id: string; csrf: string; isPublished: boolean }) {
  const [toggleState, toggleAction] = useActionState(togglePageAction, idleState);
  const [delState, delAction] = useActionState(deletePageAction, idleState);

  useEffect(() => {
    for (const s of [toggleState, delState]) {
      if (s.error) toast.error(s.error);
      else if (s.ok && s.message) toast.success(s.message);
    }
  }, [toggleState, delState]);

  return (
    <div className="flex items-center gap-1">
      <form action={toggleAction}>
        <CsrfInput value={csrf} />
        <input type="hidden" name="pageId" value={id} />
        <button type="submit" aria-label={isPublished ? "Unpublish" : "Publish"} title={isPublished ? "Unpublish" : "Publish"} className="p-1.5 text-muted hover:text-ink">
          {isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </form>
      <form action={delAction}>
        <CsrfInput value={csrf} />
        <input type="hidden" name="pageId" value={id} />
        <button
          type="submit"
          aria-label="Delete page"
          onClick={(e) => {
            if (!window.confirm("Delete this page?")) e.preventDefault();
          }}
          className="p-1.5 text-muted hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

export default PageRowActions;
