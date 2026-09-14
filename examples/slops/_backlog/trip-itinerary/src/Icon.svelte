<script lang="ts">
  import * as s from "./styles.css";

  let {
    origin = "SFO",
    originCity = "SAN FRANCISCO",
    destination = "NRT",
    destCity = "TOKYO NARITA",
    flight = "HS-774",
    gate = "B12",
    seat = "02A",
    packed = 0,
    total = 0,
  }: {
    origin?: string;
    originCity?: string;
    destination?: string;
    destCity?: string;
    flight?: string;
    gate?: string;
    seat?: string;
    packed?: number;
    total?: number;
  } = $props();
</script>

<div class={s.iconSurface} aria-hidden="true">
  <article class={s.iconPass}>
    <div class={s.iconMain}>
      <div class={s.iconHead}>
        <span class={s.iconAirline}>HITSLOP AIRWAYS</span>
        <span class={s.iconClass}>BOARDING</span>
      </div>
      <div class={s.iconRoute}>
        <div class={s.iconCity}><strong>{origin || "SFO"}</strong><span>{originCity || "ORIGIN"}</span></div>
        <span class={s.iconPlane}>✈</span>
        <div class={s.iconCity}><strong>{destination || "NRT"}</strong><span>{destCity || "DEST"}</span></div>
      </div>
      <div class={s.iconMeta}>
        <div><span>FLIGHT</span><strong>{flight || "—"}</strong></div>
        <div><span>GATE</span><strong>{gate || "—"}</strong></div>
        <div><span>SEAT</span><strong>{seat || "—"}</strong></div>
      </div>
    </div>
    <div class={s.iconPerf}>
      <span class={`${s.iconNotch} ${s.iconNotchTop}`}></span>
      <span class={`${s.iconNotch} ${s.iconNotchBottom}`}></span>
    </div>
    <div class={s.iconStub}>
      <div class={s.iconBarcode}></div>
      <span class={s.iconCode}>{total > 0 && packed === total ? "BOARDED" : "OPEN"}</span>
    </div>
  </article>
</div>
