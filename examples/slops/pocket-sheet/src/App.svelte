<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, tick } from "svelte";
  import { Dialog, RadioGroup, Button } from "bits-ui";
  import Bold from "@lucide/svelte/icons/bold";
  import Download from "@lucide/svelte/icons/download";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import pocketSheetSchema from "../schema";
  import type { CellStyle } from "../schema";
  import { colToLetter, evaluateCell } from "./engine";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type Align = NonNullable<CellStyle["align"]>;
  type CsvMode = "values" | "formulas";
  type CsvScope = "sheet" | "selection";

  const doc = jsonStore({ schema: pocketSheetSchema, initial: {
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
  } });
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  let activeRow = $state(1);
  let activeCol = $state(1);
  let selStartRow = $state(1);
  let selStartCol = $state(1);
  let selEndRow = $state(1);
  let selEndCol = $state(1);
  let isEditing = $state(false);
  let dragging = $state(false);
  let csvOpen = $state(false);
  let csvMode = $state<CsvMode>("values");
  let csvScope = $state<CsvScope>("sheet");
  let editInputEl: HTMLInputElement | undefined = $state();
  let formulaInputEl: HTMLInputElement | undefined = $state();

  function getRef(row: number, col: number): string {
    return `${colToLetter(col)}${row + 1}`;
  }

  const activeRef = $derived(getRef(activeRow, activeCol));
  const rangeLabel = $derived.by(() => {
    const minR = Math.min(selStartRow, selEndRow);
    const maxR = Math.max(selStartRow, selEndRow);
    const minC = Math.min(selStartCol, selEndCol);
    const maxC = Math.max(selStartCol, selEndCol);
    const start = getRef(minR, minC);
    const end = getRef(maxR, maxC);
    return start === end ? start : `${start}:${end}`;
  });

  function getRaw(ref: string): string {
    return doc.current.cells[ref]?.raw || "";
  }

  function getStyle(ref: string): CellStyle {
    return doc.current.cells[ref]?.style || {};
  }

  function writeCell(ref: string, raw: string, style?: CellStyle) {
    const next = { ...doc.current.cells };
    const nextStyle = style && Object.keys(style).length > 0 ? style : undefined;
    if (!raw && !nextStyle) delete next[ref];
    else next[ref] = nextStyle ? { raw, style: nextStyle } : { raw };
    doc.current.cells = next;
  }

  function setRaw(ref: string, val: string) {
    writeCell(ref, val, getStyle(ref));
  }

  function toggleBold() {
    const style = { ...getStyle(activeRef), bold: !getStyle(activeRef).bold };
    writeCell(activeRef, getRaw(activeRef), style);
  }

  function setAlign(align: Align) {
    writeCell(activeRef, getRaw(activeRef), { ...getStyle(activeRef), align });
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

  async function startEditing(replaceWith?: string) {
    isEditing = true;
    if (replaceWith !== undefined) setRaw(activeRef, replaceWith);
    await tick();
    if (!editInputEl) return;
    editInputEl.focus();
    if (replaceWith !== undefined) {
      const len = editInputEl.value.length;
      editInputEl.setSelectionRange(len, len);
    } else {
      editInputEl.select();
    }
  }

  function isCellSelected(r: number, c: number): boolean {
    const minR = Math.min(selStartRow, selEndRow);
    const maxR = Math.max(selStartRow, selEndRow);
    const minC = Math.min(selStartCol, selEndCol);
    const maxC = Math.max(selStartCol, selEndCol);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }

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
        const raw = getRaw(getRef(r, c));
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

  function boundsFor(scope: CsvScope) {
    if (scope === "selection") {
      return {
        minR: Math.min(selStartRow, selEndRow),
        maxR: Math.max(selStartRow, selEndRow),
        minC: Math.min(selStartCol, selEndCol),
        maxC: Math.max(selStartCol, selEndCol),
      };
    }
    return { minR: 0, maxR: doc.current.rows - 1, minC: 0, maxC: doc.current.cols - 1 };
  }

  function csvField(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  function buildCSV(mode: CsvMode, scope: CsvScope): string {
    const { minR, maxR, minC, maxC } = boundsFor(scope);
    const lines: string[] = [];
    for (let r = minR; r <= maxR; r++) {
      const rowVals: string[] = [];
      for (let c = minC; c <= maxC; c++) {
        const ref = getRef(r, c);
        const raw = getRaw(ref);
        const value = mode === "formulas" ? raw : evaluateCell(raw, getRaw).display;
        rowVals.push(csvField(String(value)));
      }
      lines.push(rowVals.join(","));
    }
    return lines.join("\n") + "\n";
  }

  function downloadCSV() {
    const csv = buildCSV(csvMode, csvScope);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.current.title.toLowerCase().replace(/\s+/g, "_") || "sheet"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    csvOpen = false;
  }

  function buildTSV(): string {
    const { minR, maxR, minC, maxC } = boundsFor("selection");
    const lines: string[] = [];
    for (let r = minR; r <= maxR; r++) {
      const rowVals: string[] = [];
      for (let c = minC; c <= maxC; c++) {
        rowVals.push(getRaw(getRef(r, c)));
      }
      lines.push(rowVals.join("\t"));
    }
    return lines.join("\n");
  }

  async function copySelection() {
    try {
      await navigator.clipboard.writeText(buildTSV());
    } catch {
      /* clipboard may be unavailable in capture */
    }
  }

  async function pasteSelection() {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    if (!text) return;
    const rows = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (rows.at(-1) === "") rows.pop();
    let maxCols = 0;
    const parsed = rows.map((line) => {
      const cols = line.split("\t");
      maxCols = Math.max(maxCols, cols.length);
      return cols;
    });
    const needRows = activeRow + parsed.length;
    const needCols = activeCol + maxCols;
    if (needRows > doc.current.rows) doc.current.rows = needRows;
    if (needCols > doc.current.cols) doc.current.cols = needCols;
    const next = { ...doc.current.cells };
    parsed.forEach((cols, rOffset) => {
      cols.forEach((value, cOffset) => {
        const ref = getRef(activeRow + rOffset, activeCol + cOffset);
        const style = next[ref]?.style;
        if (!value && !style) delete next[ref];
        else next[ref] = style ? { raw: value, style } : { raw: value };
      });
    });
    doc.current.cells = next;
    selStartRow = activeRow;
    selStartCol = activeCol;
    selEndRow = activeRow + Math.max(0, parsed.length - 1);
    selEndCol = activeCol + Math.max(0, maxCols - 1);
  }

  function commitEdit(key: string) {
    isEditing = false;
    if (key === "Enter") {
      activeRow = Math.min(doc.current.rows - 1, activeRow + 1);
    } else {
      activeCol = Math.min(doc.current.cols - 1, activeCol + 1);
    }
    selectCell(activeRow, activeCol);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (csvOpen) return;
    const target = e.target as HTMLElement | null;
    const isField = target instanceof HTMLInputElement;
    const isCellEdit = target === editInputEl;
    const isFormula = target === formulaInputEl;

    if (isField && !isCellEdit && !isFormula) return;

    if (isEditing || isCellEdit) {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        commitEdit(e.key);
      } else if (e.key === "Escape") {
        isEditing = false;
      }
      return;
    }

    if (isFormula) {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        formulaInputEl?.blur();
        commitEdit(e.key);
      } else if (e.key === "Escape") {
        formulaInputEl?.blur();
      }
      return;
    }

    const lastRow = doc.current.rows - 1;
    const lastCol = doc.current.cols - 1;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleBold();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      void copySelection();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      void pasteSelection();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeRow = Math.max(0, activeRow - 1);
      selectCell(activeRow, activeCol, e.shiftKey);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      activeRow = Math.min(lastRow, activeRow + 1);
      selectCell(activeRow, activeCol, e.shiftKey);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      activeCol = Math.max(0, activeCol - 1);
      selectCell(activeRow, activeCol, e.shiftKey);
    } else if (e.key === "ArrowRight" || e.key === "Tab") {
      e.preventDefault();
      activeCol = Math.min(lastCol, activeCol + 1);
      selectCell(activeRow, activeCol, e.key === "Tab" ? false : e.shiftKey);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        activeRow = 0;
        activeCol = 0;
        selectCell(0, 0);
      } else {
        activeCol = 0;
        selectCell(activeRow, activeCol, e.shiftKey);
      }
    } else if (e.key === "End") {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        activeRow = lastRow;
        activeCol = lastCol;
        selectCell(lastRow, lastCol);
      } else {
        activeCol = lastCol;
        selectCell(activeRow, activeCol, e.shiftKey);
      }
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      void startEditing();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      const { minR, maxR, minC, maxC } = boundsFor("selection");
      const next = { ...doc.current.cells };
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const ref = getRef(r, c);
          const style = next[ref]?.style;
          if (!style) delete next[ref];
          else next[ref] = { raw: "", style };
        }
      }
      doc.current.cells = next;
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      void startEditing(e.key);
    }
  }

  function onCellPointerDown(e: PointerEvent, r: number, c: number) {
    if (e.button !== 0) return;
    dragging = true;
    selectCell(r, c, e.shiftKey);
  }

  function onCellPointerEnter(r: number, c: number) {
    if (!dragging) return;
    selEndRow = r;
    selEndCol = c;
  }

  function cellClass(r: number, c: number, style: CellStyle, numeric: boolean, error: boolean, isSelected: boolean, isActive: boolean): string {
    const align = style.align ?? (numeric ? "right" : undefined);
    return [
      s.gridCell,
      r % 2 === 1 ? s.stripe : "",
      isSelected ? s.selected : "",
      isActive ? s.activeCell : "",
      style.bold ? s.bold : "",
      align === "left" ? s.alignLeft : "",
      align === "center" ? s.alignCenter : "",
      align === "right" ? s.alignRight : "",
      error ? s.cellError : "",
    ].filter(Boolean).join(" ");
  }
