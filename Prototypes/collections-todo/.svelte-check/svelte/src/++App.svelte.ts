///<reference types="svelte" />
;
import { Checkbox } from "bits-ui";
import { query, mutation } from "@hitslop/svelte/collections";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import * as s from "./styles.css";
function $$render() {

  
  
  
  
  
  let title = $state("");
  let cursor = $state<string | undefined>();
  const rows = $derived(query(api.todos.find, { index: "by_created", order: "desc", limit: 25, ...(cursor ? { cursor } : {}) }))/*Ωignore_startΩ*/;let $rows = __sveltets_2_store_get(rows);/*Ωignore_endΩ*/;
  const total = query(api.todos.count, {})/*Ωignore_startΩ*/;let $total = __sveltets_2_store_get(total);/*Ωignore_endΩ*/;
  const { mutate: insert, pending } = mutation(api.todos.insert)/*Ωignore_startΩ*/;let $pending = __sveltets_2_store_get(pending);/*Ωignore_endΩ*/;
  const { mutate: update } = mutation(api.todos.update);
  async function add() { if (!title.trim()) return; try { await insert({ title: title.trim(), completed: false, createdAt: Date.now() }); title = ""; cursor = undefined; } catch { /* Host owns persistence errors. */ } }
  async function toggle(row: Doc<"todos">, completed: boolean) { try { await update({ id: row._id, changes: { completed } }); } catch { /* Host owns persistence errors. */ } }
;
async () => {
 { svelteHTML.createElement("main", { "class":s.page,});
   { svelteHTML.createElement("h1", { "class":s.heading,});   }
   { svelteHTML.createElement("p", { "class":s.caption,});$total ?? 0; $total === 1 ? "task" : "tasks";         }
   { svelteHTML.createElement("form", {   "class":s.form,"onsubmit":event => { event.preventDefault(); void add(); },});
     { svelteHTML.createElement("input", {          "class":s.input,"aria-label":`New task`,"placeholder":`What needs doing?`,"required":true,"maxlength":512,"bind:value":title,});/*Ωignore_startΩ*/() => title = __sveltets_2_any(null);/*Ωignore_endΩ*/}
     { svelteHTML.createElement("button", {   "class":s.button,"disabled":$pending,});  }
   }
   { svelteHTML.createElement("table", { "class":s.table,});
     { svelteHTML.createElement("thead", {}); { svelteHTML.createElement("tr", {}); { svelteHTML.createElement("th", {   "class":s.cell,"scope":`col`,});  } { svelteHTML.createElement("th", {   "class":s.cell,"scope":`col`,});  } } }
     { svelteHTML.createElement("tbody", {});   for(let row of __sveltets_2_ensureArray($rows?.items ?? [])){row._id;
       { svelteHTML.createElement("tr", { "class":s.row,}); { svelteHTML.createElement("td", { "class":s.cell,}); { const $$_tooR_xobkcehC5C = __sveltets_2_ensureComponent(Checkbox.Root); new $$_tooR_xobkcehC5C({ target: __sveltets_2_any(), props: {       children:() => { return __sveltets_2_any(0); },"class":s.check,"checked":row.completed,"onCheckedChange":checked => toggle(row, checked),"aria-label":`Complete ${row.title}`,}});row.completed ? "✓" : ""; Checkbox.Root} } { svelteHTML.createElement("td", { "class":`${s.cell} ${row.completed ? s.done : ""}`,});row.title; } }
    } { svelteHTML.createElement("tr", {}); { svelteHTML.createElement("td", {   "colspan":2,"class":s.cell,});$rows ? "Start with one small task." : "Loading tasks…"; } } }
   }
   { svelteHTML.createElement("div", { "class":s.footer,});
    if(cursor){ { svelteHTML.createElement("button", {   "class":s.button,"onclick":() => cursor = undefined,});  }}
    if($rows?.nextCursor){ { svelteHTML.createElement("button", {   "class":s.button,"onclick":() => cursor = $rows?.nextCursor ?? undefined,});  }}
   }
 }
};
return { props: {} as Record<string, never>, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const App__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type App__SvelteComponent_ = ReturnType<typeof App__SvelteComponent_>;
/*Ωignore_endΩ*/export default App__SvelteComponent_;