"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CategorySelectOption = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  level: number;
};

function ancestorsFor(categories: CategorySelectOption[], value?: string | null) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ids: string[] = [];
  let current = value ? byId.get(value) : undefined;
  while (current) {
    ids.unshift(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return ids;
}

export function CascadingCategorySelector({
  categories,
  value,
  inputName = "primaryCategoryId",
  showManageLink = false
}: {
  categories: CategorySelectOption[];
  value?: string | null;
  inputName?: string;
  showManageLink?: boolean;
}) {
  const initial = ancestorsFor(categories, value);
  const [level1, setLevel1] = useState(initial[0] ?? "");
  const [level2, setLevel2] = useState(initial[1] ?? "");
  const [level3, setLevel3] = useState(initial[2] ?? "");
  const byParent = useMemo(() => {
    const map = new Map<string, CategorySelectOption[]>();
    for (const category of categories) {
      const key = category.parentId ?? "root";
      map.set(key, [...(map.get(key) ?? []), category]);
    }
    return map;
  }, [categories]);
  const level1Options = byParent.get("root") ?? [];
  const level2Options = level1 ? byParent.get(level1) ?? [] : [];
  const level3Options = level2 ? byParent.get(level2) ?? [] : [];
  const selected = level3 || level2 || level1;
  const selectedPath = categories.find((category) => category.id === selected)?.path;

  return (
    <div className="grid gap-3">
      <input name={inputName} type="hidden" value={selected} />
      <div className="grid gap-3 md:grid-cols-3">
        <label>Main Domain
          <select value={level1} onChange={(event) => { setLevel1(event.currentTarget.value); setLevel2(""); setLevel3(""); }}>
            <option value="">Select main domain</option>
            {level1Options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label>Area / Field
          <select disabled={!level1 || !level2Options.length} value={level2} onChange={(event) => { setLevel2(event.currentTarget.value); setLevel3(""); }}>
            <option value="">{level1 && !level2Options.length ? "No subcategories available" : "Select area / field"}</option>
            {level2Options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label>Task / Subcategory
          <select disabled={!level2 || !level3Options.length} value={level3} onChange={(event) => setLevel3(event.currentTarget.value)}>
            <option value="">{level2 && !level3Options.length ? "No subcategories available" : "Select task / subcategory"}</option>
            {level3Options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>{selectedPath ? `Selected: ${selectedPath}` : "Choose the most specific category available."}</span>
        {showManageLink && <Link className="font-semibold text-blue-700" href="/categories">Manage Categories</Link>}
      </div>
    </div>
  );
}
