import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, FileAudio, FolderOpen, ListMusic, Plus } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { useUiStore } from "../../store/uiStore";
import { useMusicStore } from "../../store/musicStore";

export function MusicImportMenu({ prominent = false }: { prominent?: boolean }) {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const loading = useMusicStore((s) => s.loading);
  const importFiles = useMusicStore((s) => s.importFiles);
  const importFolder = useMusicStore((s) => s.importFolder);
  const importPlaylist = useMusicStore((s) => s.importPlaylist);

  const run = (fn: () => Promise<number>, emptyKey?: string) => {
    void (async () => {
      const added = await fn();
      if (added > 0) {
        pushToast(t("music.addedTracks", { count: added }), "success");
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
              ? "inline-flex items-center gap-2 rounded-full bg-[var(--music-play-bg)] px-6 py-3 text-sm font-bold text-[var(--music-play-fg)] transition hover:scale-105 hover:bg-[var(--music-play-bg-hover)] disabled:opacity-50"
              : "flex items-center gap-1 rounded-full border border-[var(--music-border)] bg-[var(--music-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--music-text)] transition hover:bg-[var(--music-hover)] disabled:opacity-50 data-[state=open]:bg-[var(--music-hover)]"
          }
        >
          <Plus className={prominent ? "h-4 w-4" : "h-3.5 w-3.5"} />
          {prominent ? t("music.addFirst") : t("music.import")}
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
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--app-text)] outline-none data-[highlighted]:bg-[var(--sidebar-hover)]"
            onSelect={() => run(importFiles, "music.noFilesFound")}
          >
            <FileAudio className="h-4 w-4 text-[var(--app-muted)]" />
            {t("music.importFiles")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--app-text)] outline-none data-[highlighted]:bg-[var(--sidebar-hover)]"
            onSelect={() => run(importFolder, "music.noFilesFound")}
          >
            <FolderOpen className="h-4 w-4 text-[var(--app-muted)]" />
            {t("music.importFolder")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--app-text)] outline-none data-[highlighted]:bg-[var(--sidebar-hover)]"
            onSelect={() => run(importPlaylist, "music.noPlaylistTracks")}
          >
            <ListMusic className="h-4 w-4 text-[var(--app-muted)]" />
            {t("music.importPlaylist")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
