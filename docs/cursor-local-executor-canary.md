# Cursor Local Executor Canary — retired

The experimental executor shipped through 0.1.2 has been removed from the next source candidate. Its CLI, runtime, dedicated schemas and tests are no longer included. Historical releases remain unchanged; this page preserves the old documentation URL.

Cursor instruction/rules binding remains `profile-only`. Execution, timeout, cancel and resume belong to the host or a separately supported delegation tool such as RelayPact; no automatic migration or RelayPact dependency is introduced. See [product boundaries](product-boundary.md).