</script>

<svelte:window
  onkeydown={handleKeyDown}
  onpointerup={() => (dragging = false)}
  onpointercancel={() => (dragging = false)}
/>

<main class={s.canvas} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Pocket spreadsheet">
  <article class={s.chassis} inert={!doc.isReady || doc.isLoading}>
    <header class={s.topbar}>
      <input class={s.title} aria-label="Spreadsheet title" bind:value={doc.current.title} disabled={doc.isLoading} />
      <div class={s.toolbar} data-slop-export="hide">
        <button type="button" class={s.toolBtn} data-active={getStyle(activeRef).bold ? "true" : "false"} title="Bold" aria-pressed={getStyle(activeRef).bold === true} onclick={toggleBold}>
          <Bold size={13} />
        </button>
        <button type="button" class={s.toolBtn} title="Align left" onclick={() => setAlign("left")}>L</button>
        <button type="button" class={s.toolBtn} title="Align center" onclick={() => setAlign("center")}>C</button>
        <button type="button" class={s.toolBtn} title="Align right" onclick={() => setAlign("right")}>R</button>
        <button type="button" class={s.toolBtn} title="Add row" onclick={addRow}><Plus size={12} /> Row</button>
        <button type="button" class={s.toolBtn} title="Add column" onclick={addCol}><Plus size={12} /> Col</button>
        <button type="button" class={s.toolBtn} title="Export CSV" onclick={() => (csvOpen = true)}><Download size={13} /></button>
      </div>
    </header>

    <section class={s.formulaBar} aria-label="Formula bar">
      <span class={s.cellPill}>{rangeLabel}</span>
      <span class={s.fxLabel}>fx</span>
      <input
        bind:this={formulaInputEl}
        class={s.formulaInput}
        aria-label="Cell formula"
        spellcheck="false"
        autocomplete="off"
        value={getRaw(activeRef)}
        oninput={(e) => setRaw(activeRef, e.currentTarget.value)}
      />
    </section>

    <section class={s.gridViewport} aria-label="Grid">
      <table class={s.table} role="grid" aria-rowcount={doc.current.rows} aria-colcount={doc.current.cols}>
        <thead>
          <tr>
            <th class={s.cornerHeader}></th>
            {#each Array(doc.current.cols) as _, c}
              <th class={s.colHeader} scope="col">{colToLetter(c)}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each Array(doc.current.rows) as _, r}
            <tr>
              <th class={s.rowHeader} scope="row">{r + 1}</th>
              {#each Array(doc.current.cols) as _, c}
                {@const ref = getRef(r, c)}
                {@const raw = getRaw(ref)}
                {@const res = evaluateCell(raw, getRaw)}
                {@const style = getStyle(ref)}
                {@const isSelected = isCellSelected(r, c)}
                {@const isActive = activeRow === r && activeCol === c}
                <td
                  class={cellClass(r, c, style, res.numeric !== undefined, res.isError === true, isSelected, isActive)}
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-colindex={c + 1}
                  onpointerdown={(e) => onCellPointerDown(e, r, c)}
                  onpointerenter={() => onCellPointerEnter(r, c)}
                  ondblclick={() => void startEditing()}
                >
                  {#if isActive && isEditing}
                    <input
                      bind:this={editInputEl}
                      class={s.cellEditInput}
                      spellcheck="false"
                      autocomplete="off"
                      value={raw}
                      oninput={(e) => setRaw(ref, e.currentTarget.value)}
                      onblur={() => (isEditing = false)}
                    />
                  {:else if res.visual?.type === "tag"}
                    <span class={s.visualTag}>{res.visual.value}</span>
                  {:else if res.visual?.type === "progress"}
                    <div class={s.visualProgress}>
                      <div class={s.progressTrack}>
                        <div class={s.progressFill} style:width={`${Math.min(100, Math.round(res.visual.value * 100))}%`}></div>
                      </div>
                      <span class={s.progressLabel}>{Math.round(res.visual.value * 100)}%</span>
                    </div>
                  {:else if res.visual?.type === "rating"}
                    <span class={s.visualRating}>{res.display}</span>
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

    <footer class={s.statusbar}>
      <span>{doc.current.rows} × {doc.current.cols} · {rangeLabel}</span>
      <div class={s.stats}>
        {#if selectionStats.count > 0}
          <span>COUNT: <strong class={s.statItem}>{selectionStats.count}</strong></span>
          <span>SUM: <strong class={s.statItem}>{selectionStats.sum.toLocaleString()}</strong></span>
          <span>AVG: <strong class={s.statItem}>{selectionStats.avg.toLocaleString()}</strong></span>
        {/if}
      </div>
    </footer>
  </article>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your sheet couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}
    <p class={s.error} role="status">Loading your sheet…</p>
  {/if}
</main>

<Dialog.Root bind:open={csvOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class={s.overlay} data-slop-export="hide" />
    <Dialog.Content class={s.dialogCard} aria-labelledby="csv-title" data-slop-export="hide">
      <div class={s.dialogHead}>
        <Dialog.Title id="csv-title">Export CSV</Dialog.Title>
        <Dialog.Close class={s.dialogClose} aria-label="Close export dialog"><X size={14} /></Dialog.Close>
      </div>
      <Dialog.Description class={s.dialogCopy}>Download the ledger as a CSV of evaluated values or raw formulas.</Dialog.Description>
      <div class={s.formField}>
        <span>Contents</span>
        <RadioGroup.Root class={s.radioRow} value={csvMode} onValueChange={(value) => { if (value === "values" || value === "formulas") csvMode = value; }} aria-label="CSV contents">
          <RadioGroup.Item value="values" class={s.radioItem}>Values</RadioGroup.Item>
          <RadioGroup.Item value="formulas" class={s.radioItem}>Formulas</RadioGroup.Item>
        </RadioGroup.Root>
      </div>
      <div class={s.formField}>
        <span>Range</span>
        <RadioGroup.Root class={s.radioRow} value={csvScope} onValueChange={(value) => { if (value === "sheet" || value === "selection") csvScope = value; }} aria-label="CSV range">
          <RadioGroup.Item value="sheet" class={s.radioItem}>Whole sheet</RadioGroup.Item>
          <RadioGroup.Item value="selection" class={s.radioItem}>Selection</RadioGroup.Item>
        </RadioGroup.Root>
      </div>
      <div class={s.dialogActions}>
        <Dialog.Close class={s.btnGhost}>Cancel</Dialog.Close>
        <Button.Root class={s.btnPrimary} type="button" onclick={downloadCSV}><Download size={13} /> Download</Button.Root>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={doc.current} /></ExportTarget>
