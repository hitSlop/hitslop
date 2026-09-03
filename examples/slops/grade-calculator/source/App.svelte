<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Award from "@lucide/svelte/icons/award";
  import Calculator from "@lucide/svelte/icons/calculator";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Target from "@lucide/svelte/icons/target";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { Slider, Tabs } from "bits-ui";
  import Icon from "./Icon.svelte";
  import type { CategoryWeight, CourseGrade, GradeCalculatorData } from "./types";

  const defaultCourses: CourseGrade[] = [
    {
      id: "c1",
      code: "BIO 101",
      name: "AP Biology",
      credits: 4.0,
      targetPercent: 90,
      categories: [
        { id: "cat-1", name: "Homework & Problem Sets", weightPercent: 20, scorePercent: 95, isFinal: false },
        { id: "cat-2", name: "Lab Reports", weightPercent: 25, scorePercent: 92, isFinal: false },
        { id: "cat-3", name: "Midterm Exams", weightPercent: 25, scorePercent: 88, isFinal: false },
        { id: "cat-4", name: "Comprehensive Final Exam", weightPercent: 30, scorePercent: null, isFinal: true },
      ],
    },
    {
      id: "c2",
      code: "MATH 150",
      name: "Pre-Calculus",
      credits: 4.0,
      targetPercent: 90,
      categories: [
        { id: "cat-5", name: "Weekly Quizzes", weightPercent: 25, scorePercent: 86, isFinal: false },
        { id: "cat-6", name: "Midterm 1 & 2", weightPercent: 40, scorePercent: 89, isFinal: false },
        { id: "cat-7", name: "Final Exam", weightPercent: 35, scorePercent: null, isFinal: true },
      ],
    },
    {
      id: "c3",
      code: "ENG 201",
      name: "Honors Literature",
      credits: 3.0,
      targetPercent: 93,
      categories: [
        { id: "cat-8", name: "Essays & Papers", weightPercent: 50, scorePercent: 96, isFinal: false },
        { id: "cat-9", name: "Seminar Participation", weightPercent: 20, scorePercent: 98, isFinal: false },
        { id: "cat-10", name: "Final Portfolio", weightPercent: 30, scorePercent: null, isFinal: true },
      ],
    },
    {
      id: "c4",
      code: "HIST 110",
      name: "World History",
      credits: 3.0,
      targetPercent: 85,
      categories: [
        { id: "cat-11", name: "Primary Source DBQs", weightPercent: 35, scorePercent: 84, isFinal: false },
        { id: "cat-12", name: "Unit Tests", weightPercent: 35, scorePercent: 82, isFinal: false },
        { id: "cat-13", name: "Semester Exam", weightPercent: 30, scorePercent: null, isFinal: true },
      ],
    },
  ];

  const store = jsonStore<GradeCalculatorData>({
    studentName: "Alex Rivera",
    term: "Fall Semester 2026",
    courses: defaultCourses,
  });

  let selectedCourseId = $state<string>("c1");

  const selectedCourse = $derived(
    store.current.courses.find(c => c.id === selectedCourseId) || store.current.courses[0]
  );

  function percentToGradeLetter(pct: number): { letter: string; gpa: number; color: string } {
    if (pct >= 93) return { letter: "A", gpa: 4.0, color: "#2b593f" };
    if (pct >= 90) return { letter: "A-", gpa: 3.7, color: "#2b593f" };
    if (pct >= 87) return { letter: "B+", gpa: 3.3, color: "#2563eb" };
    if (pct >= 83) return { letter: "B", gpa: 3.0, color: "#2563eb" };
    if (pct >= 80) return { letter: "B-", gpa: 2.7, color: "#2563eb" };
    if (pct >= 77) return { letter: "C+", gpa: 2.3, color: "#d97706" };
    if (pct >= 73) return { letter: "C", gpa: 2.0, color: "#d97706" };
    if (pct >= 70) return { letter: "C-", gpa: 1.7, color: "#d97706" };
    if (pct >= 60) return { letter: "D", gpa: 1.0, color: "#ea580c" };
    return { letter: "F", gpa: 0.0, color: "#dc2626" };
  }

  function calculateCourseMetrics(course: CourseGrade) {
    let gradedWeight = 0;
    let earnedWeight = 0;
    let finalCategory = course.categories.find(c => c.isFinal);

    for (const cat of course.categories) {
      if (cat.scorePercent !== null && cat.scorePercent !== undefined) {
        gradedWeight += cat.weightPercent;
        earnedWeight += (cat.weightPercent * cat.scorePercent) / 100;
      }
    }

    const currentAverage = gradedWeight > 0 ? (earnedWeight / gradedWeight) * 100 : 0;
    const currentGrade = percentToGradeLetter(currentAverage);

    // Final exam solver
    let neededOnFinal: number | null = null;
    let solverStatus: "possible" | "locked" | "impossible" | "no-final" = "possible";

    if (finalCategory && finalCategory.weightPercent > 0) {
      const remainingTargetPoints = course.targetPercent - earnedWeight;
      neededOnFinal = (remainingTargetPoints / finalCategory.weightPercent) * 100;

      if (neededOnFinal <= 0) {
        solverStatus = "locked";
      } else if (neededOnFinal > 100) {
        solverStatus = "impossible";
      } else {
        solverStatus = "possible";
      }
    } else {
      solverStatus = "no-final";
    }

    return {
      gradedWeight,
      earnedWeight,
      currentAverage,
      currentGrade,
      finalCategory,
      neededOnFinal,
      solverStatus,
    };
  }

  const selectedMetrics = $derived(
    selectedCourse ? calculateCourseMetrics(selectedCourse) : null
  );

  const overallTermGPA = $derived.by(() => {
    let totalQualityPoints = 0;
    let totalCredits = 0;
    for (const c of store.current.courses) {
      const m = calculateCourseMetrics(c);
      totalQualityPoints += m.currentGrade.gpa * c.credits;
      totalCredits += c.credits;
    }
    return totalCredits > 0 ? (totalQualityPoints / totalCredits).toFixed(2) : "0.00";
  });

  const totalCredits = $derived(
    store.current.courses.reduce((sum, c) => sum + (c.credits || 0), 0)
  );

  function addCourse() {
    const id = crypto.randomUUID();
    store.current.courses.push({
      id,
      code: "NEW 101",
      name: "New Course",
      credits: 3.0,
      targetPercent: 90,
      categories: [
        { id: crypto.randomUUID(), name: "Assignments", weightPercent: 40, scorePercent: 90, isFinal: false },
        { id: crypto.randomUUID(), name: "Midterm Exam", weightPercent: 30, scorePercent: 85, isFinal: false },
        { id: crypto.randomUUID(), name: "Final Exam", weightPercent: 30, scorePercent: null, isFinal: true },
      ],
    });
    selectedCourseId = id;
  }

  function removeCourse(id: string) {
    store.current.courses = store.current.courses.filter(c => c.id !== id);
    if (selectedCourseId === id && store.current.courses.length > 0) {
      selectedCourseId = store.current.courses[0].id;
    }
  }

  function addCategory() {
    if (!selectedCourse) return;
    selectedCourse.categories.push({
      id: crypto.randomUUID(),
      name: "New Category",
      weightPercent: 10,
      scorePercent: null,
      isFinal: false,
    });
  }

  function removeCategory(catId: string) {
    if (!selectedCourse) return;
    selectedCourse.categories = selectedCourse.categories.filter(c => c.id !== catId);
  }

  function setFinalCategory(catId: string) {
    if (!selectedCourse) return;
    for (const c of selectedCourse.categories) {
      c.isFinal = c.id === catId;
    }
  }
