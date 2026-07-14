"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { humanizeEnum } from "@/lib/resource-metadata";

type UserOption = { id: string; name: string; email: string; role: string };
type Member = { id: string; role: "OWNER" | "MEMBER"; user: UserOption };

export function TeamMembersManager({ teamId, members, users }: { teamId: string; members: Member[]; users: UserOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const memberUserIds = new Set(members.map((member) => member.user.id));
  const addableUsers = users.filter((user) => !memberUserIds.has(user.id));

  async function showResponse(response: Response, success: string) {
    setLoading("");
    if (response.ok) {
      setMessage(success);
      setError("");
      router.refresh();
      return;
    }
    setMessage("");
    setError((await response.json()).error ?? "Team member action failed.");
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5" id="members">
      <h2 className="text-lg font-bold">Members</h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <form
          className="grid gap-3 rounded-md border border-line p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading("create");
            setMessage("");
            setError("");
            const form = new FormData(event.currentTarget);
            const createResponse = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: form.get("name"),
                email: form.get("email"),
                password: form.get("password"),
                role: form.get("systemRole")
              })
            });
            if (!createResponse.ok) {
              await showResponse(createResponse, "");
              return;
            }
            const created = await createResponse.json();
            const addResponse = await fetch(`/api/teams/${teamId}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: created.user.id, role: form.get("teamRole") })
            });
            if (addResponse.ok) event.currentTarget.reset();
            await showResponse(addResponse, "User created and added to team successfully.");
          }}
        >
          <h3 className="font-semibold">Create New User</h3>
          <label>Name<input name="name" required minLength={2} maxLength={100} /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" required minLength={6} /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label>System role
              <select name="systemRole" defaultValue="VIEWER">
                <option value="VIEWER">Viewer</option>
                <option value="CONTRIBUTOR">Contributor</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label>Team role
              <select name="teamRole" defaultValue="MEMBER">
                <option value="MEMBER">Member</option>
                <option value="OWNER">Team owner</option>
              </select>
            </label>
          </div>
          <button className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading === "create"}>
            <Plus size={16} /> {loading === "create" ? "Creating..." : "Create and add"}
          </button>
        </form>

        <form
          className="grid content-start gap-3 rounded-md border border-line p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading("add");
            const form = new FormData(event.currentTarget);
            const response = await fetch(`/api/teams/${teamId}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: form.get("userId"), role: form.get("role") })
            });
            if (response.ok) event.currentTarget.reset();
            await showResponse(response, "Member added successfully.");
          }}
        >
          <h3 className="font-semibold">Add Existing User</h3>
          <select name="userId" required>
            <option value="">Select user</option>
            {addableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
          </select>
          <select name="role" defaultValue="MEMBER">
            <option value="MEMBER">Member</option>
            <option value="OWNER">Team owner</option>
          </select>
          <button className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading === "add" || !addableUsers.length}>
            <Plus size={16} /> {loading === "add" ? "Adding..." : "Add member"}
          </button>
        </form>
      </div>
      {message && <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="mt-4 overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Name</th><th>Email</th><th>System role</th><th>Team role</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-line">
                <td className="px-3 py-2 font-semibold">{member.user.name}</td>
                <td>{member.user.email}</td>
                <td>{humanizeEnum(member.user.role)}</td>
                <td>
                  <select
                    aria-label={`Change role for ${member.user.name}`}
                    defaultValue={member.role}
                    onChange={async (event) => {
                      setLoading(member.id);
                      const response = await fetch(`/api/teams/${teamId}/members/${member.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ role: event.currentTarget.value })
                      });
                      await showResponse(response, "Member role updated successfully.");
                    }}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="OWNER">Team owner</option>
                  </select>
                </td>
                <td>
                  <button
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-red-700 hover:bg-red-50 disabled:opacity-60"
                    disabled={loading === member.id}
                    onClick={async () => {
                      if (!confirm("Remove this user from the team?")) return;
                      setLoading(member.id);
                      const response = await fetch(`/api/teams/${teamId}/members/${member.id}`, { method: "DELETE" });
                      await showResponse(response, "Member removed successfully.");
                    }}
                    type="button"
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                </td>
              </tr>
            ))}
            {!members.length && <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={5}>No team members.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
