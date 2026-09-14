<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { documentStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Button } from "bits-ui";
  import counterSchema from "../schema";
  import * as styles from "./styles.css.ts";
  import Readout from "./Readout.svelte";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";

  const title = __SLOP_TITLE_LITERAL__;
  const state = documentStore({ schema: counterSchema, initial: { count: 0 } });
  $effect(() => { if (state.isReady) ready(); });
  onDestroy(() => state.destroy());
</script>

<main class={styles.main} data-slop-selection="none" aria-busy={state.isLoading}>
  <section class={styles.counter} aria-label={title}>
    <Readout {title} count={state.current.count} />
    <div class={styles.controls} data-slop-export="hide" inert={!state.isReady || state.isLoading}>
      <Button.Root class={styles.controlButton} onclick={() => state.change(draft => { draft.count -= 1; })} aria-label="Decrease count">−</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.primaryButton}`} onclick={() => state.change(draft => { draft.count += 1; })} aria-label="Increase count">+</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.resetButton}`} onclick={() => state.change(draft => { draft.count = 0; })}>Reset</Button.Root>
    </div>
  </section>
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export {title} count={state.current.count} /></ExportTarget>
