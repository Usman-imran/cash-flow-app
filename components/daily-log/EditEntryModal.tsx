"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Eraser, Pencil, X } from "lucide-react";
import Spinner from "@/components/Spinner";
import SalesmanSearch from "@/components/cash-entry/SalesmanSearch";
import NoteCountTable, {
  countsFrom,
  emptyCounts,
  isEmpty,
  toNoteCounts,
  totalOf,
  type Counts,
} from "@/components/denomination/NoteCountTable";
import { apiFetch, type Person, type PersonBrief, type Transaction } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type FieldErrors = Partial<Record<"person" | "amount" | "time", string>>;

/** ISO timestamp formatted for <input type="datetime-local"> in local time */
function toInputTime(iso: string) {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function personLabel(p: PersonBrief) {
  return p.salesman_code ? `${p.salesman_code} - ${p.name}` : p.name;
}

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950";
const inputOk =
  "border-slate-300 focus:border-emerald-500 focus:ring-emerald-100 dark:border-slate-700 dark:focus:ring-emerald-900";
const inputErr = "border-red-400 focus:ring-red-200 dark:border-red-700 dark:focus:ring-red-900";

/** Mount only while open; unmounting resets its state. */
export default function EditEntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: Transaction;
  onClose: () => void;
  onSaved: (entry: Transaction) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [persons, setPersons] = useState<Person[]>([]);
  const [personsLoading, setPersonsLoading] = useState(true);
  const [personsError, setPersonsError] = useState<string | null>(null);

  const [personId, setPersonId] = useState(String(entry.person_id));
  const [counts, setCounts] = useState<Counts>(() => countsFrom(entry.denomination));
  const [time, setTime] = useState(() => toInputTime(entry.transaction_time));
  const [notes, setNotes] = useState(entry.notes ?? "");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // See AddSalesmanModal for why there's no close() in cleanup
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Person[]>("/api/persons", { signal: controller.signal })
      .then(
        (list) => setPersons(list),
        (err) => {
          if (controller.signal.aborted) return;
          setPersonsError(err instanceof Error ? err.message : "Failed to load salesmen");
        },
      )
      .then(() => {
        if (!controller.signal.aborted) setPersonsLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Entries saved without a note breakdown keep their amount unless notes are counted now
  const keepsTypedAmount = !entry.denomination && isEmpty(counts);
  const total = keepsTypedAmount ? entry.amount : totalOf(counts);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!personId) next.person = "Select a salesman";
    if (total <= 0) next.amount = "Enter the notes or coins received";
    if (!time) next.time = "Pick a date and time";
    else if (new Date(time).getTime() > Date.now() + 60_000) next.time = "Time can't be in the future";
    return next;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<Transaction>(`/api/transactions/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify({
          person_id: Number(personId),
          amount: String(total),
          denomination: keepsTypedAmount ? null : toNoteCounts(counts),
          notes: notes.trim() || null,
          // Unchanged minute -> keep the original (to-the-second) time
          transaction_time:
            time === toInputTime(entry.transaction_time) ? undefined : new Date(time).toISOString(),
        }),
      });
      onSaved(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update entry");
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => saving && e.preventDefault()}
      onClick={(e) => e.target === dialogRef.current && !saving && onClose()}
      aria-labelledby="edit-entry-title"
      className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Pencil className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 id="edit-entry-title" className="text-lg font-semibold">
                Edit Entry
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Originally {formatCurrency(entry.amount)} from {personLabel(entry.person)}.
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

        {/* Salesman */}
        <div>
          <label htmlFor="edit-entry-person" className="text-sm font-medium">
            Salesman <span className="text-red-500">*</span>
          </label>
          {personsError ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{personsError}</span>
            </div>
          ) : (
            <div className="mt-1.5">
              <SalesmanSearch
                id="edit-entry-person"
                persons={persons}
                value={personId}
                onChange={(id) => {
                  setPersonId(id);
                  setErrors((er) => ({ ...er, person: undefined }));
                }}
                label={personLabel}
                loading={personsLoading}
                disabled={saving}
                invalid={!!errors.person}
                describedBy={errors.person ? "edit-entry-person-error" : undefined}
                className={`${inputBase} ${errors.person ? inputErr : inputOk}`}
              />
            </div>
          )}
          {errors.person && (
            <p id="edit-entry-person-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
              {errors.person}
            </p>
          )}
        </div>

        {/* Amount: notes + coins */}
        <div>
          <span id="edit-entry-amount-label" className="text-sm font-medium">
            Cash Received <span className="text-red-500">*</span>
          </span>
          <div
            role="group"
            aria-labelledby="edit-entry-amount-label"
            className={`mt-1.5 overflow-x-auto rounded-lg border ${
              errors.amount ? "border-red-400 dark:border-red-700" : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <NoteCountTable
              counts={counts}
              onChange={(update) => {
                setCounts(update);
                setErrors((er) => ({ ...er, amount: undefined }));
              }}
              disabled={saving}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-sm">
            {errors.amount ? (
              <p className="text-red-600 dark:text-red-400">{errors.amount}</p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                {keepsTypedAmount
                  ? `No note breakdown was recorded. Leave blank to keep ${formatCurrency(entry.amount)}.`
                  : `Amount received: ${formatCurrency(total)}`}
              </p>
            )}
            <button
              type="button"
              onClick={() => setCounts(emptyCounts())}
              disabled={saving || isEmpty(counts)}
              className="inline-flex shrink-0 items-center gap-1.5 font-medium text-slate-500 hover:text-slate-700 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Eraser className="h-4 w-4" aria-hidden />
              Clear
            </button>
          </div>
        </div>

        {/* Transaction time */}
        <div>
          <label htmlFor="edit-entry-time" className="text-sm font-medium">
            Transaction Time <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-entry-time"
            type="datetime-local"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setErrors((er) => ({ ...er, time: undefined }));
            }}
            disabled={saving}
            aria-invalid={!!errors.time}
            aria-describedby={errors.time ? "edit-entry-time-error" : undefined}
            className={`${inputBase} ${errors.time ? inputErr : inputOk} mt-1.5`}
          />
          {errors.time && (
            <p id="edit-entry-time-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
              {errors.time}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="edit-entry-notes" className="text-sm font-medium">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="edit-entry-notes"
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            className={`${inputBase} ${inputOk} mt-1.5 resize-y`}
          />
        </div>

        {saveError && (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {saveError}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
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
            disabled={saving || personsLoading}
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
