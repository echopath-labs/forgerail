import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,renameSync,symlinkSync,chmodSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createOutcomeGate} from './lib/outcome-gate.mjs';
function setup(t){const root=mkdtempSync(join(tmpdir(),'fr-outcome-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const git=(...a)=>{const r=spawnSync('git',a,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};const put=(p,s)=>writeFileSync(join(root,p),s);git('init');git('config','user.name','Test');git('config','user.email','test@example.com');put('sum.mjs','export const sum=(a,b)=>a+b;');put('test.mjs',"import assert from 'node:assert/strict';import {sum} from './sum.mjs';assert.equal(sum(2,3),5);");put('build.mjs',"import {sum} from './sum.mjs';if(typeof sum!=='function')process.exit(1);");git('add','.');git('commit','-m','baseline');return {root,git,put};}
const req=root=>({source:'user:explicit test',workspace:root,script:'test.mjs',args:[],expectedExit:0,authorized:true,hostIsolation:'confirmed',timeoutMs:3000});
function expectStatus(result,expected){assert.equal(result.status,expected,JSON.stringify(result));}
const protectedReq=(root,baseline)=>({source:'user:preserve',workspace:root,paths:['sum.mjs','new.txt','renamed.txt','future.txt'],expected:'unchanged',baseline});
test('real build/test, preserved file, changed file, failed test and stale result',async t=>{const f=setup(t),g=createOutcomeGate(),b=g.capture(f.root);assert.equal(b.status,'VERIFIED');assert.equal(g.unchanged(protectedReq(f.root,b.baseline)).status,'VERIFIED');assert.equal((await g.run({...req(f.root),script:'build.mjs'})).status,'VERIFIED');const e=await g.run(req(f.root));assert.equal(e.status,'VERIFIED');assert.equal(g.check(e.evidence,f.root).status,'VERIFIED');f.put('sum.mjs','export const sum=(a,b)=>a-b;');expectStatus(g.unchanged(protectedReq(f.root,b.baseline)),'FAILED');assert.equal(g.check(e.evidence,f.root).status,'STALE');assert.equal((await g.run(req(f.root))).status,'FAILED');assert.equal(g.check('agent-complete',f.root).status,'UNVERIFIED');assert.equal('complete' in e,false);});
test('dirty baseline, stage-only changes, rename/delete/add',t=>{const f=setup(t),g=createOutcomeGate();f.put('sum.mjs','dirty staged');f.git('add','sum.mjs');f.put('sum.mjs','dirty unstaged');f.put('new.txt','initial');let b=g.capture(f.root);assert.equal(g.unchanged(protectedReq(f.root,b.baseline)).status,'VERIFIED');f.git('add','sum.mjs');expectStatus(g.unchanged(protectedReq(f.root,b.baseline)),'FAILED');b=g.capture(f.root);renameSync(join(f.root,'new.txt'),join(f.root,'renamed.txt'));expectStatus(g.unchanged(protectedReq(f.root,b.baseline)),'FAILED');b=g.capture(f.root);f.put('future.txt','new');expectStatus(g.unchanged(protectedReq(f.root,b.baseline)),'FAILED');});
test('missing or forged baseline/evidence and different worktree same HEAD',async t=>{const f=setup(t),g=createOutcomeGate(),b=g.capture(f.root);assert.equal(g.unchanged(protectedReq(f.root,'fake')).status,'UNVERIFIED');const other=mkdtempSync(join(tmpdir(),'fr-other-'));rmSync(other,{recursive:true});t.after(()=>rmSync(other,{recursive:true,force:true}));f.git('worktree','add','--detach',other,'HEAD');const e=await g.run(req(f.root));assert.equal(g.check(e.evidence,other).status,'UNVERIFIED');assert.equal(g.unchanged(protectedReq(other,b.baseline)).status,'UNVERIFIED');assert.equal(createOutcomeGate().check(e.evidence,f.root).status,'UNVERIFIED');});
test('authorization, traversal, timeout, output bounds, mutation and symlink',async t=>{const f=setup(t),g=createOutcomeGate();assert.equal((await g.run({...req(f.root),authorized:false})).status,'UNVERIFIED');assert.equal((await g.run({...req(f.root),script:'../test.mjs'})).status,'UNVERIFIED');f.put('hang.mjs','setInterval(()=>{},1000)');assert.equal((await g.run({...req(f.root),script:'hang.mjs',timeoutMs:50})).status,'UNVERIFIED');f.put('output.mjs',"process.stdout.write('x'.repeat(100000));");assert.equal((await g.run({...req(f.root),script:'output.mjs'})).status,'UNVERIFIED');f.put('mutate.mjs',"import {writeFileSync} from 'node:fs';writeFileSync('sum.mjs','changed');");assert.equal((await g.run({...req(f.root),script:'mutate.mjs'})).status,'STALE');symlinkSync('/etc/hosts',join(f.root,'link'));assert.equal(g.capture(f.root).status,'UNVERIFIED');});
test('CLI actual run and forged claim rejection',t=>{const f=setup(t),r=spawnSync(process.execPath,['scripts/forgerail.mjs','outcome-gate'],{encoding:'utf8',input:JSON.stringify({action:'run',requirement:req(f.root)})+'\n'+JSON.stringify({action:'check',evidence:'fake',workspace:f.root})+'\n'});assert.equal(r.status,0,r.stderr);const rows=r.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows[0].status,'VERIFIED');assert.equal(rows[1].status,'UNVERIFIED');});
test('evidence cannot be mutated by API clients; observed stale remains stale',async t=>{
 const f=setup(t),g=createOutcomeGate(); const b=g.capture(f.root);b.identity.root='/invented';
 expectStatus(g.unchanged(protectedReq(f.root,b.baseline)),'VERIFIED');
 const e=await g.run(req(f.root));e.identity.root='/invented';e.execution.code=99;e.requirement.script='invented';
 const checked=g.check(e.evidence,f.root);expectStatus(checked,'VERIFIED');assert.equal(checked.execution.code,0);assert.equal(checked.requirement.script,'test.mjs');
 f.put('sum.mjs','changed');expectStatus(g.check(e.evidence,f.root),'STALE');f.put('sum.mjs','export const sum=(a,b)=>a+b;');expectStatus(g.check(e.evidence,f.root),'STALE');
});
test('same HEAD branch switch invalidates validation; simultaneous runs refused',async t=>{
 const f=setup(t),g=createOutcomeGate(),e=await g.run(req(f.root));f.git('checkout','-b','other');expectStatus(g.check(e.evidence,f.root),'STALE');
 f.put('wait.mjs','setTimeout(()=>{},100)');const first=g.run({...req(f.root),script:'wait.mjs'});const second=await g.run(req(f.root));expectStatus(second,'UNVERIFIED');assert.equal(second.diagnostic.code,'SESSION_BUSY');await first;
});
test('invalid JSON diagnostics do not echo supplied secret',t=>{
 setup(t); const r=spawnSync(process.execPath,['scripts/forgerail.mjs','outcome-gate'],{encoding:'utf8',input:'{"secret":"DO_NOT_ECHO" broken}\n'});assert.equal(r.status,0);assert.ok(!r.stdout.includes('DO_NOT_ECHO'));assert.equal(JSON.parse(r.stdout).diagnostic.code,'INVALID_REQUEST');
});
test('unavailable Git returns bounded structured diagnostics without stderr',t=>{
 const f=setup(t),g=createOutcomeGate(),old=process.env.PATH;try {process.env.PATH='/nonexistent';const r=g.capture(f.root);expectStatus(r,'UNVERIFIED');assert.equal(r.diagnostic.code,'GIT_UNAVAILABLE');assert.equal(r.diagnostic.errno,'ENOENT');assert.ok(!JSON.stringify(r).includes('stderr'));}finally{process.env.PATH=old;}
});

test('special permission changes and unmerged index cannot pass',t=>{
 const f=setup(t),g=createOutcomeGate(),b=g.capture(f.root);chmodSync(join(f.root,'sum.mjs'),0o1644);expectStatus(g.unchanged(protectedReq(f.root,b.baseline)),'FAILED');
 const oid=spawnSync('git',['rev-parse','HEAD:sum.mjs'],{cwd:f.root,encoding:'utf8'}).stdout.trim();
 const input=`0 ${'0'.repeat(40)}\tsum.mjs\n100644 ${oid} 1\tsum.mjs\n100644 ${oid} 2\tsum.mjs\n`;
 const r=spawnSync('git',['update-index','--index-info'],{cwd:f.root,input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const observed=g.capture(f.root);expectStatus(observed,'UNVERIFIED');assert.equal(observed.diagnostic.code,'INDEX_UNSUPPORTED');
});
test('Git timeout has finite diagnostics, no stderr or path contents',t=>{
 const f=setup(t),bin=mkdtempSync(join(tmpdir(),'fr-git-timeout-'));t.after(()=>rmSync(bin,{recursive:true,force:true}));
 writeFileSync(join(bin,'git'),`#!${process.execPath}\nsetTimeout(()=>{},10000);`);chmodSync(join(bin,'git'),0o755);
 const old=process.env.PATH;try{process.env.PATH=bin;const r=createOutcomeGate().capture(f.root);expectStatus(r,'UNVERIFIED');assert.equal(r.diagnostic.code,'GIT_TIMEOUT');assert.equal(r.diagnostic.phase,'git:rev-parse');assert.ok(r.diagnostic.elapsedMs>=4900);assert.ok(!JSON.stringify(r).includes(bin));}finally{process.env.PATH=old;}
});
test('cleanup failure never certifies a successful exit',async t=>{
 const f=setup(t),g=createOutcomeGate(),original=process.kill;
 try{process.kill=()=>{const e=new Error('not emitted');e.code='EPERM';throw e;};const r=await g.run(req(f.root));expectStatus(r,'UNVERIFIED');assert.equal(r.execution.reason,'cleanup-unverified');}finally{process.kill=original;}
});


test('intent-to-add and flagged index entries cannot certify unchanged or execution',async t=>{
 const f=setup(t),g=createOutcomeGate();f.put('empty','');f.git('add','-N','empty');
 const b=g.capture(f.root);expectStatus(b,'UNVERIFIED');assert.equal(b.diagnostic.code,'INDEX_UNSUPPORTED');
 expectStatus(await g.run(req(f.root)),'UNVERIFIED');
 f.git('add','empty');const ordinary=g.capture(f.root);expectStatus(ordinary,'VERIFIED');
 const e=await g.run(req(f.root));expectStatus(e,'VERIFIED');
 f.git('reset','HEAD','empty');f.git('add','-N','empty');
 expectStatus(g.unchanged({...protectedReq(f.root,ordinary.baseline),paths:['empty']}),'UNVERIFIED');
 expectStatus(g.check(e.evidence,f.root),'UNVERIFIED');
 f.git('add','empty');f.git('update-index','--assume-unchanged','sum.mjs');
 expectStatus(g.capture(f.root),'UNVERIFIED');
});

for(const [signal,expectedCode] of [['SIGTERM',143],['SIGINT',130]]) test(`actual CLI ${signal} waits for detached validation cleanup`,{timeout:15000},async t=>{
 const f=setup(t),markers=mkdtempSync(join(tmpdir(),'fr-cancel-'));t.after(()=>rmSync(markers,{recursive:true,force:true}));
 const marker=join(markers,'pid');
 f.put('hang.mjs',`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},String(process.pid));setInterval(()=>{},100);`);
 const child=spawn(process.execPath,['scripts/forgerail.mjs','outcome-gate'],{stdio:['pipe','pipe','pipe']});
 let pid;let output='';child.stdout.on('data',b=>{output+=b;});child.stderr.resume();
 const exit=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));});
 t.after(()=>{child.kill('SIGKILL');if(pid)try{process.kill(-pid,'SIGKILL');}catch{}});
 child.stdin.write(JSON.stringify({action:'run',requirement:{...req(f.root),script:'hang.mjs',timeoutMs:10000}})+'\n');
 for(let n=0;n<150&&!existsSync(marker);n++)await new Promise(r=>setTimeout(r,20));
 assert.ok(existsSync(marker),'validation must actually start before cancellation');pid=Number(readFileSync(marker,'utf8'));
 child.kill(signal);const result=await exit;assert.equal(result.code,expectedCode);assert.equal(result.signal,null);
 assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH','validation must be gone when Gate exits');
 assert.ok(!output.includes('VERIFIED'),'cancelled validation must not emit success');
});
