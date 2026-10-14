"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Search, X } from "lucide-react";
import Spinner from "@/components/Spinner";
import type { PersonBrief } from "@/lib/api";

type Props = {
  id: string;
  persons: PersonBrief[];
  /** Selected person id as a string, "" when nothing is selected */
  value: string;
  onChange: (id: string) => void;
  label: (p: PersonBrief) => string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className: string;
  inputRef?: Ref<HTMLInputElement>;
};

/** Search-as-you-type salesman picker, matching on name or salesman code. */
export default function SalesmanSearch({
  id,
  persons,
  value,
  onChange,
  label,
  loading,
  disabled,
  invalid,
  describedBy,
  className,
  inputRef,
}: Props) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  // Text being typed; null while not editing, so the input shows the selection
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selected = persons.find((p) => String(p.id) === value);
  const query = (draft ?? "").trim().toLowerCase();
  const matches = query
    ? persons.filter(
        (p) => p.name.toLowerCase().includes(query) || (p.salesman_code ?? "").toLowerCase().includes(query),
      )
    : persons;
  const showList = open && !loading && !disabled;

  useEffect(() => {
    if (!showList) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, showList]);

  const close = () => {
    setOpen(false);
    setDraft(null);
  };

  const pick = (p: PersonBrief) => {
    onChange(String(p.id));
    close();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (matches.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (e.key === "Enter" && showList) {
      // Don't submit the form while choosing a salesman
      e.preventDefault();
      if (matches[active]) pick(matches[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  const placeholder = loading
    ? "Loading salesmen…"
    : persons.length === 0
      ? "No salesmen yet — add one first"
      : "Search by name or code";

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400"
        aria-hidden
      />
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={draft ?? (selected ? label(selected) : "")}
        placeholder={placeholder}
        disabled={disabled || loading}
        onChange={(e) => {
          setDraft(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={close}
        className={`${className} pl-9 pr-10`}
      />
      <span className="absolute inset-y-0 right-3 flex items-center">
        {loading ? (
          <Spinner className="h-4 w-4 text-slate-400" />
        ) : (
          (draft || selected) &&
          !disabled && (
            <button
              type="button"
              aria-label="Clear salesman"
              // Keep focus in the input so the list can reopen
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange("");
                setDraft("");
                setActive(0);
                setOpen(true);
              }}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )
        )}
      </span>

      {showList && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-slate-500 dark:text-slate-400">
              {persons.length === 0 ? "No salesmen yet" : "No salesman matches your search"}
            </li>
          ) : (
            matches.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={String(p.id) === value}
                // mousedown would blur the input and close the list before the click lands
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                onMouseMove={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 ${
                  i === active ? "bg-emerald-50 dark:bg-emerald-950/50" : ""
                } ${String(p.id) === value ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}`}
              >
                {p.salesman_code && (
                  <span className="mr-2 text-slate-500 dark:text-slate-400">{p.salesman_code}</span>
                )}
                {p.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
