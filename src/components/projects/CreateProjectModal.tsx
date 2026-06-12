import * as Dialog from "@radix-ui/react-dialog";
import { open as openNativeFolderDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../store/chatStore";
import { useUiStore } from "../../store/uiStore";

export const PROJECT_COLOR_PRESETS = [
  "#000000",
  "#ffffff",
  "#7c6af7",
  "#14b8a6",
  "#f59e0b",
  "#fde047",
  "#f43f5e",
  "#3b82f6",
  "#22c55e",
  "#84cc16",
  "#06b6d4",
  "#64748b",
] as const;

/** Default swatch (index 2 — indigo after black/white). */
const DEFAULT_PROJECT_COLOR = PROJECT_COLOR_PRESETS[2]!;

/** Border/ring so white & black presets stay visible on any surface. */
export function projectSwatchBorderClass(hex: string): string {
  const h = hex.toLowerCase();
  if (h === "#ffffff" || h === "#fff") {
    return "border-neutral-400 shadow-sm ring-1 ring-neutral-300/60 dark:border-neutral-500 dark:ring-neutral-600/50";
  }
  if (h === "#000000" || h === "#000") {
    return "border-neutral-600 dark:border-neutral-400";
  }
  return "border-white/30 dark:border-white/10";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProjectModal({ open: modalOpen, onOpenChange }: Props) {
  const createProject = useChatStore((s) => s.createProject);
  const pushToast = useUiStore((s) => s.pushToast);

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR);
  const [folderPath, setFolderPath] = useState<string | null>(null);

  useEffect(() => {
    if (modalOpen) {
      setName("");
      setColor(DEFAULT_PROJECT_COLOR);
      setFolderPath(null);
    }
  }, [modalOpen]);

  const pickFolder = useCallback(async () => {
    const dir = await openNativeFolderDialog({ directory: true, multiple: false });
    if (typeof dir === "string") {
      setFolderPath(dir);
    }
  }, []);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      pushToast("Enter a project name", "error");
      return;
    }
    try {
      await createProject(trimmed, {
        color,
        folderPath,
      });
      pushToast("Project created", "success");
      onOpenChange(false);
    } catch (e) {
      pushToast(String(e), "error");
    }
  }, [name, color, folderPath, createProject, pushToast, onOpenChange]);

  return (
    <Dialog.Root open={modalOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[500] animate-first-launch-overlay",
            "bg-black/40 dark:bg-black/50",
          )}
        />
        <Dialog.Content
          className={cn(
            "first-launch-onboarding-dialog fixed left-1/2 top-1/2 z-[510] w-[min(92vw,570px)] max-h-[min(88vh,560px)] -translate-x-1/2 -translate-y-1/2",
            "overflow-y-auto overflow-x-hidden outline-none",
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div
            className={cn(
              "animate-create-project-glass rounded-[22px] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-lg",
            )}
          >
            <div className="px-6 pb-6 pt-7">
              <Dialog.Title className="text-center font-sans text-[1.15rem] font-medium tracking-[-0.02em] text-[var(--app-text)]">
                Create project
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Name your project, pick a color, and optionally choose a folder on disk.
              </Dialog.Description>
              <p className="mt-1.5 text-center text-[12px] leading-relaxed text-[var(--app-muted)]">
                Name, color, and optional folder.
              </p>

              <div className="mt-7 space-y-5">
                <input
                  type="text"
                  autoFocus
                  className={cn(
                    "w-full rounded-xl border bg-[var(--app-bg)] px-3.5 py-2.5 text-[14px] outline-none transition",
                    "text-[var(--app-text)] placeholder:text-[var(--app-muted)]",
                    "border-[var(--app-border)] focus:border-[var(--app-text)]/25 focus:ring-1 focus:ring-[var(--app-text)]/10",
                  )}
                  placeholder="Project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />

                <div>
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
                    Color
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        className={cn(
                          "h-8 w-8 rounded-full border-2 transition",
                          "ring-offset-2 ring-offset-[var(--app-surface)]",
                          projectSwatchBorderClass(c),
                          color === c
                            ? "scale-105 border-[var(--app-text)] ring-2 ring-[var(--app-text)]/30"
                            : "hover:scale-105",
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3.5 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
                    Folder
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--app-muted)]">
                    Default uses your Zeus data directory, or pick a folder.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className={cn(
                        "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] text-[var(--app-text)] transition",
                        "hover:bg-[var(--app-bg)]",
                      )}
                      onClick={() => void pickFolder()}
                    >
                      Choose folder…
                    </button>
                    {folderPath ? (
                      <button
                        type="button"
                        className="text-left text-[11px] text-accent underline-offset-2 hover:underline"
                        onClick={() => setFolderPath(null)}
                      >
                        Use default
                      </button>
                    ) : null}
                  </div>
                  {folderPath ? (
                    <p className="mt-2 break-all font-mono text-[10px] leading-snug text-[var(--app-muted)]">
                      {folderPath}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-full px-4 py-2.5 text-[13px] font-medium text-[var(--app-muted)] transition hover:text-[var(--app-text)]"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-6 py-2.5 text-[13px] font-medium transition",
                      "bg-[var(--app-text)] text-[var(--app-bg)] shadow-md hover:opacity-90",
                      "active:scale-[0.98]",
                    )}
                    onClick={() => void submit()}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
