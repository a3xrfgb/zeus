import { isTauri } from "@tauri-apps/api/core";
import { FolderOpen, HelpCircle } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { api } from "../../lib/tauri";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
function joinModelsPath(dataDir: string): string {
  const base = dataDir.replace(/[/\\]+$/, "");
  if (!base) return "…/models";
  const sep = base.includes("\\") ? "\\" : "/";
  return `${base}${sep}models`;
}

function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-sm font-semibold text-[var(--app-text)]">{children}</span>
      {hint ? (
        <span title={hint} className="inline-flex text-[var(--app-muted)]">
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

export function SettingsGeneralPanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const modelsPath = useMemo(() => joinModelsPath(settings.dataDir), [settings.dataDir]);

  return (
    <div className="px-8 py-10">
      <div className="max-w-3xl space-y-8">
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
            <FolderOpen className="h-4 w-4 opacity-80" strokeWidth={2} />
            {t("settings.general.modelsDir")}
          </div>
          <p className="mt-0.5 text-xs text-[var(--app-muted)]">
            {t("settings.general.modelsDirHint")}
          </p>
          <div className="mt-2 flex max-w-lg items-stretch gap-2">
            <div className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 font-mono text-[13px] text-[var(--app-text)]">
              <span className="break-all">{modelsPath}</span>
            </div>
            <button
              type="button"
              title={t("settings.general.openModelsFolder")}
              aria-label={t("settings.general.openModelsFolder")}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[var(--app-text)] transition hover:bg-[var(--app-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0080ff]"
              onClick={() => {
                if (!isTauri()) {
                  pushToast(t("settings.general.openModelsFolderWeb"), "info");
                  return;
                }
                void api.openModelsDir().catch((err) => pushToast(String(err), "error"));
              }}
            >
              <FolderOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--app-muted)]">
            {t("settings.general.dataRoot")}{" "}
            <span className="break-all font-mono text-[11px]">{settings.dataDir || "—"}</span>
          </p>
        </section>

        <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/40 p-5">
          <SectionTitle hint={t("settings.general.inference.systemPromptHint")}>
            {t("settings.general.inference.systemPrompt")}
          </SectionTitle>
          <p className="mb-2 text-xs text-[var(--app-muted)]">
            {t("settings.general.inference.systemPromptLead")}
          </p>
          <textarea
            id="settings-system-prompt"
            rows={3}
            className="w-full resize-y rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0080ff]"
            placeholder={t("settings.general.inference.systemPromptPlaceholder")}
            value={settings.systemPrompt}
            onChange={(e) => {
              void save({ systemPrompt: e.target.value }).catch((err) =>
                pushToast(String(err), "error"),
              );
            }}
          />
        </section>
      </div>
    </div>
  );
}
