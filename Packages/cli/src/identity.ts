import { getPublicKeyAsync, keygenAsync, signAsync } from "@noble/ed25519";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir, userInfo } from "node:os";
import { sha256 } from "./project.ts";

type Identity = { privateKey: string; publicKey: string; keyId: string; displayName: string };
const service = "app.hitslop.cli"; const account = "publisher"; const fallback = join(homedir(), ".hitslop", "identity.json");
const encode = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");
const decode = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, "base64url"));

async function keychainRead(): Promise<string | null> { if (process.platform !== "darwin") return null; const result = Bun.spawnSync(["security", "find-generic-password", "-s", service, "-a", account, "-w"]); return result.exitCode === 0 ? result.stdout.toString().trim() : null; }
async function keychainWrite(value: string): Promise<boolean> { if (process.platform !== "darwin") return false; const result = Bun.spawnSync(["security", "add-generic-password", "-U", "-s", service, "-a", account, "-w", value]); return result.exitCode === 0; }

export async function getIdentity(displayName?: string): Promise<Identity> {
  const stored = await keychainRead() ?? await readFile(fallback, "utf8").catch(() => null); if (stored) return JSON.parse(stored) as Identity;
  const pair = await keygenAsync(); const publicKey = pair.publicKey ?? await getPublicKeyAsync(pair.secretKey); const publicEncoded = encode(publicKey);
  const identity: Identity = { privateKey: encode(pair.secretKey), publicKey: publicEncoded, keyId: sha256(publicKey).slice(0, 32), displayName: displayName || userInfo().username };
  const json = JSON.stringify(identity); if (!await keychainWrite(json)) { await mkdir(join(homedir(), ".hitslop"), { recursive: true }); await writeFile(fallback, json, { mode: 0o600 }); await chmod(fallback, 0o600); }
  return identity;
}
export const sign = async (message: Uint8Array, identity: Identity): Promise<string> => encode(await signAsync(message, decode(identity.privateKey)));
