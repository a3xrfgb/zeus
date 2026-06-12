import { cn } from "../../lib/utils";

type Props = {
  images: string[];
  className?: string;
};

export function PhotoGalleryBlurredBackdrop({ images, className }: Props) {
  if (images.length === 0) {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--gallery-elevated)] to-[var(--gallery-bg)]",
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
          style={{ filter: "var(--gallery-blur-filter)" }}
        />
        <div className="absolute inset-0 bg-[var(--gallery-blur-scrim)]" />
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
            style={{ filter: "var(--gallery-blur-filter)" }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-[var(--gallery-blur-scrim)]" />
    </div>
  );
}
