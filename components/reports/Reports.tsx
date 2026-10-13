"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, CalendarRange, Download, FileBarChart, Filter, Inbox, Printer, Users } from "lucide-react";
import Spinner from "@/components/Spinner";
import { apiFetch, type DateWiseReport, type SalesmanWiseReport, type TodaySummary } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { addDays, daysBetween, startOfMonth, startOfPrevMonth } from "@/lib/dates";
import { formatCurrency, formatShortDate } from "@/lib/format";

type Tab = "date" | "salesman";
type Range = { start: string; end: string };

const TABS: { id: Tab; label: string; icon: typeof FileBarChart }[] = [
  { id: "date", label: "Date-Wise Cash Report", icon: FileBarChart },
  { id: "salesman", label: "Salesman-Wise Cash Report", icon: Users },
];

const PRESETS: { label: string; range: (today: string) => Range }[] = [
  { label: "Today", range: (t) => ({ start: t, end: t }) },
  { label: "Last 7 days", range: (t) => ({ start: addDays(t, -6), end: t }) },
  { label: "This month", range: (t) => ({ start: startOfMonth(t), end: t }) },
  { label: "Last month", range: (t) => ({ start: startOfPrevMonth(t), end: addDays(startOfMonth(t), -1) }) },
  { label: "Last 30 days", range: (t) => ({ start: addDays(t, -29), end: t }) },
];

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/**
 * Fetches `url` whenever it (or `nonce`) changes. Loading is derived by comparing the
 * request key with the last result, and the previous data stays visible while reloading.
 */
function useReport<T>(url: string | null, nonce: number) {
  const key = url ? `${url}#${nonce}` : null;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);

  useEffect(() => {
    if (!url || !key) return;
    const controller = new AbortController();
    apiFetch<T>(url, { signal: controller.signal }).then(
      (data) => setResult({ key, data }),
      (err) => {
        if (!controller.signal.aborted) setResult({ key, error: errorMessage(err, "Failed to load report") });
      },
    );
    return () => controller.abort();
  }, [url, key]);

  const current = result?.key === key ? result : null;
  return {
    data: current ? current.data : result?.data,
    error: current?.error ?? null,
    loading: !!key && !current,
  };
}

