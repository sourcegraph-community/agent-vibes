"use client";

import { useState } from "react";
import { getDetailsClass, getSummaryClass } from "./collapsibleDayUtils";

type TweetDetail = {
  id: string;
  authorHandle: string | null;
  authorName: string | null;
  postedAt: string;
  language: string | null;
  content: string;
  url: string | null;
  engagementLikes: number | null;
  engagementRetweets: number | null;
  keywords: string[];
  sentimentLabel: string | null;
  sentimentScore: number | null;
};

type DayGroup = {
  day: string;
  count: number;
  tweets: TweetDetail[];
};

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function DayTweets({ group }: { group: DayGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={getDetailsClass(open)}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className={getSummaryClass(open)}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{formatDay(group.day)}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{group.count} posts</span>
        </div>
        <span className="text-[hsl(var(--muted-foreground))]">▾</span>
      </summary>
      <div className="p-3 pt-2">
        <div className="max-h-[440px] overflow-y-auto pr-4 md:pr-6 scrollbar-themed">
          <ul className="divide-y divide-[hsl(var(--border))]">
            {group.tweets.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {t.authorName && <span className="font-medium">{t.authorName}</span>}
                      {t.authorHandle && <span className="text-[hsl(var(--muted-foreground))]">@{t.authorHandle}</span>}
                      {t.language && (
                        <span className="inline-flex rounded-full bg-[hsl(var(--input))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                          {t.language}
                        </span>
                      )}
                      {t.postedAt && (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{new Date(t.postedAt).toLocaleTimeString()}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed">{t.content}</p>
                    {t.keywords && t.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.keywords.slice(0, 6).map((kw) => (
                          <span key={kw} className="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                      {t.engagementLikes != null && <span>❤️ {t.engagementLikes}</span>}
                      {t.engagementRetweets != null && <span>🔄 {t.engagementRetweets}</span>}
                      {t.url && (
                        <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          View →
                        </a>
                      )}
                    </div>
                  </div>
                  {t.sentimentLabel && (
                    <div className="shrink-0 text-right">
                      <span
                        className={
                          `inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ` +
                          (t.sentimentLabel === 'positive'
                            ? 'bg-green-500/10 text-green-300'
                            : t.sentimentLabel === 'negative'
                              ? 'bg-red-500/10 text-red-300'
                              : 'bg-[hsl(var(--input))] text-[hsl(var(--muted-foreground))]')
                        }
                      >
                        {t.sentimentLabel}
                      </span>
                      {typeof t.sentimentScore === 'number' && (
                        <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{t.sentimentScore.toFixed(2)}</div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
