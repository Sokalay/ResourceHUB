import { describe, expect, it } from "vitest";
import { ResourceType } from "@prisma/client";
import { generateResourceSlug, generateStoragePath, sanitizeFileName } from "@/lib/storage";

describe("storage helpers", () => {
  it("generates safe resource slugs", () => {
    expect(generateResourceSlug("Khmer OCR Dataset!")).toBe("khmer_ocr_dataset");
  });

  it("sanitizes uploaded file names", () => {
    expect(sanitizeFileName("../My File.zip")).toBe("My_File.zip");
  });

  it("generates official storage paths", () => {
    expect(generateStoragePath(ResourceType.DATASET, "khmer_ocr_dataset", 1, "dataset.zip")).toBe(
      "datasets/khmer_ocr_dataset/v1/dataset.zip"
    );
  });
});
