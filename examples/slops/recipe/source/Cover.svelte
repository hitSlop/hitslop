<script lang="ts">
  let { title, description, heroSrc }: { title: string; description: string; heroSrc: string } = $props();

  const name = $derived(title.trim() || "Untitled recipe");
  const summary = $derived(description.trim() || "A recipe card with live cooking mode.");
</script>

<section class="recipe-render recipe-cover" data-slop-render="cover" aria-hidden="true">
  <article class="cover-card">
    <figure class="cover-photo"><img src={heroSrc} alt="" /></figure>
    <div class="cover-copy">
      <span class="cover-eyebrow">Recipe</span>
      <h1>{name}</h1>
      <p>{summary}</p>
    </div>
  </article>
</section>
