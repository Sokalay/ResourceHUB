"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string; email?: string };

export function ResourceForm({
  users,
  teams,
  currentUserId,
  currentUserName,
  isAdmin
}: {
  users: Option[];
  teams: Option[];
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="surface grid gap-5 rounded-lg p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        const form = new FormData(event.currentTarget);
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          setLoading(false);
          setError("Choose a document to upload.");
          return;
        }

        const response = await fetch("/api/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            description: form.get("description"),
            resourceType: "DOCUMENT",
            classification: "INTERNAL",
            ownerUserId: form.get("ownerUserId"),
            teamId: form.get("teamId"),
            sourceProvider: "DIRECT_UPLOAD",
            sourceKind: "FILE",
            storageProvider: "LOCAL",
            tags: form.get("tags"),
            hasUpload: true
          })
        });
        if (!response.ok) {
          setLoading(false);
          setError((await response.json()).error ?? "Could not create document");
          return;
        }

        const { resource } = await response.json();
        const upload = new FormData();
        upload.set("file", file);
        upload.set("versionName", String(form.get("versionName") || "v1"));
        upload.set("versionDescription", String(form.get("versionDescription") || "Initial version"));
        const uploadResponse = await fetch(`/api/resources/${resource.id}/upload`, { method: "POST", body: upload });
        if (!uploadResponse.ok) {
          setLoading(false);
          setError((await uploadResponse.json()).error ?? "Document created, but the upload failed");
          return;
        }
        router.push(`/resources/${resource.id}`);
        router.refresh();
      }}
    >
      <div>
        <h2 className="text-lg font-bold">Document details</h2>
        <p className="mt-1 text-sm text-slate-600">Upload a team document. Later updates will be kept as new versions of the same document.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>Title<input name="name" required minLength={3} maxLength={120} placeholder="Engineering handbook" /></label>
        <label>Tags<input name="tags" placeholder="handbook, engineering, onboarding" /></label>
      </div>
      <label>Description<textarea name="description" rows={3} placeholder="What this document covers and when people should use it" /></label>

      <div className="grid gap-4 md:grid-cols-2">
        <label>Owning team<select name="teamId" required>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        {isAdmin ? (
          <label>Document owner<select name="ownerUserId" defaultValue={currentUserId} required>{users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.email ? ` (${user.email})` : ""}</option>)}</select></label>
        ) : (
          <div>
            <div className="text-sm font-semibold text-slate-600">Document owner</div>
            <div className="mt-2 rounded-md border border-line bg-panel px-3 py-2">{currentUserName}</div>
            <input name="ownerUserId" type="hidden" value={currentUserId} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
        <div>
          <div className="font-semibold text-blue-950">Use the project document template</div>
          <p className="mt-1 text-sm text-blue-900">It includes consistent progress, blockers, next steps, contributions, and missing-update sections for future chatbot search.</p>
        </div>
        <a className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100" download href="/templates/project-document-template.md">Download template</a>
      </div>

      <div className="grid gap-4 rounded-md border border-line bg-slate-50 p-4 md:grid-cols-2">
        <label>Version name<input name="versionName" defaultValue="v1" required /></label>
        <label>Document file<input name="file" type="file" accept=".pdf,.docx,.md,.txt" required /></label>
        <label className="md:col-span-2">What changed?<textarea name="versionDescription" rows={2} defaultValue="Initial version" /></label>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        The document starts as team-only. If you are a team owner it is published immediately; otherwise a team owner reviews it before it becomes the current version.
      </div>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button className="w-fit rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>
        {loading ? "Uploading..." : "Upload document"}
      </button>
    </form>
  );
}
