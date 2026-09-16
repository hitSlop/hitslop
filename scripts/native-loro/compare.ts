import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { keyboardChecks } from "./keyboard";

const repository=resolve(import.meta.dir,'../..'), base=join(repository,'.hitslop/native-loro');
const output=join(base,'results-v3'), packagePath=join(repository,'apps/apple/Packages/HitSlopApple');
const executable=join(packagePath,'.build/release/hitslop-loro-spike');
const args=process.argv.slice(2);
await mkdir(output,{recursive:true});
process.env.HITSLOP_SPIKE_EXECUTABLE=executable;
const run=async(command:string[],log:string,gate=false,env:Record<string,string>={})=>{
  console.log(`Spike 3: ${command.join(' ')}`);
  const child=Bun.spawn(command,{cwd:repository,stdout:Bun.file(join(output,log)),stderr:'inherit',env:{...process.env,...env}});
  const status=await child.exited;
  if(status!==0 && !(gate&&status===2)) throw new Error(`Failed (${status}): ${command.join(' ')}; ${log}`);
  return status;
};
if(!args.includes('--skip-build')) {
  await run(['bun','scripts/native-loro/prepare.ts'],'prepare.log');
  await run(['bun','scripts/native-loro/generate-contract.ts','--check'],'contract-check.log');
  await run(['bun','node_modules/typescript/bin/tsc','-p','scripts/native-loro/tsconfig.json'],'typescript-check.log');
  await run(['bun','examples/slops/node_modules/svelte-check/bin/svelte-check','--tsconfig',join(base,'source-native/tsconfig.json')],'svelte-check.log');
  await run(['swift','build','--package-path',packagePath,'-c','release','--product','hitslop-loro-spike'],'build.log');
  await run(['swift','test','--package-path',packagePath,'--filter','HitSlopLoroSpikeTests','--no-parallel'],'tests.log');
}
const probe=async(policy:string,text:string,script:string)=>{
  const name=`${script}-${text}-${policy}`;
  await run([executable,'--engine','native','--mode','probe','--package',join(base,'native.slop'),'--confirmation',policy,'--text-policy',text,'--script',join(import.meta.dir,`${script}.js`),'--output',join(output,`${name}.json`)],`${name}.log`,true);
  return JSON.parse(await readFile(join(output,`${name}.json`),'utf8'));
};
const results:any={recordedAt:new Date().toISOString(),scope:'isolated spike 3; no production migration',text:[],storage:[],baseline:[],keyboard:[],benchmarks:[]};
const archive=async()=>{
  await writeFile(join(output,'results.json'),JSON.stringify(results,null,2)+'\n');
  await cp(join(output,'results.json'),join(repository,'docs/experiments/native-loro/results-v3.json'));
};
try {
  for(const policy of ['accepted','durable']) {
    // Screen the candidate, then run the full matrix only for ancestry.
    results.text.push(await probe(policy,'host-frame','text-probe'));
    const text=await probe(policy,'ancestry','text-probe');results.text.push(text);
    if(!text.passed) throw new Error(`${policy} ancestry failed correctness`);
    const storage=await probe(policy,'ancestry','storage-probe');
    const expected=policy==='durable'?storage.initial.title:'Unsaved input retained';
    storage.checks.push({name:'policy-specific failed-save publication',passed:storage.duringFailure.current.title===expected,expected,actual:storage.duringFailure.current.title});
    storage.passed=storage.checks.every((c:any)=>c.passed);results.storage.push(storage);
    if(!storage.passed) throw new Error(`${policy} storage probe failed`);
    const file=join(output,`baseline-${policy}.json`);
    await run([executable,'--engine','native','--mode','verify','--package',join(base,'native.slop'),'--confirmation',policy,'--output',file],`baseline-${policy}.log`,true);
    const baseline=JSON.parse(await readFile(file,'utf8'));results.baseline.push(baseline);
    if(!baseline.passed) throw new Error(`${policy} baseline failed`);
    const keyboard=await keyboardChecks(policy,join(output,`keyboard-${policy}`));results.keyboard.push({confirmation:policy,...keyboard});
    if(!keyboard.passed) throw new Error(`${policy} keyboard failed`);
  }
  if(args.includes('--e2e')) {
    const relay=Bun.spawn(['bun','scripts/native-loro/relay-local.ts'],{cwd:repository,stdout:Bun.file(join(output,'relay.log')),stderr:'inherit'});
    const stop=()=>{relay.kill();};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    try {
      const end=Date.now()+30000;let ready=false;
      while(Date.now()<end) {try {ready=(await fetch('http://127.0.0.1:8791/health')).status===404;} catch {} if(ready)break;await Bun.sleep(100);}
      if(!ready)throw new Error('Local relay did not start');
      for(const policy of ['accepted','durable']) {
        const folder=join(output,`network-${policy}`);await mkdir(folder,{recursive:true});
        await run(['bun','scripts/native-loro/e2e.ts'],`network-${policy}.log`,false,{HITSLOP_SPIKE_CONFIRMATION:policy,HITSLOP_SPIKE_RESULTS:folder});
        const {readdir}=await import('node:fs/promises');
        const entries=await readdir(folder);
        const report=JSON.parse(await readFile(join(folder,entries.filter(n=>n.startsWith('e2e-')).sort().at(-1)!,'results.json'),'utf8'));
        (results.network??=[]).push({confirmation:policy,...report});
      }
    } finally {relay.kill();await relay.exited;process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
  }
  if(!args.includes('--verify-only')) {
    for(let sample=1;sample<=3;sample++) for(const count of [1,5,10]) for(const policy of sample%2?['accepted','durable']:['durable','accepted']) {
      const name=`benchmark-${policy}-${count}-${sample}`;
      await run([executable,'--engine','native','--mode','benchmark','--package',join(base,'native.slop'),'--confirmation',policy,'--count',String(count),'--output',join(output,`${name}.json`)],`${name}.log`);
      const measured=JSON.parse(await readFile(join(output,`${name}.json`),'utf8'));results.benchmarks.push(measured);
      if(!measured.edits.typing?.correct || measured.edits.typing.pendingAfterFlush!==0) throw new Error(`${name} lost typing or failed to drain`);
    }
  }
  results.passed=true;
} catch(error) {results.passed=false;results.executionError=String(error);throw error;}
finally {await archive();console.log(`Spike 3 results: ${output}`);}
