/** Themes exposed in Settings → Appearance. */
export const APP_THEMES = [
  "dark",
  "light",
  "system",
  "anthropic",
  "openai",
  "gemini",
  "cream",
] as const;

export type AppTheme = (typeof APP_THEMES)[number];

const APP_THEME_SET = new Set<string>(APP_THEMES);

/** Themes removed from the picker — migrated on load. */
const REMOVED_LIGHT = new Set(["beige", "rose"]);
const REMOVED_DARK = new Set(["slate", "ocean", "forest"]);

export function normalizeAppTheme(theme: string): AppTheme {
  if (APP_THEME_SET.has(theme)) return theme as AppTheme;
  if (REMOVED_LIGHT.has(theme)) return "cream";
  if (REMOVED_DARK.has(theme)) return "dark";
  return "dark";
}

export function isAppTheme(value: string): value is AppTheme {
  return APP_THEME_SET.has(value);
}
