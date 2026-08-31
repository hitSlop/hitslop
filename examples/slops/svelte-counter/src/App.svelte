<script lang="ts">
  import { jsonStore } from "@hitslop/svelte";

  const state = jsonStore({ count: 0 });

  function change(by: number): void {
    state.update((value) => { value.count += by; });
  }

  function reset(): void {
    state.update((value) => { value.count = 0; });
  }
</script>

<main data-slop-selection="none">
  <section class="counter" aria-labelledby="counter-title">
    <header>
      <p>Svelte SDK test</p>
      <h1 id="counter-title">Counter</h1>
    </header>

    <output aria-live="polite" aria-label={`Current count: ${state.current.count}`}>
      {state.current.count}
    </output>

    <div class="controls">
      <button class="step" onclick={() => change(-1)} aria-label="Decrease count">−</button>
      <button class="reset" onclick={reset}>Reset</button>
      <button class="step primary" onclick={() => change(1)} aria-label="Increase count">+</button>
    </div>

    <footer>
      <span class:loading={state.isLoading}><i></i>{state.isLoading ? "Loading" : "Saved locally"}</span>
      <code>stores/data.json</code>
    </footer>

    {#if state.error}
      <p class="error">Could not save the counter: {state.error}</p>
    {/if}
  </section>
</main>
