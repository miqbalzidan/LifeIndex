# Nightly

A private journal for the end of the day. Single user, no accounts, no sync, no
server. Everything you write stays in `localStorage` on the device you wrote it
on.

Mobile-first at 390px, dark by default, installable to a phone home screen and
fully usable offline.

## Running it

```sh
npm install
npm run dev        # development server
npm run build      # typecheck, bundle, and stamp the service worker
npm run preview    # serve the built app (needed to exercise the service worker)
npm run typecheck  # the app, and the tests and build config
npm test           # unit tests
npm run test:e2e   # end-to-end tests (builds and serves the app itself)
```

The service worker only registers over HTTPS or on `localhost`, so use
`npm run preview` rather than opening `dist/index.html` directly.

## The app

Four surfaces, and the journal is the middle of all of them — everything else
attaches to the day rather than the other way round.

- **Today** — the date, a rotating writing prompt that steps aside as soon as
  there's writing on the page, an editor that grows as you type, mood and energy
  on 1–5, hours slept, and a quiet row of habits. Urges logged today appear as a
  timeline under the entry.
- **Urge log** — a bottom sheet, not a screen. Intensity, a trigger chip, two
  free-text lines, and two closing buttons of identical weight.
- **Archive** — reverse-chronological, searchable, with an "on this day" card
  surfacing one month and one year back, and, at the foot of the page, the way
  to get a copy of the journal out and back in.
- **Insights** — clean days as a share of the last 30, urges by hour, mood over
  time, and urges per night grouped by hours slept.

### Things that are deliberate

These are constraints from the design brief, not defaults. They're easy to
undo by accident:

- **"Clean days" is a fraction, never a streak.** It's counted over 30 calendar
  days, not over days you opened the app, and a single bad day moves it by one
  rather than resetting it to zero. A day you never touched counts as clean:
  the stat measures the thing being tracked, not your attendance.

  The figure is held back until seven days have been recorded. An empty journal
  is arithmetically a perfect month, so a new install would otherwise open on
  `30 / 30` — praise for a month that hasn't happened yet, which is the same
  gamification the brief rules out arriving from the flattering side. The
  arithmetic in `countCleanDays` is untouched; only whether it is shown. The
  other three panels already waited for their data; this was the one that
  didn't.

- **Nothing is recorded that you didn't record.** Sleep is blank until it is
  set, rather than starting at seven hours. A default written into the day is
  indistinguishable from data: it shows up as "7h sleep" in the reader, and as
  a seven-hour night in "sleep vs urges", for a night nobody entered. The first
  press of either stepper button writes down the default, so recording a normal
  night still takes one tap.
- **"Rode it out" and "Gave in" are the same size and the same colour.** Neither
  is styled as a reward or a punishment, and there is no red anywhere on the
  "gave in" path. Logging either one is the same act.
- **No streaks, flames, badges, confetti, XP or mascots**, and no gamification
  of the writing itself.
- **Empty states never comment on missing days.** They say what the page is for
  and stop.
- **One accent colour** (a warm sand, `--accent`), used only to mark state.
- **Navigation is typographic.** There are no icons in this app.

## Layout of the code

```
src/
  App.tsx              screen switching, overlays, the floating log button
  components/          one file per surface, plus the shared 1–5 scale
  hooks/useJournal.ts  the journal: today, mutations, persistence
  hooks/useOverlay.ts  escape-to-close, scroll lock, focus restore
  lib/date.ts          local-calendar dates and clock formatting
  lib/insights.ts      the four derived statistics
  lib/storage.ts       load, save, and validate what comes back
  lib/transfer.ts      the export file, and reading one back
  lib/*.test.ts        unit tests, next to what they cover
  styles.css           design tokens and every rule in the app
test/                  a localStorage stub and fixtures for the unit tests
e2e/                   Playwright specs, including the invariant suite
public/
  sw.js                service worker (precache list stamped in at build time)
  fonts/               self-hosted Newsreader, Instrument Sans, IBM Plex Mono
  icons/               generated app icons
scripts/
  fetch-fonts.mjs      re-download and subset the fonts
  make-icons.mjs       redraw the icons
```

