import type { FastifyRequest } from "fastify";
import type { QueryResultRow } from "pg";

import type { Db } from "./db.js";
import { forbidden } from "./errors.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type UserRow = QueryResultRow & AuthUser;

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}

function headerValue(request: FastifyRequest, key: string): string | undefined {
  const value = request.headers[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export async function resolveDevAuthUser(db: Db, request: FastifyRequest, production: boolean): Promise<AuthUser> {
  const headerEmail = headerValue(request, "x-socialops-user-email");
  const headerName = headerValue(request, "x-socialops-user-name");

  if (production && !headerEmail) {
    throw forbidden("authenticated user header missing");
  }

  const email = headerEmail?.trim().toLowerCase() || "dev@socialops.local";
  const name = headerName?.trim() || "SocialOps Dev";

  const user = await db.one<UserRow>(
    `
      INSERT INTO users (email, name)
      VALUES ($1, $2)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now()
      RETURNING id, email, name, role
    `,
    [email, name],
  );

  if (!user) {
    throw forbidden("could not resolve authenticated user");
  }
  return user;
}

export async function requireWorkspaceRole(
  db: Db,
  user: AuthUser,
  workspaceId: string,
  roles: Array<"owner" | "admin" | "editor" | "viewer">,
): Promise<void> {
  if (user.role === "admin") {
    return;
  }

  const membership = await db.one<{ role: "owner" | "admin" | "editor" | "viewer" }>(
    `
      SELECT role
      FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
    `,
    [workspaceId, user.id],
  );

  if (!membership || !roles.includes(membership.role)) {
    throw forbidden("workspace access denied");
  }
}
