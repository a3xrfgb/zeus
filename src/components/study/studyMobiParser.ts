import { initKf8File, initMobiFile } from "@lingo-reader/mobi-parser";
import { copyUint8ToArrayBuffer, type StudyDocKind } from "./studyDocument";

export type KindleDocKind = "mobi" | "kf8";

const KF8_EXTS = new Set(["azw3", "kf8"]);
const MOBI_EXTS = new Set(["mobi", "azw"]);

export function extToKindleHint(name: string): KindleDocKind | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (KF8_EXTS.has(ext)) return "kf8";
  if (MOBI_EXTS.has(ext)) return "mobi";
  return null;
}

/** Probe file bytes so combo .mobi (KF8 inside) opens with the KF8 parser. */
export async function resolveKindleKind(
  bytes: Uint8Array,
  hint: StudyDocKind,
): Promise<KindleDocKind> {
  if (hint === "kf8") return "kf8";
  if (hint !== "mobi") return "mobi";
  try {
    const probe = await initKf8File(bytes);
    probe.destroy();
    return "kf8";
  } catch {
    return "mobi";
  }
}

export async function openKindleBook(bytes: Uint8Array, kind: KindleDocKind) {
  return kind === "kf8" ? initKf8File(bytes) : initMobiFile(bytes);
}

export async function loadKindleDoc(
  bytes: Uint8Array,
  name: string,
  hint: StudyDocKind,
): Promise<{ kind: KindleDocKind; name: string; blobUrl: string }> {
  const kind = await resolveKindleKind(bytes, hint);
  const mime =
    kind === "kf8" ? "application/vnd.amazon.mobi8-ebook" : "application/x-mobipocket-ebook";
  const blob = new Blob([copyUint8ToArrayBuffer(bytes)], { type: mime });
  return { kind, name, blobUrl: URL.createObjectURL(blob) };
}
