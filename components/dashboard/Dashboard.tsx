"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Inbox, PlusCircle, Receipt, RefreshCw, Wallet } from "lucide-react";
import Spinner from "@/components/Spinner";
import { apiFetch, type TodaySummary } from "@/lib/api";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";

const REFRESH_INTERVAL_MS = 30_000;

export default function Dashboard() {
  const [data, setData] = useState<TodaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    apiFetch<TodaySummary>("/api/dashboard/today-total", { signal: controller.signal })
      .then(
        (summary) => {
          setData(summary);
          setError(null);
          setUpdatedAt(new Date());
        },
        (err) => {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        },
      )
      .then(() => {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setRefreshing(false);
        }
      });
  }, []);

  // Initial load, periodic refresh, and refresh when the tab regains focus
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      inFlight.current?.abort();
    };
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const initialLoading = !data && !error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {data ? formatDate(data.date) : "Today's cash collection at a glance."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-xs text-slate-400">Updated {formatTime(updatedAt.toISOString())}</span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || initialLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner (keeps showing stale data underneath if we had some) */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t load today&apos;s summary</p>
            <p className="mt-0.5 opacity-90">{error}</p>
          </div>
          <button type="button" onClick={refresh} className="font-medium underline-offset-2 hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Today's Total Cash"
          icon={Wallet}
          accent="emerald"
          loading={initialLoading}
          value={data ? formatCurrency(data.total_amount) : "—"}
        />
        <StatCard
          label="Today's Entries"
          icon={Receipt}
          accent="sky"
          loading={initialLoading}
          value={data ? data.transaction_count.toLocaleString() : "—"}
        />
        <Link
          href="/cash-entry"
          className="group flex flex-col justify-between rounded-xl bg-emerald-600 p-5 text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-50">Quick Action</span>
            <PlusCircle className="h-6 w-6 text-emerald-100" aria-hidden />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-lg font-semibold">Record Cash Entry</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
          </div>
        </Link>
      </div>

      {/* Recent activity */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">Recent Activity</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Last 5 entries today</p>
          </div>
          <Link
            href="/daily-log"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
          >
            View all
          </Link>
        </div>

        {initialLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Spinner className="h-7 w-7 text-emerald-600" />
            <p className="text-sm text-slate-500">Loading recent entries…</p>
          </div>
        ) : !data || data.recent_transactions.length === 0 ? (
          <EmptyState hasError={!data} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3">Time</th>
                  <th scope="col" className="px-5 py-3">Salesman Code</th>
                  <th scope="col" className="px-5 py-3">Salesman Name</th>
                  <th scope="col" className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recent_transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">
                      {formatTime(t.transaction_time)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {t.person.salesman_code ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">{t.person.name}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const ACCENTS = {
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  accent: keyof typeof ACCENTS;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${ACCENTS[accent]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="mt-4 h-9">
        {loading ? (
          <div className="h-8 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        ) : (
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasError }: { hasError: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Inbox className="h-6 w-6 text-slate-400" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-medium">{hasError ? "No data available" : "No entries yet today"}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {hasError
          ? "Recent entries will appear here once the backend is reachable."
          : "Cash received from salesmen will show up here."}
      </p>
      {!hasError && (
        <Link
          href="/cash-entry"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <PlusCircle className="h-4 w-4" aria-hidden />
          Record first entry
        </Link>
      )}
    </div>
  );
}
