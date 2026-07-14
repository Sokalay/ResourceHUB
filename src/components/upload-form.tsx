"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadForm({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="grid gap-4 rounded-lg border border-line bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        const response = await fetch(`/api/resources/${resourceId}/upload`, { method: "POST", body: new FormData(event.currentTarget) });
        setLoading(false);
        if (!response.ok) {
          setError((await response.json()).error ?? "Upload failed");
          return;
        }
        event.currentTarget.reset();
        router.refresh();
      }}
    >
      <h2 className="text-lg font-bold">Upload New Version</h2>
      <label>Version Name<input name="versionName" defaultValue="v1" /></label>
      <label>Version Notes<textarea name="versionDescription" rows={2} /></label>
      <label>File<input name="file" type="file" required /></label>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button className="inline-flex w-fit items-center gap-2 rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>
        <Upload size={16} /> {loading ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
