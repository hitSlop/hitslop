<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Bell from "@lucide/svelte/icons/bell";
  import Copy from "@lucide/svelte/icons/copy";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { onDestroy } from "svelte";
  import Icon from "./Icon.svelte";
  import type { ActivityEntry, ClassEntry, DayKey, PeriodSlot, ScheduleData, SubjectColor } from "./types";

  const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI"];
  const COLOR_PALETTE: { key: SubjectColor; label: string; hex: string }[] = [
    { key: "sage", label: "Sage", hex: "#3b7a57" },
    { key: "indigo", label: "Indigo", hex: "#4f46e5" },
    { key: "amber", label: "Amber", hex: "#d97706" },
    { key: "terracotta", label: "Terracotta", hex: "#c2410c" },
    { key: "slate", label: "Slate", hex: "#4a5d6e" },
    { key: "teal", label: "Teal", hex: "#0d9488" },
    { key: "rose", label: "Rose", hex: "#e11d48" },
  ];

  const defaultPeriods: PeriodSlot[] = [
    { id: "p1", name: "Period 1", start: "08:15", end: "09:05" },
    { id: "p2", name: "Period 2", start: "09:10", end: "10:00" },
    { id: "adv", name: "Advisory", start: "10:05", end: "10:35" },
    { id: "p3", name: "Period 3", start: "10:40", end: "11:30" },
    { id: "lunch", name: "Lunch", start: "11:35", end: "12:15" },
    { id: "p4", name: "Period 4", start: "12:20", end: "13:10" },
    { id: "p5", name: "Period 5", start: "13:15", end: "14:05" },
    { id: "p6", name: "Period 6", start: "14:10", end: "15:00" },
  ];

  const defaultClasses: ClassEntry[] = [
    // Mon
    { id: "m-p1", periodId: "p1", day: "MON", subject: "AP Biology", room: "Rm 204", teacher: "Dr. Thorne", color: "sage" },
    { id: "m-p2", periodId: "p2", day: "MON", subject: "Honors Lit", room: "Rm 112", teacher: "Ms. Davies", color: "slate" },
    { id: "m-adv", periodId: "adv", day: "MON", subject: "Homeroom", room: "Rm 104", teacher: "Ms. Gallagher", color: "teal" },
    { id: "m-p3", periodId: "p3", day: "MON", subject: "Pre-Calculus", room: "Rm 305", teacher: "Mr. Vance", color: "indigo" },
    { id: "m-lun", periodId: "lunch", day: "MON", subject: "Lunch & Quad", room: "Commons", teacher: "—", color: "amber" },
    { id: "m-p4", periodId: "p4", day: "MON", subject: "World History", room: "Rm 218", teacher: "Mr. O'Connor", color: "amber" },
    { id: "m-p5", periodId: "p5", day: "MON", subject: "Spanish III", room: "Rm 108", teacher: "Sra. Ortiz", color: "terracotta" },
    { id: "m-p6", periodId: "p6", day: "MON", subject: "Studio Art", room: "Art Wing", teacher: "Ms. Chen", color: "rose" },

    // Tue
    { id: "t-p1", periodId: "p1", day: "TUE", subject: "AP Biology", room: "Lab B", teacher: "Dr. Thorne", color: "sage" },
    { id: "t-p2", periodId: "p2", day: "TUE", subject: "Honors Lit", room: "Rm 112", teacher: "Ms. Davies", color: "slate" },
    { id: "t-adv", periodId: "adv", day: "TUE", subject: "Class Meeting", room: "Auditorium", teacher: "Dean Hayes", color: "teal" },
    { id: "t-p3", periodId: "p3", day: "TUE", subject: "Pre-Calculus", room: "Rm 305", teacher: "Mr. Vance", color: "indigo" },
    { id: "t-lun", periodId: "lunch", day: "TUE", subject: "Lunch & Quad", room: "Commons", teacher: "—", color: "amber" },
    { id: "t-p4", periodId: "p4", day: "TUE", subject: "World History", room: "Rm 218", teacher: "Mr. O'Connor", color: "amber" },
    { id: "t-p5", periodId: "p5", day: "TUE", subject: "Spanish III", room: "Rm 108", teacher: "Sra. Ortiz", color: "terracotta" },
    { id: "t-p6", periodId: "p6", day: "TUE", subject: "Study Hall", room: "Library", teacher: "Mr. Vance", color: "slate" },

    // Wed
    { id: "w-p1", periodId: "p1", day: "WED", subject: "AP Biology", room: "Rm 204", teacher: "Dr. Thorne", color: "sage" },
    { id: "w-p2", periodId: "p2", day: "WED", subject: "Honors Lit", room: "Rm 112", teacher: "Ms. Davies", color: "slate" },
    { id: "w-adv", periodId: "adv", day: "WED", subject: "Advisory Peer Check", room: "Rm 104", teacher: "Ms. Gallagher", color: "teal" },
    { id: "w-p3", periodId: "p3", day: "WED", subject: "Pre-Calculus", room: "Rm 305", teacher: "Mr. Vance", color: "indigo" },
    { id: "w-lun", periodId: "lunch", day: "WED", subject: "Lunch & Quad", room: "Commons", teacher: "—", color: "amber" },
    { id: "w-p4", periodId: "p4", day: "WED", subject: "World History", room: "Rm 218", teacher: "Mr. O'Connor", color: "amber" },
    { id: "w-p5", periodId: "p5", day: "WED", subject: "Spanish III", room: "Rm 108", teacher: "Sra. Ortiz", color: "terracotta" },
    { id: "w-p6", periodId: "p6", day: "WED", subject: "Studio Art", room: "Art Wing", teacher: "Ms. Chen", color: "rose" },

    // Thu
    { id: "th-p1", periodId: "p1", day: "THU", subject: "AP Biology", room: "Lab B", teacher: "Dr. Thorne", color: "sage" },
    { id: "th-p2", periodId: "p2", day: "THU", subject: "Honors Lit", room: "Rm 112", teacher: "Ms. Davies", color: "slate" },
    { id: "th-adv", periodId: "adv", day: "THU", subject: "Club Time", room: "Various", teacher: "Staff", color: "teal" },
    { id: "th-p3", periodId: "p3", day: "THU", subject: "Pre-Calculus", room: "Rm 305", teacher: "Mr. Vance", color: "indigo" },
    { id: "th-lun", periodId: "lunch", day: "THU", subject: "Lunch & Quad", room: "Commons", teacher: "—", color: "amber" },
    { id: "th-p4", periodId: "p4", day: "THU", subject: "World History", room: "Rm 218", teacher: "Mr. O'Connor", color: "amber" },
    { id: "th-p5", periodId: "p5", day: "THU", subject: "Spanish III", room: "Rm 108", teacher: "Sra. Ortiz", color: "terracotta" },
    { id: "th-p6", periodId: "p6", day: "THU", subject: "Study Hall", room: "Library", teacher: "Mr. Vance", color: "slate" },

    // Fri
    { id: "f-p1", periodId: "p1", day: "FRI", subject: "AP Biology", room: "Rm 204", teacher: "Dr. Thorne", color: "sage" },
    { id: "f-p2", periodId: "p2", day: "FRI", subject: "Honors Lit", room: "Rm 112", teacher: "Ms. Davies", color: "slate" },
    { id: "f-adv", periodId: "adv", day: "FRI", subject: "Homeroom Spirit", room: "Rm 104", teacher: "Ms. Gallagher", color: "teal" },
    { id: "f-p3", periodId: "p3", day: "FRI", subject: "Pre-Calculus", room: "Rm 305", teacher: "Mr. Vance", color: "indigo" },
    { id: "f-lun", periodId: "lunch", day: "FRI", subject: "Lunch & Quad", room: "Commons", teacher: "—", color: "amber" },
    { id: "f-p4", periodId: "p4", day: "FRI", subject: "World History", room: "Rm 218", teacher: "Mr. O'Connor", color: "amber" },
    { id: "f-p5", periodId: "p5", day: "FRI", subject: "Spanish III", room: "Rm 108", teacher: "Sra. Ortiz", color: "terracotta" },
    { id: "f-p6", periodId: "p6", day: "FRI", subject: "Pep Rally / Assembly", room: "Gym", teacher: "All", color: "rose" },
  ];

  const defaultActivities: ActivityEntry[] = [
    { id: "act-1", day: "MON", time: "15:30 - 17:00", title: "Cross Country Practice", location: "Track" },
    { id: "act-2", day: "TUE", time: "15:15 - 16:30", title: "Robotics Team Build", location: "Lab 3" },
    { id: "act-3", day: "WED", time: "15:30 - 17:00", title: "Cross Country Practice", location: "Track" },
    { id: "act-4", day: "THU", time: "15:15 - 16:15", title: "Math Tutoring Drop-in", location: "Rm 305" },
    { id: "act-5", day: "FRI", time: "16:00 - 18:00", title: "XC Dual Meet", location: "West Hills" },
  ];

  const schedule = jsonStore<ScheduleData>({
    studentName: "Alex Rivera",
    term: "Fall Semester 2026",
    homeroom: "Rm 104 · Ms. Gallagher",
    locker: "#214 (Combo: 18-32-06)",
    periods: defaultPeriods,
    classes: defaultClasses,
    activities: defaultActivities,
  });

  let showLocker = $state(false);
  let editingColorFor = $state<string | null>(null);

  let now = $state(new Date());
  const timer = setInterval(() => { now = new Date(); }, 15_000);
  onDestroy(() => clearInterval(timer));

  const dayOfWeekIndex = $derived(now.getDay()); // 0 is Sun, 1 is Mon, 5 is Fri
  const currentDayKey = $derived<DayKey | null>(
    dayOfWeekIndex >= 1 && dayOfWeekIndex <= 5 ? DAYS[dayOfWeekIndex - 1] : null
  );

  function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  const currentMinutes = $derived(now.getHours() * 60 + now.getMinutes());

  const activePeriodInfo = $derived.by(() => {
    if (!currentDayKey) return { status: "weekend", message: "Weekend · Classes resume Monday" };

    for (let i = 0; i < schedule.current.periods.length; i++) {
      const p = schedule.current.periods[i];
      const startMin = toMinutes(p.start);
      const endMin = toMinutes(p.end);

      if (currentMinutes >= startMin && currentMinutes < endMin) {
        const remaining = endMin - currentMinutes;
        const currentClass = schedule.current.classes.find(c => c.periodId === p.id && c.day === currentDayKey);
        const subj = currentClass?.subject || p.name;
        return {
          status: "in-class",
          periodId: p.id,
          message: `${p.name}: ${subj} · ${remaining}m left`,
        };
      }

      if (i < schedule.current.periods.length - 1) {
        const nextP = schedule.current.periods[i + 1];
        const nextStart = toMinutes(nextP.start);
        if (currentMinutes >= endMin && currentMinutes < nextStart) {
          const untilNext = nextStart - currentMinutes;
          return {
            status: "passing",
            periodId: null,
            message: `Passing period · ${untilNext}m until ${nextP.name}`,
          };
        }
      }
    }

    const firstPeriod = schedule.current.periods[0];
    const lastPeriod = schedule.current.periods[schedule.current.periods.length - 1];
    if (firstPeriod && currentMinutes < toMinutes(firstPeriod.start)) {
      return { status: "before", message: `Before school · ${firstPeriod.name} at ${firstPeriod.start}` };
    }
    if (lastPeriod && currentMinutes >= toMinutes(lastPeriod.end)) {
      return { status: "after", message: "School day complete · Check after-school activities" };
    }

    return { status: "idle", message: "Schedule on track" };
  });

  function getClass(day: DayKey, periodId: string): ClassEntry | undefined {
    return schedule.current.classes.find(c => c.day === day && c.periodId === periodId);
  }

  function updateClass(day: DayKey, periodId: string, field: "subject" | "room" | "teacher", value: string) {
    let entry = schedule.current.classes.find(c => c.day === day && c.periodId === periodId);
    if (!entry) {
      entry = {
        id: `${day}-${periodId}`,
        periodId,
        day,
        subject: "",
        room: "",
        teacher: "",
        color: "slate",
      };
      schedule.current.classes.push(entry);
    }
    entry[field] = value;
  }

  function setClassColor(day: DayKey, periodId: string, color: SubjectColor) {
    let entry = schedule.current.classes.find(c => c.day === day && c.periodId === periodId);
    if (!entry) {
      entry = {
        id: `${day}-${periodId}`,
        periodId,
        day,
        subject: "",
        room: "",
        teacher: "",
        color,
      };
      schedule.current.classes.push(entry);
    } else {
      entry.color = color;
    }
    editingColorFor = null;
  }

  function copyMondayToAll() {
    const mondayClasses = schedule.current.classes.filter(c => c.day === "MON");
    const otherDays: DayKey[] = ["TUE", "WED", "THU", "FRI"];
    for (const day of otherDays) {
      for (const m of mondayClasses) {
        let entry = schedule.current.classes.find(c => c.day === day && c.periodId === m.periodId);
        if (!entry) {
          entry = { id: `${day}-${m.periodId}`, periodId: m.periodId, day, subject: m.subject, room: m.room, teacher: m.teacher, color: m.color };
          schedule.current.classes.push(entry);
        } else {
          entry.subject = m.subject;
          entry.room = m.room;
          entry.teacher = m.teacher;
          entry.color = m.color;
        }
      }
    }
  }

  function addActivity(day: DayKey) {
    schedule.current.activities.push({
      id: crypto.randomUUID(),
      day,
      time: "15:30",
      title: "New Activity",
      location: "Room/Field",
    });
  }

  function removeActivity(id: string) {
    schedule.current.activities = schedule.current.activities.filter(a => a.id !== id);
  }
