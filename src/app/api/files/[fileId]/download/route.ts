import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canViewResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveStoragePath } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: { fileId: string } }) {
  try {
    const user = await requireUser();
    const file = await prisma.resourceFile.findUnique({
      where: { id: params.fileId },
      include: { resource: true }
    });
    if (!file) return jsonError("File not found", 404);
    if (!canViewResource(user, file.resource)) return jsonError("Forbidden", 403);
    const bytes = await fs.readFile(resolveStoragePath(file.storagePath));
    await createAuditLog({
      userId: user.id,
      resourceId: file.resourceId,
      action: "FILE_DOWNLOADED",
      details: { fileId: file.id, fileName: file.originalFileName }
    });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": file.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.originalFileName.replace(/"/g, "")}"`
      }
    });
  } catch (error) {
    return routeError(error);
  }
}
