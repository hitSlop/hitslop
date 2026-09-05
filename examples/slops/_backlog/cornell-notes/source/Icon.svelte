<section class="cornell-render cornell-icon" data-slop-render="icon" aria-hidden="true">
  <div class="icon-sheet">
    <div class="icon-head">
      <div class="icon-topic-line"></div>
      <div class="icon-course-pill"></div>
    </div>
    <div class="icon-body">
      <div class="icon-cue-col">
        <span class="icon-cue-bar"></span>
        <span class="icon-cue-bar short"></span>
        <span class="icon-cue-bar"></span>
        <span class="icon-cue-bar short"></span>
      </div>
      <div class="icon-red-rule"></div>
      <div class="icon-notes-col">
        <span class="icon-note-bar"></span>
        <span class="icon-note-bar"></span>
        <span class="icon-note-bar mid"></span>
        <span class="icon-note-bar"></span>
        <span class="icon-note-bar short"></span>
        <span class="icon-note-bar"></span>
        <span class="icon-note-bar mid"></span>
      </div>
    </div>
    <div class="icon-summary-box">
      <span class="icon-summary-head"></span>
      <span class="icon-summary-line"></span>
      <span class="icon-summary-line mid"></span>
    </div>
  </div>
</section>

<style>
  .cornell-render {
    display: none !important;
    width: 512px;
    height: 512px;
    place-items: center;
    background: transparent;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .cornell-render {
    display: grid !important;
  }

  .icon-sheet {
    width: 380px;
    height: 450px;
    background: #ffffff;
    border-radius: 20px;
    border: 3px solid #cbd5e1;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
    display: flex;
    flex-direction: column;
    padding: 24px;
    gap: 14px;
    box-sizing: border-box;
  }

  .icon-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 12px;
  }

  .icon-topic-line {
    width: 160px;
    height: 18px;
    background: #0f172a;
    border-radius: 4px;
  }

  .icon-course-pill {
    width: 68px;
    height: 18px;
    background: #1e3a8a;
    border-radius: 6px;
  }

  .icon-body {
    flex: 1;
    display: flex;
    gap: 14px;
    position: relative;
  }

  .icon-cue-col {
    width: 90px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-top: 6px;
  }

  .icon-cue-bar {
    height: 10px;
    background: #2563eb;
    border-radius: 3px;
  }

  .icon-cue-bar.short { width: 65%; }

  .icon-red-rule {
    width: 3px;
    background: #b31b1b;
    border-radius: 1.5px;
  }

  .icon-notes-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 6px;
  }

  .icon-note-bar {
    height: 9px;
    background: #475569;
    border-radius: 2px;
  }

  .icon-note-bar.mid { width: 80%; }
  .icon-note-bar.short { width: 55%; }

  .icon-summary-box {
    height: 80px;
    border-top: 2px solid #b31b1b;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-top: 2px solid #b31b1b;
    border-radius: 6px;
    padding: 8px 12px;
  }

  .icon-summary-head {
    width: 70px;
    height: 8px;
    background: #b31b1b;
    border-radius: 2px;
  }

  .icon-summary-line {
    height: 8px;
    background: #94a3b8;
    border-radius: 2px;
  }

  .icon-summary-line.mid { width: 70%; }
</style>
