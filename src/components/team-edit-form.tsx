"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TeamEditForm({ team }: { team: { id: string; name: string; description: string | null } }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="grid gap-4 rounded-lg border border-line bg-white p-5"
      id="edit"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");
        const form = new FormData(event.currentTarget);
        const response = await fetch(`/api/teams/${team.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.get("name"), description: form.get("description") })
        });
        setLoading(false);
        if (response.ok) {
          setMessage("Team updated successfully.");
          router.refresh();
          return;
        }
        setError((await response.json()).error ?? "Could not update team.");
      }}
    >
      <h2 className="text-lg font-bold">Edit Team</h2>
      <label>Team name<input name="name" defaultValue={team.name} required minLength={3} maxLength={100} /></label>
      <label>Description<textarea name="description" defaultValue={team.description ?? ""} maxLength={500} rows={3} /></label>
      {message && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button className="inline-flex w-fit items-center gap-2 rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>
        <Save size={16} /> {loading ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
