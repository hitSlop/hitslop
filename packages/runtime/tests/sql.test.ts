import { expect, test } from "bun:test";
import { sql } from "../src/sql.ts";

test("interpolations become positional parameters", () => {
  const title = "hello";
  const done = false;
  const statement = sql`INSERT INTO todos (title, done) VALUES (${title}, ${done})`;
  expect(statement.sql).toBe("INSERT INTO todos (title, done) VALUES (?, ?)");
  expect(statement.parameters).toEqual(["hello", false]);
});

test("a template without interpolations passes through", () => {
  const statement = sql`SELECT * FROM todos`;
  expect(statement.sql).toBe("SELECT * FROM todos");
  expect(statement.parameters).toEqual([]);
});
