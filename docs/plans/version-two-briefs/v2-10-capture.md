# Stage 3: Capture inside version two

Two builders, each in its own git worktree on its own branch, never the same file. Do not push. Commit your work in
your worktree when you finish (one commit, plain message, no model name) so the director can take it.

## Read first (both builders)

1. `CLAUDE.md`, `docs/plans/2026-11-11-version-two.md` (all of it), "Rules for every worker" in
   `docs/plans/2026-11-11-direction-d-build.md`, `docs/plans/version-two-briefs/v2-common.md`, `public/v2/README.md`.
2. The sample Adrian approved by eye, checked out read only at
   `/tmp/wt-sample/design/2026-11-better-interface/d-four-stations/`: `captureSheet` in `app.js` (near line 31), the
   `.sheet`, `.cap3.four`, `.cap-done` rules in `app.css`, and the subject's "Add a recording, note, link or
   photographs" row and the three ways of an empty "What you have" (`app.js` near 112 and 145). Open `index.html`
   there in a browser and press Capture on Home and inside a subject, at 1440 and 390 wide, dark and light.
3. How the existing workspace does each job today (read only, never change it): `public/document-study/material-intake.js`
   (microphone near 155), `stage-flow.js` (near 110: folder, import, attach; the working note), `study-photos.js`.
4. Today's sheet: `captureSheet` in `public/v2/shell/shell.js` (near 219) and the tests that pin it,
   `tests/v2-shell.test.mjs` near 129, and `scripts/review-sideways.mjs` near 215.

## What exists (found by a scout on 11 November; check each against the code before you rely on it)

- The command client sends JSON only and gives up after 20 seconds (`public/v2/shell/client.js` near 75 and 83).
  Bytes go as base64. The server takes 2 MB per call, except `sources.import`: 90 MB, 64 MB per file.
- `sources.import` (any caller): `{rootId:'library', folder, files:[{name, content | base64}]}`. `folder:''` is the
  Library root. Returns `{receipts:[{ok, source}], revision}`. No undo; no command deletes a source. An audio file
  gets a recording job by itself.
- Into a subject, as the workspace does: `sources.folders {rootId:'library', folder:'Projects/<projectId>'}`, then
  `sources.import` into that folder, then `first-flow.attach {projectId, operationId, sourceIds}`. Or
  `study.material.attach {bindingId, parentStudyId, operationId, sourceIds}`. `projectId` and `bindingId` come from
  `subject.standing` `facts`; `projectId` can be null.
- Recordings: `recordings` (read) gives `{capability, jobs:[{id, sourceId, state}]}`. `.transcription.id.action`
  `{id, action:'start'}` starts a transcript and answers 503 unless `capability.ready`. `recordings.source`
  (human only) `{jobId, expected, operationId}` turns a finished transcript into a source. The demo has no
  transcription tools, so there a recording stays saved only.
- A question: `research-topics.start` (human only) `{operationId, name, subjects?:[parentStudyId]}`, as
  `newTopic` in `public/v2/screens/research.js` (near 120). An assistant uses `research-topics.propose`. Taking it
  back: `research-topics.let-go` (human).
- There is no inbox. With no subject open, a capture goes to the Library root.
- The subject's "What you have" (`subject.js` near 142 to 167) re-reads on `sources*`, `first-flow*`,
  `study.material*`, `study.photos*`, `recordings*`.

## Rules that decide the hard cases

