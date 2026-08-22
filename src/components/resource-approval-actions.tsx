"use client";

import { CheckCircle2, Users } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { humanizeEnum } from "@/lib/resource-metadata";

type ApprovalRequest = {
  id: string;
  type: string;
  status: string;
  requestedBy: { name: string };
};

export function ResourceApprovalActions({
  resourceId,
  currentVisibility,
  canApproveStorage,
  canManageVisibility,
  approvalRequests
}: {
  resourceId: string;
  currentVisibility: string;
  canApproveStorage: boolean;
  canManageVisibility: boolean;
  approvalRequests: ApprovalRequest[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pendingStorage = approvalRequests.find((request) => request.type === "RESOURCE_STORAGE" && request.status === "PENDING");

  async function post(url: string, body: unknown) {
    setLoading(true);
    setError("");
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    if (!response.ok) {
      setError((await response.json()).error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  return (
    <section className="grid gap-4 rounded-lg border border-line bg-white p-5">
      <div>
        <h2 className="text-lg font-bold">Publishing</h2>
        <p className="mt-1 text-sm text-slate-600">Choose which uploaded version is the trusted current document and who can find it.</p>
      </div>
      {pendingStorage && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Latest version is waiting for review</div>
          <div className="mt-1">Uploaded by {pendingStorage.requestedBy.name}. A team owner must publish it as current.</div>
          {canApproveStorage && <button className="mt-3 inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading} onClick={() => post(`/api/resources/${resourceId}/approve-storage`, { storageHandling: "STANDARD_LOCAL", decisionNote: "Published as the current team document." })}><CheckCircle2 size={16} />Publish latest version</button>}
        </div>
      )}
      {canManageVisibility && (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
          event.preventDefault();
          post(`/api/resources/${resourceId}/visibility`, { visibility: new FormData(event.currentTarget).get("visibility") });
        }}>
          <label className="min-w-64">Who can find this document?<select name="visibility" defaultValue={currentVisibility}><option value="TEAM_ONLY">Owning team only</option><option value="ORGANIZATION">Everyone in the organization</option></select></label>
          <button className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 font-semibold disabled:opacity-60" disabled={loading}><Users size={16} />Update access</button>
        </form>
      )}
      <div className="text-sm text-slate-500">Current access: {humanizeEnum(currentVisibility)}</div>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </section>
  );
}
