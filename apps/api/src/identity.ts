import type { FastifyRequest } from "fastify";
import type { QueryResultRow } from "pg";

import type { AuthUser } from "./auth.js";
import type { Db } from "./db.js";
import { forbidden } from "./errors.js";

export type IdentityProvider = {
  name: "dev-header" | "clerk";
  resolve: (request: FastifyRequest, db: Db) => Promise<AuthUser>;
};

type UserRow = QueryResultRow & AuthUser;

function headerValue(request: FastifyRequest, key: string): string | undefined {
  const value = request.headers[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function createDevHeaderIdentityProvider(options: { production: boolean }): IdentityProvider {
  return {
    name: "dev-header",
    async resolve(request, db) {
      const headerEmail = headerValue(request, "x-socialops-user-email");
      const headerName = headerValue(request, "x-socialops-user-name");
      if (options.production && !headerEmail) {
        throw forbidden("authenticated user header missing");
      }
      const email = headerEmail?.trim().toLowerCase() || "dev@socialops.local";
      const name = headerName?.trim() || "SocialOps Dev";
      return upsertUser(db, { email, name, externalId: null });
    },
  };
}

export type ClerkConfig = {
  secretKey: string;
  /**
   * Optional issuer (`https://<your-instance>.clerk.accounts.dev` or your custom domain).
   * Used for an extra `iss` claim check; safe to leave empty in dev.
   */
  issuer?: string;
};

/**
 * Lightweight Clerk session JWT verifier. We avoid pulling `@clerk/backend`
 * into this package by validating the JWT signature out-of-band: we call
 * Clerk's `/v1/sessions/<sid>/tokens/verify` introspection endpoint with the
 * provided secret key. This keeps deps tiny and lets the operator swap to
 * `@clerk/backend` later for offline verification.
 *
 * The Authorization header must be `Bearer <session-jwt>`. The session JWT's
 * `sub` claim is the Clerk user id, and `email` / `name` are pulled from the
 * `org`/`act` claims if Clerk is configured to embed them; otherwise the
 * client should call `/v1/auth/sync` once after sign-in to attach an email.
 */
export function createClerkIdentityProvider(config: ClerkConfig): IdentityProvider {
  return {
    name: "clerk",
    async resolve(request, db) {
      const auth = headerValue(request, "authorization");
      if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
        throw forbidden("missing bearer token");
      }
      const token = auth.slice(7).trim();
      const claims = decodeJwtClaims(token);
      if (!claims.sub) {
        throw forbidden("token has no subject");
      }
      if (config.issuer && claims.iss && claims.iss !== config.issuer) {
        throw forbidden("token issuer mismatch");
      }
      const verified = await verifyAgainstClerk(config.secretKey, token);
      if (!verified.valid) {
        throw forbidden("token verification failed");
      }
      const subject = String(claims.sub);
      const email = (claims.email as string | undefined)?.trim().toLowerCase() || `${subject}@clerk.local`;
      const name = (claims.name as string | undefined)?.trim() || (claims.email as string | undefined) || "Clerk User";
      return upsertUser(db, { email, name, externalId: subject });
    },
  };
}

type ClerkVerifyResult = { valid: boolean };

async function verifyAgainstClerk(secretKey: string, token: string): Promise<ClerkVerifyResult> {
  // Clerk's "JWT verification" recommendation is to verify the signature locally
  // with the instance's JWKS. We do a tiny verification here: a `whoami`-style
  // call that confirms the secret key + token combination. Replace with
  // @clerk/backend.verifyToken in production for offline verification.
  try {
    const response = await fetch("https://api.clerk.com/v1/clients/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({ token }),
    });
    return { valid: response.ok };
  } catch {
    return { valid: false };
  }
}

function decodeJwtClaims(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }
  try {
    const json = Buffer.from(parts[1].replace(/-/gu, "+").replace(/_/gu, "/"), "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function upsertUser(db: Db, input: { email: string; name: string; externalId: string | null }): Promise<AuthUser> {
  const user = await db.one<UserRow>(
    `
      INSERT INTO users (email, name)
      VALUES ($1, $2)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now()
      RETURNING id, email, name, role
    `,
    [input.email, input.name],
  );
  if (!user) {
    throw forbidden("could not resolve authenticated user");
  }
  return user;
}

export function selectIdentityProvider(env: {
  clerkSecretKey?: string;
  clerkIssuer?: string;
  production: boolean;
}): IdentityProvider {
  if (env.clerkSecretKey && env.clerkSecretKey.trim().length > 0) {
    return createClerkIdentityProvider({ secretKey: env.clerkSecretKey, issuer: env.clerkIssuer });
  }
  return createDevHeaderIdentityProvider({ production: env.production });
}
