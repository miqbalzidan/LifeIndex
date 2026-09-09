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
npm run typecheck
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
  surfacing one month and one year back.
- **Insights** — clean days as a share of the last 30, urges by hour, mood over
  time, and urges per night grouped by hours slept.

### Things that are deliberate

These are constraints from the design brief, not defaults. They're easy to
undo by accident:

- **"Clean days" is a fraction, never a streak.** It's counted over 30 calendar
  days, not over days you opened the app, and a single bad day moves it by one
  rather than resetting it to zero. A day you never touched counts as clean:
  the stat measures the thing being tracked, not your attendance.
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
  styles.css           design tokens and every rule in the app
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

### Fonts

The three families are self-hosted rather than linked from Google Fonts: this is
a private, offline-first app and a cold start shouldn't have to announce itself
to a third party first. `scripts/fetch-fonts.mjs` regenerates
`public/fonts/fonts.css`, keeping the `latin` and `latin-ext` subsets and
deduplicating the variable-font files Google serves once per weight.

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
