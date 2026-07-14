import { Prisma, ResourceStatus, SourceProvider, TransferStatus } from "@prisma/client";
import { visibleResourceWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getStorageStatus } from "@/lib/resource-metadata";
import { getCategoryDescendantIds } from "@/lib/taxonomy";

type UserWithTeams = {
  id: string;
  role: "ADMIN" | "CONTRIBUTOR" | "VIEWER";
  teamMembers: { teamId: string }[];
};

const sortableFields = new Set(["name", "resourceType", "sourceProvider", "status", "classification", "createdAt", "updatedAt"]);

function value(params: URLSearchParams, camel: string, snake?: string) {
  return params.get(camel) ?? (snake ? params.get(snake) : null);
}

export async function buildResourceWhere(params: URLSearchParams, user: UserWithTeams) {
  const filters: Prisma.ResourceWhereInput[] = [visibleResourceWhere(user)];
  const includeArchived = params.get("include_archived") === "true" || params.get("includeArchived") === "true";
  if (!includeArchived) filters.push({ archivedAt: null });

  const search = params.get("search");
  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { some: { name: { contains: search.toLowerCase(), mode: "insensitive" } } } }
      ]
    });
  }

  const direct: Array<[string, keyof Prisma.ResourceWhereInput]> = [
    ["resource_type", "resourceType"],
    ["resourceType", "resourceType"],
    ["source_provider", "sourceProvider"],
    ["sourceProvider", "sourceProvider"],
    ["source_kind", "sourceKind"],
    ["sourceKind", "sourceKind"],
    ["storage_provider", "storageProvider"],
    ["storageProvider", "storageProvider"],
    ["status", "status"],
    ["classification", "classification"],
    ["team_id", "teamId"],
    ["teamId", "teamId"],
    ["project_id", "projectId"],
    ["projectId", "projectId"],
    ["owner_user_id", "ownerUserId"],
    ["ownerUserId", "ownerUserId"],
    ["created_by_id", "createdById"],
    ["createdById", "createdById"]
  ];
  for (const [param, field] of direct) {
    const current = params.get(param);
    if (current) filters.push({ [field]: current });
  }

  const categoryIds = params.get("category_ids")?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  const legacyCategoryId =
    params.get("category_level_3_id") ??
    params.get("category_level_2_id") ??
    params.get("category_level_1_id") ??
    params.get("category_id");
  const selectedCategoryIds = categoryIds.length ? categoryIds : legacyCategoryId ? [legacyCategoryId] : [];
  if (selectedCategoryIds.length) {
    const exactOnly = params.get("category_level_3_id") || params.get("include_category_descendants") === "false";
    const ids = exactOnly
      ? selectedCategoryIds
      : Array.from(new Set((await Promise.all(selectedCategoryIds.map((id) => getCategoryDescendantIds(id)))).flat()));
    filters.push({ primaryCategoryId: { in: ids } });
  }

  const latestTransferStatus = params.get("latest_transfer_status");
  if (latestTransferStatus) {
    filters.push({ transferJobs: { some: { status: latestTransferStatus as TransferStatus } } });
  }
  const hasFiles = params.get("has_files");
  if (hasFiles === "true") filters.push({ files: { some: {} } });
  if (hasFiles === "false") filters.push({ files: { none: {} } });
  const hasExternalLink = params.get("has_external_link");
  if (hasExternalLink === "true") filters.push({ OR: [{ sourceUrl: { not: null } }, { currentWorkingLocation: { not: null } }] });
  if (hasExternalLink === "false") filters.push({ sourceUrl: null, currentWorkingLocation: null });
  const tag = params.get("tag");
  if (tag) filters.push({ tags: { some: { name: tag.toLowerCase() } } });

  const createdFrom = params.get("created_from");
  const createdTo = params.get("created_to");
  const updatedFrom = params.get("updated_from");
  const updatedTo = params.get("updated_to");
  if (createdFrom || createdTo) filters.push({ createdAt: { gte: createdFrom ? new Date(createdFrom) : undefined, lte: createdTo ? new Date(createdTo) : undefined } });
  if (updatedFrom || updatedTo) filters.push({ updatedAt: { gte: updatedFrom ? new Date(updatedFrom) : undefined, lte: updatedTo ? new Date(updatedTo) : undefined } });

  return { AND: filters };
}

export function parsePagination(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = [10, 20, 50, 100].includes(Number(params.get("page_size"))) ? Number(params.get("page_size")) : 20;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function parseOrderBy(params: URLSearchParams): Prisma.ResourceOrderByWithRelationInput {
  const sortBy = params.get("sort_by") ?? "updatedAt";
  const sortDirection = params.get("sort_direction") === "asc" ? "asc" : "desc";
  if (sortBy === "team") return { team: { name: sortDirection } };
  if (sortBy === "owner") return { owner: { name: sortDirection } };
  const field = sortBy.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  return sortableFields.has(field) ? { [field]: sortDirection } : { updatedAt: "desc" };
}

export async function getResourceList(params: URLSearchParams, user: UserWithTeams) {
  const where = await buildResourceWhere(params, user);
  const { page, pageSize, skip } = parsePagination(params);
  const orderBy = parseOrderBy(params);
  const include = {
    owner: true,
    team: true,
    project: true,
    contributedByTeam: true,
    createdBy: true,
    primaryCategory: { include: { parent: { include: { parent: true } } } },
    versions: { orderBy: { versionNumber: "desc" as const }, take: 1 },
    files: { select: { id: true } },
    tags: true,
    transferJobs: { orderBy: { createdAt: "desc" as const }, take: 1 }
  };
  const [allMatching, total] = await Promise.all([
    prisma.resource.findMany({ where, include }),
    prisma.resource.count({ where })
  ]);
  let data = allMatching;
  const storageStatus = params.get("storage_status");
  if (storageStatus) data = data.filter((resource) => getStorageStatus(resource) === storageStatus);
  const paged = data.slice(skip, skip + pageSize);
  const summaryBase = data;
  const summary = {
    total_resources: summaryBase.length,
    stored_resources: summaryBase.filter((resource) => resource.status === ResourceStatus.STORED).length,
    pending_transfers: summaryBase.filter((resource) => resource.transferJobs[0]?.status === "PENDING").length,
    failed_transfers: summaryBase.filter((resource) => resource.transferJobs[0]?.status === "FAILED" || resource.status === "FAILED").length,
    restricted_resources: summaryBase.filter((resource) => resource.classification === "RESTRICTED").length,
    external_only_resources: summaryBase.filter((resource) => getStorageStatus(resource) === "EXTERNAL_ONLY").length,
    direct_upload_resources: summaryBase.filter((resource) => resource.sourceProvider === SourceProvider.DIRECT_UPLOAD).length,
    github_resources: summaryBase.filter((resource) => resource.sourceProvider === SourceProvider.GITHUB).length,
    huggingface_resources: summaryBase.filter((resource) => resource.sourceProvider === SourceProvider.HUGGINGFACE).length,
    google_drive_resources: summaryBase.filter((resource) => resource.sourceProvider === SourceProvider.GOOGLE_DRIVE).length
  };
  return {
    data: paged,
    pagination: {
      page,
      page_size: pageSize,
      total: storageStatus ? data.length : total,
      total_pages: Math.max(1, Math.ceil((storageStatus ? data.length : total) / pageSize))
    },
    summary
  };
}
