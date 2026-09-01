<script lang="ts">
  import type { Resume } from "./model";

  let { resume, initials }: { resume: Resume; initials: string } = $props();

  const name = $derived(resume.name.trim() || "Untitled resume");
  const role = $derived(resume.role.trim() || "Resume");
</script>

<section class="resume-render resume-cover" data-slop-render="cover" aria-hidden="true">
  <article class="cover-sheet">
    <aside class="cover-rail">
      <div class="cover-monogram">{initials}</div>
    </aside>

    <div class="cover-content">
      <span class="cover-eyebrow">Resume</span>
      <h1>{name}</h1>
      <p>{role}</p>

      <div class="cover-rule"></div>
      <div class="cover-structure" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </article>
</section>
