import { useMemo } from "react";
import { MoodChart } from "./MoodChart.tsx";
import { CLEAN_WINDOW_DAYS } from "../lib/constants.ts";
import {
  buildHourHistogram,
  buildMoodSeries,
  buildSleepRows,
  countCleanDays,
  hourNote,
} from "../lib/insights.ts";
import type { Day } from "../types.ts";

interface InsightsViewProps {
  days: Record<string, Day>;
}

export function InsightsView({ days }: InsightsViewProps) {
  const clean = useMemo(() => countCleanDays(days), [days]);
  const hours = useMemo(() => buildHourHistogram(days), [days]);
  const moods = useMemo(() => buildMoodSeries(days), [days]);
  const sleepRows = useMemo(() => buildSleepRows(days), [days]);

  const hourPeak = Math.max(1, ...hours.counts);
  const sleepMax = Math.max(0.01, ...sleepRows.map((r) => r.average));
  const hasMood = moods.some((m) => m !== null);
  const hasSleepNights = sleepRows.some((r) => r.nights > 0);

  return (
    <div className="screen">
      <header className="insights-head">
        <h1 className="page-title">Insights</h1>
      </header>

      {/* A share of the window, never a streak — this number cannot fall to
          zero because of a single day. */}
      <section className="headline">
        <div className="headline-figure">
          <div className="headline-value">{clean}</div>
          <div className="headline-of">/ {CLEAN_WINDOW_DAYS}</div>
        </div>
        <p className="headline-note">
          Clean days in the last {CLEAN_WINDOW_DAYS}. Counted as a share, not a streak.
        </p>
      </section>

      <section className="panel">
        <h2 className="label">Urges by hour</h2>
        {hours.total > 0 ? (
          <>
            <div className="hours" role="img" aria-label={hourNote(hours)}>
              {hours.counts.map((n, hour) => (
                <div key={hour} className="hour">
                  <div
                    className={hour === hours.peakHour ? "hour-bar hour-bar--peak" : "hour-bar"}
                    style={{ height: `${Math.round((n / hourPeak) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="axis" aria-hidden="true">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
            <p className="panel-note">{hourNote(hours)}</p>
          </>
        ) : (
          <p className="quiet-note panel-empty">No urges logged yet.</p>
        )}
      </section>

      <section className="panel">
        <h2 className="label">Mood · last {CLEAN_WINDOW_DAYS} days</h2>
        {hasMood ? (
          <>
            <MoodChart series={moods} />
            <div className="axis" aria-hidden="true">
              <span>{CLEAN_WINDOW_DAYS}d ago</span>
              <span>today</span>
            </div>
          </>
        ) : (
          <p className="quiet-note panel-empty">No moods noted yet.</p>
        )}
      </section>

      <section className="panel">
        <h2 className="label">Sleep vs urges</h2>
        {hasSleepNights ? (
          <>
            <div className="sleep-rows">
              {sleepRows.map((row, i) => (
                <div key={row.label} className="sleep-row">
                  <div className="sleep-label">{row.label}</div>
                  <div
                    className="sleep-track"
                    role="img"
                    aria-label={`${row.label}: ${row.average.toFixed(1)} urges a night over ${row.nights} nights.`}
                  >
                    <div
                      // The short-sleep row carries the accent: it is the row
                      // the chart exists to point at.
                      className={i === 0 ? "sleep-fill sleep-fill--marked" : "sleep-fill"}
                      style={{ width: `${Math.max(2, Math.round((row.average / sleepMax) * 100))}%` }}
                    />
                  </div>
                  <div className="sleep-value">{row.average.toFixed(1)}</div>
                </div>
              ))}
            </div>
            <p className="panel-note">Average urges per night, grouped by hours slept.</p>
          </>
        ) : (
          <p className="quiet-note panel-empty">Not enough nights recorded yet.</p>
        )}
      </section>
    </div>
  );
}
