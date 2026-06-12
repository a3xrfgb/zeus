import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Images,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import {
  getImportedFolderEntries,
  usePhotoGalleryStore,
} from "../../store/photoGalleryStore";
import { PhotoGalleryImportMenu } from "./PhotoGalleryImportMenu";

function FolderRow({
  id,
  label,
  count,
  active,
  onSelect,
  onRename,
  onRemove,
}: {
  id: string;
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  onRename: (next: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(label);
    setEditing(true);
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commitRename = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== label) onRename(next);
  };

  return (
    <div className="group/folder flex min-w-0 items-center gap-0.5">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded-lg border border-[var(--gallery-accent)]/50 bg-[var(--gallery-elevated)] px-2 py-1.5 text-sm text-[var(--gallery-text)] outline-none"
          aria-label={t("photoGallery.renameFolder")}
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
            active
              ? "bg-[var(--gallery-active)] text-[var(--gallery-text)]"
              : "text-[var(--gallery-muted)] hover:bg-[var(--gallery-hover)] hover:text-[var(--gallery-text)]",
          )}
          title={id}
        >
          <FolderOpen className="h-4 w-4 shrink-0 opacity-80" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="text-xs tabular-nums opacity-60">{count}</span>
        </button>
      )}

      {!editing ? (
        <div className="flex shrink-0 items-center opacity-0 transition group-hover/folder:opacity-100 group-focus-within/folder:opacity-100">
          <button
            type="button"
            title={t("photoGallery.renameFolder")}
            aria-label={t("photoGallery.renameFolder")}
            onClick={startRename}
            className="rounded p-1 text-[var(--gallery-muted)] transition hover:bg-[var(--gallery-hover)] hover:text-[var(--gallery-text)]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={t("photoGallery.removeFolder")}
            aria-label={t("photoGallery.removeFolder")}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded p-1 text-[var(--gallery-muted)] transition hover:bg-red-500/15 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PhotoGallerySidebar() {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const photos = usePhotoGalleryStore((s) => s.photos);
  const importedFolders = usePhotoGalleryStore((s) => s.importedFolders);
  const folderAliases = usePhotoGalleryStore((s) => s.folderAliases);
  const selectedFolder = usePhotoGalleryStore((s) => s.selectedFolder);
  const search = usePhotoGalleryStore((s) => s.search);
  const setSearch = usePhotoGalleryStore((s) => s.setSearch);
  const setSelectedFolder = usePhotoGalleryStore((s) => s.setSelectedFolder);
  const removeImportedFolder = usePhotoGalleryStore((s) => s.removeImportedFolder);
  const renameImportedFolder = usePhotoGalleryStore((s) => s.renameImportedFolder);
  const collapsed = usePhotoGalleryStore((s) => s.sidebarCollapsed);
  const toggleSidebar = usePhotoGalleryStore((s) => s.toggleSidebar);

  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const folders = useMemo(
    () => getImportedFolderEntries(importedFolders, folderAliases, photos),
    [importedFolders, folderAliases, photos],
  );
  const libraryActive = !selectedFolder;

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-2 rounded-xl border border-[var(--gallery-border)] bg-[var(--gallery-glass)] p-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--gallery-muted)] transition hover:bg-[var(--gallery-hover)] hover:text-[var(--gallery-text)]"
          title={t("photoGallery.expandSidebar")}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <PhotoGalleryImportMenu />
      </aside>
    );
  }

  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-3 rounded-xl border border-[var(--gallery-border)] bg-[var(--gallery-glass)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--gallery-accent)]/15 text-[var(--gallery-accent)]">
            <Images className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-semibold text-[var(--gallery-text)]">
            {t("photoGallery.library")}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--gallery-muted)] transition hover:bg-[var(--gallery-hover)] hover:text-[var(--gallery-text)]"
          title={t("photoGallery.collapseSidebar")}
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--gallery-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("photoGallery.search")}
          className="w-full rounded-lg border border-[var(--gallery-border)] bg-[var(--gallery-elevated)]/80 py-2 pl-8 pr-3 text-sm text-[var(--gallery-text)] outline-none placeholder:text-[var(--gallery-muted)] focus:border-[var(--gallery-accent)]/50"
        />
      </div>

      <PhotoGalleryImportMenu prominent />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => setSelectedFolder(null)}
          className={cn(
            "mb-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition",
            libraryActive
              ? "bg-[var(--gallery-active)] text-[var(--gallery-text)]"
              : "text-[var(--gallery-muted)] hover:bg-[var(--gallery-hover)] hover:text-[var(--gallery-text)]",
          )}
        >
          <Images className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("photoGallery.allPhotos")}</span>
          <span className="ml-auto text-xs tabular-nums opacity-70">{photos.length}</span>
        </button>

        <div className="mb-1 flex items-center gap-1 px-1">
          <button
            type="button"
            className="rounded p-0.5 text-[var(--gallery-muted)] transition hover:bg-[var(--gallery-hover)]"
            onClick={() => setFoldersExpanded((e) => !e)}
            aria-expanded={foldersExpanded}
          >
            {foldersExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--gallery-muted)]">
            {t("photoGallery.folders")}
          </span>
        </div>

        {foldersExpanded ? (
          <div className="flex flex-col gap-0.5">
            {folders.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[var(--gallery-muted)]">
                {t("photoGallery.noFolders")}
              </p>
            ) : (
              folders.map((folder) => (
                <FolderRow
                  key={folder.id}
                  id={folder.id}
                  label={folder.label}
                  count={folder.count}
                  active={selectedFolder === folder.id}
                  onSelect={() => setSelectedFolder(folder.id)}
                  onRename={(next) => {
                    renameImportedFolder(folder.id, next);
                    pushToast(t("photoGallery.folderRenamed"), "success");
                  }}
                  onRemove={() => {
                    removeImportedFolder(folder.id);
                    pushToast(t("photoGallery.folderRemoved"), "info");
                  }}
                />
              ))
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
