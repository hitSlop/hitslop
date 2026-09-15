import { expect, test } from "bun:test";
import fixture from "./fixtures/runtime-1.0.0.json";
import { Replica, exchange } from "../src/replica.ts";
import { decode } from "../src/encoding.ts";

// This checkpoint is a released-runtime fixture: never regenerate it on a version bump.
test("runtime 1.0.0 checkpoints retain history and merge edits after reopening", () => {
  const left = new Replica({ schema: fixture.schema, peerId: "2", snapshot: decode(fixture.checkpoint) });
  const right = new Replica({ schema: fixture.schema, peerId: "3", snapshot: decode(fixture.checkpoint) });
  expect(left.current()).toEqual(fixture.data);
  left.update(draft => { draft.title = "Edited on current runtime"; });
  right.update(draft => { (draft.tasks as { id: string; done: boolean }[])[0]!.done = true; });
  exchange(left, right);
  expect(left.current()).toEqual(right.current());
  expect(new Replica({ schema: fixture.schema, peerId: "4", snapshot: left.exportSnapshot() }).current()).toEqual({
    title: "Edited on current runtime", tasks: [{ id: "one", done: true }],
  });
});
