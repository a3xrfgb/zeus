/** Remote icon assets (Icons8 / external) */
export const ICONS = {
  themeDark:
    "https://img.icons8.com/ios-filled/50/do-not-disturb-2.png",
  themeLight:
    "https://img.icons8.com/external-glyph-silhouettes-icons-papa-vector/78/external-Light-Mode-interface-glyph-silhouettes-icons-papa-vector.png",
  lockLocked:
    "https://img.icons8.com/?size=100&id=ZiVQbNuQh5g4&format=png&color=000000",
  lockUnlocked: "https://img.icons8.com/ios/50/unlock-2.png",
  notesPastel:
    "https://img.icons8.com/pastel-glyph/64/note.png",
  music:
    "https://img.icons8.com/?size=100&id=9403&format=png&color=000000",
  photoGallery:
    "https://img.icons8.com/?size=100&id=18943&format=png&color=000000",
  study:
    "https://img.icons8.com/?size=100&id=36929&format=png&color=000000",
  importDocument:
    "https://img.icons8.com/?size=100&id=6895&format=png&color=000000",
  promptLibrary:
    "https://img.icons8.com/?size=100&id=kn4YakXrYFZT&format=png&color=000000",
  createProject:
    "https://img.icons8.com/?size=100&id=71186&format=png&color=000000",
  models:
    "https://img.icons8.com/?size=100&id=O16bszyZscOM&format=png&color=000000",
} as const;

export function RemoteIcon({
  src,
  alt,
  className,
  size = 24,
}: {
  src: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
