# Installed-home lifecycle source templates

Read [the permanent-home contract](../../docs/PERMANENT-HOME.md) before using these files. They are reproducible generic source, not a migration command or installer.

The service program is **one file for every mode**: the root `serve.mjs`. The demo, a candidate checkout and the installed home all run it. In an install it sits at `<home>/service/serve.mjs`; `scripts/release.mjs` puts it there with the rest of the reviewed source, and nothing else writes `<home>/service`. There is no separate permanent-home server template any more (it was folded into `serve.mjs` and `config.mjs`: a config that names `home` selects the installed checks).

The Python templates belong at `<home>/` and are not part of a release. Start requires an existing explicit `<home>/config/local.json`, preserves any 8841 listener, strips inherited credentials, detaches its exact child and persists status/logs. Select Node 22+ with absolute `AR_CREATE_NODE` or the current `node` executable. New status records the exact Node/service process identity; stop/restart refuse missing or mismatched identity instead of killing another process. An older status record without the executable field needs integrator reconciliation; do not infer or kill it. No force kill or automatic retry.

Start accepts any health answer that says `service: ar-create-document-study` and `ready: true`, so the health endpoint may also report the release.

`scripts/release.mjs` never starts or stops anything; it prints the restart command. Use the existing installed launcher.
