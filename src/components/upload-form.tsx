"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadForm({ resourceId, nextVersionNumber = 1 }: { resourceId: string; nextVersionNumber?: number }) {
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
      <div>
        <h2 className="text-lg font-bold">Upload an updated version</h2>
        <p className="mt-1 text-sm text-slate-600">The previous version stays in history. Add a clear summary so readers know what changed.</p>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Keep the standard progress sections in every version. <a className="font-semibold underline" download href="/templates/project-document-template.md">Download the template</a>.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label>Version name<input name="versionName" defaultValue={`v${nextVersionNumber}`} /></label>
        <label>Document file<input name="file" type="file" accept=".pdf,.docx,.md,.txt" required /></label>
      </div>
      <label>What changed?<textarea name="versionDescription" rows={2} required placeholder="Updated the onboarding checklist and ownership contacts" /></label>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button className="inline-flex w-fit items-center gap-2 rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>
        <Upload size={16} /> {loading ? "Uploading..." : "Upload new version"}
      </button>
    </form>
  );
}
