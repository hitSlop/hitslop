<script lang="ts">
  import { fileStore } from "@hitslop/svelte";
  import { capture, ready, slop } from "@hitslop/runtime";
  import { onMount, tick } from "svelte";
  import { parsePetArchive, parsePetPackage, validateSpriteImage, type PetMetadata } from "./pet-package";

  type PetAction = "idle" | "running-right" | "running-left" | "waving" | "jumping" | "failed" | "waiting" | "running" | "review";
  type ActionSpec = { row: number; durations: number[] };

  const CELL_WIDTH = 192, CELL_HEIGHT = 208;
  const RENDER_SIZE = 512;
  const STARTER_URL = "/assets/bubu-spritesheet.webp";
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
  const renderTargets = capture.isRenderer();
  let canvas: HTMLCanvasElement;
  let iconCanvas = $state<HTMLCanvasElement>();
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

  function idleFrameBounds(image: HTMLImageElement): { x: number; y: number; width: number; height: number } {
    const scratch = document.createElement("canvas");
    scratch.width = CELL_WIDTH; scratch.height = CELL_HEIGHT;
    const context = scratch.getContext("2d", { willReadFrequently: true });
    if (!context) return { x: 0, y: 0, width: CELL_WIDTH, height: CELL_HEIGHT };
    context.drawImage(image, 0, 0, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
    const rgba = context.getImageData(0, 0, CELL_WIDTH, CELL_HEIGHT).data;
    let minX = CELL_WIDTH, minY = CELL_HEIGHT, maxX = -1, maxY = -1;
    for (let y = 0; y < CELL_HEIGHT; y += 1) for (let x = 0; x < CELL_WIDTH; x += 1) {
      if ((rgba[(y * CELL_WIDTH + x) * 4 + 3] ?? 0) <= 8) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (maxX < minX || maxY < minY) return { x: 0, y: 0, width: CELL_WIDTH, height: CELL_HEIGHT };
    minX = Math.max(0, minX - 2); minY = Math.max(0, minY - 2);
    maxX = Math.min(CELL_WIDTH - 1, maxX + 2); maxY = Math.min(CELL_HEIGHT - 1, maxY + 2);
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  function drawRenderTarget(target: HTMLCanvasElement, image: HTMLImageElement): void {
    target.width = RENDER_SIZE; target.height = RENDER_SIZE;
    const context = target.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, RENDER_SIZE, RENDER_SIZE);
    context.fillStyle = "#fff1d9";
    context.beginPath(); context.roundRect(24, 24, 464, 464, 52); context.fill();
    context.strokeStyle = "#4b342b"; context.lineWidth = 10;
    context.beginPath(); context.roundRect(29, 29, 454, 454, 47); context.stroke();
    const bounds = idleFrameBounds(image);
    const safe = { x: 56, y: 56, size: 400 };
    const scale = Math.min(safe.size / bounds.width, safe.size / bounds.height);
    const width = Math.round(bounds.width * scale), height = Math.round(bounds.height * scale);
    const x = Math.round(safe.x + (safe.size - width) / 2), y = Math.round(safe.y + (safe.size - height) / 2);
    context.imageSmoothingEnabled = false;
    context.shadowColor = "rgba(54, 33, 25, .18)";
    context.shadowBlur = 7;
    context.shadowOffsetY = 5;
    context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, x, y, width, height);
  }

  function drawRenderTargets(image: HTMLImageElement): void {
    if (iconCanvas) drawRenderTarget(iconCanvas, image);
  }

  function play(next: PetAction, cycles = 1): void {
    window.clearTimeout(frameTimer);
    action = next; frame = 0; draw();
    if (reducedMotion || renderTargets) return;
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
    if (reducedMotion || renderTargets || document.hidden) return;
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
    drawRenderTargets(image);
    play("idle", Number.POSITIVE_INFINITY);
    status = storedPackage.hasCustomFile ? "Custom pet · drag me" : "Drag me around";
    markReady(); scheduleAmbient();
  }

  async function loadStarter(generation: number): Promise<void> {
    await adoptImage(STARTER, STARTER_URL, null, generation);
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

  function choosePackage(): void { fileInput.click(); }

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
    void slop.window.drag().then(() => { window.setTimeout(() => { status = "Drag me around"; }, 850); }).catch((cause) => {
      error = cause instanceof Error ? cause.message : String(cause);
    });
  }

  function interceptDrop(event: DragEvent): void {
    event.preventDefault(); dragActive = false;
    void importPackage(event.dataTransfer?.files[0]);
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
  ondrop={interceptDrop}
/>

<main class:drag-active={dragActive} class="pet-shell" aria-label={`${activePet.displayName}, animated desktop pet`} data-slop-selection="none">
  <button
    class="pet"
    class:still={reducedMotion}
    aria-label={activePet.description}
    title={`Drag ${activePet.displayName} to move the window`}
    onpointerdown={beginWindowDrag}
  ><canvas bind:this={canvas} width={CELL_WIDTH} height={CELL_HEIGHT} aria-hidden="true"></canvas></button>

  {#if dragActive}<div class="drop-target" data-slop-export="hide">DROP PET ZIP</div>{/if}
  {#if error}<button class="error" data-slop-export="hide" onclick={() => error = null} aria-label="Dismiss error">{error}</button>{/if}

  <div class="pet-rail" data-slop-export="hide">
    <span title={activePet.displayName}>{activePet.displayName}</span>
    <small>{status}</small>
    <button onclick={choosePackage} disabled={importing}>{importing ? "…" : "ZIP"}</button>
    {#if storedPackage.hasCustomFile}<button onclick={useStarter}>BUBU</button>{/if}
  </div>
  <a class="pet-market" href="https://codex-pets.net/" target="_blank" rel="noreferrer">find more pets ↗</a>
  <input bind:this={fileInput} class="file-input" type="file" accept=".zip,.codex-pet.zip,application/zip" onchange={(event) => { void importPackage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
</main>

{#if renderTargets}
  <canvas bind:this={iconCanvas} class="render-target icon-target" width={RENDER_SIZE} height={RENDER_SIZE} data-slop-render="icon" aria-hidden="true"></canvas>
{/if}
