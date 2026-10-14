"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Pencil, Search, SearchX, Trash2, UserPlus, Users, X } from "lucide-react";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import AddSalesmanModal from "@/components/cash-entry/AddSalesmanModal";
import EditSalesmanModal from "@/components/salesmen/EditSalesmanModal";
import RemoveSalesmanDialog from "@/components/salesmen/RemoveSalesmanDialog";
import { apiFetch, type Person, type PersonSummary } from "@/lib/api";
import { formatShortDate } from "@/lib/format";

/** Lowercase and drop separators so "sm0001", "SM-0001" and "sm 0001" all match. */
function normalize(value: string) {
  return value.toLowerCase().replace(/[\s-]+/g, "");
}

function personLabel(p: Person) {
  return p.salesman_code ? `${p.salesman_code} - ${p.name}` : p.name;
}

type Dialog = { kind: "add" } | { kind: "edit"; person: PersonSummary } | { kind: "remove"; person: PersonSummary };

export default function SalesmenManager() {
  const toast = useToast();
  const [persons, setPersons] = useState<PersonSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    apiFetch<PersonSummary[]>("/api/persons", { signal: controller.signal }).then(
      (list) => {
        setPersons(list);
        setError(null);
      },
      (err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load salesmen");
      },
    );
  }, []);

  useEffect(() => {
    load();
    return () => inFlight.current?.abort();
  }, [load]);

  const retry = () => {
    setError(null);
    load();
  };

  const filtered = useMemo(() => {
    if (!persons) return [];
    const q = query.trim().toLowerCase();
    if (!q) return persons;
    const qCode = normalize(q);
    return persons.filter(
      (p) => p.name.toLowerCase().includes(q) || (!!qCode && normalize(p.salesman_code ?? "").includes(qCode)),
    );
  }, [persons, query]);

  const handleCreated = (person: Person) => {
    setPersons((list) => [...(list ?? []), { ...person, transaction_count: 0 }].sort((a, b) => a.id - b.id));
    setDialog(null);
    toast({ title: "Salesman added", description: `${personLabel(person)} has been added.` });
  };

  const handleSaved = (person: PersonSummary) => {
    setPersons((list) => list?.map((p) => (p.id === person.id ? person : p)) ?? null);
    setDialog(null);
    toast({ title: "Salesman updated", description: `Renamed to ${person.name}.` });
  };

  const handleRemoved = (person: PersonSummary) => {
    setPersons((list) => list?.filter((p) => p.id !== person.id) ?? null);
    setDialog(null);
    toast({ title: "Salesman removed", description: `${personLabel(person)} has been removed.` });
  };

  const initialLoading = !persons && !error;
  const isFiltering = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Salesmen</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">View, rename and remove salesmen.</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "add" })}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Add New Salesman
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t load salesmen</p>
            <p className="mt-0.5 opacity-90">{error}</p>
          </div>
          <button type="button" onClick={retry} className="font-medium hover:underline">
            Retry
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="Search by name or code (SM-0001)"
              aria-label="Search salesmen by name or code"
              disabled={!persons}
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
        </div>

        {initialLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Spinner className="h-7 w-7 text-emerald-600" />
            <p className="text-sm text-slate-500">Loading salesmen…</p>
          </div>
        ) : !persons ? (
          <Empty icon={Users} title="No data available" text="Salesmen will appear here once the backend is reachable." />
        ) : persons.length === 0 ? (
          <Empty icon={Users} title="No salesmen yet" text="Add your first salesman to start recording cash.">
            <button
              type="button"
              onClick={() => setDialog({ kind: "add" })}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Add New Salesman
            </button>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty icon={SearchX} title="No matching salesmen" text={`Nothing matches “${query.trim()}”.`}>
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
                  <th scope="col" className="whitespace-nowrap px-5 py-3">Code</th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3">Name</th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">Cash Entries</th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3">Added On</th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {p.salesman_code ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{p.name}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {p.transaction_count}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">
                      <time dateTime={p.created_at}>{formatShortDate(p.created_at.slice(0, 10))}</time>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "edit", person: p })}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "remove", person: p })}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                          aria-label={`Remove ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 text-sm dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <td colSpan={5} className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {isFiltering
                      ? `Showing ${filtered.length} of ${persons.length} salesmen`
                      : `${persons.length} ${persons.length === 1 ? "salesman" : "salesmen"}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {dialog?.kind === "add" && <AddSalesmanModal onClose={() => setDialog(null)} onCreated={handleCreated} />}
      {dialog?.kind === "edit" && (
        <EditSalesmanModal person={dialog.person} onClose={() => setDialog(null)} onSaved={handleSaved} />
      )}
      {dialog?.kind === "remove" && (
        <RemoveSalesmanDialog person={dialog.person} onClose={() => setDialog(null)} onRemoved={handleRemoved} />
      )}
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: typeof Users;
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
