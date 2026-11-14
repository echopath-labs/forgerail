#!/usr/bin/env node
// JSON Lines session: capture, unchanged, run, check. IDs expire with this process.
import { StringDecoder } from 'node:string_decoder';
import { createOutcomeGate } from './lib/outcome-gate.mjs';
const gate=createOutcomeGate();let pending='';const decoder=new StringDecoder('utf8');
let terminating=false;
for(const [signal,code] of [['SIGINT',130],['SIGTERM',143]]) process.on(signal,()=>{
  if(terminating)return;
  terminating=true;
  // Wait for the active detached validation to close before exiting.
  void gate.cancel().finally(()=>process.exit(code));
});
for await (const chunk of process.stdin) {
  pending+=decoder.write(chunk);
  if(Buffer.byteLength(pending)>65536){process.stdout.write(JSON.stringify({status:'UNVERIFIED',detail:'Input exceeds 64 KiB'})+'\n');break;}
  let newline;
  while((newline=pending.indexOf('\n'))>=0){const line=pending.slice(0,newline);pending=pending.slice(newline+1);try{
    const r=JSON.parse(line);let out;
    if(r.action==='capture')out=gate.capture(r.workspace);
    else if(r.action==='unchanged')out=gate.unchanged(r.requirement);
    else if(r.action==='run')out=await gate.run(r.requirement);
    else if(r.action==='check')out=gate.check(r.evidence,r.workspace);
    else throw Error('Unsupported action');
    if(!terminating)process.stdout.write(JSON.stringify(out)+'\n');
  }catch(e){process.stdout.write(JSON.stringify({status:'UNVERIFIED',detail:'Invalid request',diagnostic:{code:'INVALID_REQUEST',phase:'input'}})+'\n');}}
}
if(pending.trim())process.stdout.write(JSON.stringify({status:'UNVERIFIED',detail:'Incomplete JSON line'})+'\n');
