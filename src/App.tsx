import { useCallback, useEffect, useRef, useState } from "react";
import { ArchiveView } from "./components/ArchiveView.tsx";
import { InsightsView } from "./components/InsightsView.tsx";
import { ReaderOverlay } from "./components/ReaderOverlay.tsx";
import { TabBar } from "./components/TabBar.tsx";
import { TodayView } from "./components/TodayView.tsx";
import { UrgeSheet } from "./components/UrgeSheet.tsx";
import { useJournal } from "./hooks/useJournal.ts";
import type { Tab, Urge } from "./types.ts";

/** Logging a new urge, or changing one already on a day. */
type Sheet = { kind: "new" } | { kind: "edit"; date: string; urge: Urge };

export default function App() {
  const journal = useJournal();

  const [tab, setTab] = useState<Tab>("today");
  const [query, setQuery] = useState("");
  const [readerDate, setReaderDate] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const reader = readerDate ? journal.days[readerDate] : undefined;

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
  }, []);

  const editUrgeOn = useCallback(
    (date: string) => (urge: Urge) => setSheet({ kind: "edit", date, urge }),
    []
  );

  const saveUrge = useCallback(
    (draft: Omit<Urge, "id">) => {
      if (!sheet) return;
      if (sheet.kind === "new") {
        journal.logUrge(journal.todayDate, draft);
        // Land back on the day it belongs to, where it has just appeared in the
        // timeline under the entry.
        setTab("today");
      } else {
        journal.updateUrge(sheet.date, sheet.urge.id, draft);
      }
      setSheet(null);
    },
    [journal, sheet]
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
        {tab === "archive" && (
          <ArchiveView
            journal={journal}
            query={query}
            onQueryChange={setQuery}
            onOpen={setReaderDate}
          />
        )}
        {tab === "insights" && <InsightsView days={journal.days} />}
      </div>

      {reader && (
        <ReaderOverlay
          day={reader}
          journal={journal}
          onClose={closeReader}
          onEditUrge={editUrgeOn(reader.date)}
        />
      )}

      {sheet?.kind === "new" && <UrgeSheet onClose={closeSheet} onSave={saveUrge} />}
      {sheet?.kind === "edit" && (
        <UrgeSheet
          editing={sheet.urge}
          onClose={closeSheet}
          onSave={saveUrge}
          onDelete={deleteUrge}
        />
      )}

      {/* Always within reach, on every screen — except while something is
          already covering the app. */}
      {!sheet && !reader && (
        <button
          ref={fabRef}
          type="button"
          className="fab"
          onClick={() => setSheet({ kind: "new" })}
        >
          Log urge
        </button>
      )}

      <TabBar current={tab} onChange={changeTab} />
    </div>
  );
}
