<script lang="ts">
  import { DAYS, type Schedule } from "../schema";
  import { DAY_NAMES, clockLabel, sortedPeriods } from "./schedule";
  import * as s from "./styles.css";
  let { data }: { data: Schedule } = $props();
</script>

<article class={s.exportPage} aria-label="Exported school schedule">
  <header class={s.header}>
    <div class={s.identity}>
      <span class={s.eyebrow}>SCHOOL / SCHEDULE</span>
      <h1 class={s.name}>{data.studentName || "Your week"}</h1>
      <p class={s.term}>{data.term}</p>
    </div>
  </header>
  <div class={s.exportDetails}>
    Homeroom · {data.homeroom || "—"}<br />Locker · {data.locker || "—"}
  </div>
  <div class={s.exportDays}>
    {#each DAYS as day}<section class={s.exportDay}>
        <h2 class={s.exportDayTitle}>{DAY_NAMES[day]}</h2>
        {#each sortedPeriods(data.periods) as p}{@const c = data.classes.find(
            (c) => c.day === day && c.periodId === p.id,
          )}
          <section class={s.exportClass} data-color={c?.color}>
            <p class={s.exportMeta}>
              {p.name} · {clockLabel(p.start)}–{clockLabel(p.end)}
            </p>
            <h3 class={s.exportSubject}>{c?.subject || "Free period"}</h3>
            {#if c}<p class={s.exportMeta}>{c.room}<br />{c.teacher}</p>{/if}
          </section>{/each}
        <h3 class={s.heading}>After class</h3>
        {#each data.activities
          .filter((a) => a.day === day)
          .sort((a, b) => a.start.localeCompare(b.start)) as a}<section
            class={s.exportClass}
          >
            <p class={s.exportMeta}>
              {clockLabel(a.start)}–{clockLabel(a.end)}
            </p>
            <h4 class={s.exportSubject}>{a.title || "Your plans"}</h4>
            <p class={s.exportMeta}>{a.location}</p>
          </section>{:else}<p class={s.exportMeta}>No plans yet.</p>{/each}
      </section>{/each}
  </div>
</article>
