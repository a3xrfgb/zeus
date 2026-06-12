import { FINANCE_CURRENCY_CODES } from "../constants/financeCurrencies";

export type ExchangeRatesSnapshot = {
  base: string;
  /** When this snapshot was stored in the app. */
  fetchedAt: number;
  /** Provider's published update time (Unix seconds, UTC). */
  lastUpdatedUnix: number;
  /** Provider's published update time (human-readable UTC). */
  lastUpdatedUtc: string;
  /** Provider's next scheduled publish (Unix seconds, UTC). */
  nextUpdateUnix: number;
  nextUpdateUtc: string;
  rates: Record<string, number>;
};

type ErApiLatest = {
  result?: string;
  base_code?: string;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  time_next_update_unix?: number;
  time_next_update_utc?: string;
  rates?: Record<string, number>;
};

/** Same calendar day in the user's local timezone. */
export function isSameLocalCalendarDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True when provider data was published on the user's local "today". */
export function ratesAreForToday(snapshot: ExchangeRatesSnapshot): boolean {
  return isSameLocalCalendarDay(snapshot.lastUpdatedUnix * 1000, Date.now());
}

export function formatRatesUpdatedAt(unixSeconds: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(unixSeconds * 1000));
  } catch {
    return new Date(unixSeconds * 1000).toLocaleString();
  }
}

const INTRADAY_CACHE_MS = 30 * 60_000;
let cache: ExchangeRatesSnapshot | null = null;

function cacheIsFresh(snapshot: ExchangeRatesSnapshot): boolean {
  const now = Date.now();
  if (!isSameLocalCalendarDay(snapshot.fetchedAt, now)) return false;
  if (!ratesAreForToday(snapshot)) return false;
  if (now - snapshot.fetchedAt > INTRADAY_CACHE_MS) return false;
  return true;
}

export function clearExchangeRatesCache(): void {
  cache = null;
}

/**
 * Live USD-based rates (open.er-api.com). Refetches when the calendar day changes,
 * provider data is not from today, or `force` is set (refresh button).
 */
export async function fetchUsdExchangeRates(options?: {
  force?: boolean;
}): Promise<ExchangeRatesSnapshot> {
  if (!options?.force && cache && cacheIsFresh(cache)) return cache;

  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Exchange rate request failed (${res.status})`);

  const json = (await res.json()) as ErApiLatest;
  if (json.result !== "success" || !json.rates) {
    throw new Error("Exchange rate response invalid");
  }

  const lastUpdatedUnix = json.time_last_update_unix;
  const lastUpdatedUtc = json.time_last_update_utc?.trim();
  const nextUpdateUnix = json.time_next_update_unix;
  const nextUpdateUtc = json.time_next_update_utc?.trim();
  if (
    typeof lastUpdatedUnix !== "number" ||
    !Number.isFinite(lastUpdatedUnix) ||
    !lastUpdatedUtc ||
    typeof nextUpdateUnix !== "number" ||
    !Number.isFinite(nextUpdateUnix) ||
    !nextUpdateUtc
  ) {
    throw new Error("Exchange rate timestamp missing");
  }

  const rates: Record<string, number> = { USD: 1 };
  for (const code of FINANCE_CURRENCY_CODES) {
    const v = json.rates[code];
    if (typeof v === "number" && Number.isFinite(v)) rates[code] = v;
  }

  const snap: ExchangeRatesSnapshot = {
    base: json.base_code ?? "USD",
    fetchedAt: Date.now(),
    lastUpdatedUnix,
    lastUpdatedUtc,
    nextUpdateUnix,
    nextUpdateUtc,
    rates,
  };

  cache = snap;
  return snap;
}

export function rateUsdTo(snapshot: ExchangeRatesSnapshot, code: string): number | null {
  if (code === "USD") return 1;
  const r = snapshot.rates[code];
  return typeof r === "number" && r > 0 ? r : null;
}

/** Convert an amount from one currency to another using USD cross-rates. */
export function convertViaUsd(
  amount: number,
  fromCode: string,
  toCode: string,
  snapshot: ExchangeRatesSnapshot,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (fromCode === toCode) return amount;
  const fromPerUsd = rateUsdTo(snapshot, fromCode);
  const toPerUsd = rateUsdTo(snapshot, toCode);
  if (fromPerUsd == null || toPerUsd == null) return null;
  return (amount / fromPerUsd) * toPerUsd;
}
