<section class="pixel-render" data-slop-render="icon" aria-hidden="true">
  <article class="pixel-icon">
    <div class="icon-bezel">
      <div class="icon-screen">
        {#each Array(64) as _, index}
          <i class:on={
            [8,9,14,15,16,17,22,23,25,26,29,30,33,34,37,38,41,42,43,44,45,46,49,54].includes(index)
          }></i>
        {/each}
      </div>
    </div>
    <div class="icon-controls">
      <span class="icon-dpad"></span>
      <span class="icon-btns"><i></i><i></i></span>
    </div>
  </article>
</section>
