<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { imageStore, jsonStore } from "@hitslop/svelte";
  import Mail from "@lucide/svelte/icons/mail";
  import Phone from "@lucide/svelte/icons/phone";
  import Globe from "@lucide/svelte/icons/globe";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import Camera from "@lucide/svelte/icons/camera";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Icon from "./Icon.svelte";

  type ContactData = {
    name: string;
    headline: string;
    location: string;
    bio: string;
    email: string;
    phone: string;
    website: string;
  };

  const card = jsonStore<ContactData>({
    name: "Jamie Park",
    headline: "Freelance Product Designer",
    location: "San Francisco, CA",
    bio: "I design thoughtful products and tactile digital tools that solve real everyday problems.",
    email: "jamie@park.dev",
    phone: "(555) 987-6543",
    website: "https://park.dev",
  });

  const avatar = imageStore("avatar", { fallback: "" });

  let copiedField = $state<string | null>(null);

  async function copyToClipboard(text: string, fieldId: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedField = fieldId;
      setTimeout(() => {
        if (copiedField === fieldId) copiedField = null;
      }, 1800);
    } catch {
      // ignore
    }
  }

  function downloadVCard() {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${card.current.name}`,
      `TITLE:${card.current.headline}`,
      `EMAIL;TYPE=INTERNET,WORK:${card.current.email}`,
      `TEL;TYPE=CELL:${card.current.phone}`,
      `URL:${card.current.website}`,
      `ADR;TYPE=WORK:;;${card.current.location};;;;`,
      `NOTE:${card.current.bio}`,
      "END:VCARD",
    ].join("\r\n");

    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${card.current.name.toLowerCase().replace(/\s+/g, "_")}.vcf`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<main class="card-canvas">
  <article class="card-badge">
    <div class="card-top-notch" aria-hidden="true"></div>

    <!-- Profile Hero -->
    <section class="profile-hero" aria-label="Profile Overview">
      <div
        class="avatar-wrapper"
        onclick={() => avatar.choose()}
        onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") avatar.choose(); }}
        tabindex="0"
        role="button"
        aria-label="Change profile photo"
      >
        {#if avatar.src}
          <img class="avatar-img" src={avatar.src} alt="{card.current.name} portrait" />
        {:else}
          <svg class="avatar-img" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill="#a7d5c7" />
            <circle cx="50" cy="38" r="18" fill="#2d5e4d" />
            <path d="M22 84C22 68 34 58 50 58C66 58 78 68 78 84" fill="#2d5e4d" />
          </svg>
        {/if}
        <div class="avatar-overlay" data-slop-export="hide">
          <Camera size={20} />
        </div>
      </div>

      <div class="profile-info">
        <input
          class="name-input"
          aria-label="Full name"
          bind:value={card.current.name}
        />
        <input
          class="headline-input"
          aria-label="Professional headline"
          bind:value={card.current.headline}
        />
        <div class="location-tag">
          <MapPin size={12} />
          <input
            class="loc-input"
            aria-label="Location"
            bind:value={card.current.location}
          />
        </div>
      </div>
    </section>

    <!-- Bio Statement -->
    <section class="bio-box" aria-label="Short biography">
      <textarea
        class="bio-textarea"
        aria-label="Short bio"
        bind:value={card.current.bio}
      ></textarea>
    </section>

    <!-- Direct Contact Channels -->
    <ul class="contact-links-list" aria-label="Contact channels">
      <li class="contact-row">
        <div class="contact-icon-bubble">
          <Mail size={14} />
        </div>
        <div class="contact-fields">
          <span class="contact-label">Email</span>
          <input
            class="contact-value-input"
            aria-label="Email address"
            bind:value={card.current.email}
          />
        </div>
        <button
          class="contact-action-btn"
          data-slop-export="hide"
          aria-label="Copy email"
          onclick={() => copyToClipboard(card.current.email, "email")}
        >
          {#if copiedField === "email"}
            <Check size={14} color="#0f766e" />
          {:else}
            <Copy size={14} />
          {/if}
        </button>
      </li>

      <li class="contact-row">
        <div class="contact-icon-bubble">
          <Phone size={14} />
        </div>
        <div class="contact-fields">
          <span class="contact-label">Phone</span>
          <input
            class="contact-value-input"
            aria-label="Phone number"
            bind:value={card.current.phone}
          />
        </div>
        <button
          class="contact-action-btn"
          data-slop-export="hide"
          aria-label="Copy phone"
          onclick={() => copyToClipboard(card.current.phone, "phone")}
        >
          {#if copiedField === "phone"}
            <Check size={14} color="#0f766e" />
          {:else}
            <Copy size={14} />
          {/if}
        </button>
      </li>

      <li class="contact-row">
        <div class="contact-icon-bubble">
          <Globe size={14} />
        </div>
        <div class="contact-fields">
          <span class="contact-label">Website</span>
          <input
            class="contact-value-input"
            aria-label="Personal website"
            bind:value={card.current.website}
          />
        </div>
        <a
          class="contact-action-btn"
          data-slop-export="hide"
          aria-label="Open website"
          href={card.current.website.startsWith("http") ? card.current.website : `https://${card.current.website}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={14} />
        </a>
      </li>
    </ul>

    <!-- Bottom Actions Bar -->
    <footer class="bottom-actions-bar">
      <div class="action-circle-group">
        <a
          class="circle-btn"
          href="mailto:{card.current.email}"
          aria-label="Compose email to {card.current.name}"
        >
          <Mail size={16} />
        </a>
        <a
          class="circle-btn"
          href="tel:{card.current.phone}"
          aria-label="Call {card.current.name}"
        >
          <Phone size={16} />
        </a>
        <a
          class="circle-btn"
          href={card.current.website.startsWith("http") ? card.current.website : `https://${card.current.website}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit portfolio site"
        >
          <Globe size={16} />
        </a>
      </div>

      <button
        class="vcard-btn"
        data-slop-export="hide"
        onclick={downloadVCard}
        aria-label="Save contact to Address Book"
      >
        <Download size={14} />
        <span>Save vCard</span>
      </button>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
