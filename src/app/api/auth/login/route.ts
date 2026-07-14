import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { login, setSessionCookie } from "@/lib/auth";
import { routeError } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const user = await login(body.email, body.password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    setSessionCookie(user.id);
    await createAuditLog({ userId: user.id, action: "USER_LOGIN", details: { email: user.email } });
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return routeError(error);
  }
}
