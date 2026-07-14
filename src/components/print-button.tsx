"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()} type="button">
      <Printer size={16} /> {label}
    </button>
  );
}
