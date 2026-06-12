import {
  ChevronDown,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { getTrackCoverSrc } from "../../lib/musicCover";
import { formatDuration } from "../../lib/musicLocal";
import { cn } from "../../lib/utils";
import { useMusicStore } from "../../store/musicStore";
import type { MusicTrack } from "../../types/music";
import { MusicBlurredBackdrop } from "./MusicBlurredBackdrop";
import { MusicFavoriteButton } from "./MusicFavoriteButton";

type Props = {
  track: MusicTrack;
  onSeek: (time: number) => void;
};

export function MusicNowPlaying({ track, onSeek }: Props) {
  const { t } = useTranslation();
  const playing = useMusicStore((s) => s.playing);
  const shuffle = useMusicStore((s) => s.shuffle);
  const repeat = useMusicStore((s) => s.repeat);
  const currentTime = useMusicStore((s) => s.currentTime);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const playNext = useMusicStore((s) => s.playNext);
  const playPrevious = useMusicStore((s) => s.playPrevious);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const cycleRepeat = useMusicStore((s) => s.cycleRepeat);
  const closeNowPlaying = useMusicStore((s) => s.closeNowPlaying);

  const duration = track.durationSec;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const cover = getTrackCoverSrc(track);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--music-border)]">
      <MusicBlurredBackdrop
        intense
        images={cover ? [cover] : []}
        className="rounded-lg"
      />

      <button
        type="button"
        onClick={closeNowPlaying}
        className="relative z-10 m-4 flex w-fit items-center gap-1 rounded-full border border-[var(--music-border)] bg-[var(--music-overlay)] px-3 py-1.5 text-xs font-semibold text-[var(--music-text)] backdrop-blur-md transition hover:bg-[var(--music-hover)]"
      >
        <ChevronDown className="h-4 w-4" />
        {t("music.backToLibrary")}
      </button>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-8 pb-10">
        <div className="h-[min(42vh,320px)] w-[min(42vh,320px)] shrink-0 overflow-hidden rounded-2xl bg-[var(--music-elevated)] shadow-2xl ring-1 ring-[var(--music-border)]">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl text-[var(--music-muted)]">
              ♪
            </div>
          )}
        </div>

        <div className="max-w-lg text-center">
          <div className="mb-2 flex justify-center">
            <MusicFavoriteButton trackId={track.id} size={22} />
          </div>
          <h2 className="truncate text-2xl font-bold text-[var(--music-text)] md:text-4xl">
            {track.title}
          </h2>
          <p className="mt-2 truncate text-base text-[var(--music-muted)] md:text-lg">
            {track.artist}
          </p>
          <p className="mt-1 truncate text-sm text-[var(--music-muted)]">{track.album}</p>
        </div>

        <div className="w-full max-w-xl space-y-3">
          <div className="flex items-center gap-3 text-xs tabular-nums text-[var(--music-muted)]">
            <span className="w-10 text-right">{formatDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              disabled={duration <= 0}
              onChange={(e) => onSeek((Number(e.target.value) / 100) * duration)}
              className="music-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--music-border)] accent-[var(--music-accent)] disabled:opacity-40"
            />
            <span className="w-10">{formatDuration(duration)}</span>
          </div>

          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              title={t("music.shuffle")}
              onClick={toggleShuffle}
              className={cn(
                "rounded-full p-2 text-[var(--music-muted)] transition hover:text-[var(--music-text)]",
                shuffle && "text-[var(--music-accent)]",
              )}
            >
              <Shuffle className="h-5 w-5" />
            </button>
            <button
              type="button"
              title={t("music.previous")}
              onClick={playPrevious}
              className="rounded-full p-2 text-[var(--music-muted)] transition hover:text-[var(--music-text)]"
            >
              <SkipBack className="h-7 w-7 fill-current" />
            </button>
            <button
              type="button"
              title={playing ? t("music.pause") : t("music.play")}
              onClick={togglePlay}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--music-play-bg)] text-[var(--music-play-fg)] shadow-lg transition hover:scale-105 hover:bg-[var(--music-play-bg-hover)]"
            >
              {playing ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="h-7 w-7 fill-current pl-0.5" />
              )}
            </button>
            <button
              type="button"
              title={t("music.next")}
              onClick={playNext}
              className="rounded-full p-2 text-[var(--music-muted)] transition hover:text-[var(--music-text)]"
            >
              <SkipForward className="h-7 w-7 fill-current" />
            </button>
            <button
              type="button"
              title={t("music.repeat")}
              onClick={cycleRepeat}
              className={cn(
                "rounded-full p-2 text-[var(--music-muted)] transition hover:text-[var(--music-text)]",
                repeat !== "off" && "text-[var(--music-accent)]",
              )}
            >
              {repeat === "one" ? (
                <Repeat1 className="h-5 w-5" />
              ) : (
                <Repeat className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
