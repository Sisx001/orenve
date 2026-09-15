import { csrfToken } from "@/lib/admin/csrf";
import { CsrfInput } from "./Csrf";

/**
 * Hidden double-submit CSRF input for server-rendered studio forms.
 *
 * Next 15 forbids writing cookies during render, so this reads the cookie and
 * hands it to the client `<CsrfInput/>`, which mints one via GET /api/csrf when
 * it is missing.
 */
export async function CsrfField() {
  const token = await csrfToken();
  return <CsrfInput value={token} />;
}

export default CsrfField;
