import { defineSchema, collection } from "@hitslop/schema/collections";
import * as S from "@hitslop/schema/document";
export default defineSchema({
  todos: collection({ title: S.String({ minLength: 1, maxLength: 512 }), completed: S.Boolean(), createdAt: S.Number() })
    .index("by_completed", ["completed", "createdAt"])
    .index("by_created", ["createdAt"]),
});
