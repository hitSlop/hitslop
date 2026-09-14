<script lang="ts">
  import type { PocketSheet } from "../schema";
  import { colToLetter, evaluateCell } from "./engine";
  import * as s from "./styles.css";

  let { data }: { data: PocketSheet } = $props();

  function getRaw(ref: string): string {
    return data.cells[ref]?.raw || "";
  }
  function getRef(row: number, col: number): string {
    return `${colToLetter(col)}${row + 1}`;
  }
</script>

<article class={s.exportRoot} aria-label="Exported spreadsheet {data.title}">
  <div class={s.exportChassis}>
    <header class={s.exportHead}>
      <h1 class={s.exportTitle}>{data.title || "Pocket Spreadsheet"}</h1>
      <span class={s.exportMeta}>{data.rows} × {data.cols}</span>
    </header>
    <div class={s.exportGrid}>
      <table class={s.table}>
        <thead>
          <tr>
            <th class={s.cornerHeader}></th>
            {#each Array(data.cols) as _, c}
              <th class={s.colHeader}>{colToLetter(c)}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each Array(data.rows) as _, r}
            <tr>
              <th class={s.rowHeader}>{r + 1}</th>
              {#each Array(data.cols) as _, c}
                {@const ref = getRef(r, c)}
                {@const res = evaluateCell(getRaw(ref), getRaw)}
                {@const style = data.cells[ref]?.style || {}}
                {@const align = style.align ?? (res.numeric !== undefined ? "right" : undefined)}
                <td class={[
                  s.gridCell,
                  r % 2 === 1 ? s.stripe : "",
                  style.bold ? s.bold : "",
                  align === "left" ? s.alignLeft : "",
                  align === "center" ? s.alignCenter : "",
                  align === "right" ? s.alignRight : "",
                  res.isError ? s.cellError : "",
                ].filter(Boolean).join(" ")}>
                  {#if res.visual?.type === "tag"}
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
    </div>
  </div>
</article>
