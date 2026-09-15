"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) setTimeout(() => window.print(), 400);
  }, [auto]);
  return (
    <button type="button" onClick={() => window.print()} className="btn px-4 py-2.5 text-[0.65rem]">
      <Printer className="h-3.5 w-3.5" />
      Print
    </button>
  );
}

export default PrintButton;
