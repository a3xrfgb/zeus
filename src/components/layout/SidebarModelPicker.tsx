import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import {
  buildChatPickerModels,
  type ChatPickerModel,
} from "../../lib/chatModelPicker";
import { filterMainChatModels } from "../../lib/modelDisk";
import { cn } from "../../lib/utils";
import { useModelStore } from "../../store/modelStore";
import { useSettingsStore } from "../../store/settingsStore";

const pillBase = cn(
  "inline-flex items-center justify-center transition-colors duration-150",
  "rounded-full bg-[var(--sidebar-hover)] text-[var(--sidebar-text)]",
  "hover:bg-[var(--sidebar-active)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-border)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--sidebar-footer)]",
);

export function SidebarModelPicker({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const localModels = useModelStore((s) => s.localModels);
  const activeModelId = useModelStore((s) => s.activeModelId);
  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const modelLoadState = useModelStore((s) => s.modelLoadState);
  const setSelectedModel = useModelStore((s) => s.setSelectedModel);
  const loadSelectedModel = useModelStore((s) => s.loadSelectedModel);
  const defaultModel = useSettingsStore((s) => s.settings.defaultModel);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pickerModels = useMemo(() => {
    const mains = filterMainChatModels(localModels).map((m) => ({
      id: m.id,
      name: m.name,
    }));
    return buildChatPickerModels(mains);
  }, [localModels]);

  const installedModels = useMemo(
    () => pickerModels.filter((m) => m.installed),
    [pickerModels],
  );

  const selectedRow = useMemo(
    () => pickerModels.find((m) => m.installed && m.id === activeModelId),
    [pickerModels, activeModelId],
  );

  const isLoaded =
    modelLoadState === "loaded" &&
    loadedModelId != null &&
    loadedModelId === activeModelId;
  const isLoading = modelLoadState === "loading";

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (installedModels.length === 0) {
    if (collapsed) return null;
    return (
      <p className="mb-2 px-1 text-[11px] leading-snug text-[var(--sidebar-muted)]">
        {t("sidebar.noModelsInstalled")}
      </p>
    );
  }

  const label =
    selectedRow?.name ??
    (defaultModel ? defaultModel : t("sidebar.selectModel"));

  const onPick = (m: ChatPickerModel) => {
    if (!m.installed) return;
    setSelectedModel(m.id);
    setMenuOpen(false);
  };

  const onLoad = () => {
    if (isLoaded || isLoading || !activeModelId) return;
    void loadSelectedModel();
  };

  const loadLabel = isLoading
    ? t("sidebar.loadingModel")
    : isLoaded
      ? t("sidebar.modelLoaded")
      : t("sidebar.loadModel");

  const loadControl = (
    <button
      type="button"
      disabled={!activeModelId || isLoading || isLoaded}
      title={
        isLoaded
          ? t("sidebar.modelLoaded")
          : isLoading
            ? t("sidebar.loadingModel")
            : t("sidebar.loadModelHint")
      }
      aria-label={loadLabel}
      className={cn(
        pillBase,
        "shrink-0 gap-1 text-[11px] font-normal",
        collapsed ? "h-8 w-8 p-0" : "h-8 min-w-[3.25rem] px-3",
        isLoaded
          ? "cursor-default bg-[var(--sidebar-hover)] text-emerald-500 hover:bg-[var(--sidebar-hover)] dark:text-emerald-400"
          : "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white/14 dark:text-white dark:hover:bg-white/20",
        (!activeModelId || isLoading) && "cursor-not-allowed opacity-50",
      )}
      onClick={onLoad}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-white" strokeWidth={1.75} />
      ) : isLoaded ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2} />
      ) : collapsed ? (
        <span className="text-[10px]">Load</span>
      ) : (
        t("sidebar.loadModel")
      )}
    </button>
  );

  if (collapsed) {
    return <div className="mb-2 flex justify-center">{loadControl}</div>;
  }

  return (
    <div className="mb-3 flex items-center gap-1.5">
      <div ref={menuRef} className="relative min-w-0 flex-1">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          className={cn(
            pillBase,
            "h-8 w-full min-w-0 gap-1 px-3 py-0 text-left text-[11px] font-normal",
          )}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              isLoaded ? "bg-emerald-500/70" : "bg-[var(--sidebar-muted)]/30",
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-[var(--sidebar-muted)] transition-transform duration-200",
              menuOpen && "rotate-180",
            )}
            strokeWidth={2}
          />
        </button>

        {menuOpen ? (
          <ul
            role="listbox"
            className={cn(
              "absolute bottom-full left-0 right-0 z-[400] mb-2 max-h-52 overflow-y-auto rounded-2xl p-1",
              "border border-[var(--sidebar-border)]/80 bg-[var(--sidebar-input-bg)]",
              "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)]",
            )}
          >
            {pickerModels.map((m) => {
              const selected = m.installed && m.id === activeModelId;
              return (
                <li key={m.catalogKey} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={!m.installed}
                    className={cn(
                      "w-full rounded-xl px-2.5 py-1.5 text-left text-[11px] font-normal leading-snug transition-colors",
                      m.installed
                        ? "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
                        : "cursor-not-allowed text-[var(--sidebar-muted)] opacity-45",
                      selected && "bg-[var(--sidebar-hover)]",
                    )}
                    onClick={() => onPick(m)}
                  >
                    <span className="block truncate">{m.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {loadControl}
    </div>
  );
}
