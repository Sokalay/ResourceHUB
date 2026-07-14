"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { projectCollaboratorRoles } from "@/lib/constants";
import { humanizeEnum } from "@/lib/resource-metadata";

type UserOption = { id: string; name: string; email: string };
type Collaborator = { id: string; role: string; user: UserOption };

export function ProjectCollaboratorsManager({
  projectId,
  collaborators,
  users
}: {
  projectId: string;
  collaborators: Collaborator[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const assignedIds = new Set(collaborators.map((collaborator) => collaborator.user.id));

  async function addCollaborator(form: HTMLFormElement) {
    setError("");
    const data = new FormData(form);
    const response = await fetch(`/api/projects/${projectId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: data.get("userId"), role: data.get("role") })
    });
    if (!response.ok) {
      setError((await response.json()).error ?? "Could not add collaborator");
      return;
    }
    form.reset();
    router.refresh();
  }

  async function removeCollaborator(id: string) {
    setError("");
    const response = await fetch(`/api/projects/${projectId}/collaborators/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError((await response.json()).error ?? "Could not remove collaborator");
      return;
    }
    router.refresh();
  }

  return (
    <section className="surface rounded-lg p-5">
      <h2 className="section-title">Collaborators</h2>
      <form
        className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void addCollaborator(event.currentTarget);
        }}
      >
        <label>User<select name="userId" required>{users.filter((user) => !assignedIds.has(user.id)).map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select></label>
        <label>Role<select name="role" defaultValue="CONTRIBUTOR">{projectCollaboratorRoles.map((role) => <option key={role} value={role}>{humanizeEnum(role)}</option>)}</select></label>
        <button className="self-end rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      {error && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="mt-4 overflow-x-auto rounded-md border border-line">
        <table className="data-table min-w-[640px]">
          <thead><tr><th>User</th><th>Email</th><th>Project Role</th><th>Action</th></tr></thead>
          <tbody>
            {collaborators.map((collaborator) => (
              <tr className="border-t border-line" key={collaborator.id}>
                <td className="font-semibold">{collaborator.user.name}</td>
                <td>{collaborator.user.email}</td>
                <td>{humanizeEnum(collaborator.role)}</td>
                <td><button className="text-sm font-semibold text-red-700" onClick={() => void removeCollaborator(collaborator.id)} type="button">Remove</button></td>
              </tr>
            ))}
            {!collaborators.length && <tr><td className="py-6 text-center text-slate-500" colSpan={4}>No cross-team collaborators assigned.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
