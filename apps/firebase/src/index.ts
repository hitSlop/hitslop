import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { FirebaseRegistryBackend } from "./backend.js";
import { route } from "./router.js";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const backend = new FirebaseRegistryBackend(getFirestore(), getStorage().bucket());

export const api = onRequest({
  invoker: "public",
  memory: "1GiB",
  timeoutSeconds: 120,
}, async (request, response) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, value);
  }
  const protocol = request.get("x-forwarded-proto") ?? request.protocol ?? "https";
  const host = request.get("host") ?? "api.hitslop.com";
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : Uint8Array.from(request.rawBody ?? Buffer.alloc(0));
  const result = await route(new Request(`${protocol}://${host}${request.originalUrl}`, {
    method: request.method,
    headers,
    ...(body ? { body } : {}),
  }), backend);
  response.status(result.status);
  result.headers.forEach((value, key) => response.setHeader(key, value));
  response.send(Buffer.from(await result.arrayBuffer()));
});

export const recordCreationOptions = { invoker: "public" as const, enforceAppCheck: true };

export const recordCreation = onCall(recordCreationOptions, async (request) => {
  const templateId = typeof request.data?.templateId === "string" ? request.data.templateId : "";
  if (!templateId || templateId.length > 160) throw new HttpsError("invalid-argument", "A valid templateId is required.");
  if (!await backend.recordCreation(templateId)) throw new HttpsError("not-found", "Template not found.");
  return null;
});
