import { useMemo } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { useSettingsStore } from "../../store/settingsStore";
import { ZeusLogo } from "../layout/ZeusLogo";

function greetingPeriod(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * Centered greeting + logo shown before the first message in a thread (new chat).
 */
export function EmptyChatHero() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);

  const title = useMemo(() => {
    const displayName =
      settings.profileFullName.trim() || settings.profileNickname.trim();
    const hour = new Date().getHours();
    const period = greetingPeriod(hour);
    return displayName !== ""
      ? t(`home.greeting.${period}Name`, { name: displayName })
      : t("chat.emptyGreeting.generic");
  }, [settings.profileFullName, settings.profileNickname, t]);

  return (
    <div className="flex max-w-lg flex-col items-center text-center">
      <ZeusLogo className="h-24 w-24 shrink-0 object-contain sm:h-28 sm:w-28" alt="" />
      <h1 className="mt-8 text-balance text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-[1.75rem]">
        {title}
      </h1>
    </div>
  );
}
