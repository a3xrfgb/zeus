import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, FileStack, FolderOpen, Plus } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { useUiStore } from "../../store/uiStore";
import { usePhotoGalleryStore } from "../../store/photoGalleryStore";

export function PhotoGalleryImportMenu({ prominent = false }: { prominent?: boolean }) {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const loading = usePhotoGalleryStore((s) => s.loading);
  const importFiles = usePhotoGalleryStore((s) => s.importFiles);
  const importFolder = usePhotoGalleryStore((s) => s.importFolder);

  const run = (fn: () => Promise<number>, emptyKey?: string) => {
    void (async () => {
      const added = await fn();
      if (added > 0) {
        pushToast(t("photoGallery.addedPhotos", { count: added }), "success");
      } else if (emptyKey) {
        pushToast(t(emptyKey), "info");
      }
    })();
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={loading}>
        <button
          type="button"
          className={
            prominent
              ? "inline-flex items-center gap-2 rounded-full bg-[var(--gallery-accent)] px-6 py-3 text-sm font-bold text-white transition hover:scale-105 hover:bg-[var(--gallery-accent-hover)] disabled:opacity-50"
              : "flex items-center gap-1 rounded-full border border-[var(--gallery-border)] bg-[var(--gallery-glass)] px-3 py-1.5 text-xs font-semibold text-[var(--gallery-text)] backdrop-blur-md transition hover:bg-[var(--gallery-hover)] disabled:opacity-50 data-[state=open]:bg-[var(--gallery-hover)]"
          }
        >
          <Plus className={prominent ? "h-4 w-4" : "h-3.5 w-3.5"} />
          {prominent ? t("photoGallery.addFirst") : t("photoGallery.import")}
          {!prominent ? <ChevronDown className="h-3 w-3 opacity-70" /> : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[500] min-w-[200px] overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1 text-[var(--app-text)] shadow-xl"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--sidebar-hover)]"
            onSelect={() => run(importFiles, "photoGallery.noFilesFound")}
          >
            <FileStack className="h-4 w-4 text-[var(--gallery-accent)]" />
            {t("photoGallery.importFiles")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--sidebar-hover)]"
            onSelect={() => run(importFolder, "photoGallery.noFilesFound")}
          >
            <FolderOpen className="h-4 w-4 text-[var(--gallery-accent)]" />
            {t("photoGallery.importFolder")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
