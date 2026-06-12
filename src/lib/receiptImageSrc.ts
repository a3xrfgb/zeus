import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import type { ReceiptRecord } from "../types/receipt";

export function receiptImageSrc(receipt: ReceiptRecord): string | null {
  if (!receipt.imageRef) return null;
  if (isTauri() && !receipt.imageRef.startsWith("blob:") && !receipt.imageRef.startsWith("data:")) {
    return convertFileSrc(receipt.imageRef);
  }
  return receipt.imageRef;
}
