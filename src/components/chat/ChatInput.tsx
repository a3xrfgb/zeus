import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowUp,
  Eye,
  ImagePlus,
  Lightbulb,
  Plus,
  Square,
  X,
} from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import {
  type ComposerAttachment,
  fileToUserAttachment,
} from "../../lib/attachmentFromFile";
import { filesFromAbsolutePaths, isComposerImageFile } from "../../lib/composerDropFiles";
import { CHAT_IMAGE_ACCEPT } from "../../lib/imageFileTypes";
import { composerAttachMenuContent, composerAttachMenuItem } from "../../lib/sidebarGlassMenu";
import { publicAsset } from "../../lib/publicAsset";
import { cn } from "../../lib/utils";
import type { UserAttachment } from "../../lib/userMessageContent";
import { useChatComposerStore } from "../../store/chatComposerStore";
import { useUiStore } from "../../store/uiStore";
const iconStroke = 1.75;

function ComposerHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/comphint relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-[200] mb-1.5 -translate-x-1/2",
          "rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-1.5 py-1",
          "text-[11px] text-[var(--app-text)] opacity-0 shadow-md transition-opacity duration-150",
          // Hover only — not focus-within: after the attach dropdown closes, focus returns to the
          // + trigger and would otherwise keep this label stuck visible over the composer.
          "whitespace-nowrap group-hover/comphint:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function ChatInput({
  onSend,
  onStop,
  disabled,
  streaming,
  layout = "footer",
}: {
  onSend: (
    text: string,
    imageDataUrl?: string | null,
    attachments?: UserAttachment[] | null,
  ) => void;
  onStop: () => void;
  disabled?: boolean;
  streaming: boolean;
  /** `centered`: new-chat hero (no border strip); `footer`: default bottom bar. */
  layout?: "footer" | "centered";
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [fileAttachments, setFileAttachments] = useState<ComposerAttachment[]>([]);

  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileAttachRef = useRef<HTMLInputElement>(null);
  const pushToast = useUiStore((s) => s.pushToast);
  const thinkEnabled = useChatComposerStore((s) => s.thinkEnabled);
  const visionEnabled = useChatComposerStore((s) => s.visionEnabled);
  const toggleThink = useChatComposerStore((s) => s.toggleThink);
  const toggleVision = useChatComposerStore((s) => s.toggleVision);
  const composerPrefillRev = useChatComposerStore((s) => s.composerPrefill?.rev ?? 0);
  const composerImageRev = useChatComposerStore((s) => s.composerImage?.rev ?? 0);
  const composerDropRev = useChatComposerStore((s) => s.composerDropQueue?.rev ?? 0);

  useEffect(() => {
    const prefill = useChatComposerStore.getState().composerPrefill;
    if (!prefill) return;
    setText(prefill.text);
    useChatComposerStore.getState().clearComposerPrefill();
    queueMicrotask(() => {
      ta.current?.focus();
      const len = prefill.text.length;
      ta.current?.setSelectionRange(len, len);
    });
  }, [composerPrefillRev]);

  useEffect(() => {
    const img = useChatComposerStore.getState().composerImage;
    if (!img) return;
    setImagePreview(img.dataUrl);
    setImageDialogOpen(false);
    useChatComposerStore.getState().clearComposerImage();
    queueMicrotask(() => ta.current?.focus());
  }, [composerImageRev]);

  useEffect(() => {
    if (!visionEnabled) {
      setImagePreview(null);
      setImageDialogOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [visionEnabled]);

  useEffect(() => {
    if (!ta.current) return;
    ta.current.style.height = "0px";
    ta.current.style.height = `${Math.min(ta.current.scrollHeight, 200)}px`;
  }, [text]);

  const trimmed = text.trim();
  const canSend = Boolean(
    (trimmed ||
      (visionEnabled && imagePreview) ||
      fileAttachments.length > 0) &&
      !streaming,
  );

  const submit = () => {
    if (streaming) return;
    if (!trimmed && !(visionEnabled && imagePreview) && fileAttachments.length === 0) return;
    const img = visionEnabled ? imagePreview : null;
    const att: UserAttachment[] | undefined =
      fileAttachments.length > 0 ? fileAttachments : undefined;
    onSend(trimmed, img, att);
    setText("");
    if (img) {
      setImagePreview(null);
      if (fileRef.current) fileRef.current.value = "";
    }
    if (att?.length) {
      setFileAttachments([]);
      if (fileAttachRef.current) fileAttachRef.current.value = "";
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isComposerImageFile(file)) return;
    if (!visionEnabled) {
      useChatComposerStore.getState().setVisionEnabled(true);
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const ingestAttachmentFiles = useCallback(
    async (files: File[]) => {
      const added: ComposerAttachment[] = [];
      for (const file of files) {
        try {
          added.push(await fileToUserAttachment(file));
        } catch (err) {
          const s = String(err);
          if (s.includes("FILE_TOO_LARGE")) {
            pushToast(t("chatInput.fileTooLarge"), "error");
          } else {
            pushToast(s, "error");
          }
        }
      }
      if (added.length) setFileAttachments((prev) => [...prev, ...added]);
    },
    [pushToast, t],
  );

  const handleDroppedFiles = useCallback(
    async (files: File[]) => {
      if (disabled || streaming || files.length === 0) return;

      const images = files.filter(isComposerImageFile);
      const nonImages = files.filter((f) => !isComposerImageFile(f));

      if (nonImages.length > 0) {
        await ingestAttachmentFiles(files);
        queueMicrotask(() => ta.current?.focus());
        return;
      }

      if (visionEnabled && images.length === 1) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
          setImageDialogOpen(false);
          queueMicrotask(() => ta.current?.focus());
        };
        reader.readAsDataURL(images[0]);
        return;
      }

      await ingestAttachmentFiles(images);
      queueMicrotask(() => ta.current?.focus());
    },
    [disabled, streaming, visionEnabled, ingestAttachmentFiles],
  );

  useEffect(() => {
    const queue = useChatComposerStore.getState().composerDropQueue;
    if (!queue) return;
    useChatComposerStore.getState().clearComposerDropQueue();
    void handleDroppedFiles(queue.files);
  }, [composerDropRev, handleDroppedFiles]);

  const pickAttachedFiles = useCallback(async () => {
    if (disabled || streaming) return;
    if (isTauri()) {
      try {
        const selected = await open({ multiple: true, directory: false });
        if (selected === null) return;
        const paths = Array.isArray(selected) ? selected : [selected];
        await ingestAttachmentFiles(await filesFromAbsolutePaths(paths));
      } catch (e) {
        pushToast(String(e), "error");
      }
      return;
    }
    queueMicrotask(() => fileAttachRef.current?.click());
  }, [disabled, streaming, ingestAttachmentFiles, pushToast]);

  const onFileAttachChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = "";
    if (!list?.length) return;
    void ingestAttachmentFiles(Array.from(list));
  };

  const removeFileAttachment = (index: number) => {
    setFileAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImagePreview(null);
    setImageDialogOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toolbarBtn =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--app-text)] transition-colors hover:bg-[var(--chat-composer-toolbar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)]";

  const isCentered = layout === "centered";

  return (
    <div
      className={cn(
        isCentered
          ? "bg-transparent px-2 pb-2 pt-1"
          : "border-t border-[var(--app-border)] bg-[var(--app-bg)]/95 px-4 pb-4 pt-3 backdrop-blur-sm",
      )}
    >
      <div
        className={cn(
          "mx-auto flex flex-col gap-3",
          isCentered ? "w-full max-w-3xl" : "w-full max-w-3xl",
        )}
      >
        <div
          className={cn(
            "flex cursor-text flex-col rounded-[28px] border border-[var(--app-border)] bg-[var(--chat-composer-bg)] p-2 transition-colors",
            isCentered
              ? "shadow-[0_12px_48px_rgba(0,0,0,0.1)] dark:border-white/[0.08] dark:shadow-[0_12px_48px_rgba(0,0,0,0.45)]"
              : "shadow-sm dark:border-transparent",
          )}
          onClick={() => ta.current?.focus()}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={CHAT_IMAGE_ACCEPT}
            onChange={onFileChange}
          />
          <input
            ref={fileAttachRef}
            type="file"
            className="hidden"
            multiple
            onChange={onFileAttachChange}
          />

          {fileAttachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2 px-0.5 pt-0.5">
              {fileAttachments.map((a, i) => (
                <div
                  key={`${a.name}-${i}-${a.dataBase64.slice(0, 12)}`}
                  className="relative flex min-h-[5.75rem] w-[min(100%,9.5rem)] flex-col rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/95 p-2.5 shadow-sm dark:border-white/[0.12] dark:bg-white/[0.05]"
                >
                  <button
                    type="button"
                    className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[var(--app-muted)] transition hover:bg-[var(--chat-composer-toolbar-hover)] hover:text-[var(--app-text)]"
                    aria-label={t("chatInput.removeAttachment")}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFileAttachment(i);
                    }}
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                  <div className="mt-4 min-w-0 flex-1 pl-0.5">
                    <p className="break-words text-[13px] font-semibold leading-snug text-[var(--app-text)]">
                      {a.name}
                    </p>
                    {a.lineCount != null ? (
                      <p className="mt-1 text-[11px] text-[var(--app-muted)]">
                        {a.lineCount === 1
                          ? t("chatInput.attachmentOneLine")
                          : t("chatInput.attachmentLineCount", { count: a.lineCount })}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-2 flex justify-start">
                    <span className="rounded-md border border-[var(--app-border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)] dark:border-white/15">
                      {a.badge ?? "FILE"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {imagePreview ? (
            <Dialog.Root open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
              <div className="relative mb-1 w-fit px-0.5 pt-0.5">
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="block overflow-hidden rounded-2xl ring-offset-2 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)]"
                  >
                    <img
                      src={imagePreview}
                      alt=""
                      className="h-14 w-14 object-cover"
                    />
                  </button>
                </Dialog.Trigger>
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--app-surface)]/90 text-[var(--app-text)] shadow-sm transition hover:bg-[var(--app-bg)]"
                  aria-label={t("chatInput.removeImage")}
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              </div>
              <Dialog.Portal>
                <Dialog.Overlay
                  className="fixed inset-0 z-[430] cursor-default bg-black/60 backdrop-blur-sm"
                  onClick={() => setImageDialogOpen(false)}
                />
                <Dialog.Content
                  className="fixed left-1/2 top-1/2 z-[431] w-[min(90vw,800px)] max-h-[95vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-2xl focus:outline-none"
                  onClick={() => setImageDialogOpen(false)}
                >
                  <Dialog.Title className="sr-only">{t("chatInput.fullImagePreview")}</Dialog.Title>
                  <Dialog.Description className="sr-only">{t("chatInput.fullImagePreview")}</Dialog.Description>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <img
                      src={imagePreview}
                      alt=""
                      className="max-h-[min(90vh,900px)] w-full rounded-3xl object-contain"
                    />
                    <Dialog.Close
                      type="button"
                      className="absolute right-3 top-3 z-10 rounded-full bg-[var(--app-bg)]/80 p-1.5 text-[var(--app-text)] transition hover:bg-[var(--chat-composer-toolbar-hover)]"
                      aria-label={t("topBar.close")}
                    >
                      <X className="h-5 w-5" strokeWidth={2} />
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          ) : null}

          <textarea
            ref={ta}
            rows={1}
            className={cn(
              "min-h-12 w-full resize-none border-0 bg-transparent p-3 text-[15px] leading-relaxed outline-none",
              "text-[var(--app-text)] placeholder:text-[var(--app-muted)]",
              "caret-[#b8d96a] focus-visible:ring-0",
              "max-h-[200px]",
            )}
            placeholder={t("chatInput.placeholder")}
            value={text}
            disabled={disabled || streaming}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />

          <div className="mt-0.5 p-1 pt-0">
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 items-center gap-1.5">
                <DropdownMenu.Root>
                  <ComposerHint label={t("chatInput.addAttachments")}>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        disabled={disabled || streaming}
                        className={cn(
                          toolbarBtn,
                          "data-[state=open]:bg-[var(--chat-composer-toolbar-hover)]",
                          (disabled || streaming) && "pointer-events-none opacity-40",
                        )}
                        aria-label={t("chatInput.addAttachments")}
                        aria-haspopup="menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Plus className="h-5 w-5" strokeWidth={iconStroke} />
                      </button>
                    </DropdownMenu.Trigger>
                  </ComposerHint>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className={composerAttachMenuContent}
                      side="top"
                      align="start"
                      sideOffset={8}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu.Item
                        className={composerAttachMenuItem}
                        disabled={disabled || streaming}
                        onSelect={() => {
                          if (!visionEnabled) {
                            useChatComposerStore.getState().setVisionEnabled(true);
                          }
                          // No event.preventDefault() — Radix keeps the menu open when prevented; we want it to close after pick.
                          queueMicrotask(() => fileRef.current?.click());
                        }}
                      >
                        <ImagePlus className="h-4 w-4 shrink-0 opacity-85" strokeWidth={iconStroke} />
                        {t("chatInput.attachImage")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={composerAttachMenuItem}
                        disabled={disabled || streaming}
                        onSelect={() => {
                          void pickAttachedFiles();
                        }}
                      >
                        <img
                          src={publicAsset("icons/attach-file.png")}
                          alt=""
                          width={16}
                          height={16}
                          className="h-4 w-4 shrink-0 opacity-85 dark:invert"
                          aria-hidden
                        />
                        {t("chatInput.attachFile")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                <ComposerHint label={t("chatInput.thinkHint")}>
                  <button
                    type="button"
                    disabled={disabled || streaming}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleThink();
                    }}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)]",
                      thinkEnabled
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
                        : "text-[var(--app-muted)] hover:bg-[var(--chat-composer-toolbar-hover)]",
                      (disabled || streaming) && "pointer-events-none opacity-40",
                    )}
                    aria-pressed={thinkEnabled}
                    aria-label={t("chatInput.think")}
                  >
                    <Lightbulb
                      className={cn(
                        "h-4 w-4 shrink-0",
                        thinkEnabled ? "text-sky-600 dark:text-sky-400" : "opacity-70",
                      )}
                      strokeWidth={iconStroke}
                    />
                    {t("chatInput.think")}
                  </button>
                </ComposerHint>
                <ComposerHint label={t("chatInput.visionHint")}>
                  <button
                    type="button"
                    disabled={disabled || streaming}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVision();
                    }}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)]",
                      visionEnabled
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
                        : "text-[var(--app-muted)] hover:bg-[var(--chat-composer-toolbar-hover)]",
                      (disabled || streaming) && "pointer-events-none opacity-40",
                    )}
                    aria-pressed={visionEnabled}
                    aria-label={t("chatInput.vision")}
                  >
                    <Eye
                      className={cn(
                        "h-4 w-4 shrink-0",
                        visionEnabled ? "text-amber-600 dark:text-amber-400" : "opacity-70",
                      )}
                      strokeWidth={iconStroke}
                    />
                    {t("chatInput.vision")}
                  </button>
                </ComposerHint>
              </div>

              <div className="ml-auto flex min-w-0 items-center gap-2">
                {streaming ? (
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-500/25 text-red-200 transition hover:bg-red-500/35"
                    title={t("chatInput.stop")}
                    aria-label={t("chatInput.stopGen")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop();
                    }}
                  >
                    <Square className="h-4 w-4 fill-current" strokeWidth={0} />
                  </button>
                ) : (
                  <ComposerHint label={t("chatInput.send")}>
                    <button
                      type="button"
                      disabled={!canSend}
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
                        "bg-neutral-900 text-white hover:bg-neutral-800",
                        "dark:bg-white dark:text-neutral-900 dark:hover:bg-white/90",
                        "disabled:pointer-events-none disabled:opacity-40",
                        "dark:disabled:bg-[#515151] dark:disabled:text-neutral-300",
                      )}
                      aria-label={t("chatInput.sendMessage")}
                      onClick={(e) => {
                        e.stopPropagation();
                        submit();
                      }}
                    >
                      <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
                    </button>
                  </ComposerHint>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
