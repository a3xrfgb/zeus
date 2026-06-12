import { LayoutGrid, LayoutList, Pause, Play, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { getContextCoverArts } from "../../lib/musicArt";
import { getTrackCoverSrc } from "../../lib/musicCover";
import { formatDuration } from "../../lib/musicLocal";
import { cn } from "../../lib/utils";
import { getVisibleTrackIds, useMusicStore } from "../../store/musicStore";
import type { MusicCategory, MusicPlaylist, MusicTrack } from "../../types/music";
import { MusicBlurredBackdrop } from "./MusicBlurredBackdrop";
import { MusicFavoriteButton } from "./MusicFavoriteButton";
import { MusicImportMenu } from "./MusicImportMenu";
import { MusicTrackGridCard } from "./MusicTrackGridCard";

function TrackRow({
  track,
  index,
  active,
  playing,
  onPlay,
  onRemove,
}: {
  track: MusicTrack;
  index: number;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const coverSrc = getTrackCoverSrc(track);
  return (
    <tr
      className={cn(
        "group cursor-pointer border-b border-[var(--music-border)] transition hover:bg-[var(--music-hover)]",
        active && "bg-[var(--music-active)]",
      )}
      onClick={onPlay}
    >
      <td className="w-10 px-4 py-2 text-center text-sm text-[var(--music-muted)]">
        <div className="relative mx-auto flex h-6 w-6 items-center justify-center">
          <span
            className={cn(
              "tabular-nums group-hover:opacity-0",
              active && "text-[var(--music-accent)]",
            )}
          >
            {index + 1}
          </span>
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
            {active && playing ? (
              <Pause className="h-4 w-4 fill-current text-[var(--music-text)]" />
            ) : (
              <Play className="h-4 w-4 fill-current text-[var(--music-text)]" />
            )}
          </span>
        </div>
      </td>
      <td className="max-w-[280px] px-2 py-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--music-elevated)]">
            {coverSrc ? (
              <img src={coverSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--music-muted)]">
                ♪
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-sm",
                active ? "text-[var(--music-accent)]" : "text-[var(--music-text)]",
              )}
            >
              {track.title}
            </p>
            <p className="truncate text-xs text-[var(--music-muted)]">{track.artist}</p>
          </div>
        </div>
      </td>
      <td className="hidden truncate px-2 py-2 text-sm text-[var(--music-muted)] md:table-cell">
        {track.album}
      </td>
      <td className="hidden truncate px-2 py-2 text-sm text-[var(--music-muted)] lg:table-cell">
        {track.genre}
      </td>
      <td className="px-4 py-2 text-right text-sm tabular-nums text-[var(--music-muted)]">
        {formatDuration(track.durationSec)}
      </td>
      <td className="w-10 px-1 py-2">
        <MusicFavoriteButton
          trackId={track.id}
          className="opacity-0 group-hover:opacity-100"
        />
      </td>
      <td className="w-10 px-2 py-2">
        <button
          type="button"
          title={t("music.remove")}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded p-1 text-[var(--music-muted)] opacity-0 transition hover:text-[var(--music-text)] group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function headerTitle(
  category: MusicCategory,
  selectedGroup: string | null,
  playlists: MusicPlaylist[],
  t: (k: string) => string,
) {
  if (category === "playlists" && selectedGroup) {
    return playlists.find((p) => p.id === selectedGroup)?.name ?? t("music.playlists");
  }
  if (selectedGroup && category !== "playlists" && category !== "folders") return selectedGroup;
  switch (category) {
    case "playlists":
      return t("music.playlists");
    case "artists":
      return t("music.artists");
    case "albums":
      return t("music.albums");
    case "folders":
      return t("music.folders");
    case "genres":
      return t("music.genres");
    case "favorites":
      return t("music.favorites");
    default:
      return t("music.library");
  }
}

export function MusicMainContent() {
  const { t } = useTranslation();
  const tracks = useMusicStore((s) => s.tracks);
  const playlists = useMusicStore((s) => s.playlists);
  const category = useMusicStore((s) => s.category);
  const selectedGroup = useMusicStore((s) => s.selectedGroup);
  const search = useMusicStore((s) => s.search);
  const queue = useMusicStore((s) => s.queue);
  const queueIndex = useMusicStore((s) => s.queueIndex);
  const playing = useMusicStore((s) => s.playing);
  const playTrack = useMusicStore((s) => s.playTrack);
  const removeTrack = useMusicStore((s) => s.removeTrack);
  const libraryView = useMusicStore((s) => s.libraryView);
  const setLibraryView = useMusicStore((s) => s.setLibraryView);
  const favoriteTrackIds = useMusicStore((s) => s.favoriteTrackIds);

  const visibleIds = useMemo(
    () => getVisibleTrackIds(tracks, playlists, category, selectedGroup, search, favoriteTrackIds),
    [tracks, playlists, category, selectedGroup, search, favoriteTrackIds],
  );

  const visibleTracks = useMemo(
    () => visibleIds.map((id) => tracks.find((tr) => tr.id === id)).filter(Boolean) as MusicTrack[],
    [visibleIds, tracks],
  );

  const headerArts = useMemo(
    () => getContextCoverArts(visibleTracks, tracks),
    [visibleTracks, tracks],
  );

  const currentId = queueIndex >= 0 ? queue[queueIndex] : null;
  const title = headerTitle(category, selectedGroup, playlists, t);
  const headerArt = headerArts[0];

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--music-border)]">
      <MusicBlurredBackdrop images={headerArts} />

      <div className="relative z-10 flex shrink-0 items-end gap-6 px-6 pb-4 pt-8">
        <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-lg bg-[var(--music-elevated)] shadow-2xl ring-1 ring-[var(--music-border)]">
          {headerArts.length > 1 ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2">
              {headerArts.slice(0, 4).map((src, i) => (
                <img key={`${src}-${i}`} src={src} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
          ) : headerArt ? (
            <img src={headerArt} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl text-[var(--music-muted)]">
              ♪
            </div>
          )}
        </div>
        <div className="min-w-0 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--music-muted)]">
            {category === "playlists"
              ? t("music.playlists")
              : category === "favorites"
                ? t("music.favorites")
                : t("music.library")}
          </p>
          {!(category === "folders" && selectedGroup) ? (
            <h1 className="truncate text-3xl font-black text-[var(--music-text)] md:text-5xl">
              {title}
            </h1>
          ) : null}
          <p className="mt-2 text-sm text-[var(--music-muted)]">
            {t("music.songCount", { count: visibleTracks.length })}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-2 pb-4">
        {visibleTracks.length > 0 ? (
          <div className="mb-2 flex shrink-0 items-center justify-end gap-1 px-2">
            <div
              className="inline-flex rounded-md border border-[var(--music-border)] bg-[var(--music-surface)]/80 p-0.5 backdrop-blur-sm"
              role="group"
              aria-label={t("music.viewMode")}
            >
              <button
                type="button"
                title={t("music.viewList")}
                aria-pressed={libraryView === "list"}
                onClick={() => setLibraryView("list")}
                className={cn(
                  "rounded px-2 py-1.5 transition",
                  libraryView === "list"
                    ? "bg-[var(--music-hover)] text-[var(--music-text)]"
                    : "text-[var(--music-muted)] hover:text-[var(--music-text)]",
                )}
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={t("music.viewGrid")}
                aria-pressed={libraryView === "grid"}
                onClick={() => setLibraryView("grid")}
                className={cn(
                  "rounded px-2 py-1.5 transition",
                  libraryView === "grid"
                    ? "bg-[var(--music-hover)] text-[var(--music-text)]"
                    : "text-[var(--music-muted)] hover:text-[var(--music-text)]",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {visibleTracks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-md text-sm text-[var(--music-muted)]">
              {tracks.length === 0
                ? t("music.emptyLibrary")
                : category === "favorites"
                  ? t("music.emptyFavorites")
                  : t("music.emptyCategory")}
            </p>
            <MusicImportMenu prominent />
          </div>
        ) : libraryView === "grid" ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-[var(--music-overlay)] p-4 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visibleTracks.map((track) => (
                <MusicTrackGridCard
                  key={track.id}
                  track={track}
                  active={currentId === track.id}
                  playing={playing && currentId === track.id}
                  onPlay={() => playTrack(track.id, visibleIds)}
                  onRemove={() => removeTrack(track.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-[var(--music-overlay)] backdrop-blur-sm">
            <table className="w-full min-w-[520px] border-collapse">
              <thead className="sticky top-0 z-10 border-b border-[var(--music-border)] bg-[var(--music-surface)]/90 text-left text-xs uppercase tracking-wider text-[var(--music-muted)] backdrop-blur">
                <tr>
                  <th className="w-10 px-4 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Title</th>
                  <th className="hidden px-2 py-2 font-medium md:table-cell">Album</th>
                  <th className="hidden px-2 py-2 font-medium lg:table-cell">Genre</th>
                  <th className="px-4 py-2 text-right font-medium">
                    <span className="inline-block w-10">Time</span>
                  </th>
                  <th className="w-10" aria-label={t("music.favorites")} />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {visibleTracks.map((track, i) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    active={currentId === track.id}
                    playing={playing && currentId === track.id}
                    onPlay={() => playTrack(track.id, visibleIds)}
                    onRemove={() => removeTrack(track.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
