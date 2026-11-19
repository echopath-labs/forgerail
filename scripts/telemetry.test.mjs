import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { telemetryTestEnv } from './telemetry-test-support.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runFile = promisify(execFile);
const tlsDir = process.env.FORGERAIL_TEST_TLS_DIRECTORY;
const certificate = tlsDir && join(tlsDir, 'cert.pem');
const createServer = tlsDir
  ? handler => createHttpsServer({ key: readFileSync(join(tlsDir, 'key.pem')), cert: readFileSync(certificate) }, handler)
  : createHttpServer;

async function fixture(t, handle = (_request, reply) => reply.writeHead(204).end()) {
  const dir = mkdtempSync(join(tmpdir(), 'forgerail-telemetry-'));
  const received = [];
  const server = createServer(async (request, reply) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({ route: request.url, payload: JSON.parse(Buffer.concat(chunks)), headers: request.headers });
    handle(request, reply);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    rmSync(dir, { force: true, recursive: true });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const scheme = tlsDir ? 'https' : 'http';
  const env = telemetryTestEnv(dir, `${scheme}://127.0.0.1:${server.address().port}`);
  if (certificate) env.NODE_EXTRA_CA_CERTS = certificate;

  async function cli(args, overrides = {}, input) {
    let child;
    const pending = runFile(process.execPath, ['scripts/forgerail.mjs', ...args], {
      cwd: root, env: { ...env, ...overrides }, timeout: 6_000,
    });
    child = pending.child;
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    try {
      const { stdout, stderr } = await pending;
      return { status: 0, stdout, stderr };
    } catch (error) {
      if (typeof error.code !== 'number') throw error;
      return { status: error.code, stdout: error.stdout, stderr: error.stderr };
    }
  }
  return { received, cli, dir, server };
}

test('default off, opt-in without configuration, then DNT / CI / disable send zero', async t => {
  const { cli, received, dir } = await fixture(t);
  assert.equal(JSON.parse((await cli(['telemetry', 'status'])).stdout).enabled, false);
  assert.equal((await cli(['validate'])).status, 0);
  assert.equal(received.length, 0);
  assert.deepEqual(readdirSync(dir), []);
  assert.equal(JSON.parse((await cli(['telemetry', 'enable'])).stdout).enabled, true);
  assert.equal(received.length, 0);
  assert.equal((await cli(['validate'])).status, 0);
  assert.equal(received.length, 1);
  const event = received[0];
  assert.equal(event.route, '/v1/telemetry');
  assert.deepEqual(event.payload, { command: 'validate', version: '0.1.14', result: 'success' });
  assert.equal(event.headers.authorization, undefined);
  await cli(['validate'], { DO_NOT_TRACK: '1', FORGERAIL_TELEMETRY: '1' });
  await cli(['validate'], { CI: 'true', FORGERAIL_TELEMETRY: '1' });
  await cli(['validate'], { FORGERAIL_TELEMETRY: '0' });
  assert.equal(JSON.parse((await cli(['telemetry', 'disable'])).stdout).enabled, false);
  await cli(['validate']);
  assert.equal(received.length, 1);
});

test('a known failed command sends only failure metadata and an unknown command sends nothing', async t => {
  const { cli, received } = await fixture(t);
  await cli(['telemetry', 'enable']);
  const result = await cli(['validate-fixtures', '--scope', 'private-example-value']);
  assert.equal(result.status, 1);
  assert.deepEqual(received[0].payload, { command: 'validate-fixtures', version: '0.1.14', result: 'failure' });
  const unknown = await cli(['private-unknown-command']);
  assert.equal(unknown.status, 1);
  assert.equal(received.length, 1);
});

test('Outcome Gate and Profile keep their local output and emit only command completion', async t => {
  const { cli, received, dir } = await fixture(t);
  await cli(['telemetry', 'enable']);
  const gate = await cli(['outcome-gate'], {}, 'private-invalid-input\n{"action":"capture","workspace":"/missing/private-workspace"}\n');
  assert.equal(gate.status, 0);
  const rows = gate.stdout.trim().split('\n').map(JSON.parse);
  assert.deepEqual(rows.map(row => row.status), ['UNVERIFIED', 'UNVERIFIED']);
  const profile = await cli(['project-profile-inspect', '--workspace', dir]);
  assert.equal(JSON.parse(profile.stdout).status, 'not-adopted');
  assert.deepEqual(received.map(entry => entry.payload), [
    { command: 'outcome-gate', version: '0.1.14', result: 'success' },
    { command: 'project-profile-inspect', version: '0.1.14', result: 'success' },
  ]);
});

test('collector refusal and hung response do not change output or exit status', async t => {
  const { cli, received, server } = await fixture(t, () => {});
  const args = ['validate-fixtures', '--scope', 'invalid'];
  const baseline = await cli(args);
  const start = performance.now();
  assert.deepEqual(await cli(args, { FORGERAIL_TELEMETRY: '1' }), baseline);
  assert.equal(received.length, 1);
  assert.ok(performance.now() - start < 4500);
  await new Promise(resolve => server.close(resolve));
  assert.deepEqual(await cli(args, { FORGERAIL_TELEMETRY: '1' }), baseline);
});

test('429 and redirects preserve the original command result without retrying', async t => {
  let status = 429;
  const { cli, received } = await fixture(t, (_request, reply) =>
    reply.writeHead(status, { Location: '/redirect-target' }).end('ignored'));
  const args = ['validate-fixtures', '--scope', 'invalid'];
  const baseline = await cli(args);
  for (const response of [429, 307]) {
    status = response;
    assert.deepEqual(await cli(args, { FORGERAIL_TELEMETRY: '1' }), baseline);
  }
  assert.deepEqual(received.map(entry => entry.route), ['/v1/telemetry', '/v1/telemetry']);
});

test('HTTPS rejects an untrusted certificate before any event is sent', { skip: !certificate }, async t => {
  const { cli, received } = await fixture(t);
  const args = ['validate'];
  assert.deepEqual(
    await cli(args, { FORGERAIL_TELEMETRY: '1', NODE_EXTRA_CA_CERTS: '' }),
    await cli(args),
  );
  assert.equal(received.length, 0);
});
