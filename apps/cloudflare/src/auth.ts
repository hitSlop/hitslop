import { createRemoteJWKSet, jwtVerify } from "jose";
import { fail, HttpError } from "./errors.ts";

export type Identity = { uid: string; name: string; email: string };

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(projectId: string) {
  const url = `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`;
  const cached = jwksCache.get(projectId);
  if (cached) return cached;
  const set = createRemoteJWKSet(new URL(url));
  jwksCache.set(projectId, set);
  return set;
}

export async function authenticate(
  request: Request,
  env: { FIREBASE_PROJECT_ID: string },
): Promise<Identity> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) fail("Sign in to continue", 401);
  try {
    const { payload } = await jwtVerify(token, jwks(env.FIREBASE_PROJECT_ID), {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
    });
    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid || uid.length > 128 || /[\x00-\x1f\x7f]/.test(uid)) fail("Unauthorized", 401);
    const name = typeof payload.name === "string" ? payload.name.slice(0, 120) : uid;
    const email = typeof payload.email === "string" ? payload.email.slice(0, 254) : "";
    return { uid, name, email };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return fail("Unauthorized", 401);
  }
}

export type Authenticate = typeof authenticate;