- Only real records, through `v2.call`. No `fetch` for a command, no document-study globals, no copy of a record kept.
- The sample wins on what he sees, except: "Advanced" stays in the top bar; a part with no command behind it sits in
  the sample's place and says it is not built yet (`v2.ui.notBuilt`, with Open in Advanced where the existing
  workspace has it); only the six type sizes; no em dash; no invented content and no promise the app cannot keep
  (the sample's "your inbox" and "The answer will wait for you here" are not true here: say "the Library, to file
  later" and "added to Research").
- His words are his. A thought is saved exactly as typed. Nothing is trimmed, tidied or titled for him beyond a
  file name made from its first words and the date.
- No speech recognition: never `SpeechRecognition` or any service that sends his voice away. Recording with
  `MediaRecorder` stays on the device and goes only to the app's own server.
- Human-only commands stay human-only. On an assistant's page (`?reviewActor=agent:...`) a refusal's message is shown
  plainly; a question from an assistant is a proposal.
- Nothing is lost quietly: if a save fails or times out, the recording, photograph or words stay in the sheet with
  the plain message and a way to try again. The sheet does not close on a press outside while something is unsaved
  or recording.
- A command you call for the first time must be tried against the real demo server, not only a stub.
- Phone first, both themes, keyboard reachable, focus kept inside the sheet and returned to the Capture button.
- Tests: your own test file and the ones your part names. The director runs the whole suite. Never weaken a test;
  where the old sheet's assertions no longer describe the sheet, replace them with ones that pin the new behaviour.
- Pictures: one contact sheet (at most 1600 pixels wide) saved where your task says: the sheet with its four tiles,
  each tile's open state and the done state, at 1440 and 390, dark and light, with the sample's sheet beside the
  tiles view.

## Builder A: the Capture sheet

Files you may touch: new `public/v2/shell/capture.js` and `public/v2/shell/capture.css`; `public/v2/shell/shell.js`
(only: remove the old `captureSheet`, call the new one, expose `v2.capture(options)`); `public/v2/shell/shell.css`
(only the old sheet's rules, moved); `public/v2/shell/client.js` (only: a per-call `timeoutMs` option, if it has
none); `public/v2/index.html` (the two lines that load the new files); `public/v2/README.md` (a short paragraph on
`v2.capture`); `tests/v2-shell.test.mjs` (the capture assertions and file lists); new `tests/v2-capture.test.mjs`;
`scripts/review-sideways.mjs` (only what opens the sheet, plus each tile's open state). Nothing else.

Build:

1. `v2.capture({subject?})`. The Capture buttons in the top bar and the phone bar call it. The subject is the open
   one on `subject/:id`, `write/:id`, `read/:id` and `check/:id`; elsewhere there is none. The sheet's line reads
   "Goes to **<subject name>**. A question goes to Research." or "Goes to the Library, to file later. A question
   goes to Research."
2. The four tiles in the sample's shape. Pressing one changes the sheet's body in place (with a way back to the
   four tiles); nothing navigates away.
   - **Speak.** Asks for the microphone, shows the time running and Stop. After Stop: the length, Save and Discard.
     Save imports the audio (`Microphone-<date and time>.webm` or the type the browser gives), files it with the
     subject as below, then starts the transcript if `recordings` says the capability is ready. If it is not ready,
     say plainly that the recording is saved and transcription is not set up on this machine. Keep the workspace's
     caps (8 MB, 15 minutes) and say so when one is reached, saving what was recorded. No microphone, or permission
     refused: say so plainly and offer "Add an audio file" (a file input, `accept="audio/*"`), which goes the same way.
   - **Photograph.** "Take a photograph" (a file input with `accept="image/*" capture="environment"`) and "Choose
     photographs" (several at once). Shows a small preview and each one's state while it saves. One at a time
     through `sources.import`, with a longer wait than 20 seconds.
   - **Write a thought.** A text area, Save, and Cmd or Ctrl with Enter. Saved as a `.md` source, words untouched.
   - **Ask a question.** One line. A human starts a research topic linked to the subject when there is one; an
     assistant proposes it.
3. Filing with a subject: folder, import, attach, as above. Where `projectId` is null use `study.material.attach`;
   where neither can be had, save to the Library root and say so rather than fail.
4. The done state, as the sample's `.cap-done`: what was saved and where, a link to it (the subject, or the topic in
   Research), and Done. Undo: real for a question a human asked (`research-topics.let-go`); for the other three no
   command takes a source back, so Undo is left out and one quiet line says a saved item can be removed in Advanced
   only if that is true there; otherwise say nothing about undo.
5. An unsaved thought or question survives a tile switch inside the open sheet.

## Builder B: the subject shows what was captured

Files you may touch: `public/v2/screens/subject.js`, `subject.css`, `tests/v2-subject.test.mjs`. Nothing else.

Build:

1. The subject's own ways in ("Add a recording, note, link or photographs", and the three ways of an empty "What you
   have", where the screen shows them or the sample does) open `v2.capture({subject})` when it exists (read it at
   use time; builder A adds it) and keep today's behaviour when it does not.
2. In "What you have", a recording says where it is, from `recordings`: saved, transcript being made, transcript
   ready, or transcription not set up on this machine. When a transcript is ready and has not been turned into a
   source, a human gets one button to use it (`recordings.source`); an assistant sees the refusal's plain message.
   Where transcription is ready but not started, one button starts it. First check what the screen already shows
   for recordings, and add only what is missing.
3. A new capture appears without a reload (the change stream already re-reads; make sure a research topic linked
   from the sheet shows too if the screen lists topics).
4. The demo cannot make a transcript. Say in your report exactly which of these states you saw against the real demo
   server and which only against a stub, so it can be checked on Adrian's Mac.
