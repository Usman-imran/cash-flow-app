"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import Spinner from "@/components/Spinner";
import { apiFetch, type PersonSummary } from "@/lib/api";

/** Mount only while open; unmounting resets its state. */
export default function RemoveSalesmanDialog({
  person,
  onClose,
  onRemoved,
}: {
  person: PersonSummary;
  onClose: () => void;
  onRemoved: (person: PersonSummary) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  // Salesmen with recorded cash entries are kept so the history stays intact
  const inUse = person.transaction_count > 0;
  const label = person.salesman_code ? `${person.salesman_code} - ${person.name}` : person.name;

  // See AddSalesmanModal for why there's no close() in cleanup
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await apiFetch<void>(`/api/persons/${person.id}`, { method: "DELETE" });
      onRemoved(person);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove salesman");
      setRemoving(false);
    }
  };

  const entries = person.transaction_count === 1 ? "1 cash entry" : `${person.transaction_count} cash entries`;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => removing && e.preventDefault()}
      onClick={(e) => e.target === dialogRef.current && !removing && onClose()}
      aria-labelledby="remove-salesman-title"
      aria-describedby="remove-salesman-text"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              inUse
                ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            }`}
          >
            {inUse ? <AlertTriangle className="h-5 w-5" aria-hidden /> : <Trash2 className="h-5 w-5" aria-hidden />}
          </span>
          <div>
            <h2 id="remove-salesman-title" className="text-lg font-semibold">
              {inUse ? "Can't remove salesman" : "Remove salesman?"}
            </h2>
            <p id="remove-salesman-text" className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {inUse ? (
                <>
                  <span className="font-medium">{label}</span> has {entries} recorded. Salesmen with cash entries
                  are kept so your logs and reports stay accurate. You can still rename them.
                </>
              ) : (
                <>
                  <span className="font-medium">{label}</span> will be removed permanently. This can&apos;t be
                  undone.
                </>
              )}
            </p>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={removing}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {inUse ? "Close" : "Cancel"}
          </button>
          {!inUse && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
            >
              {removing ? <Spinner className="h-4 w-4 text-white" label="Removing" /> : <Trash2 className="h-4 w-4" aria-hidden />}
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
