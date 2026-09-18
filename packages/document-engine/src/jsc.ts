// Trusted host adapter. All arbitrary application JSON stays inside this engine.
import type { TSchema } from "typebox";
import {
  applicationSchema,
  checkDocumentSchema,
  prepareDocument,
  documentMeta,
  documentMapping,
  recordValueSchema,
  traced,
  type DocumentTrace,
} from "@hitslop/schema/document";
import { assertJSON, utf8Length } from "@hitslop/schema/json";
import { validate, prepareValidation, validationDiagnostics } from "@hitslop/schema/validation";
import { SlopManifestSchema } from "@hitslop/schema/manifest";
import { BridgeRequestSchema } from "@hitslop/schema/bridge";
import {
  canonical,
  RequestSchema,
  SnapshotSchema,
  OpenSchema,
  ResultSchema,
  type Snapshot,
  type Request,
  failure,
} from "@hitslop/schema/document-protocol";
import { RoomMessageSchema, RoomClientMessageSchema, RoomSeedSchema } from "@hitslop/schema/room";
import { applyOps, executeCommand, type AuthorityInput, type Evaluation } from "./index.js";

const parse = (json: string) => JSON.parse(json);
const stringify = (value: unknown) => JSON.stringify(value);
// Swift String equality normalizes Unicode. ASCII JSON tokens preserve exact JS keys.
const token = (value: unknown) =>
  stringify(value).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
