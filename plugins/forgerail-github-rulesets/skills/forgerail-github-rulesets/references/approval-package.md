# GitHub Ruleset Approval Package

Include:

- repository owner/name and repository id when available;
- authenticated GitHub identity and permission level;
- current default branch and protected target patterns;
- current Ruleset ids, names, enforcement, conditions, rules, bypass actors, and required checks with app ids;
- exact desired additions, edits, or deletions;
- allowed and prohibited remote operations;
- expected impact on existing PRs, bots, admins, releases, and emergency recovery;
- post-mutation readback and negative validation;
- rollback as a second explicit mutation, never an unbounded delete;
- durable receipt fields and links.

If current state or identity cannot be read reliably, report the blocker and do not prepare an executable mutation plan.
