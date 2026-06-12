export interface ReceiptVisionResult {
  storeName: string;
  itemType: string;
  category: string;
  totalAmount: number;
  currency: string | null;
  date: string;
  items: string[];
  rawText: string;
  modelId: string;
}

export interface ReceiptVisionModelOption {
  id: string;
  name: string;
  mmprojId: string;
}

export interface ReceiptVisionStatus {
  ready: boolean;
  modelId: string | null;
  models: ReceiptVisionModelOption[];
  message: string;
}

export interface ImportReceiptImageResult {
  path: string;
  reused: boolean;
}

/** Image formats supported by Gemma vision (transcoded via mtmd / image crate). */
export const RECEIPT_IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
] as const;

export const RECEIPT_IMAGE_ACCEPT = RECEIPT_IMAGE_EXTENSIONS.map((e) => `.${e}`).join(",");
