<section class="cp-render cp-icon" data-slop-render="icon" aria-hidden="true">
  <article class="icon-page">
    <svg viewBox="0 0 240 240" role="presentation">
      <defs>
        <marker id="icon-away-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="#d95d43" />
        </marker>
        <marker id="icon-towards-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="#2d9472" />
        </marker>
      </defs>
      <!-- Base road stem -->
      <path class="icon-stem-road" d="M120 220 L120 140" />
      <path class="icon-stem-dash" d="M120 214 L120 148" />

      <!-- Left / Away path -->
      <path class="icon-away" marker-end="url(#icon-away-arr)" d="M120 140 C92 110 68 82 46 48" />

      <!-- Right / Towards path -->
      <path class="icon-towards" marker-end="url(#icon-towards-arr)" d="M120 140 C148 110 172 82 194 48" />

      <!-- Central signpost medallion -->
      <circle class="icon-node-outer" cx="120" cy="140" r="28" />
      <circle class="icon-node-inner" cx="120" cy="140" r="22" />

      <!-- Mini signpost glyph in medallion -->
      <path class="icon-sign-post" d="M120 126 L120 154" />
      <path class="icon-sign-bar1" d="M110 132 L130 132" />
      <path class="icon-sign-bar2" d="M112 144 L128 144" />
    </svg>
  </article>
</section>

<style>
  .cp-icon {
    place-items: center;
    overflow: hidden;
    background: transparent;
  }

  .icon-page {
    display: grid;
    place-items: center;
    width: 380px;
    height: 380px;
    background: #fdfbf7;
    border: 3px solid #e7dfd4;
    border-radius: 44px;
    box-shadow: 0 18px 44px rgba(60, 45, 30, 0.1);
  }

  svg {
    width: 260px;
    height: 260px;
    overflow: visible;
  }

  path {
    fill: none;
    stroke-linecap: round;
  }

  .icon-stem-road {
    stroke: #ebd9c2;
    stroke-width: 22;
  }

  .icon-stem-dash {
    stroke: #b39b82;
    stroke-width: 3;
    stroke-dasharray: 6 5;
  }

  .icon-away {
    stroke: #d95d43;
    stroke-width: 8;
  }

  .icon-towards {
    stroke: #2d9472;
    stroke-width: 8;
  }

  .icon-node-outer {
    fill: #fdfbf7;
    stroke: #dfd4c4;
    stroke-width: 3;
  }

  .icon-node-inner {
    fill: #f5effc;
    stroke: #8b6db5;
    stroke-width: 2.5;
  }

  .icon-sign-post {
    stroke: #6c4b99;
    stroke-width: 3;
    stroke-linecap: round;
  }

  .icon-sign-bar1,
  .icon-sign-bar2 {
    stroke: #8b6db5;
    stroke-width: 3;
    stroke-linecap: round;
  }
</style>
