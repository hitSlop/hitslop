<script lang="ts">
  import type { Wordle } from "../schema";
  import * as s from "./styles.css";
  import { evaluateGuess, type TileState } from "./words";

  let { data, currentGuess = "" }: { data: Wordle; currentGuess?: string } = $props();

  const ROWS = 6;
  const COLS = 5;
  const game = $derived(data.mode === "daily" ? data.daily : data.practice);
  const playing = $derived(game.status === "playing");
  const score = $derived(game.status === "won" ? `${game.guesses.length}/6` : game.status === "lost" ? "X/6" : `${Math.min(ROWS, game.guesses.length + 1)} of 6`);
  const meta = $derived(
    data.mode === "daily"
      ? `Daily · ${game.date ?? ""} · ${score}`
      : `Practice · ${score}`,
  );

  function charAt(rowIndex: number, colIndex: number): string {
    const completed = game.guesses[rowIndex];
    if (completed) return completed[colIndex] ?? "";
    if (playing && rowIndex === game.guesses.length) return currentGuess[colIndex] ?? "";
    return "";
  }

  function stateAt(rowIndex: number, colIndex: number): TileState | "" {
    const completed = game.guesses[rowIndex];
    if (!completed) return "";
    return evaluateGuess(completed, game.targetWord)[colIndex] ?? "";
  }
</script>

<article class={s.exportDevice} aria-label="Exported Wordle puzzle">
  <header class={s.exportHead}>
    <div class={s.brandTitle}>
      <span class={s.brandDot}></span>
      <span>WORDLE</span>
    </div>
    <span class={s.exportMeta}>{meta}</span>
  </header>
  <div class={s.exportBoard}>
    <div class={s.statusLine}>
      {game.status === "won" ? `Solved in ${game.guesses.length}/6` : game.status === "lost" ? "Out of guesses" : `Guess ${Math.min(ROWS, game.guesses.length + 1)} of ${ROWS}`}
    </div>
    <div class={s.grid} role="grid" aria-label="Wordle board">
      {#each Array(ROWS) as _, rowIndex}
        <div class={s.row} role="row">
          {#each Array(COLS) as _, colIndex}
            {@const char = charAt(rowIndex, colIndex)}
            {@const state = stateAt(rowIndex, colIndex)}
            <div class={s.tile} data-filled={Boolean(char)} data-state={state} role="gridcell">{char}</div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</article>
