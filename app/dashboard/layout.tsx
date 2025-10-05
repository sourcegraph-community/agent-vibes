import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Apify Pipeline Dashboard',
  description: 'View sentiment analysis results and keyword trends',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <nav className="border-b border-[var(--surface-border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-semibold tracking-tight">AgentVibes Dashboard</h1>
              <div className="flex space-x-6">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--surface-border)] hover:text-[var(--foreground)]"
                >
                  Overview
                </Link>
                <Link
                  href="/dashboard/keywords"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--surface-border)] hover:text-[var(--foreground)]"
                >
                  Keywords
                </Link>
                <Link
                  href="/dashboard/tweets"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--surface-border)] hover:text-[var(--foreground)]"
                >
                  Tweets
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
