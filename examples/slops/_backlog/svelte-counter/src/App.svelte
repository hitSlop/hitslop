<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import counterSchema from "../schema";
  import Icon from "./Icon.svelte";
  import * as styles from "./styles.css.ts";

  const state = jsonStore({ schema: counterSchema, initial: { count: 0 } });
</script>

<main class={styles.main} data-slop-selection="none">
  <section class={styles.counter} aria-labelledby="counter-title">
    <header>
      <p class={styles.eyebrow}>Quick counter</p>
      <h1 class={styles.heading} id="counter-title">Counter</h1>
    </header>
    <div class={styles.readout}>
      <output class={styles.output} aria-live="polite" aria-label={`Current count: ${state.current.count}`}>{state.current.count}</output>
      <span class={styles.readoutLabel}>things counted</span>
    </div>
    <div class={styles.controls} data-slop-export="hide">
      <button class={styles.controlButton} onclick={() => state.current.count -= 1} aria-label="Decrease count">−</button>
      <button class={`${styles.controlButton} ${styles.primaryButton}`} onclick={() => state.current.count += 1} aria-label="Increase count">+</button>
      <button class={`${styles.controlButton} ${styles.resetButton}`} onclick={() => state.current.count = 0}>Reset</button>
    </div>
  </section>
</main>

{#if capture.isRenderer()}<Icon />{/if}
