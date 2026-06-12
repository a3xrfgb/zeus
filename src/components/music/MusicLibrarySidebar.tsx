import {
  ChevronRight,
  Disc3,
  FolderOpen,
  Heart,
  Library,
  ListMusic,
  Mic2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import {
  getCategoryGroups,
  getImportedMusicFolders,
  useMusicStore,
} from "../../store/musicStore";
import type { MusicCategory } from "../../types/music";
import { MusicFolderRow } from "./MusicFolderRow";
import { MusicImportMenu } from "./MusicImportMenu";

type SectionDef = {
  id: MusicCategory;
  labelKey: string;
  icon: typeof Library;
};

const SECTIONS: SectionDef[] = [
  { id: "playlists", labelKey: "music.playlists", icon: ListMusic },
  { id: "artists", labelKey: "music.artists", icon: Mic2 },
  { id: "albums", labelKey: "music.albums", icon: Disc3 },
  { id: "genres", labelKey: "music.genres", icon: Tags },
];

function SidebarSection({
  section,
  expanded,
  onToggle,
  items,
  activeCategory,
  selectedGroup,
  onSelectItem,
  onRemoveItem,
  showRemove,
}: {
  section: SectionDef;
  expanded: boolean;
  onToggle: () => void;
  items: { id: string; label: string }[];
  activeCategory: MusicCategory;
  selectedGroup: string | null;
  onSelectItem: (id: string) => void;
  onRemoveItem?: (id: string) => void;
  showRemove?: boolean;
}) {
  const { t } = useTranslation();
  const Icon = section.icon;
  const isActiveSection = activeCategory === section.id && !selectedGroup;

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold uppercase tracking-wide transition",
          isActiveSection
            ? "bg-[var(--music-active)] text-[var(--music-text)]"
            : "text-[var(--music-muted)] hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]",
        )}
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition", expanded && "rotate-90")}
        />
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{t(section.labelKey)}</span>
        <span className="ml-auto text-[10px] font-medium tabular-nums opacity-70">{items.length}</span>
      </button>

      {expanded ? (
        <ul className="mb-2 ml-2 mt-0.5 space-y-0.5 border-l border-[var(--music-border)] pl-2">
          {items.length === 0 ? (
            <li className="px-2 py-1.5 text-[11px] text-[var(--music-muted)]">
              {t("music.emptyCategory")}
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id} className="group/row flex min-w-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition",
                    activeCategory === section.id && selectedGroup === item.id
                      ? "bg-[var(--music-active)] font-medium text-[var(--music-text)]"
                      : "text-[var(--music-muted)] hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]",
                  )}
                  title={item.label}
                >
                  {item.label}
                </button>
                {showRemove && onRemoveItem ? (
                  <button
                    type="button"
                    title={t("music.removePlaylist")}
                    onClick={() => onRemoveItem(item.id)}
                    className="shrink-0 rounded p-1 text-[var(--music-muted)] opacity-0 transition hover:text-[var(--music-text)] group-hover/row:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function MusicLibrarySidebar() {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const tracks = useMusicStore((s) => s.tracks);
  const playlists = useMusicStore((s) => s.playlists);
  const category = useMusicStore((s) => s.category);
  const selectedGroup = useMusicStore((s) => s.selectedGroup);
  const search = useMusicStore((s) => s.search);
  const favoriteTrackIds = useMusicStore((s) => s.favoriteTrackIds);
  const folderLabels = useMusicStore((s) => s.folderLabels);
  const collapsed = useMusicStore((s) => s.sidebarCollapsed);
  const setSearch = useMusicStore((s) => s.setSearch);
  const browse = useMusicStore((s) => s.browse);
  const removePlaylist = useMusicStore((s) => s.removePlaylist);
  const removeImportedFolder = useMusicStore((s) => s.removeImportedFolder);
  const renameImportedFolder = useMusicStore((s) => s.renameImportedFolder);
  const toggleSidebar = useMusicStore((s) => s.toggleSidebar);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    playlists: true,
    artists: false,
    albums: false,
    folders: true,
    genres: false,
  });

  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const libraryActive = category === "all" && !selectedGroup;
  const favoritesActive = category === "favorites";
  const folders = useMemo(
    () => getImportedMusicFolders(tracks, folderLabels),
    [tracks, folderLabels],
  );
  const foldersExpanded = expanded.folders ?? true;
  const foldersSectionActive = category === "folders" && !selectedGroup;

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-2 rounded-lg border border-[var(--music-border)] bg-[var(--music-surface)] p-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--music-muted)] transition hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]"
          title={t("music.expandSidebar")}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => browse("all")}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md transition",
            libraryActive
              ? "bg-[var(--music-active)] text-[var(--music-text)]"
              : "text-[var(--music-muted)] hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]",
          )}
          title={t("music.library")}
        >
          <Library className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => browse("favorites")}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md transition",
            favoritesActive
              ? "bg-[var(--music-active)] text-rose-500"
              : "text-[var(--music-muted)] hover:bg-[var(--music-hover)] hover:text-rose-500",
          )}
          title={t("music.favorites")}
        >
          <Heart className={cn("h-4 w-4", favoritesActive && "fill-current")} />
        </button>
        <MusicImportMenu />
      </aside>
    );
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-3 rounded-lg border border-[var(--music-border)] bg-[var(--music-surface)] p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2 text-[var(--music-text)]">
          <Library className="h-5 w-5 shrink-0" />
          <span className="truncate text-sm font-bold">{t("music.library")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <MusicImportMenu />
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--music-muted)] transition hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]"
            title={t("music.collapseSidebar")}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="px-1 text-[10px] leading-snug text-[var(--music-muted)]">{t("music.offlineHint")}</p>

      <div className="relative px-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--music-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("music.search")}
          className="w-full rounded-full border border-[var(--music-border)] bg-[var(--music-elevated)] py-2 pl-9 pr-3 text-xs text-[var(--music-text)] placeholder:text-[var(--music-muted)] outline-none focus:border-[var(--music-accent)]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        <button
          type="button"
          onClick={() => browse("all")}
          className={cn(
            "mb-2 flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm font-semibold transition",
            libraryActive
              ? "bg-[var(--music-active)] text-[var(--music-text)]"
              : "text-[var(--music-muted)] hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]",
          )}
        >
          <Library className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("music.library")}</span>
          <span className="ml-auto text-xs tabular-nums opacity-70">{tracks.length}</span>
        </button>

        <button
          type="button"
          onClick={() => browse("favorites")}
          className={cn(
            "mb-3 flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm font-semibold transition",
            favoritesActive
              ? "bg-[var(--music-active)] text-[var(--music-text)]"
              : "text-[var(--music-muted)] hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]",
          )}
        >
          <Heart
            className={cn(
              "h-4 w-4 shrink-0",
              favoritesActive ? "fill-rose-500 text-rose-500" : "text-rose-500",
            )}
          />
          <span className="truncate">{t("music.favorites")}</span>
          <span className="ml-auto text-xs tabular-nums opacity-70">{favoriteTrackIds.length}</span>
        </button>

        <div className="min-w-0">
          <button
            type="button"
            onClick={() => {
              toggle("folders");
              browse("folders");
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold uppercase tracking-wide transition",
              foldersSectionActive
                ? "bg-[var(--music-active)] text-[var(--music-text)]"
                : "text-[var(--music-muted)] hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]",
            )}
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 shrink-0 transition", foldersExpanded && "rotate-90")}
            />
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("music.folders")}</span>
            <span className="ml-auto text-[10px] font-medium tabular-nums opacity-70">
              {folders.length}
            </span>
          </button>

          {foldersExpanded ? (
            <div className="mb-2 ml-2 mt-0.5 space-y-0.5 border-l border-[var(--music-border)] pl-2">
              {folders.length === 0 ? (
                <p className="px-2 py-1.5 text-[11px] text-[var(--music-muted)]">
                  {t("music.noFolders")}
                </p>
              ) : (
                folders.map((folder) => (
                  <MusicFolderRow
                    key={folder.id}
                    id={folder.id}
                    label={folder.label}
                    count={folder.count}
                    active={category === "folders" && selectedGroup === folder.id}
                    onSelect={() => browse("folders", folder.id)}
                    onRename={(next) => {
                      renameImportedFolder(folder.id, next);
                      pushToast(t("music.folderRenamed"), "success");
                    }}
                    onRemove={() => {
                      void removeImportedFolder(folder.id).then(() => {
                        pushToast(t("music.folderRemoved"), "info");
                      });
                    }}
                  />
                ))
              )}
            </div>
          ) : null}
        </div>

        {SECTIONS.map((section) => (
          <SidebarSection
            key={section.id}
            section={section}
            expanded={expanded[section.id] ?? false}
            onToggle={() => {
              toggle(section.id);
              browse(section.id);
            }}
            items={getCategoryGroups(tracks, playlists, section.id, folderLabels)}
            activeCategory={category}
            selectedGroup={selectedGroup}
            onSelectItem={(id) => browse(section.id, id)}
            onRemoveItem={section.id === "playlists" ? removePlaylist : undefined}
            showRemove={section.id === "playlists"}
          />
        ))}
      </div>
    </aside>
  );
}