</script>

{#if capture.isRenderer()}
  <Icon />
{/if}

<main class="grade-app">
  <div class="grade-ledger">
    <!-- Header -->
    <header class="ledger-header">
      <div class="meta-block">
        <div class="header-label">ACADEMIC GRADEBOOK & FORECASTER</div>
        <div class="title-row">
          <input class="student-name" bind:value={store.current.studentName} placeholder="Student Name" />
          <span class="dot">·</span>
          <input class="term-name" bind:value={store.current.term} placeholder="Academic Term" />
        </div>
      </div>

      <!-- Cumulative GPA Pill -->
      <div class="gpa-summary-card">
        <div class="gpa-badge">
          <span class="gpa-val">{overallTermGPA}</span>
          <span class="gpa-label">TERM GPA</span>
        </div>
        <div class="gpa-meta">
          <span class="gpa-credits">{totalCredits} Enrolled Credits</span>
          <span class="gpa-status">Good Standing</span>
        </div>
      </div>
    </header>

    <!-- Main Workspace -->
    <div class="ledger-body">
      <!-- Course Selector Sidebar -->
      <aside class="courses-sidebar">
        <div class="sidebar-head">
          <span class="sidebar-title">COURSES</span>
          <button
            type="button"
            class="add-course-btn"
            data-slop-export="hide"
            onclick={addCourse}
            title="Add new course"
          >
            <Plus size={12} />
          </button>
        </div>

        <Tabs.Root
          value={selectedCourseId}
          onValueChange={(v) => { if (v) selectedCourseId = v; }}
        >
          <Tabs.List class="courses-nav" aria-label="Courses">
            {#each store.current.courses as course (course.id)}
              {@const m = calculateCourseMetrics(course)}
              <Tabs.Trigger
                value={course.id}
                class="course-nav-item {course.id === selectedCourseId ? 'active' : ''}"
              >
                <div class="course-nav-left">
                  <span class="course-code">{course.code}</span>
                  <span class="course-title">{course.name}</span>
                </div>
                <div class="course-nav-right">
                  <span class="grade-badge" style="background-color: {m.currentGrade.color};">
                    {m.currentGrade.letter}
                  </span>
                  <span class="avg-pct">{m.currentAverage.toFixed(1)}%</span>
                </div>
              </Tabs.Trigger>
            {/each}
          </Tabs.List>
        </Tabs.Root>
      </aside>

      <!-- Course Detail & Target Solver -->
      {#if selectedCourse && selectedMetrics}
        <section class="course-detail-view">
          <!-- Course Subheader -->
          <div class="detail-header">
            <div class="course-info">
              <input class="course-code-input" bind:value={selectedCourse.code} />
              <span class="sep">·</span>
              <input class="course-name-input" bind:value={selectedCourse.name} />
              <div class="credits-wrap">
                <input class="credits-input" type="number" step="0.5" bind:value={selectedCourse.credits} />
                <span class="credits-lbl">cr</span>
              </div>
            </div>

            <button
              type="button"
              class="del-course-btn"
              data-slop-export="hide"
              onclick={() => removeCourse(selectedCourse.id)}
              title="Delete course"
            >
              <Trash2 size={12} />
            </button>
          </div>

          <!-- Weights Table -->
          <div class="weights-table-container">
            <table class="weights-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th style="width: 80px;">Weight %</th>
                  <th style="width: 90px;">Score %</th>
                  <th style="width: 85px;">Weighted</th>
                  <th style="width: 70px;">Final Exam</th>
                  <th style="width: 30px;" data-slop-export="hide"></th>
                </tr>
              </thead>
              <tbody>
                {#each selectedCourse.categories as cat (cat.id)}
                  {@const weighted = cat.scorePercent !== null ? ((cat.weightPercent * cat.scorePercent) / 100).toFixed(1) : "—"}
                  <tr>
                    <td>
                      <input class="table-input" bind:value={cat.name} placeholder="Category" />
                    </td>
                    <td>
                      <div class="num-unit">
                        <input class="table-num" type="number" bind:value={cat.weightPercent} min="0" max="100" />
                        <span>%</span>
                      </div>
                    </td>
                    <td>
                      <div class="num-unit">
                        <input
                          class="table-num"
                          type="number"
                          placeholder="Pending"
                          value={cat.scorePercent ?? ""}
                          oninput={(e) => {
                            const val = e.currentTarget.value;
                            cat.scorePercent = val === "" ? null : Number(val);
                          }}
                          min="0"
                          max="150"
                        />
                        <span>%</span>
                      </div>
                    </td>
                    <td class="weighted-col">
                      <span>{weighted}%</span>
                    </td>
                    <td class="final-toggle-col">
                      <button
                        type="button"
                        class="final-chip"
                        class:is-final={cat.isFinal}
                        data-slop-export="hide"
                        onclick={() => setFinalCategory(cat.id)}
                        title={cat.isFinal ? "Designated final exam" : "Click to set as final exam"}
                      >
                        {cat.isFinal ? "Final" : "—"}
                      </button>
                    </td>
                    <td data-slop-export="hide">
                      <button
                        type="button"
                        class="cat-del-btn"
                        onclick={() => removeCategory(cat.id)}
                        title="Delete category"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>

            <div class="add-cat-row" data-slop-export="hide">
              <button type="button" class="add-cat-btn" onclick={addCategory}>
                <Plus size={11} />
                <span>Add Syllabus Category</span>
              </button>
            </div>
          </div>

          <!-- Solver Card: What do I need on the final? -->
          <div class="solver-card">
            <div class="solver-top">
              <div class="solver-title-wrap">
                <Target size={14} class="solver-icon" />
                <span class="solver-title">WHAT DO I NEED ON THE FINAL?</span>
              </div>

              <!-- Target Slider -->
              <div class="target-controller">
                <span class="target-lbl">Target Grade:</span>
                <Slider.Root
                  type="single"
                  bind:value={selectedCourse.targetPercent}
                  min={70}
                  max={98}
                  step={1}
                  class="target-slider-root"
                  aria-label="Target Grade"
                >
                  {#snippet children({ thumbs })}
                    <span class="target-slider-track">
                      <Slider.Range class="target-slider-range" />
                    </span>
                    {#each thumbs as index}
                      <Slider.Thumb {index} class="target-slider-thumb" aria-label="Target percent" />
                    {/each}
                  {/snippet}
                </Slider.Root>
                <span class="target-val">{selectedCourse.targetPercent}% ({percentToGradeLetter(selectedCourse.targetPercent).letter})</span>
              </div>
            </div>

            <div class="solver-result-banner">
              {#if selectedMetrics.solverStatus === "locked"}
                <div class="result-box success">
                  <Check size={16} />
                  <span><strong>Locked in!</strong> You have already secured your target {percentToGradeLetter(selectedCourse.targetPercent).letter} even with 0% on the final.</span>
                </div>
              {:else if selectedMetrics.solverStatus === "impossible"}
                <div class="result-box alert">
                  <span>Target requires <strong>{selectedMetrics.neededOnFinal?.toFixed(1)}%</strong> on the final exam ({selectedMetrics.finalCategory?.name}). Extra credit required.</span>
                </div>
              {:else if selectedMetrics.solverStatus === "possible"}
                <div class="result-box target">
                  <Calculator size={16} />
                  <span>You need <strong>{selectedMetrics.neededOnFinal?.toFixed(1)}%</strong> on the {selectedMetrics.finalCategory?.name || "Final Exam"} to earn an <strong>{percentToGradeLetter(selectedCourse.targetPercent).letter} ({selectedCourse.targetPercent}%)</strong> in this course.</span>
                </div>
              {:else}
                <div class="result-box muted">
                  <span>Mark one category above as "Final Exam" to enable the exam target solver.</span>
                </div>
              {/if}
            </div>
          </div>
        </section>
      {/if}
    </div>
  </div>
</main>

<style>
  :root {
    --bg-desk: #171615;
    --pad-sheet: #fdfbf7;
    --pad-border: #ded7c7;
    --ink: #1f2328;
    --ink-muted: #57606a;
    --ink-light: #8c959f;
    --rule: rgba(31, 35, 40, 0.08);
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
    background: var(--bg-desk);
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

  .grade-app {
    width: 100%;
    height: 100%;
    display: flex;
    padding: 10px;
    background: var(--bg-desk);
  }

  .grade-ledger {
    flex: 1;
    background: var(--pad-sheet);
    border-radius: 16px;
    border: 1.5px solid var(--pad-border);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    padding: 14px 18px;
    gap: 10px;
    overflow: hidden;
  }

  /* Header */
  .ledger-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--ink);
    padding-bottom: 8px;
  }

  .header-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--ink-light);
  }

  .title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .student-name {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    font-weight: 800;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    width: 140px;
  }

  .term-name {
    font-size: 12px;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    width: 130px;
  }

  .dot { color: var(--ink-light); }

  .gpa-summary-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 10px;
    padding: 6px 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  }

  .gpa-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #2b593f;
    color: #ffffff;
    border-radius: 6px;
    padding: 2px 8px;
  }

  .gpa-val {
    font-size: 15px;
    font-weight: 900;
    font-family: monospace;
  }

  .gpa-label {
    font-size: 7.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    opacity: 0.9;
  }

  .gpa-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .gpa-credits {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
  }

  .gpa-status {
    font-size: 9.5px;
    color: #2b593f;
    font-weight: 600;
  }

  /* Body Layout */
  .ledger-body {
    flex: 1;
    display: flex;
    gap: 12px;
    min-height: 0;
  }

  /* Sidebar */
  .courses-sidebar {
    width: 200px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-right: 1px solid var(--rule);
    padding-right: 10px;
  }

  .sidebar-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 4px;
  }

  .sidebar-title {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--ink-light);
  }

  .add-course-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-light);
    padding: 2px;
  }

  .add-course-btn:hover { color: #2b593f; }

  :global(.courses-nav) {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.course-nav-item) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #ffffff;
    border: 1px solid var(--pad-border);
    border-radius: 6px;
    padding: 6px 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  :global(.course-nav-item.active),
  :global(.course-nav-item[data-state="active"]) {
    border-color: var(--ink);
    background: #f5ede0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }

  .course-nav-left {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .course-code {
    font-size: 11px;
    font-weight: 800;
    color: var(--ink);
  }

  .course-title {
    font-size: 9.5px;
    color: var(--ink-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .course-nav-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .grade-badge {
    font-size: 9px;
    font-weight: 800;
    color: #ffffff;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .avg-pct {
    font-size: 9.5px;
    font-family: monospace;
    font-weight: 600;
    color: var(--ink-muted);
  }

  /* Detail View */
  .course-detail-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid var(--pad-border);
    padding-bottom: 6px;
  }

  .course-info {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .course-code-input {
    font-size: 14px;
    font-weight: 800;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    width: 90px;
  }

  .course-name-input {
    font-size: 13px;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    outline: none;
    width: 160px;
  }

  .sep { color: var(--ink-light); }

  .credits-wrap {
    display: flex;
    align-items: center;
    gap: 2px;
    background: #f1ede3;
    border-radius: 4px;
    padding: 2px 5px;
  }

  .credits-input {
    width: 24px;
    font-size: 10px;
    font-family: monospace;
    font-weight: 700;
    border: none;
    background: transparent;
    outline: none;
    text-align: right;
  }

  .credits-lbl {
    font-size: 9px;
    color: var(--ink-light);
    font-weight: 700;
  }

  .del-course-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-light);
    padding: 3px;
  }

  .del-course-btn:hover { color: #dc2626; }

  /* Weights Table */
  .weights-table-container {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--pad-border);
    border-radius: 6px;
    background: #ffffff;
    display: flex;
    flex-direction: column;
  }

  .weights-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  th {
    background: #f7f3ea;
    padding: 4px 8px;
    text-align: left;
    font-size: 9.5px;
    font-weight: 700;
    color: var(--ink-muted);
    border-bottom: 1px solid var(--pad-border);
  }

  td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--rule);
    vertical-align: middle;
  }

  .table-input {
    width: 100%;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
  }

  .num-unit {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .table-num {
    width: 38px;
    font-size: 11px;
    font-family: monospace;
    font-weight: 700;
    background: #fbf9f4;
    border: 1px solid var(--pad-border);
    border-radius: 4px;
    padding: 2px 4px;
    outline: none;
    text-align: right;
  }

  .weighted-col {
    font-family: monospace;
    font-weight: 700;
    color: var(--ink);
  }

  .final-chip {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--pad-border);
    background: #f4ede1;
    cursor: pointer;
    color: var(--ink-muted);
  }

  .final-chip.is-final {
    background: #2b593f;
    color: #ffffff;
    border-color: #2b593f;
  }

  .cat-del-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-light);
    padding: 2px;
  }

  .cat-del-btn:hover { color: #dc2626; }

  .add-cat-row {
    padding: 6px 8px;
    border-top: 1px dashed var(--pad-border);
    background: #faf8f2;
  }

  .add-cat-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    background: none;
    border: none;
    color: var(--ink-muted);
    cursor: pointer;
  }

  .add-cat-btn:hover { color: #2b593f; }

  /* Solver Card */
  .solver-card {
    background: #f7f3ea;
    border: 1.5px solid var(--pad-border);
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .solver-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .solver-title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #2b593f;
  }

  .solver-title {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .target-controller {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
  }

  .target-lbl { color: var(--ink-muted); }
  :global(.target-slider-root) {
    position: relative;
    display: flex;
    align-items: center;
    width: 90px;
    height: 16px;
    touch-action: none;
    user-select: none;
  }
  :global(.target-slider-track) {
    position: relative;
    width: 100%;
    height: 4px;
    background: rgba(0, 0, 0, 0.12);
    border-radius: 2px;
    overflow: hidden;
  }
  :global(.target-slider-range) {
    position: absolute;
    height: 100%;
    background: var(--blue-accent);
  }
  :global(.target-slider-thumb) {
    display: block;
    width: 12px;
    height: 12px;
    background: var(--blue-accent);
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    cursor: grab;
    outline: none;
  }
  .target-val { font-weight: 800; font-family: monospace; color: var(--ink); }

  .solver-result-banner {
    font-size: 11px;
  }

  .result-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
  }

  .result-box.target {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1e40af;
  }

  .result-box.success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
  }

  .result-box.alert {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #9a3412;
  }

  .result-box.muted {
    background: #ffffff;
    border: 1px solid var(--pad-border);
    color: var(--ink-muted);
  }

  /* Export mode */
  :global(html[data-slop-capture="static"] [data-slop-export="hide"]) {
    display: none !important;
  }

  :global(html[data-slop-capture="static"]) input {
    border: none !important;
    background: transparent !important;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .grade-app {
    display: none;
  }
</style>
