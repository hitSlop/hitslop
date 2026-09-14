<script lang="ts">
  import { Calendar, Popover } from "bits-ui";
  import {
    CalendarDate,
    getLocalTimeZone,
    today,
  } from "@internationalized/date";
  import { parseTarget } from "./countdown";
  import * as s from "./styles.css";
  let { value = $bindable("") }: { value?: string } = $props();
  let open = $state(false);
  const selected = $derived.by(() => {
    if (!parseTarget(value, "12:00")) return today(getLocalTimeZone());
    const [y, m, d] = value.split("-").map(Number);
    return new CalendarDate(y, m, d);
  });
</script>

<Popover.Root bind:open
  ><Popover.Trigger type="button" class={s.input} aria-label="Target date"
    >{value || "Choose a date"} ▾</Popover.Trigger
  ><Popover.Portal
    ><Popover.Content class={s.popover} sideOffset={6} collisionPadding={8}>
      <Calendar.Root
        type="single"
        value={selected}
        preventDeselect
        onValueChange={(date) => {
          if (date) {
            value = date.toString();
            open = false;
          }
        }}
        fixedWeeks
      >
        {#snippet children({ months, weekdays })}<Calendar.Header
            class={s.calHeader}
            ><Calendar.PrevButton
              class={s.smallButton}
              aria-label="Previous month">←</Calendar.PrevButton
            ><Calendar.Heading class={s.calHeading} /><Calendar.NextButton
              class={s.smallButton}
              aria-label="Next month">→</Calendar.NextButton
            ></Calendar.Header
          >
          {#each months as month}<Calendar.Grid class={s.grid}
              ><Calendar.GridHead
                ><Calendar.GridRow
                  >{#each weekdays as day}<Calendar.HeadCell class={s.weekday}
                      >{day.slice(0, 2)}</Calendar.HeadCell
                    >{/each}</Calendar.GridRow
                ></Calendar.GridHead
              ><Calendar.GridBody
                >{#each month.weeks as week}<Calendar.GridRow
                    >{#each week as date}<Calendar.Cell
                        {date}
                        month={month.value}
                        class={s.cell}
                        ><Calendar.Day class={s.day}>{date.day}</Calendar.Day
                        ></Calendar.Cell
                      >{/each}</Calendar.GridRow
                  >{/each}</Calendar.GridBody
              ></Calendar.Grid
            >{/each}{/snippet}
      </Calendar.Root><button
        class={s.smallButton}
        type="button"
        onclick={() => {
          value = today(getLocalTimeZone()).toString();
          open = false;
        }}>Today</button
      >
    </Popover.Content></Popover.Portal
  ></Popover.Root
>
