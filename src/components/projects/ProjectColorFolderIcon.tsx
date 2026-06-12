import { Folder } from "lucide-react";
import { cn } from "../../lib/utils";

const DEFAULT_PROJECT_COLOR = "#7c6af7";

type Props = {
  color?: string | null;
  className?: string;
  size?: number;
};

/** Folder icon tinted with the project's chosen color. */
export function ProjectColorFolderIcon({ color, className, size = 16 }: Props) {
  const hex = (color || DEFAULT_PROJECT_COLOR).toLowerCase();
  const isLight = hex === "#ffffff" || hex === "#fff";
  const isDark = hex === "#000000" || hex === "#000";

  return (
    <Folder
      className={cn(
        "shrink-0",
        isLight && "drop-shadow-[0_0_0_1px_rgba(0,0,0,0.25)]",
        isDark && "drop-shadow-[0_0_0_1px_rgba(255,255,255,0.2)]",
        className,
      )}
      width={size}
      height={size}
      strokeWidth={1.75}
      style={{ color: hex, fill: hex }}
      aria-hidden
    />
  );
}
