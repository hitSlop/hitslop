<script lang="ts">
  // import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";

  const title = __SLOP_TITLE_LITERAL__;
  const state = jsonStore({ count: 0 });
</script>

<main data-slop-selection="none">
  <section class="counter" aria-labelledby="counter-title">
    <header>
      <span>Quick counter</span>
      <h1 id="counter-title">{title}</h1>
    </header>
    <div class="readout"><output aria-live="polite">{state.current.count}</output><span>things counted</span></div>
    <div class="controls" data-slop-export="hide">
      <button onclick={() => state.current.count -= 1} aria-label="Decrease count">−</button>
      <button class="primary" onclick={() => state.current.count += 1} aria-label="Increase count">+</button>
      <button class="reset" onclick={() => state.current.count = 0}>Reset</button>
    </div>
    {#if state.error}<p class="error" data-slop-export="hide">Your latest change couldn’t be saved.</p>{/if}
  </section>
</main>

<!--
  Optional cover/icon artwork. The host renders document assets (Finder icon,
  catalog card) in a hidden pass with html[data-slop-renderer="true"] set, so
  targets mounted behind capture.isRenderer() never exist in the interactive
  app. Each target must be exactly one square element, fully inside the
  viewport, made visible by CSS alone when html[data-slop-capture] flips (see
  the commented rules in styles.css), and ready before slop.ready() resolves.
  Uncomment the capture import above, then:

{#if capture.isRenderer()}
  <section class="render-target" data-slop-render="cover" aria-hidden="true">
    <h1>{title}</h1>
  </section>
  <section class="render-target" data-slop-render="icon" aria-hidden="true">
    <span>#</span>
  </section>
{/if}
-->
