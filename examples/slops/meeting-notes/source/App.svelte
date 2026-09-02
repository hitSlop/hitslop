<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import Icon from "./Icon.svelte";

  type AgendaItem = { id: string; text: string; done: boolean };
  type DecisionItem = { id: string; text: string };
  type ActionItem = { id: string; text: string; owner: string; done: boolean };

  type MeetingData = {
    title: string;
    date: string;
    time: string;
    attendees: string[];
    agenda: AgendaItem[];
    decisions: DecisionItem[];
    notes: string;
    actions: ActionItem[];
  };

  const doc = jsonStore<MeetingData>({
    title: "Project Kickoff",
    date: "May 12, 2025",
    time: "10:00 AM · Zoom",
    attendees: ["Maya", "Jordan", "Creative Team"],
    agenda: [
      { id: "1", text: "Review three creative directions", done: true },
      { id: "2", text: "Confirm production launch dates", done: false },
      { id: "3", text: "Set Q3 production budget", done: false },
    ],
    decisions: [
      { id: "1", text: "Lead with quieter tactile photography" },
      { id: "2", text: "Move launch date to October 6" },
    ],
    notes: "Aligned on MVP scope. Creative team will explore two typography variants.\nFeedback from product was positive on tactile physical skins.\nNext milestone review scheduled for Friday.",
    actions: [
      { id: "1", text: "Send revised estimate to client", owner: "Jordan", done: false },
      { id: "2", text: "Book studio and photographer", owner: "Maya", done: true },
      { id: "3", text: "Share updated timeline across channels", owner: "Jordan", done: false },
    ],
  });

  let newAttendeeName = $state("");

  const completedActions = $derived(doc.current.actions.filter((a) => a.done).length);
  const totalActions = $derived(doc.current.actions.length);
  const completedAgenda = $derived(doc.current.agenda.filter((a) => a.done).length);
  const totalAgenda = $derived(doc.current.agenda.length);

  function addAttendee() {
    const trimmed = newAttendeeName.trim();
    if (!trimmed) return;
    doc.current.attendees.push(trimmed);
    newAttendeeName = "";
  }

  function removeAttendee(index: number) {
    doc.current.attendees.splice(index, 1);
  }

  function addAgenda() {
    doc.current.agenda.push({
      id: crypto.randomUUID(),
      text: "New agenda topic",
      done: false,
    });
  }

  function removeAgenda(id: string) {
    doc.current.agenda = doc.current.agenda.filter((item) => item.id !== id);
  }

  function addDecision() {
    doc.current.decisions.push({
      id: crypto.randomUUID(),
      text: "New decision agreed upon",
    });
  }

  function removeDecision(id: string) {
    doc.current.decisions = doc.current.decisions.filter((item) => item.id !== id);
  }

  function addAction() {
    doc.current.actions.push({
      id: crypto.randomUUID(),
      text: "New followup action",
      owner: "Owner",
      done: false,
    });
  }

  function removeAction(id: string) {
    doc.current.actions = doc.current.actions.filter((item) => item.id !== id);
  }
</script>

