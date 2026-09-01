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
const knownOperations = new Set(externalApprovalByOperation.keys());
const knownStatuses = new Set(["pending", "accepted", "failed"]);

function duplicates(values) {
  const seen = new Set();
  const result = new Set();
  for (const value of values) {
    if (seen.has(value)) result.add(value);
    seen.add(value);
  }
  return [...result].sort();
}

function assertInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("orchestration input must be an object");
  if (!Array.isArray(input.workItems)) throw new Error("orchestration workItems must be an array");
  const duplicateItems = duplicates(input.workItems.map((item) => item?.id));
  if (duplicateItems.length > 0) throw new Error(`duplicate work item ids: ${duplicateItems.join(", ")}`);
  const itemIds = new Set(input.workItems.map((item) => item?.id));
  for (const item of input.workItems) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") throw new Error("orchestration work item is malformed");
    for (const key of ["ownerWorkspace", "repository", "branch", "status"]) if (typeof item[key] !== "string") throw new Error(`work item ${key} must be a string: ${item.id}`);
    if (!knownStatuses.has(item.status)) throw new Error(`unknown work item status for ${item.id}: ${item.status}`);
    for (const key of ["aggregateWrites", "dependencies", "grantedApprovals"]) if (!Array.isArray(item[key])) throw new Error(`${key} must be an array: ${item.id}`);
    for (const key of ["aggregateWrites", "dependencies", "grantedApprovals"]) {
      const repeated = duplicates(item[key]);
      if (repeated.length > 0) throw new Error(`duplicate ${key} for ${item.id}: ${repeated.join(", ")}`);
    }
    const unknownDependencies = item.dependencies.filter((dependency) => !itemIds.has(dependency));
    if (unknownDependencies.length > 0) throw new Error(`unknown dependencies for ${item.id}: ${unknownDependencies.join(", ")}`);
    if (item.dependencies.includes(item.id)) throw new Error(`work item cannot depend on itself: ${item.id}`);
    if (!Array.isArray(item.requestedOperations)) throw new Error(`requestedOperations must be an array: ${item.id}`);
    const duplicateOperations = duplicates(item.requestedOperations);
    if (duplicateOperations.length > 0) throw new Error(`duplicate requested operations for ${item.id}: ${duplicateOperations.join(", ")}`);
    const unknownOperations = item.requestedOperations.filter((operation) => !knownOperations.has(operation));
    if (unknownOperations.length > 0) throw new Error(`unknown requested operations for ${item.id}: ${unknownOperations.join(", ")}`);
  }
  if (!input.events || !Array.isArray(input.events.failedWorkItems) || !Array.isArray(input.events.acceptedWorkItems)) throw new Error("orchestration events are malformed");
  for (const [eventName, ids] of Object.entries(input.events)) {
    const repeated = duplicates(ids);
    if (repeated.length > 0) throw new Error(`duplicate ${eventName} events: ${repeated.join(", ")}`);
  }
  const eventIds = [...input.events.failedWorkItems, ...input.events.acceptedWorkItems];
  const unknownEventIds = eventIds.filter((id) => !itemIds.has(id));
  if (unknownEventIds.length > 0) throw new Error(`orchestration events reference unknown work items: ${[...new Set(unknownEventIds)].sort().join(", ")}`);
  const conflictingEventIds = input.events.failedWorkItems.filter((id) => input.events.acceptedWorkItems.includes(id));
  if (conflictingEventIds.length > 0) throw new Error(`work items cannot be both failed and accepted: ${[...new Set(conflictingEventIds)].sort().join(", ")}`);
  for (const id of input.events.failedWorkItems) if (input.workItems.find((item) => item.id === id)?.status !== "failed") throw new Error(`failed event conflicts with work item status: ${id}`);
  for (const id of input.events.acceptedWorkItems) if (input.workItems.find((item) => item.id === id)?.status !== "accepted") throw new Error(`accepted event conflicts with work item status: ${id}`);
  const failedEvents = new Set(input.events.failedWorkItems);
  const acceptedEvents = new Set(input.events.acceptedWorkItems);
  for (const item of input.workItems) {
    if (item.status === "failed" && !failedEvents.has(item.id)) throw new Error(`failed work item is missing its event: ${item.id}`);
    if (item.status === "accepted" && !acceptedEvents.has(item.id)) throw new Error(`accepted work item is missing its event: ${item.id}`);
  }
  if (!input.hostAdapter || typeof input.hostAdapter !== "object") throw new Error("orchestration hostAdapter is malformed");
  if (!input.relayPact || typeof input.relayPact !== "object") throw new Error("orchestration relayPact is malformed");
}

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
  assertInput(input);
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
