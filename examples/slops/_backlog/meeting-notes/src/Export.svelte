<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import type { Meeting } from "../schema";
  import * as s from "./styles.css";

  let { data }: { data: Meeting } = $props();
  const completedAgenda = $derived(data.agenda.filter(item => item.done).length);
  const completedActions = $derived(data.actions.filter(item => item.done).length);
</script>

<article class={s.exportMemo} aria-label="Exported meeting memo {data.title}">
  <header class={s.letterhead}>
    <div class={s.metaRow}>
      <span class={s.badge}><span class={s.badgeDot}></span>Meeting Memo</span>
      <div class={s.dateRow}>
        <span class={s.metaField}>{data.date}</span>
        {#if data.date.trim() && data.time.trim()}<span aria-hidden="true">·</span>{/if}
        <span class={s.metaField}>{data.time}</span>
      </div>
    </div>
    <h1 class={s.title}>{data.title.trim() || "Untitled meeting"}</h1>
    <div class={s.attendees}>
      <span class={s.attendeesLabel}>Attendees</span>
      {#each data.attendees.filter(person => person.trim()) as person}
        <span class={s.pill}>{person}</span>
      {:else}
        <span class={s.pill}>None listed</span>
      {/each}
    </div>
  </header>

  <div class={s.body}>
    <div class={s.column}>
      <section class={s.section} aria-labelledby="export-agenda">
        <div class={s.sectionHeader}>
          <h2 id="export-agenda" class={s.sectionTitle}>Agenda <span class={s.sectionCount}>({completedAgenda}/{data.agenda.length})</span></h2>
        </div>
        <ul class={s.list}>
          {#each data.agenda as item (item.id)}
            <li class={s.agendaItem} data-done={item.done}>
              <span data-checkbox-root data-state={item.done ? "checked" : "unchecked"}>{#if item.done}<Check size={10} strokeWidth={3} />{/if}</span>
              <span class={s.rowText}>{item.text.trim() || "Untitled topic"}</span>
            </li>
          {:else}
            <li class={s.empty}>No topics yet.</li>
          {/each}
        </ul>
      </section>

      <section class={s.decisions} aria-labelledby="export-decisions">
        <div class={s.decisionsHeader}>
          <h2 id="export-decisions" class={s.decisionsTitle}><span class={s.decisionsDot}></span>Decisions</h2>
        </div>
        <ul class={s.list}>
          {#each data.decisions as item (item.id)}
            <li class={s.decisionItem}>
              <span class={s.decisionBullet} aria-hidden="true">▪</span>
              <span class={s.rowText}>{item.text.trim() || "Untitled decision"}</span>
            </li>
          {:else}
            <li class={s.empty}>Nothing decided yet.</li>
          {/each}
        </ul>
      </section>
    </div>

    <div class={s.column}>
      <section class={s.section} aria-labelledby="export-notes">
        <div class={s.sectionHeader}><h2 id="export-notes" class={s.sectionTitle}>Notes</h2></div>
        {#if data.notes.trim()}
          <p class={s.notesText}>{data.notes}</p>
        {:else}
          <p class={s.empty}>No notes captured.</p>
        {/if}
      </section>

      <section class={s.section} aria-labelledby="export-actions">
        <div class={s.sectionHeader}>
          <h2 id="export-actions" class={s.sectionTitle}>Actions <span class={s.sectionCount}>({completedActions}/{data.actions.length})</span></h2>
        </div>
        <ul class={s.list}>
          {#each data.actions as item (item.id)}
            <li class={s.actionItem} data-done={item.done}>
              <span data-checkbox-root data-state={item.done ? "checked" : "unchecked"}>{#if item.done}<Check size={10} strokeWidth={3} />{/if}</span>
              <span class={s.rowText}>{item.text.trim() || "Untitled action"}</span>
              <span class={s.owner}>{item.owner.trim() || "Unassigned"}</span>
            </li>
          {:else}
            <li class={s.empty}>No follow-ups yet.</li>
          {/each}
        </ul>
      </section>
    </div>
  </div>

  <footer class={s.footer}>
    <span>{data.agenda.length} agenda · {data.decisions.length} decisions</span>
    <span>{completedActions} of {data.actions.length} actions done</span>
  </footer>
</article>
