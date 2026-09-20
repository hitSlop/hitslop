<script lang="ts">
  import { createDocument, Slop } from "@hitslop/svelte";
  import { Button } from "bits-ui";
  import counterSchema from "../schema";
  import initial from "../initial";
  import * as styles from "./styles.css.ts";
  import Readout from "./Readout.svelte";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";

  const title = __SLOP_TITLE_LITERAL__;
  const state = createDocument({ schema: counterSchema, initial });
  const { fields } = state;
</script>

<Slop document={state}>
<main class={styles.main} data-slop-selection="none">
  <section class={styles.counter} aria-label={title}>
    <Readout {title} count={state.data.count} />
    <div class={styles.controls} data-slop-export="hide" inert={!state.canWrite}>
      <Button.Root class={styles.controlButton} onclick={() => { void state.increment(fields.count, -1); }} aria-label="Decrease count">−</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.primaryButton}`} onclick={() => { void state.increment(fields.count); }} aria-label="Increase count">+</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.resetButton}`} onclick={() => { void state.set(fields.count, 0); }}>Reset</Button.Root>
    </div>
  </section>
</main>

{#snippet icon()}<Icon />{/snippet}
{#snippet exportView()}<Export {title} count={state.data.count} />{/snippet}
</Slop>
