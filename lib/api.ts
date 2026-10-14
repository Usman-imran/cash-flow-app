export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(`Cannot reach the API at ${API_BASE_URL}. Is the backend running?`, 0);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg: string }) => d.msg).join(", ");
    } catch {
      // non-JSON error body
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }

  // e.g. DELETE responses have no body
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- Types (mirror backend/app/schemas.py) ----------

export type PersonBrief = {
  id: number;
  salesman_code: string | null;
  name: string;
};

export type Person = PersonBrief & {
  created_at: string;
};

export type PersonSummary = Person & {
  transaction_count: number;
};

export type Transaction = {
  id: number;
  person_id: number;
  amount: number;
  transaction_time: string;
  notes: string | null;
  created_at: string;
  person: PersonBrief;
  /** Note breakdown, when the cash was entered by counting notes */
  denomination: NoteCounts | null;
};

export type TodaySummary = {
  date: string;
  total_amount: number;
  transaction_count: number;
  recent_transactions: Transaction[];
};

export const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10] as const;
export type Note = (typeof DENOMINATIONS)[number];

/** Note quantities, plus coins as a rupee amount (not a count) */
export type NoteCounts = { [K in Note as `note_${K}`]: number } & { coins: number };

export type Denomination = NoteCounts & {
  id: number;
  entry_date: string;
  total_amount: number;
  created_at: string;
};

export type DenominationInput = NoteCounts & { entry_date?: string };

export type DateWiseRow = {
  date: string;
  transaction_count: number;
  total_amount: number;
};

export type DateWiseReport = {
  start_date: string;
  end_date: string;
  transaction_count: number;
  total_amount: number;
  rows: DateWiseRow[];
};

export type SalesmanWiseRow = {
  person_id: number;
  salesman_code: string | null;
  name: string;
  transaction_count: number;
  total_amount: number;
};

export type SalesmanWiseReport = {
  start_date: string | null;
  end_date: string | null;
  transaction_count: number;
  total_amount: number;
  rows: SalesmanWiseRow[];
};
