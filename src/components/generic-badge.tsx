import { neutralBadgeClass } from "@/lib/constants";
import { humanizeEnum } from "@/lib/resource-metadata";

export function GenericBadge({ value, className = neutralBadgeClass, humanize = true }: { value?: string | null; className?: string; humanize?: boolean }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{humanize ? humanizeEnum(value) : value || "-"}</span>;
}
