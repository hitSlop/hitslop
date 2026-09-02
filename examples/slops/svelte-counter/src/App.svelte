<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Icon from "./Icon.svelte";

  const state = jsonStore({ count: 0 });
</script>

<main data-slop-selection="none">
  <section class="counter" aria-labelledby="counter-title">
    <header>
      <p>Quick counter</p>
      <h1 id="counter-title">Counter</h1>
    </header>
    <div class="readout">
      <output aria-live="polite" aria-label={`Current count: ${state.current.count}`}>{state.current.count}</output>
      <span>things counted</span>
    </div>
    <div class="controls" data-slop-export="hide">
      <button onclick={() => state.current.count -= 1} aria-label="Decrease count">−</button>
      <button class="primary" onclick={() => state.current.count += 1} aria-label="Increase count">+</button>
      <button class="reset" onclick={() => state.current.count = 0}>Reset</button>
    </div>
  </section>
</main>

{#if capture.isRenderer()}<Icon />{/if}
