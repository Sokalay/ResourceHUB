"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TeamCreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <form
        className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          setMessage("");
          setError("");
          const form = new FormData(event.currentTarget);
          const response = await fetch("/api/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: form.get("name"), description: form.get("description") })
          });
          setLoading(false);
          if (response.ok) {
            event.currentTarget.reset();
            setMessage("Team created successfully.");
            router.refresh();
            return;
          }
          setError((await response.json()).error ?? "Could not create team.");
        }}
      >
        <input name="name" placeholder="Team name" required minLength={3} maxLength={100} />
        <input name="description" placeholder="Description" maxLength={500} />
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>
          <Plus size={16} /> {loading ? "Creating..." : "Create"}
        </button>
      </form>
      {message && <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}
