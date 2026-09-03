<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import { Button } from "bits-ui";
  import counterSchema from "../schema";
  import * as styles from "./styles.css.ts";

  const title = __SLOP_TITLE_LITERAL__;
  const state = jsonStore({ schema: counterSchema, initial: { count: 0 } });
</script>

<main class={styles.main} data-slop-selection="none">
  <section class={styles.counter} aria-labelledby="counter-title">
    <header>
      <span class={styles.eyebrow}>Quick counter</span>
      <h1 class={styles.heading} id="counter-title">{title}</h1>
    </header>
    <div class={styles.readout}><output class={styles.output} aria-live="polite">{state.current.count}</output><span class={styles.readoutLabel}>things counted</span></div>
    <div class={styles.controls} data-slop-export="hide">
      <Button.Root class={styles.controlButton} onclick={() => state.current.count -= 1} aria-label="Decrease count">−</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.primaryButton}`} onclick={() => state.current.count += 1} aria-label="Increase count">+</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.resetButton}`} onclick={() => state.current.count = 0}>Reset</Button.Root>
    </div>
    {#if state.error}<p class={styles.error} data-slop-export="hide">Your latest change couldn’t be saved.</p>{/if}
  </section>
</main>

{#if capture.isRenderer()}
  <section class={styles.renderTarget} data-slop-render="icon" aria-hidden="true">
    <span class={styles.iconTile}>#</span>
  </section>
{/if}
