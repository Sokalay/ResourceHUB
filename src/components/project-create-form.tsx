"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { projectOrigins, projectOwnershipStatuses, projectProvisioningStatuses } from "@/lib/constants";
import { humanizeEnum } from "@/lib/resource-metadata";

type TeamOption = { id: string; name: string };
type UserOption = { id: string; name: string; email: string };

export function ProjectCreateForm({ teams, users }: { teams: TeamOption[]; users: UserOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <details className="surface rounded-lg">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span>
          <span className="section-title block">Create Project</span>
          <span className="mt-1 block text-sm text-slate-600">Register the project before resources are submitted.</span>
        </span>
        <span className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">New Project</span>
      </summary>
      <form
        className="grid gap-5 border-t border-line p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setLoading(true);
          const form = new FormData(event.currentTarget);
          const collaboratorUserIds = form.getAll("collaboratorUserIds").map(String);
          const response = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.get("name"),
              description: form.get("description"),
              origin: form.get("origin"),
              teamId: form.get("teamId"),
              leadUserId: form.get("leadUserId"),
              repositoryUrl: form.get("repositoryUrl"),
              repositoryName: form.get("repositoryName"),
              provisioningStatus: form.get("provisioningStatus"),
              ownershipStatus: form.get("ownershipStatus"),
              collaboratorUserIds
            })
          });
          setLoading(false);
          if (!response.ok) {
            setError((await response.json()).error ?? "Could not create project");
            return;
          }
          const { project } = await response.json();
          router.push(`/projects/${project.id}`);
          router.refresh();
        }}
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="lg:col-span-2">Name<input name="name" required minLength={3} maxLength={120} /></label>
          <label>Origin<select name="origin" defaultValue="NEW">{projectOrigins.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}</select></label>
          <label>Ownership<select name="ownershipStatus" defaultValue="RND_ADMIN_OWNER">{projectOwnershipStatuses.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}</select></label>
          <label>Owning Team<select name="teamId" required>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label>Project Lead<select name="leadUserId" required>{users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select></label>
          <label>Provisioning<select name="provisioningStatus" defaultValue="NOT_REQUESTED">{projectProvisioningStatuses.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}</select></label>
          <label>Repository Name<input name="repositoryName" placeholder="resourcehub-demo-project" /></label>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label>Repository URL<input name="repositoryUrl" placeholder="https://github.com/org/repo" /></label>
          <label>Cross-team Collaborators<select className="min-h-28" name="collaboratorUserIds" multiple>{users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select></label>
        </div>
        <label>Description<textarea name="description" rows={3} /></label>
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button className="w-fit rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>{loading ? "Creating..." : "Create Project"}</button>
      </form>
    </details>
  );
}
