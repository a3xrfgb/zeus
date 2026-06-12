import { Pause, Play, Trash2 } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { getTrackCoverSrc } from "../../lib/musicCover";
import { cn } from "../../lib/utils";
import type { MusicTrack } from "../../types/music";
import { MusicFavoriteButton } from "./MusicFavoriteButton";

export function MusicTrackGridCard({
  track,
  active,
  playing,
  onPlay,
  onRemove,
}: {
  track: MusicTrack;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const coverSrc = getTrackCoverSrc(track);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      }}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--music-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--music-surface)]",
      )}
    >
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-md bg-[var(--music-elevated)] shadow-sm ring-1 ring-[var(--music-border)] transition",
          "group-hover:shadow-md group-hover:ring-[var(--music-border)]/80",
          active && "ring-[var(--music-accent)]/60",
        )}
      >
        {coverSrc ? (
          <img src={coverSrc} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-[var(--music-muted)]">
            ♪
          </div>
        )}

        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100",
            active && "opacity-100",
          )}
        >
          {active && playing ? (
            <Pause className="h-10 w-10 fill-white text-white drop-shadow" />
          ) : (
            <Play className="h-10 w-10 fill-white text-white drop-shadow" />
          )}
        </div>

        <div className="absolute left-1.5 top-1.5 opacity-0 transition group-hover:opacity-100">
          <MusicFavoriteButton
            trackId={track.id}
            size={14}
            className="rounded-md bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70 hover:text-white"
          />
        </div>

        <button
          type="button"
          title={t("music.remove")}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white/90 opacity-0 backdrop-blur-sm transition hover:bg-black/70 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 min-w-0 space-y-0.5">
        <p
          className={cn(
            "truncate text-sm font-medium",
            active ? "text-[var(--music-accent)]" : "text-[var(--music-text)]",
          )}
        >
          {track.title}
        </p>
        <p className="truncate text-xs text-[var(--music-muted)]">{track.artist}</p>
        {track.album ? (
          <p className="truncate text-[11px] text-[var(--music-muted)]/80">{track.album}</p>
        ) : null}
      </div>
    </div>
  );
}
