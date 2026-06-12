import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { confirm } from "../../lib/desktop/dialog";
import { api } from "../../lib/tauri";
import { cn } from "../../lib/utils";
import type { LlamaRuntimeInfo } from "../../types/runtime";
import { CUDA_RUNTIME_VARIANT } from "../../types/runtime";
import { useUiStore } from "../../store/uiStore";

const RELEASES_URL = "https://github.com/ggml-org/llama.cpp/releases";

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type DownloadPayload = {
  bytesDownloaded?: number;
  totalBytes?: number;
  percentage?: number;
  status?: string;
  phase?: string;
};

export function SettingsRuntimePanel() {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);

  const [info, setInfo] = useState<LlamaRuntimeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dlPct, setDlPct] = useState(0);
  const [dlPhase, setDlPhase] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const r = await api.getLlamaRuntimeInfo(CUDA_RUNTIME_VARIANT);
      setInfo(r);
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (!isTauri()) return;
    let un: (() => void) | undefined;
    void (async () => {
      un = await listen<DownloadPayload>("zeus-runtime-download", (e) => {
        const p = e.payload;
        if (p?.status === "downloading" && typeof p.percentage === "number") {
          setDlPct(Math.min(100, Math.max(0, p.percentage)));
          setDlPhase(typeof p.phase === "string" ? p.phase : null);
        }
      });
    })();
    return () => {
      un?.();
    };
  }, []);

  const onDownload = async () => {
    if (!isTauri() || !info?.supported) return;
    setDownloading(true);
    setDlPct(0);
    setDlPhase(null);
    try {
      await api.downloadLlamaRuntime(CUDA_RUNTIME_VARIANT);
      setDlPct(100);
      setDlPhase(null);
      pushToast(t("settings.runtime.downloadComplete"), "success");
      void loadInfo();
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setDownloading(false);
    }
  };

  const onDownloadCudartOnly = async () => {
    if (!isTauri() || !info?.supported) return;
    setDownloading(true);
    setDlPct(0);
    setDlPhase(null);
    try {
      await api.downloadCudartRuntime();
      setDlPct(100);
      setDlPhase(null);
      pushToast(t("settings.runtime.cudartDownloadComplete"), "success");
      void loadInfo();
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setDownloading(false);
    }
  };

  const canRemoveInstalled = Boolean(
    info?.llamaServerPath || info?.installedTag || info?.installedBackend,
  );

  const onRemove = async () => {
    if (!isTauri() || !canRemoveInstalled) return;
    const ok = await confirm(t("settings.runtime.removeConfirm"), {
      title: t("settings.runtime.removeTitle"),
      kind: "warning",
    });
    if (!ok) return;
    setRemoving(true);
    try {
      const result = await api.removeLlamaRuntime();
      if (result.removed === 0) {
        pushToast(t("settings.runtime.removeNothing"), "info");
      } else {
        pushToast(t("settings.runtime.removeComplete", { count: result.removed }), "success");
      }
      void loadInfo();
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setRemoving(false);
    }
  };

  const llamaMissing = info != null && !info.llamaServerPath;
  const busy = downloading || removing;
  const cudaNotReady = info?.installedBackend != null && info.installedBackend !== "cuda";
  const cudartMissing = Boolean(info?.cudartMissing);
  const canInstallOrRepair = Boolean(info?.updateAvailable && info?.assetName);
  const canRepairCudartOnly = cudartMissing && !llamaMissing && !cudaNotReady && Boolean(info?.cudartAssetName);

  return (
    <div className="px-8 py-10">
      {!isTauri() ? (
        <p className="max-w-lg text-sm text-[var(--app-muted)]">{t("settings.runtime.webOnly")}</p>
      ) : (
        <div className="max-w-xl space-y-8">
          {llamaMissing ? (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-900 dark:text-red-100"
            >
              <p className="font-semibold">{t("settings.runtime.llamaMissingTitle")}</p>
              <p className="mt-1 text-red-800/90 dark:text-red-100/90">
                {t("settings.runtime.llamaMissingBody")}
              </p>
            </div>
          ) : null}

          {cudaNotReady ? (
            <div
              role="alert"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
            >
              <p className="font-semibold">{t("settings.runtime.cudaRequiredTitle")}</p>
              <p className="mt-1 text-amber-800/90 dark:text-amber-100/90">
                {t("settings.runtime.cudaRequiredBody")}
              </p>
              {info?.llamaServerPath ? (
                <p className="mt-2 break-all font-mono text-[11px] opacity-80">{info.llamaServerPath}</p>
              ) : null}
            </div>
          ) : null}

          {cudartMissing ? (
            <div
              role="alert"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
            >
              <p className="font-semibold">{t("settings.runtime.cudartMissingTitle")}</p>
              <p className="mt-1 text-amber-800/90 dark:text-amber-100/90">
                {t("settings.runtime.cudartMissingBody")}
              </p>
              {info?.missingCudartDlls?.length ? (
                <p className="mt-2 font-mono text-[11px] opacity-80">{info.missingCudartDlls.join(", ")}</p>
              ) : null}
            </div>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadInfo()}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)] disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} strokeWidth={2} />
                {t("settings.runtime.checkUpdates")}
              </button>
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#0080ff] underline-offset-2 hover:underline"
              >
                {t("settings.runtime.releaseNotes")}
              </a>
            </div>

            {info && (
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4 text-sm">
                {!info.supported ? (
                  <p className="text-[var(--app-muted)]">{t("settings.runtime.unsupportedPlatform")}</p>
                ) : !info.assetName ? (
                  <p className="text-amber-700 dark:text-amber-300">{t("settings.runtime.noMatchingAsset")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[var(--app-text)]">
                      <span>
                        <span className="text-[var(--app-muted)]">{t("settings.runtime.latest")} </span>
                        <span className="font-mono">{info.latestTag}</span>
                      </span>
                      <span>
                        <span className="text-[var(--app-muted)]">{t("settings.runtime.installed")} </span>
                        <span className="font-mono">{info.installedTag ?? "—"}</span>
                      </span>
                      {info.installedBackend ? (
                        <span>
                          <span className="text-[var(--app-muted)]">{t("settings.runtime.installedBackend")} </span>
                          <span className="font-mono uppercase">{info.installedBackend}</span>
                        </span>
                      ) : null}
                    </div>
                    {info.assetName ? (
                      <p className="mt-2 font-mono text-xs text-[var(--app-text)]/90">
                        <span className="text-[var(--app-muted)]">{t("settings.runtime.asset")} </span>
                        {info.assetUrl ? (
                          <a
                            href={info.assetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-[#0080ff] underline-offset-2 hover:underline"
                          >
                            {info.assetName}
                          </a>
                        ) : (
                          <span className="break-all">{info.assetName}</span>
                        )}
                        {info.assetSize != null ? (
                          <span className="text-[var(--app-muted)]"> ({formatBytes(info.assetSize)})</span>
                        ) : null}
                      </p>
                    ) : null}
                    {info.cudartAssetName ? (
                      <p className="mt-1 font-mono text-xs text-[var(--app-text)]/90">
                        <span className="text-[var(--app-muted)]">{t("settings.runtime.cudartAsset")} </span>
                        {info.cudartUrl ? (
                          <a
                            href={info.cudartUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-[#0080ff] underline-offset-2 hover:underline"
                          >
                            {info.cudartAssetName}
                          </a>
                        ) : (
                          <span className="break-all">{info.cudartAssetName}</span>
                        )}
                      </p>
                    ) : null}
                    {info.binDir && (
                      <p className="mt-2 break-all font-mono text-xs text-[var(--app-muted)]">
                        {t("settings.runtime.binDir")} {info.binDir}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {canInstallOrRepair ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onDownload()}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#0080ff] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0070e0] disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" strokeWidth={2} />
                          {t("settings.runtime.downloadUpdate")}
                        </button>
                      ) : !info.updateAvailable ? (
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {t("settings.runtime.latestInstalled")}
                        </span>
                      ) : null}
                      {canRepairCudartOnly ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onDownloadCudartOnly()}
                          className="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)] disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" strokeWidth={2} />
                          {t("settings.runtime.downloadCudartOnly")}
                        </button>
                      ) : null}
                      {canRemoveInstalled ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onRemove()}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/15 disabled:opacity-50 dark:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                          {t("settings.runtime.removeInstalled")}
                        </button>
                      ) : null}
                    </div>
                    {busy && (
                      <div className="mt-3">
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--app-border)]">
                          <div
                            className="h-full bg-[#0080ff] transition-[width] duration-300"
                            style={{ width: `${dlPct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--app-muted)]">
                          {Math.round(dlPct)}%
                          {dlPhase ? (
                            <span className="ml-2 font-mono text-[10px] opacity-80">{dlPhase}</span>
                          ) : null}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
