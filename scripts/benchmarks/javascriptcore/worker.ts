import { createNativeEngine } from "../../../packages/document-engine/src/jsc.ts";
const engine = createNativeEngine();

// Local workerd harness, never a deployed route.
export default {
  async fetch(request: Request) {
    try {
      const { method, args } = (await request.json()) as { method: string; args: string[] };
      return Response.json(JSON.parse(engine.invoke(method, args)));
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 400 });
    }
  },
};
