"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import Spinner from "@/components/Spinner";
import { apiFetch, type Transaction } from "@/lib/api";
import { formatCurrency, formatExactTime } from "@/lib/format";

/** Mount only while open; unmounting resets its state. */
export default function DeleteEntryDialog({
  entry,
  onClose,
  onDeleted,
}: {
  entry: Transaction;
  onClose: () => void;
  onDeleted: (entry: Transaction) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const label = entry.person.salesman_code ? `${entry.person.salesman_code} - ${entry.person.name}` : entry.person.name;

  // See AddSalesmanModal for why there's no close() in cleanup
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch<void>(`/api/transactions/${entry.id}`, { method: "DELETE" });
      onDeleted(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
      setDeleting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => deleting && e.preventDefault()}
      onClick={(e) => e.target === dialogRef.current && !deleting && onClose()}
      aria-labelledby="delete-entry-title"
      aria-describedby="delete-entry-text"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <Trash2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 id="delete-entry-title" className="text-lg font-semibold">
              Delete entry?
            </h2>
            <p id="delete-entry-text" className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">{formatCurrency(entry.amount)}</span> from{" "}
              <span className="font-medium">{label}</span> at {formatExactTime(entry.transaction_time)} will be
              deleted permanently. This can&apos;t be undone.
            </p>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
          >
            {deleting ? <Spinner className="h-4 w-4 text-white" label="Deleting" /> : <Trash2 className="h-4 w-4" aria-hidden />}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
