import { useState } from "react";
import { formatEntryDate } from "../lib/date.ts";
import { doneTasks, openTasks } from "../lib/tasks.ts";
import type { JournalApi } from "../hooks/useJournal.ts";
import type { Task } from "../types.ts";

interface PlanViewProps {
  journal: JournalApi;
}

/**
 * The standing list: things you mean to do once.
 *
 * It sits on its own screen rather than under Today because it is not part of
 * the nightly round — nothing here resets at midnight, and nothing here wants
 * looking at every evening.
 *
 * Note what it deliberately does not do: no count of what is outstanding, no
 * progress bar, no age on an open task. A list that tells you something has
 * been waiting three weeks is a list that scolds, and this app doesn't.
 */
export function PlanView({ journal }: PlanViewProps) {
  const { tasks, addTask, toggleTask, editTask, removeTask, clearDoneTasks } = journal;

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const open = openTasks(tasks);
  const done = doneTasks(tasks);

  const submit = () => {
    const reason = addTask(draft);
    if (reason) {
      setError(reason);
      return;
    }
    setDraft("");
    setError(null);
  };

  /**
   * Reading and editing are separate shapes rather than one clever control: a
   * tap should tick a task off, not put a caret in it.
   */
  const row = (task: Task) =>
    editing ? (
      <li key={task.id} className="task task--editing">
        <input
          className="task-edit"
          value={task.text}
          onChange={(e) => editTask(task.id, e.target.value)}
          aria-label={`Edit "${task.text}"`}
        />
        <button type="button" className="task-remove" onClick={() => removeTask(task.id)}>
          remove
          <span className="sr-only"> {task.text}</span>
        </button>
      </li>
    ) : (
      <li key={task.id} className="task">
        <button
          type="button"
          className="task-check"
          aria-pressed={task.done}
          onClick={() => toggleTask(task.id)}
        >
          <span className="task-box" aria-hidden="true" />
          <span className={task.done ? "task-text task-text--done" : "task-text"}>{task.text}</span>
        </button>

        {task.done && task.doneOn && <span className="task-when">{formatEntryDate(task.doneOn)}</span>}
      </li>
    );

  return (
    <div className="screen">
      <header className="page-head">
        <h1 className="page-title">Plan</h1>
      </header>

      <form
        className="task-add"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="task-input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="Something to do once"
          aria-label="Something to do once"
        />
        <button type="submit" className="task-submit">
          Add
        </button>
      </form>

      {error && (
        <p className="task-error" role="status">
          {error}
        </p>
      )}

      {open.length > 0 && <ul className="tasks">{open.map(row)}</ul>}

      {/* Two silences, neither of them about how much is left undone. */}
      {tasks.length === 0 && (
        <p className="quiet-note tasks-empty">
          Nothing here yet. This is for the things you mean to do once — the habits row on Today is
          for the ones you do again.
        </p>
      )}
      {tasks.length > 0 && open.length === 0 && (
        <p className="quiet-note tasks-empty">Nothing waiting.</p>
      )}

      {done.length > 0 && (
        <section className="tasks-done">
          <h2 className="label">Done</h2>
          <ul className="tasks">{done.map(row)}</ul>
        </section>
      )}

      {tasks.length > 0 && (
        <div className="task-actions">
          <button
            type="button"
            className="task-action"
            aria-expanded={editing}
            onClick={() => setEditing((on) => !on)}
          >
            {editing ? "done" : "edit"}
            <span className="sr-only"> the list</span>
          </button>
          {editing && done.length > 0 && (
            <button type="button" className="task-action" onClick={clearDoneTasks}>
              Clear the done ones
            </button>
          )}
        </div>
      )}
    </div>
  );
}
