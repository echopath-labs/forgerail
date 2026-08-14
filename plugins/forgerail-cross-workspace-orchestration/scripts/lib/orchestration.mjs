const externalApprovalByOperation = new Map([
  ["push", "remote-integration-approval"],
  ["draft-pr", "remote-integration-approval"],
  ["remote-ci", "remote-integration-approval"],
  ["merge", "release-approval"],
  ["tag", "release-approval"],
  ["publish", "release-approval"],
  ["release", "release-approval"],
  ["lifecycle-change", "lifecycle-change-approval"],
  ["archive", "lifecycle-change-approval"],
  ["repository-transfer", "lifecycle-change-approval"],
]);

function descendants(items, roots) {
  const paused = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (!paused.has(item.id) && item.dependencies.some((id) => paused.has(id))) {
        paused.add(item.id);
        changed = true;
      }
    }
  }
  return paused;
}

function writerIdentities(item) {
  return [
    `${item.repository}:branch:${item.branch}`,
    ...(item.pr === null ? [] : [`${item.repository}:pr:${item.pr}`]),
    ...(item.releaseIdentity === null ? [] : [`release:${item.releaseIdentity}`]),
    ...item.aggregateWrites.map((identity) => `aggregate:${identity}`),
  ];
}

function dependsOn(itemsById, itemId, targetId, seen = new Set()) {
  if (seen.has(itemId)) return false;
  seen.add(itemId);
  const item = itemsById.get(itemId);
  if (!item) return false;
  if (item.dependencies.includes(targetId)) return true;
  return item.dependencies.some((dependency) => dependsOn(itemsById, dependency, targetId, seen));
}

function independentBoundaryCount(items) {
  return new Set(items.map((item) => `${item.ownerWorkspace}\u0000${item.repository}\u0000${item.releaseIdentity ?? ""}`)).size;
}

function buildWaves(items, blocked) {
  const remaining = new Map(items.filter((item) => !blocked.has(item.id) && item.status !== "accepted").map((item) => [item.id, item]));
  const accepted = new Set(items.filter((item) => item.status === "accepted").map((item) => item.id));
  const waves = [];
  while (remaining.size > 0) {
    const wave = [];
    const usedWriters = new Set();
    for (const item of [...remaining.values()].sort((left, right) => left.id.localeCompare(right.id))) {
      if (!item.dependencies.every((id) => accepted.has(id))) continue;
      const identities = writerIdentities(item);
      if (identities.some((identity) => usedWriters.has(identity))) continue;
      wave.push(item.id);
      identities.forEach((identity) => usedWriters.add(identity));
    }
    if (wave.length === 0) break;
    waves.push(wave);
    wave.forEach((id) => {
      accepted.add(id);
      remaining.delete(id);
    });
  }
  return { waves, unresolved: [...remaining.keys()].sort() };
}

export function evaluateOrchestration(input) {
  const conflicts = [];
  const itemsById = new Map(input.workItems.map((item) => [item.id, item]));
  const writerOwners = new Map();
  for (const item of input.workItems) {
    for (const identity of writerIdentities(item)) {
      const priors = writerOwners.get(identity) ?? [];
      for (const prior of priors) {
        const ordered = !identity.startsWith("aggregate:") && (dependsOn(itemsById, item.id, prior) || dependsOn(itemsById, prior, item.id));
        if (!ordered) conflicts.push({ identity, workItems: [prior, item.id].sort() });
      }
      priors.push(item.id);
      writerOwners.set(identity, priors);
    }
  }

  const missingApprovals = [];
  for (const item of input.workItems) {
    const granted = new Set(item.grantedApprovals);
    for (const operation of item.requestedOperations) {
      const required = externalApprovalByOperation.get(operation);
      if (required && !granted.has(required)) missingApprovals.push({ workItem: item.id, operation, required });
    }
  }

  const failed = new Set(input.events.failedWorkItems);
  const paused = descendants(input.workItems, failed);
  const accepted = new Set(input.events.acceptedWorkItems);
  const preservedAccepted = [...accepted].filter((id) => !paused.has(id)).sort();
  const blocked = new Set([
    ...paused,
    ...conflicts.flatMap(({ workItems }) => workItems),
    ...missingApprovals.map(({ workItem }) => workItem),
  ]);
  const scheduling = buildWaves(input.workItems, blocked);

  const hostCapabilities = ["create", "inspect", "wait", "message", "resume"];
  const missingHostCapabilities = hostCapabilities.filter((name) => input.hostAdapter[name] !== true);
  const hostMode = missingHostCapabilities.length === 0 ? "native-coordination" : "manual-handoff-or-serial";
  const distinctBoundaries = independentBoundaryCount(input.workItems);
  const parallelWave = scheduling.waves.some((wave) => wave.length > 1);
  const recommended = distinctBoundaries >= 2 && conflicts.length === 0 && parallelWave;

  return {
    recommended,
    reason: distinctBoundaries < 2
      ? "independent-owner-boundaries-not-proven"
      : conflicts.length > 0
        ? "writer-conflict"
        : parallelWave
          ? "independent-cross-workspace-wave"
          : "no-safe-parallel-wave",
    waves: scheduling.waves,
    unresolved: scheduling.unresolved,
    writerConflicts: conflicts,
    missingApprovals,
    paused: [...paused].sort(),
    preservedAccepted,
    hostMode,
    missingHostCapabilities,
    recordStrategy: input.recordStrategy,
    proposedDurableWrites: [],
    relayPactRequired: false,
    transportMode: input.relayPact.available ? "relaypact-optional" : "host-or-manual",
    mutations: [],
  };
}
