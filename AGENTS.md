# AR Create development

Read [CLAUDE-DEVELOPMENT.md](CLAUDE-DEVELOPMENT.md) for the source map, synthetic setup and preserved behavior before editing the application. Read the relevant [living section brief](docs/sections/README.md) before changing a section's intent or interaction; requirements are not implementation proof.

- This is the canonical code repository. i64 OS remains the host/launcher integration; its previous package is preserved until a verified transition.
- Keep private content/configuration outside Git and outside this checkout. Use synthetic fixtures for development. Never import live user-data, recordings, transcripts, manuscripts, photographs, source captures, saved request/decision histories, credentials, backups or private reference samples/provenance.
- Preserve the current Document Study interface, stage-specific tools, sans-serif Draft, project/part identities, direct edits, revision guards and exact saved Undo. No editor-engine replacement or competing manuscript authority.
- The existing integrator alone owns live shared wiring/activation. Work here is isolated unless an explicit live transition is approved; never start candidates on installed port 8841 or relocate its private data implicitly.
- Before a functional change, name its concrete verification. Run focused affected tests and a synthetic native screen/file journey; avoid repeated unchanged full suites. Use `npm run verify:package` for changes to included files and refresh only reviewed manifest entries.
- Runtime and `mcp/study` use separate locks. Preserve the bounded dependency repair; report residual audit findings without silently performing broad upgrades or provider/account setup.
- GitHub source delivery is distinct from runtime cutover, main integration and public/private-content deployment. Keep preservation and remote revision proof explicit.
