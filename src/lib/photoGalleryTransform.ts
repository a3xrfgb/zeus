import type { PhotoTransform } from "../types/photoGallery";

export const DEFAULT_PHOTO_TRANSFORM: PhotoTransform = {
  rotation: 0,
  flipH: false,
  flipV: false,
};

export function normalizePhotoTransform(
  transform?: Partial<PhotoTransform> | null,
): PhotoTransform {
  const rotation = transform?.rotation ?? 0;
  const normRot = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360 as PhotoTransform["rotation"];
  return {
    rotation: normRot === 90 || normRot === 180 || normRot === 270 ? normRot : 0,
    flipH: Boolean(transform?.flipH),
    flipV: Boolean(transform?.flipV),
  };
}

export function photoTransformCss(transform?: PhotoTransform, scale = 1): string {
  const t = normalizePhotoTransform(transform);
  const parts: string[] = [];
  if (scale !== 1) parts.push(`scale(${scale})`);
  if (t.rotation) parts.push(`rotate(${t.rotation}deg)`);
  if (t.flipH) parts.push("scaleX(-1)");
  if (t.flipV) parts.push("scaleY(-1)");
  return parts.length ? parts.join(" ") : "none";
}

export function rotateLeft(transform: PhotoTransform): PhotoTransform {
  const t = normalizePhotoTransform(transform);
  const next = (t.rotation - 90 + 360) % 360;
  return { ...t, rotation: next as PhotoTransform["rotation"] };
}

export function rotateRight(transform: PhotoTransform): PhotoTransform {
  const t = normalizePhotoTransform(transform);
  const next = (t.rotation + 90) % 360;
  return { ...t, rotation: next as PhotoTransform["rotation"] };
}

export function flipHorizontal(transform: PhotoTransform): PhotoTransform {
  const t = normalizePhotoTransform(transform);
  return { ...t, flipH: !t.flipH };
}

export function flipVertical(transform: PhotoTransform): PhotoTransform {
  const t = normalizePhotoTransform(transform);
  return { ...t, flipV: !t.flipV };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

/** Bake rotation / mirror into a PNG blob (copy, chat attach). */
export async function renderTransformedImage(
  imageUrl: string,
  transform?: PhotoTransform,
): Promise<Blob> {
  const t = normalizePhotoTransform(transform);
  if (
    t.rotation === 0 &&
    !t.flipH &&
    !t.flipV
  ) {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to read image (${response.status})`);
    return response.blob();
  }

  const img = await loadImage(imageUrl);
  const rot = t.rotation;
  const swap = rot === 90 || rot === 270;
  const w = swap ? img.naturalHeight : img.naturalWidth;
  const h = swap ? img.naturalWidth : img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.translate(w / 2, h / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      "image/png",
    );
  });
}

export async function renderTransformedDataUrl(
  imageUrl: string,
  transform?: PhotoTransform,
): Promise<string> {
  const blob = await renderTransformedImage(imageUrl, transform);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}
