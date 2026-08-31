<script lang="ts">
  import { Dialog, DropdownMenu } from "bits-ui";
  import { sql, sqliteQuery } from "@hitslop/svelte";
  import { slop } from "@hitslop/runtime";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import MoreHorizontal from "@lucide/svelte/icons/ellipsis";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";

  type Column = { id: number; title: string; position: number; color: string };
  type Card = { id: number; column_id: number; title: string; detail: string; priority: string; position: number; created_at: string };

  void slop.db.transaction([
    { sql: "CREATE TABLE IF NOT EXISTS columns (id INTEGER PRIMARY KEY, title TEXT NOT NULL, position INTEGER NOT NULL, color TEXT NOT NULL)" },
    { sql: "CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY, column_id INTEGER NOT NULL REFERENCES columns(id), title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'normal', position INTEGER NOT NULL, created_at TEXT NOT NULL)" },
    { sql: "INSERT OR IGNORE INTO columns (id, title, position, color) VALUES (1, 'Signal', 0, 'butter')" },
    { sql: "INSERT OR IGNORE INTO columns (id, title, position, color) VALUES (2, 'In motion', 1, 'blue')" },
    { sql: "INSERT OR IGNORE INTO columns (id, title, position, color) VALUES (3, 'Landed', 2, 'mint')" },
  ]);
  const columns = sqliteQuery<Column>(sql`SELECT id, title, position, color FROM columns ORDER BY position, id`);
  const cards = sqliteQuery<Card>(sql`SELECT id, column_id, title, detail, priority, position, created_at FROM cards ORDER BY position, id`);
  let adding = $state(false);
  let editingID = $state<number | null>(null);
  let draftTitle = $state("");
  let draftDetail = $state("");
  let draftPriority = $state("normal");
  let draftColumnID = $state(1);
  let draggingID = $state<number | null>(null);

  function cardsFor(columnID: number): Card[] { return cards.current.filter((card) => card.column_id === columnID); }

  async function createCard(): Promise<void> {
    const title = draftTitle.trim();
    if (!title) return;
    const detail = draftDetail.trim();
    if(editingID===null){const createdAt = new Date().toISOString();const position = Math.max(-1, ...cardsFor(draftColumnID).map((card) => card.position)) + 1;await cards.execute(sql`INSERT INTO cards (column_id, title, detail, priority, position, created_at) VALUES (${draftColumnID}, ${title}, ${detail}, ${draftPriority}, ${position}, ${createdAt})`)}
    else await cards.execute(sql`UPDATE cards SET title = ${title}, detail = ${detail}, priority = ${draftPriority}, column_id = ${draftColumnID} WHERE id = ${editingID}`);
    draftTitle = ""; draftDetail = ""; draftPriority = "normal"; editingID=null; adding = false;
  }

  async function moveCard(cardID: number, columnID: number): Promise<void> {
    const position = Math.max(-1, ...cardsFor(columnID).map((card) => card.position)) + 1;
    await cards.execute(sql`UPDATE cards SET column_id = ${columnID}, position = ${position} WHERE id = ${cardID}`);
    draggingID = null;
  }

  async function removeCard(cardID: number): Promise<void> { await cards.execute(sql`DELETE FROM cards WHERE id = ${cardID}`); }

  function beginAdd(columnID: number): void { editingID=null;draftTitle="";draftDetail="";draftPriority="normal";draftColumnID = columnID; adding = true; }
  function beginEdit(card:Card):void{editingID=card.id;draftTitle=card.title;draftDetail=card.detail;draftPriority=card.priority;draftColumnID=card.column_id;adding=true}
</script>

<main class="board-shell" data-slop-selection="none">
  <header class="board-header">
    <div><p>Longtail works / 04</p><h1>Movement board</h1></div>
    <div class="board-meter"><strong>{cards.current.length}</strong><span>cards<br />in motion</span></div>
  </header>

  <section class="board" aria-label="Kanban board">
    {#each columns.current as column, index (column.id)}
      <article class="lane" data-tone={column.color} ondragover={(event) => event.preventDefault()} ondrop={() => { if (draggingID !== null) void moveCard(draggingID, column.id); }}>
        <header><span>0{index + 1}</span><h2>{column.title}</h2><strong>{cardsFor(column.id).length}</strong></header>
        <div class="lane-cards">
          {#each cardsFor(column.id) as card (card.id)}
            <div class="card" role="listitem" aria-label={`${card.title}, ${card.priority} priority`} draggable={true} ondragstart={(event) => { draggingID = card.id; event.dataTransfer?.setData("text/plain", String(card.id)); }} ondragend={() => { draggingID = null; }} data-dragging={draggingID === card.id}>
              <GripVertical class="card-grip" aria-hidden="true" />
              <div class="card-copy"><strong>{card.title}</strong>{#if card.detail}<span>{card.detail}</span>{/if}</div>
              <span class="priority" data-priority={card.priority}>{card.priority}</span>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger class="card-menu" aria-label="Card actions"><MoreHorizontal /></DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content class="move-menu" sideOffset={6}>
                    <DropdownMenu.Item class="move-item" onclick={() => beginEdit(card)}>Edit card</DropdownMenu.Item>
                    <DropdownMenu.Separator class="menu-rule" />
                    <p>Move card</p>
                    {#each columns.current as destination (destination.id)}
                      <DropdownMenu.Item class="move-item" disabled={destination.id === column.id} onclick={() => void moveCard(card.id, destination.id)}>{destination.title}</DropdownMenu.Item>
                    {/each}
                    <DropdownMenu.Separator class="menu-rule" />
                    <DropdownMenu.Item class="move-item danger" onclick={() => void removeCard(card.id)}>Delete card</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          {/each}
          {#if cardsFor(column.id).length === 0}<p class="lane-empty">Drop a card here.</p>{/if}
        </div>
        <button class="lane-add" onclick={() => beginAdd(column.id)}><Plus />Add card</button>
      </article>
    {/each}
  </section>

  <footer><span>Drag to move</span><span>{cards.current.length} cards</span><span>Use the menu to edit</span></footer>
  {#if cards.error || columns.error}<p class="board-error">The board could not be updated.</p>{/if}

  <Dialog.Root bind:open={adding}>
    <Dialog.Portal>
      <Dialog.Overlay class="card-overlay" />
      <Dialog.Content class="card-dialog">
        <form onsubmit={(event)=>{event.preventDefault();void createCard()}}><p>{editingID===null?"New work item":"Edit work item"}</p><Dialog.Title>{editingID===null?"Add a card":"Update card"}</Dialog.Title><Dialog.Description>Keep it clear enough to act on.</Dialog.Description>
        <label>Title<input bind:value={draftTitle} placeholder="What needs to move?" /></label>
        <label>Detail<textarea bind:value={draftDetail} placeholder="Optional context"></textarea></label>
        <label>Priority<select bind:value={draftPriority}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
        <div class="card-actions"><Dialog.Close type="button">Cancel</Dialog.Close><button type="submit">{editingID===null?"Add card":"Save changes"}</button></div></form>
        <Dialog.Close class="dialog-close" aria-label="Close"><X /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</main>
