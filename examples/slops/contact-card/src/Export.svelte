<script lang="ts">
  import Mail from "@lucide/svelte/icons/mail";
  import Phone from "@lucide/svelte/icons/phone";
  import Globe from "@lucide/svelte/icons/globe";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import type { ContactCard } from "../schema";
  import theme from "../theme";
  import * as s from "./styles.css";

  const t = theme.vars;

  let { data, avatarSrc }: { data: ContactCard; avatarSrc: string } = $props();
  const letter = $derived((data.name.trim()[0] ?? "?").toUpperCase());
  const monogram = $derived(initialsOf(data.name));
  const websiteHref = $derived(hrefForWebsite(data.website));
  const phoneHref = $derived(telHref(data.phone));
  const mailHref = $derived(data.email.trim() ? `mailto:${data.email.trim()}` : "");
  const hasChannel = $derived(Boolean(data.email.trim() || data.phone.trim() || data.website.trim()));

  function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "";
    const first = parts[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1] ?? "" : "";
    return last ? `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() : first.slice(0, 2).toUpperCase();
  }
  function hrefForWebsite(url: string): string {
    const value = url.trim();
    if (!value) return "";
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }
  function telHref(phone: string): string {
    const value = phone.trim();
    if (!value) return "";
    return `tel:${value.replace(/[^\d+]/g, "")}`;
  }
</script>

<article class={s.exportCanvas} aria-label="Exported contact card">
  <span class={s.indexTab} aria-hidden="true">{letter}</span>
  <section class={s.badge}>
    <div class={s.notch} aria-hidden="true"></div>
    <p class={s.stamp}>PAGER 01</p>
    <div class={s.hero}>
      <div class={s.avatar} aria-hidden="true">
        {#if avatarSrc}
          <img class={s.avatarImg} src={avatarSrc} alt="" />
        {:else if monogram}
          <span class={s.monogram}>{monogram}</span>
        {:else}
          <svg class={s.avatarImg} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill={t.avatarFill} />
            <circle cx="50" cy="38" r="18" fill={t.avatarInk} />
            <path d="M22 84C22 68 34 58 50 58C66 58 78 68 78 84" fill={t.avatarInk} />
          </svg>
        {/if}
      </div>
      <div class={s.profile}>
        <h1 class={s.nameText}>{data.name.trim() || "Unnamed contact"}</h1>
        {#if data.headline.trim()}<p class={s.headlineText}>{data.headline}</p>{/if}
        {#if data.location.trim()}
          <div class={s.locationTag}><MapPin size={12} /><span class={s.locationText}>{data.location}</span></div>
        {/if}
      </div>
    </div>
    {#if data.bio.trim()}
      <section class={s.bioBox}><p class={s.bioText}>{data.bio}</p></section>
    {/if}
    <ul class={s.channels} aria-label="Contact channels">
      {#if data.email.trim()}
        <li class={s.row}><div class={s.bubble}><Mail size={14} /></div><div class={s.fields}><span class={s.label}>Email</span><span class={s.valueText}>{data.email}</span></div></li>
      {/if}
      {#if data.phone.trim()}
        <li class={s.row}><div class={s.bubble}><Phone size={14} /></div><div class={s.fields}><span class={s.label}>Phone</span><span class={s.valueText}>{data.phone}</span></div></li>
      {/if}
      {#if data.website.trim()}
        <li class={s.row}><div class={s.bubble}><Globe size={14} /></div><div class={s.fields}><span class={s.label}>Website</span><span class={s.valueText}>{data.website}</span></div></li>
      {/if}
      {#if !hasChannel}
        <li class={s.empty}>No contact channels yet.</li>
      {/if}
    </ul>
    <footer class={s.footer}>
      <div class={s.circles}>
        <a class={s.circleBtn} href={mailHref || undefined} aria-label="Compose email" aria-disabled={!mailHref}><Mail size={16} /></a>
        <a class={s.circleBtn} href={phoneHref || undefined} aria-label="Call" aria-disabled={!phoneHref}><Phone size={16} /></a>
        <a class={s.circleBtn} href={websiteHref || undefined} target="_blank" rel="noopener noreferrer" aria-label="Visit website" aria-disabled={!websiteHref}><Globe size={16} /></a>
      </div>
    </footer>
  </section>
</article>
