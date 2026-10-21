# The magazine page

Adrian decides and reads here: http://localhost:8766/ on this Mac, and http://100.90.156.97:8766/ from his phone (this Mac's Tailscale address; the phone needs the Tailscale app on and signed in). Nothing outside his tailnet can reach it. Vault file cards and links open blank for him, so never send those.

It starts with the Mac and restarts itself (login item `com.teajia.mag-page`, logs in `/tmp/mag-page.*.log`; it is also on i64os's Artifact Shelf under teajia). If it is somehow not running, restart it with `launchctl kickstart -k gui/$(id -u)/com.teajia.mag-page`, or start it by hand:

```bash
curl -s -o /dev/null http://127.0.0.1:8766/ || (cd ~/builds && nohup node mag-preview.mjs > /tmp/mag-preview.log 2>&1 &)
```

Run that with the sandbox off (it binds the Tailscale address and opens Finder). Its saves go through AR Create on this Mac: if AR Create is not running, the page says so and saves nothing (start AR Create, not the old page). The log's first lines give both addresses; if the Tailscale one is missing, Tailscale was off when it started: restart the page.

- The front page is the desk (Adrian chose it 2026-10-04): every story down the left with its step bar and "Add a recording" at the top; the chosen story (`/?s=<story>`) shows its 12 steps, one open question at a time (`&q=<n>`, the research ledger counts as one), what to read, "Make from this", photos, and what I do next. On a phone the list and the story are two screens. Answers work as before ([ask.md](ask.md)). "Run /mag" (2026-10-05) opens Terminal on the Mac and starts `claude "/mag"` in the teajia folder; from the phone it says to use the Mac, and a second click within a minute is ignored.
- One file as a page: `/read/<path under MAG, each part URL-encoded>`. Only send links to things he can act on: a map or a draft (their questions' buttons sit at the bottom), a feedback message.
- On the phone the Finder buttons are hidden: they open folders on the Mac.

**Away from the Mac and off Tailscale:** make a static page with `node ~/builds/mag-page.mjs "<DEV>" "<out.html>"` and publish it as a private claude.ai Artifact (reuse the story's link from STATUS.md if it has one). It has no buttons, so put any decision in the ASK file as usual.
