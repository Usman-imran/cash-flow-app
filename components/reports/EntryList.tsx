"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import DeleteEntryDialog from "@/components/daily-log/DeleteEntryDialog";
import EditEntryModal from "@/components/daily-log/EditEntryModal";
import { apiFetch, type Transaction } from "@/lib/api";
import { formatCurrency, formatExactTime, formatShortDate, noteBreakdown } from "@/lib/format";

/**
 * The individual entries behind one report row, each with Edit and Delete.
 * Refetches when `url` or `nonce` changes; calls `onChanged` after an edit or delete
 * so the report totals can reload too.
 */
export default function EntryList({
  url,
  nonce,
  showDate,
  showSalesman,
  onChanged,
}: {
  url: string;
  nonce: number;
  showDate: boolean;
  showSalesman: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const key = `${url}#${nonce}`;
  const [result, setResult] = useState<{ key: string; entries?: Transaction[]; error?: string } | null>(null);
  const [dialog, setDialog] = useState<{ kind: "edit" | "delete"; entry: Transaction } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Transaction[]>(url, { signal: controller.signal }).then(
      (entries) => setResult({ key, entries }),
      (err) => {
        if (!controller.signal.aborted)
          setResult({ key, error: err instanceof Error ? err.message : "Failed to load entries" });
      },
    );
    return () => controller.abort();
  }, [url, key]);

  const handleSaved = (updated: Transaction) => {
    setDialog(null);
    toast({
      title: "Entry updated",
      description: `${formatCurrency(updated.amount)} from ${updated.person.name}.`,
    });
    onChanged();
  };

  const handleDeleted = (deleted: Transaction) => {
    setDialog(null);
    toast({
      title: "Entry deleted",
      description: `${formatCurrency(deleted.amount)} from ${deleted.person.name} was removed.`,
    });
    onChanged();
  };

  // Keep showing the previous list while reloading
  const entries = result?.entries;
  const loading = result?.key !== key;

  return (
    <div className="border-y border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      {result?.error && !loading ? (
        <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {result.error}
        </p>
      ) : !entries ? (
        <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-emerald-600" />
          Loading entries…
        </div>
      ) : entries.length === 0 ? (
        <p className="py-2 text-sm text-slate-500 dark:text-slate-400">No entries left in this row.</p>
      ) : (
        <div className={`overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${loading ? "opacity-60" : ""}`}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th scope="col" className="whitespace-nowrap px-4 py-2">{showDate ? "Date & Time" : "Time"}</th>
                {showSalesman && <th scope="col" className="whitespace-nowrap px-4 py-2">Salesman</th>}
                <th scope="col" className="whitespace-nowrap px-4 py-2 text-right">Amount</th>
                <th scope="col" className="px-4 py-2">Notes</th>
                <th scope="col" className="px-4 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                    <time dateTime={t.transaction_time}>
                      {showDate && `${formatShortDate(t.transaction_time.slice(0, 10))}, `}
                      {formatExactTime(t.transaction_time)}
                    </time>
                  </td>
                  {showSalesman && (
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="mr-2 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {t.person.salesman_code ?? "—"}
                      </span>
                      <span className="font-medium">{t.person.name}</span>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(t.amount)}
                    {t.denomination && (
                      <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {noteBreakdown(t.denomination)}
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-2 text-slate-600 dark:text-slate-400">
                    {t.notes ? (
                      <span className="line-clamp-2" title={t.notes}>
                        {t.notes}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: "edit", entry: t })}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        aria-label={`Edit entry from ${t.person.name} at ${formatExactTime(t.transaction_time)}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: "delete", entry: t })}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        aria-label={`Delete entry from ${t.person.name} at ${formatExactTime(t.transaction_time)}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === "edit" && (
        <EditEntryModal entry={dialog.entry} onClose={() => setDialog(null)} onSaved={handleSaved} />
      )}
      {dialog?.kind === "delete" && (
        <DeleteEntryDialog entry={dialog.entry} onClose={() => setDialog(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
