import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassificationBadge, StatusBadge } from "@/components/badge";
import { CategoryTreeMultiSelect, type CategoryTreeNode } from "@/components/category-tree-multi-select";
import { GenericBadge } from "@/components/generic-badge";
import { PageShell } from "@/components/page-shell";
import { ResourceBulkBar, SelectAllResources } from "@/components/resources-ux";
import { getCurrentUser } from "@/lib/auth";
import { classifications, resourceStatuses, resourceTypes, sourceKinds, sourceProviders, storageProviders, storageStatuses } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getStorageStatus, getWorkflowState, humanizeEnum, storageStatusClass, storageStatusLabel, workflowStateClass, workflowStateLabel } from "@/lib/resource-metadata";
import { getResourceList } from "@/lib/resource-query";
import { visibleProjectWhere } from "@/lib/project-service";
import { prisma } from "@/lib/prisma";
import { categoryPath, flattenCategoryTree, getCategoryTree } from "@/lib/taxonomy";

function queryString(searchParams: Record<string, string | undefined>, patch: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams)) if (val) params.set(key, val);
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined || val === "") params.delete(key);
    else params.set(key, String(val));
  }
  return params.toString();
}

function hasActiveFilters(searchParams: Record<string, string | undefined>) {
  return Object.entries(searchParams).some(([key, value]) => Boolean(value) && key !== "page" && key !== "page_size" && key !== "sort_by" && key !== "sort_direction");
}

function removeFilterHref(searchParams: Record<string, string | undefined>, key: string) {
  return `/resources?${queryString(searchParams, { [key]: undefined, page: 1 })}`;
}

function categoryTreeForSelect(nodes: any[], parentPath = ""): CategoryTreeNode[] {
  return nodes.map((node) => {
    const path = parentPath ? `${parentPath} / ${node.name}` : node.name;
    return { id: node.id, name: node.name, path, children: categoryTreeForSelect(node.children, path) };
  });
}

