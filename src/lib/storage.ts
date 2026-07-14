import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { ResourceType } from "@prisma/client";
import { allowedExtensions } from "@/lib/constants";

const pluralType: Record<ResourceType, string> = {
  DATASET: "datasets",
  CODE: "code",
  MODEL: "models",
  DOCUMENT: "documents",
  ANNOTATION: "annotations",
  NOTEBOOK: "notebooks",
  REPORT: "reports",
  APPLICATION: "applications",
  OTHER: "other"
};

export function getStorageRoot() {
  return process.env.RESOURCE_STORAGE_ROOT ?? "./resource-hub-storage";
}

export function generateResourceSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}

export function sanitizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const base = parsed.name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "uploaded_file";
  const ext = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${base}${ext}`;
}

export function validateFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return allowedExtensions.has(ext);
}

export function generateStoragePath(resourceType: ResourceType, slug: string, versionNumber: number, fileName: string) {
  return path.posix.join(pluralType[resourceType], slug, `v${versionNumber}`, sanitizeFileName(fileName));
}

export function resolveStoragePath(storagePath: string) {
  const root = path.resolve(getStorageRoot());
  const resolved = path.resolve(root, storagePath);
  if (!resolved.startsWith(root)) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

export async function saveUploadedFile(file: File, storagePath: string) {
  const absolutePath = resolveStoragePath(storagePath);
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  const arrayBuffer = await file.arrayBuffer();
  await fs.promises.writeFile(absolutePath, Buffer.from(arrayBuffer));
  return absolutePath;
}

export async function calculateSha256(filePath: string) {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

export async function getFileMetadata(filePath: string) {
  const stats = await fs.promises.stat(filePath);
  return {
    size: stats.size,
    extension: path.extname(filePath).replace(".", "").toLowerCase()
  };
}

export async function deleteFile(storagePath: string) {
  await fs.promises.rm(resolveStoragePath(storagePath), { force: true });
}

export function getDownloadStream(storagePath: string) {
  return fs.createReadStream(resolveStoragePath(storagePath));
}
