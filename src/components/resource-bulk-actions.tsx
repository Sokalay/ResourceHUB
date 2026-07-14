"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { classifications, resourceStatuses } from "@/lib/constants";

type Option = { id: string; name: string; path?: string };

export function ResourceBulkActions({ teams, categories }: { teams: Option[]; categories: Option[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    const ids = String(formData.get("resourceIds") ?? "").split(",").filter(Boolean);
    if (!ids.length) {
      setError("Select at least one resource.");
      return;
    }
    const action = formData.get("action");
    const body: Record<string, unknown> = { resourceIds: ids, action };
    if (action === "CHANGE_CLASSIFICATION") body.classification = formData.get("classification");
    if (action === "CHANGE_TEAM") body.teamId = formData.get("teamId");
    if (action === "CHANGE_CATEGORY") body.categoryId = formData.get("categoryId") || null;
    if (action === "CHANGE_STATUS") body.status = formData.get("status");
    const response = await fetch("/api/resources/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (response.ok) {
      setMessage("Bulk action completed.");
      setError("");
      router.refresh();
      return;
    }
    setMessage("");
    setError((await response.json()).error ?? "Bulk action failed.");
  }

  return (
    <form
      className="mb-4 grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const checked = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='resourceSelection']:checked")).map((input) => input.value);
        const form = new FormData(event.currentTarget);
        form.set("resourceIds", checked.join(","));
        await submit(form);
      }}
    >
      <select name="action" defaultValue="ARCHIVE">
        <option value="ARCHIVE">Archive selected</option>
        <option value="CHANGE_CLASSIFICATION">Change classification</option>
        <option value="CHANGE_TEAM">Change team</option>
        <option value="CHANGE_CATEGORY">Change category</option>
        <option value="CHANGE_STATUS">Change status</option>
      </select>
      <select name="classification">{classifications.map((value) => <option key={value}>{value}</option>)}</select>
      <select name="teamId">{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
      <select name="categoryId"><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.path ?? category.name}</option>)}</select>
      <select name="status">{resourceStatuses.map((value) => <option key={value}>{value}</option>)}</select>
      <button className="rounded-md bg-ink px-4 py-2 font-semibold text-white">Apply Bulk Action</button>
      {message && <div className="text-sm text-green-700 md:col-span-6">{message}</div>}
      {error && <div className="text-sm text-red-700 md:col-span-6">{error}</div>}
    </form>
  );
}
