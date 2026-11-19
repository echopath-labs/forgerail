// Test-only transport. Never allow candidate tests to contact the hosted collector.
import { request as httpRequest } from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';

const preload = `import { installLoopbackTransport } from ${JSON.stringify(import.meta.url)}; installLoopbackTransport();`;
const preloadOption = `--import=data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`;

export function telemetryTestEnv(configDir, loopbackOrigin) {
  const env = { ...process.env, XDG_CONFIG_HOME: configDir };
  for (const key of [
    'FORGERAIL_TELEMETRY', 'FORGERAIL_TELEMETRY_ENDPOINT', 'FORGERAIL_TELEMETRY_PROJECT_TOKEN',
    'FORGERAIL_COLLECTOR_PROJECT_TOKEN', 'DO_NOT_TRACK', 'CI', 'NODE_OPTIONS',
    'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED',
  ]) delete env[key];
  return { ...env, NODE_OPTIONS: preloadOption, FORGERAIL_TEST_COLLECTOR: loopbackOrigin };
}

export function installLoopbackTransport() {
  const loopback = new URL(process.env.FORGERAIL_TEST_COLLECTOR);
  if (loopback.hostname !== '127.0.0.1' || !loopback.port
    || !['http:', 'https:'].includes(loopback.protocol)) {
    throw new Error('Telemetry tests require an explicit loopback collector');
  }

  const realRequest = https.request;
  https.request = (url, options, callback) => {
    const destination = new URL(url);
    if (destination.href !== 'https://telemetry.janus-path.com/v1/telemetry') {
      throw new Error('Unexpected telemetry destination');
    }
    if (loopback.protocol === 'http:') {
      return httpRequest(new URL(destination.pathname, loopback), { ...options, lookup: undefined }, callback);
    }
    // Preserve the production hostname and certificate validation. Only the
    // socket address and port differ when using the loopback TLS fixture.
    return realRequest(url, {
      ...options,
      port: Number(loopback.port),
      lookup(_hostname, _options, done) {
        done(null, '127.0.0.1', 4);
      },
    }, callback);
  };
  syncBuiltinESMExports();
}
