<section class="grade-render grade-icon" data-slop-render="icon" aria-hidden="true">
  <div class="icon-instrument">
    <div class="icon-header">
      <span class="icon-title-bar"></span>
      <div class="icon-gpa-dial">
        <span class="icon-gpa-text"></span>
      </div>
    </div>
    <div class="icon-courses-list">
      <div class="icon-course-row">
        <span class="icon-grade-tag grade-a"></span>
        <span class="icon-bar"></span>
        <span class="icon-pct-bar"></span>
      </div>
      <div class="icon-course-row">
        <span class="icon-grade-tag grade-a"></span>
        <span class="icon-bar mid"></span>
        <span class="icon-pct-bar"></span>
      </div>
      <div class="icon-course-row">
        <span class="icon-grade-tag grade-b"></span>
        <span class="icon-bar"></span>
        <span class="icon-pct-bar"></span>
      </div>
      <div class="icon-course-row">
        <span class="icon-grade-tag grade-a"></span>
        <span class="icon-bar short"></span>
        <span class="icon-pct-bar"></span>
      </div>
    </div>
    <div class="icon-solver-panel">
      <span class="icon-solver-head"></span>
      <span class="icon-solver-track"></span>
    </div>
  </div>
</section>

<style>
  .grade-render {
    display: none !important;
    width: 512px;
    height: 512px;
    place-items: center;
    background: transparent;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .grade-render {
    display: grid !important;
  }

  .icon-instrument {
    width: 420px;
    height: 420px;
    background: #fdfbf7;
    border-radius: 32px;
    border: 8px solid #ded7c7;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    padding: 26px;
    gap: 16px;
    box-sizing: border-box;
  }

  .icon-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #232220;
    padding-bottom: 12px;
  }

  .icon-title-bar {
    width: 140px;
    height: 18px;
    background: #232220;
    border-radius: 4px;
  }

  .icon-gpa-dial {
    width: 60px;
    height: 32px;
    background: #2b593f;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-gpa-text {
    width: 36px;
    height: 12px;
    background: #ffffff;
    border-radius: 3px;
  }

  .icon-courses-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .icon-course-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f4ede1;
    border-radius: 8px;
    padding: 8px 10px;
  }

  .icon-grade-tag {
    width: 24px;
    height: 20px;
    border-radius: 5px;
  }

  .icon-grade-tag.grade-a { background: #2b593f; }
  .icon-grade-tag.grade-b { background: #2563eb; }

  .icon-bar {
    flex: 1;
    height: 12px;
    background: #3a3834;
    border-radius: 3px;
  }

  .icon-bar.mid { flex: 0.75; }
  .icon-bar.short { flex: 0.6; }

  .icon-pct-bar {
    width: 44px;
    height: 12px;
    background: #9f9a8f;
    border-radius: 3px;
  }

  .icon-solver-panel {
    background: #ece3d3;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid #ddd2be;
  }

  .icon-solver-head {
    width: 120px;
    height: 10px;
    background: #4a463f;
    border-radius: 2px;
  }

  .icon-solver-track {
    height: 14px;
    background: #ffffff;
    border-radius: 7px;
    border-left: 180px solid #2b593f;
  }
</style>
