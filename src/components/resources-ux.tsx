"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CascadingCategorySelector } from "@/components/cascading-category-selector";
import { classifications, resourceStatuses } from "@/lib/constants";

type Option = { id: string; name: string; path?: string; parentId?: string | null; level?: number };

export function SelectAllResources() {
  return (
    <input
      aria-label="Select all resources"
      className="w-auto"
      onChange={(event) => {
        document.querySelectorAll<HTMLInputElement>("input[name='resourceSelection']").forEach((input) => {
          input.checked = event.currentTarget.checked;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }}
      type="checkbox"
    />
  );
}

export function ResourceBulkBar({ teams, categories }: { teams: Option[]; categories: Option[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState("ARCHIVE");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const update = () => {
      setSelected(Array.from(document.querySelectorAll<HTMLInputElement>("input[name='resourceSelection']:checked")).map((input) => input.value));
    };
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, []);

  if (!selected.length) return null;

  async function apply(formData: FormData) {
    if (action === "ARCHIVE" && !confirm(`Archive ${selected.length} selected resources?`)) return;
    setBusy(true);
    setMessage("");
    setError("");
    const body: Record<string, unknown> = { resourceIds: selected, action };
    if (action === "CHANGE_CLASSIFICATION") body.classification = formData.get("classification");
    if (action === "CHANGE_TEAM") body.teamId = formData.get("teamId");
    if (action === "CHANGE_CATEGORY") body.categoryId = formData.get("categoryId") || null;
    if (action === "CHANGE_STATUS") body.status = formData.get("status");
    const response = await fetch("/api/resources/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setBusy(false);
    if (response.ok) {
      setMessage("Bulk action completed.");
      setError("");
      document.querySelectorAll<HTMLInputElement>("input[name='resourceSelection']").forEach((input) => {
        input.checked = false;
      });
      setSelected([]);
      router.refresh();
      return;
    }
    setError((await response.json()).error ?? "Bulk action failed. No resources were changed.");
  }

  return (
    <form
      className="sticky top-0 z-10 mb-4 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm md:grid-cols-[auto_1fr_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        await apply(new FormData(event.currentTarget));
      }}
    >
      <div className="font-semibold text-amber-900">{selected.length} selected</div>
      <div className="grid gap-3 md:grid-cols-5">
        <select aria-label="Bulk action" value={action} onChange={(event) => setAction(event.currentTarget.value)}>
          <option value="ARCHIVE">Archive</option>
          <option value="CHANGE_CLASSIFICATION">Change classification</option>
          <option value="CHANGE_TEAM">Change team</option>
          <option value="CHANGE_CATEGORY">Change category</option>
          <option value="CHANGE_STATUS">Change status</option>
        </select>
        <select className={action === "CHANGE_CLASSIFICATION" ? "" : "hidden"} name="classification">{classifications.map((value) => <option key={value}>{value}</option>)}</select>
        <select className={action === "CHANGE_TEAM" ? "" : "hidden"} name="teamId">{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
        {action === "CHANGE_CATEGORY" && (
          <div className="md:col-span-5">
            <CascadingCategorySelector
              categories={categories.map((category) => ({
                id: category.id,
                name: category.name,
                path: category.path ?? category.name,
                parentId: category.parentId ?? null,
                level: category.level ?? 1
              }))}
              inputName="categoryId"
            />
          </div>
        )}
        <select className={action === "CHANGE_STATUS" ? "" : "hidden"} name="status">{resourceStatuses.map((value) => <option key={value}>{value}</option>)}</select>
      </div>
      <div className="flex gap-2">
        <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy}>{busy ? "Applying..." : "Apply"}</button>
        <button className="rounded-md border border-line px-4 py-2 text-sm font-semibold" onClick={() => {
          document.querySelectorAll<HTMLInputElement>("input[name='resourceSelection']").forEach((input) => { input.checked = false; });
          setSelected([]);
        }} type="button">Clear</button>
      </div>
      {message && <div className="text-sm text-green-700 md:col-span-3">{message}</div>}
      {error && <div className="text-sm text-red-700 md:col-span-3">{error}</div>}
    </form>
  );
}
