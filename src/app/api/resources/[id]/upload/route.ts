import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canApproveTeamResource, canManageResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { uploadResourceFile } from "@/lib/resource-service";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await prisma.resource.findUniqueOrThrow({ where: { id: params.id } });
    if (!canManageResource(user, resource)) return jsonError("Forbidden", 403);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("File is required");
    const result = await uploadResourceFile({
      resourceId: params.id,
      file,
      versionName: String(formData.get("versionName") ?? ""),
      versionDescription: String(formData.get("versionDescription") ?? ""),
      userId: user.id,
      autoApprove: canApproveTeamResource(user, resource)
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
