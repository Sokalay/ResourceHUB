import { describe, expect, it } from "vitest";
import { ResourceType } from "@prisma/client";
import { generateResourceSlug, generateStoragePath, sanitizeFileName } from "@/lib/storage";

describe("storage helpers", () => {
  it("generates safe resource slugs", () => {
    expect(generateResourceSlug("Engineering Handbook!")).toBe("engineering_handbook");
  });

  it("sanitizes uploaded file names", () => {
    expect(sanitizeFileName("../Team Handbook.pdf")).toBe("Team_Handbook.pdf");
  });

  it("generates document storage paths", () => {
    expect(generateStoragePath(ResourceType.DOCUMENT, "engineering_handbook", 1, "handbook.pdf")).toBe(
      "documents/engineering_handbook/v1/handbook.pdf"
    );
  });
});
