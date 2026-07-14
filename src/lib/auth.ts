import crypto from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const cookieName = "resourcehub_session";

function secret() {
  return process.env.SESSION_SECRET ?? "resource-hub-dev-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, createdAt: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string };
    return parsed.userId;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export function setSessionCookie(userId: string) {
  cookies().set(cookieName, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie() {
  cookies().delete(cookieName);
}

export async function getCurrentUser() {
  const userId = readSessionToken(cookies().get(cookieName)?.value);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: { teamMembers: true }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
