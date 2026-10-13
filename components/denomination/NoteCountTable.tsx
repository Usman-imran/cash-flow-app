"use client";

import { useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { Banknote, Coins, Minus, Plus } from "lucide-react";
import { DENOMINATIONS, type Note, type NoteCounts } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

/** Coins are entered as a rupee amount, so they count at face value (7 -> Rs 7) */
type Row = Note | "coins";

/** Values as typed: note quantities keyed by note value, plus the coins amount ("" = none). */
export type Counts = Record<Row, string>;

const ROWS: readonly Row[] = [...DENOMINATIONS, "coins"];

const valueOf = (row: Row) => (row === "coins" ? 1 : row);

const MAX_COUNT_DIGITS = 6;

const fieldOf = (row: Row) => (row === "coins" ? "coins" : (`note_${row}` as const));

export const emptyCounts = (): Counts => Object.fromEntries(ROWS.map((r) => [r, ""])) as Counts;

export const countsFrom = (entry: NoteCounts | null): Counts =>
  Object.fromEntries(ROWS.map((r) => [r, entry?.[fieldOf(r)] ? String(entry[fieldOf(r)]) : ""])) as Counts;

export const toNoteCounts = (counts: Counts): NoteCounts =>
  Object.fromEntries(ROWS.map((r) => [fieldOf(r), qty(counts[r])])) as NoteCounts;

export const qty = (value: string) => Number(value || 0);

export const totalOf = (counts: Counts) => ROWS.reduce((sum, r) => sum + valueOf(r) * qty(counts[r]), 0);

export const isEmpty = (counts: Counts) => ROWS.every((r) => qty(counts[r]) === 0);

export const sameCounts = (a: Counts, b: Counts) => ROWS.every((r) => qty(a[r]) === qty(b[r]));

export const notesCountOf = (counts: Counts) => DENOMINATIONS.reduce((sum, d) => sum + qty(counts[d]), 0);

export default function NoteCountTable({
  counts,
  onChange,
  disabled,
}: {
  counts: Counts;
  onChange: Dispatch<SetStateAction<Counts>>;
  disabled?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setCount = (note: Row, raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, MAX_COUNT_DIGITS).replace(/^0+(?=\d)/, "");
    onChange((c) => ({ ...c, [note]: digits }));
  };

  const step = (note: Row, delta: number) => {
    onChange((c) => {
      const next = Math.max(0, qty(c[note]) + delta);
      return { ...c, [note]: next ? String(next) : "" };
    });
  };

  // Enter / arrow keys move between rows for fast counting
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    const move = (to: number) => {
      e.preventDefault();
      inputRefs.current[to]?.focus();
      inputRefs.current[to]?.select();
    };
    if ((e.key === "Enter" || e.key === "ArrowDown") && index < ROWS.length - 1) move(index + 1);
    else if (e.key === "ArrowUp" && index > 0) move(index - 1);
  };

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
        <tr>
          <th scope="col" className="px-5 py-3">Note</th>
          <th scope="col" className="px-5 py-3 text-center">Quantity</th>
          <th scope="col" className="px-5 py-3 text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {ROWS.map((note, i) => {
          const count = qty(counts[note]);
          const isCoins = note === "coins";
          const label = isCoins ? "coins (amount in Rs)" : `Rs. ${note} notes`;
          return (
            <tr key={note} className={count > 0 ? "bg-emerald-50/40 dark:bg-emerald-500/5" : undefined}>
              <th scope="row" className="whitespace-nowrap px-5 py-3 text-left font-medium">
                {isCoins ? (
                  <span className="inline-flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" aria-hidden />
                    Coins
                    <span className="text-xs font-normal text-slate-400">(Rs amount)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    Rs. {note.toLocaleString("en-PK")}
                  </span>
                )}
              </th>
              <td className="px-5 py-2">
                <div className="mx-auto flex w-40 items-center rounded-lg border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-slate-700 dark:focus-within:ring-emerald-900">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => step(note, -1)}
                    disabled={disabled || count === 0}
                    className="p-2 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                    aria-label={`Decrease ${label}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={counts[note]}
                    onChange={(e) => setCount(note, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    onFocus={(e) => e.target.select()}
                    disabled={disabled}
                    aria-label={isCoins ? "Coins amount in rupees" : `Number of Rs. ${note} notes`}
                    className="w-full min-w-0 bg-transparent py-2 text-center font-semibold tabular-nums outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => step(note, 1)}
                    disabled={disabled}
                    className="p-2 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                    aria-label={`Increase ${label}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                {count > 0 ? (
                  <>
                    {!isCoins && (
                      <span className="mr-2 hidden text-xs text-slate-400 sm:inline">
                        {note.toLocaleString("en-PK")} × {count.toLocaleString("en-PK")} =
                      </span>
                    )}
                    <span className="font-semibold">{formatCurrency(valueOf(note) * count)}</span>
                  </>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
        <tr>
          <th scope="row" className="px-5 py-3 text-left font-semibold">Total</th>
          <td className="px-5 py-3 text-center text-slate-500 tabular-nums dark:text-slate-400">
            {notesCountOf(counts).toLocaleString("en-PK")} notes
            {qty(counts.coins) > 0 && " + coins"}
          </td>
          <td className="whitespace-nowrap px-5 py-3 text-right text-base font-bold tabular-nums">
            {formatCurrency(totalOf(counts))}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
