export type PhotoRotation = 0 | 90 | 180 | 270;

export type PhotoTransform = {
  rotation: PhotoRotation;
  flipH: boolean;
  flipV: boolean;
};

export type GalleryMediaKind = "image" | "video";

export type PhotoGalleryViewMode = "grid" | "list";

export const GALLERY_TILE_SIZE_MIN = 1;
export const GALLERY_TILE_SIZE_MAX = 5;
export const GALLERY_TILE_SIZE_DEFAULT = 3;

const GRID_MIN_PX: Record<number, number> = {
  1: 100,
  2: 140,
  3: 180,
  4: 240,
  5: 320,
};

const LIST_THUMB_PX: Record<number, number> = {
  1: 44,
  2: 52,
  3: 64,
  4: 80,
  5: 104,
};

export function galleryGridMinPx(size: number): number {
  return GRID_MIN_PX[size] ?? GRID_MIN_PX[GALLERY_TILE_SIZE_DEFAULT];
}

export function galleryListThumbPx(size: number): number {
  return LIST_THUMB_PX[size] ?? LIST_THUMB_PX[GALLERY_TILE_SIZE_DEFAULT];
}

export type PhotoItem = {
  id: string;
  path: string;
  fileName: string;
  folder: string;
  importedAt: number;
  kind: GalleryMediaKind;
  width?: number;
  height?: number;
  sizeBytes?: number;
  durationSec?: number;
  transform?: PhotoTransform;
};

export type PersistedPhotoItem = Pick<
  PhotoItem,
  | "id"
  | "path"
  | "fileName"
  | "folder"
  | "importedAt"
  | "kind"
  | "width"
  | "height"
  | "sizeBytes"
  | "durationSec"
  | "transform"
>;