export default function Reports() {
  const [today, setToday] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("date");
  const [draft, setDraft] = useState<Range>({ start: "", end: "" });
  const [applied, setApplied] = useState<Range | null>(null);
  const [nonce, setNonce] = useState(0);
  const [hideInactive, setHideInactive] = useState(false);
  const [printedAt, setPrintedAt] = useState<string | null>(null);

  // "Today" comes from the backend so ranges follow APP_TIMEZONE; default range is this month
  const init = useCallback((signal?: AbortSignal) => {
    apiFetch<TodaySummary>("/api/dashboard/today-total", { signal }).then(
      (summary) => {
        const range = { start: startOfMonth(summary.date), end: summary.date };
        setToday(summary.date);
        setDraft(range);
        setApplied(range);
        setInitError(null);
      },
      (err) => {
        if (!signal?.aborted) setInitError(errorMessage(err, "Failed to load"));
      },
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    init(controller.signal);
    return () => controller.abort();
  }, [init]);

  const query = applied ? `start_date=${applied.start}&end_date=${applied.end}` : null;
  const dateWise = useReport<DateWiseReport>(query && `/api/reports/date-wise?${query}`, nonce);
  const salesmanWise = useReport<SalesmanWiseReport>(query && `/api/reports/salesman-wise?${query}`, nonce);
  const active = tab === "date" ? dateWise : salesmanWise;

  const draftError =
    !draft.start || !draft.end
      ? "Select both dates"
      : draft.start > draft.end
        ? "Start date must be on or before end date"
        : today && draft.end > today
          ? "End date can't be in the future"
          : null;

  const applyRange = (range: Range) => {
    setDraft(range);
    if (applied && range.start === applied.start && range.end === applied.end) setNonce((n) => n + 1);
    else setApplied(range);
  };

  const handleApply = (e: FormEvent) => {
    e.preventDefault();
    if (!draftError) applyRange(draft);
  };

  const rangeLabel = applied
    ? applied.start === applied.end
      ? formatShortDate(applied.start)
      : `${formatShortDate(applied.start)} – ${formatShortDate(applied.end)}`
    : "";

  const salesmanRows = salesmanWise.data
    ? hideInactive
      ? salesmanWise.data.rows.filter((r) => r.transaction_count > 0)
      : salesmanWise.data.rows
    : [];

  const exportCsv = () => {
    if (!applied) return;
    const suffix = `${applied.start}_to_${applied.end}`;
    if (tab === "date" && dateWise.data) {
      const r = dateWise.data;
      downloadCsv(`date-wise-report_${suffix}.csv`, [
        ["Date", "Total Transactions", "Total Cash Collected (PKR)"],
        ...r.rows.map((row) => [row.date, row.transaction_count, row.total_amount.toFixed(2)]),
        ["Total", r.transaction_count, r.total_amount.toFixed(2)],
      ]);
    } else if (tab === "salesman" && salesmanWise.data) {
      const r = salesmanWise.data;
      downloadCsv(`salesman-wise-report_${suffix}.csv`, [
        ["Salesman Code", "Salesman Name", "Total Entries", "Total Cash Collected (PKR)"],
        ...salesmanRows.map((row) => [row.salesman_code ?? "", row.name, row.transaction_count, row.total_amount.toFixed(2)]),
        ["Total", "", r.transaction_count, r.total_amount.toFixed(2)],
      ]);
    }
  };

  const canExport = !!active.data && !active.loading && !active.error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 print:text-slate-700">
            {applied ? (
              <>
                {TABS.find((t) => t.id === tab)?.label} · {rangeLabel}
              </>
            ) : (
              "Date-wise and salesman-wise collection reports."
            )}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => {
              setPrintedAt(new Date().toLocaleString("en-PK"));
              // Let React render the timestamp before the print dialog snapshots the page
              requestAnimationFrame(() => window.print());
            }}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Report type" className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60 print:hidden">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                selected
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <form
        onSubmit={handleApply}
        noValidate
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <DateField
            id="start-date"
            label="Start Date"
            value={draft.start}
            max={draft.end || today || undefined}
            disabled={!today}
            onChange={(start) => setDraft((d) => ({ ...d, start }))}
          />
          <DateField
            id="end-date"
            label="End Date"
            value={draft.end}
            min={draft.start || undefined}
            max={today ?? undefined}
            disabled={!today}
            onChange={(end) => setDraft((d) => ({ ...d, end }))}
          />
          <button
            type="submit"
            disabled={!today || !!draftError}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            <Filter className="h-4 w-4" aria-hidden />
            Apply Filter
          </button>
        </div>
        {today && draftError && draft.start && draft.end && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{draftError}</p>
        )}
        {today && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Quick:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyRange(p.range(today))}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </form>

      {initError && (
        <ErrorBanner
          title="Couldn't load reports"
          message={initError}
          onRetry={() => {
            setInitError(null);
            init();
          }}
        />
      )}

      {/* Report panel */}
      <section
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-slate-300 print:shadow-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <CalendarRange className="h-4 w-4" aria-hidden />
            {rangeLabel || "—"}
            {applied && applied.start !== applied.end && (
              <span className="text-xs text-slate-400">({daysBetween(applied.start, applied.end) + 1} days)</span>
            )}
          </div>
          {tab === "salesman" && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 print:hidden">
              <input
                type="checkbox"
                checked={hideInactive}
                onChange={(e) => setHideInactive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
              />
              Hide salesmen with no entries
            </label>
          )}
        </div>

        {active.error ? (
          <div className="p-4">
            <ErrorBanner title="Couldn't load report" message={active.error} onRetry={() => setNonce((n) => n + 1)} />
          </div>
        ) : !active.data ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            {initError ? null : (
              <>
                <Spinner className="h-7 w-7 text-emerald-600" />
                <p className="text-sm text-slate-500">Loading report…</p>
              </>
            )}
          </div>
        ) : (
          <div className="relative">
            {active.loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-slate-900/70">
                <Spinner className="h-7 w-7 text-emerald-600" />
              </div>
            )}
            {tab === "date" && dateWise.data ? (
              dateWise.data.rows.length === 0 ? (
                <EmptyState text="No cash was collected in this date range." />
              ) : (
                <ReportTable
                  headers={["Date", "Total Transactions", "Total Cash Collected"]}
                  numericFrom={1}
                  rows={dateWise.data.rows.map((r) => ({
                    key: r.date,
                    cells: [
                      <time key="d" dateTime={r.date}>
                        {formatShortDate(r.date)}
                      </time>,
                      r.transaction_count.toLocaleString("en-PK"),
                      <span key="a" className="font-semibold">
                        {formatCurrency(r.total_amount)}
                      </span>,
                    ],
                  }))}
                  footer={[
                    `Date Range Total (${dateWise.data.rows.length} ${dateWise.data.rows.length === 1 ? "day" : "days"} with collections)`,
                    dateWise.data.transaction_count.toLocaleString("en-PK"),
                    formatCurrency(dateWise.data.total_amount),
                  ]}
                />
              )
            ) : tab === "salesman" && salesmanWise.data ? (
              salesmanRows.length === 0 ? (
                <EmptyState
                  text={
                    salesmanWise.data.rows.length === 0
                      ? "No salesmen have been added yet."
                      : "No salesman collected cash in this date range."
                  }
                />
              ) : (
                <ReportTable
                  headers={["Salesman Code", "Salesman Name", "Total Entries Made", "Total Cash Collected"]}
                  numericFrom={2}
                  rows={salesmanRows.map((r) => ({
                    key: String(r.person_id),
                    muted: r.transaction_count === 0,
                    cells: [
                      <span
                        key="c"
                        className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300 print:bg-transparent print:p-0"
                      >
                        {r.salesman_code ?? "—"}
                      </span>,
                      <span key="n" className="font-medium">
                        {r.name}
                      </span>,
                      r.transaction_count.toLocaleString("en-PK"),
                      <span key="a" className="font-semibold">
                        {formatCurrency(r.total_amount)}
                      </span>,
                    ],
                  }))}
                  footer={[
                    `Total (${salesmanRows.length} ${salesmanRows.length === 1 ? "salesman" : "salesmen"})`,
                    "",
                    salesmanWise.data.transaction_count.toLocaleString("en-PK"),
                    formatCurrency(salesmanWise.data.total_amount),
                  ]}
                />
              )
            ) : null}
          </div>
        )}
      </section>

      {printedAt && <p className="hidden text-xs text-slate-500 print:block">Generated on {printedAt}</p>}
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex-1">
      <label htmlFor={id} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-900 dark:[color-scheme:dark]"
      />
    </div>
  );
}

