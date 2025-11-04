"use client";

import { useEffect, useMemo, useState } from "react";
import DayTweets from "./RecentSocialActivity.DayTweets";

export interface RecentSocialActivityProps {
  // timeframe intentionally ignored; component shows fixed 7 days per spec
  brand?: string | null;
}

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
  day: string; // YYYY-MM-DD
  count: number;
  tweets: TweetDetail[];
};

type ApiResponse = {
  days: DayGroup[];
  summary: { days: number; total: number; product: string | null };
};

function formatDay(day: string): string {
  // day is YYYY-MM-DD
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function RecentSocialActivity({ brand }: RecentSocialActivityProps) {
  const [groups, setGroups] = useState<DayGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const usp = new URLSearchParams();
    usp.set("days", "7");
    if (brand && brand.trim().length > 0) {
      usp.set("products", brand.trim());
    }
    return usp.toString();
  }, [brand]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/social-sentiment/tweets?${params}`);
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json: ApiResponse = await res.json();
        if (!cancelled) {
          setGroups(json.days || []);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params]);

  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Social Activity</h3>
        {brand && (
          <span className="text-xs text-gray-400">{brand}</span>
        )}
      </div>

      {loading && (
        <div className="text-gray-400 py-6">Loading tweets…</div>
      )}

      {error && (
        <div className="text-red-400 py-6">{error}</div>
      )}

      {!loading && !error && groups && groups.length === 0 && (
        <div className="text-gray-400 py-6">No social activity for this period.</div>
      )}

      {!loading && !error && groups && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((g) => (
            <DayTweets key={g.day} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}