</script>

{#if capture.isRenderer()}
  <Icon />
{/if}

<main class="schedule-app">
  <div class="schedule-pad">
    <!-- Top Header -->
    <header class="schedule-header">
      <div class="student-meta">
        <div class="name-row">
          <input
            class="student-name-input"
            bind:value={schedule.current.studentName}
            placeholder="Student Name"
          />
          <span class="dot-sep">·</span>
          <input
            class="term-input"
            bind:value={schedule.current.term}
            placeholder="Academic Term"
          />
        </div>
        <div class="facility-row">
          <span class="label">Homeroom:</span>
          <input
            class="homeroom-input"
            bind:value={schedule.current.homeroom}
            placeholder="Homeroom & Teacher"
          />
          <span class="dot-sep">·</span>
          <span class="label">Locker:</span>
          {#if showLocker}
            <input
              class="locker-input"
              bind:value={schedule.current.locker}
              placeholder="Locker # & Combo"
            />
          {:else}
            <span class="locker-masked">#214 · ••••••</span>
          {/if}
          <button
            class="icon-toggle-btn"
            type="button"
            data-slop-export="hide"
            onclick={() => { showLocker = !showLocker; }}
            title={showLocker ? "Hide combo" : "Reveal combo"}
          >
            {#if showLocker}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
          </button>
        </div>
      </div>

      <!-- Live Bell / Status Pill -->
      <div class="bell-pill" class:active={activePeriodInfo.status === "in-class"} data-slop-export="hide">
        <Bell size={13} class="bell-icon" />
        <span class="bell-text">{activePeriodInfo.message}</span>
      </div>

      <!-- Quick Actions -->
      <div class="header-actions" data-slop-export="hide">
        <button
          type="button"
          class="action-btn"
          onclick={copyMondayToAll}
          title="Duplicate Monday's courses across Tuesday-Friday"
        >
          <Copy size={12} />
          <span>Fill Week</span>
        </button>
      </div>
    </header>

    <!-- Main Timetable Grid -->
    <div class="timetable-container">
      <table class="timetable-grid">
        <thead>
          <tr>
            <th class="time-col-header">Period & Time</th>
            {#each DAYS as day}
              <th class="day-col-header" class:current-day={day === currentDayKey}>
                <div class="day-title">{day}</div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each schedule.current.periods as period}
            {@const isCurrentPeriod = activePeriodInfo.periodId === period.id}
            <tr class="period-row" class:active-period={isCurrentPeriod}>
              <td class="period-cell">
                <input class="period-name-input" bind:value={period.name} />
                <div class="period-time-range">
                  <input class="time-input" bind:value={period.start} />
                  <span>–</span>
                  <input class="time-input" bind:value={period.end} />
                </div>
              </td>
              {#each DAYS as day}
                {@const item = getClass(day, period.id)}
                {@const isCurrentCell = isCurrentPeriod && day === currentDayKey}
                <td
                  class="class-cell color-{item?.color || 'slate'}"
                  class:current-cell={isCurrentCell}
                  class:is-break={period.name.toLowerCase().includes('lunch') || period.name.toLowerCase().includes('advisory')}
                >
                  <div class="class-card">
                    <div class="class-main">
                      <input
                        class="subject-input"
                        value={item?.subject || ""}
                        oninput={(e) => updateClass(day, period.id, "subject", e.currentTarget.value)}
                        placeholder="Subject"
                      />
                      <div class="class-sub">
                        <input
                          class="room-input"
                          value={item?.room || ""}
                          oninput={(e) => updateClass(day, period.id, "room", e.currentTarget.value)}
                          placeholder="Room"
                        />
                        <span class="sub-sep">·</span>
                        <input
                          class="teacher-input"
                          value={item?.teacher || ""}
                          oninput={(e) => updateClass(day, period.id, "teacher", e.currentTarget.value)}
                          placeholder="Teacher"
                        />
                      </div>
                    </div>

                    <!-- Color trigger -->
                    <button
                      type="button"
                      class="color-dot-btn"
                      data-slop-export="hide"
                      onclick={() => { editingColorFor = editingColorFor === `${day}-${period.id}` ? null : `${day}-${period.id}`; }}
                      title="Change color badge"
                    >
                      <span class="color-dot color-{item?.color || 'slate'}"></span>
                    </button>

                    {#if editingColorFor === `${day}-${period.id}`}
                      <div class="color-picker-pop" data-slop-export="hide">
                        {#each COLOR_PALETTE as c}
                          <button
                            type="button"
                            class="palette-chip"
                            style="background-color: {c.hex};"
                            title={c.label}
                            onclick={() => setClassColor(day, period.id, c.key)}
                          ></button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- After-School & Activities Footer Bar -->
    <section class="activities-section">
      <div class="activities-title">
        <span>AFTER-SCHOOL & ATHLETICS</span>
      </div>
      <div class="activities-grid">
        {#each DAYS as day}
          {@const dayActs = schedule.current.activities.filter(a => a.day === day)}
          <div class="day-activity-col" class:current-day={day === currentDayKey}>
            <div class="day-act-header">
              <span class="act-day-label">{day}</span>
              <button
                type="button"
                class="add-act-btn"
                data-slop-export="hide"
                onclick={() => addActivity(day)}
                title="Add after-school activity"
              >
                <Plus size={11} />
              </button>
            </div>
            <div class="acts-list">
              {#each dayActs as act (act.id)}
                <div class="act-item">
                  <input class="act-title-input" bind:value={act.title} placeholder="Activity / Sport" />
                  <div class="act-meta">
                    <input class="act-time-input" bind:value={act.time} placeholder="Time" />
                    <span>·</span>
                    <input class="act-loc-input" bind:value={act.location} placeholder="Location" />
                    <button
                      type="button"
                      class="remove-act-btn"
                      data-slop-export="hide"
                      onclick={() => removeActivity(act.id)}
                      title="Remove"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              {/each}
              {#if dayActs.length === 0}
                <div class="act-empty">—</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>
</main>

<style>
  :root {
    --bg-desktop: #1c1c1a;
    --pad-bg: #faf7f0;
    --pad-border: #ded8cb;
    --ink: #1f2328;
    --ink-muted: #656d76;
    --ink-light: #8c959f;
    --rule-color: rgba(31, 35, 40, 0.12);
    --radius-sm: 6px;
    --radius-md: 10px;

    /* Subject palette */
    --color-sage: #3b7a57;
    --color-indigo: #4f46e5;
    --color-amber: #d97706;
    --color-terracotta: #c2410c;
    --color-slate: #4a5d6e;
    --color-teal: #0d9488;
    --color-rose: #e11d48;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(html, body) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background: var(--bg-desktop);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  :global(#app) {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: stretch;
  }

  .schedule-app {
    width: 100%;
    height: 100%;
    display: flex;
    padding: 10px;
    background: var(--bg-desktop);
  }

  .schedule-pad {
    flex: 1;
    background: var(--pad-bg);
    border-radius: 18px;
    border: 1.5px solid var(--pad-border);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    padding: 14px 18px;
    gap: 10px;
    overflow: hidden;
  }

  /* Header */
  .schedule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--ink);
    padding-bottom: 10px;
    gap: 12px;
  }

  .student-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .name-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .student-name-input {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    font-weight: 800;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    width: 160px;
  }

  .term-input {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    width: 130px;
  }

  .dot-sep {
    color: var(--ink-light);
    font-size: 12px;
  }

  .facility-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--ink-muted);
  }

  .facility-row .label {
    font-weight: 600;
    color: var(--ink-light);
    text-transform: uppercase;
    font-size: 9.5px;
    letter-spacing: 0.05em;
  }

  .homeroom-input, .locker-input {
    font-size: 11px;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    border-bottom: 1px dotted var(--rule-color);
  }

  .homeroom-input { width: 140px; }
  .locker-input { width: 120px; }
  .locker-masked { font-family: monospace; font-size: 10.5px; }

  .icon-toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-light);
    display: flex;
    align-items: center;
    padding: 2px;
  }

  .icon-toggle-btn:hover { color: var(--ink); }

  /* Live Bell Status */
  .bell-pill {
    display: flex;
    align-items: center;
    gap: 7px;
    background: #eef2ed;
    border: 1px solid #c8d8c8;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    color: #2b593f;
    transition: all 0.2s ease;
  }

  .bell-pill.active {
    background: #2b593f;
    color: #ffffff;
    border-color: #2b593f;
    box-shadow: 0 2px 6px rgba(43, 89, 63, 0.25);
  }

  .bell-pill.active :global(.bell-icon) {
    color: #ffffff;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-muted);
    background: #f0ece1;
    border: 1px solid var(--pad-border);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
  }

  .action-btn:hover {
    background: #e5decb;
    color: var(--ink);
  }

  /* Timetable Grid */
  .timetable-container {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--pad-border);
    border-radius: var(--radius-sm);
    background: #ffffff;
  }

  .timetable-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  th {
    padding: 6px 8px;
    background: #f5efe3;
    border-bottom: 2px solid var(--pad-border);
    border-right: 1px solid var(--pad-border);
    text-align: left;
  }

  .time-col-header {
    width: 100px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    font-weight: 700;
  }

  .day-col-header {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--ink);
    text-align: center;
  }

  .day-col-header.current-day {
    background: #e8f1ec;
    color: #2b593f;
    border-bottom-color: #2b593f;
  }

  td {
    border-bottom: 1px solid var(--rule-color);
    border-right: 1px solid var(--rule-color);
    vertical-align: top;
    padding: 4px 6px;
  }

  .period-cell {
    background: #fdfbf7;
  }

  .period-name-input {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    width: 100%;
  }

  .period-time-range {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 9.5px;
    font-family: monospace;
    color: var(--ink-muted);
  }

  .time-input {
    font-size: 9.5px;
    font-family: monospace;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    width: 32px;
  }

  .period-row.active-period td {
    background-color: #f7faf7;
  }

  .period-row.active-period .period-cell {
    border-left: 3px solid #2b593f;
  }

  /* Class Cell */
  .class-cell {
    position: relative;
    height: 48px;
    transition: background 0.15s ease;
  }

  .class-cell.current-cell {
    background: #f0f7f2 !important;
  }

  .class-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    height: 100%;
    border-left: 3px solid var(--color-slate);
    padding-left: 5px;
  }

  .class-cell.color-sage .class-card { border-left-color: var(--color-sage); }
  .class-cell.color-indigo .class-card { border-left-color: var(--color-indigo); }
  .class-cell.color-amber .class-card { border-left-color: var(--color-amber); }
  .class-cell.color-terracotta .class-card { border-left-color: var(--color-terracotta); }
  .class-cell.color-slate .class-card { border-left-color: var(--color-slate); }
  .class-cell.color-teal .class-card { border-left-color: var(--color-teal); }
  .class-cell.color-rose .class-card { border-left-color: var(--color-rose); }

  .class-cell.is-break {
    background: #faf8f2;
  }

  .class-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .subject-input {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .class-sub {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 9.5px;
    color: var(--ink-muted);
  }

  .room-input {
    font-size: 9.5px;
    color: var(--ink-muted);
    font-weight: 600;
    background: transparent;
    border: none;
    outline: none;
    width: 42px;
  }

  .teacher-input {
    font-size: 9.5px;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    flex: 1;
    min-width: 30px;
  }

  .sub-sep { color: var(--ink-light); }

  .color-dot-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px;
    opacity: 0;
  }

  .class-cell:hover .color-dot-btn {
    opacity: 1;
  }

  .color-dot {
    display: block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-slate);
  }

  .color-dot.color-sage { background: var(--color-sage); }
  .color-dot.color-indigo { background: var(--color-indigo); }
  .color-dot.color-amber { background: var(--color-amber); }
  .color-dot.color-terracotta { background: var(--color-terracotta); }
  .color-dot.color-slate { background: var(--color-slate); }
  .color-dot.color-teal { background: var(--color-teal); }
  .color-dot.color-rose { background: var(--color-rose); }

  .color-picker-pop {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 10;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    gap: 4px;
    padding: 4px;
  }

  .palette-chip {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
  }

  /* After-School Activities */
  .activities-section {
    background: #f7f3e8;
    border: 1px solid var(--pad-border);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .activities-title {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
  }

  .activities-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .day-activity-col {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .day-activity-col.current-day {
    border-color: #2b593f;
    background: #fafffb;
  }

  .day-act-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--rule-color);
    padding-bottom: 2px;
  }

  .act-day-label {
    font-size: 9px;
    font-weight: 800;
    color: var(--ink);
  }

  .add-act-btn {
    background: none;
    border: none;
    color: var(--ink-light);
    cursor: pointer;
    padding: 1px;
  }

  .add-act-btn:hover { color: #2b593f; }

  .acts-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .act-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    border-left: 2px solid #2b593f;
    padding-left: 4px;
  }

  .act-title-input {
    font-size: 10px;
    font-weight: 700;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
  }

  .act-meta {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 8.5px;
    color: var(--ink-muted);
  }

  .act-time-input, .act-loc-input {
    font-size: 8.5px;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    width: 46px;
  }

  .remove-act-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-light);
    padding: 0;
    opacity: 0;
    margin-left: auto;
  }

  .act-item:hover .remove-act-btn { opacity: 1; }
  .remove-act-btn:hover { color: #e11d48; }

  .act-empty {
    font-size: 10px;
    color: var(--ink-light);
    text-align: center;
    padding: 2px 0;
  }

  /* Export overrides */
  :global(html[data-slop-capture="static"] [data-slop-export="hide"]) {
    display: none !important;
  }

  :global(html[data-slop-capture="static"]) input {
    border: none !important;
    background: transparent !important;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .schedule-app {
    display: none;
  }
</style>
