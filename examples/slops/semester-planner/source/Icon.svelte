<section class="semester-render semester-icon" data-slop-render="icon" aria-hidden="true">
  <div class="icon-canvas">
    <div class="icon-header">
      <span class="icon-term-bar"></span>
      <span class="icon-badge"></span>
    </div>
    <div class="icon-months-grid">
      <div class="icon-month-card">
        <span class="icon-m-title"></span>
        <div class="icon-mini-grid">
          <span class="dot"></span><span class="dot"></span><span class="dot dot-exam"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot dot-proj"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot"></span><span class="dot dot-exam"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>
      <div class="icon-month-card">
        <span class="icon-m-title"></span>
        <div class="icon-mini-grid">
          <span class="dot"></span><span class="dot dot-paper"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot"></span><span class="dot dot-exam"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot dot-proj"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>
      <div class="icon-month-card">
        <span class="icon-m-title"></span>
        <div class="icon-mini-grid">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot dot-exam"></span>
          <span class="dot dot-break"></span><span class="dot dot-break"></span><span class="dot dot-break"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot dot-paper"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>
      <div class="icon-month-card">
        <span class="icon-m-title"></span>
        <div class="icon-mini-grid">
          <span class="dot"></span><span class="dot dot-proj"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot dot-exam"></span><span class="dot dot-exam"></span><span class="dot dot-exam"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot dot-break"></span><span class="dot dot-break"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>
    </div>
    <div class="icon-agenda-bar">
      <span class="icon-agenda-item"></span>
      <span class="icon-agenda-item short"></span>
    </div>
  </div>
</section>

<style>
  .semester-render {
    display: none !important;
    width: 512px;
    height: 512px;
    place-items: center;
    background: transparent;
  }

  :global(html[data-slop-renderer="true"][data-slop-capture="icon"]) .semester-render {
    display: grid !important;
  }

  .icon-canvas {
    width: 450px;
    height: 390px;
    background: #fbf9f4;
    border-radius: 28px;
    border: 8px solid #e3dbcc;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    padding: 24px;
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

  .icon-term-bar {
    width: 150px;
    height: 18px;
    background: #232220;
    border-radius: 4px;
  }

  .icon-badge {
    width: 70px;
    height: 18px;
    background: #2563eb;
    border-radius: 9px;
  }

  .icon-months-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .icon-month-card {
    background: #f1ebd8;
    border-radius: 8px;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .icon-m-title {
    width: 32px;
    height: 8px;
    background: #4a463f;
    border-radius: 2px;
  }

  .icon-mini-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ffffff;
  }

  .dot.dot-exam { background: #dc2626; }
  .dot.dot-proj { background: #4f46e5; }
  .dot.dot-paper { background: #d97706; }
  .dot.dot-break { background: #16a34a; }

  .icon-agenda-bar {
    display: flex;
    gap: 10px;
    border-top: 1.5px dashed #ded5c6;
    padding-top: 12px;
  }

  .icon-agenda-item {
    flex: 1;
    height: 14px;
    background: #eadecc;
    border-radius: 4px;
  }

  .icon-agenda-item.short { flex: 0.6; }
</style>
