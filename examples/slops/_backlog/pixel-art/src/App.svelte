<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import Download from "@lucide/svelte/icons/download";
  import Eraser from "@lucide/svelte/icons/eraser";
  import PaintBucket from "@lucide/svelte/icons/paint-bucket";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import { Tabs, ToggleGroup, RadioGroup, Button } from "bits-ui";
  import pixelArtSchema from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type Tool = "pencil" | "eraser" | "fill";
  const PALETTE_IDS = ["gameboy", "pico8", "cyberpunk", "mono"] as const;
  type PaletteId = typeof PALETTE_IDS[number];

  const SIZE = 16;
  const CELL_COUNT = SIZE * SIZE;
  const PALETTES: Record<PaletteId, { label: string; colors: string[] }> = {
    gameboy: {
      label: "GB",
      colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
    },
    pico8: {
      label: "PICO",
      colors: [
        "#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
        "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa",
      ],
    },
    cyberpunk: {
      label: "NEON",
      colors: ["#0b0b12", "#2de2e6", "#ff2bd6", "#f9f002", "#7a3cff", "#ff6b35", "#f8fafc"],
    },
    mono: {
      label: "MONO",
      colors: ["#111111", "#555555", "#999999", "#eeeeee"],
    },
  };

  function isPaletteId(value: string): value is PaletteId {
    return (PALETTE_IDS as readonly string[]).includes(value);
  }
  function isTool(value: string): value is Tool {
    return value === "pencil" || value === "eraser" || value === "fill";
  }
  function emptyGrid(): string[] {
    return Array.from({ length: CELL_COUNT }, () => "");
  }
  function seedSprite(): string[] {
    const pixels = emptyGrid();
    const ink = "#0f380f";
    const mid = "#306230";
    const lite = "#8bac0f";
    const paint = (x: number, y: number, color: string) => {
      pixels[y * SIZE + x] = color;
    };
    for (let x = 5; x <= 10; x += 1) paint(x, 3, ink);
    for (let x = 4; x <= 11; x += 1) paint(x, 4, ink);
    for (let y = 5; y <= 8; y += 1) {
      paint(3, y, ink);
      paint(12, y, ink);
    }
    for (let x = 4; x <= 11; x += 1) {
      paint(x, 5, lite);
      paint(x, 6, lite);
    }
    paint(6, 6, ink);
    paint(9, 6, ink);
    for (let x = 5; x <= 10; x += 1) paint(x, 8, mid);
    paint(7, 9, ink);
    paint(8, 9, ink);
    paint(6, 10, ink);
    paint(9, 10, ink);
    paint(5, 11, ink);
    paint(10, 11, ink);
    return pixels;
  }

  const doc = jsonStore({
    schema: pixelArtSchema,
    initial: {
      pixels: seedSprite(),
      paletteId: "gameboy",
      selectedColor: "#0f380f",
    },
  });
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  let tool = $state<Tool>("pencil");
  let painting = $state(false);
  let undoStack = $state<string[][]>([]);
  const paletteId = $derived(isPaletteId(doc.current.paletteId) ? doc.current.paletteId : "gameboy");
  const palette = $derived(PALETTES[paletteId]);

  function snapshot(): void {
    undoStack = [...undoStack.slice(-29), [...doc.current.pixels]];
  }
  function paintAt(index: number, color: string): void {
    if (doc.current.pixels[index] === color) return;
    doc.current.pixels[index] = color;
  }
  function fill(start: number, color: string): void {
    const target = doc.current.pixels[start] ?? "";
    if (target === color) return;
    const queue = [start];
    const seen = new Set<number>([start]);
    while (queue.length > 0) {
      const index = queue.pop()!;
      if ((doc.current.pixels[index] ?? "") !== target) continue;
      doc.current.pixels[index] = color;
      const x = index % SIZE;
      const y = Math.floor(index / SIZE);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < SIZE - 1 ? index + 1 : -1,
        y > 0 ? index - SIZE : -1,
        y < SIZE - 1 ? index + SIZE : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || seen.has(next)) continue;
        if ((doc.current.pixels[next] ?? "") === target) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }
  function applyCell(index: number): void {
    if (tool === "fill") {
      fill(index, doc.current.selectedColor);
      return;
    }
    paintAt(index, tool === "eraser" ? "" : doc.current.selectedColor);
  }
  function pointerIndex(event: PointerEvent, grid: HTMLElement): number | null {
    const rect = grid.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * SIZE);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
    return y * SIZE + x;
  }
  function onGridDown(event: PointerEvent): void {
    const grid = event.currentTarget as HTMLElement;
    const index = pointerIndex(event, grid);
    if (index === null) return;
    grid.setPointerCapture(event.pointerId);
    snapshot();
    painting = tool !== "fill";
    applyCell(index);
  }
  function onGridMove(event: PointerEvent): void {
    if (!painting) return;
    const grid = event.currentTarget as HTMLElement;
    const index = pointerIndex(event, grid);
    if (index !== null) applyCell(index);
  }
  function onGridUp(): void {
    painting = false;
  }
  function undo(): void {
    const previous = undoStack.at(-1);
    if (!previous) return;
    undoStack = undoStack.slice(0, -1);
    doc.current.pixels = previous;
  }
  function setPalette(id: string): void {
    if (!isPaletteId(id)) return;
    doc.current.paletteId = id;
    if (!PALETTES[id].colors.includes(doc.current.selectedColor)) {
      doc.current.selectedColor = PALETTES[id].colors[0] ?? "#111111";
    }
  }
  function exportPng(): void {
    const canvas = document.createElement("canvas");
    const scale = 16;
    canvas.width = SIZE * scale;
    canvas.height = SIZE * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < CELL_COUNT; i += 1) {
      const color = doc.current.pixels[i];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((i % SIZE) * scale, Math.floor(i / SIZE) * scale, scale, scale);
    }
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "sprite.png";
    link.click();
  }
