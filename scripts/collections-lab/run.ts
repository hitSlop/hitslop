import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Native, root, executable } from "./client";
import { api, secret, token, until, RelaySocket } from "../../Prototypes/native-loro-relay/tests/client";
import { verifyIncrementalRelay } from "../../Prototypes/native-loro-relay/tests/incremental";
import { verifyRelay } from "../../Prototypes/native-loro-relay/tests/relay";

const output = join(root,".hitslop/collections-lab",`run-${Date.now()}`); await mkdir(output,{recursive:true});
const artifact = join(root,"Prototypes/collections-todo/dist/collections-todo.slopsql");
const checks: string[] = [], metrics: Record<string,unknown> = {};
function check(value: unknown, name: string): asserts value { if (!value) throw new Error(name); checks.push(name); console.log(`PASS ${name}`); }
async function command(args: string[], name: string) {
  const p = Bun.spawn(args,{cwd:root,stdout:Bun.file(join(output,name+".log")),stderr:"inherit"}); if (await p.exited) throw new Error(name);
}
if (!process.argv.includes("--skip-build")) {
  await command(["bun","run","schema:generate"],"schema");
  await command(["bun","run","--cwd","packages/svelte","build"],"svelte");
  await command(["swift","build","--package-path","apps/apple/Packages/HitSlopApple","--product","hitslop-collections-spike"],"native-build");
  await command(["bun","slop","build","Prototypes/collections-todo","--experimental-collections"],"artifact");
  check(await readFile(join(root,"Prototypes/collections-todo/_generated/schema.json"),"utf8") === await readFile(join(root,"apps/apple/Packages/HitSlopApple/Tests/HitSlopCollectionsSpikeTests/Fixtures/collections.schema.json"),"utf8"),"TypeBox fixture matches native tests");
  await command(["swift","test","--package-path","apps/apple/Packages/HitSlopApple","--filter","CollectionsTests"],"native-tests");
  await command(["bun","run","--cwd","Prototypes/collections-todo","check"],"generated-types");
}
const clients: Native[] = [];
async function client(name: string) { const path=join(output,name+".slopsql"); await copyFile(artifact,path); const c=new Native(path); clients.push(c); return c; }
const large = await client("10000-todos");
try {
  const names=Bun.spawnSync(["sqlite3",artifact,"SELECT name FROM sqlar ORDER BY name;"]).stdout.toString().trim().split("\n");
  check(names.includes("collections.schema.json") && names.includes("collections.api.json") && names.some((n:string)=>n.endsWith(".js")) && names.every((n:string)=>!n.includes("_generated")&&!n.includes("node_modules")&&!/\.(ts|svelte|map)$/.test(n)),"SQLite embeds runtime assets and readable metadata, without generated source");
  const crash = await client("crash");
  await crash.op("insert",{title:"Confirmed before crash",completed:false,createdAt:1});
  const confirmedOutbox=await crash.request({method:"outbox"});
  await crash.request({method:"crashCommit"});
  let killed=false;
  try { await crash.request({method:"batch",operations:Array.from({length:256},(_,i)=>({collection:"todos",operation:"insert",args:{title:"Uncommitted "+i+"x".repeat(450),completed:false,createdAt:i}}))}); } catch { killed=true; }
  await crash.process.exited; clients.splice(clients.indexOf(crash),1);
  check(killed,"writer killed during a spilling SQLite transaction");
  const recovered=new Native(crash.path);clients.push(recovered);
  check(await recovered.op("count")===1 && JSON.stringify(await recovered.request({method:"outbox"}))===JSON.stringify(confirmedOutbox),"crash recovery preserves confirmed records and immutable outbox");
  await recovered.close();clients.splice(clients.indexOf(recovered),1);
  const start=performance.now();
  await large.request({method:"batch",operations:Array.from({length:10000},(_,i)=>({collection:"todos",operation:"insert",args:{title:`Task ${i}`,completed:i%2===0,createdAt:i}}))});
  metrics.seed10000Ms=performance.now()-start;
  const times:number[]=[]; let maxBytes=0, cursor: string|undefined, count=0; const ids=new Set<string>();
  do {
    const start=performance.now(); const page=await large.op("find",{where:{completed:false},index:"by_completed",limit:100,...(cursor?{cursor}:{})});
    times.push(performance.now()-start); maxBytes=Math.max(maxBytes,JSON.stringify(page).length); count+=page.items.length;
    for(const row of page.items) ids.add(row._id); cursor=page.nextCursor ?? undefined;
  } while(cursor);
  check(count===5000&&ids.size===5000,"10,000 rows: indexed pagination has no gaps or duplicates");
  metrics.pageP50Ms=times.sort((a,b)=>a-b)[Math.floor(times.length*.5)]; metrics.pageP95Ms=times[Math.floor(times.length*.95)]; metrics.maxPageBytes=maxBytes;
  const plan=await large.request({method:"explain",collection:"todos",operation:"find",args:{where:{completed:false},index:"by_completed"}});
  check(plan.some((s:string)=>s.includes("i_todos_by_completed")),"SQLite uses the declared collection index"); metrics.queryPlan=plan;
  const one=await large.op("find",{limit:1}); const editStart=performance.now(); await large.op("update",{id:one.items[0]._id,changes:{title:"Edited among 10,000"}}); metrics.edit10000Ms=performance.now()-editStart;
  const memory=Bun.spawnSync(["ps","-o","rss=","-p",String(large.process.pid)]); metrics.nativeRssKiB=Number(memory.stdout.toString().trim());
  await large.close(); clients.splice(clients.indexOf(large),1);
  const storage=Bun.spawnSync(["sqlite3",join(output,"10000-todos.slopsql"),"SELECT length(checkpoint), (SELECT sum(length(bytes)) FROM outbox) FROM document;"]); metrics.checkpointAndOutboxBytes=storage.stdout.toString().trim();
  check(Bun.spawnSync(["sqlite3",join(output,"10000-todos.slopsql"),"PRAGMA integrity_check;"]).stdout.toString().trim()==="ok","SQLite integrity after large collection writes");

  const a=await client("left"), b=await client("right");
  const seed=await a.request({method:"seed"});
  const endpoint=process.argv.includes("--hosted") ? JSON.parse(await readFile(join(root,".hitslop/native-loro/hosted.json"),"utf8")).endpoint : "http://127.0.0.1:8791";
  const key=await secret(), owner=token(key,seed.documentId,"owner",true), member=token(key,seed.documentId,"member");
  metrics.endpoint=endpoint;
  const baseline=await verifyRelay(endpoint), incremental=await verifyIncrementalRelay(endpoint); metrics.baselineRelay=baseline;metrics.incrementalRelay=incremental;
  await api(endpoint,seed.documentId,owner,"POST","",seed);
  try {
    await api(endpoint,seed.documentId,owner,"PUT","/members/member");
    await a.request({method:"attach",documentId:seed.documentId,schema:seed.schema}); await b.request({method:"attach",documentId:seed.documentId,schema:seed.schema});
    const id=await a.op("insert",{title:"Shared task",completed:false,createdAt:1});
    await a.request({method:"connect",endpoint,token:owner}); await b.request({method:"connect",endpoint,token:member});
    await until(async()=> (await b.op("findOne",{id}))?.title==="Shared task","native socket replication",30000);
    check(true,"native host replicates generated collection mutations");
    await a.request({method:"disconnect"}); await b.request({method:"disconnect"});
    await a.op("update",{id,changes:{title:"Offline title"}}); await b.op("update",{id,changes:{completed:true}});
    await a.request({method:"connect",endpoint,token:owner}); await b.request({method:"connect",endpoint,token:member});
    await until(async()=>{const x=await a.op("findOne",{id}),y=await b.op("findOne",{id});return x.title==="Offline title"&&x.completed&&JSON.stringify(x)===JSON.stringify(y)},"offline field merge",30000);
    check(true,"offline edits to independent fields converge");
    await until(async()=>!(await a.request({method:"outbox"})).length&&!(await b.request({method:"outbox"})).length,"outbox drained");
    await api(endpoint,seed.documentId,owner,"POST","/test",{dropAck:true});
    await a.op("update",{id,changes:{title:"Retry after lost ack"}});
    await until(async()=> (await b.op("findOne",{id}))?.title==="Retry after lost ack"&&!(await a.request({method:"outbox"})).length,"lost ack retry",30000);
    check(true,"lost acknowledgement reconnect retries immutable batch IDs");
    await a.request({method:"disconnect"}); await b.request({method:"disconnect"});
    const editStart=performance.now();
    for(let i=0;i<1000;i++) await a.op("update",{id,changes:{title:`Backlog ${i}`}});
    metrics.local1000EditMs=performance.now()-editStart;
    const syncStart=performance.now();
    await a.request({method:"connect",endpoint,token:owner}); await b.request({method:"connect",endpoint,token:member});
    await until(async()=> (await b.op("findOne",{id}))?.title==="Backlog 999"&&!(await a.request({method:"outbox"})).length,"1000 edit backlog",180000);
    metrics.backlog1000Ms=performance.now()-syncStart; check(true,"bounded transport and replay drain 1,000 edits");
    const stats=await api(endpoint,seed.documentId,owner,"GET","/stats"); metrics.relay=stats;
    // Build a fresh recipient from the same immutable seed file, then replay all history.
    const c=await client("late-join"); await c.request({method:"attach",documentId:seed.documentId,schema:seed.schema}); const joinStart=performance.now();
    await c.request({method:"connect",endpoint,token:member});
    await until(async()=> (await c.op("findOne",{id}))?.title==="Backlog 999","late join",90000); metrics.lateJoinMs=performance.now()-joinStart;check(true,"late replica replays from matching immutable seed");
    await api(endpoint,seed.documentId,owner,"DELETE","/members/member");
    await b.op("insert",{title:"Local after revocation",completed:false,createdAt:9});
    await until(async()=> (await b.request({method:"status"}))!=="connected","revocation closes native socket");
    check((await b.request({method:"outbox"})).length>0,"revocation preserves offline local changes");
    // Mismatched schema is rejected before replay.
    const wrong=await RelaySocket.open(endpoint,seed.documentId,owner,1,false,{protocol:2,documentId:seed.documentId,schema:"f".repeat(64),batchSize:32});
    try { await wrong.wait("error");check(true,"schema mismatch rejected by relay"); } finally { wrong.close(); }
  } finally { for(const c of clients) await c.request({method:"disconnect"}).catch(()=>{}); await api(endpoint,seed.documentId,owner,"DELETE").catch(()=>{}); }
} finally {
  for(const c of clients) await c.close().catch(()=>{});
  await writeFile(join(output,"results.json"),JSON.stringify({date:new Date().toISOString(),checks,metrics},null,2)+"\n");
  console.log(`Evidence: ${output}`);
}
