import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { publicAsset } from "../../lib/publicAsset";
import { cn } from "../../lib/utils";

export function ZeusLogo({
  className,
  alt = "",
  color = "auto",
}: {
  className?: string;
  alt?: string;
  /** Force logo tint on light surfaces (e.g. first-launch splash). */
  color?: "auto" | "white" | "black";
}) {
  const effectiveDark = useEffectiveDark();
  const tint =
    color === "white"
      ? "brightness-0 invert"
      : color === "black"
        ? "brightness-0"
        : effectiveDark
          ? "brightness-0 invert"
          : "brightness-0";
  return (
    <img
      src={publicAsset("zeus-logo.png")}
      alt={alt}
      className={cn(className, tint)}
      draggable={false}
    />
  );
}
