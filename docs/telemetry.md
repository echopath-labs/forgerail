# CLI telemetry

CLI telemetry is **off by default**. After you enable it, the CLI sends events
over HTTPS to the ForgeRail collector at
`https://telemetry.janus-path.com/v1/telemetry`. Enabling it requires no account,
URL or token.

```sh
forgerail telemetry status
forgerail telemetry enable
forgerail telemetry disable
```

The preference stores only an enabled boolean in
`$XDG_CONFIG_HOME/forgerail/telemetry.json` or `~/.config/forgerail/telemetry.json`.
`FORGERAIL_TELEMETRY=0` disables and `FORGERAIL_TELEMETRY=1` explicitly enables
for one process. DNT and CI can suppress either form of opt-in. Management commands
send no events. An unreadable preference leaves collection disabled.

## Event fields

A recognized CLI command sends at most one command-completion event. The JSON
body contains exactly three fields.

| Field | Values |
| --- | --- |
| `command` | Name from the fixed CLI allowlist |
| `version` | ForgeRail package version |
| `result` | `success` for exit zero, otherwise `failure` |

The collector assigns the PostHog event name `cli_command_finished` and a random
ID for each event, and disables Person Profile processing and GeoIP enrichment.
The collector adds its project token only when forwarding. Outcome Gate reports
and Profile inspection details stay local. Arguments, paths, output, duration,
and user or installation IDs are absent. Counts refer to CLI invocations.

## Delivery limits

The CLI makes one best-effort HTTPS attempt over IPv4, with a 2-second deadline
including DNS and TLS. It does not retry or follow redirects. A failed, limited,
or unavailable collector leaves command output and exit status intact.

The collector runs on Vercel and forwards to PostHog US Cloud. It does not
forward client IPs or request headers. Vercel can observe source IP and request
metadata at the connection layer. The service can miss events, so counts show
usage trends.

API reference: [PostHog Capture API](https://posthog.com/docs/api/capture).
