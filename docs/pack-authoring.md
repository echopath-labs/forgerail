# Capability Pack Authoring

A pack must provide a manifest that validates against `contracts/capability-pack.schema.json` and declare purpose, triggers, inputs, dependencies, conflicts, risk, approvals, validation, and receipt extensions.

Use an independent Skill inside the main Plugin only when context cost, authentication, risk, and release cadence remain coupled to Core. Use a separately distributed Plugin for high-risk remote operations or independent authentication.

Never interpret installation as enablement. Recommendations remain candidates; durable `enabled` or `required` state needs project authority or user confirmation.

The optional CLI composes a separately distributed pack only when its exact manifest is supplied:

```bash
forgerail resolve-profile \
  --file profile-input.json \
  --pack-manifest /path/to/pack.json
```

The manifest is validated before composition. Missing dependencies, declared conflicts, duplicate capability owners, or enabled packs without a supplied manifest fail closed.
