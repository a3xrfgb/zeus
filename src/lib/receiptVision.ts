import { isTauri } from "@tauri-apps/api/core";

import type { FinanceExpenseCategory } from "../store/financeStore";

import type { ParsedReceiptFields } from "../types/receipt";

import type { ImportReceiptImageResult, ReceiptVisionResult } from "../types/receiptVision";

import { api } from "./tauri";



const FINANCE_CATEGORIES: FinanceExpenseCategory[] = [

  "food",

  "transport",

  "bills",

  "rent",

  "subscriptions",

  "shopping",

  "other",

];



export type ReceiptExtractStage = "copying" | "loadingModel" | "analyzing" | "done";



export type ParsedReceiptImport = ParsedReceiptFields & { imageRef: string };



function mapCategory(raw: string): FinanceExpenseCategory {

  const key = raw.trim().toLowerCase() as FinanceExpenseCategory;

  return FINANCE_CATEGORIES.includes(key) ? key : "other";

}



function visionResultToParsed(result: ReceiptVisionResult): ParsedReceiptFields {

  return {

    storeName: result.storeName,

    itemType: result.itemType,

    category: mapCategory(result.category),

    totalAmount: result.totalAmount,

    currency: result.currency,

    date: result.date,

    items: result.items,

    rawText: result.rawText,

  };

}



export function formatInvokeError(err: unknown): string {

  if (typeof err === "string") return err;

  if (err && typeof err === "object") {

    const o = err as { message?: string; toString?: () => string };

    if (typeof o.message === "string" && o.message.trim()) return o.message;

    if (typeof o.toString === "function") {

      const s = o.toString();

      if (s && s !== "[object Object]") return s;

    }

  }

  return String(err);

}



export function normalizeReceiptPath(p: string): string {
  return p
    .trim()
    .replace(/^\\\\\?\\/i, "")
    .replace(/^\/\/\?\//, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

export function receiptImagePathsEqual(a: string, b: string): boolean {
  return normalizeReceiptPath(a) === normalizeReceiptPath(b);
}

export function receiptFileNamesEqual(a: string, b: string): boolean {
  const name = (p: string) =>
    p
      .trim()
      .replace(/^\\\\\?\\/i, "")
      .split(/[/\\]/)
      .pop()
      ?.toLowerCase() ?? "";
  return name(a) === name(b);
}

function looksLikeReceiptsFolderPath(path: string): boolean {
  const norm = normalizeReceiptPath(path);
  return norm.includes("/receipts/") || norm.endsWith("/receipts");
}

function normalizeImportReceiptResult(
  result: ImportReceiptImageResult | string,
): ImportReceiptImageResult {
  if (typeof result === "string") {
    return { path: result, reused: looksLikeReceiptsFolderPath(result) };
  }
  if (result && typeof result === "object" && typeof result.path === "string") {
    return { path: result.path, reused: Boolean(result.reused) };
  }
  throw new Error("Invalid import_receipt_image response");
}

/** Copy or reuse an image in Zeus's receipts folder (Tauri only). */
export async function storeReceiptImage(imagePath: string): Promise<ImportReceiptImageResult> {
  if (!isTauri()) {
    throw new Error("RECEIPT_VISION_DESKTOP_ONLY");
  }
  return normalizeImportReceiptResult(await api.importReceiptImage(imagePath));
}

export function findExistingReceiptForImport(
  receipts: { fileName: string; imageRef: string; storeName: string }[],
  storedPath: string,
  fileName: string,
) {
  const byPath = receipts.find((r) => receiptImagePathsEqual(r.imageRef, storedPath));
  if (byPath) return byPath;
  return receipts.find(
    (r) =>
      receiptFileNamesEqual(r.fileName, fileName) ||
      receiptFileNamesEqual(r.imageRef, fileName),
  );
}

/** Run vision extraction on an image already stored under receipts/. */
export async function extractReceiptFromStoredPath(
  storedPath: string,
  modelId: string,
  onProgress?: (stage: ReceiptExtractStage) => void,
): Promise<ParsedReceiptImport> {
  if (!isTauri()) {
    throw new Error("RECEIPT_VISION_DESKTOP_ONLY");
  }
  onProgress?.("loadingModel");
  await api.preloadReceiptVisionModel(modelId);
  onProgress?.("analyzing");
  const result = await api.extractReceiptVision(storedPath, modelId);
  onProgress?.("done");
  return { ...visionResultToParsed(result), imageRef: storedPath };
}

/** Copy image into Zeus data dir, load vision model, extract fields (Tauri only). */
export async function extractReceiptFromImagePath(
  imagePath: string,
  modelId: string,
  onProgress?: (stage: ReceiptExtractStage) => void,
): Promise<ParsedReceiptImport> {
  onProgress?.("copying");
  const { path: storedPath } = await storeReceiptImage(imagePath);
  return extractReceiptFromStoredPath(storedPath, modelId, onProgress);
}

