<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Button } from "bits-ui";
  import counterSchema from "../schema";
  import * as styles from "./styles.css.ts";
  import Readout from "./Readout.svelte";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";

  const title = __SLOP_TITLE_LITERAL__;
  const state = jsonStore({ schema: counterSchema, initial: { count: 0 } });
  $effect(() => { if (state.isReady) ready(); });
  onDestroy(() => state.destroy());
</script>

<main class={styles.main} data-slop-selection="none" aria-busy={state.isLoading}>
  <section class={styles.counter} aria-label={title}>
    <Readout {title} count={state.current.count} />
    <div class={styles.controls} data-slop-export="hide" inert={!state.isReady || state.isLoading}>
      <Button.Root class={styles.controlButton} onclick={() => state.current.count -= 1} aria-label="Decrease count">−</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.primaryButton}`} onclick={() => state.current.count += 1} aria-label="Increase count">+</Button.Root>
      <Button.Root class={`${styles.controlButton} ${styles.resetButton}`} onclick={() => state.current.count = 0}>Reset</Button.Root>
    </div>
    {#if state.error}
      <div class={styles.error} role="alert" data-slop-export="hide">
        <p>{state.isReady ? "Your changes couldn’t be saved." : "Your counter couldn’t be loaded."} {state.error}</p>
        {#if state.isReady}
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
