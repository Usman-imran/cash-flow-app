"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, CalendarClock, Clock, Eraser, History, Save, UserPlus } from "lucide-react";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import AddSalesmanModal from "@/components/cash-entry/AddSalesmanModal";
import NoteCountTable, {
  emptyCounts,
  isEmpty,
  toNoteCounts,
  totalOf,
  type Counts,
} from "@/components/denomination/NoteCountTable";
import { apiFetch, type Person, type PersonBrief, type Transaction } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type FieldErrors = Partial<Record<"person" | "amount" | "time", string>>;

/** Current local time formatted for <input type="datetime-local"> */
function nowForInput() {
  const d = new Date();
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

export default function CashEntryForm() {
  const toast = useToast();

  // Salesmen
  const [persons, setPersons] = useState<Person[]>([]);
  const [personsLoading, setPersonsLoading] = useState(true);
  const [personsError, setPersonsError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form fields
  const [personId, setPersonId] = useState("");
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [notes, setNotes] = useState("");
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customTime, setCustomTime] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  const loadPersons = useCallback((signal?: AbortSignal) => {
    apiFetch<Person[]>("/api/persons", { signal })
      .then(
        (list) => {
          setPersons(list);
          setPersonsError(null);
        },
        (err) => {
          if (signal?.aborted) return;
          setPersonsError(err instanceof Error ? err.message : "Failed to load salesmen");
        },
      )
      .then(() => {
        if (!signal?.aborted) setPersonsLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPersons(controller.signal);
    return () => controller.abort();
  }, [loadPersons]);

  const retryPersons = () => {
    setPersonsLoading(true);
    setPersonsError(null);
    loadPersons();
  };

  const handleSalesmanCreated = (person: Person) => {
    setPersons((list) => [...list, person].sort((a, b) => a.id - b.id));
    setPersonId(String(person.id));
    setErrors((e) => ({ ...e, person: undefined }));
    setModalOpen(false);
    toast({ title: "Salesman added", description: `${personLabel(person)} is now selected.` });
  };

  // The amount received is always the total of the counted notes and coins
  const total = totalOf(counts);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!personId) next.person = "Select a salesman";

    if (total <= 0) next.amount = "Enter the notes or coins received";

    if (useCustomTime) {
      if (!customTime) next.time = "Pick a date and time";
      else if (new Date(customTime).getTime() > Date.now() + 60_000) next.time = "Time can't be in the future";
    }
    return next;
  };

  const resetForm = () => {
    setPersonId("");
    setCounts(emptyCounts());
    setNotes("");
    setUseCustomTime(false);
    setCustomTime("");
    setErrors({});
    selectRef.current?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      const txn = await apiFetch<Transaction>("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          person_id: Number(personId),
          amount: String(total),
          denomination: toNoteCounts(counts),
          notes: notes.trim() || null,
          // Omitted -> backend stamps the current time
          transaction_time: useCustomTime ? new Date(customTime).toISOString() : undefined,
        }),
      });
      toast({
        title: `${formatCurrency(txn.amount)} recorded`,
        description: `Cash received from ${personLabel(txn.person)}.`,
      });
      resetForm();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't save entry",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cash Entry</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Record cash received from a salesman.</p>
        </div>
        <Link
          href="/daily-log"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
        >
          <History className="h-4 w-4" aria-hidden />
          Today&apos;s log
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Salesman */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="person" className="text-sm font-medium">
              Salesman <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Add New Salesman
            </button>
          </div>

          {personsError ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{personsError}</span>
              <button type="button" onClick={retryPersons} className="font-medium hover:underline">
                Retry
              </button>
            </div>
          ) : (
            <div className="relative mt-1.5">
              <select
                id="person"
                ref={selectRef}
                value={personId}
                onChange={(e) => {
                  setPersonId(e.target.value);
                  setErrors((er) => ({ ...er, person: undefined }));
                }}
                disabled={personsLoading || submitting}
                aria-invalid={!!errors.person}
                aria-describedby={errors.person ? "person-error" : undefined}
                className={`${inputBase} ${errors.person ? inputErr : inputOk} ${personsLoading ? "pr-10" : ""}`}
              >
                <option value="">
                  {personsLoading
                    ? "Loading salesmen…"
                    : persons.length === 0
                      ? "No salesmen yet — add one first"
                      : "Select a salesman"}
                </option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </select>
              {personsLoading && (
                <span className="pointer-events-none absolute inset-y-0 right-8 flex items-center">
                  <Spinner className="h-4 w-4 text-slate-400" />
                </span>
              )}
            </div>
          )}
          {errors.person && (
            <p id="person-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
              {errors.person}
            </p>
          )}
        </div>

        {/* Amount: notes + coins */}
        <div>
          <span id="amount-label" className="text-sm font-medium">
            Cash Received <span className="text-red-500">*</span>
          </span>
          <div
            role="group"
            aria-labelledby="amount-label"
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
              disabled={submitting}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-sm">
            {errors.amount ? (
              <p id="amount-error" className="text-red-600 dark:text-red-400">
                {errors.amount}
              </p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                {total > 0
                  ? `Amount received: ${formatCurrency(total)}`
                  : "Count each note, and enter coins as a rupee amount."}
              </p>
            )}
            <button
              type="button"
              onClick={() => setCounts(emptyCounts())}
              disabled={submitting || isEmpty(counts)}
              className="inline-flex shrink-0 items-center gap-1.5 font-medium text-slate-500 hover:text-slate-700 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Eraser className="h-4 w-4" aria-hidden />
              Clear
            </button>
          </div>
        </div>

        {/* Transaction time */}
        <div>
          <span className="text-sm font-medium">Transaction Time</span>
          {useCustomTime ? (
            <div className="mt-1.5 flex gap-2">
              <input
                id="transaction-time"
                type="datetime-local"
                aria-label="Transaction time"
                value={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.value);
                  setErrors((er) => ({ ...er, time: undefined }));
                }}
                disabled={submitting}
                aria-invalid={!!errors.time}
                aria-describedby={errors.time ? "time-error" : undefined}
                className={`${inputBase} ${errors.time ? inputErr : inputOk}`}
              />
              <button
                type="button"
                onClick={() => {
                  setUseCustomTime(false);
                  setErrors((er) => ({ ...er, time: undefined }));
                }}
                disabled={submitting}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Clock className="h-4 w-4" aria-hidden />
                Use now
              </button>
            </div>
          ) : (
            <div className="mt-1.5 flex items-center justify-between rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700">
              <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Clock className="h-4 w-4 text-emerald-600" aria-hidden />
                Current date &amp; time (when saved)
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomTime(nowForInput());
                  setUseCustomTime(true);
                }}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
              >
                <CalendarClock className="h-4 w-4" aria-hidden />
                Change
              </button>
            </div>
          )}
          {errors.time && (
            <p id="time-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
              {errors.time}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="text-sm font-medium">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            placeholder="e.g. Partial payment for invoice #1042"
            className={`${inputBase} ${inputOk} mt-1.5 resize-y`}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
          <button
            type="button"
            onClick={resetForm}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={submitting || personsLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-70"
          >
            {submitting ? <Spinner className="h-4 w-4 text-white" label="Saving" /> : <Save className="h-4 w-4" aria-hidden />}
            {submitting ? "Saving…" : "Save Entry"}
          </button>
        </div>
      </form>

      {modalOpen && <AddSalesmanModal onClose={() => setModalOpen(false)} onCreated={handleSalesmanCreated} />}
    </div>
  );
}
