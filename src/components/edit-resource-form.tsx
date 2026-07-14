"use client";

import { Resource } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CascadingCategorySelector } from "@/components/cascading-category-selector";
import { classifications, resourceStatuses, resourceTypes, sourceKinds, sourceProviders, storageProviders } from "@/lib/constants";

type Option = { id: string; name: string; email?: string };
type CategoryOption = { id: string; name: string; path: string; parentId: string | null; level: number };
type ResourceWithTags = Resource & { tags?: { name: string }[] };

export function EditResourceForm({
  resource,
  users,
  teams,
  categories,
  isAdmin
}: {
  resource: ResourceWithTags;
  users: Option[];
  teams: Option[];
  categories: CategoryOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-5 rounded-lg border border-line bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body: Record<string, FormDataEntryValue | null> = {
          name: form.get("name"),
          description: form.get("description"),
          resourceType: form.get("resourceType"),
          primaryCategoryId: form.get("primaryCategoryId") || null,
          classification: form.get("classification"),
          ownerUserId: form.get("ownerUserId"),
          teamId: form.get("teamId"),
          sourceProvider: form.get("sourceProvider"),
          sourceKind: form.get("sourceKind"),
          sourceUrl: form.get("sourceUrl"),
          storageProvider: form.get("storageProvider"),
          currentWorkingLocation: form.get("currentWorkingLocation"),
          tags: form.get("tags")
        };
        if (isAdmin) body.status = form.get("status");
        const response = await fetch(`/api/resources/${resource.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          setError((await response.json()).error ?? "Could not update resource");
          return;
        }
        router.push(`/resources/${resource.id}`);
        router.refresh();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label>Name<input name="name" defaultValue={resource.name} required minLength={3} maxLength={120} /></label>
        <label>Resource Type<select name="resourceType" defaultValue={resource.resourceType}>{resourceTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Classification<select name="classification" defaultValue={resource.classification}>{classifications.map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="md:col-span-2">
          <CascadingCategorySelector categories={categories} value={resource.primaryCategoryId} showManageLink />
        </div>
        <label>Owner<select name="ownerUserId" defaultValue={resource.ownerUserId}>{users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select></label>
        <label>Team<select name="teamId" defaultValue={resource.teamId}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        {isAdmin && <label>Status<select name="status" defaultValue={resource.status}>{resourceStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>}
      </div>
      <label>Description<textarea name="description" defaultValue={resource.description ?? ""} rows={3} /></label>
      <label>Tags<input name="tags" defaultValue={resource.tags?.map((tag) => tag.name).join(", ") ?? ""} /></label>
      <div className="grid gap-4 md:grid-cols-3">
        <label>Source Provider<select name="sourceProvider" defaultValue={resource.sourceProvider}>{sourceProviders.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Source Kind<select name="sourceKind" defaultValue={resource.sourceKind}>{sourceKinds.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Storage Provider<select name="storageProvider" defaultValue={resource.storageProvider}>{storageProviders.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label>Source URL<input name="sourceUrl" defaultValue={resource.sourceUrl ?? ""} /></label>
        <label>Current Working Location<input name="currentWorkingLocation" defaultValue={resource.currentWorkingLocation ?? ""} /></label>
      </div>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button className="w-fit rounded-md bg-ink px-4 py-2 font-semibold text-white">Save Changes</button>
    </form>
  );
}
