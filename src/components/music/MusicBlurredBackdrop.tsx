import { cn } from "../../lib/utils";

type Props = {
  images: string[];
  className?: string;
  /** Stronger blur for full-screen now playing */
  intense?: boolean;
};

export function MusicBlurredBackdrop({ images, className, intense = false }: Props) {
  if (images.length === 0) {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--music-elevated)] to-[var(--music-bg)]",
          className,
        )}
      />
    );
  }

  if (images.length === 1) {
    return (
      <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
        <img
          src={images[0]}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover"
          style={{ filter: intense ? "var(--music-blur-filter-intense)" : "var(--music-blur-filter)" }}
        />
        <div className="absolute inset-0 bg-[var(--music-blur-scrim)]" />
      </div>
    );
  }

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        {images.slice(0, 4).map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            className="h-full w-full object-cover"
            style={{ filter: intense ? "var(--music-blur-filter-intense)" : "var(--music-blur-filter)" }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-[var(--music-blur-scrim)]" />
    </div>
  );
}
