# ForgeRail 0.1.0-alpha.4 release notes candidate

ForgeRail alpha.4 is an integrity-focused forward fix for real project use. It makes contract, Profile, Pack, Launch, Receipt, Adoption, projection, Shadow and cross-workspace orchestration boundaries fail closed when input is malformed, duplicated, inconsistent or outside the declared workspace.

The release adds deterministic regression coverage and complete Node.js 22 and 24 CI gates. It preserves the public product shape: four independently invokable Skills, a maximum of three starter prompts, Skills-only Marketplace installation, optional scoped npm CLI, no project `package.json` or `node_modules` requirement, no implicit `.forgerail/` state, and Apache-2.0.

Some previously tolerated invalid inputs are intentionally rejected. Valid alpha.3 contracts remain supported; full v2 receipt lineage, cross-platform CI expansion, SBOM/OIDC provenance and other architectural improvements remain future work. Directory submission, release and lifecycle approvals stay independent and are not granted by this candidate.
