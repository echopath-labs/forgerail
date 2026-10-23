import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const cli = resolve(import.meta.dirname, 'forgerail.mjs');
const sha = value => createHash('sha256').update(value).digest('hex');
function setup(t) {
  const dir = realpathSync(mkdtempSync(resolve(tmpdir(), 'forgerail-governance-cli-')));
  t.after(() => rmSync(dir, {recursive:true, force:true}));
  const root = resolve(dir, 'repo'); mkdirSync(root);
  const git = (...args) => {
    const r = spawnSync('git', ['-C', root, ...args], {encoding:'utf8'});
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  git('init', '-b', 'main'); git('config','user.name','Fixture'); git('config','user.email','fixture@example.invalid');
  git('commit', '--allow-empty', '-m', 'baseline');
  const run = (...args) => {
    const r = spawnSync(process.execPath, [cli,...args], {encoding:'utf8'});
    return {code:r.status, body:JSON.parse(r.stdout)};
  };
  return {dir,root,git,run};
}
const opts = (root, phase) => ['branch-check','--workspace',root,'--phase',phase,'--task-type','feature','--branch','feat/example','--intent','create','--checkout','true'];
function adopt(f, mode = 'fast') {
  const policy = JSON.stringify({mode, naming:{prefixes:{feature:['feat/'],fix:['fix/'],maintenance:['chore/'],documentation:['docs/']}}});
  writeFileSync(resolve(f.root,'policy.json'), policy);
  const profile = {schemaVersion:'1.0',profileId:'profile:test',workspaceIdentityId:'workspace:test',workspaceRelationshipIds:[],sources:[{sourceId:'source:policy',sourceKind:'structured-profile',locator:'policy.json',requiredness:'required',expectedSha256:sha(policy)}],claims:[
    {claimId:'claim:mode',sourceId:'source:policy',sourcePointer:{kind:'json-pointer',pointer:'/mode'},ruleKey:'engineering.mode',normalizedValue:mode,operationIds:['git.branch']},
    {claimId:'claim:branch',sourceId:'source:policy',sourcePointer:{kind:'json-pointer',pointer:'/naming'},ruleKey:'git.branch.naming',normalizedValue:JSON.parse(policy).naming,operationIds:['git.branch']}
  ],resourceBindings:[]};
  mkdirSync(resolve(f.root,'.forgerail'));
  writeFileSync(resolve(f.root,'.forgerail/project-profile.json'),JSON.stringify(profile));
  const identity = {schemaVersion:'1.0',workspaceIdentityId:'workspace:test',canonicalRootLocator:f.root,boundaryClaims:[{providerId:'git',kind:'repository',identity:'repo:fixture',observedAt:'2026-10-20T00:00:00Z'}],observedAt:'2026-10-20T00:00:00Z'};
  const path = resolve(f.dir,'identity.json');writeFileSync(path,JSON.stringify(identity));
  return ['--workspace-identity',path,'--operation','git.branch','--target','local'];
}

test('CLI checks before and actual after without creating or persisting governance state', t => {
  const f=setup(t); const before=f.run(...opts(f.root,'before'));
  assert.equal(before.code,0,JSON.stringify(before.body));
  assert.equal(f.git('branch','--show-current'),'main');
  assert.equal(f.git('status','--porcelain'),'');
  const path=resolve(f.dir,'before.json');writeFileSync(path,JSON.stringify(before.body));
  f.git('switch','-c','feat/example');
  const after=f.run(...opts(f.root,'after'),'--before',path);
  assert.equal(after.code,0,JSON.stringify(after.body));
  assert.equal(after.body.valid,true);
  assert.equal(f.git('status','--porcelain'),'');
});
test('CLI rejects wrong candidate, unsupported options, missing snapshot and invalid booleans', t => {
  const f=setup(t);
  for (const args of [opts(f.root,'before').map(x=>x==='feat/example'?'codex/example':x), [...opts(f.root,'before'),'--execute','true'], opts(f.root,'after'), opts(f.root,'before').map(x=>x==='true'?'yes':x)]) {
    assert.equal(f.run(...args).code,1);
  }
  assert.equal(f.git('branch','--show-current'),'main');
});
test('CLI uses adopted policy and reports source drift without refreshing declaration', t => {
  const f=setup(t); const identity=adopt(f);
  const p=resolve(f.root,'.forgerail/project-profile.json'); const original=readFileSync(p);
  const inspected=f.run('project-profile-inspect','--workspace',f.root,...identity);
  assert.equal(inspected.code,0,JSON.stringify(inspected.body));
  assert.ok(inspected.body.engineeringMode);
  const before=f.run(...opts(f.root,'before'),...identity);
  assert.equal(before.code,0,JSON.stringify(before.body));
  const path=resolve(f.dir,'before.json');writeFileSync(path,JSON.stringify(before.body));
  f.git('switch','-c','feat/example');
  writeFileSync(resolve(f.root,'policy.json'),'{}');
  const after=f.run(...opts(f.root,'after'),...identity,'--before',path);
  assert.equal(after.code,1); assert.equal(after.body.valid,false);
  assert.deepEqual(readFileSync(p),original);
});
test('unadopted inspect exposes portable mode while malformed known key does not default', t => {
  const f=setup(t);
  assert.ok(f.run('project-profile-inspect','--workspace',f.root).body.engineeringMode);
  const identity=adopt(f,'turbo');
  const result=f.run('project-profile-inspect','--workspace',f.root,...identity);
  assert.equal(result.code,1); assert.equal(result.body.status,'invalid');
});
test('adopted branch checks require operation scope; known Markdown values cannot report ready', t => {
  const f=setup(t), identity=adopt(f);
  const unscoped=f.run(...opts(f.root,'before'),'--workspace-identity',identity[1]);
  assert.equal(unscoped.code,1);
  const path=resolve(f.root,'.forgerail/project-profile.json');
  const profile=JSON.parse(readFileSync(path));
  const text='## Policy\nEngineering effort is fast.\n';
  writeFileSync(resolve(f.root,'policy.md'),text);
  profile.sources=[{...profile.sources[0],sourceKind:'instructions',locator:'policy.md',expectedSha256:sha(text)}];
  profile.claims=[{...profile.claims[0],sourcePointer:{kind:'markdown-heading',heading:'## Policy'}}];
  writeFileSync(path,JSON.stringify(profile));
  const inspected=f.run('project-profile-inspect','--workspace',f.root,...identity);
  assert.equal(inspected.code,1);
  assert.equal(inspected.body.status,'unresolved');
  assert.equal(inspected.body.engineeringMode.status,'unresolved');
});

test('unadopted inspect exposes portable branch policy', t => {
  const f=setup(t), result=f.run('project-profile-inspect','--workspace',f.root);
  assert.equal(result.code,0);
  assert.equal(result.body.branchPolicy.source,'portable-defaults');
  assert.deepEqual(result.body.branchPolicy.prefixes.feature,['feat/']);
});
test('branch snapshots reject a changed target but accept the same target', t => {
  const f=setup(t), selectors=adopt(f);
  const before=f.run(...opts(f.root,'before'),...selectors);
  assert.equal(before.code,0);
  const path=resolve(f.dir,'before.json');writeFileSync(path,JSON.stringify(before.body));
  f.git('switch','-c','feat/example');
  assert.equal(f.run(...opts(f.root,'after'),...selectors,'--before',path).code,0);
  const changed=f.run(...opts(f.root,'after'),...selectors.map(x=>x==='local'?'other':x),'--before',path);
  assert.equal(changed.code,1);
  assert.ok(changed.body.issues.some(x=>x.code==='intent-changed'));
});
test('inspect and branch-check reject unsafe selectors without echoing them', t => {
  const f=setup(t);
  for(const value of ['npm_'+'a'.repeat(40),'x'.repeat(301),'first\nsecond']) {
    for(const selector of ['--operation','--target']) {
      const args=['--operation','git.branch','--target','local'];args[args.indexOf(selector)+1]=value;
      for(const command of [opts(f.root,'before'),['project-profile-inspect','--workspace',f.root]]) {
        const result=f.run(...command,...args);
        assert.equal(result.code,1);
        assert.equal(JSON.stringify(result.body).includes(value),false);
      }
    }
  }
  assert.equal(f.git('status','--porcelain'),'');
});

test('credential-like branch candidates never enter CLI output', t => {
  const f=setup(t);
  for(const branch of ['npm_'+'a'.repeat(40),'feat/ghp_'+'b'.repeat(40)]) {
    const result=f.run(...opts(f.root,'before').map(x=>x==='feat/example'?branch:x));
    assert.equal(result.code,1);
    assert.equal(JSON.stringify(result.body).includes(branch),false);
  }
  assert.equal(f.git('status','--porcelain'),'');
});
test('inspect is ready when higher precedence fully covers lower conflicts', t => {
  const f=setup(t), selectors=adopt(f);
  const path=resolve(f.root,'.forgerail/project-profile.json'), p=JSON.parse(readFileSync(path));
  const lower=JSON.stringify({mode:'strict'}), higher=JSON.stringify({mode:'balanced'});
  writeFileSync(resolve(f.root,'lower.json'),lower);writeFileSync(resolve(f.root,'higher.json'),higher);
  p.sources.push({sourceId:'source:lower',sourceKind:'structured-profile',locator:'lower.json',requiredness:'required',expectedSha256:sha(lower)},
    {sourceId:'source:higher',sourceKind:'instructions',locator:'higher.json',requiredness:'required',expectedSha256:sha(higher)});
  p.claims.push({...p.claims[0],claimId:'claim:lower',sourceId:'source:lower',normalizedValue:'strict'},
    {...p.claims[0],claimId:'claim:higher',sourceId:'source:higher',normalizedValue:'balanced'});
  writeFileSync(path,JSON.stringify(p));
  const result=f.run('project-profile-inspect','--workspace',f.root,...selectors);
  assert.equal(result.code,0,JSON.stringify(result.body));
  assert.equal(result.body.status,'ready');
  assert.equal(result.body.engineeringMode.mode,'balanced');
  assert.ok(result.body.profile.conflicts.length>0);
  p.claims=p.claims.filter(x=>x.claimId!=='claim:higher');p.sources=p.sources.filter(x=>x.sourceId!=='source:higher');
  writeFileSync(path,JSON.stringify(p));
  assert.equal(f.run('project-profile-inspect','--workspace',f.root,...selectors).code,1);
});

test('before snapshot loader does not echo paths or malformed contents', t => {
  const f=setup(t), sentinel='ghp_'+'z'.repeat(40), path=resolve(f.dir,'malformed.json');
  writeFileSync(path,sentinel);
  for(const before of [resolve(f.dir,sentinel),path]) {
    const result=f.run(...opts(f.root,'after'),'--before',before);
    assert.equal(result.code,1);
    assert.equal(JSON.stringify(result.body).includes(sentinel),false);
    assert.equal(JSON.stringify(result.body).includes(before),false);
  }
});

test('credential-like task types never enter CLI output', t => {
  const f=setup(t), sentinel='npm_'+'z'.repeat(40);
  const args=opts(f.root,'before');
  args[args.indexOf('--task-type')+1]=sentinel;
  const result=f.run(...args);
  assert.equal(result.code,1);
  assert.equal(JSON.stringify(result.body).includes(sentinel),false);
  assert.equal(f.git('status','--porcelain'),'');
});
