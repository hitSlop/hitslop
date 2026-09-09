import { getPublicKeyAsync, keygenAsync, signAsync } from "@noble/ed25519";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { sha256 } from "./project.ts";

export type Identity = { privateKey: string; publicKey: string; keyId: string };
type ExportFile = { version: 1; kdf: "scrypt"; salt: string; cipher: "aes-256-gcm"; iv: string; tag: string; ciphertext: string };
const service = "app.hitslop.cli"; const account = "publisher"; const fallback = join(homedir(), ".hitslop", "identity.json");
const encode = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");
const decode = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, "base64url"));

async function keychainRead(): Promise<string | null> { if (process.platform !== "darwin") return null; const result = Bun.spawnSync(["security", "find-generic-password", "-s", service, "-a", account, "-w"]); return result.exitCode === 0 ? result.stdout.toString().trim() : null; }
async function keychainWrite(value: string): Promise<boolean> { if (process.platform !== "darwin") return false; const result = Bun.spawnSync(["security", "add-generic-password", "-U", "-s", service, "-a", account, "-w", value]); return result.exitCode === 0; }
async function readStored(): Promise<Identity | null> { const value = await keychainRead() ?? await readFile(fallback, "utf8").catch(() => null); return value ? JSON.parse(value) as Identity : null; }
async function storeIdentity(identity: Identity): Promise<void> {
  const json = JSON.stringify(identity);
  if (!await keychainWrite(json)) { await mkdir(join(homedir(), ".hitslop"), { recursive: true }); await writeFile(fallback, json, { mode: 0o600 }); await chmod(fallback, 0o600); }
}

async function validated(identity: Identity): Promise<Identity> {
  const derivedPublic = await getPublicKeyAsync(decode(identity.privateKey));
  if (encode(derivedPublic) !== identity.publicKey) throw new Error("Identity public and private keys do not match.");
  if (sha256(derivedPublic).slice(0, 32) !== identity.keyId) throw new Error("Identity key ID does not match its public key.");
  return { privateKey: identity.privateKey, publicKey: identity.publicKey, keyId: identity.keyId };
}

export async function getIdentity(): Promise<Identity> {
  const stored = await readStored(); if (stored) return validated(stored);
  const pair = await keygenAsync(); const publicKey = pair.publicKey ?? await getPublicKeyAsync(pair.secretKey);
  const identity = await validated({ privateKey: encode(pair.secretKey), publicKey: encode(publicKey), keyId: sha256(publicKey).slice(0, 32) });
  await storeIdentity(identity); return identity;
}

export async function exportIdentity(path: string, passphrase: string): Promise<void> {
  if (passphrase.length < 10) throw new Error("Identity export passphrases must contain at least 10 characters.");
  const identity = await getIdentity(); const salt = randomBytes(16); const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", key, iv); const ciphertext = Buffer.concat([cipher.update(JSON.stringify(identity), "utf8"), cipher.final()]);
  const payload: ExportFile = { version: 1, kdf: "scrypt", salt: encode(salt), cipher: "aes-256-gcm", iv: encode(iv), tag: encode(cipher.getAuthTag()), ciphertext: encode(ciphertext) };
  const output = resolve(path); await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 }); await chmod(output, 0o600);
}

export async function importIdentity(path: string, passphrase: string, force = false): Promise<Identity> {
  if (await readStored() && !force) throw new Error("A publisher identity already exists. Pass --force to replace it.");
  const payload = JSON.parse(await readFile(resolve(path), "utf8")) as ExportFile;
  if (payload.version !== 1 || payload.kdf !== "scrypt" || payload.cipher !== "aes-256-gcm") throw new Error("Unsupported identity export format.");
  const key = scryptSync(passphrase, decode(payload.salt), 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv("aes-256-gcm", key, decode(payload.iv)); decipher.setAuthTag(decode(payload.tag));
  let identity: Identity;
  try { identity = JSON.parse(Buffer.concat([decipher.update(decode(payload.ciphertext)), decipher.final()]).toString("utf8")) as Identity; }
  catch { throw new Error("Could not decrypt identity; check the passphrase and file."); }
  const checked = await validated(identity); await storeIdentity(checked); return checked;
}

export const sign = async (message: Uint8Array, identity: Identity): Promise<string> => encode(await signAsync(message, decode(identity.privateKey)));
