import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canCreateResource } from "@/lib/permissions";
import { getResourceList } from "@/lib/resource-query";
import { createResourceWithOptionalLink } from "@/lib/resource-service";

const createSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().optional(),
  ownerUserId: z.string().min(1),
  teamId: z.string().min(1),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  hasUpload: z.literal(true)
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    searchParams.set("resource_type", "DOCUMENT");
    const result = await getResourceList(searchParams, user);
    return NextResponse.json({ resources: result.data, ...result });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canCreateResource(user)) return jsonError("Forbidden", 403);
    const body = createSchema.parse(await request.json());
    const userTeamIds = user.teamMembers.map((member) => member.teamId);
    if (user.role !== "ADMIN" && !userTeamIds.includes(body.teamId)) {
      return jsonError("You can only upload documents for your team", 403);
    }

    const resource = await createResourceWithOptionalLink({
      name: body.name,
      description: body.description,
      resourceType: "DOCUMENT",
      classification: "INTERNAL",
      ownerUserId: user.role === "ADMIN" ? body.ownerUserId : user.id,
      teamId: body.teamId,
      sourceProvider: "DIRECT_UPLOAD",
      sourceKind: "FILE",
      storageProvider: "LOCAL",
      sourceAccessGranted: true,
      tags: body.tags,
      createdById: user.id
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
