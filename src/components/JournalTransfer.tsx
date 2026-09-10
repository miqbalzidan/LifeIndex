import { useRef, useState } from "react";
import { plural } from "../lib/format.ts";
import { exportFilename, readImport, serialiseExport, type ImportResult } from "../lib/transfer.ts";
import type { Journal } from "../types.ts";

type Pending = Extract<ImportResult, { ok: true }>;

interface JournalTransferProps {
  journal: Journal;
  onImport: (journal: Journal) => void;
}

/**
 * Getting a copy of the journal out, and a copy back in.
 *
 * It sits at the foot of the archive rather than behind a settings screen,
 * because the archive is the page about the journal as a whole, and this app
 * has no settings.
 *
 * Importing is deliberately two steps. It is the only action here that can
 * overwrite something already written, so it says what it is about to do and
 * waits before doing it.
 */
export function JournalTransfer({ journal, onImport }: JournalTransferProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dayCount = Object.keys(journal.days).length;

  const save = () => {
    setPending(null);
    const name = exportFilename();
    const url = URL.createObjectURL(
      new Blob([serialiseExport(journal)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    // Revoking synchronously can beat the download to the file.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(`Saved ${dayCount} ${plural(dayCount, "day")} as ${name}.`);
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    const result = readImport(await file.text(), journal);
    if (result.ok) {
      setPending(result);
    } else {
      setPending(null);
      setMessage(result.reason);
    }
  };

  const apply = () => {
    if (!pending) return;
    const total = pending.added + pending.replaced;
    onImport(pending.journal);
    setPending(null);
    setMessage(`Imported ${total} ${plural(total, "day")}.`);
  };

  return (
    <section className="transfer">
      <h2 className="label">This journal</h2>
      <p className="transfer-note">
        Everything here is on this device and nowhere else. A copy is the one thing that survives a
        cleared browser or a new phone.
      </p>

      <div className="transfer-actions">
        <button type="button" className="transfer-action" onClick={save} disabled={dayCount === 0}>
          Export a copy
        </button>
        <button
          type="button"
          className="transfer-action"
          onClick={() => fileRef.current?.click()}
        >
          Import a copy
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          // So choosing the same file twice in a row still counts as a change.
          e.target.value = "";
        }}
      />

      {pending && (
        <div className="transfer-confirm">
          <p className="transfer-note">
            {pending.added + pending.replaced}{" "}
            {plural(pending.added + pending.replaced, "day")} in that file.{" "}
            {pending.replaced > 0
              ? `${pending.replaced} ${plural(pending.replaced, "day")} already here will be replaced by the copy in the file.`
              : "Nothing already here will be replaced."}
          </p>
          <div className="transfer-actions">
            <button type="button" className="transfer-action" onClick={apply}>
              Import
            </button>
            <button type="button" className="transfer-action" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="transfer-note transfer-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
