"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eraser,
  RefreshCw,
  Save,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Spinner from "@/components/Spinner";
import NoteCountTable, {
  countsFrom,
  emptyCounts,
  isEmpty,
  notesCountOf,
  sameCounts,
  toNoteCounts,
  totalOf,
  type Counts,
} from "@/components/denomination/NoteCountTable";
import { useToast } from "@/components/Toast";
import {
  ApiError,
  apiFetch,
  type DateWiseReport,
  type Denomination,
  type DenominationInput,
  type TodaySummary,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

// ---------- Data loading ----------

function fetchDenomination(date: string, signal?: AbortSignal) {
  return apiFetch<Denomination>(`/api/denominations/${date}`, { signal }).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null; // nothing saved for that date yet
    throw err;
  });
}

/** Logged cash total for a date: dashboard endpoint for today, date-wise report for past dates. */
function fetchLoggedTotal(date: string, today: string, signal?: AbortSignal) {
  if (date === today) {
    return apiFetch<TodaySummary>("/api/dashboard/today-total", { signal }).then((s) => s.total_amount);
  }
  return apiFetch<DateWiseReport>(`/api/reports/date-wise?start_date=${date}&end_date=${date}`, { signal }).then(
    (r) => r.total_amount,
  );
}

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export default function DenominationCalculator() {
  const toast = useToast();

  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [baseline, setBaseline] = useState<Counts>(emptyCounts); // last saved/loaded values
  const [hasSavedEntry, setHasSavedEntry] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggedTotal, setLoggedTotal] = useState<number | null>(null);
  const [loggedLoading, setLoggedLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const inFlight = useRef<AbortController | null>(null);

  const startRequest = () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    return controller;
  };

  const applyEntry = (entry: Denomination | null) => {
    const loaded = countsFrom(entry);
    setCounts(loaded);
    setBaseline(loaded);
    setHasSavedEntry(!!entry);
  };

  // Initial load: the backend decides what "today" is, so the default date follows APP_TIMEZONE
  const init = useCallback(() => {
    const controller = startRequest();
    apiFetch<TodaySummary>("/api/dashboard/today-total", { signal: controller.signal })
      .then((summary) =>
        fetchDenomination(summary.date, controller.signal).then((entry) => ({ summary, entry })),
      )
      .then(
        ({ summary, entry }) => {
          setToday(summary.date);
          setDate(summary.date);
          setLoggedTotal(summary.total_amount);
          applyEntry(entry);
          setLoadError(null);
          setLoading(false);
        },
        (err) => {
          if (controller.signal.aborted) return;
          setLoadError(errorMessage(err, "Failed to load"));
          setLoading(false);
        },
      );
  }, []);

  useEffect(() => {
    init();
    return () => inFlight.current?.abort();
  }, [init]);

  const loadDate = (nextDate: string) => {
    if (!today) return;
    const controller = startRequest();
    setLoading(true);
    setLoadError(null);
    setLoggedTotal(null);

    Promise.all([
      fetchDenomination(nextDate, controller.signal),
      fetchLoggedTotal(nextDate, today, controller.signal),
    ]).then(
      ([entry, logged]) => {
        applyEntry(entry);
        setLoggedTotal(logged);
        setLoading(false);
      },
      (err) => {
        if (controller.signal.aborted) return;
        setLoadError(errorMessage(err, "Failed to load"));
        setLoading(false);
      },
    );
  };

  const refreshLogged = () => {
    if (!today || !date) return;
    setLoggedLoading(true);
    fetchLoggedTotal(date, today)
      .then(setLoggedTotal, (err) =>
        toast({ variant: "error", title: "Couldn't refresh logged total", description: errorMessage(err, "") }),
      )
      .finally(() => setLoggedLoading(false));
  };

  const countedTotal = totalOf(counts);
  const isDirty = !sameCounts(counts, baseline);
  const nothingCounted = isEmpty(counts);
  const notesCount = notesCountOf(counts);

  const handleDateChange = (nextDate: string) => {
    if (!nextDate || nextDate === date) return;
    if (today && nextDate > today) return;
    if (isDirty && !window.confirm("You have unsaved counts for this date. Discard them?")) return;
    setDate(nextDate);
    loadDate(nextDate);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: DenominationInput = { entry_date: date, ...toNoteCounts(counts) };
      const saved = await apiFetch<Denomination>("/api/denominations", {
        method: "POST",
        body: JSON.stringify(body),
      });
      applyEntry(saved);
      toast({
        title: "Denomination saved",
        description: `${formatCurrency(saved.total_amount)} counted for ${formatDate(saved.entry_date)}.`,
      });
    } catch (err) {
      toast({ variant: "error", title: "Couldn't save denomination", description: errorMessage(err, "Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving || !!loadError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Denomination</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Count the notes in hand and reconcile them with the logged cash.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label htmlFor="entry-date" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Date
            </label>
            <input
              id="entry-date"
              type="date"
              value={date}
              max={today ?? undefined}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={!today || saving}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-900 dark:[color-scheme:dark]"
            />
          </div>
          {today && date !== today && (
            <button
              type="button"
              onClick={() => handleDateChange(today)}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t load denomination data</p>
            <p className="mt-0.5 opacity-90">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (today) return loadDate(date);
              setLoading(true);
              setLoadError(null);
              init();
            }}
            className="font-medium hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Denomination table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Note Count</h2>
              {!loading && !loadError && (
                <StatusPill dirty={isDirty} saved={hasSavedEntry} />
              )}
            </div>
            <button
              type="button"
              onClick={() => setCounts(emptyCounts())}
              disabled={disabled || nothingCounted}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Eraser className="h-4 w-4" aria-hidden />
              Clear all
            </button>
          </div>

          <div className="relative overflow-x-auto">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-slate-900/70">
                <Spinner className="h-7 w-7 text-emerald-600" />
              </div>
            )}
            <NoteCountTable counts={counts} onChange={setCounts} disabled={disabled} />
          </div>
        </section>

        {/* Side panel */}
        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-xl bg-emerald-600 p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-emerald-50">Total Cash Counted</p>
            <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{formatCurrency(countedTotal)}</p>
            <p className="mt-1 text-sm text-emerald-100">
              {date ? formatDate(date) : "—"} · {notesCount.toLocaleString("en-PK")} notes
            </p>
          </div>

          <Reconciliation
            counted={countedTotal}
            logged={loggedTotal}
            nothingCounted={nothingCounted}
            loading={loading || loggedLoading}
            isToday={!!today && date === today}
            onRefresh={refreshLogged}
            canRefresh={!loading && !loadError}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || (!isDirty && hasSavedEntry)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? <Spinner className="h-4 w-4 text-white" label="Saving" /> : <Save className="h-4 w-4" aria-hidden />}
            {saving ? "Saving…" : hasSavedEntry ? "Update Denomination Entry" : "Save Denomination Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  if (dirty)
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
        Unsaved changes
      </span>
    );
  if (saved)
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
        Saved
      </span>
    );
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      New entry
    </span>
  );
}

