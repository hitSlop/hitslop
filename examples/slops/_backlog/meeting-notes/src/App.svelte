<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Button, Checkbox } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import meetingSchema from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const meeting = jsonStore({ schema: meetingSchema, initial: {
    title: "Project Kickoff",
    date: "May 12, 2025",
    time: "10:00 AM · Zoom",
    attendees: ["Maya", "Jordan", "Creative Team"],
    agenda: [
      { id: "directions", text: "Review three creative directions", done: true },
      { id: "dates", text: "Confirm production launch dates", done: false },
      { id: "budget", text: "Set Q3 production budget", done: false },
    ],
    decisions: [
      { id: "photography", text: "Lead with quieter tactile photography" },
      { id: "launch", text: "Move launch date to October 6" },
    ],
    notes: "Aligned on MVP scope. Creative team will explore two typography variants.\nFeedback from product was positive on tactile physical skins.\nNext milestone review scheduled for Friday.",
    actions: [
      { id: "estimate", text: "Send revised estimate to client", owner: "Jordan", done: false },
      { id: "studio", text: "Book studio and photographer", owner: "Maya", done: true },
      { id: "timeline", text: "Share updated timeline across channels", owner: "Jordan", done: false },
    ],
  } });
  $effect(() => { if (meeting.isReady) ready(); });
  onDestroy(() => meeting.destroy());

  let newAttendee = $state("");
  const completedAgenda = $derived(meeting.current.agenda.filter(item => item.done).length);
  const completedActions = $derived(meeting.current.actions.filter(item => item.done).length);

  function addAttendee() {
    const name = newAttendee.trim();
    if (!name) return;
    meeting.current.attendees.push(name);
    newAttendee = "";
  }
</script>

