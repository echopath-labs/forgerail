# Closure Checklist

Verify:

- owner workspace, task goal, approval boundary, and exact output;
- allowed/prohibited operations and any deviation;
- modified files and current Git branch, status, commit and remote state where applicable;
- requested validation and impact checks, including failures and known warnings;
- external receipts and the absence of unauthorized mutations;
- rollback or safe recovery entry;
- existing durable-record convention and whether a write is actually needed;
- Profile, backlog, decision, risk and context-debt candidates with provenance;
- exact approval before durable writeback, lifecycle change, archive, deletion, release or remote mutation.

Do not declare complete merely because implementation stopped. Missing required evidence keeps closure incomplete.
