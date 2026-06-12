import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { getTrackCoverSrc } from "../../lib/musicCover";
import { formatDuration } from "../../lib/musicLocal";
import type { MusicTrack } from "../../types/music";
import { cn } from "../../lib/utils";
import { useMusicStore } from "../../store/musicStore";
import { MusicFavoriteButton } from "./MusicFavoriteButton";

type Props = {
  currentTrack: Pick<
    MusicTrack,
    "id" | "title" | "artist" | "path" | "coverPath" | "coverDataUrl" | "durationSec"
  > | null;
  onSeek: (time: number) => void;
};

export function MusicPlayingBar({ currentTrack, onSeek }: Props) {
  const { t } = useTranslation();
  const playing = useMusicStore((s) => s.playing);
  const shuffle = useMusicStore((s) => s.shuffle);
  const repeat = useMusicStore((s) => s.repeat);
  const volume = useMusicStore((s) => s.volume);
  const currentTime = useMusicStore((s) => s.currentTime);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const playNext = useMusicStore((s) => s.playNext);
  const playPrevious = useMusicStore((s) => s.playPrevious);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const cycleRepeat = useMusicStore((s) => s.cycleRepeat);
  const setVolume = useMusicStore((s) => s.setVolume);
  const openNowPlaying = useMusicStore((s) => s.openNowPlaying);

  const duration = currentTrack?.durationSec ?? 0;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const cover = currentTrack ? getTrackCoverSrc(currentTrack) : undefined;

  return (
    <footer className="shrink-0 border-t border-[var(--music-border)] bg-[var(--music-surface)] px-4 py-2">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4">
        <button
          type="button"
          disabled={!currentTrack}
          onClick={() => currentTrack && openNowPlaying()}
          className="flex min-w-0 flex-[1_1_30%] items-center gap-3 text-left transition enabled:hover:opacity-90 disabled:cursor-default"
        >
          {currentTrack ? (
            <>
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-[var(--music-elevated)] shadow-lg ring-1 ring-[var(--music-border)]">
                {cover ? (
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--music-muted)]">
                    ♪
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--music-text)]">
                  {currentTrack.title}
                </p>
                <p className="truncate text-xs text-[var(--music-muted)]">{currentTrack.artist}</p>
              </div>
              <MusicFavoriteButton trackId={currentTrack.id} className="shrink-0" />
            </>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--music-text)]">{t("music.nothingPlaying")}</p>
              <p className="text-xs text-[var(--music-muted)]">{t("music.nothingPlayingHint")}</p>
            </div>
          )}
        </button>

        <div className="flex flex-[1_1_40%] flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              title={t("music.shuffle")}
              onClick={toggleShuffle}
              className={cn(
                "rounded-full p-2 text-[var(--music-muted)] transition hover:text-[var(--music-text)]",
                shuffle && "text-[var(--music-accent)]",
              )}
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t("music.previous")}
              onClick={playPrevious}
              className="rounded-full p-2 text-[var(--music-muted)] transition hover:text-[var(--music-text)]"
            >
              <SkipBack className="h-5 w-5 fill-current" />
            </button>
            <button
              type="button"
              title={playing ? t("music.pause") : t("music.play")}
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--music-play-bg)] text-[var(--music-play-fg)] transition hover:scale-105 hover:bg-[var(--music-play-bg-hover)]"
            >
              {playing ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current pl-0.5" />
              )}
            </button>
            <button
              type="button"
              title={t("music.next")}
              onClick={playNext}
              className="rounded-full p-2 text-[var(--music-muted)] transition hover:text-[var(--music-text)]"
            >
              <SkipForward className="h-5 w-5 fill-current" />
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
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex w-full max-w-md items-center gap-2 text-[11px] text-[var(--music-muted)]">
            <span className="w-9 text-right tabular-nums">{formatDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              disabled={!currentTrack || duration <= 0}
              onChange={(e) => {
                const pct = Number(e.target.value);
                onSeek((pct / 100) * duration);
              }}
              className="music-range h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--music-border)] accent-[var(--music-accent)] disabled:opacity-40"
            />
            <span className="w-9 tabular-nums">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="flex flex-[1_1_30%] items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-[var(--music-muted)] transition hover:text-[var(--music-text)]"
          >
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            title={t("music.volume")}
            onInput={(e) => setVolume(Number((e.target as HTMLInputElement).value) / 100)}
            className="music-range h-1 w-24 cursor-pointer appearance-none rounded-full bg-[var(--music-border)] accent-[var(--music-accent)]"
          />
        </div>
      </div>
    </footer>
  );
}
