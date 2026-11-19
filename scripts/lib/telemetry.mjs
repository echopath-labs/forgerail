// Optional CLI-only telemetry sent to the ForgeRail HTTPS collector.
import { Resolver } from 'node:dns';
import { request } from 'node:https';
import { constants, openSync, closeSync, fstatSync, ftruncateSync, readFileSync, readSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { isTelemetryEvent, telemetryPath } from './telemetry-event.mjs';

const telemetryCollector = `https://telemetry.janus-path.com${telemetryPath}`;
const requestDeadlineMs = 2_000;

const configPath = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'forgerail', 'telemetry.json');
function preference() {
  if (process.env.FORGERAIL_TELEMETRY !== undefined) return process.env.FORGERAIL_TELEMETRY === '1';
  let fd;
  try {
    fd = openSync(configPath(), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    const limit = 1024;
    if (!stat.isFile() || stat.size > limit) return false;
    const buffer = Buffer.alloc(limit + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const count = readSync(fd, buffer, bytes, buffer.length - bytes, null);
      if (count === 0) break;
      bytes += count;
    }
    return bytes <= limit && JSON.parse(buffer.toString('utf8', 0, bytes))?.enabled === true;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function telemetryStatus() {
  const optedIn = preference();
  let reason = optedIn ? 'enabled' : 'disabled';
  if (process.env.CI && !['0', 'false'].includes(process.env.CI)) reason = 'ci';
  if (process.env.DO_NOT_TRACK && process.env.DO_NOT_TRACK !== '0') reason = 'do-not-track';
  return { enabled: reason === 'enabled', preference: optedIn ? 'enabled' : 'disabled', reason, default: 'disabled' };
}

export function setTelemetry(enabled) {
  const path=configPath();mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);
  try {if(!fstatSync(fd).isFile() || fstatSync(fd).nlink!==1)throw Error('Invalid telemetry settings');ftruncateSync(fd,0);writeFileSync(fd,JSON.stringify({enabled})+'\n');} finally {closeSync(fd);}
  return telemetryStatus();
}

function send(body) {
  return new Promise(resolve => {
    const resolver = new Resolver();
    let requestHandle;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      resolver.cancel();
      resolve();
    };
    const deadline = setTimeout(() => {
      requestHandle?.destroy();
      finish();
    }, requestDeadlineMs);
    try {
      requestHandle = request(telemetryCollector, {
        method: 'POST',
        agent: false,
        family: 4,
        rejectUnauthorized: true,
        lookup(host, _options, callback) {
          resolver.resolve4(host, (error, addresses) => {
            if (error) return callback(error);
            callback(null, addresses[0], 4);
          });
        },
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, response => {
        response.destroy();
        requestHandle.destroy();
        finish();
      });
      requestHandle.on('error', finish);
      requestHandle.end(body);
    } catch {
      requestHandle?.destroy();
      finish();
    }
  });
}

let attempted = false;
export async function sendCommandFinished(command, exitCode) {
  try {
    if (attempted || !telemetryStatus().enabled) return;
    const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    const event = { command, version, result: exitCode === 0 ? 'success' : 'failure' };
    if (!isTelemetryEvent(event)) return;
    attempted = true;
    await send(JSON.stringify(event));
  } catch {
    // Settings and delivery failures have no effect on the command result.
  }
}
