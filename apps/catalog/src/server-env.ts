import { env } from "cloudflare:workers";
export const workerEnv = (): CloudflareEnv => env as unknown as CloudflareEnv;
