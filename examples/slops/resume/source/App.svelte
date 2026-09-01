<script lang="ts">
  import { jsonStore } from "@hitslop/svelte";
  import Globe2 from "@lucide/svelte/icons/globe-2";
  import Mail from "@lucide/svelte/icons/mail";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  type ItemID = string | number;
  type Skill = { id: ItemID; label: string } | string;
  type Experience = { id: ItemID; role: string; company: string; period: string; summary: string };
  type Education = { id: ItemID; school: string; program: string; year: string };
  type Resume = {
    name: string;
    initials?: string;
    role: string;
    email: string;
    location: string;
    website: string;
    summary: string;
    skills: Skill[];
    experience: Experience[];
    education: Education[];
  };

  const resume = jsonStore<Resume>({
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
  });

  const fallbackInitials = $derived(resume.current.name.split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "AQ");
  const badgeInitials = $derived(resume.current.initials ?? fallbackInitials);

  function addSkill(): void { resume.current.skills.push({ id: crypto.randomUUID(), label: "New skill" }); }
  function skillLabel(skill: Skill): string { return typeof skill === "string" ? skill : skill.label; }
  function updateSkill(index: number, label: string): void {
    const skill = resume.current.skills[index];
    if (typeof skill === "string") resume.current.skills[index] = { id: crypto.randomUUID(), label };
    else skill.label = label;
  }
  function removeSkill(index: number): void { resume.current.skills.splice(index, 1); }
  function addExperience(): void {
    resume.current.experience.push({ id: crypto.randomUUID(), role: "New role", company: "Company", period: "Year — now", summary: "A short description of the work and the impact you made." });
  }
  function removeExperience(index: number): void { resume.current.experience.splice(index, 1); }
  function addEducation(): void { resume.current.education.push({ id: crypto.randomUUID(), school: "School or program", program: "Degree or course", year: "Year" }); }
  function removeEducation(index: number): void { resume.current.education.splice(index, 1); }
</script>

<main class="resume-canvas" data-slop-selection="none">
  <article class="resume" aria-label="Resume for {resume.current.name}">
    <aside class="sidebar">
      <input class="monogram" aria-label="Initials" maxlength="3" value={badgeInitials} oninput={(event) => resume.current.initials = event.currentTarget.value.toUpperCase()} />

      <section class="contact-block" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Contact</h2>
        <label><Mail strokeWidth={1.7} absoluteStrokeWidth /><span class="sr-only">Email</span><input aria-label="Email" bind:value={resume.current.email} /></label>
        <label><MapPin strokeWidth={1.7} absoluteStrokeWidth /><span class="sr-only">Location</span><input aria-label="Location" bind:value={resume.current.location} /></label>
        <label><Globe2 strokeWidth={1.7} absoluteStrokeWidth /><span class="sr-only">Website</span><input aria-label="Website" bind:value={resume.current.website} /></label>
      </section>

      <section class="skills-block" aria-labelledby="skills-heading">
        <div class="section-heading"><h2 id="skills-heading">Skills</h2><button data-slop-export="hide" class="add-compact" aria-label="Add skill" onclick={addSkill}><Plus strokeWidth={1.8} absoluteStrokeWidth /></button></div>
        <div class="skills">
          {#each resume.current.skills as skill, index}
            <span class="skill"><input aria-label="Skill {index + 1}" value={skillLabel(skill)} oninput={(event) => updateSkill(index, event.currentTarget.value)} /><button data-slop-export="hide" aria-label="Remove {skillLabel(skill) || "skill"}" onclick={() => removeSkill(index)}>×</button></span>
          {/each}
        </div>
      </section>

      <section class="education-block" aria-labelledby="education-heading">
        <div class="section-heading"><h2 id="education-heading">Education</h2><button data-slop-export="hide" class="add-compact" aria-label="Add education" onclick={addEducation}><Plus strokeWidth={1.8} absoluteStrokeWidth /></button></div>
        <div class="education-list">
          {#each resume.current.education as item, index}
            <div class="education-item">
              <input class="education-school" aria-label="School" bind:value={item.school} />
              <input aria-label="Degree or program" bind:value={item.program} />
              <div class="education-year"><input aria-label="Graduation year" bind:value={item.year} /><button data-slop-export="hide" class="remove-compact" aria-label="Remove education" onclick={() => removeEducation(index)}><Trash2 strokeWidth={1.65} absoluteStrokeWidth /></button></div>
            </div>
          {/each}
        </div>
      </section>
    </aside>

    <section class="main-column">
      <header class="profile">
        <span class="eyebrow">Resume</span>
        <input class="name" aria-label="Full name" bind:value={resume.current.name} />
        <input class="role" aria-label="Professional role" bind:value={resume.current.role} />
        <textarea aria-label="Professional summary" class="summary" bind:value={resume.current.summary}></textarea>
      </header>

      <section class="experience" aria-labelledby="experience-heading">
        <div class="experience-heading"><h2 id="experience-heading">Experience</h2><button class="add-experience" data-slop-export="hide" onclick={addExperience}><Plus strokeWidth={1.8} absoluteStrokeWidth /> Add role</button></div>
        <div class="experience-list">
          {#each resume.current.experience as item, index}
            <article class="experience-item">
              <div class="experience-meta"><input class="period" aria-label="Employment period" bind:value={item.period} /><button class="remove-experience" data-slop-export="hide" aria-label="Remove {item.role || "experience"}" onclick={() => removeExperience(index)}><Trash2 strokeWidth={1.65} absoluteStrokeWidth /></button></div>
              <div class="experience-copy">
                <div class="role-line"><input class="job-role" aria-label="Job title" bind:value={item.role} /><span>·</span><input class="company" aria-label="Company" bind:value={item.company} /></div>
                <textarea aria-label="Summary for {item.role || "experience"}" bind:value={item.summary}></textarea>
              </div>
            </article>
          {/each}
        </div>
      </section>

    </section>
  </article>
</main>
