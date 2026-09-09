<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import type { Checklist } from "../schema";
  import Brand from "./Brand.svelte";
  import * as s from "./styles.css";
  let { checklist, view }: { checklist: Checklist; view: "tasks" | "filed" } = $props();
  const tasks = $derived(checklist.tasks.filter(task => task.archived === (view === "filed")));
  const completed = $derived(tasks.filter(task => task.done).length);
</script>

<article class={s.shell}>
  <Brand />
  <section class={s.paper} aria-label="Exported checklist">
    <div class={s.heading}>
      <p class={s.eyebrow}>{view === "filed" ? "Filed tasks" : "A little less on your mind."}</p>
      <h1 class={s.title} style:white-space="pre-wrap" style:overflow-wrap="anywhere">{checklist.title || "Untitled list"}</h1>
      <div class={s.progress}><span>{view === "filed" ? `${tasks.length} filed` : `${tasks.length - completed} left to do`}</span><span>{completed} / {tasks.length} done</span></div>
      <div class={s.track}><div style:width={`${tasks.length ? completed / tasks.length * 100 : 0}%`}></div></div>
    </div>
    <ol class={s.list}>
      {#each tasks as task (task.id)}
        <li class={s.row} data-done={task.done}>
          <span data-checkbox-root data-state={task.done ? "checked" : "unchecked"} aria-label={task.done ? "Complete" : "Incomplete"}>{#if task.done}<Check size={17} strokeWidth={3} />{/if}</span>
          <span class={s.taskText} style:white-space="pre-wrap">{task.text || "Untitled task"}</span>
        </li>
      {/each}
    </ol>
    {#if !tasks.length}<div class={s.empty}><Check size={30} /><h2>{view === "filed" ? "No filed tasks yet." : "A little breathing room."}</h2></div>{/if}
  </section>
</article>
