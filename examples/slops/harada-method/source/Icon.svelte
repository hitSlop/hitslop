<section class="harada-render harada-icon" data-slop-render="icon" aria-hidden="true">
  <article class="icon-page">
    <div class="icon-grid">
      {#each { length: 9 } as _, index (index)}
        <span class="icon-cell" data-role={index === 4 ? "goal" : "theme"}></span>
      {/each}
    </div>
  </article>
</section>
