import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function routeError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    if (error.message === "INVALID_FILE_TYPE") return jsonError("Invalid file type", 400);
    if (error.message === "FILE_TOO_LARGE") return jsonError("File is too large", 413);
    if (error.message === "TEAM_NAME_EXISTS") return jsonError("Team name already exists.", 409);
    if (error.message === "DUPLICATE_TEAM_MEMBER") return jsonError("User is already a member of this team.", 409);
    if (error.message === "LAST_OWNER") return jsonError("You cannot remove the last owner of this team.", 400);
    if (error.message === "MEMBER_NOT_FOUND") return jsonError("Team member not found.", 404);
    if (error.message === "CATEGORY_EXISTS") return jsonError("Category name already exists under this parent.", 409);
    if (error.message === "CIRCULAR_CATEGORY") return jsonError("Category cannot be its own parent or descendant.", 400);
    if (error.message === "CATEGORY_HAS_CHILDREN") return jsonError("Archive child categories before archiving this category.", 400);
    return jsonError(error.message, 400);
  }
  return jsonError("Unexpected error", 500);
}
