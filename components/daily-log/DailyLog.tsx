"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, Inbox, Pencil, PlusCircle, RefreshCw, Search, SearchX, X } from "lucide-react";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import EditEntryModal from "@/components/daily-log/EditEntryModal";
import { apiFetch, DENOMINATIONS, type NoteCounts, type Transaction } from "@/lib/api";
import { formatCurrency, formatExactTime, formatLongDate, formatTime } from "@/lib/format";

/** Lowercase and drop separators so "sm0001", "SM-0001" and "sm 0001" all match. */
function normalize(value: string) {
  return value.toLowerCase().replace(/[\s-]+/g, "");
}

/** e.g. "2×5000 · 3×100 · coins 7" */
function noteBreakdown(counts: NoteCounts) {
  const parts = DENOMINATIONS.filter((d) => counts[`note_${d}`] > 0).map((d) => `${counts[`note_${d}`]}×${d}`);
  if (counts.coins > 0) parts.push(`coins ${counts.coins}`);
  return parts.join(" · ");
}

function sumAmounts(list: Transaction[]) {
  return list.reduce((total, t) => total + t.amount, 0);
}

export default function DailyLog() {
  const toast = useToast();
  const [entries, setEntries] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    apiFetch<Transaction[]>("/api/transactions/today", { signal: controller.signal })
      .then(
        (list) => {
          // Newest first (backend already sorts; keep it guaranteed client-side)
          const sorted = [...list].sort(
            (a, b) => Date.parse(b.transaction_time) - Date.parse(a.transaction_time) || b.id - a.id,
          );
          setEntries(sorted);
          setError(null);
          setLoadedAt(new Date());
        },
        (err) => {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : "Failed to load today's entries");
        },
      )
      .then(() => {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setRefreshing(false);
        }
      });
  }, []);

  useEffect(() => {
    load();
    return () => inFlight.current?.abort();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const handleSaved = (updated: Transaction) => {
    setEditing(null);
    toast({
      title: "Entry updated",
      description: `${formatCurrency(updated.amount)} from ${updated.person.name}.`,
    });
    // Refetch: the time may have moved the entry to another day or position
    setRefreshing(true);
    load();
  };

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    const qCode = normalize(q);
    return entries.filter(
      (t) =>
        t.person.name.toLowerCase().includes(q) ||
        (!!qCode && normalize(t.person.salesman_code ?? "").includes(qCode)),
    );
  }, [entries, query]);

  const totalToday = entries ? sumAmounts(entries) : 0;
  const isFiltering = query.trim().length > 0;
  const filteredTotal = isFiltering ? sumAmounts(filtered) : totalToday;
  const initialLoading = !entries && !error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Log</h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {loadedAt ? formatLongDate(loadedAt) : "Today"}
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-3">
          <div className="min-w-44 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-500/10">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Total collected today
            </p>
            {initialLoading ? (
              <div className="mt-1.5 h-7 w-28 animate-pulse rounded bg-emerald-200/70 dark:bg-emerald-900/50" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                {entries ? formatCurrency(totalToday) : "—"}
              </p>
            )}
          </div>
          <div className="min-w-28 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Entries</p>
            {initialLoading ? (
              <div className="mt-1.5 h-7 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{entries ? entries.length : "—"}</p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t load today&apos;s entries</p>
            <p className="mt-0.5 opacity-90">{error}</p>
          </div>
          <button type="button" onClick={refresh} className="font-medium hover:underline">
            Retry
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="Search by salesman name or code (SM-0001)"
              aria-label="Search entries by salesman name or code"
              disabled={!entries}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-900 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {loadedAt && (
              <span className="text-xs text-slate-400">Updated {formatTime(loadedAt.toISOString())}</span>
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

        {initialLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Spinner className="h-7 w-7 text-emerald-600" />
            <p className="text-sm text-slate-500">Loading today&apos;s entries…</p>
          </div>
        ) : !entries ? (
          <Empty icon={Inbox} title="No data available" text="Entries will appear here once the backend is reachable." />
        ) : entries.length === 0 ? (
          <Empty icon={Inbox} title="No entries yet today" text="Cash received from salesmen will show up here.">
            <Link
              href="/cash-entry"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <PlusCircle className="h-4 w-4" aria-hidden />
              Record an entry
            </Link>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty icon={SearchX} title="No matching entries" text={`Nothing matches “${query.trim()}”.`}>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-4 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Clear search
            </button>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-5 py-3">Exact Time</th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3">Salesman Code</th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3">Salesman Name</th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">Amount</th>
                  <th scope="col" className="px-5 py-3">Notes</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      <time dateTime={t.transaction_time}>{formatExactTime(t.transaction_time)}</time>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {t.person.salesman_code ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{t.person.name}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(t.amount)}
                      {t.denomination && (
                        <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                          {noteBreakdown(t.denomination)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-5 py-3 text-slate-600 dark:text-slate-400">
                      {t.notes ? (
                        <span className="line-clamp-2" title={t.notes}>
                          {t.notes}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        aria-label={`Edit entry from ${t.person.name} at ${formatExactTime(t.transaction_time)}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 text-sm dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {isFiltering
                      ? `Showing ${filtered.length} of ${entries.length} entries`
                      : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums">
                    {formatCurrency(filteredTotal)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {editing && <EditEntryModal entry={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: typeof Inbox;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Icon className="h-6 w-6 text-slate-400" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text}</p>
      {children}
    </div>
  );
}
