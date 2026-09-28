import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarView } from "./components/CalendarView.tsx";
import { InsightsView } from "./components/InsightsView.tsx";
import { PlanView } from "./components/PlanView.tsx";
import { ReaderOverlay } from "./components/ReaderOverlay.tsx";
import { TabBar } from "./components/TabBar.tsx";
import { TodayView } from "./components/TodayView.tsx";
import { UrgeSheet } from "./components/UrgeSheet.tsx";
import { useJournal } from "./hooks/useJournal.ts";
import { blankDay } from "./lib/storage.ts";
import type { Tab, Urge } from "./types.ts";

/**
 * Logging a new urge, or changing one already on a day. Both carry the day they
 * belong to: a missed urge can be written up later against the day it happened.
 */
type Sheet = { kind: "new"; date: string } | { kind: "edit"; date: string; urge: Urge };

export default function App() {
  const journal = useJournal();

  // The calendar leads: it is the fastest way to either day anyone opens the
  // app for, tonight's or an old one, without first landing somewhere and
  // then navigating away from it.
  const [tab, setTab] = useState<Tab>("calendar");
  const [query, setQuery] = useState("");
  const [readerDate, setReaderDate] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [fabOpen, setFabOpen] = useState(false);

  // Falls back to a blank day so a date you never wrote on can still be opened
  // and written up. Nothing is stored until something is actually put in it.
  const reader = readerDate ? (journal.days[readerDate] ?? blankDay(readerDate)) : undefined;

  // The sheet covers the button that opened it, so the button is unmounted
  // while it is up and there is nothing left for the sheet to hand focus back
  // to. Put it on the replacement once the sheet is gone.
  const fabRef = useRef<HTMLButtonElement>(null);
  const sheetWasOpen = useRef(false);
  useEffect(() => {
    if (sheetWasOpen.current && sheet === null) fabRef.current?.focus({ preventScroll: true });
    sheetWasOpen.current = sheet !== null;
  }, [sheet]);

  const closeSheet = useCallback(() => setSheet(null), []);
  const closeReader = useCallback(() => setReaderDate(null), []);

  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    setReaderDate(null);
    setFabOpen(false);
  }, []);

  // Today has its own tab, with the rotating prompt the reader doesn't carry,
  // so opening today's date is a different act from opening any other day —
  // it goes there rather than into an overlay on top of it.
  const openDay = useCallback(
    (date: string) => {
      if (date === journal.todayDate) setTab("today");
      else setReaderDate(date);
    },
    [journal.todayDate]
  );

  const editUrgeOn = useCallback(
    (date: string) => (urge: Urge) => setSheet({ kind: "edit", date, urge }),
    []
  );

  const saveUrge = useCallback(
    (draft: Omit<Urge, "id">) => {
      if (!sheet) return;
      if (sheet.kind === "new") {
        journal.logUrge(sheet.date, draft);
        // Land back on the day it belongs to, where it has just appeared in the
        // timeline under the entry — unless that day is already open in front of
        // you, in which case you are looking at it.
        if (!reader) setTab("today");
      } else {
        journal.updateUrge(sheet.date, sheet.urge.id, draft);
      }
      setSheet(null);
    },
    [journal, sheet, reader]
  );

  const deleteUrge = useCallback(() => {
    if (sheet?.kind !== "edit") return;
    journal.deleteUrge(sheet.date, sheet.urge.id);
    setSheet(null);
  }, [journal, sheet]);

  return (
    <div className="app">
      <div className="column" id="screen" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "today" && (
          <TodayView journal={journal} onEditUrge={editUrgeOn(journal.todayDate)} />
        )}
        {tab === "plan" && <PlanView journal={journal} />}
        {tab === "calendar" && (
          <CalendarView journal={journal} query={query} onQueryChange={setQuery} onOpen={openDay} />
        )}
        {tab === "insights" && <InsightsView days={journal.days} />}
      </div>

      {reader && (
        <ReaderOverlay
          day={reader}
          journal={journal}
          onClose={closeReader}
          onEditUrge={editUrgeOn(reader.date)}
          onLogUrge={() => setSheet({ kind: "new", date: reader.date })}
        />
      )}

      {sheet?.kind === "new" && (
        <UrgeSheet
          date={sheet.date}
          todayDate={journal.todayDate}
          onClose={closeSheet}
          onSave={saveUrge}
        />
      )}
      {sheet?.kind === "edit" && (
        <UrgeSheet
          date={sheet.date}
          todayDate={journal.todayDate}
          editing={sheet.urge}
          onClose={closeSheet}
          onSave={saveUrge}
          onDelete={deleteUrge}
        />
      )}

      {/* Always within reach, on every screen — except while something is
          already covering the app. Both options are dated today: a past day
          has its own way in, from inside that day in the reader. */}
      {!sheet && !reader && (
        <>
          {fabOpen && (
            <div className="fab-scrim" aria-hidden="true" onClick={() => setFabOpen(false)} />
          )}

          {fabOpen && (
            <div className="fab-menu">
              <button
                type="button"
                className="fab-option"
                onClick={() => {
                  setFabOpen(false);
                  setTab("today");
                }}
              >
                Entry
              </button>
              <button
                type="button"
                className="fab-option"
                onClick={() => {
                  setFabOpen(false);
                  setSheet({ kind: "new", date: journal.todayDate });
                }}
              >
                Urge
              </button>
            </div>
          )}

          <button
            ref={fabRef}
            type="button"
            className="fab"
            aria-haspopup="true"
            aria-expanded={fabOpen}
            onClick={() => setFabOpen((open) => !open)}
          >
            {fabOpen ? "×" : "+"}
            <span className="sr-only"> {fabOpen ? "Close" : "Add an entry or an urge"}</span>
          </button>
        </>
      )}

      <TabBar current={tab} onChange={changeTab} />
    </div>
  );
}
