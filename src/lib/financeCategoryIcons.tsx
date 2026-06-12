import {
  Car,
  CircleEllipsis,
  CreditCard,
  Home,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { FinanceExpenseCategory } from "../store/financeStore";
import { cn } from "./utils";

/** All expense categories (single source for forms + lists). */
export const FINANCE_EXPENSE_CATEGORIES: FinanceExpenseCategory[] = [
  "food",
  "transport",
  "bills",
  "rent",
  "subscriptions",
  "shopping",
  "other",
];

/** Donut segment fills (match category chips). */
export const FINANCE_CATEGORY_CHART_COLOR: Record<FinanceExpenseCategory, string> = {
  food: "#f97316",
  transport: "#3b82f6",
  bills: "#64748b",
  rent: "#8b5cf6",
  subscriptions: "#ec4899",
  shopping: "#0ea5e9",
  other: "#737373",
};

/** Lucide icons (MIT) — free for commercial use. */
export const FINANCE_CATEGORY_META: Record<
  FinanceExpenseCategory,
  { Icon: LucideIcon; ring: string; icon: string }
> = {
  food: {
    Icon: UtensilsCrossed,
    ring: "bg-orange-500/15",
    icon: "text-orange-600 dark:text-orange-400",
  },
  transport: {
    Icon: Car,
    ring: "bg-blue-500/15",
    icon: "text-blue-600 dark:text-blue-400",
  },
  bills: {
    Icon: Receipt,
    ring: "bg-slate-500/15",
    icon: "text-slate-600 dark:text-slate-400",
  },
  rent: {
    Icon: Home,
    ring: "bg-violet-500/15",
    icon: "text-violet-600 dark:text-violet-400",
  },
  subscriptions: {
    Icon: CreditCard,
    ring: "bg-pink-500/15",
    icon: "text-pink-600 dark:text-pink-400",
  },
  shopping: {
    Icon: ShoppingBag,
    ring: "bg-sky-500/15",
    icon: "text-sky-600 dark:text-sky-400",
  },
  other: {
    Icon: CircleEllipsis,
    ring: "bg-neutral-500/15",
    icon: "text-neutral-600 dark:text-neutral-400",
  },
};

export function FinanceCategoryIcon({
  category,
  size = "md",
  className,
}: {
  category: FinanceExpenseCategory;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = FINANCE_CATEGORY_META[category] ?? FINANCE_CATEGORY_META.other;
  const { Icon } = meta;
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        box,
        meta.ring,
        className,
      )}
      aria-hidden
    >
      <Icon className={cn(iconSize, meta.icon)} strokeWidth={1.75} />
    </span>
  );
}
