import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  role: z.enum(["ADMIN", "CONTRIBUTOR", "VIEWER"]).default("VIEWER")
});

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true } });
    return NextResponse.json({ users });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const body = createUserSchema.parse(await request.json());
    const email = body.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return jsonError("A user with this email already exists.", 409);
    const created = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: body.role
      },
      select: { id: true, name: true, email: true, role: true }
    });
    await createAuditLog({
      userId: user.id,
      action: "USER_CREATED",
      details: { createdUserId: created.id, email: created.email, role: created.role }
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
