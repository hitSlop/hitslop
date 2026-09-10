import {
  DAYS,
  isBreakName,
  type Schedule,
  type ClassEntry,
  type DayKey,
  type PeriodSlot,
} from "../schema";
export const DAY_NAMES: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
};
export const COLOR_NAMES = {
  sage: "Mint",
  slate: "Sky",
  amber: "Peach",
  terracotta: "Coral",
  indigo: "Lilac",
  rose: "Pink",
  teal: "Aqua",
};
export function minutes(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function validTimes(start: string, end: string): boolean {
  const a = minutes(start),
    b = minutes(end);
  return a !== null && b !== null && b > a;
}
export function clockLabel(value: string): string {
  const n = minutes(value);
  if (n === null) return "—";
  return `${Math.floor(n / 60) % 12 || 12}:${String(n % 60).padStart(2, "0")}${n < 720 ? "am" : "pm"}`;
}
export function sortedPeriods(periods: PeriodSlot[]): PeriodSlot[] {
  return [...periods].sort(
    (a, b) => (minutes(a.start) ?? 1440) - (minutes(b.start) ?? 1440),
  );
}
export function periodError(period: PeriodSlot, periods: PeriodSlot[]): string {
  if (!period.name.trim()) return "Give this period a name.";
  if (!validTimes(period.start, period.end))
    return "Choose an end time after the start time.";
  const a = minutes(period.start)!,
    b = minutes(period.end)!;
  if (
    periods.some(
      (p) =>
        p.id !== period.id &&
        validTimes(p.start, p.end) &&
        a < minutes(p.end)! &&
        b > minutes(p.start)!,
    )
  )
    return "This overlaps another period. Adjust the bell times.";
  return "";
}
export function moveClass(
  classes: ClassEntry[],
  id: string,
  day: DayKey,
  periodId: string,
): ClassEntry[] {
  const source = classes.find((c) => c.id === id);
  if (!source) return classes;
  const target = classes.find(
    (c) => c.id !== id && c.day === day && c.periodId === periodId,
  );
  return classes.map((c) =>
    c.id === id
      ? { ...c, day, periodId }
      : c.id === target?.id
        ? { ...c, day: source.day, periodId: source.periodId }
        : c,
  );
}
export function copyDay(
  classes: ClassEntry[],
  day: DayKey,
  newID: () => string,
): ClassEntry[] {
  const source = classes.filter((c) => c.day === day);
  return DAYS.flatMap((dest) =>
    dest === day
      ? source
      : source.map((c) => {
          const previous = classes.find(
            (old) => old.day === dest && old.periodId === c.periodId,
          );
          return { ...previous, ...c, id: previous?.id ?? newID(), day: dest };
        }),
  );
}
export function liveStatus(data: Schedule, now: Date) {
  const day =
    now.getDay() > 0 && now.getDay() < 6 ? DAYS[now.getDay() - 1] : null;
  if (!day)
    return {
      day: null,
      periodId: null,
      label: "Weekend",
      title: "A little time off.",
      detail: "Your week picks up on Monday.",
      next: "",
    };
  const at = now.getHours() * 60 + now.getMinutes();
  const periods = sortedPeriods(data.periods).filter((p) =>
    validTimes(p.start, p.end),
  );
  const events = [
    ...periods.map((p) => {
      const c = data.classes.find((c) => c.day === day && c.periodId === p.id);
      return {
        start: minutes(p.start)!,
        end: minutes(p.end)!,
        time: p.start,
        title:
          c?.subject.trim() || (isBreakName(p.name) ? p.name : "Free period"),
        room: c?.room || "",
        periodId: p.id,
        kind: c?.subject.trim()
          ? "In class"
          : isBreakName(p.name)
            ? p.name
            : "Free period",
      };
    }),
    ...data.activities
      .filter((a) => a.day === day && validTimes(a.start, a.end))
      .map((a) => ({
        start: minutes(a.start)!,
        end: minutes(a.end)!,
        time: a.start,
        title: a.title || "After-class plans",
        room: a.location,
        periodId: null,
        kind: "After class",
      })),
  ].sort((a, b) => a.start - b.start);
  const current = events.find((e) => e.start <= at && at < e.end);
  const next = events.find((e) => e.start > at);
  if (current)
    return {
      day,
      periodId: current.periodId,
      label: current.kind,
      title: current.title,
      detail: [current.room, `${current.end - at} min left`]
        .filter(Boolean)
        .join(" · "),
      next: next
        ? `Next: ${next.title}${next.room ? ` · ${next.room}` : ""} · ${clockLabel(next.time)}`
        : "That’s your last scheduled stop.",
    };
  if (next)
    return {
      day,
      periodId: null,
      label: events.some((e) => e.end <= at) ? "Up next" : "Before school",
      title: next.title,
      detail: [next.room, `in ${next.start - at} min`]
        .filter(Boolean)
        .join(" · "),
      next: `Starts at ${clockLabel(next.time)}`,
    };
  return {
    day,
    periodId: null,
    label: events.length ? "All done" : "Open day",
    title: events.length ? "That’s a wrap." : "Room for something good.",
    detail: events.length
      ? "Nothing else on the schedule today."
      : "Add a class or an after-class plan.",
    next: "",
  };
}