</script>

<main class={s.shell} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Pixel art studio">
  <header class={s.brand}>
    <span class={s.brandDot}></span>
    <strong>SPRITE POCKET</strong>
    <span class={s.brandDot}></span>
  </header>

  <section class={s.screenBezel} inert={!doc.isReady || doc.isLoading}>
    <div
      class={s.pixelGrid}
      role="application"
      aria-label="16 by 16 pixel canvas"
      onpointerdown={onGridDown}
      onpointermove={onGridMove}
      onpointerup={onGridUp}
      onpointercancel={onGridUp}
      onpointerleave={onGridUp}
    >
      {#each doc.current.pixels as color, index (index)}
        <span class={s.cell} style:background={color || "transparent"}></span>
      {/each}
    </div>
  </section>

  <section class={s.toolRow} data-slop-export="hide">
    <ToggleGroup.Root
      type="single"
      value={tool}
      onValueChange={value => { if (isTool(value)) tool = value; }}
      class={s.toolGroup}
      aria-label="Drawing tools"
    >
      <ToggleGroup.Item value="pencil" class={s.tool} aria-label="Pencil"><Pencil size={16} /></ToggleGroup.Item>
      <ToggleGroup.Item value="eraser" class={s.tool} aria-label="Eraser"><Eraser size={16} /></ToggleGroup.Item>
      <ToggleGroup.Item value="fill" class={s.tool} aria-label="Fill"><PaintBucket size={16} /></ToggleGroup.Item>
    </ToggleGroup.Root>
    <Button.Root type="button" class={s.tool} onclick={undo} disabled={undoStack.length === 0} aria-label="Undo">
      <Undo2 size={16} />
    </Button.Root>
    <Button.Root type="button" class={`${s.tool} ${s.exportTool}`} onclick={exportPng} aria-label="Export PNG">
      <Download size={16} />
    </Button.Root>
  </section>

  <section class={s.paletteBlock}>
    <Tabs.Root value={paletteId} onValueChange={value => { if (value) setPalette(value); }} data-slop-export="hide">
      <Tabs.List class={s.paletteTabs} aria-label="Palette">
        {#each PALETTE_IDS as id}
          <Tabs.Trigger value={id} class={s.paletteTab}>{PALETTES[id].label}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </Tabs.Root>
    <RadioGroup.Root class={s.swatches} value={doc.current.selectedColor} onValueChange={value => { if (value) { doc.current.selectedColor = value; tool = "pencil"; } }} aria-label="Colors">
      {#each palette.colors as color}
        <RadioGroup.Item
          value={color}
          class={s.swatch}
          style="background:{color}"
          aria-label={color}
        />
      {/each}
    </RadioGroup.Root>
  </section>

  <footer class={s.hardware} aria-hidden="true">
    <div class={s.dpad}>
      <i class={`${s.dpadArm} ${s.dpadUp}`}></i>
      <i class={`${s.dpadArm} ${s.dpadLeft}`}></i>
      <i class={`${s.dpadArm} ${s.dpadRight}`}></i>
      <i class={`${s.dpadArm} ${s.dpadDown}`}></i>
    </div>
    <div class={s.faceButtons}>
      <span class={`${s.faceButton} ${s.faceButtonOffset}`}>B</span>
      <span class={s.faceButton}>A</span>
    </div>
  </footer>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your sprite couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading your sprite…</p>{/if}
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export pixels={doc.current.pixels} /></ExportTarget>
