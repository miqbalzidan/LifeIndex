import type { Tab } from "../types.ts";

const TABS: [key: Tab, name: string][] = [
  ["today", "Today"],
  ["plan", "Plan"],
  ["archive", "Archive"],
  ["insights", "Insights"],
];

interface TabBarProps {
  current: Tab;
  onChange: (tab: Tab) => void;
}

/** Typographic, by design — the words are the navigation, there are no icons. */
export function TabBar({ current, onChange }: TabBarProps) {
  return (
    <nav className="tabbar">
      <div className="tabbar-inner" role="tablist" aria-label="Sections">
        {TABS.map(([key, name]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={current === key}
            aria-controls="screen"
            className="tab"
            onClick={() => onChange(key)}
          >
            {name}
            <span className="tab-mark" aria-hidden="true" />
          </button>
        ))}
      </div>
    </nav>
  );
}
