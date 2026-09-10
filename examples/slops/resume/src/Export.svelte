<script lang="ts">
  import Globe from "@lucide/svelte/icons/globe";
  import Mail from "@lucide/svelte/icons/mail";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import { badgeInitials, type Resume } from "../schema";
  import * as s from "./styles.css";

  let { data }: { data: Resume } = $props();
  const initials = $derived(badgeInitials(data.name, data.initials));
  const skills = $derived(data.skills.filter(skill => skill.label.trim()));
  const education = $derived(data.education.filter(item => item.school.trim() || item.program.trim() || item.year.trim()));
  const experience = $derived(data.experience.filter(item => item.role.trim() || item.company.trim() || item.period.trim() || item.summary.trim()));
</script>

<article class={s.resume} aria-label="Exported resume for {data.name}">
  <aside class={s.sidebar}>
    <span class={s.monogram}>{initials}</span>

    <section class={s.contactBlock} aria-label="Contact">
      <h2 class={s.heading}>Contact</h2>
      {#if data.email.trim()}<div><Mail size={14} strokeWidth={1.7} /><span class={s.field}>{data.email}</span></div>{/if}
      {#if data.location.trim()}<div><MapPin size={14} strokeWidth={1.7} /><span class={s.field}>{data.location}</span></div>{/if}
      {#if data.website.trim()}<div><Globe size={14} strokeWidth={1.7} /><span class={s.field}>{data.website}</span></div>{/if}
    </section>

    {#if skills.length}
      <section class={s.skillsBlock} aria-label="Skills">
        <h2 class={s.heading}>Skills</h2>
        <div class={s.skills}>
          {#each skills as skill (skill.id)}
            <span class={s.skill}><span>{skill.label}</span></span>
          {/each}
        </div>
      </section>
    {/if}

    {#if education.length}
      <section class={s.educationBlock} aria-label="Education">
        <h2 class={s.heading}>Education</h2>
        <div class={s.educationList}>
          {#each education as item (item.id)}
            <div class={s.educationItem}>
              <strong class={s.educationSchool}>{item.school}</strong>
              {#if item.program.trim()}<span class={s.field}>{item.program}</span>{/if}
              {#if item.year.trim()}<div class={s.educationYear}><span class={s.field}>{item.year}</span></div>{/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </aside>

  <section class={s.mainColumn}>
    <header class={s.profile}>
      <span class={s.eyebrow}>Resume</span>
      <h1 class={s.name}>{data.name}</h1>
      {#if data.role.trim()}<p class={s.role}>{data.role}</p>{/if}
      {#if data.summary.trim()}<p class={s.summary}>{data.summary}</p>{/if}
    </header>

    {#if experience.length}
      <section class={s.experience} aria-label="Experience">
        <div class={s.experienceHeading}><h2>Experience</h2></div>
        <div class={s.experienceList}>
          {#each experience as item (item.id)}
            <article class={s.experienceItem}>
              <div class={s.experienceMeta}><span class={s.period}>{item.period}</span></div>
              <div>
                <div class={s.roleLine}><span class={s.jobRole}>{item.role}</span>{#if item.role.trim() && item.company.trim()}<span>·</span>{/if}<span class={s.company}>{item.company}</span></div>
                {#if item.summary.trim()}<p class={s.experienceCopy}>{item.summary}</p>{/if}
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/if}
  </section>
</article>