Both scripts write files that are committed; you only need to run them if the
fonts or the icon change.

### Dates are local, always

An entry written at 11pm belongs to that night. Every date in the app is
formatted from local components and parsed back to local midnight — never
through `Date.parse` of an ISO string, which would file late entries under
tomorrow for anyone west of Greenwich.

Relatedly, the app does not roll over to a new day while you have it open and
are writing. It re-checks the date when you reopen or refocus it.

### Getting a copy out

There is no server, so a cleared browser or a lost phone is the end of the
journal. The foot of the Archive writes the whole thing out as indented JSON —
`nightly-2026-09-09.json` — carrying a `format` tag and a `version` so a file
can be recognised, and refused, rather than half-understood by a build that
predates it.

Importing **merges**. A day the file has and this device does not is added; a
day this device has and the file does not is kept; where both hold the same
date, the file wins. Because that last case is the only thing in the app that
can overwrite something already written, the import happens in two steps: it
counts what it is about to add and replace, says so, and waits.

An imported file is put through the same validators as anything coming out of
`localStorage` — a file off someone's disk deserves exactly as much suspicion,
and a single malformed day should cost that day rather than the import. A copy
taken straight out of `localStorage`, with no `format` tag, still restores.

### Fonts

The three families are self-hosted rather than linked from Google Fonts: this is
a private, offline-first app and a cold start shouldn't have to announce itself
to a third party first. `scripts/fetch-fonts.mjs` regenerates
`public/fonts/fonts.css`, keeping the `latin` and `latin-ext` subsets and
deduplicating the variable-font files Google serves once per weight.

## Tests

Unit tests sit next to the code they cover (`src/lib/*.test.ts`) and run in Node
against a stub for `localStorage` (`test/localStorage.ts`), which also does the
two things a real browser does and jsdom will not: refuse to be read at all
(private mode, blocked site data) and refuse a write (out of quota). Both paths
are ones the app is written to survive silently.

The suite runs in `America/Los_Angeles` rather than UTC. Every date in this app
is built from local components precisely so that late-evening entries file under
the right night, and a suite run in UTC would pass whether or not that still
held.

End-to-end tests run against a real build served over HTTP, because that is the
only place the service worker exists — `npm run build` stamps its precache list,
so offline behaviour cannot be exercised from the dev server at all. One of the
specs cuts the network and opens the app in a fresh page, which is the case
installing it is for.

`test/service-worker.test.ts` covers the worker itself, loaded the way a browser
loads it — evaluated against a stub `self`, with the precache list stamped in as
the build stamps it. That reaches the cases a browser test cannot stage: what
the worker does when the network answers a navigation with a 404 or a 502, which
it must not mistake for the app and cache over the working shell.

### The invariant suite

`e2e/invariants.spec.ts` covers the constraints in "Things that are deliberate".
Those are the rules a well-meaning change undoes most easily, and the ones no
other test would notice:

- both urge outcomes render at the same size, in the same colours
- no recognisably red colour appears anywhere on the "gave in" path — measured
  in hue, so it can tell red from the app's own warm sand accent at 32°
- the headline is a fraction of a fixed window, one bad day moves it by one, and
  it waits for seven recorded days rather than opening on a perfect month
- no streak, badge, XP or congratulation vocabulary on any screen
- empty states match their copy exactly and contain no scolding words
- the tab bar contains no icons

Each one was checked by breaking the thing it protects and confirming the test
fails, rather than only by watching it pass.

## Where this came from

This implements a design handed over from Claude Design. The original bundle is
still in the repo as reference:

- `HANDOFF.md` — the handoff instructions the bundle shipped with
- `chats/chat1.md` — the conversation the design came out of, including the
  brief and what changed across revisions
- `project/Nightly.dc.html` — the prototype, plus `project/support.js`, the
  runtime it was written against

The prototype seeded about 13 months of invented history so the archive and
charts would read realistically. This app starts empty and shows calm empty
states instead.
