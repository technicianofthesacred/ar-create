# Installed-home lifecycle source templates

Read [the permanent-home contract](../../docs/PERMANENT-HOME.md) before using these files. They are reproducible generic source, not a migration command or installer. Normal repository candidates continue to use root `serve.mjs`/`config.mjs` and refuse installed port8841.

Under separate explicit installed-home authority, the sole integrator places `serve.mjs` at `<home>/service/serve.mjs` beside runtime/public, and Python templates at `<home>/`. Keep the existing private configuration, exact relocation capability and saved work outside source. Never copy an installed public/data tree into Git or activate these templates over the current installation as part of a source update.

Start requires an existing explicit `<home>/config/local.json`, preserves any8841 listener, strips inherited credentials, detaches its exact child and persists status/logs. Select Node22+ with absolute `AR_CREATE_NODE` or the current `node` executable. New status records the exact Node/service process identity; stop/restart refuse missing or mismatched identity instead of killing another process. An older status record without the executable field needs integrator reconciliation; do not infer or kill it. No force kill or automatic retry.

The installed service template checks exact home/public/data layout and loopback scope, then passes private originals and relocation proof only through constructor options. It does not widen candidate port authority, expose a relocation HTTP route or authorize private uploads. These source templates were syntax-checked; they were not activated against the running app.
