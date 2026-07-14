import {
  Classification,
  ProjectCollaboratorRole,
  ProjectOrigin,
  ProjectOwnershipStatus,
  ProjectProvisioningStatus,
  ProjectStatus,
  ResourceStatus,
  ResourceType,
  SourceKind,
  SourceProvider,
  SourceType,
  StorageHandling,
  StorageProvider
} from "@prisma/client";

export const resourceTypes = Object.values(ResourceType);
export const classifications = Object.values(Classification);
export const resourceStatuses = Object.values(ResourceStatus);
export const sourceTypes = Object.values(SourceType);
export const sourceProviders = Object.values(SourceProvider);
export const sourceKinds = Object.values(SourceKind);
export const storageProviders = Object.values(StorageProvider);
export const storageHandlings = Object.values(StorageHandling);
export const projectOrigins = Object.values(ProjectOrigin);
export const projectStatuses = Object.values(ProjectStatus);
export const projectProvisioningStatuses = Object.values(ProjectProvisioningStatus);
export const projectOwnershipStatuses = Object.values(ProjectOwnershipStatus);
export const projectCollaboratorRoles = Object.values(ProjectCollaboratorRole);
export const storageStatuses = [
  "HAS_OFFICIAL_COPY",
  "NO_OFFICIAL_COPY",
  "LOCAL_ONLY",
  "EXTERNAL_ONLY",
  "BOTH_EXTERNAL_AND_OFFICIAL"
] as const;

export const statusClasses: Record<ResourceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  TRANSFERRING: "bg-yellow-50 text-yellow-800 border-yellow-200",
  STORED: "bg-green-50 text-green-700 border-green-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  ARCHIVED: "bg-zinc-200 text-zinc-800 border-zinc-300"
};

export const classificationClasses: Record<Classification, string> = {
  PUBLIC: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INTERNAL: "bg-sky-50 text-sky-700 border-sky-200",
  CONFIDENTIAL: "bg-amber-50 text-amber-800 border-amber-200",
  RESTRICTED: "bg-rose-50 text-rose-700 border-rose-200"
};

export const neutralBadgeClass = "bg-slate-50 text-slate-700 border-slate-200";

export const allowedExtensions = new Set([
  ".zip",
  ".csv",
  ".json",
  ".jsonl",
  ".pdf",
  ".docx",
  ".txt",
  ".py",
  ".ipynb",
  ".png",
  ".jpg",
  ".jpeg",
  ".pt",
  ".pth",
  ".onnx",
  ".safetensors",
  ".tar",
  ".gz",
  ".7z"
]);
