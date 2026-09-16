import { OpenAPIGenerator } from "@orpc/openapi";
import { roomClientVariants, roomServerVariants } from "@hitslop/schema";
import { api } from "./contract.js";

/** Bundle named JSON schemas as reusable OpenAPI components, including live messages.
 * No Swift source rewriting: the Swift generator consumes standard oneOf/discriminator metadata.
 */
export async function generateOpenAPI(): Promise<object> {
  const document = await new OpenAPIGenerator().generate(api, {
    version: "3.1.0",
    base: {
      info: { title: "hitSlop API", version: "1.0.0" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Firebase ID token" },
          roomToken: { type: "http", scheme: "bearer", bearerFormat: "Room token" },
        },
      },
    },
  });
  const schemas: Record<string, any> = document.components?.schemas ?? {};
  function bundle(value: any, definition = false): any {
    if (Array.isArray(value)) return value.map((item) => bundle(item));
    if (!value || typeof value !== "object") return value;
    // JSON Schema enums can omit type; Swift needs it to emit a string enum.
    if (
      !value.type &&
      value.enum?.length &&
      value.enum.every((item: unknown) => typeof item === "string")
    ) {
      return bundle({ ...value, type: "string" }, definition);
    }
    // Apple's generator supports 3.1 nullable types, but skips standalone null branches.
    if (value.anyOf?.length === 2) {
      const nonNull = value.anyOf.find(
        (item: any) => typeof item.type === "string" && item.type !== "null",
      );
      if (nonNull && value.anyOf.some((item: any) => item.type === "null")) {
        const { anyOf, ...rest } = value;
        return bundle({ ...rest, ...nonNull, type: [nonNull.type, "null"] });
      }
    }
    if (typeof value.title === "string" && !definition) {
      const name = value.title as string;
      if (!schemas[name]) schemas[name] = bundle(value, true);
      return { $ref: `#/components/schemas/${name}` };
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, bundle(child)]));
  }
  document.paths = bundle(document.paths);
  for (const [schema, variants] of [
    ["RoomServerMessage", roomServerVariants],
    ["RoomClientMessage", roomClientVariants],
  ] as const) {
    const mapping = Object.fromEntries(
      Object.entries(variants).map(([tag, variant]) => [tag, bundle(variant).$ref]),
    );
    schemas[schema] = {
      oneOf: Object.values(mapping).map(($ref) => ({ $ref })),
      discriminator: { propertyName: "type", mapping },
    };
  }
  document.components = { ...document.components, schemas };
  return document;
}
