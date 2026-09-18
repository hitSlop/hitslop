import { assertJSON } from "./json.js";
import { MediaReferenceSchema } from "./media.js";
import { hitslopDocumentKeyword } from "./keywords.js";

export const documentDialect = "https://json-schema.org/draft/2020-12/schema";
const recordPattern = "^[\\s\\S]*$";
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const scalar = (v: unknown) => v === null || ["string", "boolean", "number"].includes(typeof v);
const equal = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]))
  );
};

/** Definition validation for the closed document language; TypeBox validates values. */
export function checkDocumentSchema(schema: unknown): void {
  assertJSON(schema, new Set(), 128);
  let remaining = 20000;
  function visit(value: unknown, path: string): void {
    const bad = (message: string): never => {
      throw new Error(`Document schema ${path}: ${message}`);
    };
    if (--remaining < 0) bad("too many schema nodes");
    if (!object(value)) bad("expected a schema object");
    const node = value as Record<string, any>;
    if ("~optional" in node && node["~optional"] !== true) bad("invalid optional marker");
    if (node.$schema !== undefined && node.$schema !== documentDialect)
      bad("expected JSON Schema draft 2020-12");
    for (const key of ["title", "description"])
      if (key in node && typeof node[key] !== "string") bad(`${key} must be a string`);
    const meta = node[hitslopDocumentKeyword];
    if (meta !== undefined) {
      if (
        !object(meta) ||
        Object.keys(meta).some((k) => !["container", "version", "key", "media"].includes(k))
      )
        bad("invalid x-hitslop metadata");
      if (!["map", "record", "list", "atomic"].includes(meta.container)) bad("invalid container");
      if ("version" in meta && (meta.version !== 1 || meta.container !== "map"))
        bad("invalid document version");
      if ("key" in meta && (meta.container !== "list" || typeof meta.key !== "string" || !meta.key))
        bad("invalid list key");
      if ("media" in meta && (meta.media !== true || meta.container !== "atomic"))
        bad("invalid media annotation");
      if (meta.media) {
        const {
          [hitslopDocumentKeyword]: _,
          title,
          description,
          $schema,
          "~optional": optional,
          ...descriptor
        } = node;
        if (!equal(descriptor, MediaReferenceSchema))
          bad("media must use the canonical descriptor");
        return;
      }
    }
    const allowed = new Set([
      "$schema",
      "title",
      "description",
      "~optional",
      hitslopDocumentKeyword,
    ]);
    const allow = (...keys: string[]) => keys.forEach((k) => allowed.add(k));
    const bounds = (low: string, high: string, integer: boolean) => {
      allow(low, high);
      for (const k of [low, high])
        if (
          k in node &&
          (typeof node[k] !== "number" ||
            !Number.isFinite(node[k]) ||
            (integer && (!Number.isSafeInteger(node[k]) || node[k] < 0)))
        )
          bad(`invalid ${k}`);
      if (low in node && high in node && node[low] > node[high]) bad(`${low} exceeds ${high}`);
    };
    if (Object.hasOwn(node, "const")) {
      allow("const", "type");
      if (!scalar(node.const)) bad("literal must be scalar");
      const type = node.const === null ? "null" : typeof node.const;
      if (
        node.type !== undefined &&
        node.type !== type &&
        !(node.type === "integer" && Number.isInteger(node.const))
      )
        bad("literal type mismatch");
    } else if (Object.hasOwn(node, "enum")) {
      allow("enum", "type");
      if (!Array.isArray(node.enum) || !node.enum.length || !node.enum.every(scalar))
        bad("enum must contain scalar values");
      for (const item of node.enum)
        visit(
          { const: item, ...(node.type !== undefined ? { type: node.type } : {}) },
          `${path}.enum`,
        );
    } else if (Object.hasOwn(node, "anyOf")) {
      allow("anyOf");
      if (!Array.isArray(node.anyOf) || !node.anyOf.length) bad("union must contain alternatives");
      node.anyOf.forEach((child: unknown, i: number) => visit(child, `${path}.anyOf[${i}]`));
    } else {
      allow("type");
      switch (node.type) {
        case "string":
          bounds("minLength", "maxLength", true);
          break;
        case "number":
        case "integer":
          bounds("minimum", "maximum", false);
          break;
        case "boolean":
        case "null":
          break;
        case "array":
          allow("items", "uniqueItems");
          bounds("minItems", "maxItems", true);
          if ("uniqueItems" in node && typeof node.uniqueItems !== "boolean")
            bad("uniqueItems must be boolean");
          visit(node.items, `${path}.items`);
          break;
        case "object": {
          allow("properties", "required", "additionalProperties", "patternProperties");
          if ("additionalProperties" in node && typeof node.additionalProperties !== "boolean")
            bad("additionalProperties must be boolean");
          if ("properties" in node && !object(node.properties)) bad("properties must be an object");
          const properties = node.properties ?? {};
          for (const [key, child] of Object.entries(properties))
            visit(child, `${path}.properties[${JSON.stringify(key)}]`);
          if (
            "required" in node &&
            (!Array.isArray(node.required) ||
              new Set(node.required).size !== node.required.length ||
              node.required.some(
                (k: unknown) => typeof k !== "string" || !Object.hasOwn(properties, k),
              ))
          )
            bad("required must name declared properties once");
          if ("patternProperties" in node) {
            if (
              !object(node.patternProperties) ||
              Object.keys(node.patternProperties).length !== 1 ||
              !Object.hasOwn(node.patternProperties, recordPattern) ||
              Object.keys(properties).length
            )
              bad("only unrestricted record keys are supported");
            visit(node.patternProperties[recordPattern], `${path}.record`);
          }
          break;
        }
        default:
          bad("unsupported or missing type");
      }
    }
    for (const key of Object.keys(node)) if (!allowed.has(key)) bad(`unsupported keyword ${key}`);
    if (meta?.container === "map" && (node.type !== "object" || node.patternProperties))
      bad("map requires object properties");
    if (meta?.container === "record" && (node.type !== "object" || !node.patternProperties))
      bad("record requires unrestricted keys");
    if (
      meta?.container === "list" &&
      (node.type !== "array" ||
        !meta.key ||
        node.items?.type !== "object" ||
        !Object.hasOwn(node.items.properties ?? {}, meta.key) ||
        node.items.properties[meta.key].type !== "string" ||
        !node.items.required?.includes(meta.key))
    )
      bad("list requires a required string identity field");
  }
  visit(schema, "$");
}
