/** Top ~50 currencies by global use (ISO 4217). */
export const FINANCE_CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "KRW", name: "South Korean Won" },
  { code: "INR", name: "Indian Rupee" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "ZAR", name: "South African Rand" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "PLN", name: "Polish Złoty" },
  { code: "THB", name: "Thai Baht" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "ILS", name: "Israeli Shekel" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "COP", name: "Colombian Peso" },
  { code: "PEN", name: "Peruvian Sol" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "RON", name: "Romanian Leu" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "BGN", name: "Bulgarian Lev" },
  { code: "ISK", name: "Icelandic Króna" },
  { code: "TWD", name: "New Taiwan Dollar" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
] as const;

export const DEFAULT_FINANCE_DISPLAY_CURRENCY = "USD";
export const DEFAULT_FINANCE_EXCHANGE_CURRENCY = "ETB";

export const FINANCE_CURRENCY_CODES = FINANCE_CURRENCIES.map((c) => c.code);

export function financeCurrencyName(code: string): string {
  return FINANCE_CURRENCIES.find((c) => c.code === code)?.name ?? code;
}
