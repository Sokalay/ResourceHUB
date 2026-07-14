"use client";

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TeamArchiveButton({ teamId, compact = false }: { teamId: string; compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="grid gap-2">
      <button
        className={`${compact ? "px-3 py-2 text-sm" : "px-4 py-2"} inline-flex items-center justify-center gap-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60`}
        disabled={loading}
        onClick={async () => {
          if (!confirm("Are you sure you want to archive this team? Existing resources will remain linked, but the team will no longer appear as active.")) {
            return;
          }
          setLoading(true);
          setMessage("");
          setError("");
          const response = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
          setLoading(false);
          if (response.ok) {
            const body = await response.json();
            setMessage(body.warning || "Team archived successfully.");
            router.refresh();
            return;
          }
          setError((await response.json()).error ?? "Could not archive team.");
        }}
        type="button"
      >
        <Archive size={16} /> {loading ? "Archiving..." : "Archive"}
      </button>
      {message && <div className="text-sm text-green-700">{message}</div>}
      {error && <div className="text-sm text-red-700">{error}</div>}
    </div>
  );
}
