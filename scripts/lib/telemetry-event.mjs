// Wire contract shared by the CLI and the private collector prototype.
export const telemetryPrototypePort = 43187;
export const telemetryPath = '/v1/telemetry';
export const maxTelemetryBodyBytes = 512;

const commands = new Set([
  'init', 'update', 'doctor', 'remove', 'recover',
  'project-profile-set', 'project-profile-remove', 'project-profile-inspect',
  'branch-check', 'validate', 'validate-fixtures', 'validate-fixture-matrix',
  'validate-adoption', 'validate-contract', 'diagnose', 'adoption-plan',
  'resolve-profile', 'launch', 'verify-receipt', 'outcome-gate',
]);
const versionPattern = /^\d{1,8}\.\d{1,8}\.\d{1,8}(?:-[a-z0-9.-]{1,32})?$/;

export function isTelemetryEvent(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 3
    && ['command', 'version', 'result'].every(key => Object.hasOwn(value, key))
    && commands.has(value.command)
    && typeof value.version === 'string' && versionPattern.test(value.version)
    && (value.result === 'success' || value.result === 'failure');
}