export default async function ResourcesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams)) if (val) params.set(key, val);
  const [result, teams, projects, users, categoryTree] = await Promise.all([
    getResourceList(params, user),
    prisma.team.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: visibleProjectWhere(user), orderBy: { name: "asc" }, include: { team: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    getCategoryTree()
  ]);
  const categories = flattenCategoryTree(categoryTree).map((category) => ({ id: category.id, name: category.name, path: category.path, parentId: category.parentId, level: category.level }));
  const categoryPathById = new Map(categories.map((category) => [category.id, category.path]));
  const categoryFilterTree = categoryTreeForSelect(categoryTree);
  const selectedCategoryIds = searchParams.category_ids?.split(",").filter(Boolean) ?? (searchParams.category_id ? [searchParams.category_id] : []);
  const needTransfer = result.summary.external_only_resources + result.summary.pending_transfers;
  const summaryCards = [
    ["Total Resources", result.summary.total_resources, "All visible resource records"],
    ["Officially Stored", result.summary.stored_resources, "Stored or with an official copy"],
    ["Needs Review", needTransfer, "Source-only or pending storage review"],
    ["Failed", result.summary.failed_transfers, "Failed resource or transfer"],
    ["Restricted", result.summary.restricted_resources, "Restricted classification"]
  ];
  const providerChips = [
    ["DIRECT_UPLOAD", "Direct Upload", result.summary.direct_upload_resources],
    ["GITHUB", "GitHub", result.summary.github_resources],
    ["HUGGINGFACE", "Hugging Face", result.summary.huggingface_resources],
    ["GOOGLE_DRIVE", "Google Drive", result.summary.google_drive_resources],
    ["MANUAL", "Manual", result.data.filter((resource) => resource.sourceProvider === "MANUAL").length]
  ];
  const uncategorizedCount = result.data.filter((resource) => !resource.primaryCategoryId).length;
  const activeFilters = Object.entries(searchParams).filter(([key, value]) => Boolean(value) && key !== "page");

  return (
    <PageShell
      title="Resources"
      description="Find, review, and manage submitted resources across project, team, source, storage, and approval state."
      actions={
        <div className="flex flex-wrap gap-2">
          {user.role === "ADMIN" && <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href="/admin/categories">Manage Categories</Link>}
          {(user.role === "ADMIN" || user.role === "CONTRIBUTOR") && <Link className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/resources/new">Create Resource</Link>}
        </div>
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        {summaryCards.map(([label, value, description]) => (
          <div key={label} className="surface rounded-lg p-4">
            <div className="muted-label">{label}</div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{description}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {providerChips.map(([provider, label, count]) => (
          <Link key={provider} className="rounded-full border border-line bg-white px-3 py-1 text-sm hover:bg-panel" href={`/resources?${queryString(searchParams, { source_provider: provider as string, page: 1 })}`}>
            {label}: {count}
          </Link>
        ))}
      </div>

      {uncategorizedCount > 0 && user.role === "ADMIN" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {uncategorizedCount} resources are uncategorized. Add categories to improve search and governance.
        </div>
      )}

      <form className="surface mb-3 grid gap-3 rounded-lg p-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <label className="text-xs font-semibold uppercase text-slate-500">Search<input name="search" placeholder="Search resources..." defaultValue={searchParams.search} /></label>
        <label className="text-xs font-semibold uppercase text-slate-500">Type<select name="resource_type" defaultValue={searchParams.resource_type ?? searchParams.resourceType ?? ""}><option value="">All types</option>{resourceTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase text-slate-500">Status<select name="status" defaultValue={searchParams.status ?? ""}><option value="">All statuses</option>{resourceStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase text-slate-500">Team<select name="team_id" defaultValue={searchParams.team_id ?? searchParams.teamId ?? ""}><option value="">All teams</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <div className="flex items-end gap-2">
          <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">Apply</button>
          {hasActiveFilters(searchParams) && <Link className="rounded-md border border-line px-4 py-2 text-sm font-semibold" href="/resources">Clear</Link>}
        </div>
        <details className="lg:col-span-5">
          <summary className="cursor-pointer rounded-md border border-line px-3 py-2 text-sm font-semibold">More Filters</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <div className="md:col-span-3 xl:col-span-4">
              <CategoryTreeMultiSelect tree={categoryFilterTree} selectedCategoryIds={selectedCategoryIds} includeDescendants={searchParams.include_category_descendants !== "false"} />
            </div>
            <label>Source provider<select name="source_provider" defaultValue={searchParams.source_provider ?? ""}><option value="">All source providers</option>{sourceProviders.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Source kind<select name="source_kind" defaultValue={searchParams.source_kind ?? ""}><option value="">All source kinds</option>{sourceKinds.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Storage provider<select name="storage_provider" defaultValue={searchParams.storage_provider ?? ""}><option value="">All storage providers</option>{storageProviders.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Storage status<select name="storage_status" defaultValue={searchParams.storage_status ?? ""}><option value="">All storage statuses</option>{storageStatuses.map((value) => <option key={value}>{storageStatusLabel(value)}</option>)}</select></label>
            <label>Classification<select name="classification" defaultValue={searchParams.classification ?? ""}><option value="">All classifications</option>{classifications.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Project<select name="project_id" defaultValue={searchParams.project_id ?? ""}><option value="">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} - {project.team.name}</option>)}</select></label>
            <label>Owner<select name="owner_user_id" defaultValue={searchParams.owner_user_id ?? ""}><option value="">All owners</option>{users.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
            <label>Created by<select name="created_by_id" defaultValue={searchParams.created_by_id ?? ""}><option value="">All creators</option>{users.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}</select></label>
            <label>Latest transfer<select name="latest_transfer_status" defaultValue={searchParams.latest_transfer_status ?? ""}><option value="">Any transfer</option><option>PENDING</option><option>RUNNING</option><option>COMPLETED</option><option>FAILED</option></select></label>
            <label>Files<select name="has_files" defaultValue={searchParams.has_files ?? ""}><option value="">Any files</option><option value="true">Has files</option><option value="false">No files</option></select></label>
            <label>External link<select name="has_external_link" defaultValue={searchParams.has_external_link ?? ""}><option value="">Any source</option><option value="true">Has external/source URL</option><option value="false">No external/source URL</option></select></label>
            <label>Tag<input name="tag" placeholder="Tag" defaultValue={searchParams.tag} /></label>
            <label>Created from<input name="created_from" type="date" defaultValue={searchParams.created_from} /></label>
            <label>Created to<input name="created_to" type="date" defaultValue={searchParams.created_to} /></label>
            <label>Updated from<input name="updated_from" type="date" defaultValue={searchParams.updated_from} /></label>
            <label>Updated to<input name="updated_to" type="date" defaultValue={searchParams.updated_to} /></label>
            <label>Sort<select name="sort_by" defaultValue={searchParams.sort_by ?? "updated_at"}><option value="updated_at">Updated</option><option value="created_at">Created</option><option value="name">Name</option><option value="resource_type">Type</option><option value="source_provider">Source Provider</option><option value="status">Status</option><option value="classification">Classification</option><option value="team">Team</option><option value="owner">Owner</option></select></label>
            <label>Direction<select name="sort_direction" defaultValue={searchParams.sort_direction ?? "desc"}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
            <label>Page size<select name="page_size" defaultValue={searchParams.page_size ?? "20"}><option>10</option><option>20</option><option>50</option><option>100</option></select></label>
            <label className="flex items-center gap-2 pt-6"><input className="w-auto" name="include_archived" type="checkbox" value="true" defaultChecked={searchParams.include_archived === "true"} /> Include archived</label>
          </div>
        </details>
      </form>

      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Active filters:</span>
          {activeFilters.map(([key, value]) => (
            <Link key={key} className="rounded-full border border-line bg-white px-3 py-1" href={removeFilterHref(searchParams, key)}>
              {key === "category_ids"
                ? `Category: ${String(value).split(",").map((id) => categoryPathById.get(id) ?? id).join(", ")} x`
                : `${humanizeEnum(key)}: ${value} x`}
            </Link>
          ))}
          <Link className="rounded-full border border-line px-3 py-1 font-semibold" href="/resources">Clear all</Link>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-line">
        <Link className="px-3 py-2 text-sm font-semibold" href="/resources">All</Link>
        <Link className="px-3 py-2 text-sm font-semibold" href={`/resources?${queryString(searchParams, { storage_status: "HAS_OFFICIAL_COPY", page: 1 })}`}>Stored</Link>
        <Link className="px-3 py-2 text-sm font-semibold" href={`/resources?${queryString(searchParams, { storage_status: "EXTERNAL_ONLY", page: 1 })}`}>Needs Review</Link>
        <Link className="px-3 py-2 text-sm font-semibold" href={`/resources?${queryString(searchParams, { status: "FAILED", page: 1 })}`}>Failed</Link>
        <Link className="px-3 py-2 text-sm font-semibold" href={`/resources?${queryString(searchParams, { classification: "RESTRICTED", page: 1 })}`}>Restricted</Link>
        {user.role === "ADMIN" && <Link className="px-3 py-2 text-sm font-semibold" href={`/resources?${queryString(searchParams, { include_archived: "true", status: "ARCHIVED", page: 1 })}`}>Archived</Link>}
      </div>

      {user.role === "ADMIN" && <ResourceBulkBar teams={teams} categories={categories} />}

      <div className="surface hidden overflow-x-auto rounded-lg lg:block">
        <table className="data-table min-w-[1120px]">
          <thead>
            <tr>
              {user.role === "ADMIN" && <th className="w-12 px-4 py-3"><SelectAllResources /></th>}
              <th className="px-4 py-3">Resource</th><th>Category</th><th>Source</th><th>Storage</th><th>Status</th><th>Owner / Team</th><th>Updated</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((resource) => {
              const storageStatus = getStorageStatus(resource);
              const workflowState = getWorkflowState(resource);
              const path = categoryPath(resource.primaryCategory);
              return (
                <tr key={resource.id} className="border-t border-line align-top">
                  {user.role === "ADMIN" && <td className="px-4 py-4"><input aria-label={`Select ${resource.name}`} className="w-auto" name="resourceSelection" type="checkbox" value={resource.id} /></td>}
                  <td className="px-4 py-4">
                    <Link className="font-semibold hover:underline" href={`/resources/${resource.id}`}>{resource.name}</Link>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <GenericBadge value={resource.resourceType} />
                      <GenericBadge value={workflowStateLabel(workflowState)} className={workflowStateClass(workflowState)} humanize={false} />
                      <GenericBadge value={resource.visibility} />
                      {["CONFIDENTIAL", "RESTRICTED"].includes(resource.classification) && <ClassificationBadge value={resource.classification} />}
                    </div>
                    {resource.tags.length > 0 && <div className="mt-2 text-xs text-slate-500">Tags: {resource.tags.slice(0, 3).map((tag) => tag.name).join(", ")}</div>}
                  </td>
                  <td className="px-4 py-4">{path === "-" ? <div className="grid gap-2"><span className="w-fit rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Uncategorized</span>{user.role === "ADMIN" && <Link className="text-xs font-semibold text-blue-700" href={`/resources/${resource.id}/edit`}>Set category</Link>}</div> : <span className="text-sm" title={path}>{path}</span>}</td>
                  <td className="px-4 py-4"><div className="font-semibold">{humanizeEnum(resource.sourceProvider)}</div><div className="text-xs text-slate-500">{humanizeEnum(resource.sourceKind)}</div></td>
                  <td className="px-4 py-4"><GenericBadge value={storageStatusLabel(storageStatus)} className={storageStatusClass(storageStatus)} humanize={false} /><div className="mt-1 text-xs text-slate-500">{humanizeEnum(resource.storageProvider)}</div></td>
                  <td className="px-4 py-4"><StatusBadge value={resource.status} /></td>
                  <td className="px-4 py-4"><div className="font-semibold">{resource.project ? <Link className="hover:underline" href={`/projects/${resource.project.id}`}>{resource.project.name}</Link> : resource.team.name}</div><div className="text-xs text-slate-500">Team: {resource.team.name}</div><div className="text-xs text-slate-500">Owner: {resource.owner.name}</div></td>
                  <td className="px-4 py-4">{formatDate(resource.updatedAt)}</td>
                  <td className="px-4 py-4"><Link className="font-semibold text-blue-700" href={`/resources/${resource.id}`}>View</Link><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-slate-600">More</summary><div className="mt-2 grid gap-1"><Link href={`/resources/${resource.id}/edit`}>Edit</Link><Link href={`/resources/${resource.id}#upload`}>Upload version</Link><Link href={`/resources/${resource.id}#external`}>Register link</Link></div></details></td>
                </tr>
              );
            })}
            {!result.data.length && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>{hasActiveFilters(searchParams) ? "No resources match your filters. Try clearing filters or changing the search keyword." : "No resources yet. Create your first resource by uploading a file or registering an external source."}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {result.data.map((resource) => {
          const storageStatus = getStorageStatus(resource);
          const workflowState = getWorkflowState(resource);
          const path = categoryPath(resource.primaryCategory);
          return (
            <div key={resource.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div><Link className="font-semibold" href={`/resources/${resource.id}`}>{resource.name}</Link><div className="mt-2 flex flex-wrap gap-1"><GenericBadge value={resource.resourceType} /><GenericBadge value={workflowStateLabel(workflowState)} className={workflowStateClass(workflowState)} humanize={false} /><StatusBadge value={resource.status} /></div></div>
                {user.role === "ADMIN" && <input aria-label={`Select ${resource.name}`} className="w-auto" name="resourceSelection" type="checkbox" value={resource.id} />}
              </div>
              <div className="mt-3 text-sm">{path === "-" ? <div className="grid gap-1"><span className="text-amber-800">Uncategorized</span>{user.role === "ADMIN" && <Link className="text-xs font-semibold text-blue-700" href={`/resources/${resource.id}/edit`}>Set category</Link>}</div> : path}</div>
              <div className="mt-3 grid gap-2 text-sm"><div>{humanizeEnum(resource.sourceProvider)} / {humanizeEnum(resource.sourceKind)}</div><div><GenericBadge value={storageStatusLabel(storageStatus)} className={storageStatusClass(storageStatus)} humanize={false} /></div><div>{resource.project ? `Project: ${resource.project.name}` : resource.team.name} - Owner: {resource.owner.name}</div><div className="text-slate-500">{formatDate(resource.updatedAt)}</div></div>
              <Link className="mt-4 inline-flex rounded-md border border-line px-3 py-2 text-sm font-semibold" href={`/resources/${resource.id}`}>View</Link>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div>Page {result.pagination.page} of {result.pagination.total_pages} - {result.pagination.total} resources</div>
        <div className="flex gap-2">
          <Link className="rounded-md border border-line px-3 py-2" href={`/resources?${queryString(searchParams, { page: Math.max(1, result.pagination.page - 1) })}`}>Previous</Link>
          <Link className="rounded-md border border-line px-3 py-2" href={`/resources?${queryString(searchParams, { page: Math.min(result.pagination.total_pages, result.pagination.page + 1) })}`}>Next</Link>
        </div>
      </div>
    </PageShell>
  );
}
