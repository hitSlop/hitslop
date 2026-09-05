import { expect, test } from "bun:test";
import { LatestTask } from "../src/latest-task.ts";

test("old requests and disposed resources cannot replace newer state", async () => {
  const task = new LatestTask();
  let resolve!: (n: number) => void;
  const slow = new Promise<number>(yes => { resolve = yes; });
  const values: number[] = [];
  const first = task.run(() => slow, n => values.push(n), () => {}, () => {});
  await task.run(async () => 2, n => values.push(n), () => {}, () => {});
  resolve(1); await first;
  expect(values).toEqual([2]);
  task.dispose();
  await task.run(async () => 3, n => values.push(n), () => {}, () => {});
  expect(values).toEqual([2]);
});
