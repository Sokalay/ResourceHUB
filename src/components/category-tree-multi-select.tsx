"use client";

import { useMemo, useState } from "react";

export type CategoryTreeNode = {
  id: string;
  name: string;
  path: string;
  children: CategoryTreeNode[];
};

function flatten(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function TreeNode({
  node,
  selected,
  onToggle,
  query
}: {
  node: CategoryTreeNode;
  selected: Set<string>;
  onToggle: (id: string) => void;
  query: string;
}) {
  const [open, setOpen] = useState(true);
  const matches = !query || node.path.toLowerCase().includes(query.toLowerCase());
  const childMatches = node.children.some((child) => child.path.toLowerCase().includes(query.toLowerCase()));
  if (!matches && !childMatches) return null;
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <button aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`} className="w-6 rounded border border-line text-xs" onClick={() => setOpen(!open)} type="button">
          {node.children.length ? (open ? "-" : "+") : ""}
        </button>
        <label className="flex flex-1 items-center gap-2 text-sm font-normal">
          <input checked={selected.has(node.id)} className="w-auto" onChange={() => onToggle(node.id)} type="checkbox" />
          <span title={node.path}>{node.name}</span>
        </label>
      </div>
      {open && node.children.length > 0 && <div className="ml-6 grid gap-1">{node.children.map((child) => <TreeNode key={child.id} node={child} selected={selected} onToggle={onToggle} query={query} />)}</div>}
    </div>
  );
}

export function CategoryTreeMultiSelect({
  tree,
  selectedCategoryIds,
  includeDescendants = true
}: {
  tree: CategoryTreeNode[];
  selectedCategoryIds: string[];
  includeDescendants?: boolean;
}) {
  const [selected, setSelected] = useState(new Set(selectedCategoryIds));
  const [query, setQuery] = useState("");
  const [descendants, setDescendants] = useState(includeDescendants);
  const flat = useMemo(() => flatten(tree), [tree]);
  const selectedPaths = flat.filter((category) => selected.has(category.id)).map((category) => category.path);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="grid gap-3 rounded-md border border-line p-3">
      <input name="category_ids" type="hidden" value={Array.from(selected).join(",")} />
      <input name="include_category_descendants" type="hidden" value={descendants ? "true" : "false"} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">Category filter</div>
        <button className="rounded-md border border-line px-3 py-1 text-sm" onClick={() => setSelected(new Set())} type="button">Clear selected</button>
      </div>
      <input aria-label="Search categories" placeholder="Search categories" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <label className="flex items-center gap-2 text-sm font-normal">
        <input checked={descendants} className="w-auto" onChange={(event) => setDescendants(event.currentTarget.checked)} type="checkbox" />
        Selecting a parent includes its subcategories.
      </label>
      <div className="max-h-72 overflow-auto rounded-md bg-panel p-3">
        {tree.length ? tree.map((node) => <TreeNode key={node.id} node={node} selected={selected} onToggle={toggle} query={query} />) : <div className="text-sm text-slate-500">No categories found. Create categories from the Categories page.</div>}
      </div>
      {selectedPaths.length > 0 && <div className="flex flex-wrap gap-2 text-xs">{selectedPaths.map((path) => <span className="rounded-full border border-line bg-white px-2 py-1" key={path}>{path}</span>)}</div>}
    </div>
  );
}
