<script lang="ts">
  import { fileStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { capture, ready, slop } from "@hitslop/runtime";
  import { onMount, tick } from "svelte";
  import { Button, Tooltip } from "bits-ui";
  import { parsePetArchive, parsePetPackage, validateSpriteImage, type PetMetadata } from "./pet-package";
  import starterSheet from "../assets/bubu-spritesheet.webp";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type PetAction = "idle" | "running-right" | "running-left" | "waving" | "jumping" | "failed" | "waiting" | "running" | "review";
  type ActionSpec = { row: number; durations: number[] };

  const CELL_WIDTH = 192, CELL_HEIGHT = 208;
  const STARTER: PetMetadata = {
    id: "bubu--gbn666",
    displayName: "Bubu",
    description: "A soft, sleepy milk-tea-brown chibi bear desktop pet.",
    spriteVersionNumber: 1,
    spritesheetPath: "bubu-spritesheet.webp",
  };
  const ACTIONS: Record<PetAction, ActionSpec> = {
    idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
    "running-right": { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
    "running-left": { row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
    waving: { row: 3, durations: [140, 140, 140, 280] },
    jumping: { row: 4, durations: [140, 140, 140, 140, 280] },
    failed: { row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
    waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] },
    running: { row: 7, durations: [120, 120, 120, 120, 120, 220] },
    review: { row: 8, durations: [150, 150, 150, 150, 150, 280] },
  };

  const storedPackage = fileStore("pet-package", { accept: ".zip,.codex-pet.zip,application/zip" });
  const capturing = capture.isRenderer();
  let canvas: HTMLCanvasElement;
  let fileInput: HTMLInputElement;
  let activePet = $state<PetMetadata>(STARTER);
  let activeImage = $state.raw<HTMLImageElement | null>(null);
  let action = $state<PetAction>("idle");
  let frame = $state(0);
  let status = $state("Drag me around");
  let error = $state<string | null>(null);
  let dragActive = $state(false);
  let importing = $state(false);
  let reducedMotion = $state(false);
  let imageObjectUrl: string | null = null;
  let frameTimer = 0, ambientTimer = 0, loadGeneration = 0;
  let didReady = false;

  function markReady(): void {
    if (didReady) return;
    didReady = true;
    ready();
  }

  function draw(): void {
    if (!canvas || !activeImage) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
    const spec = ACTIONS[action];
    context.drawImage(activeImage, frame * CELL_WIDTH, spec.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
  }

  function play(next: PetAction, cycles = 1): void {
    window.clearTimeout(frameTimer);
    action = next; frame = 0; draw();
    if (reducedMotion || capturing) return;
    const spec = ACTIONS[next];
    let remaining = cycles;
    const advance = () => {
      frameTimer = window.setTimeout(() => {
        if (frame + 1 < spec.durations.length) frame += 1;
        else {
          if (Number.isFinite(remaining)) remaining -= 1;
          if (remaining <= 0 && next !== "idle") { play("idle", Number.POSITIVE_INFINITY); return; }
          frame = 0;
        }
        draw(); advance();
      }, spec.durations[frame] ?? 140);
    };
    advance();
  }

  function ambientPool(hour: number): PetAction[] {
    if (hour < 6 || hour >= 22) return ["waiting", "idle", "idle"];
    if (hour < 10) return ["waving", "jumping", "waving", "waiting"];
    if (hour < 17) return ["running", "review", "running", "waiting"];
    return ["waving", "review", "jumping", "waiting"];
  }

  function scheduleAmbient(): void {
    window.clearTimeout(ambientTimer);
    if (reducedMotion || capturing || document.hidden) return;
    const hour = new Date().getHours();
    const overnight = hour < 6 || hour >= 22;
    const delay = overnight ? 30_000 + Math.random() * 60_000 : 12_000 + Math.random() * 18_000;
    ambientTimer = window.setTimeout(() => {
      const pool = ambientPool(hour);
      play(pool[Math.floor(Math.random() * pool.length)] ?? "idle", 1);
      scheduleAmbient();
    }, delay);
  }

  async function adoptImage(metadata: PetMetadata, source: string, objectUrl: string | null, generation: number): Promise<void> {
    const image = new Image();
    image.decoding = "async"; image.src = source;
    try { await image.decode(); }
    catch { throw new Error("The pet spritesheet could not be decoded."); }
    if (generation !== loadGeneration) { if (objectUrl) URL.revokeObjectURL(objectUrl); return; }
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    imageObjectUrl = objectUrl;
    activePet = metadata; activeImage = image; error = null;
    await tick();
    if (generation !== loadGeneration) return;
    play("idle", Number.POSITIVE_INFINITY);
    status = storedPackage.hasCustomFile ? "Custom pet · drag me" : "Drag me around";
    markReady(); scheduleAmbient();
  }

  async function loadStarter(generation: number): Promise<void> {
    await adoptImage(STARTER, starterSheet, null, generation);
  }

  async function loadStored(source: string, generation: number): Promise<void> {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error("The stored pet ZIP could not be opened.");
      const parsed = parsePetArchive(new Uint8Array(await response.arrayBuffer()));
      await validateSpriteImage(parsed);
      const blob = new Blob([parsed.spriteBytes.slice().buffer], { type: parsed.spriteMime });
      const objectUrl = URL.createObjectURL(blob);
      await adoptImage(parsed, objectUrl, objectUrl, generation);
    } catch (cause) {
      if (generation !== loadGeneration) return;
      error = `Stored pet unavailable: ${cause instanceof Error ? cause.message : String(cause)}`;
      await loadStarter(generation);
      error = `Stored pet unavailable: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
  }

  async function importPackage(file: File | undefined): Promise<void> {
    if (!file || importing) return;
    importing = true; error = null; status = "Checking pet ZIP…";
    try {
      await parsePetPackage(file);
      status = "Saving pet…";
      await storedPackage.replace(file);
      status = "Pet saved · drag me";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = "Import rejected";
    } finally { importing = false; }
  }

  async function useStarter(): Promise<void> {
    if (!storedPackage.hasCustomFile) return;
    try { await storedPackage.remove(); status = "Bubu is back"; error = null; }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
  }

  function beginWindowDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    play("jumping", 1);
    status = "Moving…";
    void slop.window.drag().then(() => { window.setTimeout(() => { status = "Drag me around"; }, 850); }).catch(cause => {
      error = cause instanceof Error ? cause.message : String(cause);
    });
  }

  $effect(() => { action; frame; activeImage; draw(); });
  $effect(() => {
    const source = storedPackage.src, loading = storedPackage.isLoading;
    if (loading) return;
    const generation = ++loadGeneration;
    if (source) void loadStored(source, generation);
    else void loadStarter(generation);
  });

  onMount(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      reducedMotion = media.matches;
      if (reducedMotion) { window.clearTimeout(frameTimer); window.clearTimeout(ambientTimer); action = "idle"; frame = 0; draw(); }
      else { play("idle", Number.POSITIVE_INFINITY); scheduleAmbient(); }
    };
    const visibility = () => { if (document.hidden) { window.clearTimeout(ambientTimer); play("idle", Number.POSITIVE_INFINITY); } else scheduleAmbient(); };
    syncMotion(); media.addEventListener("change", syncMotion); document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", visibility);
      window.clearTimeout(frameTimer); window.clearTimeout(ambientTimer); storedPackage.destroy();
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  });
</script>

<svelte:window
  ondragenter={(event) => { if (event.dataTransfer?.types.includes("Files")) { event.preventDefault(); dragActive = true; } }}
  ondragover={(event) => { if (event.dataTransfer?.types.includes("Files")) event.preventDefault(); }}
  ondragleave={(event) => { if (!event.relatedTarget) dragActive = false; }}
  ondrop={(event) => { event.preventDefault(); dragActive = false; void importPackage(event.dataTransfer?.files[0]); }}
/>

<Tooltip.Provider delayDuration={250}>
<main class={s.shell} aria-label={`${activePet.displayName}, animated desktop pet`} data-slop-selection="none">
  <Tooltip.Root>
    <Tooltip.Trigger class={s.pet} data-still={reducedMotion} aria-label={activePet.description} onpointerdown={beginWindowDrag}>
      <canvas bind:this={canvas} width={CELL_WIDTH} height={CELL_HEIGHT} aria-hidden="true"></canvas>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content class={s.tooltip} data-slop-export="hide" sideOffset={6}>Drag {activePet.displayName} to move the window</Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
  {#if dragActive}<div class={s.drop} data-slop-export="hide">DROP PET ZIP</div>{/if}
  {#if error}<button class={s.error} data-slop-export="hide" onclick={() => error = null} aria-label="Dismiss error">{error}</button>{/if}
  <div class={s.rail} data-slop-export="hide">
    <span title={activePet.displayName}>{activePet.displayName}</span>
    <small>{status}</small>
    <Button.Root type="button" class={s.zip} onclick={() => fileInput.click()} disabled={importing} aria-label="Import pet ZIP">{importing ? "…" : "ZIP"}</Button.Root>
    {#if storedPackage.hasCustomFile}<Button.Root type="button" class={s.bubu} onclick={useStarter} aria-label="Restore Bubu">BUBU</Button.Root>{/if}
  </div>
  <a class={s.market} href="https://codex-pets.net/" target="_blank" rel="noreferrer">find more pets ↗</a>
  <input bind:this={fileInput} class={s.fileInput} type="file" accept=".zip,.codex-pet.zip,application/zip" onchange={event => { void importPackage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
</main>

<IconTarget><Icon image={activeImage} /></IconTarget>
<ExportTarget><Export image={activeImage} /></ExportTarget>
</Tooltip.Provider>
