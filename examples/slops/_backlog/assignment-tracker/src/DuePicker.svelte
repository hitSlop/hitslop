<script lang="ts">
  import { Calendar, Popover } from "bits-ui";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import {
    getLocalTimeZone,
    today,
    type DateValue,
  } from "@internationalized/date";
  import { formatISO, parseISO } from "./due";
  import * as s from "./styles.css";

  let {
    value,
    label,
    urgency = "later",
    disabled = false,
    onSelect,
  }: {
    value: string;
    label: string;
    urgency?: string;
    disabled?: boolean;
    onSelect: (iso: string) => void;
  } = $props();

  let open = $state(false);
  const calendarValue = $derived(parseISO(value) ?? today(getLocalTimeZone()));

  function onValueChange(date: DateValue | undefined): void {
    if (!date) return;
    onSelect(formatISO(date));
    open = false;
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class={s.due}
    data-urgency={urgency}
    {disabled}
    aria-label="Due date, {label}"
  >
    {label}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      class={s.calendarPopover}
      side="bottom"
      align="start"
      sideOffset={6}
      data-slop-export="hide"
    >
      <Calendar.Root
        type="single"
        value={calendarValue}
        preventDeselect
        {onValueChange}
      >
        {#snippet children({ months, weekdays })}
          <Calendar.Header class={s.calHeader}>
            <Calendar.PrevButton class={s.calNav} aria-label="Previous month">
              <ChevronLeft size={13} />
            </Calendar.PrevButton>
            <Calendar.Heading class={s.calTitle} />
            <Calendar.NextButton class={s.calNav} aria-label="Next month">
              <ChevronRight size={13} />
            </Calendar.NextButton>
          </Calendar.Header>
          {#each months as month}
            <Calendar.Grid class={s.calGrid}>
              <Calendar.GridHead>
                <Calendar.GridRow class={s.calRow}>
                  {#each weekdays as day}
                    <Calendar.HeadCell class={s.calHeadCell}
                      >{day.slice(0, 2)}</Calendar.HeadCell
                    >
                  {/each}
                </Calendar.GridRow>
              </Calendar.GridHead>
              <Calendar.GridBody>
                {#each month.weeks as weekDates}
                  <Calendar.GridRow class={s.calRow}>
                    {#each weekDates as date}
                      <Calendar.Cell
                        {date}
                        month={month.value}
                        class={s.calCell}
                      >
                        <Calendar.Day class={s.calDay} />
                      </Calendar.Cell>
                    {/each}
                  </Calendar.GridRow>
                {/each}
              </Calendar.GridBody>
            </Calendar.Grid>
          {/each}
        {/snippet}
      </Calendar.Root>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
