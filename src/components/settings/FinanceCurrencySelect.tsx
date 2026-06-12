import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { FINANCE_CURRENCIES } from "../../constants/financeCurrencies";
import { cn } from "../../lib/utils";
import {
  settingsGlassSelectClassName,
  settingsGlassSelectContentClassName,
  settingsGlassSelectItemClassName,
} from "./settingsGlassSelectStyles";

const triggerClass = cn(
  settingsGlassSelectClassName,
  "inline-flex h-9 w-auto min-w-[5.5rem] max-w-[6.5rem] items-center justify-between gap-1 px-2.5",
  "text-[13px] font-medium tabular-nums",
);

const viewportClass = cn(
  "max-h-52 overflow-y-auto p-1",
  "[scrollbar-width:thin] [scrollbar-color:var(--app-border)_transparent]",
  "[&::-webkit-scrollbar]:w-1.5",
  "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--app-border)]",
  "[&::-webkit-scrollbar-track]:bg-transparent",
);

const itemClass = cn(
  settingsGlassSelectItemClassName,
  "gap-2 py-1.5 pl-2 pr-7 text-[13px]",
);

/** Compact currency picker for Settings → Finance (code in trigger, slim scroll list). */
export function FinanceCurrencySelect({
  value,
  onValueChange,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger id={id} className={triggerClass}>
        <Select.Value>{value}</Select.Value>
        <Select.Icon className="shrink-0 opacity-50" aria-hidden>
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions={false}
          className={cn(settingsGlassSelectContentClassName, "w-52")}
        >
          <Select.Viewport className={viewportClass}>
            {FINANCE_CURRENCIES.map((c) => (
              <Select.Item
                key={c.code}
                value={c.code}
                textValue={`${c.code} ${c.name}`}
                className={itemClass}
              >
                <span className="w-9 shrink-0 font-semibold tabular-nums tracking-tight">
                  {c.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--app-muted)]">
                  {c.name}
                </span>
                <Select.ItemText className="sr-only">{c.code}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
