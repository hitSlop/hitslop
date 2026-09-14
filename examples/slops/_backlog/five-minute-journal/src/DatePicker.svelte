<script lang="ts">
  import { Calendar, Popover } from "bits-ui";
  import { getLocalTimeZone, today } from "@internationalized/date";
  import CalendarDays from "@lucide/svelte/icons/calendar-days";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { calendarDate, dateString, displayDate } from "./journal";
  import * as s from "./calendar.css";
  let { value = $bindable("") }: { value?: string } = $props();
  let open = $state(false);
</script>

<Popover.Root bind:open>
  <Popover.Trigger class={s.trigger} aria-label="Choose journal date: {displayDate(value)}">
    <CalendarDays size={16} /><span>{displayDate(value)}</span><ChevronDown size={14} />
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content class={s.popover} sideOffset={8} align="start" collisionPadding={8} aria-label="Choose journal date">
      <Calendar.Root type="single" value={calendarDate(value)} preventDeselect onValueChange={date => { if (date) { value = dateString(date); open = false; } }} weekdayFormat="short" fixedWeeks>
        {#snippet children({ months, weekdays })}
          <Calendar.Header class={s.header}>
            <Calendar.PrevButton class={s.nav}><ChevronLeft size={18} /></Calendar.PrevButton>
            <Calendar.Heading class={s.heading} />
            <Calendar.NextButton class={s.nav}><ChevronRight size={18} /></Calendar.NextButton>
          </Calendar.Header>
          {#each months as month}
            <Calendar.Grid class={s.grid}>
              <Calendar.GridHead><Calendar.GridRow>
                {#each weekdays as day}<Calendar.HeadCell class={s.weekday}>{day.slice(0, 2)}</Calendar.HeadCell>{/each}
              </Calendar.GridRow></Calendar.GridHead>
              <Calendar.GridBody>
                {#each month.weeks as week}
                  <Calendar.GridRow>
                    {#each week as date}
                      <Calendar.Cell {date} month={month.value} class={s.cell}>
                        <Calendar.Day class={s.day}>{date.day}</Calendar.Day>
                      </Calendar.Cell>
                    {/each}
                  </Calendar.GridRow>
                {/each}
              </Calendar.GridBody>
            </Calendar.Grid>
          {/each}
        {/snippet}
      </Calendar.Root>
      <button class={s.todayButton} onclick={() => { value = today(getLocalTimeZone()).toString(); open = false; }}>Today</button>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
