# Effective Profile Resolution

Treat the Profile as a computed model before treating it as a file.

For each effective rule, retain:

- rule identity;
- source type and locator;
- precedence class;
- observation point;
- whether it is observed, inferred, confirmed, or a default;
- owning Capability Pack when applicable.

Do not create `.forgerail/`, edit `AGENTS.md`, or initialize a record system merely to materialize the Profile. When a reusable rule deserves persistence, present a candidate, the proposed owner/source, evidence, effect, and rollback. Obtain confirmation only if existing authorization does not already cover recording that decision and scope.


## Action-scoped conflict preflight

Use this same check across capabilities, including Git, review, validation,
delegation, upgrades and release. The Host Agent inspects and acts; ForgeRail
provides guidance, not a configuration editor or enforcement runtime.

Before the first consequential action, compare only the visible rules relevant
to that action. Recheck when their source, scope, conditions or the intended
action materially changes. Do not rescan the workspace or ask for approval at
every step. Do not claim access to hidden host instructions or settings; missing
visibility is uncertainty, not proof that no restriction exists. Do not expose
protected instruction text or secrets when explaining a constraint.

- If rules agree, or precedence resolves a difference without preventing the
  requested outcome, continue within existing authorization.
- Reuse an explicit user decision while its scope and conditions still apply.
  Do not ask again simply because another capability or task step uses it.
- When a visible host default explicitly allows user override, apply an already
  supplied user choice. If a choice is still needed, explain the default and
  recommend a concrete option; do not label a default a mandatory restriction.
- For an unresolved conflict that affects the next action, explain the relevant
  source (where disclosable), practical effect, recommended option and whether a
  user choice can resolve it. Pause only the affected action and continue
  independent authorized work. Ask one concrete decision, not a generic request
  to continue.
- For a non-overridable restriction, explain the limit and feasible alternatives.
  A user may change an accessible host setting themselves, but do not claim the
  restriction is removed until current evidence supports that conclusion.
  Never suggest that approval alone bypasses host controls.

Record a necessary decision in existing authorized project records with its
scope, relevant sources, conditions and any unresolved limitation. Session-only
choices remain session-only unless persistence is authorized; do not silently
turn one example into a project-wide policy. No new receipt schema, personal
state layer or `.forgerail/` governance file is required.

For example, a host default of `codex/` that permits user choice can yield to an
explicit request for `feat/` for new features. Keep a suitable existing branch.
A mandatory host review requirement cannot be skipped merely because the user
wants faster progress; explain that restriction and the available compliant path.
