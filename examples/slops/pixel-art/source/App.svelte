<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Download from "@lucide/svelte/icons/download";
  import Eraser from "@lucide/svelte/icons/eraser";
  import PaintBucket from "@lucide/svelte/icons/paint-bucket";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import Icon from "./Icon.svelte";

  type Tool = "pencil" | "eraser" | "fill";
  type PaletteId = "gameboy" | "pico8" | "cyberpunk" | "mono";

  type PixelArtState = {
    pixels: string[];
    paletteId: PaletteId;
    selectedColor: string;
  };

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

  const store = jsonStore<PixelArtState>({
    pixels: seedSprite(),
    paletteId: "gameboy",
    selectedColor: "#0f380f",
  });

  let tool = $state<Tool>("pencil");
  let painting = $state(false);
  let undoStack = $state<string[][]>([]);
  const palette = $derived(PALETTES[store.current.paletteId]);

  function snapshot(): void {
    undoStack = [...undoStack.slice(-29), [...store.current.pixels]];
  }

  function paintAt(index: number, color: string): void {
    if (store.current.pixels[index] === color) return;
    store.current.pixels[index] = color;
  }

  function fill(start: number, color: string): void {
    const target = store.current.pixels[start] ?? "";
    if (target === color) return;
    const queue = [start];
    const seen = new Set<number>([start]);
    while (queue.length > 0) {
      const index = queue.pop()!;
      if ((store.current.pixels[index] ?? "") !== target) continue;
      store.current.pixels[index] = color;
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
        if ((store.current.pixels[next] ?? "") === target) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }

  function applyCell(index: number): void {
    if (tool === "fill") {
      fill(index, store.current.selectedColor);
      return;
    }
    const color = tool === "eraser" ? "" : store.current.selectedColor;
    paintAt(index, color);
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
    store.current.pixels = previous;
  }

  function setPalette(id: PaletteId): void {
    store.current.paletteId = id;
    if (!PALETTES[id].colors.includes(store.current.selectedColor)) {
      store.current.selectedColor = PALETTES[id].colors[0] ?? "#111111";
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
      const color = store.current.pixels[i];
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

<main class="console-shell" data-slop-selection="none">
  <header class="console-brand">
    <span class="brand-dot"></span>
    <strong>SPRITE POCKET</strong>
    <span class="brand-dot"></span>
  </header>

  <section class="screen-bezel">
    <div
      class="pixel-grid"
      role="application"
      aria-label="16 by 16 pixel canvas"
      onpointerdown={onGridDown}
      onpointermove={onGridMove}
      onpointerup={onGridUp}
      onpointercancel={onGridUp}
      onpointerleave={onGridUp}
    >
      {#each store.current.pixels as color, index (index)}
        <span class="cell" class:empty={!color} style:background={color || "transparent"}></span>
      {/each}
    </div>
  </section>

  <section class="tool-row" data-slop-export="hide">
    <button type="button" class="tool" class:active={tool === "pencil"} onclick={() => { tool = "pencil"; }} aria-label="Pencil">
      <Pencil size={16} />
    </button>
    <button type="button" class="tool" class:active={tool === "eraser"} onclick={() => { tool = "eraser"; }} aria-label="Eraser">
      <Eraser size={16} />
    </button>
    <button type="button" class="tool" class:active={tool === "fill"} onclick={() => { tool = "fill"; }} aria-label="Fill">
      <PaintBucket size={16} />
    </button>
    <button type="button" class="tool" onclick={undo} disabled={undoStack.length === 0} aria-label="Undo">
      <Undo2 size={16} />
    </button>
    <button type="button" class="tool export" onclick={exportPng} aria-label="Export PNG">
      <Download size={16} />
    </button>
  </section>

  <section class="palette-block">
    <div class="palette-tabs" data-slop-export="hide" role="radiogroup" aria-label="Palette">
      {#each Object.entries(PALETTES) as [id, spec]}
        <button
          type="button"
          class="palette-tab"
          class:active={store.current.paletteId === id}
          onclick={() => setPalette(id as PaletteId)}
          role="radio"
          aria-checked={store.current.paletteId === id}
        >
          {spec.label}
        </button>
      {/each}
    </div>
    <div class="swatches" role="radiogroup" aria-label="Colors">
      {#each palette.colors as color}
        <button
          type="button"
          class="swatch"
          class:active={store.current.selectedColor === color}
          style:background={color}
          onclick={() => { store.current.selectedColor = color; tool = "pencil"; }}
          aria-label={color}
          role="radio"
          aria-checked={store.current.selectedColor === color}
        ></button>
      {/each}
    </div>
  </section>

  <footer class="hardware">
    <div class="dpad" aria-hidden="true">
      <i class="up"></i>
      <i class="left"></i>
      <i class="right"></i>
      <i class="down"></i>
    </div>
    <div class="face-buttons" aria-hidden="true">
      <span>B</span>
      <span>A</span>
    </div>
  </footer>
</main>

{#if store.error}
  <p class="store-error">The sprite could not be saved.</p>
{/if}

{#if capture.isRenderer()}
  <Icon />
{/if}
