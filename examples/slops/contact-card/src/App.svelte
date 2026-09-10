<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, imageStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Button, Tooltip } from "bits-ui";
  import Mail from "@lucide/svelte/icons/mail";
  import Phone from "@lucide/svelte/icons/phone";
  import Globe from "@lucide/svelte/icons/globe";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import Camera from "@lucide/svelte/icons/camera";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import contactSchema from "../schema";
  import theme from "../theme";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const t = theme.vars;

  const card = jsonStore({ schema: contactSchema, initial: {
    name: "Jamie Park",
    headline: "Freelance Product Designer",
    location: "San Francisco, CA",
    bio: "I design thoughtful products and tactile digital tools that solve real everyday problems.",
    email: "jamie@park.dev",
    phone: "(555) 987-6543",
    website: "https://park.dev",
  } });
  const avatar = imageStore("avatar", { fallback: "" });

  let copiedField = $state<string | null>(null);
  const tabLetter = $derived(indexLetter(card.current.name));
  const monogram = $derived(initialsOf(card.current.name));
  const websiteHref = $derived(hrefForWebsite(card.current.website));
  const phoneHref = $derived(telHref(card.current.phone));
  const mailHref = $derived(card.current.email.trim() ? `mailto:${card.current.email.trim()}` : "");

  $effect(() => { if (card.isReady) ready(); });
  $effect(() => {
    if (!copiedField) return;
    const field = copiedField;
    const timer = window.setTimeout(() => { if (copiedField === field) copiedField = null; }, 1800);
    return () => window.clearTimeout(timer);
  });
  onDestroy(() => {
    card.destroy();
    avatar.destroy();
  });

  function indexLetter(name: string): string {
    return (name.trim()[0] ?? "?").toUpperCase();
  }
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
  function vCardEscape(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }
  async function copyToClipboard(text: string, fieldId: string) {
    const value = text.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      copiedField = fieldId;
    } catch {
      // ignore
    }
  }
  function downloadVCard() {
    const data = card.current;
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vCardEscape(data.name.trim() || "Unnamed contact")}`];
    if (data.headline.trim()) lines.push(`TITLE:${vCardEscape(data.headline)}`);
    if (data.email.trim()) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vCardEscape(data.email)}`);
    if (data.phone.trim()) lines.push(`TEL;TYPE=CELL:${vCardEscape(data.phone)}`);
    if (data.website.trim()) lines.push(`URL:${vCardEscape(hrefForWebsite(data.website) || data.website)}`);
    if (data.location.trim()) lines.push(`ADR;TYPE=WORK:;;${vCardEscape(data.location)};;;;`);
    if (data.bio.trim()) lines.push(`NOTE:${vCardEscape(data.bio)}`);
    lines.push("END:VCARD");
    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(data.name.trim() || "contact").toLowerCase().replace(/\s+/g, "_")}.vcf`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<Tooltip.Provider delayDuration={200}>
<main class={s.canvas} data-slop-selection="none" aria-busy={card.isLoading} aria-label="Contact card">
  <div class={s.tray}>
  <span class={s.indexTab} aria-hidden="true">{tabLetter}</span>
  <article class={s.badge} inert={!card.isReady || card.isLoading}>
    <div class={s.notch} aria-hidden="true"></div>
    <p class={s.stamp}>PAGER 01</p>

    <section class={s.hero} aria-label="Profile overview">
      <Button.Root type="button" class={s.avatar} onclick={() => avatar.choose()} aria-label="Change profile photo">
        {#if avatar.src}
          <img class={s.avatarImg} src={avatar.src} alt="" />
        {:else if monogram}
          <span class={s.monogram}>{monogram}</span>
        {:else}
          <svg class={s.avatarImg} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="100" height="100" fill={t.avatarFill} />
            <circle cx="50" cy="38" r="18" fill={t.avatarInk} />
            <path d="M22 84C22 68 34 58 50 58C66 58 78 68 78 84" fill={t.avatarInk} />
          </svg>
        {/if}
        <span class={s.overlay} data-slop-export="hide"><Camera size={20} /></span>
      </Button.Root>
      <div class={s.profile}>
        <input class={s.nameInput} aria-label="Full name" placeholder="Your name" bind:value={card.current.name} />
        <input class={s.headlineInput} aria-label="Professional headline" placeholder="Title or role" bind:value={card.current.headline} />
        <div class={s.locationTag}>
          <MapPin size={12} />
          <input class={s.locInput} aria-label="Location" placeholder="City" bind:value={card.current.location} />
        </div>
      </div>
    </section>

    <section class={s.bioBox} aria-label="Short biography">
      <textarea class={s.bioInput} rows="3" aria-label="Short bio" placeholder="A short note about you." bind:value={card.current.bio}></textarea>
    </section>

    <ul class={s.channels} aria-label="Contact channels">
      <li class={s.row}>
        <div class={s.bubble}><Mail size={14} /></div>
        <div class={s.fields}>
          <span class={s.label}>Email</span>
          <input class={s.valueInput} aria-label="Email address" placeholder="name@example.com" bind:value={card.current.email} />
        </div>
        <Tooltip.Root disableCloseOnTriggerClick>
          <Tooltip.Trigger class={s.actionBtn} data-slop-export="hide" aria-label={copiedField === "email" ? "Email copied" : "Copy email"} disabled={!card.current.email.trim()} onclick={() => copyToClipboard(card.current.email, "email")}>
            {#if copiedField === "email"}<Check size={14} class={s.copied} />{:else}<Copy size={14} />{/if}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content class={s.tooltip} sideOffset={6} data-slop-export="hide">{copiedField === "email" ? "Copied" : "Copy email"}</Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </li>
      <li class={s.row}>
        <div class={s.bubble}><Phone size={14} /></div>
        <div class={s.fields}>
          <span class={s.label}>Phone</span>
          <input class={s.valueInput} aria-label="Phone number" placeholder="(555) 000-0000" bind:value={card.current.phone} />
        </div>
        <Tooltip.Root disableCloseOnTriggerClick>
          <Tooltip.Trigger class={s.actionBtn} data-slop-export="hide" aria-label={copiedField === "phone" ? "Phone copied" : "Copy phone"} disabled={!card.current.phone.trim()} onclick={() => copyToClipboard(card.current.phone, "phone")}>
            {#if copiedField === "phone"}<Check size={14} class={s.copied} />{:else}<Copy size={14} />{/if}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content class={s.tooltip} sideOffset={6} data-slop-export="hide">{copiedField === "phone" ? "Copied" : "Copy phone"}</Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </li>
      <li class={s.row}>
        <div class={s.bubble}><Globe size={14} /></div>
        <div class={s.fields}>
          <span class={s.label}>Website</span>
          <input class={s.valueInput} aria-label="Personal website" placeholder="yoursite.com" bind:value={card.current.website} />
        </div>
        <a class={s.actionBtn} data-slop-export="hide" aria-label="Open website" aria-disabled={!websiteHref} href={websiteHref || undefined} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
        </a>
      </li>
    </ul>

    <footer class={s.footer}>
      <div class={s.circles}>
        <a class={s.circleBtn} href={mailHref || undefined} aria-label="Compose email to {card.current.name || 'this contact'}" aria-disabled={!mailHref}><Mail size={16} /></a>
        <a class={s.circleBtn} href={phoneHref || undefined} aria-label="Call {card.current.name || 'this contact'}" aria-disabled={!phoneHref}><Phone size={16} /></a>
        <a class={s.circleBtn} href={websiteHref || undefined} target="_blank" rel="noopener noreferrer" aria-label="Visit website" aria-disabled={!websiteHref}><Globe size={16} /></a>
      </div>
      <Button.Root type="button" class={s.vcardBtn} data-slop-export="hide" onclick={downloadVCard} aria-label="Save contact to Address Book">
        <Download size={14} />
        <span>Save vCard</span>
      </Button.Root>
    </footer>
  </article>
  </div>

  {#if card.error}
    <div class={s.error} role="alert">
      <span>{card.isReady ? "Changes haven’t been saved." : "Your card couldn’t be loaded."} {card.error}</span>
      <Button.Root type="button" data-slop-export="hide" onclick={() => { if (card.isReady) void card.flush().catch(() => undefined); else void card.reload(); }}>Try again</Button.Root>
    </div>
  {:else if avatar.error}
    <div class={s.error} role="alert">
      <span>Portrait couldn’t be updated. {avatar.error}</span>
      <Button.Root type="button" data-slop-export="hide" onclick={() => avatar.choose()}>Choose photo</Button.Root>
    </div>
  {:else if card.isLoading}<p class={s.error} role="status">Loading your card…</p>{/if}
</main>

<IconTarget><Icon letter={tabLetter} /></IconTarget>
<ExportTarget><Export data={card.current} avatarSrc={avatar.src ?? ""} /></ExportTarget>
</Tooltip.Provider>
