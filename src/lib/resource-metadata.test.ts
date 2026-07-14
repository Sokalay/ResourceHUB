import { describe, expect, it } from "vitest";
import { getStorageStatus, normalizeTags } from "@/lib/resource-metadata";

const base = {
  id: "r1",
  name: "Resource",
  slug: "resource",
  description: null,
  resourceType: "DATASET" as const,
  classification: "INTERNAL" as const,
  primaryCategoryId: null,
  projectId: null,
  contributedByTeamId: null,
  ownerUserId: "u1",
  teamId: "t1",
  currentWorkingLocation: null,
  stagingStorageLocation: null,
  officialStorageLocation: null,
  sourceAccessGranted: false,
  sourceAccessInstructions: null,
  storageHandling: "STANDARD_LOCAL" as const,
  storageDecisionNotes: null,
  sourceProvider: "MANUAL" as const,
  sourceKind: "OTHER" as const,
  sourceUrl: null,
  storageProvider: "LOCAL" as const,
  metadataJson: null,
  status: "SUBMITTED" as const,
  visibility: "TEAM_ONLY" as const,
  pendingVisibility: null,
  teamApprovedAt: null,
  teamApprovedById: null,
  adminApprovedAt: null,
  adminApprovedById: null,
  createdById: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  files: []
};

describe("resource metadata helpers", () => {
  it("detects external-only resources", () => {
    expect(getStorageStatus({ ...base, sourceUrl: "https://github.com/example/repo" })).toBe("EXTERNAL_ONLY");
  });

  it("detects official copies", () => {
    expect(getStorageStatus({ ...base, officialStorageLocation: "datasets/example/v1/file.zip" })).toBe("LOCAL_ONLY");
  });

  it("does not treat staged files as official copies", () => {
    expect(getStorageStatus({ ...base, stagingStorageLocation: "staging/file.zip", files: [{ id: "file_1" }] })).toBe("NO_OFFICIAL_COPY");
  });

  it("normalizes tags", () => {
    expect(normalizeTags(" Khmer, OCR, khmer , training-data ")).toEqual(["khmer", "ocr", "training-data"]);
  });
});
