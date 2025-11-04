"use client";

import { useEffect, useMemo, useState } from "react";
import { getDetailsClass, getSummaryClass } from "./collapsibleDayUtils";

type DigestItem = {
  title: string;
  link: string | null;
  pubDate: string | null;
  day: string; // YYYY-MM-DD
  sections: {
    executiveSummary: string;
    channelHighlights: string;
    communityInsights: string;
  };
};

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function highlightChannelMentions(html: string): string {
  if (!html) return html;
  // Replace channel tokens only in text nodes: operate between tags >text<
  return html.replace(/>([^<]+)</g, (_m: string, text: string) => {
    const replaced = text.replace(/(^|\s)(#[a-zA-Z][\w-]*)/g, (_m2: string, pre: string, tag: string) => {
      return `${pre}<span class="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">${tag}</span>`;
    });
    return `>${replaced}<`;
  });
}

function ChannelHighlights({ html }: { html: string }) {
  const enhanced = useMemo(() => highlightChannelMentions(html), [html]);
  return (
    <div
      className="p-3 pt-2 prose prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: enhanced }}
    />
  );
}

export default function BuildCrewDigest() {
  const [items, setItems] = useState<DigestItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => new URLSearchParams({ days: String(7) }).toString(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/build-crew/digest?${query}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setItems(Array.isArray(json?.data) ? json.data : []);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="card">

      {loading && (
        <div className="text-gray-400 py-6">Loading Build Crew digest…</div>
      )}

      {error && (
        <div className="text-red-400 py-6">{error}</div>
      )}

      {!loading && !error && items && items.length === 0 && (
        <div className="text-gray-400 py-6">No Build Crew digests available.</div>
      )}

      {!loading && !error && items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((it) => (
            <DayDetails key={it.day} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayDetails({ item }: { item: DigestItem }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={getDetailsClass(open)}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className={getSummaryClass(open)}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{formatDay(item.day)}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Daily summary</span>
        </div>
        <span className="text-[hsl(var(--muted-foreground))]">▾</span>
      </summary>

      <div className="p-3 pt-2 space-y-2">
        {item.sections.executiveSummary && (
          <details className="rounded-lg">
            <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-3 px-3 py-2 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-md">
              <span className="text-sm font-medium">Executive Summary</span>
              <span className="text-[hsl(var(--muted-foreground))]">▾</span>
            </summary>
            <div className="p-3 pt-2 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: item.sections.executiveSummary }} />
          </details>
        )}

        {item.sections.channelHighlights && (
          <details className="rounded-lg">
            <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-3 px-3 py-2 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-md">
              <span className="text-sm font-medium">Channel Highlights</span>
              <span className="text-[hsl(var(--muted-foreground))]">▾</span>
            </summary>
            <ChannelHighlights html={item.sections.channelHighlights} />
          </details>
        )}

        {item.sections.communityInsights && (
          <details className="rounded-lg">
            <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-3 px-3 py-2 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-md">
              <span className="text-sm font-medium">Community Insights</span>
              <span className="text-[hsl(var(--muted-foreground))]">▾</span>
            </summary>
            <div className="p-3 pt-2 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: item.sections.communityInsights }} />
          </details>
        )}
      </div>
    </details>
  );
}


