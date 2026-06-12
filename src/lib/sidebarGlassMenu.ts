import { cn } from "./utils";

/** Radix dropdown / context menu panel — plain opaque surface (no glass/blur). */
export const sidebarGlassMenuContent = cn(
  "z-[320] min-w-[10.5rem] overflow-hidden rounded-xl border border-[var(--dropdown-border)]",
  "bg-[var(--dropdown-bg)] p-1 shadow-md",
);

export const sidebarGlassMenuSubContent = cn(
  sidebarGlassMenuContent,
  "min-w-[9.5rem]",
);

/** Row item — compact, theme-aware via dropdown CSS variables. */
export const sidebarGlassMenuItem = cn(
  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-tight outline-none",
  "text-[var(--dropdown-text)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  "data-[highlighted]:bg-[var(--dropdown-hover)]",
);

export const sidebarGlassMenuSeparator = "my-0.5 h-px bg-[var(--dropdown-separator)]";

/** Chat composer attach menu — opaque panel (no glass/blur). */
export const composerAttachMenuContent = cn(
  "z-[320] min-w-[10.5rem] overflow-hidden rounded-xl border border-[var(--dropdown-border)]",
  "bg-[var(--dropdown-bg)] p-1 shadow-md",
);

export const composerAttachMenuItem = cn(
  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-tight outline-none",
  "text-[var(--dropdown-text)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  "data-[highlighted]:bg-[var(--dropdown-hover)]",
);