function ReportTable({
  headers,
  rows,
  footer,
  numericFrom,
}: {
  headers: string[];
  rows: { key: string; cells: ReactNode[]; muted?: boolean }[];
  footer: ReactNode[];
  /** Columns at or after this index are right-aligned numbers */
  numericFrom: number;
}) {
  const align = (i: number) => (i >= numericFrom ? "text-right tabular-nums" : "text-left");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 print:bg-slate-100">
          <tr>
            {headers.map((h, i) => (
              <th key={h} scope="col" className={`whitespace-nowrap px-5 py-3 ${align(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
          {rows.map((row) => (
            <tr
              key={row.key}
              className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${row.muted ? "text-slate-400 dark:text-slate-500" : ""}`}
            >
              {row.cells.map((cell, i) => (
                <td key={i} className={`whitespace-nowrap px-5 py-3 ${align(i)}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-200 bg-emerald-50/60 font-semibold dark:border-slate-700 dark:bg-emerald-500/5 print:bg-slate-100">
          <tr>
            {footer.map((cell, i) => (
              <td key={i} className={`whitespace-nowrap px-5 py-3 ${align(i)} ${i === footer.length - 1 ? "text-base text-emerald-700 dark:text-emerald-400 print:text-black" : ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Inbox className="h-6 w-6 text-slate-400" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-medium">No data for this range</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

function ErrorBanner({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 opacity-90">{message}</p>
      </div>
      <button type="button" onClick={onRetry} className="font-medium hover:underline">
        Retry
      </button>
    </div>
  );
}
