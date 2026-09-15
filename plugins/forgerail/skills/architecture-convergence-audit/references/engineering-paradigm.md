# Engineering Paradigm Guidance

Use when asked to plan an engineering structure, assess a refactor, or review
bounded architectural drift. Help people and Agents locate, change, verify and
hand off work with less unnecessary context. This is an optional method, not a
universal architecture standard or permission to reorganize a repository.

## Start with the project

Identify the requested outcome, applicable owner, current implementation and
accepted architecture choices in existing project records. Link the relevant
sources rather than introducing a new architecture registry. Distinguish an
accepted decision from a proposal, a repeated convention and an inference.
If sources conflict, identify the decision needed; do not choose a convenient
baseline or silently accept the observed implementation.

Use only the considerations relevant to the task:

- **Organize around change.** Group behavior that changes together and protects
  the same invariants. Use business meaning, consistency and lifecycle to judge
  boundaries. A technical module is not automatically a domain bounded context,
  service, repository or database. Preserve the project's chosen terminology.
- **Make entrypoints clear.** Expose understandable public operations and keep
  consumers out of private implementation. Small modules can remain a single
  package. Add internal layers only for a demonstrated isolation or complexity
  need; preserve useful authorization, transaction and failure boundaries.
- **Reuse capabilities.** Check existing framework/library and product owners
  before adding wrappers or shared services. Extract shared code only for real
  common semantics. Similar business code need not have a common owner. Avoid
  duplicate editable models, empty interfaces and forwarding-only layers.
- **Keep navigation short.** The project entry should lead to the relevant
  module, accepted business sources, current change, implementation and checks.
  Existing README, ADR, specification and build files can supply this path.
  Do not require a new README per directory or duplicate facts across tools.
- **Make checks meaningful.** Reuse native build, tests, export/import controls
  and existing CI. Relate each claimed boundary to what those checks prove.
  Direct-import checks do not prove runtime isolation, and a proposed check is
  not an executed check. Missing coverage is a stated limit, not a reason to
  construct a universal checking engine.

Language and framework determine the technical mapping. Assess responsibilities
and behavior rather than requiring `contexts/`, `module.*`, a fixed layer count,
a generator, or a particular validation command. Existing effective structures
can satisfy the method without being renamed. Do not claim efficiency or token
savings without observations from comparable tasks.

## Choose the requested mode

**Planning:** propose the smallest structure that makes a real task locatable,
modifiable and verifiable. Identify public entrypoints, existing capabilities
to reuse, relevant consumers and native checks. Keep unconfirmed business
boundaries as proposals. Match the design to the project's scale; a small tool
may need only a clear entry and a test command.

**Refactor assessment:** trace an actual cost or failure, such as a use case
scattered across unrelated owners or duplicated models drifting apart. Explain
why a structural change helps and what behavior and failure handling must remain.
Recommend bounded, useful slices with checks and recovery. A no-change decision
is valid; folder consistency alone does not justify a migration. When duplication
is involved, reuse the ownership and retention analysis in
[audit-contract.md](audit-contract.md).

**Drift review:** compare a bounded part of the implementation against the
project's accepted choices, including any confirmed amendments. Distinguish:

- unintentional divergence, with the affected agreement and observed impact;
- confirmed evolution, which may require updating stale navigation;
- a prior choice that appears unsuitable, requiring an owner decision before
  changing it;
- insufficient or conflicting evidence, with the smallest unresolved question.

Without an accepted baseline, return an initial assessment and proposed choices,
not a drift verdict. An additional layer introduced for a confirmed transaction
boundary is not drift merely because another module has fewer layers. A check
that passes does not resolve an unexamined ownership or business-boundary issue.

## Return a proportionate result

State the scope and baseline, what already works, the significant observations
and their evidence, and the smallest useful next action (including no change).
For proposed changes, name the invariant to preserve and the relevant validation.
Separate an observed violation, a recommended improvement and an unknown.
Use the conversation or the project's existing report format; no scorecard,
mandatory JSON, new ledger or repository write is needed for this assessment.

Core retains task authorization, recording and handoff rules. Health retains
recurring workspace-wide signals; this Skill analyzes a selected architectural
question. Actual refactoring, rule adoption or tool installation proceeds through
the project's existing authorized change workflow, outside this read-only audit.
