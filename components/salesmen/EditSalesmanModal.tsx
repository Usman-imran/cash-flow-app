"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, X } from "lucide-react";
import Spinner from "@/components/Spinner";
import { apiFetch, type PersonSummary } from "@/lib/api";

/** Mount only while open; unmounting resets its state. */
export default function EditSalesmanModal({
  person,
  onClose,
  onSaved,
}: {
  person: PersonSummary;
  onClose: () => void;
  onSaved: (person: PersonSummary) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(person.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // See AddSalesmanModal for why there's no close() in cleanup
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (trimmed === person.name) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<PersonSummary>(`/api/persons/${person.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: trimmed }),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update salesman");
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => saving && e.preventDefault()}
      onClick={(e) => e.target === dialogRef.current && !saving && onClose()}
      aria-labelledby="edit-salesman-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Pencil className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 id="edit-salesman-title" className="text-lg font-semibold">
                Edit Salesman
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Code {person.salesman_code ?? "—"} stays the same.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label htmlFor="edit-salesman-name" className="mt-6 block text-sm font-medium">
          Salesman name
        </label>
        <input
          id="edit-salesman-name"
          type="text"
          autoFocus
          maxLength={120}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "edit-salesman-name-error" : undefined}
          className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 dark:bg-slate-950 ${
            error
              ? "border-red-400 focus:ring-red-200 dark:border-red-700 dark:focus:ring-red-900"
              : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-100 dark:border-slate-700 dark:focus:ring-emerald-900"
          }`}
        />
        {error && (
          <p id="edit-salesman-name-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-70"
          >
            {saving && <Spinner className="h-4 w-4 text-white" label="Saving" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
