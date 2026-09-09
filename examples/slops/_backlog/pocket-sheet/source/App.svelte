<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Bold from "@lucide/svelte/icons/bold";
  import Download from "@lucide/svelte/icons/download";
  import Plus from "@lucide/svelte/icons/plus";
  import {
    colToLetter,
    evaluateCell,
    type CellValue,
  } from "./engine";
  import Icon from "./Icon.svelte";

  type CellStyle = {
    bold?: boolean;
    align?: "left" | "center" | "right";
    currency?: boolean;
  };

  type CellData = {
    raw: string;
    style?: CellStyle;
  };

  type SheetData = {
    title: string;
    rows: number;
    cols: number;
    cells: Record<string, CellData>;
  };

  const doc = jsonStore<SheetData>({
    title: "Quarterly Budget & Estimates",
    rows: 16,
    cols: 7,
    cells: {
      A1: { raw: "Category", style: { bold: true } },
      B1: { raw: "Q1 Budget", style: { bold: true, align: "right" } },
      C1: { raw: "Actual", style: { bold: true, align: "right" } },
      D1: { raw: "Variance", style: { bold: true, align: "right" } },
      E1: { raw: "Status", style: { bold: true, align: "center" } },
      F1: { raw: "Progress", style: { bold: true } },

      A2: { raw: "Engineering" },
      B2: { raw: "18000" },
      C2: { raw: "16500" },
      D2: { raw: "=B2-C2" },
      E2: { raw: '=TAG("On Track")' },
      F2: { raw: "=PROGRESS(0.91)" },

      A3: { raw: "Design & UX" },
      B3: { raw: "9500" },
      C3: { raw: "9200" },
      D3: { raw: "=B3-C3" },
      E3: { raw: '=TAG("On Track")' },
      F3: { raw: "=PROGRESS(0.96)" },

      A4: { raw: "Cloud Infra" },
      B4: { raw: "4200" },
      C4: { raw: "4750" },
      D4: { raw: "=B4-C4" },
      E4: { raw: '=TAG("Over")' },
      F4: { raw: "=PROGRESS(1.13)" },

      A5: { raw: "Marketing" },
      B5: { raw: "6000" },
      C5: { raw: "5200" },
      D5: { raw: "=B5-C5" },
      E5: { raw: '=TAG("Under")' },
      F5: { raw: "=PROGRESS(0.86)" },

      A7: { raw: "TOTAL", style: { bold: true } },
      B7: { raw: "=SUM(B2:B5)", style: { bold: true, align: "right" } },
      C7: { raw: "=SUM(C2:C5)", style: { bold: true, align: "right" } },
      D7: { raw: "=SUM(D2:D5)", style: { bold: true, align: "right" } },
    },
  });

  let activeRow = $state(1);
  let activeCol = $state(1);
  let selStartRow = $state(1);
  let selStartCol = $state(1);
  let selEndRow = $state(1);
  let selEndCol = $state(1);
  let isEditing = $state(false);
  let editInputEl: HTMLInputElement | undefined = $state();

  function getRef(row: number, col: number): string {
    return `${colToLetter(col)}${row + 1}`;
  }

  const activeRef = $derived(getRef(activeRow, activeCol));

  function getRaw(ref: string): string {
    return doc.current.cells[ref]?.raw || "";
  }

  function setRaw(ref: string, val: string) {
    if (!doc.current.cells[ref]) {
      doc.current.cells[ref] = { raw: val };
    } else {
      doc.current.cells[ref].raw = val;
    }
  }

  function getStyle(ref: string): CellStyle {
    return doc.current.cells[ref]?.style || {};
  }

  function toggleBold() {
    const s = getStyle(activeRef);
    if (!doc.current.cells[activeRef]) {
      doc.current.cells[activeRef] = { raw: "", style: { bold: true } };
    } else {
      doc.current.cells[activeRef].style = { ...s, bold: !s.bold };
    }
  }

  function setAlign(align: "left" | "center" | "right") {
    const s = getStyle(activeRef);
    if (!doc.current.cells[activeRef]) {
      doc.current.cells[activeRef] = { raw: "", style: { align } };
    } else {
      doc.current.cells[activeRef].style = { ...s, align };
    }
  }

  function addRow() {
    doc.current.rows += 1;
  }

  function addCol() {
    doc.current.cols += 1;
  }

  function selectCell(r: number, c: number, extend = false) {
    if (extend) {
      selEndRow = r;
      selEndCol = c;
    } else {
      activeRow = r;
      activeCol = c;
      selStartRow = r;
      selStartCol = c;
      selEndRow = r;
      selEndCol = c;
    }
    isEditing = false;
  }

  function startEditing() {
    isEditing = true;
    setTimeout(() => {
      if (editInputEl) {
        editInputEl.focus();
        editInputEl.select();
      }
    }, 10);
  }

  function isCellSelected(r: number, c: number): boolean {
    const minR = Math.min(selStartRow, selEndRow);
    const maxR = Math.max(selStartRow, selEndRow);
    const minC = Math.min(selStartCol, selEndCol);
    const maxC = Math.max(selStartCol, selEndCol);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }

  // Calculate live selection stats
  const selectionStats = $derived.by(() => {
    const minR = Math.min(selStartRow, selEndRow);
    const maxR = Math.max(selStartRow, selEndRow);
    const minC = Math.min(selStartCol, selEndCol);
    const maxC = Math.max(selStartCol, selEndCol);

    let count = 0;
    let sum = 0;
    let numericCount = 0;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const ref = getRef(r, c);
        const raw = getRaw(ref);
        if (raw && raw.trim() !== "") {
          count++;
          const val = evaluateCell(raw, getRaw);
          if (val.numeric !== undefined) {
            sum += val.numeric;
            numericCount++;
          }
        }
      }
    }

    const avg = numericCount > 0 ? Math.round((sum / numericCount) * 100) / 100 : 0;
    return { count, sum: Math.round(sum * 100) / 100, avg };
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (isEditing) {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        isEditing = false;
        if (e.key === "Enter") {
          activeRow = Math.min(doc.current.rows - 1, activeRow + 1);
        } else {
          activeCol = Math.min(doc.current.cols - 1, activeCol + 1);
        }
        selectCell(activeRow, activeCol);
      } else if (e.key === "Escape") {
        isEditing = false;
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeRow = Math.max(0, activeRow - 1);
      selectCell(activeRow, activeCol, e.shiftKey);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      activeRow = Math.min(doc.current.rows - 1, activeRow + 1);
      selectCell(activeRow, activeCol, e.shiftKey);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      activeCol = Math.max(0, activeCol - 1);
      selectCell(activeRow, activeCol, e.shiftKey);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      activeCol = Math.min(doc.current.cols - 1, activeCol + 1);
      selectCell(activeRow, activeCol, e.shiftKey);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEditing();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      setRaw(activeRef, "");
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // Start typing directly into active cell
      isEditing = true;
      setRaw(activeRef, e.key);
      setTimeout(() => {
        if (editInputEl) {
          editInputEl.focus();
        }
      }, 10);
    }
  }

  function exportCSV() {
    let csv = "";
    for (let r = 0; r < doc.current.rows; r++) {
      const rowVals: string[] = [];
      for (let c = 0; c < doc.current.cols; c++) {
        const ref = getRef(r, c);
        const evalVal = evaluateCell(getRaw(ref), getRaw);
        const clean = String(evalVal.display).replace(/"/g, '""');
        rowVals.push(`"${clean}"`);
      }
      csv += rowVals.join(",") + "\n";
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.current.title.toLowerCase().replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<main class="sheet-canvas">
  <article class="sheet-chassis">
    <!-- Top Toolbar -->
    <header class="sheet-topbar">
      <input
        class="title-input"
        aria-label="Spreadsheet Title"
        bind:value={doc.current.title}
      />

      <div class="toolbar-actions" data-slop-export="hide">
        <button
          type="button"
          class="tool-btn"
          class:active={getStyle(activeRef).bold}
          title="Bold"
          onclick={toggleBold}
        >
          <Bold size={13} />
        </button>

        <button
          type="button"
          class="tool-btn"
          title="Align Left"
          onclick={() => setAlign("left")}
        >
          L
        </button>
        <button
          type="button"
          class="tool-btn"
          title="Align Center"
          onclick={() => setAlign("center")}
        >
          C
        </button>
        <button
          type="button"
          class="tool-btn"
          title="Align Right"
          onclick={() => setAlign("right")}
        >
          R
        </button>

        <button
          type="button"
          class="tool-btn"
          title="Add Row"
          onclick={addRow}
        >
          <Plus size={12} /> Row
        </button>
        <button
          type="button"
          class="tool-btn"
          title="Add Column"
          onclick={addCol}
        >
          <Plus size={12} /> Col
        </button>

        <button
          type="button"
          class="tool-btn"
          title="Export CSV"
          onclick={exportCSV}
        >
          <Download size={13} />
        </button>
      </div>
    </header>

    <!-- Formula Bar -->
    <section class="formula-bar" aria-label="Formula Bar">
      <span class="cell-pill">{activeRef}</span>
      <span class="fx-label">fx</span>
      <input
        class="formula-input"
        aria-label="Cell Formula"
        value={getRaw(activeRef)}
        oninput={(e) => setRaw(activeRef, (e.target as HTMLInputElement).value)}
      />
    </section>

    <!-- Grid Viewport -->
    <section class="grid-viewport" aria-label="Grid Table">
      <table class="spreadsheet-table">
        <thead>
          <tr>
            <th class="corner-header"></th>
            {#each Array(doc.current.cols) as _, c}
              <th class="col-header">{colToLetter(c)}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each Array(doc.current.rows) as _, r}
            <tr>
              <th class="row-header">{r + 1}</th>
              {#each Array(doc.current.cols) as _, c}
                {@const ref = getRef(r, c)}
                {@const raw = getRaw(ref)}
                {@const res = evaluateCell(raw, getRaw)}
                {@const style = getStyle(ref)}
                {@const isSelected = isCellSelected(r, c)}
                {@const isActive = activeRow === r && activeCol === c}

                <td
                  class="grid-cell"
                  class:selected={isSelected}
                  class:active-cell={isActive}
                  class:bold={style.bold}
                  class:align-left={style.align === "left"}
                  class:align-center={style.align === "center"}
                  class:align-right={style.align === "right" || (res.numeric !== undefined && !style.align)}
                  onclick={(e) => selectCell(r, c, e.shiftKey)}
                  ondblclick={startEditing}
                >
                  {#if isActive && isEditing}
                    <input
                      bind:this={editInputEl}
                      class="cell-edit-input"
                      value={raw}
                      oninput={(e) => setRaw(ref, (e.target as HTMLInputElement).value)}
                      onblur={() => (isEditing = false)}
                    />
                  {:else if res.visual?.type === "tag"}
                    <span class="visual-tag">{res.visual.value}</span>
                  {:else if res.visual?.type === "progress"}
                    <div class="visual-progress">
                      <div class="progress-track">
                        <div
                          class="progress-fill"
                          style="width: {Math.min(100, Math.round(res.visual.value * 100))}%;"
                        ></div>
                      </div>
                      <span style="font-size: 10px;">{Math.round(res.visual.value * 100)}%</span>
                    </div>
                  {:else if res.visual?.type === "rating"}
                    <span class="visual-rating">{res.display}</span>
                  {:else}
                    {res.display}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <!-- Footer Status Bar -->
    <footer class="sheet-statusbar">
      <span>{doc.current.rows} × {doc.current.cols} cells</span>
      <div class="stats-group">
        {#if selectionStats.count > 0}
          <span>COUNT: <strong class="stat-item">{selectionStats.count}</strong></span>
          <span>SUM: <strong class="stat-item">{selectionStats.sum.toLocaleString()}</strong></span>
          <span>AVG: <strong class="stat-item">{selectionStats.avg.toLocaleString()}</strong></span>
        {/if}
      </div>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
