<script lang="ts">
  import type { AssignmentTracker } from "../schema";
  import { groupAssignments, todayISO, relativeDue } from "./due";
  import * as s from "./styles.css";
  let {
    data,
    reference = todayISO(),
  }: { data: AssignmentTracker; reference?: string } = $props();
  const stacks = $derived(groupAssignments(data.assignments, reference));
</script>

<article class={s.exportPad} aria-label="Exported assignment tracker">
  <header class={s.header}>
    <div class={s.identity}>
      <span class={s.eyebrow}>ASSIGNMENTS / STUDY PAD</span>
      <h1
        class={s.student}
        style="white-space:normal;overflow-wrap:anywhere;margin:0"
      >
        {data.studentName || "Your study pad"}
      </h1>
      <span class={s.term}>{data.term}</span>
    </div>
  </header>
  <div class={s.exportStacks}>
    {#each stacks as stack}<section class={s.stack}>
        <div class={s.stackHead}>
          <h2 class={s.stackLabel} data-urgency={stack.id}>{stack.label}</h2>
          <span class={s.stackCount}>{stack.items.length}</span>
        </div>
        {#each stack.items as item}<div class={s.exportRow}>
            <span
              class={s.checkbox}
              data-state={item.completed ? "checked" : "unchecked"}
              >{item.completed ? "✓" : ""}</span
            >
            <div class={s.exportBody}>
              <strong class={s.itemTitle}
                >{item.title || "Untitled assignment"}</strong
              >
              <div class={s.itemMeta}>
                <span class={s.courseChip}
                  >{item.courseCode || "No course"}</span
                ><span>{item.category}</span><span>{item.points} pts</span><span
                  >{item.dueDate || "No due date"} · {item.completed
                    ? "Completed"
                    : relativeDue(item.dueDate, reference).label}</span
                >
              </div>
              {#if item.notes}<p class={s.exportNotes}>{item.notes}</p>{/if}
            </div>
          </div>{/each}
      </section>{:else}<div class={s.empty}>
        <h2>No assignments yet.</h2>
      </div>{/each}
  </div>
  <footer class={s.footer}>
    <span>One thing at a time.</span><span
      >{data.assignments.filter((i) => i.completed).length} / {data.assignments
        .length} complete</span
    >
  </footer>
</article>
