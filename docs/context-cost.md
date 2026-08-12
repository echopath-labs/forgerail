# Context Cost And Progressive Loading

ForgeRail's default task entry is `skills/forgerail/SKILL.md`. Workspace Diagnosis and Workspace Health are separate Skills and do not load merely because the main Plugin is installed.

At the first alpha implementation point:

- Core `SKILL.md`: measured from the canonical file during validation;
- Workspace Diagnosis `SKILL.md`: separate entry, loaded for first-use, explicit, drift, or conflict diagnosis;
- Workspace Health `SKILL.md`: installed as `available` and independently invoked or enabled;
- Core references load only for Task Envelope/Receipt or Profile conflict work;
- external GitHub Rulesets, Release Safety, and Thread Closure packs are absent from the main runtime payload and use separate, non-implicit Skill entrypoints.

The fixture `profile-input.available-pack.json` proves that an installed Workspace Health pack in `available` state does not enter `activePacks`. The inactive-pack Launch fixture proves a task cannot request that pack until it is enabled or required.
