<script lang="ts">
  import { Dialog } from "bits-ui";
  import { sql, sqliteQuery } from "@slop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import X from "@lucide/svelte/icons/x";
  type Habit={id:number;name:string;color:string;created_at:string;archived:number|boolean};
  type Checkin={habit_id:number;day:string;quantity:number};
  const habits=sqliteQuery<Habit>("main",sql`SELECT id,name,color,created_at,archived FROM habits WHERE archived = 0 ORDER BY id`);
  const checkins=sqliteQuery<Checkin>("main",sql`SELECT habit_id,day,quantity FROM checkins ORDER BY day`);
  let selectedID=$state(1);let adding=$state(false);let editingID=$state<number|null>(null);let draftName=$state("");let draftColor=$state("mint");
  const days=Array.from({length:84},(_,index)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(83-index));return date.toISOString().slice(0,10)});
  const active=$derived(habits.current.find((habit)=>habit.id===selectedID)??habits.current[0]??null);
  const activeDays=$derived(new Set(checkins.current.filter((item)=>item.habit_id===active?.id&&Number(item.quantity)>0).map((item)=>item.day)));
  const streak=$derived(calculateStreak(activeDays));
  const total=$derived(activeDays.size);

  $effect(()=>{if(active&&selectedID!==active.id)selectedID=active.id});
  function calculateStreak(values:Set<string>):number{let count=0;const date=new Date();date.setHours(12,0,0,0);while(values.has(date.toISOString().slice(0,10))){count+=1;date.setDate(date.getDate()-1)}return count}
  function labelDay(value:string):string{return new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(`${value}T12:00:00`))}
  async function toggleDay(day:string):Promise<void>{if(!active)return;if(activeDays.has(day))await checkins.execute(sql`DELETE FROM checkins WHERE habit_id = ${active.id} AND day = ${day}`);else await checkins.execute(sql`INSERT INTO checkins (habit_id,day,quantity) VALUES (${active.id},${day},1)`)}
  function beginAdd():void{editingID=null;draftName="";draftColor="mint";adding=true}
  function beginEdit():void{if(!active)return;editingID=active.id;draftName=active.name;draftColor=active.color;adding=true}
  async function saveHabit():Promise<void>{const name=draftName.trim();if(!name)return;if(editingID===null){const createdAt=new Date().toISOString();await habits.execute(sql`INSERT INTO habits (name,color,created_at,archived) VALUES (${name},${draftColor},${createdAt},0)`)}else await habits.execute(sql`UPDATE habits SET name = ${name}, color = ${draftColor} WHERE id = ${editingID}`);draftName="";draftColor="mint";editingID=null;adding=false}
</script>

<main class="habit-shell" data-slop-selection="none">
  <header><div><p>Daily practice / 12 weeks</p><h1>Keep the thread</h1></div><div class="habit-score"><strong>{String(streak).padStart(2,"0")}</strong><span>day<br/>streak</span></div></header>
  <section class="habit-panel">
    <div class="habit-tabs">{#each habits.current as habit (habit.id)}<button class:active={active?.id===habit.id} data-tone={habit.color} onclick={()=>{selectedID=habit.id}}><i></i>{habit.name}</button>{/each}<Dialog.Root bind:open={adding}><button class="add-habit" aria-label="Add habit" onclick={beginAdd}><Plus/></button><Dialog.Portal><Dialog.Overlay class="habit-overlay"/><Dialog.Content class="habit-dialog"><form onsubmit={(event)=>{event.preventDefault();void saveHabit()}}><p>{editingID===null?"New daily thread":"Edit daily thread"}</p><Dialog.Title>{editingID===null?"Add a habit":"Update habit"}</Dialog.Title><Dialog.Description>Choose something small enough to repeat.</Dialog.Description><label>Name<input bind:value={draftName} placeholder="Read ten pages"/></label><label>Color<select bind:value={draftColor}><option value="mint">Mint</option><option value="coral">Coral</option><option value="butter">Butter</option><option value="blue">Blue</option></select></label><div class="habit-actions"><Dialog.Close type="button">Cancel</Dialog.Close><button type="submit">{editingID===null?"Add habit":"Save changes"}</button></div></form><Dialog.Close class="habit-close" aria-label="Close"><X/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root></div>
    <div class="heatmap-head"><div><span>Selected habit</span><strong>{active?.name??"No habit"}</strong></div><button class="edit-habit" onclick={beginEdit} disabled={!active}><Pencil/>Edit</button><div><span>Check-ins</span><strong>{total}</strong></div></div>
    <div class="heatmap-wrap"><div class="weekday-labels"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class="heatmap" data-tone={active?.color??"mint"}>{#each days as day}<button class:checked={activeDays.has(day)} aria-label={`${labelDay(day)}: ${activeDays.has(day)?"complete":"not complete"}`} title={labelDay(day)} onclick={()=>void toggleDay(day)}></button>{/each}</div></div>
    <div class="habit-caption"><span>Older</span><span>Tap a square to mark the day</span><span>Today</span></div>
  </section>
  <footer><span>{total} check-ins</span><span>Tap a square to mark the day</span></footer>
  {#if habits.error||checkins.error}<p class="habit-error">The habit record could not be updated.</p>{/if}
</main>
