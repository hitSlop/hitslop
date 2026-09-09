<section class="tracker-render tracker-icon" data-slop-render="icon" aria-hidden="true">
  <div class="icon-pad">
    <div class="icon-clip"></div>
    <div class="icon-head">
      <span class="icon-title-line"></span>
      <div class="icon-badge-row">
        <span class="icon-pill urgent"></span>
        <span class="icon-pill normal"></span>
      </div>
    </div>
    <div class="icon-items">
      <div class="icon-row done">
        <span class="icon-box checked"></span>
        <span class="icon-tag sage"></span>
        <span class="icon-text-bar short"></span>
      </div>
      <div class="icon-row">
        <span class="icon-box"></span>
        <span class="icon-tag indigo"></span>
        <span class="icon-text-bar"></span>
      </div>
      <div class="icon-row">
        <span class="icon-box"></span>
        <span class="icon-tag amber"></span>
        <span class="icon-text-bar mid"></span>
      </div>
      <div class="icon-row">
        <span class="icon-box"></span>
        <span class="icon-tag terracotta"></span>
        <span class="icon-text-bar"></span>
      </div>
      <div class="icon-row">
        <span class="icon-box"></span>
        <span class="icon-tag teal"></span>
        <span class="icon-text-bar short"></span>
      </div>
    </div>
  </div>
</section>

<style>
  .tracker-render {
    display: none !important;
    width: 512px;
    height: 512px;
    place-items: center;
    background: transparent;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .tracker-render {
    display: grid !important;
  }

  .icon-pad {
    width: 380px;
    height: 440px;
    background: #fcfaf5;
    border-radius: 24px;
    border: 8px solid #e5ddcf;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    padding: 24px 22px;
    gap: 16px;
    position: relative;
    box-sizing: border-box;
  }

  .icon-clip {
    position: absolute;
    top: -16px;
    left: 50%;
    transform: translateX(-50%);
    width: 80px;
    height: 24px;
    background: #3a3834;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .icon-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #232220;
    padding-top: 6px;
    padding-bottom: 12px;
  }

  .icon-title-line {
    width: 130px;
    height: 18px;
    background: #232220;
    border-radius: 4px;
  }

  .icon-badge-row {
    display: flex;
    gap: 6px;
  }

  .icon-pill {
    width: 44px;
    height: 16px;
    border-radius: 8px;
  }

  .icon-pill.urgent { background: #b91c1c; }
  .icon-pill.normal { background: #d97706; }

  .icon-items {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .icon-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #ffffff;
    border: 1px solid #ede5d7;
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  }

  .icon-row.done {
    opacity: 0.55;
    background: #f7f3eb;
  }

  .icon-box {
    width: 16px;
    height: 16px;
    border: 2px solid #9f9a8f;
    border-radius: 4px;
  }

  .icon-box.checked {
    background: #2b593f;
    border-color: #2b593f;
  }

  .icon-tag {
    width: 44px;
    height: 14px;
    border-radius: 4px;
  }

  .icon-tag.sage { background: #3b7a57; }
  .icon-tag.indigo { background: #4f46e5; }
  .icon-tag.amber { background: #d97706; }
  .icon-tag.terracotta { background: #c2410c; }
  .icon-tag.teal { background: #0d9488; }

  .icon-text-bar {
    flex: 1;
    height: 12px;
    background: #4a463f;
    border-radius: 3px;
  }

  .icon-text-bar.mid { flex: 0.75; }
  .icon-text-bar.short { flex: 0.5; }
</style>
