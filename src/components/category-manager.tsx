"use client";

import Link from "next/link";
import { Archive, Edit, FolderTree, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CategoryOption = { id: string; name: string; path: string; depth: number; parentId: string | null; level: number; description: string | null; sortOrder: number | null; resourceCount: number; childCount: number };

export function CategoryManager({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CategoryOption | null>(null);
  const [parentPreset, setParentPreset] = useState<CategoryOption | null>(null);

  async function handleResponse(response: Response, success: string) {
    if (response.ok) {
      setMessage(success);
      setError("");
      setEditing(null);
      router.refresh();
      return;
    }
    setMessage("");
    setError((await response.json()).error ?? "Category action failed.");
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={() => { setParentPreset(null); setEditing(null); }} type="button">
          <Plus size={16} /> Create Main Category
        </button>
        <span className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">Tree is expanded by default</span>
      </div>

      <form
        className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const response = await fetch("/api/resource-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.get("name"),
              description: form.get("description"),
              parent_id: parentPreset?.id ?? (form.get("parentId") || null),
              sort_order: form.get("sortOrder") ? Number(form.get("sortOrder")) : null
            })
          });
          if (response.ok) event.currentTarget.reset();
          await handleResponse(response, "Category created successfully.");
        }}
      >
        {parentPreset && <div className="rounded-md bg-panel p-3 text-sm md:col-span-4">Parent: <strong>{parentPreset.path}</strong></div>}
        <input name="name" placeholder="Category name" required minLength={2} maxLength={100} />
        <select disabled={Boolean(parentPreset)} name="parentId" defaultValue={parentPreset?.id ?? ""}>
          <option value="">No parent - main domain</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.path}</option>)}
        </select>
        <input name="description" placeholder="Description" maxLength={500} />
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 font-semibold text-white"><Plus size={16} /> Add</button>
      </form>
      {message && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {editing && (
        <form
          className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const response = await fetch(`/api/resource-categories/${editing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: form.get("name"),
                description: form.get("description"),
                parent_id: form.get("parentId") || null
              })
            });
            await handleResponse(response, editing.parentId === form.get("parentId") ? "Category updated successfully." : "Category moved successfully.");
          }}
        >
          <input name="name" defaultValue={editing.name} required minLength={2} maxLength={100} />
          <select name="parentId" defaultValue={editing.parentId ?? ""}>
            <option value="">No parent - main domain</option>
            {categories.filter((category) => category.id !== editing.id).map((category) => <option key={category.id} value={category.id}>{category.path}</option>)}
          </select>
          <input name="description" defaultValue={editing.description ?? ""} maxLength={500} />
          <button className="rounded-md bg-ink px-4 py-2 font-semibold text-white">Save</button>
        </form>
      )}

      <div className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Category Tree</h2>
        <div className="mt-4 grid gap-2">
          {categories.map((category) => (
            <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2" style={{ paddingLeft: `${category.depth * 24}px` }}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <FolderTree size={16} />
                  <span className="font-semibold">{category.name}</span>
                  <span className="rounded-md border border-line px-2 py-1 text-xs">Level {category.level}</span>
                  <span className="text-xs text-slate-500">{category.resourceCount} resources</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{category.path}</div>
                {!category.childCount && <div className="mt-1 text-xs text-slate-500">No subcategories yet.</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm" onClick={() => { setParentPreset(category); setEditing(null); }} type="button"><Plus size={16} /> Add child</button>
                <button className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm" onClick={() => setEditing(category)} type="button"><Edit size={16} /> Edit</button>
                <Link className="rounded-md border border-line px-3 py-2 text-sm" href={`/resources?category_ids=${category.id}&include_category_descendants=true`}>View resources</Link>
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700"
                  onClick={async () => {
                    if (!confirm("Archive this category? Child categories must be archived first.")) return;
                    await handleResponse(await fetch(`/api/resource-categories/${category.id}`, { method: "DELETE" }), "Category archived successfully.");
                  }}
                  type="button"
                >
                  <Archive size={16} /> Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
