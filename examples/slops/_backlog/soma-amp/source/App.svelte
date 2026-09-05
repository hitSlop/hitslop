<script lang="ts">
  import { fileStore, jsonStore } from "@hitslop/svelte";
  import { capture, ready, slop } from "@hitslop/runtime";
  import { onMount } from "svelte";
  import type WebampType from "webamp";
  import { resolveStations, stationTrack, stations, type ResolvedStation } from "./stations";
  import { validateClassicSkin } from "./skin-archive";

  type Preferences = { selectedStationId: string; skinName: string | null; milkdropOpen?: boolean };

  const COMPACT_SIZE = { width: 275, height: 438 } as const;
  const VISUALIZER_SIZE = { width: 725, height: 438 } as const;

  const preferences = jsonStore<Preferences>({ selectedStationId: "groovesalad", skinName: null, milkdropOpen: true });
  const skin = fileStore("skin", { accept: ".wsz,.zip,application/zip" });
  const renderTargets = capture.isRenderer();

  let appNode: HTMLElement;
  let webampNode = $state() as HTMLElement;
  let player = $state.raw<WebampType | null>(null);
  let resolvedStations: ResolvedStation[] = [];
  let status = $state("BOOTING RECEIVER");
  let error = $state<string | null>(null);
  let dragActive = $state(false);
  let milkdropOpen = $state(false);
  let changingMilkdrop = $state(false);
  let milkdropAvailable = $state(false);
  let destroyed = false;
  let cleanupPlayer: Array<() => void> = [];

  const isSkinFile = (file: File | undefined): file is File => Boolean(file && /\.(wsz|zip)$/i.test(file.name));

  function loadSkinFromUrl(url: string): Promise<void> {
    if (!player) return Promise.reject(new Error("The player is not ready yet."));
    const activePlayer = player;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (result: "loaded" | "failed" | "timeout") => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stopLoaded();
        stopFailed();
        if (result === "loaded") resolve();
        else reject(new Error(result === "timeout" ? "The skin took too long to load." : "Webamp could not apply that skin."));
      };
      const stopLoaded = activePlayer._actionEmitter.on("SET_SKIN_DATA", () => finish("loaded"));
      const stopFailed = activePlayer._actionEmitter.on("LOADED", () => finish("failed"));
      const timer = window.setTimeout(() => finish("timeout"), 15_000);
      activePlayer.setSkinFromUrl(url);
    });
  }

  async function applySkin(file: File): Promise<void> {
    error = null;
    status = "CHECKING SKIN";
    let objectUrl: string | null = null;
    try {
      await validateClassicSkin(file);
      status = "APPLYING SKIN";
      objectUrl = URL.createObjectURL(file);
      await loadSkinFromUrl(objectUrl);
      status = "SAVING SKIN";
      try {
        await skin.replace(file);
        preferences.current.skinName = file.name.replace(/\.(wsz|zip)$/i, "");
        status = "SKIN SAVED";
      } catch (cause) {
        error = `Skin is active for this session but could not be saved: ${cause instanceof Error ? cause.message : String(cause)}`;
        status = "SAVE FAILED";
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = "SKIN REJECTED";
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  function chooseSkin(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".wsz,.zip,application/zip";
    input.hidden = true;
    document.body.append(input);
    input.click();
  }

  function interceptSkinInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (!isSkinFile(file)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    input.remove();
    void applySkin(file);
  }

  function interceptSkinDrag(event: DragEvent): void {
    const file = event.dataTransfer?.files?.[0];
    if (!isSkinFile(file)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    if (event.type === "drop") {
      dragActive = false;
      void applySkin(file);
    } else {
      dragActive = true;
    }
  }

  function lockDockedWindows(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLElement && (target.classList.contains("draggable") || target.id.endsWith("resize-target"))) event.stopPropagation();
  }

  function playerMilkdropIsOpen(): boolean {
    const state = player?.store.getState() as { windows?: { genWindows?: { milkdrop?: { open?: boolean } } } } | undefined;
    return Boolean(state?.windows?.genWindows?.milkdrop?.open);
  }

  async function requestDocumentSize(open: boolean): Promise<boolean> {
    try {
      const requested = open ? VISUALIZER_SIZE : COMPACT_SIZE;
      const applied = await slop.window.resize(requested);
      if (applied.width < requested.width || applied.height < requested.height) {
        throw new Error("The display does not have enough room for this layout.");
      }
      return true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = "VIS UNAVAILABLE";
      return false;
    }
  }

  async function toggleMilkdrop(): Promise<void> {
    if (!player || changingMilkdrop) return;
    const open = !playerMilkdropIsOpen();
    if (open && !milkdropAvailable) {
      error = "MilkDrop needs WebGL, which is unavailable in this view.";
      status = "VIS UNAVAILABLE";
      return;
    }
    changingMilkdrop = true;
    error = null;
    try {
      if (open) {
        if (!await requestDocumentSize(true)) return;
        milkdropOpen = true;
        player.store.dispatch({ type: "TOGGLE_WINDOW", windowId: "milkdrop" });
      } else {
        player.store.dispatch({ type: "CLOSE_WINDOW", windowId: "milkdrop" });
        milkdropOpen = false;
        await requestDocumentSize(false);
      }
      preferences.current.milkdropOpen = open;
      status = open ? "MILKDROP ON" : "MILKDROP OFF";
    } finally {
      changingMilkdrop = false;
    }
  }

  function syncExternalMilkdropAction(action: { windowId?: string }): void {
    if (action.windowId !== "milkdrop" || changingMilkdrop) return;
    queueMicrotask(() => {
      const open = playerMilkdropIsOpen();
      if (open === milkdropOpen) return;
      void (async () => {
        if (open && !await requestDocumentSize(true)) {
          changingMilkdrop = true;
          player?.store.dispatch({ type: "CLOSE_WINDOW", windowId: "milkdrop" });
          changingMilkdrop = false;
          return;
        }
        milkdropOpen = open;
        preferences.current.milkdropOpen = open;
        if (!open) await requestDocumentSize(false);
      })();
    });
  }

  function useBaseSkin(): void {
    player?.store.dispatch({ type: "LOAD_DEFAULT_SKIN" });
    status = "BASE SKIN";
  }

  async function removeStoredSkin(): Promise<void> {
    if (!skin.hasCustomFile) return;
    try {
      await skin.remove();
      preferences.current.skinName = null;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function rememberStation(track: { url: string } | null): void {
    if (!track) return;
    const station = resolvedStations.find((item) => item.stream === track.url);
    if (station) preferences.current.selectedStationId = station.id;
  }

  async function initialize(): Promise<void> {
    try {
      const [, , available] = await Promise.all([preferences.reload(), skin.reload(), resolveStations()]);
      if (destroyed) return;
      const testCanvas = document.createElement("canvas");
      milkdropAvailable = Boolean(testCanvas.getContext("webgl2") ?? testCanvas.getContext("webgl"));
      const wantsMilkdrop = preferences.current.milkdropOpen ?? true;
      if (wantsMilkdrop && !milkdropAvailable) {
        error = "MilkDrop needs WebGL, which is unavailable in this view.";
        status = "VIS UNAVAILABLE";
      }
      const preferredMilkdrop = wantsMilkdrop && milkdropAvailable;
      milkdropOpen = preferredMilkdrop && await requestDocumentSize(true);
      const { default: Webamp } = await import("webamp/butterchurn");
      resolvedStations = available;
      const fallbackCount = available.filter((station) => station.usedFallback).length;
      player = new Webamp({
        initialTracks: available.map(stationTrack),
        ...(skin.src ? { initialSkin: { url: skin.src } } : {}),
        enableDoubleSizeMode: false,
        enableHotkeys: true,
        enableMediaSession: true,
        windowLayout: {
          main: { position: { top: 0, left: 0 } },
          equalizer: { position: { top: 116, left: 0 } },
          playlist: { position: { top: 232, left: 0 }, size: { extraHeight: 2, extraWidth: 0 } },
          milkdrop: { position: { top: 0, left: 275 }, size: { extraHeight: 10, extraWidth: 7 }, closed: !milkdropOpen },
        },
      });
      cleanupPlayer = [
        player.onWillClose((cancel) => cancel()),
        player.onTrackDidChange(rememberStation),
        player._actionEmitter.on("LOAD_DEFAULT_SKIN", () => { void removeStoredSkin(); }),
        player._actionEmitter.on("CLOSE_WINDOW", syncExternalMilkdropAction),
        player._actionEmitter.on("TOGGLE_WINDOW", syncExternalMilkdropAction),
      ];
      if (document.documentElement.dataset.slopCapture === "static") player.store.dispatch({ type: "DISABLE_MARQUEE" });
      await player.renderInto(webampNode);
      const selectedIndex = Math.max(0, available.findIndex((station) => station.id === preferences.current.selectedStationId));
      player.setCurrentTrack(selectedIndex);
      status = fallbackCount ? `${stations.length} PRESETS · ${fallbackCount} DIRECT` : `${stations.length} PRESETS · PLS LOCK`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = "RECEIVER ERROR";
    } finally {
      ready();
    }
  }

  onMount(() => {
    // WKWebView's catalog renderer does not need to boot Web Audio. Keeping the
    // capture path deterministic also avoids a GPU/audio web-process launch for
    // a still image; the installed document continues through the live branch.
    if (renderTargets) {
      ready();
      return;
    }
    document.addEventListener("change", interceptSkinInput, true);
    appNode.addEventListener("dragenter", interceptSkinDrag, true);
    appNode.addEventListener("dragover", interceptSkinDrag, true);
    appNode.addEventListener("drop", interceptSkinDrag, true);
    appNode.addEventListener("mousedown", lockDockedWindows, true);
    appNode.addEventListener("touchstart", lockDockedWindows, true);
    appNode.addEventListener("dragleave", () => { dragActive = false; });
    void initialize();
    return () => {
      destroyed = true;
      document.removeEventListener("change", interceptSkinInput, true);
      appNode.removeEventListener("dragenter", interceptSkinDrag, true);
      appNode.removeEventListener("dragover", interceptSkinDrag, true);
      appNode.removeEventListener("drop", interceptSkinDrag, true);
      appNode.removeEventListener("mousedown", lockDockedWindows, true);
      appNode.removeEventListener("touchstart", lockDockedWindows, true);
      cleanupPlayer.forEach((cleanup) => cleanup());
      player?.pause();
      player?.dispose();
      skin.destroy();
      preferences.destroy();
    };
  });
</script>

<main bind:this={appNode} class="soma-amp" class:drag-active={dragActive} class:milkdrop-open={milkdropOpen} aria-label="SomaAmp classic SomaFM receiver" data-slop-selection="none">
  {#if renderTargets}
    <section class="static-viewport" aria-label="Classic audio player preview"><div class="static-stack">
      <div class="static-panel static-main">
        <div class="static-title"><i></i><strong>WINAMP</strong><i></i></div>
        <div class="static-readout"><b>▶</b><span>GROOVE SALAD · SOMAFM</span><em>128 KBPS</em></div>
        <div class="static-controls"><button>◀</button><button>▶</button><button>Ⅱ</button><button>■</button><button>▶|</button><button>▴</button></div>
      </div>
      <div class="static-panel static-eq">
        <div class="static-title"><i></i><strong>WINAMP EQUALIZER</strong><i></i></div>
        <div class="static-eq-head"><b>ON</b><span>PRESETS</span></div>
        <div class="static-sliders">{#each [72, 48, 62, 80, 54, 68, 43, 77, 58, 71, 51] as top}<i style:--top={`${top}px`}></i>{/each}</div>
      </div>
      <div class="static-panel static-playlist">
        <div class="static-title"><i></i><strong>WINAMP PLAYLIST</strong><i></i></div>
        <ol>{#each stations as station}<li>{station.genre} — {station.title}</li>{/each}</ol>
        <div class="static-playlist-controls"><b>ADD</b><b>REM</b><b>SEL</b><b>MISC</b><span>0:00/0:00</span></div>
      </div>
    </div></section>
  {:else}
    <section class="player-stack" aria-label="Classic audio player">
      <div class="webamp-stage"><div bind:this={webampNode} class="webamp-mount"></div></div>
      {#if dragActive}<div class="drop-callout" data-slop-export="hide">DROP .WSZ TO RESKIN</div>{/if}
    </section>
  {/if}

  <footer class="utility-rail">
    <a class="soma-link" href="https://somafm.com/support/" target="_blank" rel="noreferrer"><span class="wide-label">LISTENER-SUPPORTED SOMAFM ↗</span><span class="compact-label">SOMAFM ↗</span></a>
    <span class:error role="status" aria-live="polite" title={error ?? status}>{renderTargets ? "8 PRESETS · PLS LOCK" : (error ?? status)}</span>
    <div class="skin-actions" data-slop-export="hide">
      <button class:active={milkdropOpen} onclick={() => void toggleMilkdrop()} disabled={!player || changingMilkdrop || !milkdropAvailable}>VIS</button>
      <a class="skin-link" href="https://skins.webamp.org/" target="_blank" rel="noreferrer"><span class="wide-label">GET SKINS ↗</span><span class="compact-label">SKINS ↗</span></a>
      <button onclick={chooseSkin} disabled={skin.isLoading}><span class="wide-label">LOAD .WSZ</span><span class="compact-label">.WSZ</span></button>
      {#if skin.hasCustomFile}<button onclick={useBaseSkin}>BASE SKIN</button>{/if}
    </div>
  </footer>
</main>

{#if renderTargets}
  <div class="render-target icon-target" data-slop-render="icon" aria-hidden="true">
    <div class="icon-screen"><span>▶</span><i></i><i></i><i></i><i></i><i></i></div>
  </div>
{/if}
