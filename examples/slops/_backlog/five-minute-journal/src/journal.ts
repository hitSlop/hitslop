import {
  CalendarDate,
  getLocalTimeZone,
  parseDate,
  today,
  type DateValue,
} from "@internationalized/date";
import type { FiveMinuteJournal } from "../schema";

export type View = "am" | "pm" | "all";

export function initialView(
  data: Pick<FiveMinuteJournal, "morningDone" | "eveningDone">,
): View {
  return data.morningDone ? (data.eveningDone ? "all" : "pm") : "am";
}

export function freshJournal(): FiveMinuteJournal {
  return {
    date: today(getLocalTimeZone()).toString(),
    quote: "",
    quoteAuthor: "",
    morningDone: false,
    gratitudes: ["", "", ""],
    intentions: ["", "", ""],
    affirmation: "",
    eveningDone: false,
    highlights: ["", "", ""],
    lesson: "",
  };
}

// New selections use date-only ISO strings. Legacy free-text dates stay untouched.
export function calendarDate(value: string): CalendarDate | undefined {
  try {
    return parseDate(value);
  } catch {
    return undefined;
  }
}

export function displayDate(value: string): string {
  const date = calendarDate(value);
  return date
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date.toDate(getLocalTimeZone()))
    : value.trim() || "Choose a day";
}

export function dateString(value: DateValue): string {
  return new CalendarDate(value.year, value.month, value.day).toString();
}