<main class="memo-canvas">
  <article class="memo-sheet">
    <header class="memo-header">
      <div class="memo-meta-row">
        <div class="memo-badge">
          <span class="memo-badge-dot"></span>
          <span>Meeting Memo</span>
        </div>
        <div class="memo-date-row">
          <input
            class="memo-date-input"
            aria-label="Meeting date"
            bind:value={doc.current.date}
          />
          <span>·</span>
          <input
            class="memo-loc-input"
            aria-label="Meeting time or location"
            bind:value={doc.current.time}
          />
        </div>
      </div>

      <input
        class="memo-title-input"
        aria-label="Meeting title"
        bind:value={doc.current.title}
        placeholder="Meeting Title"
      />

      <div class="memo-attendees">
        <span class="memo-attendees-label">Attendees:</span>
        {#each doc.current.attendees as person, index}
          <span class="attendee-pill">
            <span>{person}</span>
            <button
              class="attendee-remove"
              data-slop-export="hide"
              aria-label="Remove attendee {person}"
              onclick={() => removeAttendee(index)}
            >
              <X size={12} />
            </button>
          </span>
        {/each}
        <input
          class="attendee-input"
          data-slop-export="hide"
          placeholder="+ Add person"
          aria-label="Add attendee name"
          bind:value={newAttendeeName}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAttendee();
            }
          }}
        />
      </div>
    </header>

    <div class="memo-body">
      <!-- Left Column: Agenda & Decisions -->
      <div class="memo-column">
        <section class="memo-section" aria-labelledby="agenda-heading">
          <div class="section-header">
            <h2 id="agenda-heading" class="section-title">
              Agenda
              <span class="section-count">({completedAgenda}/{totalAgenda})</span>
            </h2>
            <button
              class="action-btn"
              data-slop-export="hide"
              aria-label="Add agenda topic"
              onclick={addAgenda}
            >
              <Plus size={15} />
            </button>
          </div>
          <ul class="agenda-list">
            {#each doc.current.agenda as item (item.id)}
              <li class="agenda-item" class:done={item.done}>
                <input
                  type="checkbox"
                  class="agenda-check"
                  aria-label="Mark agenda topic done"
                  bind:checked={item.done}
                />
                <input
                  class="agenda-text-input"
                  aria-label="Agenda topic description"
                  bind:value={item.text}
                />
                <button
                  class="delete-row-btn"
                  data-slop-export="hide"
                  aria-label="Delete agenda item"
                  onclick={() => removeAgenda(item.id)}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            {/each}
          </ul>
        </section>

        <section class="decisions-card" aria-labelledby="decisions-heading">
          <div class="decisions-header">
            <h2 id="decisions-heading" class="decisions-title">
              <span class="decisions-dot"></span>
              Decisions
            </h2>
            <button
              class="action-btn"
              data-slop-export="hide"
              aria-label="Add decision"
              onclick={addDecision}
            >
              <Plus size={15} />
            </button>
          </div>
          <ul class="decision-list">
            {#each doc.current.decisions as item (item.id)}
              <li class="decision-item">
                <span class="decision-bullet">▪</span>
                <input
                  class="decision-text-input"
                  aria-label="Agreed decision"
                  bind:value={item.text}
                />
                <button
                  class="delete-row-btn"
                  data-slop-export="hide"
                  aria-label="Delete decision"
                  onclick={() => removeDecision(item.id)}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            {/each}
          </ul>
        </section>
      </div>

      <!-- Right Column: Notes & Actions -->
      <div class="memo-column">
        <section class="memo-section" aria-labelledby="notes-heading">
          <div class="section-header">
            <h2 id="notes-heading" class="section-title">Notes</h2>
          </div>
          <textarea
            class="notes-textarea"
            aria-label="Meeting notes"
            placeholder="Capture discussion points, context, references..."
            bind:value={doc.current.notes}
          ></textarea>
        </section>

        <section class="memo-section" aria-labelledby="actions-heading">
          <div class="section-header">
            <h2 id="actions-heading" class="section-title">
              Actions
              <span class="section-count">({completedActions}/{totalActions})</span>
            </h2>
            <button
              class="action-btn"
              data-slop-export="hide"
              aria-label="Add action item"
              onclick={addAction}
            >
              <Plus size={15} />
            </button>
          </div>
          <ul class="actions-list">
            {#each doc.current.actions as action (action.id)}
              <li class="action-item" class:done={action.done}>
                <input
                  type="checkbox"
                  class="agenda-check"
                  aria-label="Mark action complete"
                  bind:checked={action.done}
                />
                <input
                  class="action-text-input"
                  aria-label="Action description"
                  bind:value={action.text}
                />
                <input
                  class="action-owner-input"
                  aria-label="Action owner"
                  bind:value={action.owner}
                />
                <button
                  class="delete-row-btn"
                  data-slop-export="hide"
                  aria-label="Delete action item"
                  onclick={() => removeAction(action.id)}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            {/each}
          </ul>
        </section>
      </div>
    </div>

    <footer class="memo-footer">
      <span>{doc.current.agenda.length} agenda items · {doc.current.decisions.length} decisions</span>
      <span>{completedActions} of {totalActions} actions completed</span>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
