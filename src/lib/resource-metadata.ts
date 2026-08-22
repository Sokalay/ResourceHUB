import { Resource, ResourceFile, ResourceStatus, ResourceTag, ResourceVersion, TransferJob } from "@prisma/client";

export type StorageStatus =
  | "HAS_OFFICIAL_COPY"
  | "NO_OFFICIAL_COPY"
  | "LOCAL_ONLY"
  | "EXTERNAL_ONLY"
  | "BOTH_EXTERNAL_AND_OFFICIAL";

export type ResourceWithStorageParts = Resource & {
  files?: Pick<ResourceFile, "id">[];
  tags?: Pick<ResourceTag, "name">[];
  versions?: Pick<ResourceVersion, "fileCount">[];
  transferJobs?: Pick<TransferJob, "status">[];
  _count?: { files?: number };
};

export type WorkflowState =
  | "ARCHIVED"
  | "FAILED"
  | "PUBLIC_APPROVAL_PENDING"
  | "VISITOR_APPROVAL_PENDING"
  | "STORAGE_APPROVAL_PENDING"
  | "EXTERNAL_ACCESS_REVIEW"
  | "OFFICIALLY_STORED"
  | "SUBMITTED";

export function getFileCount(resource: ResourceWithStorageParts) {
  if (typeof resource._count?.files === "number") return resource._count.files;
  if (resource.files) return resource.files.length;
  return resource.versions?.reduce((total, version) => total + version.fileCount, 0) ?? 0;
}

export function getStorageStatus(resource: ResourceWithStorageParts): StorageStatus {
  const hasOfficial = Boolean(resource.officialStorageLocation);
  const hasExternal = Boolean(resource.sourceUrl || resource.currentWorkingLocation);
  if (hasExternal && hasOfficial) return "BOTH_EXTERNAL_AND_OFFICIAL";
  if (resource.storageProvider === "LOCAL" && hasOfficial && !hasExternal) return "LOCAL_ONLY";
  if (hasExternal && !hasOfficial) return "EXTERNAL_ONLY";
  if (hasOfficial) return "HAS_OFFICIAL_COPY";
  return "NO_OFFICIAL_COPY";
}

export function normalizeTags(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(",")
        .map((tag) => tag.trim());
  return Array.from(
    new Set(
      raw
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function sourceReadinessMessage(provider: string) {
  if (provider === "GITHUB") return "GitHub source registered. Automatic transfer is not enabled yet.";
  if (provider === "HUGGINGFACE") return "Hugging Face source registered. Automatic transfer is not enabled yet.";
  if (provider === "GOOGLE_DRIVE") return "Google Drive source registered. Automatic transfer requires OAuth or service account setup.";
  if (provider === "DIRECT_UPLOAD") return "This resource was uploaded directly into Resource Hub.";
  return "External source metadata is registered. Automatic transfer is not enabled yet.";
}

export function getWorkflowState(resource: ResourceWithStorageParts): WorkflowState {
  if (resource.status === ResourceStatus.ARCHIVED) return "ARCHIVED";
  if (resource.status === ResourceStatus.FAILED) return "FAILED";
  if (resource.pendingVisibility === "PUBLIC") return "PUBLIC_APPROVAL_PENDING";
  if (resource.pendingVisibility === "VISITOR") return "VISITOR_APPROVAL_PENDING";
  if (resource.officialStorageLocation) return "OFFICIALLY_STORED";
  if (resource.stagingStorageLocation || getFileCount(resource) > 0) return "STORAGE_APPROVAL_PENDING";
  if ((resource.sourceUrl || resource.currentWorkingLocation) && !resource.sourceAccessGranted) return "EXTERNAL_ACCESS_REVIEW";
  if (resource.sourceUrl || resource.currentWorkingLocation) return "STORAGE_APPROVAL_PENDING";
  return "SUBMITTED";
}

export function workflowStateLabel(value: WorkflowState) {
  const labels: Record<WorkflowState, string> = {
    ARCHIVED: "Archived",
    FAILED: "Failed",
    PUBLIC_APPROVAL_PENDING: "Public approval pending",
    VISITOR_APPROVAL_PENDING: "Visitor approval pending",
    STORAGE_APPROVAL_PENDING: "Review pending",
    EXTERNAL_ACCESS_REVIEW: "Access review needed",
    OFFICIALLY_STORED: "Current",
    SUBMITTED: "Submitted"
  };
  return labels[value];
}

export function workflowStateClass(value: WorkflowState) {
  if (value === "OFFICIALLY_STORED") return "bg-green-50 text-green-700 border-green-200";
  if (value === "PUBLIC_APPROVAL_PENDING" || value === "VISITOR_APPROVAL_PENDING") return "bg-blue-50 text-blue-700 border-blue-200";
  if (value === "STORAGE_APPROVAL_PENDING" || value === "EXTERNAL_ACCESS_REVIEW" || value === "SUBMITTED") return "bg-amber-50 text-amber-800 border-amber-200";
  if (value === "FAILED") return "bg-red-50 text-red-700 border-red-200";
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

export function approvalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    RESOURCE_STORAGE: "Document review",
    VISIBILITY_PUBLIC: "Public visibility",
    VISIBILITY_VISITOR: "Visitor visibility"
  };
  return labels[value] ?? humanizeEnum(value);
}

export function humanizeEnum(value?: string | null) {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function storageStatusLabel(value: StorageStatus) {
  const labels: Record<StorageStatus, string> = {
    HAS_OFFICIAL_COPY: "Current version",
    NO_OFFICIAL_COPY: "No Current version",
    LOCAL_ONLY: "Local Only",
    EXTERNAL_ONLY: "External Only",
    BOTH_EXTERNAL_AND_OFFICIAL: "External + Official"
  };
  return labels[value];
}

export function storageStatusClass(value: StorageStatus) {
  if (value === "HAS_OFFICIAL_COPY" || value === "BOTH_EXTERNAL_AND_OFFICIAL" || value === "LOCAL_ONLY") {
    return "bg-green-50 text-green-700 border-green-200";
  }
  if (value === "EXTERNAL_ONLY") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}