<main class={s.canvas} data-slop-selection="none" aria-busy={meeting.isLoading}>
  <article class={s.memo} aria-label="Meeting memo {meeting.current.title}">
    <header class={s.letterhead}>
      <div class={s.metaRow}>
        <span class={s.badge}><span class={s.badgeDot}></span>Meeting Memo</span>
        <div class={s.dateRow}>
          <label><span class={s.srOnly}>Meeting date</span><input class={s.metaField} bind:value={meeting.current.date} /></label>
          <span aria-hidden="true">·</span>
          <label><span class={s.srOnly}>Meeting time or location</span><input class={s.metaField} bind:value={meeting.current.time} /></label>
        </div>
      </div>
      <input class={s.title} aria-label="Meeting title" placeholder="Meeting title" bind:value={meeting.current.title} />
      <div class={s.attendees}>
        <span class={s.attendeesLabel}>Attendees</span>
        {#each meeting.current.attendees as person, index}
          <span class={s.pill}>
            <span>{person}</span>
            <button class={s.pillRemove} data-slop-export="hide" type="button" aria-label="Remove {person}" onclick={() => { meeting.current.attendees = meeting.current.attendees.filter((_, i) => i !== index); }}><X size={11} strokeWidth={2} /></button>
          </span>
        {/each}
        <input
          class={s.attendeeInput}
          data-slop-export="hide"
          aria-label="Add attendee"
          placeholder="+ Add person"
          bind:value={newAttendee}
          onkeydown={event => { if (event.key === "Enter") { event.preventDefault(); addAttendee(); } }}
        />
      </div>
    </header>

    <div class={s.body}>
      <div class={s.column}>
        <section class={s.section} aria-labelledby="agenda-heading">
          <div class={s.sectionHeader}>
            <h2 id="agenda-heading" class={s.sectionTitle}>Agenda <span class={s.sectionCount}>({completedAgenda}/{meeting.current.agenda.length})</span></h2>
            <Button.Root class={s.add} data-slop-export="hide" aria-label="Add agenda topic" onclick={() => meeting.current.agenda.push({ id: crypto.randomUUID(), text: "", done: false })}><Plus size={14} strokeWidth={1.8} /></Button.Root>
          </div>
          <ul class={s.list}>
            {#each meeting.current.agenda as item, index (item.id)}
              <li class={s.agendaItem} data-done={item.done}>
                <Checkbox.Root checked={item.done} onCheckedChange={checked => item.done = checked === true} aria-label="Mark {item.text || 'agenda topic'} {item.done ? 'open' : 'done'}">
                  {#snippet children({ checked })}{#if checked}<Check size={10} strokeWidth={3} />{/if}{/snippet}
                </Checkbox.Root>
                <input class={s.rowText} aria-label="Agenda topic {index + 1}" placeholder="Agenda topic" bind:value={item.text} />
                <button class={s.remove} data-slop-export="hide" type="button" aria-label="Delete agenda topic {index + 1}" onclick={() => { meeting.current.agenda = meeting.current.agenda.filter(row => row.id !== item.id); }}><Trash2 size={13} strokeWidth={1.7} /></button>
              </li>
            {:else}
              <li class={s.empty}>No topics yet.</li>
            {/each}
          </ul>
        </section>

        <section class={s.decisions} aria-labelledby="decisions-heading">
          <div class={s.decisionsHeader}>
            <h2 id="decisions-heading" class={s.decisionsTitle}><span class={s.decisionsDot}></span>Decisions</h2>
            <Button.Root class={s.add} data-slop-export="hide" aria-label="Add decision" onclick={() => meeting.current.decisions.push({ id: crypto.randomUUID(), text: "" })}><Plus size={14} strokeWidth={1.8} /></Button.Root>
          </div>
          <ul class={s.list}>
            {#each meeting.current.decisions as item, index (item.id)}
              <li class={s.decisionItem}>
                <span class={s.decisionBullet} aria-hidden="true">▪</span>
                <input class={s.rowText} aria-label="Decision {index + 1}" placeholder="Agreed decision" bind:value={item.text} />
                <button class={s.remove} data-slop-export="hide" type="button" aria-label="Delete decision {index + 1}" onclick={() => { meeting.current.decisions = meeting.current.decisions.filter(row => row.id !== item.id); }}><Trash2 size={13} strokeWidth={1.7} /></button>
              </li>
            {:else}
              <li class={s.empty}>Nothing decided yet.</li>
            {/each}
          </ul>
        </section>
      </div>

      <div class={s.column}>
        <section class={s.section} aria-labelledby="notes-heading">
          <div class={s.sectionHeader}><h2 id="notes-heading" class={s.sectionTitle}>Notes</h2></div>
          <textarea class={s.notes} aria-label="Meeting notes" placeholder="Capture discussion, context, and references…" bind:value={meeting.current.notes}></textarea>
        </section>

        <section class={s.section} aria-labelledby="actions-heading">
          <div class={s.sectionHeader}>
            <h2 id="actions-heading" class={s.sectionTitle}>Actions <span class={s.sectionCount}>({completedActions}/{meeting.current.actions.length})</span></h2>
            <Button.Root class={s.add} data-slop-export="hide" aria-label="Add action item" onclick={() => meeting.current.actions.push({ id: crypto.randomUUID(), text: "", owner: "", done: false })}><Plus size={14} strokeWidth={1.8} /></Button.Root>
          </div>
          <ul class={s.list}>
            {#each meeting.current.actions as item, index (item.id)}
              <li class={s.actionItem} data-done={item.done}>
                <Checkbox.Root checked={item.done} onCheckedChange={checked => item.done = checked === true} aria-label="Mark {item.text || 'action'} {item.done ? 'open' : 'complete'}">
                  {#snippet children({ checked })}{#if checked}<Check size={10} strokeWidth={3} />{/if}{/snippet}
                </Checkbox.Root>
                <input class={s.rowText} aria-label="Action {index + 1}" placeholder="Follow-up action" bind:value={item.text} />
                <input class={s.owner} aria-label="Owner for action {index + 1}" placeholder="Owner" bind:value={item.owner} />
                <button class={s.remove} data-slop-export="hide" type="button" aria-label="Delete action {index + 1}" onclick={() => { meeting.current.actions = meeting.current.actions.filter(row => row.id !== item.id); }}><Trash2 size={13} strokeWidth={1.7} /></button>
              </li>
            {:else}
              <li class={s.empty}>No follow-ups yet.</li>
            {/each}
          </ul>
        </section>
      </div>
    </div>

    <footer class={s.footer}>
      <span>{meeting.current.agenda.length} agenda · {meeting.current.decisions.length} decisions</span>
      <span>{completedActions} of {meeting.current.actions.length} actions done</span>
    </footer>
  </article>
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={meeting.current} /></ExportTarget>
