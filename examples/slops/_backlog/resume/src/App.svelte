<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Button } from "bits-ui";
  import Globe from "@lucide/svelte/icons/globe";
  import Mail from "@lucide/svelte/icons/mail";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import resumeSchema, { badgeInitials } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const resume = jsonStore({ schema: resumeSchema, initial: {
    name: "Avery Quinn",
    initials: "AQ",
    role: "Product designer & systems thinker",
    email: "avery@hello.dev",
    location: "Brooklyn, NY",
    website: "hello.dev/avery",
    summary: "I turn ambiguous ideas into useful, calm digital products. I work from the first sketch through a durable system that gives teams room to move.",
    skills: [
      { id: "product-design", label: "Product design" },
      { id: "design-systems", label: "Design systems" },
      { id: "prototyping", label: "Prototyping" },
      { id: "user-research", label: "User research" },
      { id: "figma", label: "Figma" },
    ],
    experience: [
      { id: "mosaic-labs", role: "Senior product designer", company: "Mosaic Labs", period: "2022 — now", summary: "Led product direction for a collaborative workspace used by growing teams. Shaped the system, shipped the new editor, and partnered closely with engineering from discovery through launch." },
      { id: "scale-studio", role: "Product designer", company: "Scale Studio", period: "2020 — 2022", summary: "Designed end-to-end tools for independent businesses, from first-run onboarding to daily operations. Built a reusable component library that made new work faster and more consistent." },
      { id: "north-south", role: "Visual designer", company: "North / South", period: "2018 — 2020", summary: "Made identities, websites, and small digital products for people doing interesting work. Learned to make the essential thing feel inevitable." },
    ],
    education: [{ id: "parsons", school: "Parsons School of Design", program: "BFA, Communication Design", year: "2018" }],
  } });
  $effect(() => { if (resume.isReady) ready(); });
  onDestroy(() => resume.destroy());

  const initials = $derived(badgeInitials(resume.current.name, resume.current.initials));
</script>

<main class={s.canvas} data-slop-selection="none" aria-busy={resume.isLoading}>
  <article class={s.resume} aria-label="Resume for {resume.current.name}">
    <aside class={s.sidebar}>
      <input class={s.monogram} aria-label="Initials" maxlength="3" value={initials} oninput={event => resume.current.initials = event.currentTarget.value.toUpperCase()} />

      <section class={s.contactBlock} aria-labelledby="contact-heading">
        <h2 id="contact-heading" class={s.heading}>Contact</h2>
        <label><Mail size={14} strokeWidth={1.7} /><span class={s.srOnly}>Email</span><input class={s.field} aria-label="Email" bind:value={resume.current.email} /></label>
        <label><MapPin size={14} strokeWidth={1.7} /><span class={s.srOnly}>Location</span><input class={s.field} aria-label="Location" bind:value={resume.current.location} /></label>
        <label><Globe size={14} strokeWidth={1.7} /><span class={s.srOnly}>Website</span><input class={s.field} aria-label="Website" bind:value={resume.current.website} /></label>
      </section>

      <section class={s.skillsBlock} aria-labelledby="skills-heading">
        <div class={s.sectionHeading}><h2 id="skills-heading" class={s.heading}>Skills</h2><Button.Root class={s.addCompact} data-slop-export="hide" aria-label="Add skill" onclick={() => resume.current.skills.push({ id: crypto.randomUUID(), label: "New skill" })}><Plus size={11} strokeWidth={1.8} /></Button.Root></div>
        <div class={s.skills}>
          {#each resume.current.skills as skill, index (skill.id)}
            <span class={s.skill}><input aria-label="Skill {index + 1}" bind:value={skill.label} /><button class={s.skillRemove} data-slop-export="hide" aria-label="Remove {skill.label || "skill"}" onclick={() => { resume.current.skills = resume.current.skills.filter(row => row.id !== skill.id); }}>×</button></span>
          {/each}
        </div>
      </section>

      <section class={s.educationBlock} aria-labelledby="education-heading">
        <div class={s.sectionHeading}><h2 id="education-heading" class={s.heading}>Education</h2><Button.Root class={s.addCompact} data-slop-export="hide" aria-label="Add education" onclick={() => resume.current.education.push({ id: crypto.randomUUID(), school: "School or program", program: "Degree or course", year: "Year" })}><Plus size={11} strokeWidth={1.8} /></Button.Root></div>
        <div class={s.educationList}>
          {#each resume.current.education as item, index (item.id)}
            <div class={s.educationItem}>
              <input class={s.educationSchool} aria-label="School {index + 1}" bind:value={item.school} />
              <input class={s.field} aria-label="Degree or program {index + 1}" bind:value={item.program} />
              <div class={s.educationYear}><input class={s.field} aria-label="Graduation year {index + 1}" bind:value={item.year} /><button class={s.removeCompact} data-slop-export="hide" aria-label="Remove {item.school || "education"}" onclick={() => { resume.current.education = resume.current.education.filter(row => row.id !== item.id); }}><Trash2 size={11} strokeWidth={1.65} /></button></div>
            </div>
          {/each}
        </div>
      </section>
    </aside>

    <section class={s.mainColumn}>
      <header class={s.profile}>
        <span class={s.eyebrow}>Resume</span>
        <input class={s.name} aria-label="Full name" bind:value={resume.current.name} />
        <input class={s.role} aria-label="Professional role" bind:value={resume.current.role} />
        <textarea class={s.summary} aria-label="Professional summary" bind:value={resume.current.summary}></textarea>
      </header>

      <section class={s.experience} aria-labelledby="experience-heading">
        <div class={s.experienceHeading}><h2 id="experience-heading">Experience</h2><Button.Root class={s.addExperience} data-slop-export="hide" onclick={() => resume.current.experience.push({ id: crypto.randomUUID(), role: "New role", company: "Company", period: "Year — now", summary: "A short description of the work and the impact you made." })}><Plus size={12} strokeWidth={1.8} /> Add role</Button.Root></div>
        <div class={s.experienceList}>
          {#each resume.current.experience as item, index (item.id)}
            <article class={s.experienceItem}>
              <div class={s.experienceMeta}><input class={s.period} aria-label="Employment period {index + 1}" bind:value={item.period} /><button class={s.removeExperience} data-slop-export="hide" aria-label="Remove {item.role || "experience"}" onclick={() => { resume.current.experience = resume.current.experience.filter(row => row.id !== item.id); }}><Trash2 size={12} strokeWidth={1.65} /></button></div>
              <div>
                <div class={s.roleLine}><input class={s.jobRole} aria-label="Job title {index + 1}" bind:value={item.role} /><span>·</span><input class={s.company} aria-label="Company {index + 1}" bind:value={item.company} /></div>
                <textarea class={s.experienceCopy} aria-label="Summary for {item.role || "experience"}" bind:value={item.summary}></textarea>
              </div>
            </article>
          {/each}
        </div>
      </section>
    </section>
  </article>
</main>

<IconTarget><Icon initials={initials} /></IconTarget>
<ExportTarget><Export data={resume.current} /></ExportTarget>
