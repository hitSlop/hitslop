<script lang="ts">
  import { jsonStore } from "@hitslop/svelte";

  const title = __SLOP_TITLE_LITERAL__;
  const state = jsonStore({ count: 0 });
  const change = (amount: number) => state.update((value) => { value.count += amount; });
</script>

<main data-slop-selection="none">
  <section class="counter" aria-labelledby="counter-title">
    <header>
      <div><span>Quick counter</span><h1 id="counter-title">{title}</h1></div>
      <span class:loading={state.isLoading} class="save-state" data-slop-export="hide">{state.isLoading ? "Opening" : "Saved"}</span>
    </header>
    <div class="readout"><output aria-live="polite">{state.current.count}</output><span>things counted</span></div>
    <div class="controls" data-slop-export="hide">
      <button onclick={() => change(-1)} aria-label="Decrease count">−</button>
      <button class="primary" onclick={() => change(1)} aria-label="Increase count">+</button>
    </div>
    <footer><span>Stored locally</span><button data-slop-export="hide" onclick={() => state.update((value) => { value.count = 0; })}>Reset</button></footer>
    {#if state.error}<p class="error" data-slop-export="hide">Could not save. {state.error}</p>{/if}
  </section>
</main>
