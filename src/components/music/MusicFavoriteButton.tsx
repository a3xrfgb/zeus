import { Heart } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import { isTrackFavorite, useMusicStore } from "../../store/musicStore";

export function MusicFavoriteButton({
  trackId,
  className,
  size = 16,
}: {
  trackId: string;
  className?: string;
  size?: number;
}) {
  const { t } = useTranslation();
  const favoriteTrackIds = useMusicStore((s) => s.favoriteTrackIds);
  const toggleFavorite = useMusicStore((s) => s.toggleFavorite);
  const favored = isTrackFavorite(trackId, favoriteTrackIds);

  return (
    <button
      type="button"
      title={favored ? t("music.unfavorite") : t("music.favorite")}
      aria-label={favored ? t("music.unfavorite") : t("music.favorite")}
      aria-pressed={favored}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(trackId);
      }}
      className={cn(
        "rounded p-1 transition",
        favored
          ? "text-rose-500 hover:text-rose-600"
          : "text-[var(--music-muted)] hover:text-[var(--music-text)]",
        className,
      )}
    >
      <Heart
        className={cn(favored && "fill-current")}
        style={{ width: size, height: size }}
      />
    </button>
  );
}
