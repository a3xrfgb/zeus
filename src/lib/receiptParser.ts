import type { FinanceExpenseCategory } from "../store/financeStore";
import type { ParsedReceiptFields } from "../types/receipt";

const TOTAL_KEYWORDS =
  /\b(total|grand\s*total|amount\s*due|balance\s*due|subtotal|amt\s*due|net\s*amount)\b/i;

const DATE_PATTERNS = [
  /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
  /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/i,
];

const MONEY_PATTERN =
  /(?:[$€£¥₹]|USD|EUR|GBP|ETB|Birr)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/gi;

const CATEGORY_HINTS: { pattern: RegExp; category: FinanceExpenseCategory; label: string }[] = [
  { pattern: /\b(grocery|supermarket|food|restaurant|cafe|coffee|pizza|burger|kitchen|bakery)\b/i, category: "food", label: "Food & dining" },
  { pattern: /\b(gas|fuel|uber|lyft|taxi|metro|bus|train|parking|transport)\b/i, category: "transport", label: "Transport" },
  { pattern: /\b(electric|water|internet|phone|utility|bill)\b/i, category: "bills", label: "Bills & utilities" },
  { pattern: /\b(rent|lease|landlord|housing)\b/i, category: "rent", label: "Rent & housing" },
  { pattern: /\b(netflix|spotify|subscription|membership|premium)\b/i, category: "subscriptions", label: "Subscriptions" },
  { pattern: /\b(store|shop|market|mall|retail|amazon|target|walmart|clothing|electronics)\b/i, category: "shopping", label: "Shopping" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractAllAmounts(line: string): number[] {
  const out: number[] = [];
  for (const match of line.matchAll(MONEY_PATTERN)) {
    const n = parseAmount(match[1] ?? match[0]);
    if (n != null) out.push(n);
  }
  return out;
}

function parseDateFromText(text: string): string | null {
  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    if (/^\d{4}/.test(m[0])) {
      const y = m[1];
      const mo = String(m[2]).padStart(2, "0");
      const d = String(m[3]).padStart(2, "0");
      return `${y}-${mo}-${d}`;
    }
    if (/^[A-Za-z]/.test(m[0])) {
      const months: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      };
      const mo = months[m[1].slice(0, 3).toLowerCase()];
      if (!mo) continue;
      const d = String(m[2]).padStart(2, "0");
      let y = m[3];
      if (y.length === 2) y = `20${y}`;
      return `${y}-${mo}-${d}`;
    }
    const a = Number.parseInt(m[1], 10);
    const b = Number.parseInt(m[2], 10);
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    const monthFirst = a <= 12 && b <= 31;
    const month = monthFirst ? a : b;
    const day = monthFirst ? b : a;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function guessStoreName(lines: string[]): string {
  for (const line of lines.slice(0, 8)) {
    const t = line.trim();
    if (t.length < 3 || t.length > 48) continue;
    if (/^\d/.test(t)) continue;
    if (/\b(receipt|invoice|welcome|thank you|tel|phone|www\.|http)\b/i.test(t)) continue;
    if (/^\d{1,2}[-/]\d{1,2}/.test(t)) continue;
    return t;
  }
  return "Unknown store";
}

function guessCategory(text: string): { category: FinanceExpenseCategory; itemType: string } {
  for (const hint of CATEGORY_HINTS) {
    if (hint.pattern.test(text)) {
      return { category: hint.category, itemType: hint.label };
    }
  }
  return { category: "other", itemType: "General purchase" };
}

function extractTotal(lines: string[]): number {
  let best = 0;
  for (const line of lines) {
    const amounts = extractAllAmounts(line);
    if (amounts.length === 0) continue;
    const lineTotal = Math.max(...amounts);
    if (TOTAL_KEYWORDS.test(line)) {
      return lineTotal;
    }
    if (lineTotal > best) best = lineTotal;
  }
  return best;
}

function extractItems(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 4) continue;
    if (TOTAL_KEYWORDS.test(t)) continue;
    const amounts = extractAllAmounts(t);
    if (amounts.length === 0) continue;
    if (/^\d+\s*x/i.test(t) || /\b(qty|item)\b/i.test(t) || amounts.length >= 1) {
      const label = t.replace(MONEY_PATTERN, "").replace(/\s+/g, " ").trim();
      if (label.length >= 2 && label.length <= 80) items.push(label);
    }
    if (items.length >= 6) break;
  }
  return items;
}

function detectCurrency(text: string): string | null {
  if (/ETB|Birr/i.test(text)) return "ETB";
  if (/€|EUR/i.test(text)) return "EUR";
  if (/£|GBP/i.test(text)) return "GBP";
  if (/¥|JPY/i.test(text)) return "JPY";
  if (/₹|INR/i.test(text)) return "INR";
  if (/\$|USD/i.test(text)) return "USD";
  return null;
}

/** Heuristic parser for OCR text from retail receipts. */
export function parseReceiptText(rawText: string): ParsedReceiptFields {
  const normalized = rawText.replace(/\r/g, "").trim();
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const storeName = guessStoreName(lines);
  const totalAmount = extractTotal(lines);
  const date = parseDateFromText(normalized) ?? todayIso();
  const items = extractItems(lines);
  const { category, itemType } = guessCategory(`${storeName}\n${normalized}`);

  return {
    storeName,
    itemType: items[0] ?? itemType,
    category,
    totalAmount,
    currency: detectCurrency(normalized),
    date,
    items,
    rawText: normalized,
  };
}
