import { expect, test } from "bun:test";
import {
  countdownState,
  parseTarget,
} from "../countdown-milestones/src/countdown";
const at = (date: string, time: string) => parseTarget(date, time)!.getTime();
test("future units promote as the target approaches", () => {
  expect(
    countdownState("2026-09-12", "09:00", at("2026-09-10", "09:00")),
  ).toMatchObject({ value: "2", unit: "days to go" });
  expect(
    countdownState("2026-09-10", "12:00", at("2026-09-10", "09:00")),
  ).toMatchObject({ value: "3", unit: "hours to go" });
  expect(
    countdownState("2026-09-10", "09:05", at("2026-09-10", "09:00")),
  ).toMatchObject({ value: "5", unit: "minutes to go" });
  expect(
    countdownState("2026-09-10", "09:00", at("2026-09-10", "09:00") - 30000)
      .value,
  ).toBe("<1");
});
test("arrival and days since follow local calendar boundaries", () => {
  expect(
    countdownState("2026-09-10", "09:00", at("2026-09-10", "09:00")).kind,
  ).toBe("today");
  expect(
    countdownState("2026-09-10", "23:00", at("2026-09-11", "00:00")),
  ).toMatchObject({ kind: "since", value: "1" });
});
test("invalid and impossible dates never imply arrival", () => {
  for (const date of ["", "not-a-date", "2026-02-29", "2026-04-31"])
    expect(countdownState(date, "09:00", Date.now()).kind).toBe("invalid");
  expect(parseTarget("2028-02-29", "09:00")).not.toBeNull();
  expect(parseTarget("2026-09-10", "24:00")).toBeNull();
});
test("DST gaps are rejected and days since do not depend on 24-hour days", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    expect(parseTarget("2026-03-08", "02:30")).toBeNull();
    expect(
      countdownState("2026-03-07", "23:00", at("2026-03-09", "00:00")),
    ).toMatchObject({ kind: "since", value: "2" });
    expect(
      countdownState("2026-10-31", "23:00", at("2026-11-02", "00:00")),
    ).toMatchObject({ value: "2" });
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
