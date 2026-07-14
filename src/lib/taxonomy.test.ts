import { describe, expect, it } from "vitest";
import { buildCategoryTree, flattenCategoryTree } from "@/lib/taxonomy";

const now = new Date();

function category(id: string, name: string, parentId: string | null, level: number) {
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(" ", "_"),
    description: null,
    parentId,
    level,
    sortOrder: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    _count: { resources: id === "ocr" ? 2 : 0 }
  };
}

describe("taxonomy helpers", () => {
  it("builds a nested category tree with resource counts", () => {
    const tree = buildCategoryTree([
      category("ai", "AI", null, 1),
      category("cv", "Computer Vision", "ai", 2),
      category("ocr", "OCR", "cv", 3)
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe("OCR");
    expect(tree[0].children[0].children[0].resourceCount).toBe(2);
  });

  it("flattens category paths for selectors", () => {
    const rows = flattenCategoryTree(buildCategoryTree([
      category("ai", "AI", null, 1),
      category("cv", "Computer Vision", "ai", 2),
      category("ocr", "OCR", "cv", 3)
    ]));

    expect(rows.map((row) => row.path)).toEqual(["AI", "AI / Computer Vision", "AI / Computer Vision / OCR"]);
  });
});
