# Phone pickup: the Mac improves recordings made on the phone

Recordings made in the phone oracle (mandalacodes) get a quick draft from Groq on the phone. The Mac picks them up and gives them AR Create's better transcript. The phone's draft stays as the raw record.

## How it works (pull, never push)

The phone and Cloudflare cannot reach this Mac, so the Mac asks.

1. `GET /api/oracle/pickup/segments` on the phone site lists recordings still waiting for a better transcript.
2. For each (at most five new per check) the Mac fetches the audio, imports it to the Library folder `Phone recordings`, and runs the normal pipeline: library prompt, local transcription with speakers, then the word check (known mishearings fixed with a receipt, doubtful words onto Needs you).
3. The result is posted back to `POST /api/oracle/pickup/segments/<id>/transcript` as a new version. The phone site keeps its draft, replaces the working text only if Adrian has not edited it, and otherwise raises a comparison (accept, keep or decide later per change).
4. A recording the Mac cannot do is set aside (`outcome: skipped`) so it is not offered again. The phone draft stands.

## When it asks

Only on demand: when AR Create starts (and the last check was more than 12 hours ago), from **Check the phone** on the Material screen, and from the CLI. There is no timer that asks the phone site (standing rule: nothing scheduled more than twice a day; Cloudflare is metered). While a recording is still being transcribed, a local watcher finishes it and posts it back; it never lists the phone site.

```sh
node "$CLI" phone status     # key present? last check, counts
node "$CLI" phone check      # ask the phone site once
node "$CLI" phone setup      # the one-line setup
```

Routes: `GET /api/phone-pickup`, `GET /api/phone-pickup/setup`, `POST /api/phone-pickup/check`. Agents may use all three; nothing here is human-only.

## The pickup key

A dedicated key, `AR_PICKUP_TOKEN`, never an existing secret. The phone site holds it as a Pages secret; AR Create reads it at the moment it is needed, from the environment and then from Infisical (the installed app starts with a minimal environment, so Infisical is the normal source). It is never written to disk, logged or returned. With no key the screen shows "Needs a pickup key, see setup" and opens the setup panel; `phone setup` prints the same line.

State is kept in `data/phone-pickup/` (`state.json`, and one record per recording under `segments/`).

Tests: `tests/phone-pickup.test.mjs` (the whole flow against a fake phone site and a fake transcriber) and `tests/phone-pickup-http.test.mjs` (registry, CLI, HTTP).
