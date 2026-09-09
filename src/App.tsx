import { useCallback, useEffect, useRef, useState } from "react";
import { ArchiveView } from "./components/ArchiveView.tsx";
import { InsightsView } from "./components/InsightsView.tsx";
import { ReaderOverlay } from "./components/ReaderOverlay.tsx";
import { TabBar } from "./components/TabBar.tsx";
import { TodayView } from "./components/TodayView.tsx";
import { UrgeSheet } from "./components/UrgeSheet.tsx";
import { useJournal } from "./hooks/useJournal.ts";
import type { Tab, Urge } from "./types.ts";

export default function App() {
  const journal = useJournal();

  const [tab, setTab] = useState<Tab>("today");
  const [query, setQuery] = useState("");
  const [readerDate, setReaderDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const reader = readerDate ? journal.days[readerDate] : undefined;

  // The sheet covers the button that opened it, so the button is unmounted
  // while it is up and there is nothing left for the sheet to hand focus back
  // to. Put it on the replacement once the sheet is gone.
  const fabRef = useRef<HTMLButtonElement>(null);
  const sheetWasOpen = useRef(false);
  useEffect(() => {
    if (sheetWasOpen.current && !sheetOpen) fabRef.current?.focus({ preventScroll: true });
    sheetWasOpen.current = sheetOpen;
  }, [sheetOpen]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const closeReader = useCallback(() => setReaderDate(null), []);

  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    setReaderDate(null);
  }, []);

  const saveUrge = useCallback(
    (draft: Omit<Urge, "id">) => {
      journal.logUrge(draft);
      setSheetOpen(false);
      // Land back on the day it belongs to, where it has just appeared in the
      // timeline under the entry.
      setTab("today");
    },
    [journal]
  );

  return (
    <div className="app">
      <div className="column" id="screen" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "today" && <TodayView journal={journal} />}
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

      {reader && <ReaderOverlay day={reader} onClose={closeReader} />}

      {sheetOpen && <UrgeSheet onClose={closeSheet} onSave={saveUrge} />}

      {/* Always within reach, on every screen — except while something is
          already covering the app. */}
      {!sheetOpen && !reader && (
        <button ref={fabRef} type="button" className="fab" onClick={() => setSheetOpen(true)}>
          Log urge
        </button>
      )}

      <TabBar current={tab} onChange={changeTab} />
    </div>
  );
}
