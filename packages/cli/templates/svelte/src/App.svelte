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
  onDestroy(() => { void state.destroy().catch(() => {}); });
</script>

<main class={styles.main} data-slop-selection="none" aria-busy={state.isLoading}>
  <section class={styles.counter} aria-label={title}>
    <Readout {title} count={state.current.count} />
    <div class={styles.controls} data-slop-export="hide" inert={!state.isReady || state.isLoading}>
      <Button.Root class={styles.controlButton} onclick={() => { void state.change(data => { data.count -= 1; }).catch(() => undefined); }} aria-label="Decrease count">−</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.primaryButton}`} onclick={() => { void state.change(data => { data.count += 1; }).catch(() => undefined); }} aria-label="Increase count">+</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.resetButton}`} onclick={() => { void state.change(data => { data.count = 0; }).catch(() => undefined); }}>Reset</Button.Root>
    </div>
    {#if state.error}
      <div class={styles.error} role="alert" data-slop-export="hide">
        <p>{state.isReady ? "Your changes couldn’t be saved." : "Your counter couldn’t be loaded."} {state.error}</p>
        {#if state.hasFailedChanges}
          <button onclick={() => { void state.discardFailedChanges().catch(() => undefined); }}>Discard failed edits</button>
        {:else if state.isReady}
          <button onclick={() => { void state.flush().catch(() => {}); }}>Retry saving</button>
        {:else}
          <button onclick={() => state.reload()} disabled={state.isLoading}>Retry loading</button>
        {/if}
      </div>
    {/if}
  </section>
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export {title} count={state.current.count} /></ExportTarget>
