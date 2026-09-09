<script lang="ts">
  const examples = [
    "Make a slop that tracks the books I lend to friends",
    "Make a tiny garden timer with a playful tomato design",
    "Make an invoice I can export as a PDF",
  ];

  let prompt = $state(examples[0]);
  let state = $state<"ready" | "making" | "done">("ready");
  let timer: ReturnType<typeof setTimeout> | undefined;

  function make(): void {
    if (!prompt.trim() || state === "making") return;
    state = "making";
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      state = "done";
      timer = undefined;
    }, 900);
  }

  function useExample(value: string): void {
    prompt = value;
    state = "ready";
  }
</script>

<div class="maker" data-state={state}>
  <div class="maker-bar">
    <span><i></i><i></i><i></i></span>
    <strong>Make a slop</strong>
    <small>local preview</small>
  </div>

  <div class="conversation">
    <label for="slop-prompt">Describe one small thing you want</label>
    <div class="prompt-row">
      <textarea id="slop-prompt" bind:value={prompt} rows="3" oninput={() => state = "ready"}></textarea>
      <button type="button" onclick={make} disabled={!prompt.trim() || state === "making"}>
        {state === "making" ? "Making…" : state === "done" ? "Make another" : "Make it"}
        <span aria-hidden="true">↗</span>
      </button>
    </div>
    <div class="examples" aria-label="Example prompts">
      {#each examples as example, index}
        <button type="button" onclick={() => useExample(example)} aria-label={`Use example ${index + 1}`}>{index + 1}</button>
      {/each}
    </div>
  </div>

  <div class="result" aria-live="polite">
    <div class="result-state">
      <span class="spark" aria-hidden="true">✦</span>
      <div>
        <small>{state === "done" ? "Ready on your desktop" : state === "making" ? "Building the tiny object" : "Your slop will appear here"}</small>
        <strong>{state === "done" ? "book-loan-tracker.slop" : state === "making" ? "Shaping the interface…" : "One prompt. One file."}</strong>
      </div>
    </div>

    <div class="mini-slop" aria-hidden="true">
      <header><span>Loaned books</span><i>{state === "done" ? "3" : "0"}</i></header>
      <div class="book"><b></b><span>The Creative Act<small>Sam · due Friday</small></span><em>✓</em></div>
      <div class="book"><b></b><span>Ways of Seeing<small>Maya · no due date</small></span><em>···</em></div>
      <button type="button" tabindex="-1">+ Lend a book</button>
    </div>
  </div>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  button, textarea { font: inherit; }
  .maker {
    --ink: oklch(19% .025 260);
    --muted: oklch(49% .025 260);
    --rule: oklch(84% .02 258);
    width: min(100%, 780px);
    overflow: hidden;
    border: 1px solid oklch(72% .025 258);
    border-radius: 20px;
    color: var(--ink);
    background: oklch(98% .008 250);
    box-shadow: 0 28px 70px oklch(18% .04 260 / .2);
  }
  .maker-bar { min-height: 54px; padding: 0 18px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 1px solid var(--rule); background: oklch(95% .012 250); }
  .maker-bar > span { display: flex; gap: 6px; }
  .maker-bar i { width: 9px; height: 9px; border-radius: 50%; background: oklch(71% .17 32); }
  .maker-bar i:nth-child(2) { background: oklch(85% .16 91); }
  .maker-bar i:nth-child(3) { background: oklch(72% .13 145); }
  .maker-bar strong { font-size: .74rem; }
  .maker-bar small { justify-self: end; color: var(--muted); font-size: .62rem; }
  .conversation { padding: clamp(22px, 5vw, 40px); border-bottom: 1px solid var(--rule); }
  label { display: block; margin-bottom: 10px; color: var(--muted); font-size: .69rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .prompt-row { display: grid; gap: 10px; }
  textarea { width: 100%; min-height: 108px; padding: 16px 17px; resize: vertical; border: 1px solid var(--rule); border-radius: 13px; color: var(--ink); background: oklch(100% 0 0); font-size: clamp(1rem, 2.3vw, 1.25rem); line-height: 1.45; outline: none; }
  textarea:focus { border-color: oklch(55% .18 263); box-shadow: 0 0 0 3px oklch(55% .18 263 / .13); }
  .prompt-row > button { min-height: 48px; padding: 0 17px; display: inline-flex; align-items: center; justify-content: space-between; border: 0; border-radius: 11px; color: oklch(98% .005 260); background: var(--ink); font-size: .8rem; font-weight: 750; cursor: pointer; }
  .prompt-row > button:disabled { cursor: wait; opacity: .62; }
  .examples { margin-top: 12px; display: flex; gap: 7px; }
  .examples button { width: 30px; height: 30px; border: 1px solid var(--rule); border-radius: 50%; color: var(--muted); background: transparent; font-size: .66rem; font-weight: 750; cursor: pointer; }
  .result { min-height: 285px; padding: clamp(22px, 5vw, 38px); display: grid; gap: 24px; align-items: center; background: oklch(93% .045 145); }
  .result-state { display: flex; align-items: center; gap: 12px; }
  .spark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; color: oklch(98% .01 90); background: var(--ink); }
  .result-state div { display: grid; gap: 2px; }
  .result-state small { color: oklch(39% .055 145); font-size: .65rem; }
  .result-state strong { font-size: .9rem; }
  .mini-slop { min-height: 210px; padding: 20px; border: 1px solid oklch(68% .055 145); border-radius: 14px; background: oklch(98% .018 145); box-shadow: 8px 9px 0 oklch(45% .08 145 / .14); transform: rotate(.7deg); opacity: .38; transition: opacity 350ms cubic-bezier(.22,1,.36,1), transform 350ms cubic-bezier(.22,1,.36,1); }
  .maker[data-state="done"] .mini-slop { opacity: 1; transform: rotate(.7deg) translateY(-3px); }
  .maker[data-state="making"] .mini-slop { opacity: .65; }
  .mini-slop header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 13px; border-bottom: 1px solid oklch(78% .04 145); font-weight: 800; }
  .mini-slop header i { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; color: oklch(98% .01 145); background: oklch(35% .09 145); font-size: .65rem; font-style: normal; }
  .book { min-height: 52px; display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 10px; border-bottom: 1px solid oklch(84% .03 145); }
  .book b { width: 8px; height: 30px; border-radius: 2px; background: oklch(69% .16 33); }
  .book:nth-of-type(3) b { background: oklch(57% .17 263); }
  .book span { display: grid; font-size: .72rem; font-weight: 700; }
  .book small { color: oklch(46% .04 145); font-size: .58rem; font-weight: 500; }
  .book em { font-style: normal; font-size: .7rem; }
  .mini-slop > button { margin-top: 14px; min-height: 34px; padding: 0; border: 0; color: oklch(37% .07 145); background: transparent; font-size: .68rem; font-weight: 750; }
  button:focus-visible { outline: 3px solid oklch(55% .18 263); outline-offset: 3px; }
  @media (min-width: 620px) {
    .prompt-row { grid-template-columns: 1fr 126px; }
    .prompt-row > button { align-self: end; min-height: 108px; flex-direction: column; align-items: flex-start; padding: 17px; }
    .result { grid-template-columns: .72fr 1.28fr; }
  }
  @media (prefers-reduced-motion: reduce) { .mini-slop { transition: none; } }
</style>
