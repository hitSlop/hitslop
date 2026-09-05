<section class="schedule-render schedule-icon" data-slop-render="icon" aria-hidden="true">
  <div class="icon-card">
    <div class="icon-header">
      <div class="icon-title-wrap">
        <span class="icon-chip-main"></span>
        <span class="icon-sub-chip"></span>
      </div>
      <span class="icon-bell-badge"></span>
    </div>
    <div class="icon-grid">
      <div class="icon-col">
        <span class="icon-col-head"></span>
        <span class="icon-slot sage"></span>
        <span class="icon-slot slate"></span>
        <span class="icon-slot indigo"></span>
        <span class="icon-slot break"></span>
        <span class="icon-slot amber"></span>
      </div>
      <div class="icon-col">
        <span class="icon-col-head"></span>
        <span class="icon-slot slate"></span>
        <span class="icon-slot indigo"></span>
        <span class="icon-slot terracotta"></span>
        <span class="icon-slot break"></span>
        <span class="icon-slot teal"></span>
      </div>
      <div class="icon-col">
        <span class="icon-col-head active"></span>
        <span class="icon-slot sage"></span>
        <span class="icon-slot active-slot rose"></span>
        <span class="icon-slot amber"></span>
        <span class="icon-slot break"></span>
        <span class="icon-slot indigo"></span>
      </div>
      <div class="icon-col">
        <span class="icon-col-head"></span>
        <span class="icon-slot terracotta"></span>
        <span class="icon-slot sage"></span>
        <span class="icon-slot slate"></span>
        <span class="icon-slot break"></span>
        <span class="icon-slot amber"></span>
      </div>
      <div class="icon-col">
        <span class="icon-col-head"></span>
        <span class="icon-slot teal"></span>
        <span class="icon-slot rose"></span>
        <span class="icon-slot sage"></span>
        <span class="icon-slot break"></span>
        <span class="icon-slot slate"></span>
      </div>
    </div>
    <div class="icon-footer">
      <span class="icon-activity-bar"></span>
      <span class="icon-activity-bar short"></span>
    </div>
  </div>
</section>

<style>
  .schedule-render {
    display: none !important;
    width: 512px;
    height: 512px;
    place-items: center;
    background: transparent;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .schedule-render {
    display: grid !important;
  }

  .icon-card {
    width: 440px;
    height: 440px;
    background: #fdfbf7;
    border-radius: 32px;
    border: 8px solid #e7dfd3;
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

  .icon-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .icon-chip-main {
    width: 140px;
    height: 18px;
    background: #232220;
    border-radius: 4px;
  }

  .icon-sub-chip {
    width: 80px;
    height: 10px;
    background: #9f9a8f;
    border-radius: 3px;
  }

  .icon-bell-badge {
    width: 90px;
    height: 22px;
    background: #2b593f;
    border-radius: 11px;
  }

  .icon-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .icon-col {
    background: #f4ede2;
    border-radius: 8px;
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .icon-col-head {
    height: 10px;
    background: #4a463f;
    border-radius: 3px;
  }

  .icon-col-head.active {
    background: #2b593f;
  }

  .icon-slot {
    height: 38px;
    border-radius: 5px;
    background: #ffffff;
    border-left: 4px solid #9f9a8f;
  }

  .icon-slot.sage { border-left-color: #3b7a57; }
  .icon-slot.slate { border-left-color: #4a5d6e; }
  .icon-slot.indigo { border-left-color: #4f46e5; }
  .icon-slot.amber { border-left-color: #d97706; }
  .icon-slot.terracotta { border-left-color: #c2410c; }
  .icon-slot.teal { border-left-color: #0d9488; }
  .icon-slot.rose { border-left-color: #e11d48; }
  .icon-slot.break { height: 16px; background: #e5ddd0; border-left: none; }

  .icon-slot.active-slot {
    box-shadow: 0 0 0 2px #2b593f;
  }

  .icon-footer {
    display: flex;
    gap: 10px;
    border-top: 1.5px dashed #ded5c6;
    padding-top: 10px;
  }

  .icon-activity-bar {
    flex: 1;
    height: 16px;
    background: #ede3d3;
    border-radius: 4px;
  }

  .icon-activity-bar.short {
    flex: 0.6;
  }
</style>
