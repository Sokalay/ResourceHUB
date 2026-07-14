import { Classification, ResourceStatus } from "@prisma/client";
import { classificationClasses, statusClasses } from "@/lib/constants";
import { humanizeEnum } from "@/lib/resource-metadata";

export function StatusBadge({ value }: { value: ResourceStatus }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClasses[value]}`}>{humanizeEnum(value)}</span>;
}

export function ClassificationBadge({ value }: { value: Classification }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classificationClasses[value]}`}>{humanizeEnum(value)}</span>;
}
