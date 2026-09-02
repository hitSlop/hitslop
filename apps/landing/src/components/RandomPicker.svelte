<script lang="ts">
  let options = $state(["Ship the prototype", "Take the long walk", "Order dumplings", "Call a friend"]);
  let draft = $state("");
  let selected = $state("Ready?");
  let spinning = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  function addOption(): void {
    const next = draft.trim();
    if (!next) return;
    options = [...options, next];
    draft = "";
  }

  function removeOption(index: number): void {
    if (options.length <= 2) return;
    options = options.filter((_, optionIndex) => optionIndex !== index);
  }

  function choose(): void {
    if (spinning || options.length === 0) return;
    spinning = true;
    let steps = 0;
    timer = setInterval(() => {
      selected = options[Math.floor(Math.random() * options.length)] ?? "Ready?";
      steps += 1;
      if (steps < 10) return;
      if (timer) clearInterval(timer);
      timer = undefined;
      spinning = false;
    }, 75);
  }
</script>

<div class="picker-shell" data-spinning={spinning}>
  <header>
    <div><small>CHOOSE FOR ME</small><strong>Pick one</strong></div>
    <span>{options.length} options</span>
  </header>

  <section class="result">
    <div><small>{spinning ? "Shuffling" : "Selected"}</small><output aria-live="polite">{selected}</output></div>
    <button type="button" onclick={choose} disabled={spinning}><span aria-hidden="true">⚄</span>{spinning ? "Picking…" : "Pick one"}</button>
  </section>

  <div class="options" aria-label="Picker options">
    {#each options as option, index}
      <button type="button" onclick={() => removeOption(index)} aria-label={`Remove ${option}`} title="Remove option">{option}<span aria-hidden="true">×</span></button>
    {/each}
  </div>

  <div class="add">
    <label for="new-option">Add an option</label>
    <div><input id="new-option" bind:value={draft} placeholder="Another possibility" onkeydown={(event) => { if (event.key === "Enter") addOption(); }} /><button type="button" onclick={addOption}>Add</button></div>
  </div>
  <p>Interactive demo · resets on refresh</p>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  button, input { font: inherit; }
  .picker-shell {
    --blue: oklch(55% 0.2 263);
    --blue-dark: oklch(31% 0.13 269);
    --blue-light: oklch(88% 0.065 257);
    --yellow: oklch(87% 0.16 92);
    --ink: oklch(19% 0.04 267);
    width: min(100%, 600px);
    min-height: 330px;
    padding: 30px 38px 21px;
    display: grid;
    grid-template-rows: auto 1fr auto auto auto;
    gap: 17px;
    color: oklch(97% 0.012 257);
    border: 5px solid var(--ink);
    border-radius: 72px;
    background: radial-gradient(circle at 15% 10%, oklch(77% 0.14 250 / .65), transparent 28%), var(--blue);
    box-shadow: inset 0 0 0 5px oklch(66% 0.16 257), 0 22px 46px oklch(27% 0.1 267 / .28);
    container-type: inline-size;
  }
  header { display: flex; align-items: start; justify-content: space-between; gap: 20px; }
  header div { display: grid; }
  header small, .result small, .add label { font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  header strong { font-size: 25px; line-height: 1.05; letter-spacing: -.04em; }
  header > span { padding: 5px 9px; border: 1px solid oklch(94% 0.02 257 / .45); border-radius: 999px; font-size: 9px; font-weight: 700; }
  .result { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 20px; padding: 19px 22px; border: 3px solid var(--ink); border-radius: 24px; color: var(--ink); background: var(--blue-light); box-shadow: 5px 6px oklch(25% 0.09 269 / .28); }
  .result div { min-width: 0; display: grid; gap: 5px; }
  .result output { overflow: hidden; font-size: clamp(1.25rem, 6cqw, 2rem); font-weight: 800; line-height: 1; letter-spacing: -.05em; text-overflow: ellipsis; white-space: nowrap; }
  .result button { min-width: 112px; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 3px solid var(--ink); border-radius: 999px; color: var(--ink); background: var(--yellow); box-shadow: 3px 4px oklch(25% 0.09 269 / .2); font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: .05em; cursor: pointer; }
  .result button span { font-size: 18px; }
  .result button:active { transform: translate(2px, 2px); box-shadow: 1px 1px oklch(25% 0.09 269 / .2); }
  .result button:disabled { cursor: wait; }
  .options { min-height: 25px; display: flex; align-items: center; gap: 6px; overflow: hidden; }
  .options button { flex: 0 1 auto; min-width: 0; padding: 5px 9px; display: inline-flex; align-items: center; gap: 6px; overflow: hidden; border: 1px solid oklch(96% 0.01 257 / .45); border-radius: 999px; color: inherit; background: oklch(29% 0.1 269 / .24); font-size: 9px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
  .options button span { opacity: .62; }
  .add { display: grid; gap: 6px; }
  .add > div { display: grid; grid-template-columns: 1fr auto; gap: 7px; }
  .add input { min-width: 0; height: 38px; padding: 0 13px; border: 1px solid oklch(96% 0.01 257 / .45); border-radius: 11px; color: inherit; background: oklch(29% 0.1 269 / .24); outline: none; }
  .add input::placeholder { color: oklch(91% 0.03 257 / .7); }
  .add > div button { min-width: 55px; border: 0; border-radius: 11px; color: var(--ink); background: oklch(96% 0.02 257); font-size: 10px; font-weight: 800; cursor: pointer; }
  p { margin: 0; text-align: center; color: oklch(93% 0.03 257 / .72); font-size: 8px; font-weight: 650; letter-spacing: .05em; }
  button:focus-visible, input:focus-visible { outline: 3px solid var(--yellow); outline-offset: 3px; }
  @container (width < 470px) {
    .picker-shell { min-height: 390px; padding: 28px 26px 20px; border-radius: 52px; }
    .result { grid-template-columns: 1fr; }
    .result button { width: 100%; }
    .options { flex-wrap: wrap; }
    .options button:nth-child(n+4) { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { * { transition-duration: .01ms !important; } }
</style>
