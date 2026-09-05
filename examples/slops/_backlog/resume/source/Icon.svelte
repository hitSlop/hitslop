<script lang="ts">
  let { initials }: { initials: string } = $props();
</script>

<section class="resume-render resume-icon" data-slop-render="icon" aria-hidden="true">
  <article class="icon-sheet">
    <div class="icon-rail"></div>
    <div class="icon-monogram">{initials}</div>
  </article>
</section>