const STATUS_STYLES = {
  matched: {
    label: "Matched",
    icon: CheckCircle2,
    box: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  shortage: {
    label: "Shortage",
    icon: TrendingDown,
    box: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
  },
  excess: {
    label: "Excess",
    icon: TrendingUp,
    box: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
  },
} as const;

function Reconciliation({
  counted,
  logged,
  nothingCounted,
  loading,
  isToday,
  onRefresh,
  canRefresh,
}: {
  counted: number;
  logged: number | null;
  nothingCounted: boolean;
  loading: boolean;
  isToday: boolean;
  onRefresh: () => void;
  canRefresh: boolean;
}) {
  const diff = logged === null ? 0 : Math.round((counted - logged) * 100) / 100;
  const status = diff === 0 ? "matched" : diff < 0 ? "shortage" : "excess";
  const style = STATUS_STYLES[status];
  const Icon = style.icon;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Reconciliation</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!canRefresh || loading}
          className="rounded p-1 text-slate-400 hover:text-slate-600 disabled:opacity-40 dark:hover:text-slate-200"
          aria-label="Refresh logged total"
          title="Refresh logged total"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500 dark:text-slate-400">{isToday ? "Today's logged total" : "Logged total"}</dt>
          <dd className="font-medium tabular-nums">
            {logged === null ? (
              <span className="inline-block h-4 w-20 animate-pulse rounded bg-slate-200 align-middle dark:bg-slate-800" />
            ) : (
              formatCurrency(logged)
            )}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500 dark:text-slate-400">Counted total</dt>
          <dd className="font-medium tabular-nums">{formatCurrency(counted)}</dd>
        </div>
      </dl>

      <div className="mt-4" aria-live="polite">
        {logged === null ? null : nothingCounted && logged > 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            Enter note counts to reconcile.
          </div>
        ) : (
          <div className={`flex items-center gap-3 rounded-lg border p-3 ${style.box}`}>
            <Icon className={`h-6 w-6 shrink-0 ${style.text}`} aria-hidden />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${style.text}`}>{style.label}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {status === "matched"
                  ? "Counted cash equals the logged total."
                  : status === "shortage"
                    ? "Counted cash is less than logged."
                    : "Counted cash is more than logged."}
              </p>
            </div>
            {status !== "matched" && (
              <p className={`whitespace-nowrap text-base font-bold tabular-nums ${style.text}`}>
                {diff > 0 ? "+" : "−"}
                {formatCurrency(Math.abs(diff))}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
