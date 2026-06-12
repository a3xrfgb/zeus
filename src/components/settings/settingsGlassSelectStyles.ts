import { cn } from "../../lib/utils";

/** Solid field control (native inputs, selects, textareas in Settings). */
export const settingsFieldClassName = cn(
  "w-full rounded-xl border text-sm text-[var(--app-text)] outline-none transition duration-200",
  "border-[var(--app-border)] bg-[var(--sidebar-input-bg)] px-3.5 py-2.5",
  "focus:border-[var(--selection-accent)] focus:ring-2 focus:ring-[var(--selection-accent-muted)]",
);

/** Solid trigger for Settings Radix Select. */
export const settingsGlassSelectClassName = cn(
  settingsFieldClassName,
  "px-3 py-2.5 shadow-sm",
);

/** Dropdown panel (Radix Select.Content). */
export const settingsGlassSelectContentClassName = cn(
  "z-[520] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border p-1 shadow-lg",
  "border-[var(--dropdown-border)] bg-[var(--dropdown-bg)] text-[var(--dropdown-text)]",
);

/** Single option row in the dropdown. */
export const settingsGlassSelectItemClassName = cn(
  "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2.5 pr-8 text-sm text-[var(--dropdown-text)] outline-none transition-colors duration-150",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  "data-[highlighted]:bg-[var(--settings-select-hover)] data-[highlighted]:text-[var(--dropdown-text)]",
  "data-[state=checked]:bg-[var(--settings-select-active)] data-[state=checked]:font-semibold",
);

/** Selected state for button-group choices (e.g. assistant message style). */
export const settingsChoiceActiveClassName = cn(
  "border-[var(--selection-accent)] bg-[var(--settings-select-active)] font-medium text-[var(--app-text)]",
);

/** Idle state for button-group choices in Settings. */
export const settingsChoiceIdleClassName = cn(
  "border-[var(--app-border)] bg-[var(--sidebar-input-bg)] text-[var(--app-text)] hover:bg-[var(--settings-select-hover)]",
);

/** Selected list row in Settings explorers (API, MCP tools, etc.). */
export const settingsListItemActiveClassName = cn(
  "border-[var(--selection-accent)] bg-[var(--settings-select-active)]",
);

/** Idle list row in Settings explorers. */
export const settingsListItemIdleClassName = cn(
  "border-[var(--app-border)] bg-[var(--sidebar-input-bg)] hover:bg-[var(--settings-select-hover)]",
);
