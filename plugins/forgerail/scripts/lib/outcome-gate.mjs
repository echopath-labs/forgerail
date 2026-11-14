// Optional, process-local evidence. No persisted receipt is trusted as a baseline.
import { realpathSync, readdirSync, lstatSync, openSync, closeSync, fstatSync, readSync, constants } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => hash(JSON.stringify(value));
const limit = 'Local observation only; stable filesystem and trusted Host required; not business acceptance or authorization.';
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_') && !['NODE_OPTIONS','NODE_PATH'].includes(k)));
class ObservationError extends Error {
  constructor(code, phase, message, metadata={}) {super(message);this.diagnostic={code,phase,...metadata};}
}
function diagnostic(error, phase) {
  const known={'Unstable workspace':'SNAPSHOT_CHANGED','Concurrent file change':'FILE_CHANGED','File changed during open':'FILE_CHANGED','Concurrent change':'FILE_CHANGED','Short read':'FILE_CHANGED','Symlink unsupported':'SYMLINK_UNSUPPORTED','Nested repository':'NESTED_REPOSITORY','Snapshot file limit':'SNAPSHOT_LIMIT','Unsupported file or snapshot byte limit':'SNAPSHOT_LIMIT','Different worktree identity':'WORKTREE_MISMATCH','No trusted task-start baseline in this process':'BASELINE_MISSING'};
  return error.diagnostic ?? {code: known[error.message] ?? (typeof error.code==='string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'OBSERVATION_UNAVAILABLE'), phase};
}
function failure(error, phase) {return {detail:'Requirement could not be independently verified',diagnostic:diagnostic(error,phase)};}
function git(root, args) {
  const started=Date.now();
  const r = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], { cwd: root, env: {...cleanEnv(), GIT_NO_LAZY_FETCH:'1', GIT_TERMINAL_PROMPT:'0'}, encoding:'utf8', timeout:5000, maxBuffer:4*1024*1024 });
  if (r.error || r.status !== 0) throw new ObservationError(r.error?.code==='ETIMEDOUT'?'GIT_TIMEOUT':'GIT_UNAVAILABLE','git:'+args[0],'Git observation unavailable',{exitCode:r.status,signal:r.signal,errno:r.error?.code ?? null,elapsedMs:Date.now()-started});
  return r.stdout;
}
function pathKey(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/') || value.split('/').some(x => !x || x === '.' || x === '..' || x === '.git') || /[\x00-\x1f:]/.test(value)) throw Error('Expected literal owner-relative path');
  return value;
}
function snapshot(workspace) {
  const root = realpathSync(workspace);
  if (realpathSync(git(root,['rev-parse','--show-toplevel']).trim()) !== root) throw Error('Exact Git owner root required');
  const identity = {root, gitDir:realpathSync(git(root,['rev-parse','--absolute-git-dir']).trim()), commonDir:realpathSync(git(root,['rev-parse','--path-format=absolute','--git-common-dir']).trim())};
  // --stage omits intent-to-add and other semantic index flags. Fail closed.
  const index=[];let entries=git(root,['ls-files','--stage','--debug','-z']);
  while(entries.length) {
    const end=entries.indexOf('\0'), header=entries.slice(0,end), tab=header.indexOf('\t');
    const meta=end<0?null:/^  ctime: [^\n]*\n  mtime: [^\n]*\n  dev: [^\n]*\n  uid: [^\n]*\n  size: [^\n]*flags: ([0-9a-f]+)\n/.exec(entries.slice(end+1));
    if(!meta || tab<0 || !/^[0-7]{6} [0-9a-f]+ 0$/.test(header.slice(0,tab)) || header.startsWith('160000 ') || !/^0+$/.test(meta[1])) throw new ObservationError('INDEX_UNSUPPORTED','snapshot','Unsupported index flags or entry');
    index.push([header.slice(tab+1),header.slice(0,tab)]);
    entries=entries.slice(end+1+meta[0].length);
  }
  let bytes=0, count=0; const files=[];
  function walk(dir) {
    for(const name of readdirSync(dir).sort()) {
      if(name === '.git') { if(dir !== root) throw Error('Nested repository'); continue; }
      const p=join(dir,name), st=lstatSync(p), key=relative(root,p);
      if(++count>10000) throw Error('Snapshot file limit');
      if(st.isSymbolicLink()) throw Error('Symlink unsupported');
      if(st.isDirectory()) {walk(p);continue;}
      if(!st.isFile() || st.size>8*1024*1024 || (bytes+=st.size)>32*1024*1024) throw Error('Unsupported file or snapshot byte limit');
      const fd=openSync(p,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      let data;
      try {const opened=fstatSync(fd);if(!opened.isFile() || opened.ino!==st.ino || opened.size!==st.size) throw Error('File changed during open');data=Buffer.alloc(st.size);let n=0;while(n<data.length){const got=readSync(fd,data,n,data.length-n,n);if(!got)throw Error('Short read');n+=got;}const end=fstatSync(fd);if(end.size!==st.size || end.mtimeMs!==st.mtimeMs)throw Error('Concurrent change');}finally{closeSync(fd);}
      const after=lstatSync(p);
      if(st.ino!==after.ino || st.size!==after.size || st.mtimeMs!==after.mtimeMs) throw Error('Concurrent file change');
      files.push([key,st.mode & 0o7777,hash(data)]);
    }
  }
  walk(root);
  return {identity, head:git(root,['rev-parse','HEAD']).trim(), branch:git(root,['rev-parse','--symbolic-full-name','HEAD']).trim(), index, files};
}
function stable(workspace) {const a=snapshot(workspace),b=snapshot(workspace);if(digest(a)!==digest(b)) throw Error('Unstable workspace');return b;}
function selected(s, paths) {const included=p=>paths.some(x=>p===x || p.startsWith(x+'/'));return {files:s.files.filter(x=>included(x[0])),index:s.index.filter(x=>included(x[0]))};}
export function createOutcomeGate() {
  const baselines=new Map(), evidence=new Map();let running=false, cancelRun=null;
  const result=(status, req, detail, extra={})=>structuredClone({status, requirement:req, detail, limitations:[limit], ...extra});
  return {
    async cancel() {if(cancelRun)await cancelRun();},
    capture(workspace) {try {if(baselines.size>=32)throw Error('Session baseline limit');const state=stable(workspace),id=randomUUID();baselines.set(id,state);return {status:'VERIFIED',baseline:id,identity:structuredClone(state.identity),source:'live Git/index/files',digest:digest(state),limitations:[limit]};}catch(e){return result('UNVERIFIED',null,'Observation unavailable',failure(e,'capture'));}},
    unchanged(req) {try {
      if(!req || typeof req.source!=='string' || !req.source.trim() || !Array.isArray(req.paths) || !req.paths.length || req.expected!=='unchanged') throw Error('Explicit source, paths and unchanged expectation required');
      const paths=req.paths.map(pathKey), before=baselines.get(req.baseline);if(!before) throw Error('No trusted task-start baseline in this process');
      const now=stable(req.workspace);for(const key of paths){let prefix=now.identity.root;for(const part of key.split('/')){prefix=join(prefix,part);try{if(realpathSync(prefix)!==prefix)throw new ObservationError('PATH_ALIAS','protected-path','Noncanonical protected path');}catch(e){if(e.code==='ENOENT')break;throw e;}}}if(digest(now.identity)!==digest(before.identity)) throw Error('Different worktree identity');
      return result(digest(selected(before,paths))===digest(selected(now,paths))?'VERIFIED':'FAILED',req,'Compared index entries and file bytes/modes against captured baseline',{source:'live Git/index/files',identity:now.identity,baselineDigest:digest(before),currentDigest:digest(now)});
    }catch(e){return result('UNVERIFIED',req,'Observation unavailable',failure(e,'requirement'));}},
    async run(req) {if(running)return result('UNVERIFIED',null,'Another validation is active',{diagnostic:{code:'SESSION_BUSY',phase:'run'}});running=true;let phase='request';try {
      req=structuredClone(req);
      if(!req || typeof req.source!=='string' || !req.source.trim() || req.expectedExit!==0 || req.authorized!==true || req.hostIsolation!=='confirmed' || process.platform==='win32') throw Error('Explicit authorization and Host isolation required; POSIX only');
      if(evidence.size>=32)throw Error('Session evidence limit');
      const script=pathKey(req.script); if(!/\.(mjs|cjs|js)$/.test(script) || !Array.isArray(req.args) || req.args.some(x=>typeof x!=='string') || req.args.join('').length>8192) throw Error('Only a selected local Node script with literal arguments is supported');
      const timeout=req.timeoutMs;if(!Number.isInteger(timeout)||timeout<1||timeout>60000) throw Error('timeoutMs must be 1..60000');
      phase='before-snapshot';const before=stable(req.workspace), file=resolve(before.identity.root,script);
      if(!before.files.some(x=>x[0]===script)) throw Error('Local script missing');
      phase='execution';const execution=await new Promise(resolveResult=>{
        let size=0, reason=null, settled=false;
        const child=spawn(process.execPath,[file,...req.args],{cwd:before.identity.root,env:cleanEnv(),shell:false,detached:true,stdio:['ignore','pipe','pipe']});
        const kill=()=>{if(!child.pid)return;try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')reason='cleanup-unverified';}};
        let resolveClosed, cleanupTimer;
        const closed=new Promise(resolve=>{resolveClosed=resolve;});
        const finish=(code,signal)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(cleanupTimer);kill();child.stdout.destroy();child.stderr.destroy();child.unref();cancelRun=null;resolveClosed();resolveResult({code,signal,reason,outputBytes:size});};
        const cleanup=()=>{kill();if(!cleanupTimer)cleanupTimer=setTimeout(()=>{reason='cleanup-unverified';finish(null,null);},1000);};
        const stop=why=>{reason=why;cleanup();return closed;};
        cancelRun=()=>stop('cancelled');
        const timer=setTimeout(()=>{stop('timeout');},timeout);
        const consume=b=>{size+=b.length;if(size>65536)stop('output-limit');};
        child.stdout.on('data',consume);child.stderr.on('data',consume);
        child.on('error',()=>{reason='spawn-error';});child.on('exit',cleanup);child.on('close',finish);
      });
      phase='after-snapshot';const after=stable(req.workspace),id=randomUUID();
      const status=digest(before)!==digest(after)?'STALE':execution.reason||execution.signal||execution.code===null?'UNVERIFIED':execution.code===0?'VERIFIED':'FAILED';
      const record={request:structuredClone(req),state:after,status,execution}; evidence.set(id,record);
      return result(status,req,'Observed local process exit; output content intentionally not retained',{evidence:id,source:'local Node process',identity:after.identity,stateDigest:digest(after),execution});
    }catch(e){return result('UNVERIFIED',req,'Observation unavailable',failure(e,phase));}finally{running=false;}},
    check(id, workspace) {const e=evidence.get(id);if(!e)return result('UNVERIFIED',null,'No process-owned execution evidence');try{const now=stable(workspace);if(digest(now.identity)!==digest(e.state.identity))return result('UNVERIFIED',e.request,'Different worktree identity');if(digest(now)!==digest(e.state))e.status='STALE';return result(e.status,e.request,'Rechecked execution applicability',{evidence:id,execution:e.execution,stateDigest:digest(now)});}catch(err){return result('UNVERIFIED',e.request,'Observation unavailable',failure(err,'check'));}}
  };
}
