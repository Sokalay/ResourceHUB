"use client";

import { Check, Globe2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvalTypeLabel, humanizeEnum } from "@/lib/resource-metadata";

type ApprovalRequest = {
  id: string;
  type: string;
  status: string;
  requestedVisibility?: string | null;
  note?: string | null;
  requestedBy: { name: string };
  createdAt: string | Date;
};

const visibilityOptions = [
  { value: "TEAM_ONLY", label: "Inside team" },
  { value: "ORGANIZATION", label: "Inside organization" },
  { value: "VISITOR", label: "Visitor" },
  { value: "PUBLIC", label: "Public" }
];

const storageHandlingOptions = [
  { value: "STANDARD_LOCAL", label: "Standard local" },
  { value: "ORGANIZATION_INTERNAL", label: "Organization internal" },
  { value: "RESTRICTED_LOCAL", label: "Restricted local" },
  { value: "EXTERNAL_REFERENCE_ONLY", label: "External reference only" }
];

export function ResourceApprovalActions({
  resourceId,
  currentVisibility,
  pendingVisibility,
  canApproveStorage,
  canManageVisibility,
  isAdmin,
  approvalRequests
}: {
  resourceId: string;
  currentVisibility: string;
  pendingVisibility?: string | null;
  canApproveStorage: boolean;
  canManageVisibility: boolean;
  isAdmin: boolean;
  approvalRequests: ApprovalRequest[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const pendingStorage = approvalRequests.find((request) => request.type === "RESOURCE_STORAGE" && request.status === "PENDING");
  const pendingVisibilityRequest = approvalRequests.find((request) => request.type.startsWith("VISIBILITY_") && request.status === "PENDING");

  async function post(url: string, body?: unknown) {
    setError("");
    setLoading(url);
    const response = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    setLoading("");
    if (!response.ok) {
      setError((await response.json()).error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Workflow Approval</h2>
          <p className="mt-1 text-sm text-slate-600">
            Current visibility: <span className="font-semibold">{humanizeEnum(currentVisibility)}</span>
            {pendingVisibility ? <span className="ml-2 text-amber-700">Pending: {humanizeEnum(pendingVisibility)}</span> : null}
          </p>
        </div>
      </div>

      {pendingStorage && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Upload is waiting for team lead approval before it becomes the official stored copy.
        </div>
      )}

      {pendingStorage && canApproveStorage && (
        <form
          className="grid gap-3 rounded-md border border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            post(`/api/resources/${resourceId}/approve-storage`, {
              storageHandling: form.get("storageHandling"),
              sourceAccessInstructions: form.get("sourceAccessInstructions"),
              decisionNote: form.get("decisionNote")
            });
          }}
        >
          <h3 className="text-sm font-bold uppercase text-slate-500">Team Lead Storage Decision</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              Storage handling
              <select name="storageHandling" defaultValue="STANDARD_LOCAL">
                {storageHandlingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              Decision notes
              <input name="decisionNote" placeholder="Reason or special handling note" />
            </label>
          </div>
          <label>
            Access instructions
            <textarea name="sourceAccessInstructions" placeholder="How Resource Hub can access the source, service account, folder, or restricted location" rows={3} />
          </label>
          <button className="inline-flex w-fit items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={loading !== ""}>
            <ShieldCheck size={16} /> Approve Storage
          </button>
        </form>
      )}

      {canManageVisibility && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            post(`/api/resources/${resourceId}/visibility`, { visibility: form.get("visibility") });
          }}
        >
          <label className="min-w-60">
            Visibility
            <select name="visibility" defaultValue={pendingVisibility ?? currentVisibility}>
              {visibilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 font-semibold disabled:opacity-60" disabled={loading !== ""}>
            <Globe2 size={16} /> Update Visibility
          </button>
        </form>
      )}

      {pendingVisibilityRequest && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Admin approval requested for {humanizeEnum(pendingVisibilityRequest.requestedVisibility)}.
        </div>
      )}

      {isAdmin && approvalRequests.filter((request) => request.status === "PENDING").length > 0 && (
        <div className="grid gap-2">
          <h3 className="text-sm font-bold uppercase text-slate-500">Admin Review</h3>
          {approvalRequests.filter((request) => request.status === "PENDING").map((request) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3 text-sm" key={request.id}>
              <div>
                <div className="font-semibold">{approvalTypeLabel(request.type)}{request.requestedVisibility ? ` to ${humanizeEnum(request.requestedVisibility)}` : ""}</div>
                <div className="text-slate-500">Requested by {request.requestedBy.name}</div>
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center gap-1 rounded-md bg-green-700 px-3 py-2 font-semibold text-white" disabled={loading !== ""} onClick={() => post(`/api/approval-requests/${request.id}/review`, { decision: "APPROVED" })}>
                  <Check size={15} /> Approve
                </button>
                <button className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 font-semibold" disabled={loading !== ""} onClick={() => post(`/api/approval-requests/${request.id}/review`, { decision: "REJECTED" })}>
                  <X size={15} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {approvalRequests.length > 0 && (
        <div className="grid gap-2 text-sm">
          <h3 className="text-sm font-bold uppercase text-slate-500">Approval History</h3>
          {approvalRequests.slice(0, 6).map((request) => (
            <div className="grid gap-1 border-t border-line pt-2 md:grid-cols-3" key={request.id}>
              <div className="font-semibold">{approvalTypeLabel(request.type)}</div>
              <div>{humanizeEnum(request.status)}{request.requestedVisibility ? ` (${humanizeEnum(request.requestedVisibility)})` : ""}</div>
              <div className="text-slate-500">{request.requestedBy.name}</div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </section>
  );
}