const identity = (value: { documentId: string; schemaHash: string; authority: string }) => ({
  documentId: value.documentId,
  schemaHash: value.schemaHash,
  authority: token(value.authority),
});
const snapshotView = (value: Snapshot) => ({
  json: stringify(value),
  ...identity(value),
  revision: value.revision,
  data: stringify(value.data),
});
const leaseView = (value: { id: string; expiresAt: number }) => ({
  json: stringify(value),
  key: token(value.id),
  expiresAt: value.expiresAt,
});
const resultView = (value: unknown) => {
  const result = validate(ResultSchema, value);
  // Native UI messages may replace lone surrogates; wire/application JSON stays exact.
  return {
    ...result,
    ...(!result.ok
      ? {
          error: {
            ...result.error,
            message: Array.from(result.error.message, (c) =>
              c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff
                ? "\ufffd"
                : c,
            ).join(""),
          },
        }
      : {}),
    json: stringify(value),
  };
};
const boundedData = (value: unknown) => {
  assertJSON(value, new Set(), 64);
  if (utf8Length(stringify(value)) > 1048576) throw new Error("Document exceeds 1 MiB");
};
const openingView = (value: unknown) => {
  const open = validate(OpenSchema, value);
  boundedData(open.snapshot.data);
  return {
    json: stringify(open),
    snapshot: snapshotView(open.snapshot as Snapshot),
    lease: leaseView(open.lease),
  };
};
function hashes(value: unknown, schema: any, found = new Set<string>()): Set<string> {
  const meta = documentMeta(schema);
  if (
    meta?.media &&
    value &&
    typeof value === "object" &&
    "sha256" in value &&
    typeof value.sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(value.sha256)
  )
    found.add(value.sha256);
  if (Array.isArray(value) && schema.items)
    for (const child of value) hashes(child, schema.items, found);
  else if (value && typeof value === "object") {
    if (meta?.container === "record")
      for (const child of Object.values(value)) hashes(child, recordValueSchema(schema), found);
    else
      for (const [key, childSchema] of Object.entries(schema.properties ?? {}))
        if (Object.hasOwn(value, key))
          hashes((value as Record<string, unknown>)[key], childSchema as TSchema, found);
  }
  return found;
}
export function createNativeEngine(trace?: DocumentTrace) {
  let schema: TSchema | undefined;
  let schemaSource: string | undefined;
  const requireSchema = () => {
    if (!schema) throw new Error("Document schema is not registered");
    return schema;
  };
  const methods = {
    diagnostics: validationDiagnostics,
    configure(json: string) {
      if (json === schemaSource) return true;
      const candidate = parse(json);
      checkDocumentSchema(candidate);
      documentMapping(candidate);
      prepareValidation(candidate);
      schema = candidate;
      schemaSource = json;
      return true;
    },
    manifest(json: string) {
      validate(SlopManifestSchema, parse(json));
      return true;
    },
    applicationSchema(json: string) {
      const value = parse(json);
      checkDocumentSchema(value);
      return stringify(applicationSchema(value));
    },
    packageData(envelopeJSON: string, json: string) {
      const envelope = parse(envelopeJSON);
      checkDocumentSchema(envelope);
      prepareDocument(applicationSchema(envelope), parse(json));
      return true;
    },
    applyData(json: string, opsJSON: string) {
      return applyOps(requireSchema(), parse(json), parse(opsJSON)).json;
    },
    validateData(json: string) {
      return prepareDocument(requireSchema(), parse(json)).json;
    },
    snapshot(json: string) {
      const value = validate(SnapshotSchema, parse(json));
      prepareDocument(requireSchema(), value.data);
      return snapshotView(value as Snapshot);
    },
    frameSnapshot(json: string) {
      const value = validate(SnapshotSchema, parse(json));
      boundedData(value.data);
      return snapshotView(value as Snapshot);
    },
    initial(dataJSON: string, documentId: string, schemaHash: string, authority: string) {
      const data = prepareDocument(requireSchema(), parse(dataJSON)).data;
      return snapshotView({ documentId, schemaHash, authority, revision: 0, data } as Snapshot);
    },
    promote(snapshotJSON: string, authority: string) {
      return snapshotView({ ...parse(snapshotJSON), authority, revision: 0 });
    },
    request(json: string) {
      const value = parse(json);
      assertJSON(value, new Set(), 72);
      const request = validate(RequestSchema, value) as Request;
      return {
        json: stringify(request),
        canonical: canonical(request),
        ...identity(request),
        leaseKey: token(request.leaseId),
        requestKey: token(request.requestId),
        kind: "ops" in request ? "ops" : "undo" in request ? "undo" : "replace",
      };
    },
    evaluate(stateJSON: string, requestJSON: string, digest: string, now: string) {
      return traced(trace, "evaluation", () => {
        const state = traced(trace, "parse", () => parse(stateJSON)) as AuthorityInput,
          request = traced(trace, "request", () =>
            validate(RequestSchema, parse(requestJSON)),
          ) as Request;
        const evaluated: Evaluation = executeCommand(
          requireSchema(),
          state,
          { request, digest },
          Number(now),
          trace,
        );
        return {
          result: resultView(evaluated.result),
          snapshot: evaluated.prepared
            ? {
                json: evaluated.prepared.json,
                ...identity(evaluated.prepared.snapshot),
                revision: evaluated.prepared.snapshot.revision,
                data: evaluated.prepared.dataJSON,
              }
            : null,
          receipt: evaluated.receipt ? stringify(evaluated.receipt) : null,
        };
      });
    },
    result(json: string) {
      return resultView(parse(json));
    },
    open(snapshotJSON: string, leaseJSON: string) {
      return openingView({ snapshot: parse(snapshotJSON), lease: parse(leaseJSON) });
    },
    opening(json: string) {
      return openingView(parse(json));
    },
    projection(json: string) {
      const { data, revision, ...header } = parse(json);
      return stringify({ $slop: { format: 2, baseRevision: revision, ...header }, data });
    },
    external(json: string, snapshotJSON: string, leaseJSON: string, requestId: string) {
      const value = parse(json),
        snapshot = parse(snapshotJSON),
        meta = value.$slop;
      assertJSON(value, new Set(), 68);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Expected revision envelope");
      boundedData(value.data);
      if (
        Object.keys(value).sort().join() !== "$slop,data" ||
        !meta ||
        Object.keys(meta).sort().join() !== "authority,baseRevision,documentId,format,schemaHash" ||
        meta.format !== 2 ||
        ["documentId", "schemaHash", "authority"].some((k) => meta[k] !== snapshot[k])
      )
        throw new Error("External file has a foreign or unsupported revision envelope");
      return stringify({
        documentId: meta.documentId,
        schemaHash: meta.schemaHash,
        authority: meta.authority,
        leaseId: parse(leaseJSON).id,
        requestId,
        replace: { baseRevision: meta.baseRevision, data: value.data },
      });
    },
    bridge(json: string) {
      const value = parse(json);
      assertJSON(value, new Set(), 76);
      validate(BridgeRequestSchema, value);
      const { request, ...native } = value as Record<string, unknown>;
      return {
        nativeJSON: stringify(native),
        requestJSON: request === undefined ? null : stringify(request),
      };
    },
    media(json: string) {
      return [...hashes(parse(json), requireSchema())];
    },
    introduced(requestJSON: string) {
      const request = parse(requestJSON);
      if (request.replace) return [...hashes(request.replace.data, requireSchema())];
      const found = new Set<string>();
      for (const op of request.ops ?? [])
        if (op.op === "set" || op.op === "insert") {
          let node: any = requireSchema();
          for (const step of op.path) {
            if (!node) break;
            node =
              "key" in step
                ? documentMeta(node)?.container === "record"
                  ? recordValueSchema(node)
                  : Object.hasOwn(node.properties ?? {}, step.key)
                    ? node.properties[step.key]
                    : undefined
                : node.items;
          }
          if (op.op === "insert") node = node?.items;
          if (node) hashes(op.value, node, found);
        }
      return [...found];
    },
    seed(json: string, documentId: string, schemaHash: string) {
      const seed = validate(RoomSeedSchema, parse(json));
      if (
        seed.protocol !== 3 ||
        seed.snapshot?.documentId !== documentId ||
        seed.snapshot?.schemaHash !== schemaHash
      )
        throw new Error("Invalid room seed");
      boundedData(seed.snapshot.data);
      return snapshotView(validate(SnapshotSchema, seed.snapshot) as Snapshot);
    },
    validateRoom(json: string, client: string) {
      const value = parse(json);
      assertJSON(value, new Set(), 76);
      validate(client === "true" ? RoomClientMessageSchema : RoomMessageSchema, value);
      return true;
    },
    room(json: string) {
      const input = parse(json);
      assertJSON(input, new Set(), 76);
      const value = validate(RoomMessageSchema, input);
      switch (value.type) {
        case "ready":
          return { type: value.type, open: openingView(value.open), peers: value.peers };
        case "snapshot":
          boundedData(value.snapshot.data);
          return { type: value.type, snapshot: snapshotView(value.snapshot as Snapshot) };
        case "result":
          return {
            type: value.type,
            key: token([value.authority, value.leaseId, value.requestId]),
            result: resultView(value.result),
          };
        default:
          return value;
      }
    },
    executeMessage(json: string) {
      const input = parse(json);
      assertJSON(input, new Set(), 72);
      const value = validate(RequestSchema, input);
      return {
        key: token([value.authority, value.leaseId, value.requestId]),
        json: stringify({ type: "execute", protocol: 3, request: value }),
      };
    },
    replace(snapshotJSON: string, dataJSON: string, leaseJSON: string, requestId: string) {
      const { documentId, schemaHash, authority, revision } = parse(snapshotJSON);
      const data = parse(dataJSON);
      boundedData(data);
      return stringify({
        documentId,
        schemaHash,
        authority,
        leaseId: parse(leaseJSON).id,
        requestId,
        replace: { baseRevision: revision, data },
      });
    },
    canonical(json: string) {
      return canonical(parse(json));
    },
  };
  return {
    invoke(method: string, args: readonly string[]) {
      try {
        const fn = methods[method as keyof typeof methods];
        if (!Object.hasOwn(methods, method) || !fn) throw new Error("Unknown engine method");
        return stringify({ value: (fn as (...args: string[]) => unknown)(...args) });
      } catch (error) {
        return stringify({ error: failure(error).error });
      }
    },
  };
}
